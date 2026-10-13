-- ==============================================================================
-- SISTEMA ARJ · 10 — CLIENTES ÚNICOS POR RIF, CRÉDITO PAGADO = CONTADO Y TASAS
--                   CON TODOS SUS DECIMALES (12-oct-2026)
--
-- Tres reportes de JJ:
--
--   1. CLIENTES DUPLICADOS. Había el mismo cliente registrado dos veces con el
--      mismo RIF (JAIRO PEREZ, LUIS VASQUEZ, SAMUEL DURAN, FRANCOIS BRUN en el
--      respaldo del 6-oct). Este script:
--        · fusiona cada grupo en UN cliente: sus facturas, cotizaciones y
--          contactos pasan al que se queda, se suman los saldos y se borra el
--          duplicado. Las facturas NO cambian su nombre/RIF impreso (snapshot).
--        · impide en el servidor registrar o editar un cliente con un RIF que ya
--          existe. Cubre la app Vue y el monolito (es un trigger de la tabla).
--      El RIF se compara normalizado: "J-31010573-1" = "J310105731", y un
--      número sin letra se toma como V ("26035219" = "V-26035219").
--      Los RIF genéricos (vacío, "V-00000000-0", "000000") no cuentan.
--
--   2. "PAGADA Y CRÉDITO A LA VEZ" (factura de VENSUAGRO). Una venta a crédito
--      que se paga completa al emitirla queda guardada como CONTADO.
--
--   3. TASA CON DOS DECIMALES. El BCV publica la tasa con varios decimales
--      (p. ej. 876,7976). La base la guardaba redondeada a 876,80, así que
--      25 $ daban Bs. 21.920,00 en vez de Bs. 21.919,94 (lo que dice la app
--      "Al Cambio"). Las columnas de tasas pasan a guardar todos los decimales.
--
-- Aplicar en desarrollo y en producción después del 09. Idempotente.
-- Antes de aplicar, se puede ver qué clientes se van a fusionar con la
-- consulta de VISTA PREVIA de la sección 1.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CLIENTES ÚNICOS POR RIF
-- ─────────────────────────────────────────────────────────────────────────────

