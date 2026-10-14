-- ==============================================================================
-- SISTEMA ARJ · 11 — PERFIL DISTRIBUIDORA: CADA UNO VE SOLO LO SUYO (13-oct-2026)
--
-- Pedido de JJ: las distribuidoras externas van a usar el sistema. "Que no se
-- cruce información": cada distribuidora maneja SUS clientes, SUS facturas, SUS
-- cotizaciones y SUS cuentas por cobrar, y ARJ las suyas. Lo único compartido es
-- el inventario de productos IMPORTADOS (los locales no los ven). Y la seguridad
-- tiene que estar en el servidor: que un curioso no pueda ver más, y que si lo
-- intenta quede una alerta.
--
-- Quién es "perfil distribuidora": un perfil NO gerente con la columna nueva
--   perfiles.es_distribuidora = TRUE (se marca a mano en el panel de Supabase).
--   Los vendedores de ARJ que operan en Distribuidora NO se ven afectados.
--
-- Qué hace:
--   1. Columna `propietario` en clientes, facturas y cotizaciones. NULL = de ARJ;
--      un uuid = de esa distribuidora. La pone el SERVIDOR al crear la fila.
--   2. Reglas de lectura (RLS restrictivas, se suman a las que ya existan):
--        · Distribuidora: solo sus clientes/facturas/cotizaciones (y sus renglones,
--          pagos y contactos), solo productos importados, nada de embarques,
--          recepciones, traspasos, caja, bitácora ni otros perfiles.
--        · Vendedores de ARJ: ya no ven lo de las distribuidoras.
--        · Gerente: ve todo, como hasta ahora.
--   3. Escrituras: una distribuidora no puede escribir directo en ninguna tabla
--      (todo pasa por las funciones del servidor), y los disparadores impiden,
--      venga de donde venga, facturar/cotizar/abonar sobre clientes o facturas
--      ajenas, vender productos locales o facturar en Venta Directa.
--   4. Clientes: el RIF es único POR DUEÑO (ARJ y cada distribuidora tienen su
--      propia cartera; el mismo cliente puede estar en las dos).
--   5. Alertas: cada intento bloqueado por los puntos 3 queda en la Bitácora como
--      ALERTA con el nombre del usuario. Ojo: una lectura bloqueada por RLS no
--      genera error (simplemente no devuelve filas), así que esa no se registra.
--
-- Aplicar en desarrollo y en producción después del 10. Idempotente.
-- No cambia nada para los usuarios actuales hasta que se marque un perfil con
-- es_distribuidora = TRUE (salvo que el RIF pasa a ser único por dueño).
--
-- ⚠ Si un script futuro reemplaza una función del servidor (CREATE OR REPLACE),
--   volver a correr la sección 6 de este archivo para que siga dejando alertas.
--   Los bloqueos (secciones 3 a 5) no dependen de eso: siguen funcionando.
--
-- Para dar de alta una distribuidora (panel de Supabase → SQL Editor):
--   UPDATE perfiles SET es_distribuidora = TRUE, empresa = 'dist', rol = 'vendedor'
--   WHERE id = '<uuid del usuario>';
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. COLUMNAS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS es_distribuidora BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE clientes     ADD COLUMN IF NOT EXISTS propietario UUID REFERENCES perfiles(id);
ALTER TABLE facturas     ADD COLUMN IF NOT EXISTS propietario UUID REFERENCES perfiles(id);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS propietario UUID REFERENCES perfiles(id);

CREATE INDEX IF NOT EXISTS clientes_propietario_idx     ON clientes (propietario);
CREATE INDEX IF NOT EXISTS facturas_propietario_idx     ON facturas (propietario);
CREATE INDEX IF NOT EXISTS cotizaciones_propietario_idx ON cotizaciones (propietario);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. HELPERS
--    SECURITY DEFINER: leen `perfiles` sin pasar por sus reglas (si no, la regla
--    de perfiles se llamaría a sí misma).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION arj_es_gerente()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = TRUE AND rol = 'gerente')
$$;

