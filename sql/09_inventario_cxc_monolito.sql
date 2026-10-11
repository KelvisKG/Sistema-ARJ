-- ==============================================================================
-- SISTEMA ARJ · 09 — FUNCIONES QUE FALTABAN PARA IGUALAR EL MONOLITO (10-oct-2026)
--
-- JJ pidió que Inventario y Cuentas por Cobrar se comporten igual que en el
-- monolito v13. Desde el 07 la app Vue no puede escribir directo en las tablas,
-- así que cada acción del monolito que escribía directo necesita su función:
--
--   1. guardar_producto: ahora también guarda las fotos (`imagen_url`, hasta 3
--      URLs separadas por "|", igual que el monolito). Resto igual que el 06.
--   2. crear_sistema: el botón "+" junto a "Sistema" en la ficha del producto.
--   3. eliminar_producto: el botón de papelera del inventario. Si el producto
--      nunca se facturó se borra; si ya está en facturas solo se desactiva
--      (el histórico fiscal no se toca). Lo decide el servidor, no la pantalla.
--   4. emitir_nota_credito: el botón "Nota de crédito" de Cuentas por Cobrar.
--      Misma lógica del monolito (v13.8 / v13.33), pero en una sola transacción:
--      stock de vuelta, pago negativo con el detalle, saldo de la factura, saldo
--      del cliente y, si se devuelve efectivo, la salida de caja.
--   5. Almacenamiento de fotos: bucket `productos-img` (el mismo del monolito).
--
-- Aplicar en desarrollo y en producción después del 08. Idempotente.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PRODUCTOS: versión del 06 + fotos
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
      sistema, precio_manual, activo, origen, factor_landed, proveedor, imagen_url)
    VALUES (UPPER(TRIM(p->>'cod_alt')), TRIM(COALESCE(p->>'cod_orig', '')), TRIM(COALESCE(p->>'cod_barras', '')),
      TRIM(p->>'descripcion'), TRIM(COALESCE(p->>'marca', '')), COALESCE(NULLIF(p->>'fob', '')::NUMERIC, 0),
      COALESCE(NULLIF(p->>'stock_vd', '')::INT, 0), COALESCE(NULLIF(p->>'stock_dist', '')::INT, 0),
      TRIM(COALESCE(p->>'marca_modelo', '')), TRIM(COALESCE(p->>'sistema', '')), NULLIF(p->>'precio_manual', '')::NUMERIC,
      TRUE, COALESCE(NULLIF(p->>'origen', ''), 'importado'), NULLIF(p->>'factor_landed', '')::NUMERIC,
      TRIM(COALESCE(p->>'proveedor', '')), NULLIF(p->>'imagen_url', ''))
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
      -- Las fotos solo cambian si la pantalla las manda (quitar todas = "")
      imagen_url = CASE WHEN p ? 'imagen_url' THEN NULLIF(p->>'imagen_url', '') ELSE imagen_url END,
      updated_at = NOW()
    WHERE id = v_id
    RETURNING * INTO v_fila;
  END IF;
  RETURN jsonb_build_object('ok', TRUE, 'data', to_jsonb(v_fila));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SISTEMAS: el gerente agrega uno nuevo al final de la lista (monolito v13.3)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crear_sistema(p_nombre TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nombre TEXT := TRIM(COALESCE(p_nombre, ''));
BEGIN
  PERFORM arj_exigir_usuario(TRUE);
  IF v_nombre = '' THEN RAISE EXCEPTION 'ARJ: el nombre del sistema es obligatorio'; END IF;
  IF EXISTS (SELECT 1 FROM sistemas WHERE LOWER(nombre) = LOWER(v_nombre)) THEN
    RAISE EXCEPTION 'ARJ: ese sistema ya existe';
  END IF;
  INSERT INTO sistemas (nombre, orden)
  VALUES (v_nombre, COALESCE((SELECT MAX(orden) FROM sistemas), 0) + 1);
  RETURN jsonb_build_object('ok', TRUE, 'nombre', v_nombre);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ELIMINAR PRODUCTO (monolito eliminarProducto)
-- p_definitivo = TRUE: la pantalla vio 0 facturas y el gerente confirmó el borrado.
-- El servidor vuelve a contar: si mientras tanto se facturó, NO se borra.
-- Si otra tabla todavía lo referencia (recepción, nota de entrega), se desactiva.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION eliminar_producto(p_id INT, p_definitivo BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p productos;
  v_veces INT;
BEGIN
  PERFORM arj_exigir_usuario(TRUE);
  SELECT * INTO v_p FROM productos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: producto no encontrado'; END IF;
  SELECT COUNT(*) INTO v_veces FROM factura_items WHERE producto_id = p_id;

  IF p_definitivo THEN
    IF v_veces > 0 THEN
      RAISE EXCEPTION 'ARJ: % aparece en % factura(s) y no se puede borrar. Vuelve a intentarlo para desactivarlo.',
        v_p.cod_alt, v_veces;
    END IF;
    BEGIN
      DELETE FROM productos WHERE id = p_id;
      RETURN jsonb_build_object('ok', TRUE, 'accion', 'eliminado', 'veces', 0);
    EXCEPTION WHEN foreign_key_violation THEN
      UPDATE productos SET activo = FALSE, updated_at = NOW() WHERE id = p_id;
      RETURN jsonb_build_object('ok', TRUE, 'accion', 'desactivado', 'veces', 0,
        'nota', 'tiene recepciones o notas de entrega: se desactivó en vez de borrarlo');
    END;
  END IF;

  UPDATE productos SET activo = FALSE, updated_at = NOW() WHERE id = p_id;
  RETURN jsonb_build_object('ok', TRUE, 'accion', 'desactivado', 'veces', v_veces);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. NOTA DE CRÉDITO (monolito v13.8 / v13.33)
-- p_items: [{cod_alt, cantidad}] — unidades que devuelve el cliente
-- p_destino: 'favor' | 'efectivo' — solo cuenta si sobra crédito después de
--            cancelar el saldo pendiente de la factura
--
-- · El crédito se valora a los precios de la factura ($BCV).
-- · pagos.monto_usd es $verde: se registra el crédito convertido a la brecha
--   del día (× tasa_bcv / tasa_par), igual que el monolito.
-- · La referencia lleva "NC:COD=cant;COD=cant| motivo" para que una nota futura
--   sobre la misma factura sepa cuánto ya se devolvió de cada renglón.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION emitir_nota_credito(p_factura_id INT, p_items JSONB, p_motivo TEXT, p_destino TEXT DEFAULT 'favor')
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perfil perfiles;
  v_cfg configuracion;
  v_f facturas;
  v_item JSONB;
  v_cod TEXT;
  v_cant INT;
  v_fact INT;
  v_ya INT;
  v_precio NUMERIC;
  v_prod INT;
  v_tot NUMERIC := 0;
  v_unidades INT := 0;
  v_detalle TEXT := '';
  v_verde NUMERIC;
  v_saldo NUMERIC;
  v_aplica NUMERIC;
  v_sobra NUMERIC;
  v_destino TEXT;
  v_baja NUMERIC;
  v_sob_verde NUMERIC := 0;
  v_pago RECORD;
  v_par TEXT;
  v_ya_dev JSONB := '{}'::JSONB;
BEGIN
  v_perfil := arj_exigir_usuario(TRUE);
  IF COALESCE(TRIM(p_motivo), '') = '' THEN RAISE EXCEPTION 'ARJ: indica el motivo de la devolución'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'ARJ: indica cuántas unidades devuelve el cliente'; END IF;

  SELECT * INTO v_f FROM facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: factura no encontrada'; END IF;
  IF v_f.estado = 'anulada' THEN RAISE EXCEPTION 'ARJ: no se puede acreditar una factura anulada'; END IF;

  SELECT * INTO v_cfg FROM configuracion ORDER BY id LIMIT 1;
  IF COALESCE(v_cfg.tasa_bcv, 0) <= 0 OR COALESCE(v_cfg.tasa_par, 0) <= 0 THEN
    RAISE EXCEPTION 'ARJ: faltan las tasas de cambio';
  END IF;

  -- Lo ya devuelto en notas anteriores sobre esta factura
  FOR v_pago IN SELECT referencia FROM pagos WHERE factura_id = v_f.id AND referencia LIKE 'NC:%' LOOP
    FOREACH v_par IN ARRAY string_to_array(split_part(substr(v_pago.referencia, 4), '|', 1), ';') LOOP
      IF split_part(v_par, '=', 1) <> '' THEN
        v_ya_dev := jsonb_set(v_ya_dev, ARRAY[split_part(v_par, '=', 1)],
          to_jsonb(COALESCE((v_ya_dev->>split_part(v_par, '=', 1))::INT, 0)
                   + COALESCE(NULLIF(regexp_replace(split_part(v_par, '=', 2), '\D', '', 'g'), '')::INT, 0)));
      END IF;
    END LOOP;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cod := TRIM(COALESCE(v_item->>'cod_alt', ''));
    v_cant := COALESCE(NULLIF(v_item->>'cantidad', '')::INT, 0);
    IF v_cant <= 0 THEN CONTINUE; END IF;

    -- Precio de la factura (si el código está en dos renglones, el promedio ponderado)
    SELECT COALESCE(SUM(cantidad), 0), SUM(precio_unitario * cantidad) / NULLIF(SUM(cantidad), 0), MAX(producto_id)
      INTO v_fact, v_precio, v_prod
    FROM factura_items WHERE factura_id = v_f.id AND cod_alt = v_cod;
    IF v_fact = 0 THEN RAISE EXCEPTION 'ARJ: % no está en la factura %', v_cod, v_f.numero; END IF;
    v_ya := COALESCE((v_ya_dev->>v_cod)::INT, 0);
    IF v_cant > v_fact - v_ya THEN
      RAISE EXCEPTION 'ARJ: de % solo quedan % por devolver (facturado %, ya devuelto %)', v_cod, v_fact - v_ya, v_fact, v_ya;
    END IF;

    -- Stock de vuelta al almacén de la empresa DE LA FACTURA
    IF v_f.empresa = 'directa' THEN
      UPDATE productos SET stock_vd = COALESCE(stock_vd, 0) + v_cant
      WHERE id = v_prod OR (v_prod IS NULL AND cod_alt = v_cod);
    ELSE
      UPDATE productos SET stock_dist = COALESCE(stock_dist, 0) + v_cant
      WHERE id = v_prod OR (v_prod IS NULL AND cod_alt = v_cod);
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: no se pudo devolver el stock de %', v_cod; END IF;

    -- Si el mismo código viene en dos renglones de la nota, el segundo ve lo del primero
    v_ya_dev := jsonb_set(v_ya_dev, ARRAY[v_cod], to_jsonb(v_ya + v_cant));
    v_tot := v_tot + v_cant * COALESCE(v_precio, 0);
    v_unidades := v_unidades + v_cant;
    v_detalle := v_detalle || CASE WHEN v_detalle = '' THEN '' ELSE ';' END || v_cod || '=' || v_cant;
  END LOOP;

  IF v_unidades = 0 THEN RAISE EXCEPTION 'ARJ: indica cuántas unidades devuelve el cliente'; END IF;
  v_tot := ROUND(v_tot, 2);

  -- El crédito primero cancela lo que el cliente aún debe; el sobrante va al destino
  v_saldo := COALESCE(v_f.saldo_pendiente, 0);
  v_aplica := LEAST(v_tot, v_saldo);
  v_sobra := v_tot - v_aplica;
  v_destino := CASE WHEN v_sobra > 0.009 AND p_destino = 'efectivo' THEN 'efectivo' ELSE 'favor' END;

  v_verde := ROUND(v_tot * v_cfg.tasa_bcv / v_cfg.tasa_par, 2);
  INSERT INTO pagos (factura_id, fecha, monto_usd, monto_bs, tasa_usada, metodo, referencia, registrado_por, notas)
  VALUES (v_f.id, NOW(), -v_verde, -ROUND(v_verde * v_cfg.tasa_par, 2), v_cfg.tasa_par, 'Nota de crédito',
    'NC:' || v_detalle || '| ' || TRIM(p_motivo), v_perfil.nombre_display, 'Crédito $' || v_tot || ' BCV');

  UPDATE facturas SET
    saldo_pendiente = GREATEST(0, ROUND(v_saldo - v_aplica, 2)),
    estado = CASE WHEN GREATEST(0, v_saldo - v_aplica) < 0.01 THEN 'pagada' ELSE estado END
  WHERE id = v_f.id;

  -- Saldo global del cliente. "A favor" puede dejarlo en negativo: es un anticipo.
  IF v_f.cliente_id IS NOT NULL THEN
    v_baja := CASE WHEN v_destino = 'favor' THEN v_tot ELSE v_aplica END;
    IF v_f.empresa = 'directa' THEN
      UPDATE clientes SET saldo_vd = COALESCE(saldo_vd, 0) - v_baja WHERE id = v_f.cliente_id;
    ELSE
      UPDATE clientes SET saldo_dist = COALESCE(saldo_dist, 0) - v_baja WHERE id = v_f.cliente_id;
    END IF;
  END IF;

  -- Efectivo devuelto: sale de caja y se ve en Movimientos (en $verde)
  IF v_destino = 'efectivo' THEN
    v_sob_verde := ROUND(v_sobra * v_cfg.tasa_bcv / v_cfg.tasa_par, 2);
    INSERT INTO movimientos_caja (fecha, tipo, empresa, categoria, clasificacion, concepto, monto_usd, monto_bs,
      tasa_usada, moneda_origen, metodo, afecta_caja, estado, registrado_por, tasa_bcv_ref)
    VALUES (NOW(), 'salida', arj_empresa_norm(v_f.empresa), 'Devolución a cliente', 'no_gasto',
      'Devolución por nota de crédito ' || v_f.numero, v_sob_verde, ROUND(v_sob_verde * v_cfg.tasa_par, 2),
      v_cfg.tasa_par, 'USD', 'Efectivo USD', TRUE, 'activo', v_perfil.nombre_display, v_cfg.tasa_bcv);
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'total', v_tot, 'unidades', v_unidades, 'detalle', v_detalle,
    'aplica_saldo', v_aplica, 'sobrante', v_sobra, 'destino', v_destino, 'efectivo_verde', v_sob_verde,
    'saldo_pendiente', GREATEST(0, ROUND(v_saldo - v_aplica, 2)));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

-- ─── Permisos ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION guardar_producto(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION guardar_producto(JSONB) TO authenticated;
REVOKE ALL ON FUNCTION crear_sistema(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crear_sistema(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION eliminar_producto(INT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION eliminar_producto(INT, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION emitir_nota_credito(INT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION emitir_nota_credito(INT, JSONB, TEXT, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. FOTOS DE PRODUCTOS (Storage)
-- En producción el bucket ya existe (lo usa el monolito). En desarrollo se crea.
-- Lectura pública (las fotos se muestran con su URL); subir solo con sesión.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('productos-img', 'productos-img', TRUE)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'arj_productos_img_subir') THEN
    CREATE POLICY arj_productos_img_subir ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'productos-img');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'arj_productos_img_leer') THEN
    CREATE POLICY arj_productos_img_leer ON storage.objects FOR SELECT
      USING (bucket_id = 'productos-img');
  END IF;
END $$;

-- Verificación:
-- SELECT proname FROM pg_proc WHERE proname IN ('crear_sistema', 'eliminar_producto', 'emitir_nota_credito');
-- SELECT id, public FROM storage.buckets WHERE id = 'productos-img';
