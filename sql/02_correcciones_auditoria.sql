-- ==============================================================================
-- SISTEMA ARJ · 02 — CORRECCIONES DE LA AUDITORÍA DE MIGRACIÓN (oct-2026)
--
-- Reemplaza al 01_solucion_auditoria_transaccional.sql (que tenía un error de
-- sintaxis en anular_factura_atomica y no validaba roles).
--
-- Qué hace:
--   · Funciones atómicas (una transacción cada una) para todo lo que escribe
--     en varias tablas: emitir, anular, abonar, traspasar, recibir/contar,
--     cotizar, crear clientes, productos, embarques, caja, tasas y config.
--   · Cada función valida en el SERVIDOR que el usuario tenga perfil activo,
--     el rol necesario y que opere en su empresa (no se confía en el navegador).
--   · El correlativo se toma DENTRO de la transacción: si la emisión falla, el
--     número no se quema (sin huecos en la serie).
--   · El saldo del cliente se mueve dentro de la misma transacción.
--   · Solo usuarios autenticados pueden ejecutarlas (REVOKE a anon/public).
--
-- Cómo aplicarlo: SQL Editor de Supabase, PRIMERO en staging. Es idempotente
-- (se puede correr varias veces). Al final hay consultas de verificación.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Limpieza de las funciones viejas (firmas del script 01)
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS emitir_factura_atomica(JSONB, JSONB, JSONB, TEXT);
DROP FUNCTION IF EXISTS anular_factura_atomica(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS obtener_siguiente_correlativo_seq(TEXT);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Índices únicos de documentos (si hay duplicados previos, avisa y sigue)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['facturas', 'cotizaciones', 'traspasos', 'recepciones'] LOOP
    BEGIN
      EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I (numero)', t || '_numero_unique_idx', t);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'No se pudo crear el índice único de %.numero: % (revisa duplicados)', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- Contadores que deben existir (no toca los que ya están: la serie DT se respeta)
INSERT INTO contadores (tipo, prefijo, anio, ultimo_numero)
SELECT v.tipo, v.prefijo, EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'America/Caracas'))::INT, 0
FROM (VALUES ('factura_vd', 'VD'), ('factura_dist', 'DT'), ('presupuesto_vd', 'PRE-VD'),
             ('presupuesto_dist', 'PRE-DT'), ('nota_entrega', 'NE'), ('recepcion', 'REC')) AS v(tipo, prefijo)
WHERE NOT EXISTS (SELECT 1 FROM contadores c WHERE c.tipo = v.tipo);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helpers de seguridad y correlativos (internos, no expuestos)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION arj_empresa_norm(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p IN ('dist', 'distribuidora') THEN 'distribuidora'
              WHEN p = 'directa' THEN 'directa'
              WHEN p = 'ambas' THEN 'ambas'
              ELSE p END
$$;

-- Devuelve el perfil del usuario actual o lanza error.
CREATE OR REPLACE FUNCTION arj_exigir_usuario(p_solo_gerente BOOLEAN DEFAULT FALSE, p_empresa TEXT DEFAULT NULL)
RETURNS perfiles
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v perfiles;
BEGIN
  SELECT * INTO v FROM perfiles WHERE id = auth.uid() AND activo = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ARJ: usuario sin perfil activo';
  END IF;
  IF p_solo_gerente AND v.rol <> 'gerente' THEN
    RAISE EXCEPTION 'ARJ: solo el gerente puede realizar esta operación';
  END IF;
  IF p_empresa IS NOT NULL AND arj_empresa_norm(v.empresa) <> 'ambas'
     AND arj_empresa_norm(v.empresa) <> arj_empresa_norm(p_empresa) THEN
    RAISE EXCEPTION 'ARJ: tu usuario no opera en la empresa %', p_empresa;
  END IF;
  RETURN v;
END $$;

-- Siguiente número de un contador, con bloqueo de fila. Reinicia al cambiar de año.
CREATE OR REPLACE FUNCTION arj_siguiente_correlativo(p_tipo TEXT, p_digitos INT DEFAULT 5)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_anio INT := EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'America/Caracas'))::INT;
  v_row contadores;
  v_num INT;