CREATE OR REPLACE FUNCTION arj_es_distribuidora()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND es_distribuidora = TRUE AND rol <> 'gerente')
$$;

-- Dueño que le toca al usuario actual: su uuid si es distribuidora, NULL si es de ARJ
CREATE OR REPLACE FUNCTION arj_propietario_actual()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN arj_es_distribuidora() THEN auth.uid() END
$$;

-- Misma regla que origenDe() de src/services/pricing.js y que emitir_factura_atomica
CREATE OR REPLACE FUNCTION arj_origen_producto(p_origen TEXT, p_factor NUMERIC)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN LOWER(COALESCE(p_origen, '')) IN ('local', 'importado') THEN LOWER(p_origen)
              WHEN p_factor BETWEEN 0.0001 AND 1.001 THEN 'local' ELSE 'importado' END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. REGLAS DE LECTURA Y ESCRITURA (RLS)
-- ─────────────────────────────────────────────────────────────────────────────
-- 3a. Toda tabla del sistema con RLS activo. Si alguna no lo tenía, se activa con
--     una regla abierta para usuarios autenticados: así nadie pierde el acceso que
--     ya tenía y las reglas restrictivas de abajo pueden actuar.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'perfiles', 'clientes', 'contactos_cliente', 'facturas', 'factura_items', 'pagos',
    'cotizaciones', 'cotizacion_items', 'productos', 'embarques', 'recepciones', 'recepcion_items',
    'traspasos', 'traspaso_items', 'movimientos_caja', 'bitacora', 'configuracion', 'contadores',
    'sistemas', 'usuarios', 'inventario'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r' AND NOT c.relrowsecurity) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'arj_acceso_previo') THEN
        EXECUTE format('CREATE POLICY arj_acceso_previo ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
      END IF;
      RAISE NOTICE 'RLS activado en % (con acceso abierto para autenticados, como estaba)', t;
    END IF;
  END LOOP;
END $$;

-- 3b. Una distribuidora no escribe directo en NINGUNA tabla. Sus ventas, abonos,
--     cotizaciones y clientes pasan por las funciones del servidor (SECURITY
--     DEFINER), que no dependen de estas reglas. Cubre producción aunque allí no
--     se haya aplicado el 07 (el monolito sigue escribiendo directo).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'perfiles', 'clientes', 'contactos_cliente', 'facturas', 'factura_items', 'pagos',
    'cotizaciones', 'cotizacion_items', 'productos', 'embarques', 'recepciones', 'recepcion_items',
    'traspasos', 'traspaso_items', 'movimientos_caja', 'bitacora', 'configuracion', 'contadores',
    'sistemas', 'usuarios', 'inventario'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS arj_dist_no_inserta ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS arj_dist_no_modifica ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS arj_dist_no_borra ON %I', t);
      EXECUTE format('CREATE POLICY arj_dist_no_inserta ON %I AS RESTRICTIVE FOR INSERT TO authenticated '
                     'WITH CHECK (NOT (SELECT arj_es_distribuidora()))', t);
      EXECUTE format('CREATE POLICY arj_dist_no_modifica ON %I AS RESTRICTIVE FOR UPDATE TO authenticated '
                     'USING (NOT (SELECT arj_es_distribuidora())) WITH CHECK (NOT (SELECT arj_es_distribuidora()))', t);
      EXECUTE format('CREATE POLICY arj_dist_no_borra ON %I AS RESTRICTIVE FOR DELETE TO authenticated '
                     'USING (NOT (SELECT arj_es_distribuidora()))', t);
    END IF;
  END LOOP;
END $$;

-- 3c. Lectura. Las reglas RESTRICTIVE se suman a las que ya hubiera: una fila se
--     ve solo si la deja ver alguna regla normal Y todas las restrictivas.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- Cartera propia: gerente todo; distribuidora lo suyo; ARJ lo de ARJ (NULL)
    ('clientes',     '(SELECT arj_es_gerente()) OR propietario IS NOT DISTINCT FROM (SELECT arj_propietario_actual())'),
    ('facturas',     '(SELECT arj_es_gerente()) OR propietario IS NOT DISTINCT FROM (SELECT arj_propietario_actual())'),
    ('cotizaciones', '(SELECT arj_es_gerente()) OR propietario IS NOT DISTINCT FROM (SELECT arj_propietario_actual())'),
    -- Lo que cuelga de ellas sigue a su cabecera (la subconsulta ya pasa por la regla de la cabecera)
    ('contactos_cliente', 'cliente_id IN (SELECT id FROM clientes)'),
    ('factura_items',     'factura_id IN (SELECT id FROM facturas)'),
    ('cotizacion_items',  'cotizacion_id IN (SELECT id FROM cotizaciones)'),
    ('pagos',             'factura_id IN (SELECT id FROM facturas) OR (factura_id IS NULL AND NOT (SELECT arj_es_distribuidora()))'),
    -- Inventario compartido: solo los importados
    ('productos', 'NOT (SELECT arj_es_distribuidora()) OR arj_origen_producto(origen, factor_landed) = ''importado'''),
    -- Su propio perfil, nada más
    ('perfiles',  'NOT (SELECT arj_es_distribuidora()) OR id = auth.uid()'),
    -- Lo interno de ARJ (costos de embarques, caja, conteos, bitácora...)
    ('embarques',        'NOT (SELECT arj_es_distribuidora())'),
    ('recepciones',      'NOT (SELECT arj_es_distribuidora())'),
    ('recepcion_items',  'NOT (SELECT arj_es_distribuidora())'),
    ('traspasos',        'NOT (SELECT arj_es_distribuidora())'),
    ('traspaso_items',   'NOT (SELECT arj_es_distribuidora())'),
    ('movimientos_caja', 'NOT (SELECT arj_es_distribuidora())'),
    ('bitacora',         'NOT (SELECT arj_es_distribuidora())'),
    ('contadores',       'NOT (SELECT arj_es_distribuidora())'),
    ('usuarios',         'NOT (SELECT arj_es_distribuidora())'),
    ('inventario',       'NOT (SELECT arj_es_distribuidora())')
  ) AS v(tabla, regla)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = r.tabla) THEN
      EXECUTE format('DROP POLICY IF EXISTS arj_lectura_por_dueno ON %I', r.tabla);
      EXECUTE format('CREATE POLICY arj_lectura_por_dueno ON %I AS RESTRICTIVE FOR SELECT TO authenticated USING (%s)',
                     r.tabla, r.regla);
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DUEÑO DE CADA FILA Y CLIENTE PROPIO (disparadores)
--    Corren dentro de las funciones del servidor y también ante escrituras
--    directas (monolito). Sin usuario (SQL Editor, tareas internas) no controlan.
--    Un error que empieza por "ARJ-ACCESO:" es un intento bloqueado (sección 6).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION arj_control_propietario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yo UUID;
  v_dueno_cliente UUID;
