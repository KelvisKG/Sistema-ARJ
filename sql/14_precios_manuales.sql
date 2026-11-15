-- ==============================================================================
-- SISTEMA ARJ · 14 — PRECIOS MANUALES EN LAS FACTURAS (nov-2026)
--
-- Pedido de JJ: poder ver en Historial cuándo se cambió un precio a mano, cuánto
-- era el de lista y quién lo cambió. Hasta ahora la factura solo guardaba el
-- precio cobrado: el de lista y el cambio se perdían al emitir.
--
-- Cada renglón de factura guarda ahora:
--   · precio_lista: el precio de lista de ese momento, CALCULADO POR EL SERVIDOR
--     (arj_precio_lista con el FOB, el precio manual del producto y el nivel).
--   · ajuste_tipo: cómo se cambió el precio: 'bcv' (escrito en dólar BCV),
--     'dolar' (escrito en dólares en efectivo) o 'descuento' (descuento manual %).
--     NULL = no se tocó.
--   · ajuste_monto: lo que se escribió (en BCV, en $ o el %).
--   · ajustado_por: quién emitió la factura con ese cambio.
--
-- Solo cambia emitir_factura_atomica (versión del 10 + estas columnas). Las
-- validaciones de precio, tasas y pagos son las mismas. Las facturas ya
-- emitidas quedan sin estos datos.
--
-- Aplicar en desarrollo y en producción después del 13, ANTES de publicar la
-- app (la app ya manda los datos nuevos). Idempotente.
-- ==============================================================================

ALTER TABLE factura_items ADD COLUMN IF NOT EXISTS precio_lista NUMERIC;
ALTER TABLE factura_items ADD COLUMN IF NOT EXISTS ajuste_tipo TEXT;
ALTER TABLE factura_items ADD COLUMN IF NOT EXISTS ajuste_monto NUMERIC;
ALTER TABLE factura_items ADD COLUMN IF NOT EXISTS ajustado_por TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'factura_items_ajuste_tipo_valido') THEN
    ALTER TABLE factura_items ADD CONSTRAINT factura_items_ajuste_tipo_valido
      CHECK (ajuste_tipo IS NULL OR ajuste_tipo IN ('bcv', 'dolar', 'descuento'));
  END IF;
END $$;

-- La pestaña "Precios manuales" solo busca los renglones cambiados
CREATE INDEX IF NOT EXISTS factura_items_ajuste_idx ON factura_items (factura_id) WHERE ajuste_tipo IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- EMISIÓN: versión del 10 + precio de lista y cambio manual por renglón
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
  v_ajuste TEXT;
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

    -- sql/14: precio de lista del momento y cambio manual del precio (lo que se escribió y quién)
    v_ajuste := CASE WHEN v_item->>'ajuste_tipo' IN ('bcv', 'dolar', 'descuento') THEN v_item->>'ajuste_tipo' END;
    INSERT INTO factura_items (factura_id, producto_id, cod_alt, descripcion, cantidad,
      fob_unitario, precio_unitario, total_linea, tier, factor_landed, origen,
      precio_lista, ajuste_tipo, ajuste_monto, ajustado_por)
    VALUES (v_id, v_prod.id, v_prod.cod_alt, v_prod.descripcion, v_cant,
      v_prod.fob, v_precio, ROUND(v_cant * v_precio, 2), v_tier,
      COALESCE(NULLIF(v_prod.factor_landed, 0), NULLIF(v_item->>'factor_landed', '')::NUMERIC),
      CASE WHEN LOWER(COALESCE(v_prod.origen, '')) IN ('local', 'importado') THEN LOWER(v_prod.origen)
           WHEN v_prod.factor_landed BETWEEN 0.0001 AND 1.001 THEN 'local' ELSE 'importado' END,
      arj_precio_lista(v_prod.fob, v_prod.precio_manual, v_tier), v_ajuste,
      CASE WHEN v_ajuste IS NOT NULL THEN NULLIF(v_item->>'ajuste_monto', '')::NUMERIC END,
      CASE WHEN v_ajuste IS NOT NULL THEN v_perfil.nombre_display END);

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
  RETURN arj_respuesta_error(SQLERRM);
END $$;

REVOKE ALL ON FUNCTION emitir_factura_atomica(JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION emitir_factura_atomica(JSONB, JSONB, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verificación:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'factura_items' AND column_name IN ('precio_lista', 'ajuste_tipo', 'ajuste_monto', 'ajustado_por');  -- 4 filas
