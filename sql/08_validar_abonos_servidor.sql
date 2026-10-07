-- ==============================================================================
-- SISTEMA ARJ · 08 — VALIDAR ABONOS Y COBRO EN EFECTIVO EN EL SERVIDOR (07-oct-2026)
--
-- Hallazgo 1: registrar_abono_atomico aceptaba p_acredita tal como lo mandaba el
--   navegador: un vendedor podía entregar $10 y acreditar $100 BCV.
--   Ahora el servidor calcula cuánto puede acreditar lo entregado con la misma
--   regla de src/services/cobros.js (calcularAbono):
--     · Divisas ($ efectivo, Zelle): monto_usd × tasa_par / tasa_bcv. Si alcanza el
--       objetivo en efectivo (cobrar_verde prorrateado o, si no hay, el equivalente
--       del día del saldo) con $1 de margen, salda.
--     · Bs: monto_bs / (factor_bs × tasa_bcv). Si cubre el "Cobrar HOY" con Bs 1
--       de margen, salda.
--   Tolerancia de 2 céntimos (la app calcula igual y solo redondea al céntimo).
--   El gerente puede acreditar por encima (descuento por divisas), como al emitir.
--   Los abonos también exigen las tasas confirmadas HOY, igual que la emisión.
--   `tasa_usada` la fija el servidor: BCV para divisas, paralelo para Bs.
--
-- Hallazgo 2 (emitir_factura_atomica, reemplaza la versión del 06):
--   2a. Un vendedor no puede registrar `descuento_manual` (antes solo se miraba
--       `descuento_manual_pct`).
--   2b. Un vendedor no puede pactar un cobro en efectivo (`cobrar_verde`) por debajo
--       del equivalente del día: si no, con el hallazgo 1 corregido, el hueco se
--       movería a emitir con cobrar_verde = 1 y "saldar" entregando $1.
--
-- Aplicar en desarrollo y en producción después del 06. Idempotente.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ABONOS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION registrar_abono_atomico(p_factura_id INT, p_acredita NUMERIC, p_pago JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perfil perfiles;
  v_cfg configuracion;
  v_f facturas;
  v_es_gerente BOOLEAN;
  v_metodo TEXT := COALESCE(p_pago->>'metodo', 'Efectivo USD');
  v_es_divisa BOOLEAN;
  v_usd NUMERIC := COALESCE(NULLIF(p_pago->>'monto_usd', '')::NUMERIC, 0);
  v_bs NUMERIC := COALESCE(NULLIF(p_pago->>'monto_bs', '')::NUMERIC, 0);
  v_saldo NUMERIC;
  v_factor NUMERIC;
  v_obj NUMERIC;
  v_max NUMERIC;
  v_nuevo NUMERIC;
  v_estado TEXT;
BEGIN
  SELECT * INTO v_f FROM facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: factura no encontrada'; END IF;
  v_perfil := arj_exigir_usuario(FALSE, v_f.empresa);
  v_es_gerente := v_perfil.rol = 'gerente';

  IF v_f.estado IN ('anulada', 'pagada') THEN
    RAISE EXCEPTION 'ARJ: la factura % está %', v_f.numero, v_f.estado;
  END IF;
  IF p_acredita IS NULL OR p_acredita <= 0 THEN
    RAISE EXCEPTION 'ARJ: monto de abono inválido';
  END IF;
  v_saldo := COALESCE(v_f.saldo_pendiente, 0);
  IF p_acredita > v_saldo + 0.01 THEN
    RAISE EXCEPTION 'ARJ: el abono (%) excede el saldo pendiente (%)', p_acredita, v_saldo;
  END IF;
  IF v_metodo ~* '(transferencia|pago m[oó]vil|punto de venta|zelle)'
     AND COALESCE(TRIM(p_pago->>'referencia'), '') = '' THEN
    RAISE EXCEPTION 'ARJ: la referencia es obligatoria para %', v_metodo;
  END IF;

  -- Tasas del día desde la BD (mismo criterio que la emisión)
  SELECT * INTO v_cfg FROM configuracion ORDER BY id LIMIT 1;
  IF COALESCE(v_cfg.tasa_bcv, 0) <= 0 OR COALESCE(v_cfg.tasa_par, 0) <= 0 THEN
    RAISE EXCEPTION 'ARJ: faltan las tasas de cambio';
  END IF;
  IF v_cfg.tasas_actualizadas IS NULL OR
     (v_cfg.tasas_actualizadas AT TIME ZONE 'America/Caracas')::DATE <> (NOW() AT TIME ZONE 'America/Caracas')::DATE THEN
    RAISE EXCEPTION 'ARJ: las tasas no se han confirmado hoy';
  END IF;

  -- Máximo que puede acreditar lo entregado (misma regla que cobros.js)
  v_es_divisa := v_metodo ~* '(USD|Zelle)';
  IF v_es_divisa THEN
    IF v_usd <= 0 THEN RAISE EXCEPTION 'ARJ: el pago en divisas no trae monto en $'; END IF;
    v_max := v_usd * v_cfg.tasa_par / v_cfg.tasa_bcv;
    -- Objetivo en efectivo: el cobro acordado al emitir (prorrateado) o el equivalente del día
    IF COALESCE(v_f.cobrar_verde, 0) > 0 AND COALESCE(v_f.subtotal_usd, 0) > 0 THEN
      v_obj := v_f.cobrar_verde * v_saldo / v_f.subtotal_usd;
    ELSE
      v_obj := v_saldo * v_cfg.tasa_bcv / v_cfg.tasa_par;
    END IF;
    IF v_usd >= v_obj - 1 THEN v_max := v_saldo; END IF;
  ELSE
    IF v_bs <= 0 THEN RAISE EXCEPTION 'ARJ: el pago en bolívares no trae monto en Bs'; END IF;
    v_factor := COALESCE(NULLIF(v_f.factor_bs, 0), 1);
    v_max := v_bs / (v_factor * v_cfg.tasa_bcv);
    IF v_bs >= v_saldo * v_factor * v_cfg.tasa_bcv - 1 THEN v_max := v_saldo; END IF;
  END IF;
  v_max := LEAST(v_max, v_saldo);

  IF NOT v_es_gerente AND p_acredita > v_max + 0.02 THEN
    RAISE EXCEPTION 'ARJ: lo entregado solo acredita $% BCV (intentaste $%). Solo el gerente puede acreditar más.',
      ROUND(v_max, 2), ROUND(p_acredita, 2);
  END IF;

  v_nuevo := GREATEST(0, ROUND(v_saldo - p_acredita, 2));
  v_estado := CASE WHEN v_nuevo <= 0.01 THEN 'pagada' ELSE 'parcial' END;

  INSERT INTO pagos (factura_id, fecha, monto_usd, monto_bs, tasa_usada, metodo, referencia, registrado_por, notas)
  VALUES (v_f.id, NOW(), v_usd, v_bs,
    CASE WHEN v_es_divisa THEN v_cfg.tasa_bcv ELSE v_cfg.tasa_par END,
    v_metodo, COALESCE(p_pago->>'referencia', ''), v_perfil.nombre_display,
    'Acredita $' || ROUND(p_acredita, 2) || ' BCV');

  UPDATE facturas SET saldo_pendiente = v_nuevo, estado = v_estado WHERE id = v_f.id;

  IF v_f.cliente_id IS NOT NULL THEN
    IF v_f.empresa = 'directa' THEN
      UPDATE clientes SET saldo_vd = GREATEST(0, COALESCE(saldo_vd, 0) - p_acredita) WHERE id = v_f.cliente_id;
    ELSE
      UPDATE clientes SET saldo_dist = GREATEST(0, COALESCE(saldo_dist, 0) - p_acredita) WHERE id = v_f.cliente_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'saldo_pendiente', v_nuevo, 'estado', v_estado);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. EMISIÓN (versión del 06 + hallazgo 2a y 2b)
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



-- ─── Permisos (CREATE OR REPLACE los conserva; se reafirman) ─────────────────
REVOKE ALL ON FUNCTION registrar_abono_atomico(INT, NUMERIC, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_abono_atomico(INT, NUMERIC, JSONB) TO authenticated;
REVOKE ALL ON FUNCTION emitir_factura_atomica(JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION emitir_factura_atomica(JSONB, JSONB, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
