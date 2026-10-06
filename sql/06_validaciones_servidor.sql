-- ==============================================================================
-- SISTEMA ARJ · 06 — VALIDACIONES EN EL SERVIDOR (revisión de código, oct-2026)
--
-- Corrige lo que la revisión del código nuevo encontró en las funciones del 02:
--   1. emitir_factura_atomica confiaba en precios, totales, tasas y pagos que
--      manda el navegador. Ahora recalcula el total, toma las tasas de
--      `configuracion`, exige tasas confirmadas HOY, impide que un vendedor
--      venda por debajo del precio de lista y que emita contado sin pagos o
--      crédito con una deuda menor a la real.
--   2. guardar_cotizacion: mismo piso de precio para vendedores.
--   3. guardar_producto ya no pisa el stock con el valor que había al abrir el
--      formulario (solo lo cambia si el gerente lo modificó y nadie lo movió).
--   4. aplicar_recepcion acepta ajustes relativos (`delta`) y no registra
--      renglones que cuadran como "sobra".
--   5. Nueva actualizar_cliente: solo el gerente asigna niveles T1/T2/T3.
--   6. Una cotización solo se convierte si sigue activa y es de la misma empresa.
--
-- Aplicar en desarrollo y en producción, después del 02 y el 04. Idempotente.
-- ==============================================================================

-- ─── Precio de lista (mismo cálculo que src/services/pricing.js) ─────────────
-- precio_manual manda; si no, FOB × margen por tramo, redondeado hacia arriba a
-- $0,50; luego el factor del nivel (T1 −5 %, T2 −10 %, T3 −20 %).
CREATE OR REPLACE FUNCTION arj_precio_lista(p_fob NUMERIC, p_precio_manual NUMERIC, p_tier TEXT)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT ROUND(
    (CASE WHEN COALESCE(p_precio_manual, 0) > 0 THEN p_precio_manual
          ELSE CEIL(COALESCE(p_fob, 0) *
                    (CASE WHEN p_fob < 2 THEN 5 WHEN p_fob < 5 THEN 4 WHEN p_fob < 10 THEN 3 ELSE 2.5 END) * 2) / 2
     END) *
    (CASE p_tier WHEN 'T1' THEN 0.95 WHEN 'T2' THEN 0.90 WHEN 'T3' THEN 0.80 ELSE 1.0 END), 2)
$$;

