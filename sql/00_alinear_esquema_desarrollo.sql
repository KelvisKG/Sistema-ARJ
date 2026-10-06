-- ==============================================================================
-- SISTEMA ARJ · 00 — ALINEAR EL ESQUEMA DE DESARROLLO CON PRODUCCIÓN
--
-- SOLO para el proyecto de desarrollo/staging (wbxrkygtakdmckfzlzjk).
-- Producción (ahnzbmzzjvwyddiwdpss) ya tiene todo esto: NO hace falta correrlo allí.
--
-- Agrega las tablas y columnas que el sistema usa y que desarrollo no tiene
-- (detectadas el 06-oct-2026). Es idempotente y no borra datos: las únicas
-- tablas que puede recrear son traspasos/traspaso_items, y solo si están VACÍAS
-- y su id no es uuid.
--
-- Orden: 1) este archivo  2) 02_correcciones_auditoria.sql
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── contadores ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contadores (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL UNIQUE,
  prefijo VARCHAR(20) NOT NULL,
  anio INT NOT NULL,
  ultimo_numero INT NOT NULL DEFAULT 0
);

-- ─── configuracion ───────────────────────────────────────────────────────────
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS costos_fijos_hist JSONB DEFAULT '{}'::JSONB;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS metas_hist JSONB DEFAULT '{}'::JSONB;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS tasas_actualizadas TIMESTAMPTZ;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─── productos / pagos / factura_items ──────────────────────────────────────
ALTER TABLE productos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE factura_items ADD COLUMN IF NOT EXISTS factor_landed NUMERIC;

-- ─── cotizaciones ────────────────────────────────────────────────────────────
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS tasa_par NUMERIC;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS tasa_bcv NUMERIC;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS factura_id INT;
ALTER TABLE cotizacion_items ADD COLUMN IF NOT EXISTS fob_unitario NUMERIC DEFAULT 0;
ALTER TABLE cotizacion_items ADD COLUMN IF NOT EXISTS total_linea NUMERIC DEFAULT 0;
ALTER TABLE cotizacion_items ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'Publico';

-- ─── movimientos_caja ────────────────────────────────────────────────────────
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS beneficiario TEXT;
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS documento TEXT;
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS tasa_usada NUMERIC;
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS moneda_origen TEXT DEFAULT 'USD';
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS afecta_caja BOOLEAN DEFAULT TRUE;
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS anulado_motivo TEXT;
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS registrado_por TEXT;
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS tasa_bcv_ref NUMERIC;

-- ─── embarques (el factor lo calcula Postgres, como en producción) ──────────
CREATE TABLE IF NOT EXISTS embarques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  proveedor TEXT NOT NULL,
  fecha_llegada DATE,
  fob_total NUMERIC,
  monto_flete_aduana NUMERIC,
  pct_flete_aduana NUMERIC NOT NULL DEFAULT 0,
  pct_comision NUMERIC NOT NULL DEFAULT 0,
  pct_divisas NUMERIC NOT NULL DEFAULT 0,
  factor NUMERIC GENERATED ALWAYS AS (
    ROUND((1 + pct_flete_aduana / 100) * (1 + pct_comision / 100) * (1 + pct_divisas / 100), 6)
  ) STORED,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- productos.embarque_id debe ser uuid (solo se convierte si no tiene valores)
DO $$
DECLARE v_tipo TEXT;
BEGIN
  SELECT data_type INTO v_tipo FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'productos' AND column_name = 'embarque_id';
  IF v_tipo IS NULL THEN
    ALTER TABLE productos ADD COLUMN embarque_id UUID;
  ELSIF v_tipo <> 'uuid' THEN
    IF EXISTS (SELECT 1 FROM productos WHERE embarque_id IS NOT NULL) THEN
      RAISE WARNING 'productos.embarque_id es % y tiene datos: conviértelo a mano a uuid', v_tipo;
    ELSE
      ALTER TABLE productos ALTER COLUMN embarque_id TYPE UUID USING NULL;
    END IF;
  END IF;