BEGIN
  IF auth.uid() IS NULL OR arj_es_gerente() THEN RETURN NEW; END IF;
  v_yo := arj_propietario_actual();

  IF TG_OP = 'INSERT' THEN
    NEW.propietario := v_yo;              -- el dueño lo decide el servidor, no el navegador
  ELSE
    IF OLD.propietario IS DISTINCT FROM v_yo THEN
      RAISE EXCEPTION 'ARJ-ACCESO: intentó modificar % id % que no es suyo', TG_TABLE_NAME, OLD.id;
    END IF;
    NEW.propietario := OLD.propietario;
  END IF;

  IF TG_TABLE_NAME IN ('facturas', 'cotizaciones') THEN
    IF v_yo IS NOT NULL AND arj_empresa_norm(NEW.empresa) <> 'distribuidora' THEN
      RAISE EXCEPTION 'ARJ-ACCESO: intentó operar en Venta Directa (% %)', TG_TABLE_NAME, COALESCE(NEW.numero, '');
    END IF;
    IF NEW.cliente_id IS NOT NULL THEN
      SELECT propietario INTO v_dueno_cliente FROM clientes WHERE id = NEW.cliente_id;
      IF FOUND AND v_dueno_cliente IS DISTINCT FROM v_yo THEN
        RAISE EXCEPTION 'ARJ-ACCESO: intentó usar el cliente id % que no es de su cartera', NEW.cliente_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- El nombre empieza por "a_" para correr ANTES que trg_clientes_rif_unico