-- Nivel de precio que corresponde a un cliente en una empresa
CREATE OR REPLACE FUNCTION arj_tier_cliente(p_cliente INT, p_empresa TEXT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN arj_empresa_norm(p_empresa) = 'directa' THEN 'Publico'
              ELSE COALESCE((SELECT nivel FROM clientes WHERE id = p_cliente), 'Publico') END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EMITIR FACTURA con validación de precios, tasas y pagos
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

  IF COALESCE(NULLIF(p_factura->>'descuento_manual_pct', '')::NUMERIC, 0) > 0 AND NOT v_es_gerente THEN
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. COTIZACIONES con piso de precio para vendedores
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION guardar_cotizacion(p_cot JSONB, p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp TEXT := arj_empresa_norm(p_cot->>'empresa');
  v_perfil perfiles;
  v_numero TEXT;
  v_id INT;
  v_item JSONB;
  v_prod productos;
  v_tier TEXT;
  v_precio NUMERIC;
  v_cant INT;
  v_total NUMERIC := 0;
  v_cliente INT := NULLIF(p_cot->>'cliente_id', '')::INT;
BEGIN
  IF v_emp NOT IN ('directa', 'distribuidora') THEN RAISE EXCEPTION 'ARJ: empresa inválida'; END IF;
  v_perfil := arj_exigir_usuario(FALSE, v_emp);
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'ARJ: la cotización no tiene renglones'; END IF;
  v_tier := arj_tier_cliente(v_cliente, v_emp);

  v_numero := arj_siguiente_correlativo(CASE WHEN v_emp = 'directa' THEN 'presupuesto_vd' ELSE 'presupuesto_dist' END, 4);
  INSERT INTO cotizaciones (numero, empresa, cliente_id, cliente_nombre, vendedor, fecha, fecha_vence,
    subtotal_usd, tasa_par, tasa_bcv, estado)
  VALUES (v_numero, v_emp, v_cliente, COALESCE(p_cot->>'cliente_nombre', 'CLIENTE MOSTRADOR'),
    v_perfil.nombre_display, NOW(), NOW() + INTERVAL '45 days', 0,
    NULLIF(p_cot->>'tasa_par', '')::NUMERIC, NULLIF(p_cot->>'tasa_bcv', '')::NUMERIC, 'activa')
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cant := COALESCE((v_item->>'cantidad')::INT, 0);
    v_precio := ROUND(COALESCE(NULLIF(v_item->>'precio_unitario', '')::NUMERIC, 0), 2);
    SELECT * INTO v_prod FROM productos WHERE id = NULLIF(v_item->>'producto_id', '')::INT;
    IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: el producto % no existe', COALESCE(v_item->>'cod_alt', '?'); END IF;
    IF v_cant <= 0 OR v_precio <= 0 THEN RAISE EXCEPTION 'ARJ: cantidad o precio inválido en %', v_prod.cod_alt; END IF;
    IF v_perfil.rol <> 'gerente' AND v_precio < arj_precio_lista(v_prod.fob, v_prod.precio_manual, v_tier) - 0.01 THEN
      RAISE EXCEPTION 'ARJ: % no se puede cotizar por debajo de su precio de lista', v_prod.cod_alt;
    END IF;
    INSERT INTO cotizacion_items (cotizacion_id, producto_id, cod_alt, descripcion, cantidad, fob_unitario,
      precio_unitario, total_linea, tier)
    VALUES (v_id, v_prod.id, v_prod.cod_alt, v_prod.descripcion, v_cant, COALESCE(v_prod.fob, 0),
      v_precio, ROUND(v_cant * v_precio, 2), v_tier);
    v_total := v_total + ROUND(v_cant * v_precio, 2);
  END LOOP;

  UPDATE cotizaciones SET subtotal_usd = v_total WHERE id = v_id;
  RETURN jsonb_build_object('ok', TRUE, 'id', v_id, 'numero', v_numero, 'total', v_total);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PRODUCTOS: el stock solo cambia si el gerente lo modificó y nadie lo movió
-- p puede traer stock_vd_original / stock_dist_original (lo que vio al abrir)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION guardar_producto(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id INT := NULLIF(p->>'id', '')::INT;
  v_fila productos;
  v_actual productos;
  v_vd INT;
  v_dist INT;
BEGIN
  PERFORM arj_exigir_usuario(TRUE);
  IF COALESCE(TRIM(p->>'cod_alt'), '') = '' THEN RAISE EXCEPTION 'ARJ: el código es obligatorio'; END IF;
  IF COALESCE(TRIM(p->>'descripcion'), '') = '' THEN RAISE EXCEPTION 'ARJ: la descripción es obligatoria'; END IF;
  IF COALESCE(NULLIF(p->>'stock_vd', '')::INT, 0) < 0 OR COALESCE(NULLIF(p->>'stock_dist', '')::INT, 0) < 0 THEN
    RAISE EXCEPTION 'ARJ: el stock no puede ser negativo';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO productos (cod_alt, cod_orig, cod_barras, descripcion, marca, fob, stock_vd, stock_dist, marca_modelo,
      sistema, precio_manual, activo, origen, factor_landed, proveedor)
    VALUES (UPPER(TRIM(p->>'cod_alt')), TRIM(COALESCE(p->>'cod_orig', '')), TRIM(COALESCE(p->>'cod_barras', '')),
      TRIM(p->>'descripcion'), TRIM(COALESCE(p->>'marca', '')), COALESCE(NULLIF(p->>'fob', '')::NUMERIC, 0),
      COALESCE(NULLIF(p->>'stock_vd', '')::INT, 0), COALESCE(NULLIF(p->>'stock_dist', '')::INT, 0),
      TRIM(COALESCE(p->>'marca_modelo', '')), TRIM(COALESCE(p->>'sistema', '')), NULLIF(p->>'precio_manual', '')::NUMERIC,
      TRUE, COALESCE(NULLIF(p->>'origen', ''), 'importado'), NULLIF(p->>'factor_landed', '')::NUMERIC,
      TRIM(COALESCE(p->>'proveedor', '')))
    RETURNING * INTO v_fila;
  ELSE
    SELECT * INTO v_actual FROM productos WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: producto no encontrado'; END IF;

    v_vd := v_actual.stock_vd;
    v_dist := v_actual.stock_dist;
    IF NULLIF(p->>'stock_vd', '') IS NOT NULL AND NULLIF(p->>'stock_vd_original', '') IS NOT NULL
       AND (p->>'stock_vd')::INT <> (p->>'stock_vd_original')::INT THEN
      IF COALESCE(v_actual.stock_vd, 0) <> (p->>'stock_vd_original')::INT THEN
        RAISE EXCEPTION 'ARJ: el stock de Venta Directa de % cambió mientras editabas (ahora %). Cierra y vuelve a abrir.',
          v_actual.cod_alt, v_actual.stock_vd;
      END IF;
      v_vd := (p->>'stock_vd')::INT;
    END IF;
    IF NULLIF(p->>'stock_dist', '') IS NOT NULL AND NULLIF(p->>'stock_dist_original', '') IS NOT NULL
       AND (p->>'stock_dist')::INT <> (p->>'stock_dist_original')::INT THEN
      IF COALESCE(v_actual.stock_dist, 0) <> (p->>'stock_dist_original')::INT THEN
        RAISE EXCEPTION 'ARJ: el stock de Distribuidora de % cambió mientras editabas (ahora %). Cierra y vuelve a abrir.',
          v_actual.cod_alt, v_actual.stock_dist;
      END IF;
      v_dist := (p->>'stock_dist')::INT;
    END IF;

    UPDATE productos SET
      cod_alt = UPPER(TRIM(p->>'cod_alt')),
      cod_orig = TRIM(COALESCE(p->>'cod_orig', '')),
      cod_barras = TRIM(COALESCE(p->>'cod_barras', '')),
      descripcion = TRIM(p->>'descripcion'),
      marca = TRIM(COALESCE(p->>'marca', '')),
      fob = COALESCE(NULLIF(p->>'fob', '')::NUMERIC, 0),
      stock_vd = v_vd,
      stock_dist = v_dist,
      marca_modelo = TRIM(COALESCE(p->>'marca_modelo', '')),
      sistema = TRIM(COALESCE(p->>'sistema', '')),
      precio_manual = NULLIF(p->>'precio_manual', '')::NUMERIC,
      origen = COALESCE(NULLIF(p->>'origen', ''), origen),
      factor_landed = COALESCE(NULLIF(p->>'factor_landed', '')::NUMERIC, factor_landed),
      proveedor = TRIM(COALESCE(p->>'proveedor', proveedor)),
      updated_at = NOW()
    WHERE id = v_id
    RETURNING * INTO v_fila;
  END IF;
  RETURN jsonb_build_object('ok', TRUE, 'data', to_jsonb(v_fila));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RECEPCIÓN / CONTEO: ajustes relativos (`delta`) y sin renglones en cero
-- conteo: [{producto_id, fisico}] fija el valor · [{producto_id, delta}] suma/resta
-- sobre el stock ACTUAL de la BD (no sobre lo que mostraba la pantalla)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION aplicar_recepcion(p_tipo TEXT, p_destino TEXT, p_embarque_id UUID,
                                            p_referencia TEXT, p_items JSONB, p_no_contados JSONB DEFAULT '[]'::JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perfil perfiles;
  v_numero TEXT;
  v_rid UUID;
  v_emb embarques;
  v_item JSONB;
  v_p productos;
  v_antes INT;
  v_despues INT;
  v_mov INT;
  v_clase TEXT;
  v_costo NUMERIC;
  v_n INT := 0;
  v_unidades INT := 0;
  v_total NUMERIC := 0;
  v_nc INT := 0;
  v_sellados INT := 0;
  v_conflictos JSONB := '[]'::JSONB;
  v_dest TEXT := CASE WHEN p_destino IN ('dist', 'distribuidora') THEN 'dist' ELSE 'directa' END;
BEGIN
  v_perfil := arj_exigir_usuario(TRUE);
  IF p_tipo NOT IN ('recepcion', 'conteo') THEN RAISE EXCEPTION 'ARJ: tipo inválido'; END IF;
  IF p_embarque_id IS NOT NULL THEN
    SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: embarque no encontrado'; END IF;
  END IF;

  v_numero := arj_siguiente_correlativo('recepcion');
  INSERT INTO recepciones (numero, fecha, tipo, destino, embarque_id, embarque_codigo, referencia, usuario,
    productos_count, unidades_count, total_costo, no_contados_count, anulado)
  VALUES (v_numero, NOW(), p_tipo, v_dest, p_embarque_id, v_emb.codigo, NULLIF(TRIM(p_referencia), ''),
    v_perfil.nombre_display, 0, 0, 0, 0, FALSE)
  RETURNING id INTO v_rid;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB)) LOOP
    SELECT * INTO v_p FROM productos WHERE id = (v_item->>'producto_id')::INT FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: producto % no existe', v_item->>'producto_id'; END IF;
    v_antes := CASE WHEN v_dest = 'directa' THEN COALESCE(v_p.stock_vd, 0) ELSE COALESCE(v_p.stock_dist, 0) END;

    IF p_tipo = 'recepcion' THEN
      v_mov := COALESCE((v_item->>'cantidad')::INT, 0);
      IF v_mov <= 0 THEN CONTINUE; END IF;
      v_despues := v_antes + v_mov;
      v_clase := 'entrada';
    ELSIF v_item ? 'delta' THEN
      v_mov := COALESCE((v_item->>'delta')::INT, 0);
      v_despues := v_antes + v_mov;
      IF v_despues < 0 THEN
        RAISE EXCEPTION 'ARJ: no puedes sacar % de %: solo hay %', ABS(v_mov), v_p.cod_alt, v_antes;
      END IF;
      v_clase := CASE WHEN v_mov < 0 THEN 'falta' ELSE 'sobra' END;
    ELSE
      v_despues := (v_item->>'fisico')::INT;
      IF v_despues IS NULL OR v_despues < 0 THEN RAISE EXCEPTION 'ARJ: conteo inválido en %', v_p.cod_alt; END IF;
      v_mov := v_despues - v_antes;
      v_clase := CASE WHEN v_mov < 0 THEN 'falta' ELSE 'sobra' END;
    END IF;

    IF v_mov <> 0 THEN
      IF v_dest = 'directa' THEN
        UPDATE productos SET stock_vd = v_despues WHERE id = v_p.id;
      ELSE
        UPDATE productos SET stock_dist = v_despues WHERE id = v_p.id;
      END IF;
    END IF;

    -- Sellado del costo: solo productos sin embarque. Los de OTRO embarque no se tocan.
    IF p_embarque_id IS NOT NULL THEN
      IF v_p.embarque_id IS NOT NULL AND v_p.embarque_id <> p_embarque_id THEN
        v_conflictos := v_conflictos || jsonb_build_object('cod_alt', v_p.cod_alt,
          'otro', (SELECT codigo FROM embarques WHERE id = v_p.embarque_id));
      ELSIF v_p.embarque_id IS NULL THEN
        UPDATE productos SET embarque_id = p_embarque_id, factor_landed = v_emb.factor,
          proveedor = v_emb.proveedor, origen = 'importado'
        WHERE id = v_p.id;
        v_sellados := v_sellados + 1;
        v_p.factor_landed := v_emb.factor;
      END IF;
    END IF;

    -- Un producto que cuadra no deja renglón (antes quedaba como "sobra" en cero)
    IF v_mov <> 0 THEN
      v_costo := COALESCE(v_p.fob, 0) * COALESCE(NULLIF(v_p.factor_landed, 0), 1.471);
      INSERT INTO recepcion_items (recepcion_id, producto_id, cod_alt, descripcion, marca, cantidad, costo_unitario,
        total_linea, stock_antes, stock_despues, clase)
      VALUES (v_rid, v_p.id, v_p.cod_alt, v_p.descripcion, v_p.marca, v_mov, ROUND(v_costo, 4),
        ROUND(v_costo * ABS(v_mov), 2), v_antes, v_despues, v_clase);
      v_n := v_n + 1;
      v_unidades := v_unidades + ABS(v_mov);
      v_total := v_total + v_costo * ABS(v_mov);
    END IF;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_no_contados, '[]'::JSONB)) LOOP
    SELECT * INTO v_p FROM productos WHERE id = (v_item #>> '{}')::INT;
    IF FOUND THEN
      v_antes := CASE WHEN v_dest = 'directa' THEN COALESCE(v_p.stock_vd, 0) ELSE COALESCE(v_p.stock_dist, 0) END;
      INSERT INTO recepcion_items (recepcion_id, producto_id, cod_alt, descripcion, marca, cantidad, costo_unitario,
        total_linea, stock_antes, stock_despues, clase)
      VALUES (v_rid, v_p.id, v_p.cod_alt, v_p.descripcion, v_p.marca, 0, 0, 0, v_antes, v_antes, 'no_contado');
      v_nc := v_nc + 1;
    END IF;
  END LOOP;

  IF v_n = 0 AND v_nc = 0 AND v_sellados = 0 THEN RAISE EXCEPTION 'ARJ: no hay cambios que aplicar'; END IF;

  UPDATE recepciones SET productos_count = v_n, unidades_count = v_unidades, total_costo = ROUND(v_total, 2),
    no_contados_count = v_nc
  WHERE id = v_rid;

  RETURN jsonb_build_object('ok', TRUE, 'id', v_rid, 'numero', v_numero, 'renglones', v_n, 'unidades', v_unidades,
    'no_contados', v_nc, 'sellados', v_sellados, 'conflictos', v_conflictos);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ACTUALIZAR CLIENTE: solo el gerente cambia el nivel de precio
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION actualizar_cliente(p_id INT, p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perfil perfiles;
  v_c clientes;
  v_nivel TEXT := COALESCE(NULLIF(p->>'nivel', ''), 'Publico');
  v_contacto_id INT;
BEGIN
  v_perfil := arj_exigir_usuario(FALSE);
  SELECT * INTO v_c FROM clientes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: cliente no encontrado'; END IF;
  IF LENGTH(TRIM(COALESCE(p->>'nombre', ''))) < 3 THEN RAISE EXCEPTION 'ARJ: el nombre del cliente es obligatorio'; END IF;
  IF v_nivel NOT IN ('Publico', 'T1', 'T2', 'T3') THEN RAISE EXCEPTION 'ARJ: nivel de precio inválido'; END IF;
  IF v_nivel <> COALESCE(v_c.nivel, 'Publico') AND v_perfil.rol <> 'gerente' THEN
    RAISE EXCEPTION 'ARJ: solo el gerente puede cambiar el nivel de precio de un cliente';
  END IF;

  UPDATE clientes SET
    nombre = UPPER(TRIM(p->>'nombre')),
    rif = UPPER(TRIM(COALESCE(p->>'rif', ''))),
    telefono = TRIM(COALESCE(p->>'telefono', '')),
    direccion = TRIM(COALESCE(p->>'direccion', '')),
    nivel = v_nivel,
    tipo_pago = COALESCE(NULLIF(p->>'tipo_pago', ''), tipo_pago),
    origen = COALESCE(NULLIF(p->>'origen', ''), origen),
    origen_detalle = TRIM(COALESCE(p->>'origen_detalle', '')),
    notas = TRIM(COALESCE(p->>'notas', ''))
  WHERE id = p_id;

  IF COALESCE(TRIM(p->'contacto'->>'nombre'), '') NOT IN ('', '—') THEN
    SELECT id INTO v_contacto_id FROM contactos_cliente WHERE cliente_id = p_id AND es_principal = TRUE LIMIT 1;
    IF v_contacto_id IS NULL THEN
      INSERT INTO contactos_cliente (cliente_id, nombre, cargo, telefono, es_principal)
      VALUES (p_id, TRIM(p->'contacto'->>'nombre'), TRIM(COALESCE(p->'contacto'->>'cargo', '')),
        TRIM(COALESCE(p->'contacto'->>'telefono', '')), TRUE);
    ELSE
      UPDATE contactos_cliente SET nombre = TRIM(p->'contacto'->>'nombre'),
        cargo = TRIM(COALESCE(p->'contacto'->>'cargo', '')), telefono = TRIM(COALESCE(p->'contacto'->>'telefono', ''))
      WHERE id = v_contacto_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─── Permisos ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION arj_tier_cliente(INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION actualizar_cliente(INT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION actualizar_cliente(INT, JSONB) TO authenticated;
-- Las demás conservan los permisos del 02 (CREATE OR REPLACE no los cambia)
REVOKE ALL ON FUNCTION emitir_factura_atomica(JSONB, JSONB, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION guardar_cotizacion(JSONB, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION guardar_producto(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION aplicar_recepcion(TEXT, TEXT, UUID, TEXT, JSONB, JSONB) FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';