BEGIN
  SELECT * INTO v_row FROM contadores WHERE tipo = p_tipo ORDER BY anio DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ARJ: no existe el contador %', p_tipo;
  END IF;
  IF v_row.anio <> v_anio THEN
    v_num := 1;
    UPDATE contadores SET anio = v_anio, ultimo_numero = 1 WHERE id = v_row.id;
  ELSE
    v_num := v_row.ultimo_numero + 1;
    UPDATE contadores SET ultimo_numero = v_num WHERE id = v_row.id;
  END IF;
  RETURN v_row.prefijo || '-' || v_anio || '-' || LPAD(v_num::TEXT, p_digitos, '0');
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. EMITIR FACTURA (C-04, C-06, A-03, A-09, M-10)
-- p_factura: empresa, cliente_id, cliente_nombre, cliente_*_snap, subtotal_usd,
--            saldo_pendiente, estado, tipo_pago, dias_credito, tasa_par, tasa_bcv,
--            factor_bs, descuento_manual, motivo_descuento, descuento_manual_pct,
--            pidio_fiscal, cobrar_verde, cotizacion_id (opcional)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION emitir_factura_atomica(p_factura JSONB, p_items JSONB, p_pagos JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp TEXT := arj_empresa_norm(p_factura->>'empresa');
  v_perfil perfiles;
  v_numero TEXT;
  v_id INT;
  v_item JSONB;
  v_pago JSONB;
  v_prod INT;
  v_cant INT;
  v_tipo_pago TEXT := COALESCE(p_factura->>'tipo_pago', 'contado');
  v_dias INT := COALESCE(NULLIF(p_factura->>'dias_credito', '')::INT, 0);
  v_saldo NUMERIC := COALESCE(NULLIF(p_factura->>'saldo_pendiente', '')::NUMERIC, 0);
  v_cliente INT := NULLIF(p_factura->>'cliente_id', '')::INT;
  v_fila facturas;
BEGIN
  IF v_emp NOT IN ('directa', 'distribuidora') THEN
    RAISE EXCEPTION 'ARJ: empresa inválida';
  END IF;
  v_perfil := arj_exigir_usuario(FALSE, v_emp);

  IF COALESCE(NULLIF(p_factura->>'descuento_manual_pct', '')::NUMERIC, 0) > 0 AND v_perfil.rol <> 'gerente' THEN
    RAISE EXCEPTION 'ARJ: solo el gerente puede aplicar descuentos manuales';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ARJ: la factura no tiene renglones';
  END IF;
  IF COALESCE((p_factura->>'tasa_bcv')::NUMERIC, 0) <= 0 OR COALESCE((p_factura->>'tasa_par')::NUMERIC, 0) <= 0 THEN
    RAISE EXCEPTION 'ARJ: faltan las tasas de cambio';
  END IF;
  IF v_tipo_pago = 'contado' THEN v_saldo := 0; END IF;
  IF v_saldo > 0 AND v_cliente IS NULL THEN
    RAISE EXCEPTION 'ARJ: una factura con saldo pendiente necesita un cliente registrado';
  END IF;

  v_numero := arj_siguiente_correlativo(CASE WHEN v_emp = 'directa' THEN 'factura_vd' ELSE 'factura_dist' END);

  INSERT INTO facturas (
    numero, empresa, cliente_id, cliente_nombre, vendedor, fecha,
    subtotal_usd, saldo_pendiente, estado, tipo_pago, dias_credito, fecha_vence,
    tasa_par, tasa_bcv, factor_bs, descuento_manual, motivo_descuento, pidio_fiscal, cobrar_verde,
    cliente_nombre_snap, cliente_rif_snap, cliente_tel_snap, cliente_dir_snap
  ) VALUES (
    v_numero, v_emp, v_cliente, p_factura->>'cliente_nombre', v_perfil.nombre_display, NOW(),
    (p_factura->>'subtotal_usd')::NUMERIC, v_saldo,
    CASE WHEN v_saldo <= 0.01 THEN 'pagada' ELSE COALESCE(p_factura->>'estado', 'pendiente') END,
    v_tipo_pago, CASE WHEN v_tipo_pago = 'credito' THEN v_dias ELSE NULL END,
    CASE WHEN v_tipo_pago = 'credito' THEN NOW() + make_interval(days => v_dias) ELSE NULL END,
    (p_factura->>'tasa_par')::NUMERIC, (p_factura->>'tasa_bcv')::NUMERIC,
    COALESCE(NULLIF(p_factura->>'factor_bs', '')::NUMERIC, 1.00),
    COALESCE(NULLIF(p_factura->>'descuento_manual', '')::NUMERIC, 0),
    COALESCE(p_factura->>'motivo_descuento', ''),
    COALESCE((p_factura->>'pidio_fiscal')::BOOLEAN, FALSE),
    NULLIF(p_factura->>'cobrar_verde', '')::NUMERIC,
    p_factura->>'cliente_nombre_snap', p_factura->>'cliente_rif_snap',
    p_factura->>'cliente_tel_snap', p_factura->>'cliente_dir_snap'
  ) RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_prod := NULLIF(v_item->>'producto_id', '')::INT;
    v_cant := COALESCE((v_item->>'cantidad')::INT, 0);
    IF v_prod IS NULL THEN
      RAISE EXCEPTION 'ARJ: el renglón % no tiene producto', COALESCE(v_item->>'cod_alt', '?');
    END IF;
    IF v_cant <= 0 THEN
      RAISE EXCEPTION 'ARJ: cantidad inválida en %', COALESCE(v_item->>'cod_alt', '?');
    END IF;

    INSERT INTO factura_items (factura_id, producto_id, cod_alt, descripcion, cantidad,
      fob_unitario, precio_unitario, total_linea, tier, factor_landed, origen)
    VALUES (v_id, v_prod, COALESCE(v_item->>'cod_alt', ''), COALESCE(v_item->>'descripcion', ''), v_cant,
      COALESCE(NULLIF(v_item->>'fob_unitario', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_item->>'precio_unitario', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_item->>'total_linea', '')::NUMERIC, 0),
      COALESCE(v_item->>'tier', 'Publico'),
      NULLIF(v_item->>'factor_landed', '')::NUMERIC,
      CASE WHEN LOWER(COALESCE(v_item->>'origen', '')) IN ('local', 'importado') THEN LOWER(v_item->>'origen')
           WHEN NULLIF(v_item->>'factor_landed', '')::NUMERIC BETWEEN 0.0001 AND 1.001 THEN 'local'
           ELSE 'importado' END);

    -- Stock: se permite quedar negativo (préstamo inter-empresa, igual que el monolito)
    IF v_emp = 'directa' THEN
      UPDATE productos SET stock_vd = COALESCE(stock_vd, 0) - v_cant WHERE id = v_prod;
    ELSE
      UPDATE productos SET stock_dist = COALESCE(stock_dist, 0) - v_cant WHERE id = v_prod;
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ARJ: producto % no existe', v_prod;
    END IF;
  END LOOP;

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
    END LOOP;
  END IF;

  -- Saldo del cliente, en la misma transacción (A-09)
  IF v_saldo > 0 THEN
    IF v_emp = 'directa' THEN
      UPDATE clientes SET saldo_vd = COALESCE(saldo_vd, 0) + v_saldo WHERE id = v_cliente;
    ELSE
      UPDATE clientes SET saldo_dist = COALESCE(saldo_dist, 0) + v_saldo WHERE id = v_cliente;
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ARJ: el cliente % no existe en la base de datos', v_cliente;
    END IF;
  END IF;

  -- Cotización de origen: se marca convertida SOLO si la factura se emitió (A-10)
  IF NULLIF(p_factura->>'cotizacion_id', '') IS NOT NULL THEN
    UPDATE cotizaciones SET estado = 'convertida', factura_id = v_id
    WHERE id = (p_factura->>'cotizacion_id')::INT;
  END IF;

  SELECT * INTO v_fila FROM facturas WHERE id = v_id;
  RETURN jsonb_build_object('ok', TRUE, 'data', to_jsonb(v_fila));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ANULAR FACTURA (C-07, C-08, A-09) — solo gerente
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION anular_factura_atomica(p_factura_id INT, p_motivo TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perfil perfiles;
  v_f facturas;
  v_item RECORD;
BEGIN
  v_perfil := arj_exigir_usuario(TRUE);
  IF COALESCE(TRIM(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'ARJ: el motivo de anulación es obligatorio';
  END IF;

  SELECT * INTO v_f FROM facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: factura no encontrada'; END IF;
  IF v_f.estado = 'anulada' THEN RAISE EXCEPTION 'ARJ: la factura ya estaba anulada'; END IF;

  -- Se repone el stock en la empresa DE LA FACTURA, no en la activa en pantalla
  FOR v_item IN SELECT producto_id, cod_alt, cantidad FROM factura_items WHERE factura_id = v_f.id LOOP
    IF v_f.empresa = 'directa' THEN
      UPDATE productos SET stock_vd = COALESCE(stock_vd, 0) + v_item.cantidad
      WHERE id = v_item.producto_id OR (v_item.producto_id IS NULL AND cod_alt = v_item.cod_alt);
    ELSE
      UPDATE productos SET stock_dist = COALESCE(stock_dist, 0) + v_item.cantidad
      WHERE id = v_item.producto_id OR (v_item.producto_id IS NULL AND cod_alt = v_item.cod_alt);
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ARJ: no se pudo reponer el producto %', COALESCE(v_item.cod_alt, v_item.producto_id::TEXT);
    END IF;
  END LOOP;

  IF COALESCE(v_f.saldo_pendiente, 0) > 0 AND v_f.cliente_id IS NOT NULL THEN
    IF v_f.empresa = 'directa' THEN
      UPDATE clientes SET saldo_vd = GREATEST(0, COALESCE(saldo_vd, 0) - v_f.saldo_pendiente) WHERE id = v_f.cliente_id;
    ELSE
      UPDATE clientes SET saldo_dist = GREATEST(0, COALESCE(saldo_dist, 0) - v_f.saldo_pendiente) WHERE id = v_f.cliente_id;
    END IF;
  END IF;

  UPDATE facturas
  SET estado = 'anulada',
      motivo_anulacion = TRIM(p_motivo) || ' (Por: ' || v_perfil.nombre_display || ')',
      fecha_anulacion = NOW()
  WHERE id = v_f.id;

  RETURN jsonb_build_object('ok', TRUE);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. REGISTRAR ABONO (C-04, A-09)
-- p_acredita: $BCV que baja del saldo. p_pago: monto_usd, monto_bs, tasa_usada,
-- metodo, referencia (lo que el cliente ENTREGÓ, v13.33)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION registrar_abono_atomico(p_factura_id INT, p_acredita NUMERIC, p_pago JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perfil perfiles;
  v_f facturas;
  v_nuevo NUMERIC;
  v_estado TEXT;
BEGIN
  SELECT * INTO v_f FROM facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: factura no encontrada'; END IF;
  v_perfil := arj_exigir_usuario(FALSE, v_f.empresa);

  IF v_f.estado IN ('anulada', 'pagada') THEN
    RAISE EXCEPTION 'ARJ: la factura % está %', v_f.numero, v_f.estado;
  END IF;
  IF p_acredita IS NULL OR p_acredita <= 0 THEN
    RAISE EXCEPTION 'ARJ: monto de abono inválido';
  END IF;
  IF p_acredita > COALESCE(v_f.saldo_pendiente, 0) + 0.01 THEN
    RAISE EXCEPTION 'ARJ: el abono (%) excede el saldo pendiente (%)', p_acredita, v_f.saldo_pendiente;
  END IF;
  IF p_pago->>'metodo' ~* '(transferencia|pago m[oó]vil|punto de venta|zelle)'
     AND COALESCE(TRIM(p_pago->>'referencia'), '') = '' THEN
    RAISE EXCEPTION 'ARJ: la referencia es obligatoria para %', p_pago->>'metodo';
  END IF;

  v_nuevo := GREATEST(0, ROUND(COALESCE(v_f.saldo_pendiente, 0) - p_acredita, 2));
  v_estado := CASE WHEN v_nuevo <= 0.01 THEN 'pagada' ELSE 'parcial' END;

  INSERT INTO pagos (factura_id, fecha, monto_usd, monto_bs, tasa_usada, metodo, referencia, registrado_por, notas)
  VALUES (v_f.id, NOW(),
    COALESCE(NULLIF(p_pago->>'monto_usd', '')::NUMERIC, 0),
    COALESCE(NULLIF(p_pago->>'monto_bs', '')::NUMERIC, 0),
    NULLIF(p_pago->>'tasa_usada', '')::NUMERIC,
    COALESCE(p_pago->>'metodo', 'Efectivo USD'),
    COALESCE(p_pago->>'referencia', ''),
    v_perfil.nombre_display,
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
-- 6. TRASPASO DISTRIBUIDORA → VENTA DIRECTA con Nota de Entrega (C-01)
-- p_items: [{producto_id, cantidad}]
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION aplicar_traspaso(p_items JSONB, p_referencia TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perfil perfiles;
  v_numero TEXT;
  v_tid UUID;
  v_item JSONB;
  v_p productos;
  v_cant INT;
  v_costo NUMERIC;
  v_unidades INT := 0;
  v_total NUMERIC := 0;
  v_n INT := 0;
  v_embs UUID[] := '{}';
  v_emb_txt TEXT := '';
BEGIN
  v_perfil := arj_exigir_usuario(TRUE);
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ARJ: el traspaso no tiene renglones';
  END IF;

  v_numero := arj_siguiente_correlativo('nota_entrega');
  INSERT INTO traspasos (numero, fecha, origen, destino, referencia, usuario, productos_count, unidades_count, total_costo, anulado)
  VALUES (v_numero, NOW(), 'dist', 'directa', NULLIF(TRIM(p_referencia), ''), v_perfil.nombre_display, 0, 0, 0, FALSE)
  RETURNING id INTO v_tid;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cant := COALESCE((v_item->>'cantidad')::INT, 0);
    IF v_cant <= 0 THEN CONTINUE; END IF;
    SELECT * INTO v_p FROM productos WHERE id = (v_item->>'producto_id')::INT FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: producto % no existe', v_item->>'producto_id'; END IF;
    IF COALESCE(v_p.stock_dist, 0) < v_cant THEN
      RAISE EXCEPTION 'ARJ: % solo tiene % en Distribuidora (pediste %)', v_p.cod_alt, COALESCE(v_p.stock_dist, 0), v_cant;
    END IF;
    v_costo := COALESCE(v_p.fob, 0) * COALESCE(NULLIF(v_p.factor_landed, 0), 1.471);

    UPDATE productos SET stock_dist = stock_dist - v_cant, stock_vd = COALESCE(stock_vd, 0) + v_cant WHERE id = v_p.id;
    INSERT INTO traspaso_items (traspaso_id, producto_id, cod_alt, descripcion, marca, cantidad, costo_unitario, total_linea,
      stock_dist_antes, stock_dist_despues, stock_vd_antes, stock_vd_despues)
    VALUES (v_tid, v_p.id, v_p.cod_alt, v_p.descripcion, v_p.marca, v_cant, ROUND(v_costo, 4), ROUND(v_costo * v_cant, 2),
      COALESCE(v_p.stock_dist, 0), COALESCE(v_p.stock_dist, 0) - v_cant, COALESCE(v_p.stock_vd, 0), COALESCE(v_p.stock_vd, 0) + v_cant);

    v_n := v_n + 1;
    v_unidades := v_unidades + v_cant;
    v_total := v_total + v_costo * v_cant;
    IF v_p.embarque_id IS NOT NULL AND NOT (v_p.embarque_id = ANY(v_embs)) THEN
      v_embs := array_append(v_embs, v_p.embarque_id);
    END IF;
  END LOOP;

  IF v_n = 0 THEN RAISE EXCEPTION 'ARJ: ninguna cantidad válida para traspasar'; END IF;
  IF array_length(v_embs, 1) = 1 THEN
    SELECT codigo INTO v_emb_txt FROM embarques WHERE id = v_embs[1];
  ELSIF array_length(v_embs, 1) > 1 THEN
    v_emb_txt := 'Varios (' || array_length(v_embs, 1) || ')';
  END IF;

  UPDATE traspasos SET productos_count = v_n, unidades_count = v_unidades, total_costo = ROUND(v_total, 2),
    embarque_codigo = NULLIF(v_emb_txt, '')
  WHERE id = v_tid;

  RETURN jsonb_build_object('ok', TRUE, 'id', v_tid, 'numero', v_numero, 'renglones', v_n, 'unidades', v_unidades, 'total_costo', ROUND(v_total, 2));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RECEPCIÓN / CONTEO FÍSICO con sellado de embarque (C-01, M-08)
-- p_tipo: 'recepcion' (suma) | 'conteo' (fija al físico)
-- p_destino: 'directa' | 'dist'
-- p_items: recepcion → [{producto_id, cantidad}] · conteo → [{producto_id, fisico}]
-- p_no_contados: [producto_id, ...] (solo se anotan, nunca se ponen en cero)
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
    ELSE
      v_despues := (v_item->>'fisico')::INT;
      IF v_despues IS NULL OR v_despues < 0 THEN RAISE EXCEPTION 'ARJ: conteo inválido en %', v_p.cod_alt; END IF;
      v_mov := v_despues - v_antes;
      v_clase := CASE WHEN v_mov < 0 THEN 'falta' ELSE 'sobra' END;
    END IF;

    IF v_dest = 'directa' THEN
      UPDATE productos SET stock_vd = v_despues WHERE id = v_p.id;
    ELSE
      UPDATE productos SET stock_dist = v_despues WHERE id = v_p.id;
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

    v_costo := COALESCE(v_p.fob, 0) * COALESCE(NULLIF(v_p.factor_landed, 0), 1.471);
    INSERT INTO recepcion_items (recepcion_id, producto_id, cod_alt, descripcion, marca, cantidad, costo_unitario,
      total_linea, stock_antes, stock_despues, clase)
    VALUES (v_rid, v_p.id, v_p.cod_alt, v_p.descripcion, v_p.marca, v_mov, ROUND(v_costo, 4),
      ROUND(v_costo * ABS(v_mov), 2), v_antes, v_despues, v_clase);

    v_n := v_n + 1;
    v_unidades := v_unidades + ABS(v_mov);
    v_total := v_total + v_costo * ABS(v_mov);
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

  IF v_n = 0 AND v_nc = 0 THEN RAISE EXCEPTION 'ARJ: no hay renglones para aplicar'; END IF;

  UPDATE recepciones SET productos_count = v_n, unidades_count = v_unidades, total_costo = ROUND(v_total, 2),
    no_contados_count = v_nc
  WHERE id = v_rid;

  RETURN jsonb_build_object('ok', TRUE, 'id', v_rid, 'numero', v_numero, 'renglones', v_n, 'unidades', v_unidades,
    'no_contados', v_nc, 'sellados', v_sellados, 'conflictos', v_conflictos);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. COTIZACIONES (C-01, A-10)
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
  v_total NUMERIC := 0;
BEGIN
  IF v_emp NOT IN ('directa', 'distribuidora') THEN RAISE EXCEPTION 'ARJ: empresa inválida'; END IF;
  v_perfil := arj_exigir_usuario(FALSE, v_emp);
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'ARJ: la cotización no tiene renglones'; END IF;

  SELECT SUM(COALESCE((e->>'cantidad')::NUMERIC, 0) * COALESCE((e->>'precio_unitario')::NUMERIC, 0))
  INTO v_total FROM jsonb_array_elements(p_items) e;

  v_numero := arj_siguiente_correlativo(CASE WHEN v_emp = 'directa' THEN 'presupuesto_vd' ELSE 'presupuesto_dist' END, 4);
  INSERT INTO cotizaciones (numero, empresa, cliente_id, cliente_nombre, vendedor, fecha, fecha_vence,
    subtotal_usd, tasa_par, tasa_bcv, estado)
  VALUES (v_numero, v_emp, NULLIF(p_cot->>'cliente_id', '')::INT, COALESCE(p_cot->>'cliente_nombre', 'CLIENTE MOSTRADOR'),
    v_perfil.nombre_display, NOW(), NOW() + INTERVAL '45 days', ROUND(v_total, 2),
    NULLIF(p_cot->>'tasa_par', '')::NUMERIC, NULLIF(p_cot->>'tasa_bcv', '')::NUMERIC, 'activa')
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO cotizacion_items (cotizacion_id, producto_id, cod_alt, descripcion, cantidad, fob_unitario,
      precio_unitario, total_linea, tier)
    VALUES (v_id, NULLIF(v_item->>'producto_id', '')::INT, COALESCE(v_item->>'cod_alt', ''),
      COALESCE(v_item->>'descripcion', ''), COALESCE((v_item->>'cantidad')::INT, 0),
      COALESCE(NULLIF(v_item->>'fob_unitario', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_item->>'precio_unitario', '')::NUMERIC, 0),
      COALESCE((v_item->>'cantidad')::NUMERIC, 0) * COALESCE(NULLIF(v_item->>'precio_unitario', '')::NUMERIC, 0),
      COALESCE(v_item->>'tier', 'Publico'));
  END LOOP;

  RETURN jsonb_build_object('ok', TRUE, 'id', v_id, 'numero', v_numero, 'total', ROUND(v_total, 2));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

CREATE OR REPLACE FUNCTION cambiar_estado_cotizacion(p_id INT, p_estado TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_c cotizaciones;
BEGIN
  IF p_estado NOT IN ('rechazada', 'activa') THEN RAISE EXCEPTION 'ARJ: estado no permitido'; END IF;
  SELECT * INTO v_c FROM cotizaciones WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: cotización no encontrada'; END IF;
  PERFORM arj_exigir_usuario(FALSE, v_c.empresa);
  IF v_c.estado = 'convertida' THEN RAISE EXCEPTION 'ARJ: la cotización ya fue facturada'; END IF;
  UPDATE cotizaciones SET estado = p_estado WHERE id = p_id;
  RETURN jsonb_build_object('ok', TRUE);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. CLIENTES (C-02): alta con contacto principal, devuelve el id real
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_cliente(p_cliente JSONB, p_contacto JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perfil perfiles;
  v_c clientes;
  v_nombre TEXT := UPPER(TRIM(COALESCE(p_cliente->>'nombre', '')));
BEGIN
  v_perfil := arj_exigir_usuario(FALSE);
  IF LENGTH(v_nombre) < 3 THEN RAISE EXCEPTION 'ARJ: el nombre del cliente es obligatorio'; END IF;
  IF COALESCE(p_cliente->>'nivel', 'Publico') NOT IN ('Publico', 'T1', 'T2', 'T3') THEN
    RAISE EXCEPTION 'ARJ: nivel de precio inválido';
  END IF;
  IF COALESCE(p_cliente->>'nivel', 'Publico') <> 'Publico' AND v_perfil.rol <> 'gerente' THEN
    RAISE EXCEPTION 'ARJ: solo el gerente puede asignar niveles T1/T2/T3';
  END IF;

  INSERT INTO clientes (nombre, rif, nivel, tipo_pago, saldo_vd, saldo_dist, telefono, empresa, direccion, notas,
    activo, origen, origen_detalle)
  VALUES (v_nombre, UPPER(TRIM(COALESCE(p_cliente->>'rif', ''))), COALESCE(p_cliente->>'nivel', 'Publico'),
    COALESCE(p_cliente->>'tipo_pago', 'contado'), 0, 0, TRIM(COALESCE(p_cliente->>'telefono', '')),
    COALESCE(p_cliente->>'empresa', 'ambas'), TRIM(COALESCE(p_cliente->>'direccion', '')),
    TRIM(COALESCE(p_cliente->>'notas', '')), TRUE, NULLIF(p_cliente->>'origen', ''),
    TRIM(COALESCE(p_cliente->>'origen_detalle', '')))
  RETURNING * INTO v_c;

  IF p_contacto IS NOT NULL AND COALESCE(TRIM(p_contacto->>'nombre'), '') NOT IN ('', '—') THEN
    INSERT INTO contactos_cliente (cliente_id, nombre, cargo, telefono, es_principal)
    VALUES (v_c.id, TRIM(p_contacto->>'nombre'), TRIM(COALESCE(p_contacto->>'cargo', '')),
      TRIM(COALESCE(p_contacto->>'telefono', '')), TRUE);
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'data', to_jsonb(v_c));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. PRODUCTOS Y EMBARQUES (C-01) — solo gerente
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION guardar_producto(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id INT := NULLIF(p->>'id', '')::INT;
  v_fila productos;
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
    UPDATE productos SET
      cod_alt = UPPER(TRIM(p->>'cod_alt')),
      cod_orig = TRIM(COALESCE(p->>'cod_orig', '')),
      cod_barras = TRIM(COALESCE(p->>'cod_barras', '')),
      descripcion = TRIM(p->>'descripcion'),
      marca = TRIM(COALESCE(p->>'marca', '')),
      fob = COALESCE(NULLIF(p->>'fob', '')::NUMERIC, 0),
      stock_vd = COALESCE(NULLIF(p->>'stock_vd', '')::INT, stock_vd),
      stock_dist = COALESCE(NULLIF(p->>'stock_dist', '')::INT, stock_dist),
      marca_modelo = TRIM(COALESCE(p->>'marca_modelo', '')),
      sistema = TRIM(COALESCE(p->>'sistema', '')),
      precio_manual = NULLIF(p->>'precio_manual', '')::NUMERIC,
      origen = COALESCE(NULLIF(p->>'origen', ''), origen),
      factor_landed = COALESCE(NULLIF(p->>'factor_landed', '')::NUMERIC, factor_landed),
      proveedor = TRIM(COALESCE(p->>'proveedor', proveedor)),
      updated_at = NOW()
    WHERE id = v_id
    RETURNING * INTO v_fila;
    IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: producto no encontrado'; END IF;
  END IF;
  RETURN jsonb_build_object('ok', TRUE, 'data', to_jsonb(v_fila));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

CREATE OR REPLACE FUNCTION desactivar_producto(p_id INT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM arj_exigir_usuario(TRUE);
  UPDATE productos SET activo = FALSE, updated_at = NOW() WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: producto no encontrado'; END IF;
  RETURN jsonb_build_object('ok', TRUE);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- El factor lo calcula Postgres (columna generada en embarques)
CREATE OR REPLACE FUNCTION guardar_embarque(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID := NULLIF(p->>'id', '')::UUID;
  v_fila embarques;
BEGIN
  PERFORM arj_exigir_usuario(TRUE);
  IF COALESCE(TRIM(p->>'codigo'), '') = '' OR COALESCE(TRIM(p->>'proveedor'), '') = '' THEN
    RAISE EXCEPTION 'ARJ: código y proveedor son obligatorios';
  END IF;
  IF COALESCE(NULLIF(p->>'pct_flete_aduana', '')::NUMERIC, 0) < 0 OR COALESCE(NULLIF(p->>'pct_comision', '')::NUMERIC, 0) < 0
     OR COALESCE(NULLIF(p->>'pct_divisas', '')::NUMERIC, 0) < 0 THEN
    RAISE EXCEPTION 'ARJ: los porcentajes no pueden ser negativos';
  END IF;
  IF v_id IS NULL THEN
    INSERT INTO embarques (codigo, proveedor, fecha_llegada, fob_total, monto_flete_aduana, pct_flete_aduana,
      pct_comision, pct_divisas, notas, activo)
    VALUES (UPPER(TRIM(p->>'codigo')), UPPER(TRIM(p->>'proveedor')), NULLIF(p->>'fecha_llegada', '')::DATE,
      NULLIF(p->>'fob_total', '')::NUMERIC, NULLIF(p->>'monto_flete_aduana', '')::NUMERIC,
      COALESCE(NULLIF(p->>'pct_flete_aduana', '')::NUMERIC, 0), COALESCE(NULLIF(p->>'pct_comision', '')::NUMERIC, 0),
      COALESCE(NULLIF(p->>'pct_divisas', '')::NUMERIC, 0), NULLIF(p->>'notas', ''), TRUE)
    RETURNING * INTO v_fila;
  ELSE
    UPDATE embarques SET codigo = UPPER(TRIM(p->>'codigo')), proveedor = UPPER(TRIM(p->>'proveedor')),
      fecha_llegada = NULLIF(p->>'fecha_llegada', '')::DATE,
      fob_total = NULLIF(p->>'fob_total', '')::NUMERIC, monto_flete_aduana = NULLIF(p->>'monto_flete_aduana', '')::NUMERIC,
      pct_flete_aduana = COALESCE(NULLIF(p->>'pct_flete_aduana', '')::NUMERIC, 0),
      pct_comision = COALESCE(NULLIF(p->>'pct_comision', '')::NUMERIC, 0),
      pct_divisas = COALESCE(NULLIF(p->>'pct_divisas', '')::NUMERIC, 0),
      notas = NULLIF(p->>'notas', ''), updated_at = NOW()
    WHERE id = v_id RETURNING * INTO v_fila;
    IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: embarque no encontrado'; END IF;
  END IF;
  RETURN jsonb_build_object('ok', TRUE, 'data', to_jsonb(v_fila));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- Lleva el factor del embarque a sus productos sellados (las facturas ya emitidas no cambian)
CREATE OR REPLACE FUNCTION recalcular_embarque(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_e embarques; v_n INT;
BEGIN
  PERFORM arj_exigir_usuario(TRUE);
  SELECT * INTO v_e FROM embarques WHERE id = p_id;
  IF NOT FOUND OR COALESCE(v_e.factor, 0) <= 0 THEN RAISE EXCEPTION 'ARJ: embarque sin factor válido'; END IF;
  UPDATE productos SET factor_landed = v_e.factor, updated_at = NOW()
  WHERE embarque_id = p_id AND ABS(COALESCE(factor_landed, 0) - v_e.factor) > 0.000001;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', TRUE, 'actualizados', v_n, 'factor', v_e.factor);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. MOVIMIENTOS DE CAJA (C-01) — solo gerente
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION registrar_movimiento_caja(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_perfil perfiles; v_fila movimientos_caja;
BEGIN
  v_perfil := arj_exigir_usuario(TRUE);
  IF p->>'tipo' NOT IN ('entrada', 'salida') THEN RAISE EXCEPTION 'ARJ: tipo inválido'; END IF;
  IF COALESCE(NULLIF(p->>'monto_usd', '')::NUMERIC, 0) <= 0 THEN RAISE EXCEPTION 'ARJ: monto inválido'; END IF;
  IF COALESCE(TRIM(p->>'concepto'), '') = '' THEN RAISE EXCEPTION 'ARJ: el concepto es obligatorio'; END IF;
  INSERT INTO movimientos_caja (fecha, tipo, empresa, categoria, clasificacion, concepto, beneficiario, documento,
    monto_usd, monto_bs, tasa_usada, moneda_origen, metodo, afecta_caja, estado, registrado_por, tasa_bcv_ref)
  VALUES (COALESCE(NULLIF(p->>'fecha', '')::TIMESTAMPTZ, NOW()), p->>'tipo', arj_empresa_norm(COALESCE(p->>'empresa', 'directa')),
    p->>'categoria', COALESCE(p->>'clasificacion', 'opex'), TRIM(p->>'concepto'), NULLIF(p->>'beneficiario', ''),
    NULLIF(p->>'documento', ''), (p->>'monto_usd')::NUMERIC, COALESCE(NULLIF(p->>'monto_bs', '')::NUMERIC, 0),
    NULLIF(p->>'tasa_usada', '')::NUMERIC, COALESCE(p->>'moneda_origen', 'USD'), p->>'metodo',
    COALESCE((p->>'afecta_caja')::BOOLEAN, TRUE), 'activo', v_perfil.nombre_display, NULLIF(p->>'tasa_bcv_ref', '')::NUMERIC)
  RETURNING * INTO v_fila;
  RETURN jsonb_build_object('ok', TRUE, 'data', to_jsonb(v_fila));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

CREATE OR REPLACE FUNCTION anular_movimiento_caja(p_id INT, p_motivo TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM arj_exigir_usuario(TRUE);
  IF COALESCE(TRIM(p_motivo), '') = '' THEN RAISE EXCEPTION 'ARJ: el motivo es obligatorio'; END IF;
  UPDATE movimientos_caja SET estado = 'anulado', anulado_motivo = TRIM(p_motivo) WHERE id = p_id AND estado <> 'anulado';
  IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: movimiento no encontrado o ya anulado'; END IF;
  RETURN jsonb_build_object('ok', TRUE);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. TASAS Y CONFIGURACIÓN (C-09, A-07) — solo gerente
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION confirmar_tasas(p_bcv NUMERIC, p_par NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ts TIMESTAMPTZ := NOW();
BEGIN
  PERFORM arj_exigir_usuario(TRUE);
  IF p_bcv IS NULL OR p_par IS NULL OR p_bcv <= 0 OR p_par <= 0 THEN
    RAISE EXCEPTION 'ARJ: las tasas deben ser mayores que cero';
  END IF;
  IF p_bcv > p_par THEN RAISE EXCEPTION 'ARJ: el BCV quedó por encima del paralelo'; END IF;
  UPDATE configuracion SET tasa_bcv = p_bcv, tasa_par = p_par, tasas_actualizadas = v_ts, updated_at = v_ts
  WHERE id = (SELECT id FROM configuracion ORDER BY id LIMIT 1);
  RETURN jsonb_build_object('ok', TRUE, 'tasas_actualizadas', v_ts);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- Solo estas claves: factor_landed_default, costos_fijos_mes, costos_fijos_hist, equipo, metas_hist
CREATE OR REPLACE FUNCTION actualizar_configuracion(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fila configuracion;
BEGIN
  PERFORM arj_exigir_usuario(TRUE);
  UPDATE configuracion SET
    factor_landed_default = CASE WHEN p ? 'factor_landed_default' THEN (p->>'factor_landed_default')::NUMERIC ELSE factor_landed_default END,
    costos_fijos_mes = CASE WHEN p ? 'costos_fijos_mes' THEN (p->>'costos_fijos_mes')::NUMERIC ELSE costos_fijos_mes END,
    costos_fijos_hist = CASE WHEN p ? 'costos_fijos_hist' THEN p->'costos_fijos_hist' ELSE costos_fijos_hist END,
    equipo = CASE WHEN p ? 'equipo' THEN p->'equipo' ELSE equipo END,
    metas_hist = CASE WHEN p ? 'metas_hist' THEN p->'metas_hist' ELSE metas_hist END,
    updated_at = NOW()
  WHERE id = (SELECT id FROM configuracion ORDER BY id LIMIT 1)
  RETURNING * INTO v_fila;
  RETURN jsonb_build_object('ok', TRUE, 'data', to_jsonb(v_fila));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. PERMISOS DE EJECUCIÓN (C-07): nada para anon, solo usuarios autenticados
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE f TEXT;
BEGIN
  -- Internas: nadie las llama desde la app
  FOREACH f IN ARRAY ARRAY[
    'arj_exigir_usuario(boolean, text)', 'arj_siguiente_correlativo(text, integer)'
  ] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || f || ' FROM PUBLIC, anon, authenticated';
  END LOOP;

  -- Expuestas a la app (validan el perfil por dentro)
  FOREACH f IN ARRAY ARRAY[
    'emitir_factura_atomica(jsonb, jsonb, jsonb)', 'anular_factura_atomica(integer, text)',
    'registrar_abono_atomico(integer, numeric, jsonb)', 'aplicar_traspaso(jsonb, text)',
    'aplicar_recepcion(text, text, uuid, text, jsonb, jsonb)', 'guardar_cotizacion(jsonb, jsonb)',
    'cambiar_estado_cotizacion(integer, text)', 'crear_cliente(jsonb, jsonb)', 'guardar_producto(jsonb)',
    'desactivar_producto(integer)', 'guardar_embarque(jsonb)', 'recalcular_embarque(uuid)',
    'registrar_movimiento_caja(jsonb)', 'anular_movimiento_caja(integer, text)',
    'confirmar_tasas(numeric, numeric)', 'actualizar_configuracion(jsonb)'
  ] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || f || ' FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || f || ' TO authenticated';
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. (OPCIONAL, revisar antes) Tabla `usuarios` con contraseñas en texto plano
-- No la usa ni el monolito v13 ni Vue (ambos usan Supabase Auth + perfiles).
-- Descomentar para eliminarla:
-- DROP TABLE IF EXISTS usuarios;
-- ─────────────────────────────────────────────────────────────────────────────

-- ==============================================================================
-- VERIFICACIÓN (correr después y revisar el resultado)
-- ==============================================================================
-- a) Funciones instaladas y quién puede ejecutarlas (anon NO debe aparecer):
-- SELECT p.proname, r.rolname
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
-- JOIN pg_roles r ON r.oid = a.grantee
-- WHERE n.nspname = 'public' AND (p.proname LIKE 'arj_%' OR p.proname IN (
--   'emitir_factura_atomica','anular_factura_atomica','registrar_abono_atomico','aplicar_traspaso',
--   'aplicar_recepcion','guardar_cotizacion','crear_cliente','guardar_producto','confirmar_tasas'))
-- ORDER BY 1, 2;
--
-- b) Tablas SIN RLS activado (idealmente ninguna):
-- SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
--
-- c) Políticas existentes:
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY 1;
--
-- d) Índices únicos de documentos:
-- SELECT indexname FROM pg_indexes WHERE indexname LIKE '%_numero_unique_idx';
--
-- e) Contadores:
-- SELECT * FROM contadores ORDER BY tipo;