END $$;

-- ─── traspasos (Notas de Entrega) ────────────────────────────────────────────
-- Si el id no es uuid y las tablas están vacías, se recrean con el esquema de producción
DO $$
DECLARE v_tipo TEXT;
BEGIN
  SELECT data_type INTO v_tipo FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'traspasos' AND column_name = 'id';
  IF v_tipo IS NOT NULL AND v_tipo <> 'uuid' THEN
    IF EXISTS (SELECT 1 FROM traspasos) THEN
      RAISE WARNING 'traspasos.id es % y la tabla tiene datos: no se recrea', v_tipo;
    ELSE
      DROP TABLE IF EXISTS traspaso_items;
      DROP TABLE traspasos;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS traspasos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origen TEXT,
  destino TEXT
);
ALTER TABLE traspasos ADD COLUMN IF NOT EXISTS embarque_codigo TEXT;
ALTER TABLE traspasos ADD COLUMN IF NOT EXISTS referencia TEXT;
ALTER TABLE traspasos ADD COLUMN IF NOT EXISTS usuario TEXT;
ALTER TABLE traspasos ADD COLUMN IF NOT EXISTS productos_count INT DEFAULT 0;
ALTER TABLE traspasos ADD COLUMN IF NOT EXISTS unidades_count INT DEFAULT 0;
ALTER TABLE traspasos ADD COLUMN IF NOT EXISTS total_costo NUMERIC DEFAULT 0;
ALTER TABLE traspasos ADD COLUMN IF NOT EXISTS anulado BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS traspaso_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  traspaso_id UUID REFERENCES traspasos(id) ON DELETE CASCADE,
  producto_id INT,
  cod_alt TEXT,
  descripcion TEXT,
  cantidad INT
);
ALTER TABLE traspaso_items ADD COLUMN IF NOT EXISTS marca TEXT;
ALTER TABLE traspaso_items ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC;
ALTER TABLE traspaso_items ADD COLUMN IF NOT EXISTS total_linea NUMERIC;
ALTER TABLE traspaso_items ADD COLUMN IF NOT EXISTS stock_dist_antes INT;
ALTER TABLE traspaso_items ADD COLUMN IF NOT EXISTS stock_dist_despues INT;
ALTER TABLE traspaso_items ADD COLUMN IF NOT EXISTS stock_vd_antes INT;
ALTER TABLE traspaso_items ADD COLUMN IF NOT EXISTS stock_vd_despues INT;

-- ─── recepciones / conteos ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recepciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo TEXT NOT NULL,
  destino TEXT NOT NULL,
  embarque_id UUID REFERENCES embarques(id),
  embarque_codigo TEXT,
  referencia TEXT,
  usuario TEXT,
  productos_count INT DEFAULT 0,
  unidades_count INT DEFAULT 0,
  total_costo NUMERIC DEFAULT 0,
  no_contados_count INT DEFAULT 0,
  anulado BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS recepcion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcion_id UUID REFERENCES recepciones(id) ON DELETE CASCADE,
  producto_id INT,
  cod_alt TEXT,
  descripcion TEXT,
  marca TEXT,
  cantidad INT,
  costo_unitario NUMERIC,
  total_linea NUMERIC,
  stock_antes INT,
  stock_despues INT,
  clase TEXT
);

-- ─── Contadores iniciales, sincronizados con lo que ya existe ───────────────
INSERT INTO contadores (tipo, prefijo, anio, ultimo_numero)
SELECT v.tipo, v.prefijo, EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'America/Caracas'))::INT, 0
FROM (VALUES ('factura_vd', 'VD'), ('factura_dist', 'DT'), ('presupuesto_vd', 'PRE-VD'),
             ('presupuesto_dist', 'PRE-DT'), ('nota_entrega', 'NE'), ('recepcion', 'REC')) AS v(tipo, prefijo)