-- RIF normalizado. NULL = genérico o vacío (no cuenta para duplicados).
CREATE OR REPLACE FUNCTION arj_rif_norm(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN n = '' OR n !~ '[0-9]' OR n ~ '^[VJEGP]?0+$' THEN NULL
    WHEN n ~ '^[0-9]' THEN 'V' || n
    ELSE n
  END
  FROM (SELECT regexp_replace(UPPER(COALESCE(p, '')), '[^A-Z0-9]', '', 'g') AS n) x
$$;

-- VISTA PREVIA (ejecutar sola para revisar antes de aplicar):
-- SELECT arj_rif_norm(rif) AS rif, id, nombre, rif AS rif_escrito, activo,
--   (SELECT COUNT(*) FROM facturas f WHERE f.cliente_id = c.id) AS facturas
-- FROM clientes c
-- WHERE arj_rif_norm(rif) IN (SELECT arj_rif_norm(rif) FROM clientes
--                             WHERE arj_rif_norm(rif) IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1)
-- ORDER BY 1, facturas DESC, activo DESC, id;

-- Fusiona el cliente p_sale dentro de p_queda y borra p_sale.
-- Pasa TODO lo que apunta al cliente (cualquier columna cliente_id), suma los
-- saldos y completa los datos vacíos del que se queda. Solo para el SQL Editor.
CREATE OR REPLACE FUNCTION arj_fusionar_clientes(p_queda INT, p_sale INT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_q clientes;
  v_s clientes;
  v_t RECORD;
  v_n INT;
  v_det TEXT := '';
BEGIN
  IF p_queda = p_sale THEN RAISE EXCEPTION 'ARJ: es el mismo cliente'; END IF;
  SELECT * INTO v_q FROM clientes WHERE id = p_queda FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: no existe el cliente %', p_queda; END IF;
  SELECT * INTO v_s FROM clientes WHERE id = p_sale FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: no existe el cliente %', p_sale; END IF;

  -- Contactos: si el que se queda ya tiene principal, los que llegan no lo son;
  -- y no se duplica un contacto que ya está (mismo nombre y teléfono)
  IF to_regclass('public.contactos_cliente') IS NOT NULL THEN
    DELETE FROM contactos_cliente s
    WHERE s.cliente_id = p_sale AND EXISTS (
      SELECT 1 FROM contactos_cliente q WHERE q.cliente_id = p_queda
        AND UPPER(TRIM(q.nombre)) = UPPER(TRIM(s.nombre)) AND COALESCE(q.telefono, '') = COALESCE(s.telefono, ''));
    IF EXISTS (SELECT 1 FROM contactos_cliente WHERE cliente_id = p_queda AND es_principal) THEN
      UPDATE contactos_cliente SET es_principal = FALSE WHERE cliente_id = p_sale;
    END IF;
  END IF;

  -- Todo lo que apunta al cliente: facturas, cotizaciones, contactos, ...
  FOR v_t IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'cliente_id' AND table_name <> 'clientes'
  LOOP
    EXECUTE format('UPDATE %I SET cliente_id = $1 WHERE cliente_id = $2', v_t.table_name) USING p_queda, p_sale;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_det := v_det || ' ' || v_t.table_name || '=' || v_n; END IF;
  END LOOP;

  UPDATE clientes SET
    saldo_vd = COALESCE(saldo_vd, 0) + COALESCE(v_s.saldo_vd, 0),
    saldo_dist = COALESCE(saldo_dist, 0) + COALESCE(v_s.saldo_dist, 0),
    rif = CASE WHEN arj_rif_norm(rif) IS NULL THEN v_s.rif ELSE rif END,
    telefono = COALESCE(NULLIF(TRIM(telefono), ''), v_s.telefono),
    direccion = COALESCE(NULLIF(TRIM(direccion), ''), v_s.direccion),
    notas = COALESCE(NULLIF(TRIM(notas), ''), v_s.notas),
    origen = COALESCE(origen, v_s.origen),
    origen_detalle = COALESCE(NULLIF(TRIM(origen_detalle), ''), v_s.origen_detalle),
    activo = (activo OR v_s.activo)
  WHERE id = p_queda;

  DELETE FROM clientes WHERE id = p_sale;

  INSERT INTO bitacora (fecha, usuario, empresa, accion, descripcion, critico)
  VALUES (NOW(), 'Sistema (script 10)', 'ambas', 'cliente',
    'Fusionó el cliente duplicado #' || p_sale || ' ' || v_s.nombre || ' (' || COALESCE(v_s.rif, '') || ') en #'
      || p_queda || ' ' || v_q.nombre || '. Movido:' || COALESCE(NULLIF(v_det, ''), ' nada'), TRUE);

  RETURN '#' || p_sale || ' → #' || p_queda || ':' || COALESCE(NULLIF(v_det, ''), ' nada');
END $$;
REVOKE ALL ON FUNCTION arj_fusionar_clientes(INT, INT) FROM PUBLIC, anon, authenticated;

-- Fusión automática de los duplicados por RIF que ya existen.
-- Se queda el que tiene más facturas; si empatan, el activo; si no, el más antiguo.
DO $$
DECLARE
  v_g RECORD;
  v_ids INT[];
  i INT;
BEGIN
  FOR v_g IN
    SELECT arj_rif_norm(rif) AS rn FROM clientes
    WHERE arj_rif_norm(rif) IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1
  LOOP
    SELECT array_agg(c.id ORDER BY (SELECT COUNT(*) FROM facturas f WHERE f.cliente_id = c.id) DESC, c.activo DESC, c.id)
      INTO v_ids FROM clientes c WHERE arj_rif_norm(c.rif) = v_g.rn;
    FOR i IN 2 .. array_length(v_ids, 1) LOOP
      RAISE NOTICE '%', arj_fusionar_clientes(v_ids[1], v_ids[i]);
    END LOOP;
  END LOOP;
END $$;

-- Desde ahora no se puede repetir un RIF (ni desde la app ni desde el monolito)
CREATE OR REPLACE FUNCTION arj_rif_unico()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_otro clientes;
BEGIN
  IF arj_rif_norm(NEW.rif) IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_otro FROM clientes
  WHERE arj_rif_norm(rif) = arj_rif_norm(NEW.rif) AND id <> COALESCE(NEW.id, -1) LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'ARJ: ya existe un cliente con el RIF % (%). Búscalo en Clientes en vez de registrarlo otra vez.',
      v_otro.rif, v_otro.nombre;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clientes_rif_unico ON clientes;
CREATE TRIGGER trg_clientes_rif_unico BEFORE INSERT OR UPDATE OF rif ON clientes
  FOR EACH ROW EXECUTE FUNCTION arj_rif_unico();

-- Respaldo a nivel de índice (dos cajas registrando el mismo RIF al mismo tiempo)
CREATE UNIQUE INDEX IF NOT EXISTS clientes_rif_unico ON clientes (arj_rif_norm(rif))
  WHERE arj_rif_norm(rif) IS NOT NULL;

-- Clientes con el mismo NOMBRE y sin RIF no se fusionan solos (podrían ser dos
-- personas distintas). Para revisarlos:
-- SELECT UPPER(TRIM(nombre)) AS nombre, array_agg(id ORDER BY id) AS ids, array_agg(rif ORDER BY id) AS rifs
-- FROM clientes GROUP BY 1 HAVING COUNT(*) > 1;
-- y si son el mismo: SELECT arj_fusionar_clientes(<id que se queda>, <id que sale>);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. EMISIÓN: crédito pagado completo al emitir = contado
--    (versión del 08 + el bloque marcado "sql/10")
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION emitir_factura_atomica(p_factura JSONB, p_items JSONB, p_pagos JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp TEXT := arj_empresa_norm(p_factura->>'empresa');
  v_perfil perfiles;
  v_cfg configuracion;
  v_es_gerente BOOLEAN;
  v_numero TEXT;
  v_id INT;
  v_item JSONB;
  v_pago JSONB;
  v_prod productos;
  v_cant INT;
  v_precio NUMERIC;
  v_piso NUMERIC;
  v_cotizado NUMERIC;
  v_tier TEXT;
  v_subtotal NUMERIC := 0;
  v_cubierto NUMERIC := 0;
  v_tipo_pago TEXT := COALESCE(p_factura->>'tipo_pago', 'contado');
  v_dias INT := COALESCE(NULLIF(p_factura->>'dias_credito', '')::INT, 0);
  v_saldo NUMERIC := COALESCE(NULLIF(p_factura->>'saldo_pendiente', '')::NUMERIC, 0);
  v_cliente INT := NULLIF(p_factura->>'cliente_id', '')::INT;
  v_cot cotizaciones;
  v_cot_id INT := NULLIF(p_factura->>'cotizacion_id', '')::INT;
  v_fila facturas;
BEGIN
  IF v_emp NOT IN ('directa', 'distribuidora') THEN RAISE EXCEPTION 'ARJ: empresa inválida'; END IF;
  v_perfil := arj_exigir_usuario(FALSE, v_emp);
  v_es_gerente := v_perfil.rol = 'gerente';

  IF NOT v_es_gerente AND (
       COALESCE(NULLIF(p_factura->>'descuento_manual_pct', '')::NUMERIC, 0) > 0 OR
       COALESCE(NULLIF(p_factura->>'descuento_manual', '')::NUMERIC, 0) > 0) THEN
    RAISE EXCEPTION 'ARJ: solo el gerente puede aplicar descuentos manuales';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'ARJ: la factura no tiene renglones'; END IF;
  IF v_tipo_pago NOT IN ('contado', 'credito') THEN RAISE EXCEPTION 'ARJ: tipo de pago inválido'; END IF;
  IF v_cliente IS NULL OR NOT EXISTS (SELECT 1 FROM clientes WHERE id = v_cliente) THEN
    RAISE EXCEPTION 'ARJ: la factura necesita un cliente registrado';
  END IF;

  -- Las tasas salen de la BD, no del navegador, y deben estar confirmadas HOY (hora de Venezuela)
  SELECT * INTO v_cfg FROM configuracion ORDER BY id LIMIT 1;
  IF COALESCE(v_cfg.tasa_bcv, 0) <= 0 OR COALESCE(v_cfg.tasa_par, 0) <= 0 THEN
    RAISE EXCEPTION 'ARJ: faltan las tasas de cambio';
  END IF;
  IF v_cfg.tasas_actualizadas IS NULL OR
     (v_cfg.tasas_actualizadas AT TIME ZONE 'America/Caracas')::DATE <> (NOW() AT TIME ZONE 'America/Caracas')::DATE THEN
    RAISE EXCEPTION 'ARJ: las tasas no se han confirmado hoy';
  END IF;
  IF ABS(COALESCE((p_factura->>'tasa_bcv')::NUMERIC, 0) - v_cfg.tasa_bcv) > 0.0001 OR
     ABS(COALESCE((p_factura->>'tasa_par')::NUMERIC, 0) - v_cfg.tasa_par) > 0.0001 THEN
    RAISE EXCEPTION 'ARJ: las tasas cambiaron mientras armabas la factura. Recarga la página y vuelve a intentar.';
  END IF;

  -- Cotización de origen: debe seguir activa y ser de esta empresa (A-10)
  IF v_cot_id IS NOT NULL THEN
    SELECT * INTO v_cot FROM cotizaciones WHERE id = v_cot_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: la cotización de origen no existe'; END IF;
    IF v_cot.estado <> 'activa' THEN RAISE EXCEPTION 'ARJ: la cotización % ya está %', v_cot.numero, v_cot.estado; END IF;
    IF arj_empresa_norm(v_cot.empresa) <> v_emp THEN RAISE EXCEPTION 'ARJ: la cotización es de otra empresa'; END IF;
  END IF;

  v_tier := arj_tier_cliente(v_cliente, v_emp);
  v_numero := arj_siguiente_correlativo(CASE WHEN v_emp = 'directa' THEN 'factura_vd' ELSE 'factura_dist' END);

  INSERT INTO facturas (
    numero, empresa, cliente_id, cliente_nombre, vendedor, fecha,
    subtotal_usd, saldo_pendiente, estado, tipo_pago, dias_credito, fecha_vence,
    tasa_par, tasa_bcv, factor_bs, descuento_manual, motivo_descuento, pidio_fiscal, cobrar_verde,
    cliente_nombre_snap, cliente_rif_snap, cliente_tel_snap, cliente_dir_snap
  ) VALUES (
    v_numero, v_emp, v_cliente, p_factura->>'cliente_nombre', v_perfil.nombre_display, NOW(),
    0, 0, 'pendiente', v_tipo_pago, CASE WHEN v_tipo_pago = 'credito' THEN v_dias ELSE NULL END,
    CASE WHEN v_tipo_pago = 'credito' THEN NOW() + make_interval(days => v_dias) ELSE NULL END,
    v_cfg.tasa_par, v_cfg.tasa_bcv,
    COALESCE(NULLIF(p_factura->>'factor_bs', '')::NUMERIC, 1.00),
    COALESCE(NULLIF(p_factura->>'descuento_manual', '')::NUMERIC, 0),
    COALESCE(p_factura->>'motivo_descuento', ''),
    COALESCE((p_factura->>'pidio_fiscal')::BOOLEAN, FALSE),
    NULLIF(p_factura->>'cobrar_verde', '')::NUMERIC,
    p_factura->>'cliente_nombre_snap', p_factura->>'cliente_rif_snap',
    p_factura->>'cliente_tel_snap', p_factura->>'cliente_dir_snap'
  ) RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cant := COALESCE((v_item->>'cantidad')::INT, 0);
    v_precio := ROUND(COALESCE(NULLIF(v_item->>'precio_unitario', '')::NUMERIC, 0), 2);
    IF v_cant <= 0 THEN RAISE EXCEPTION 'ARJ: cantidad inválida en %', COALESCE(v_item->>'cod_alt', '?'); END IF;

    SELECT * INTO v_prod FROM productos WHERE id = NULLIF(v_item->>'producto_id', '')::INT FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: el producto % no existe', COALESCE(v_item->>'cod_alt', v_item->>'producto_id'); END IF;
    IF COALESCE(v_prod.fob, 0) <= 0 THEN RAISE EXCEPTION 'ARJ: % no tiene costo FOB cargado', v_prod.cod_alt; END IF;
    IF v_precio <= 0 THEN RAISE EXCEPTION 'ARJ: precio inválido en %', v_prod.cod_alt; END IF;

    -- Piso de precio para vendedores: el de lista del nivel del cliente, o el cotizado
    IF NOT v_es_gerente THEN
      v_piso := arj_precio_lista(v_prod.fob, v_prod.precio_manual, v_tier);
      IF v_cot_id IS NOT NULL THEN
        SELECT MIN(precio_unitario) INTO v_cotizado FROM cotizacion_items
        WHERE cotizacion_id = v_cot_id AND producto_id = v_prod.id;
        IF v_cotizado IS NOT NULL THEN v_piso := LEAST(v_piso, v_cotizado); END IF;
      END IF;
      IF v_precio < v_piso - 0.01 THEN
        RAISE EXCEPTION 'ARJ: % no se puede vender a % (precio mínimo %). Solo el gerente puede bajar precios.',
          v_prod.cod_alt, v_precio, v_piso;
      END IF;
    END IF;

    INSERT INTO factura_items (factura_id, producto_id, cod_alt, descripcion, cantidad,
      fob_unitario, precio_unitario, total_linea, tier, factor_landed, origen)
    VALUES (v_id, v_prod.id, v_prod.cod_alt, v_prod.descripcion, v_cant,
      v_prod.fob, v_precio, ROUND(v_cant * v_precio, 2), v_tier,
      COALESCE(NULLIF(v_prod.factor_landed, 0), NULLIF(v_item->>'factor_landed', '')::NUMERIC),
      CASE WHEN LOWER(COALESCE(v_prod.origen, '')) IN ('local', 'importado') THEN LOWER(v_prod.origen)
           WHEN v_prod.factor_landed BETWEEN 0.0001 AND 1.001 THEN 'local' ELSE 'importado' END);

    v_subtotal := v_subtotal + ROUND(v_cant * v_precio, 2);

    -- Stock: puede quedar negativo (préstamo inter-empresa, igual que el monolito)
    IF v_emp = 'directa' THEN
      UPDATE productos SET stock_vd = COALESCE(stock_vd, 0) - v_cant WHERE id = v_prod.id;
    ELSE
      UPDATE productos SET stock_dist = COALESCE(stock_dist, 0) - v_cant WHERE id = v_prod.id;
    END IF;
  END LOOP;

  IF ABS(v_subtotal - COALESCE(NULLIF(p_factura->>'subtotal_usd', '')::NUMERIC, 0)) > 0.05 THEN
    RAISE EXCEPTION 'ARJ: el total no cuadra (servidor % / pantalla %). Recarga y vuelve a intentar.',
      v_subtotal, p_factura->>'subtotal_usd';
  END IF;

  -- 2b: un vendedor no pacta un cobro en efectivo menor al equivalente del día
  IF NOT v_es_gerente AND COALESCE(NULLIF(p_factura->>'cobrar_verde', '')::NUMERIC, 0) > 0
     AND (p_factura->>'cobrar_verde')::NUMERIC < v_subtotal * v_cfg.tasa_bcv / v_cfg.tasa_par - 1 THEN
    RAISE EXCEPTION 'ARJ: el cobro en efectivo (%) es menor que el equivalente del día (%). Solo el gerente puede bajarlo.',
      p_factura->>'cobrar_verde', ROUND(v_subtotal * v_cfg.tasa_bcv / v_cfg.tasa_par, 2);
  END IF;

  -- Pagos. Cada uno se valora en $BCV: Bs a tasa BCV; $ a la brecha neutra del día
  -- (lo máximo que puede valer un dólar en efectivo sin descuento extra del gerente).
  IF p_pagos IS NOT NULL THEN
    FOR v_pago IN SELECT * FROM jsonb_array_elements(p_pagos) LOOP
      INSERT INTO pagos (factura_id, fecha, monto_usd, monto_bs, tasa_usada, metodo, referencia, registrado_por)
      VALUES (v_id, NOW(),
        COALESCE(NULLIF(v_pago->>'monto_usd', '')::NUMERIC, 0),
        COALESCE(NULLIF(v_pago->>'monto_bs', '')::NUMERIC, 0),
        NULLIF(v_pago->>'tasa_usada', '')::NUMERIC,
        COALESCE(v_pago->>'metodo', 'Efectivo USD'),
        COALESCE(v_pago->>'referencia', ''),
        v_perfil.nombre_display);
      IF COALESCE(v_pago->>'metodo', '') ~* '(USD|Zelle)' THEN
        v_cubierto := v_cubierto + COALESCE(NULLIF(v_pago->>'monto_usd', '')::NUMERIC, 0) * v_cfg.tasa_par / v_cfg.tasa_bcv;
      ELSE
        v_cubierto := v_cubierto + COALESCE(NULLIF(v_pago->>'monto_bs', '')::NUMERIC, 0) / v_cfg.tasa_bcv;
      END IF;
    END LOOP;
  END IF;

  IF v_tipo_pago = 'contado' THEN
    v_saldo := 0;
    -- El gerente puede cobrar redondo o con descuento por divisas; el vendedor no
    IF NOT v_es_gerente AND v_cubierto < v_subtotal - 1 THEN
      RAISE EXCEPTION 'ARJ: los pagos no cubren el total (faltan $%)', ROUND(v_subtotal - v_cubierto, 2);
    END IF;
  ELSE
    IF v_saldo > v_subtotal + 0.01 THEN RAISE EXCEPTION 'ARJ: el saldo no puede superar el total'; END IF;
    IF NOT v_es_gerente AND v_saldo < v_subtotal - v_cubierto - 1 THEN
      RAISE EXCEPTION 'ARJ: el saldo a crédito (%) es menor que la deuda real (%)', v_saldo, ROUND(v_subtotal - v_cubierto, 2);
    END IF;
  END IF;

  -- sql/10: una venta a crédito que se paga completa al emitirla es una venta de
  -- contado. Si quedara 'crédito' + 'pagada' se lee como dos estados a la vez
  -- (reporte de JJ, factura de VENSUAGRO anulada el 11-oct-2026).
  IF v_tipo_pago = 'credito' AND v_saldo <= 0.01 THEN
    v_tipo_pago := 'contado';
    UPDATE facturas SET tipo_pago = 'contado', dias_credito = NULL, fecha_vence = NULL WHERE id = v_id;
  END IF;

  UPDATE facturas SET subtotal_usd = v_subtotal, saldo_pendiente = v_saldo,
    estado = CASE WHEN v_saldo <= 0.01 THEN 'pagada' WHEN v_saldo < v_subtotal - 0.01 THEN 'parcial' ELSE 'pendiente' END
  WHERE id = v_id;

  IF v_saldo > 0 THEN
    IF v_emp = 'directa' THEN
      UPDATE clientes SET saldo_vd = COALESCE(saldo_vd, 0) + v_saldo WHERE id = v_cliente;
    ELSE
      UPDATE clientes SET saldo_dist = COALESCE(saldo_dist, 0) + v_saldo WHERE id = v_cliente;
    END IF;
  END IF;

  IF v_cot_id IS NOT NULL THEN
    UPDATE cotizaciones SET estado = 'convertida', factura_id = v_id WHERE id = v_cot_id;
  END IF;

  SELECT * INTO v_fila FROM facturas WHERE id = v_id;
  RETURN jsonb_build_object('ok', TRUE, 'data', to_jsonb(v_fila));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

REVOKE ALL ON FUNCTION emitir_factura_atomica(JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION emitir_factura_atomica(JSONB, JSONB, JSONB) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TASAS CON TODOS SUS DECIMALES
--    NUMERIC sin escala guarda el número tal cual llega (876,7976 se queda así).
--    Ampliar la escala no altera ningún valor ya guardado.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v RECORD;
BEGIN
  FOR v IN
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'numeric' AND numeric_scale IS NOT NULL
      AND (table_name, column_name) IN (
        ('configuracion', 'tasa_bcv'), ('configuracion', 'tasa_par'),
        ('facturas', 'tasa_bcv'), ('facturas', 'tasa_par'),
        ('cotizaciones', 'tasa_bcv'), ('cotizaciones', 'tasa_par'),
        ('pagos', 'tasa_usada'),
        ('movimientos_caja', 'tasa_usada'), ('movimientos_caja', 'tasa_bcv_ref'))
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE NUMERIC', v.table_name, v.column_name);
      RAISE NOTICE 'Tasa con todos sus decimales: %.%', v.table_name, v.column_name;
    EXCEPTION WHEN OTHERS THEN
      -- p. ej. una vista que depende de la columna: se avisa y se sigue con las demás
      RAISE WARNING 'No se pudo ampliar %.%: %', v.table_name, v.column_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- Verificación:
-- SELECT table_name, column_name, numeric_scale FROM information_schema.columns
-- WHERE column_name IN ('tasa_bcv', 'tasa_par', 'tasa_usada', 'tasa_bcv_ref');   -- numeric_scale vacío
-- SELECT arj_rif_norm(rif), COUNT(*) FROM clientes GROUP BY 1 HAVING COUNT(*) > 1; -- 0 filas