-- (los BEFORE de una tabla corren en orden alfabético): el RIF se compara dentro
-- de la cartera del dueño, que tiene que estar puesto.
DROP TRIGGER IF EXISTS trg_a_clientes_propietario ON clientes;
CREATE TRIGGER trg_a_clientes_propietario BEFORE INSERT OR UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION arj_control_propietario();
DROP TRIGGER IF EXISTS trg_a_facturas_propietario ON facturas;
CREATE TRIGGER trg_a_facturas_propietario BEFORE INSERT OR UPDATE ON facturas
  FOR EACH ROW EXECUTE FUNCTION arj_control_propietario();
DROP TRIGGER IF EXISTS trg_a_cotizaciones_propietario ON cotizaciones;
CREATE TRIGGER trg_a_cotizaciones_propietario BEFORE INSERT OR UPDATE ON cotizaciones
  FOR EACH ROW EXECUTE FUNCTION arj_control_propietario();

-- Renglones: una distribuidora solo factura/cotiza productos importados
CREATE OR REPLACE FUNCTION arj_control_renglon()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prod productos;
BEGIN
  IF auth.uid() IS NULL OR NOT arj_es_distribuidora() THEN RETURN NEW; END IF;
  SELECT * INTO v_prod FROM productos WHERE id = NEW.producto_id;
  IF NOT FOUND OR arj_origen_producto(v_prod.origen, v_prod.factor_landed) <> 'importado' THEN
    RAISE EXCEPTION 'ARJ-ACCESO: intentó vender o cotizar un producto que no es importado (%)', COALESCE(NEW.cod_alt, NEW.producto_id::TEXT);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_factura_items_distribuidora ON factura_items;
CREATE TRIGGER trg_factura_items_distribuidora BEFORE INSERT ON factura_items
  FOR EACH ROW EXECUTE FUNCTION arj_control_renglon();
DROP TRIGGER IF EXISTS trg_cotizacion_items_distribuidora ON cotizacion_items;
CREATE TRIGGER trg_cotizacion_items_distribuidora BEFORE INSERT ON cotizacion_items
  FOR EACH ROW EXECUTE FUNCTION arj_control_renglon();

-- Pagos: solo sobre facturas propias
CREATE OR REPLACE FUNCTION arj_control_pago()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dueno UUID;
BEGIN
  IF auth.uid() IS NULL OR arj_es_gerente() THEN RETURN NEW; END IF;
  IF NEW.factura_id IS NULL THEN
    IF arj_es_distribuidora() THEN RAISE EXCEPTION 'ARJ-ACCESO: intentó registrar un pago sin factura'; END IF;
    RETURN NEW;
  END IF;
  SELECT propietario INTO v_dueno FROM facturas WHERE id = NEW.factura_id;
  IF FOUND AND v_dueno IS DISTINCT FROM arj_propietario_actual() THEN
    RAISE EXCEPTION 'ARJ-ACCESO: intentó registrar un pago en la factura id % que no es suya', NEW.factura_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pagos_propietario ON pagos;
CREATE TRIGGER trg_pagos_propietario BEFORE INSERT ON pagos
  FOR EACH ROW EXECUTE FUNCTION arj_control_pago();