ON CONFLICT (tipo) DO NOTHING;

DO $$
DECLARE
  v_anio INT := EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'America/Caracas'))::INT;
  -- Último número usado en una tabla para unos prefijos dados (numero = PREFIJO-AÑO-NNNN)
  v_max INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(split_part(numero, '-', 3), '[^0-9]', '', 'g'), '')::INT), 0) INTO v_max
  FROM facturas WHERE numero LIKE 'VD-' || v_anio || '-%';
  UPDATE contadores SET ultimo_numero = GREATEST(ultimo_numero, v_max), anio = v_anio WHERE tipo = 'factura_vd';

  SELECT COALESCE(MAX(NULLIF(regexp_replace(split_part(numero, '-', 3), '[^0-9]', '', 'g'), '')::INT), 0) INTO v_max
  FROM facturas WHERE numero LIKE 'DT-' || v_anio || '-%' OR numero LIKE 'DIST-' || v_anio || '-%';
  UPDATE contadores SET ultimo_numero = GREATEST(ultimo_numero, v_max), anio = v_anio WHERE tipo = 'factura_dist';

  SELECT COALESCE(MAX(NULLIF(regexp_replace(split_part(numero, '-', 4), '[^0-9]', '', 'g'), '')::INT), 0) INTO v_max
  FROM cotizaciones WHERE numero LIKE 'PRE-VD-' || v_anio || '-%';
  UPDATE contadores SET ultimo_numero = GREATEST(ultimo_numero, v_max), anio = v_anio WHERE tipo = 'presupuesto_vd';

  SELECT COALESCE(MAX(NULLIF(regexp_replace(split_part(numero, '-', 4), '[^0-9]', '', 'g'), '')::INT), 0) INTO v_max
  FROM cotizaciones WHERE numero LIKE 'PRE-DT-' || v_anio || '-%' OR numero LIKE 'PRE-DIST-' || v_anio || '-%';
  UPDATE contadores SET ultimo_numero = GREATEST(ultimo_numero, v_max), anio = v_anio WHERE tipo = 'presupuesto_dist';

  SELECT COALESCE(MAX(NULLIF(regexp_replace(split_part(numero, '-', 3), '[^0-9]', '', 'g'), '')::INT), 0) INTO v_max
  FROM traspasos WHERE numero LIKE 'NE-' || v_anio || '-%';
  UPDATE contadores SET ultimo_numero = GREATEST(ultimo_numero, v_max), anio = v_anio WHERE tipo = 'nota_entrega';

  SELECT COALESCE(MAX(NULLIF(regexp_replace(split_part(numero, '-', 3), '[^0-9]', '', 'g'), '')::INT), 0) INTO v_max
  FROM recepciones WHERE numero LIKE 'REC-' || v_anio || '-%';
  UPDATE contadores SET ultimo_numero = GREATEST(ultimo_numero, v_max), anio = v_anio WHERE tipo = 'recepcion';
END $$;

-- ─── RLS de las tablas nuevas ────────────────────────────────────────────────
-- Las escrituras van SOLO por las funciones del script 02 (SECURITY DEFINER).
-- Usuarios autenticados pueden leer; anon no ve nada. contadores: sin acceso directo.
ALTER TABLE contadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE embarques ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepcion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE traspasos ENABLE ROW LEVEL SECURITY;
ALTER TABLE traspaso_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['embarques', 'recepciones', 'recepcion_items', 'traspasos', 'traspaso_items'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'arj_lectura_autenticados') THEN
      EXECUTE format('CREATE POLICY arj_lectura_autenticados ON %I FOR SELECT TO authenticated USING (true)', t);
    END IF;
  END LOOP;
END $$;

-- Refresca la caché de PostgREST para que la API vea las columnas nuevas
NOTIFY pgrst, 'reload schema';