REVOKE ALL ON FUNCTION arj_control_propietario() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION arj_control_renglon() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION arj_control_pago() FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RIF ÚNICO POR DUEÑO (reemplaza la regla del 10)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION arj_rif_unico()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_otro clientes;
BEGIN
  IF arj_rif_norm(NEW.rif) IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_otro FROM clientes
  WHERE arj_rif_norm(rif) = arj_rif_norm(NEW.rif) AND id <> COALESCE(NEW.id, -1)
    AND propietario IS NOT DISTINCT FROM NEW.propietario
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'ARJ: ya existe un cliente con el RIF % (%). Búscalo en Clientes en vez de registrarlo otra vez.',
      v_otro.rif, v_otro.nombre;
  END IF;
  RETURN NEW;
END $$;

DROP INDEX IF EXISTS clientes_rif_unico;
CREATE UNIQUE INDEX IF NOT EXISTS clientes_rif_unico_por_dueno
  ON clientes (COALESCE(propietario, '00000000-0000-0000-0000-000000000000'::UUID), arj_rif_norm(rif))
  WHERE arj_rif_norm(rif) IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ALERTAS EN LA BITÁCORA
--    Un RAISE deshace todo lo hecho dentro de la función, también una entrada de
--    bitácora. Por eso la alerta se escribe en el manejador de errores de cada
--    función del servidor, que corre DESPUÉS de deshacer y sí queda guardado.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION arj_respuesta_error(p_error TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v perfiles;
BEGIN
  IF p_error NOT LIKE 'ARJ-ACCESO:%' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', p_error);
  END IF;
  SELECT * INTO v FROM perfiles WHERE id = auth.uid();
  INSERT INTO bitacora (fecha, usuario, empresa, accion, descripcion, critico)
  VALUES (NOW(), COALESCE(v.nombre_display, 'Usuario desconocido'),
    CASE WHEN arj_empresa_norm(v.empresa) = 'directa' THEN 'directa' ELSE 'distribuidora' END,
    'seguridad', LEFT('Intento bloqueado: ' || TRIM(SUBSTRING(p_error FROM 12)), 2000), TRUE);
  RETURN jsonb_build_object('ok', FALSE, 'error', 'No tienes permiso para esa operación. El intento quedó registrado.');
END $$;

REVOKE ALL ON FUNCTION arj_respuesta_error(TEXT) FROM PUBLIC, anon, authenticated;

-- Cambia el manejador de errores estándar de las funciones del servidor
--   EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
-- por uno que además deja la alerta. Mismo resultado para cualquier otro error.
DO $$
DECLARE
  r RECORD;
  v_patron CONSTANT TEXT :=
    'EXCEPTION\s+WHEN\s+OTHERS\s+THEN\s+RETURN\s+jsonb_build_object\(''ok'',\s*FALSE,\s*''error'',\s*SQLERRM\);';
BEGIN
  FOR r IN
    SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosrc ~ v_patron
      AND p.proname NOT IN ('arj_respuesta_error', 'registrar_bitacora')
  LOOP
    EXECUTE regexp_replace(pg_get_functiondef(r.oid), v_patron,
      'EXCEPTION WHEN OTHERS THEN' || E'\n' || '  RETURN arj_respuesta_error(SQLERRM);', 'g');
    RAISE NOTICE 'Alertas de acceso activas en %', r.proname;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
-- Reglas creadas:
-- SELECT tablename, policyname, permissive, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND policyname LIKE 'arj_%' ORDER BY 1, 2;
--
-- Funciones que ya dejan alerta (debe listar emitir_factura_atomica, registrar_abono_atomico, ...):
-- SELECT proname FROM pg_proc WHERE prosrc LIKE '%arj_respuesta_error(SQLERRM)%' ORDER BY 1;
--
-- Prueba con un usuario distribuidora (en la consola del navegador, con su sesión):
--   await supabase.from('facturas').select('numero')            → solo las suyas
--   await supabase.from('productos').select('cod_alt, origen')  → solo importados
--   await supabase.rpc('registrar_abono_atomico', { p_factura_id: <id de una factura de ARJ>, ... })
--                                                               → "No tienes permiso..." y alerta en Bitácora
