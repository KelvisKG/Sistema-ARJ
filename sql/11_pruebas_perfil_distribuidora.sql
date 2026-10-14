-- ==============================================================================
-- SISTEMA ARJ · PRUEBAS DEL 11 (PERFIL DISTRIBUIDORA) — SOLO DESARROLLO
--
-- Correr completo en el SQL Editor de Supabase DESPUÉS del 11. Devuelve una
-- tabla con cada prueba y PASÓ / FALLÓ.
--
-- No deja rastro: crea usuarios ficticios (gerente, vendedor de ARJ y dos
-- distribuidoras), actúa como cada uno (igual que cuando entran por la app: rol
-- `authenticated` + su id en el token) y al final DESHACE todo: usuarios,
-- clientes, facturas, pagos, stock, alertas y la confirmación de tasas.
-- ==============================================================================

CREATE OR REPLACE FUNCTION pg_temp.arj_probar_distribuidora()
RETURNS TABLE (n INT, prueba TEXT, resultado TEXT, detalle TEXT)
LANGUAGE plpgsql AS $$
DECLARE
  res JSONB := '[]';
  v_g  UUID := gen_random_uuid();   -- gerente
  v_v  UUID := gen_random_uuid();   -- vendedor de ARJ que opera en Distribuidora
  v_d1 UUID := gen_random_uuid();   -- distribuidora 1
  v_d2 UUID := gen_random_uuid();   -- distribuidora 2
  v_yo UUID;
  v_cfg configuracion;
  v_imp productos;
  v_loc productos;
  v_cli_arj clientes;
  v_precio NUMERIC;
  v_precio_loc NUMERIC;
  v_r JSONB;
  v_cli_d1 INT;
  v_fac_d1 INT;
  v_fac_arj INT;
  v_n BIGINT;
  v_m BIGINT;
  v_t TEXT;
  v_denegado CONSTANT TEXT := 'No tienes permiso%';
  v_abono JSONB;
BEGIN
  BEGIN  -- ═══ todo lo de este bloque se deshace al final ═══

    -- ─── Preparación (como administrador) ───────────────────────────────────
    INSERT INTO auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    SELECT '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
           'prueba-' || u || '@arj.test', NOW(), NOW()
    FROM unnest(ARRAY[v_g, v_v, v_d1, v_d2]) AS u;
    INSERT INTO perfiles (id, rol, empresa, nombre_display, activo, es_distribuidora) VALUES
      (v_g,  'gerente',  'ambas', 'PRUEBA Gerente',         TRUE, FALSE),
      (v_v,  'vendedor', 'dist',  'PRUEBA Vendedor ARJ',    TRUE, FALSE),
      (v_d1, 'vendedor', 'dist',  'PRUEBA Distribuidora 1', TRUE, TRUE),
      (v_d2, 'vendedor', 'dist',  'PRUEBA Distribuidora 2', TRUE, TRUE);

    -- Tasas confirmadas hoy (si no, no se puede facturar ni abonar)
    UPDATE configuracion SET tasas_actualizadas = NOW(),
      tasa_bcv = CASE WHEN COALESCE(tasa_bcv, 0) > 0 THEN tasa_bcv ELSE 100 END,
      tasa_par = CASE WHEN COALESCE(tasa_par, 0) > 0 THEN tasa_par ELSE 120 END
    WHERE id = (SELECT id FROM configuracion ORDER BY id LIMIT 1);
    SELECT * INTO v_cfg FROM configuracion ORDER BY id LIMIT 1;

    SELECT * INTO v_imp FROM productos
    WHERE COALESCE(activo, TRUE) AND fob > 0 AND arj_origen_producto(origen, factor_landed) = 'importado'
    ORDER BY id LIMIT 1;
    SELECT * INTO v_loc FROM productos
    WHERE COALESCE(activo, TRUE) AND fob > 0 AND arj_origen_producto(origen, factor_landed) = 'local'
    ORDER BY id LIMIT 1;
    IF v_loc.id IS NULL THEN   -- sin productos locales en desarrollo: se marca uno (se deshace)
      UPDATE productos SET origen = 'local'
      WHERE id = (SELECT id FROM productos WHERE COALESCE(activo, TRUE) AND fob > 0 AND id <> v_imp.id ORDER BY id LIMIT 1)
      RETURNING * INTO v_loc;
    END IF;
    SELECT * INTO v_cli_arj FROM clientes
    WHERE propietario IS NULL AND COALESCE(activo, TRUE) AND arj_rif_norm(rif) IS NOT NULL ORDER BY id LIMIT 1;
    v_precio := arj_precio_lista(v_imp.fob, v_imp.precio_manual, 'Publico');
    v_precio_loc := arj_precio_lista(v_loc.fob, v_loc.precio_manual, 'Publico');

    IF v_imp.id IS NULL OR v_loc.id IS NULL OR v_cli_arj.id IS NULL THEN
      RAISE EXCEPTION 'Faltan datos de ejemplo: un producto importado, otro producto y un cliente de ARJ con RIF';
    END IF;

    -- Factura de ARJ hecha por el gerente (cliente de ARJ, a crédito)
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_g::TEXT, TRUE);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_g, 'role', 'authenticated')::TEXT, TRUE);
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_r := emitir_factura_atomica(
      jsonb_build_object('empresa', 'distribuidora', 'cliente_id', v_cli_arj.id, 'cliente_nombre', v_cli_arj.nombre,
        'tipo_pago', 'credito', 'dias_credito', 30, 'subtotal_usd', v_precio, 'saldo_pendiente', v_precio,
        'tasa_bcv', v_cfg.tasa_bcv, 'tasa_par', v_cfg.tasa_par, 'factor_bs', 1),
      jsonb_build_array(jsonb_build_object('producto_id', v_imp.id, 'cod_alt', v_imp.cod_alt, 'cantidad', 1, 'precio_unitario', v_precio)),
      '[]'::JSONB);
    v_fac_arj := (v_r->'data'->>'id')::INT;
    res := res || jsonb_build_object('p', 'Gerente: emite factura de ARJ (queda sin dueño)',
      'ok', (v_r->>'ok')::BOOLEAN AND v_r->'data'->>'propietario' IS NULL, 'd', COALESCE(v_r->>'error', v_r->'data'->>'numero'));

    v_abono := jsonb_build_object('metodo', 'Efectivo Bs', 'monto_bs', CEIL(v_cfg.tasa_bcv) + 1);

    -- ─── DISTRIBUIDORA 1 ────────────────────────────────────────────────────
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_d1::TEXT, TRUE);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_d1, 'role', 'authenticated')::TEXT, TRUE);
    EXECUTE 'SET LOCAL ROLE authenticated';

    v_r := crear_cliente(jsonb_build_object('nombre', 'PRUEBA CLIENTE DE D1', 'rif', v_cli_arj.rif), NULL);
    v_cli_d1 := (v_r->'data'->>'id')::INT;
    res := res || jsonb_build_object('p', 'D1: registra un cliente propio (aunque ARJ tenga ese RIF)',
      'ok', (v_r->>'ok')::BOOLEAN AND v_r->'data'->>'propietario' = v_d1::TEXT, 'd', v_r->>'error');

    v_r := crear_cliente(jsonb_build_object('nombre', 'PRUEBA CLIENTE REPETIDO', 'rif', v_cli_arj.rif), NULL);
    res := res || jsonb_build_object('p', 'D1: no puede repetir un RIF dentro de su propia cartera',
      'ok', NOT (v_r->>'ok')::BOOLEAN AND v_r->>'error' LIKE '%ya existe%', 'd', v_r->>'error');

    v_r := emitir_factura_atomica(
      jsonb_build_object('empresa', 'distribuidora', 'cliente_id', v_cli_d1, 'cliente_nombre', 'PRUEBA CLIENTE DE D1',
        'tipo_pago', 'credito', 'dias_credito', 30, 'subtotal_usd', v_precio, 'saldo_pendiente', v_precio,
        'tasa_bcv', v_cfg.tasa_bcv, 'tasa_par', v_cfg.tasa_par, 'factor_bs', 1),
      jsonb_build_array(jsonb_build_object('producto_id', v_imp.id, 'cod_alt', v_imp.cod_alt, 'cantidad', 1, 'precio_unitario', v_precio)),
      '[]'::JSONB);
    v_fac_d1 := (v_r->'data'->>'id')::INT;
    res := res || jsonb_build_object('p', 'D1: factura un importado a su cliente (queda como suya)',
      'ok', (v_r->>'ok')::BOOLEAN AND v_r->'data'->>'propietario' = v_d1::TEXT, 'd', COALESCE(v_r->>'error', v_r->'data'->>'numero'));

    v_r := emitir_factura_atomica(
      jsonb_build_object('empresa', 'distribuidora', 'cliente_id', v_cli_d1, 'cliente_nombre', 'PRUEBA CLIENTE DE D1',
        'tipo_pago', 'credito', 'dias_credito', 30,
        'subtotal_usd', v_precio_loc,
        'saldo_pendiente', v_precio_loc,
        'tasa_bcv', v_cfg.tasa_bcv, 'tasa_par', v_cfg.tasa_par, 'factor_bs', 1),
      jsonb_build_array(jsonb_build_object('producto_id', v_loc.id, 'cod_alt', v_loc.cod_alt, 'cantidad', 1,
        'precio_unitario', v_precio_loc)),
      '[]'::JSONB);
    res := res || jsonb_build_object('p', 'D1: NO puede facturar un producto local',
      'ok', v_r->>'error' LIKE v_denegado, 'd', v_r->>'error');

    v_r := emitir_factura_atomica(
      jsonb_build_object('empresa', 'distribuidora', 'cliente_id', v_cli_arj.id, 'cliente_nombre', v_cli_arj.nombre,
        'tipo_pago', 'credito', 'dias_credito', 30, 'subtotal_usd', v_precio, 'saldo_pendiente', v_precio,
        'tasa_bcv', v_cfg.tasa_bcv, 'tasa_par', v_cfg.tasa_par, 'factor_bs', 1),
      jsonb_build_array(jsonb_build_object('producto_id', v_imp.id, 'cod_alt', v_imp.cod_alt, 'cantidad', 1, 'precio_unitario', v_precio)),
      '[]'::JSONB);
    res := res || jsonb_build_object('p', 'D1: NO puede facturarle a un cliente de ARJ',
      'ok', v_r->>'error' LIKE v_denegado, 'd', v_r->>'error');

    v_r := emitir_factura_atomica(
      jsonb_build_object('empresa', 'directa', 'cliente_id', v_cli_d1, 'cliente_nombre', 'PRUEBA CLIENTE DE D1',
        'tipo_pago', 'credito', 'dias_credito', 30, 'subtotal_usd', v_precio, 'saldo_pendiente', v_precio,
        'tasa_bcv', v_cfg.tasa_bcv, 'tasa_par', v_cfg.tasa_par, 'factor_bs', 1),
      jsonb_build_array(jsonb_build_object('producto_id', v_imp.id, 'cod_alt', v_imp.cod_alt, 'cantidad', 1, 'precio_unitario', v_precio)),
      '[]'::JSONB);
    res := res || jsonb_build_object('p', 'D1: NO puede facturar en Venta Directa',
      'ok', NOT (v_r->>'ok')::BOOLEAN, 'd', v_r->>'error');

    -- Se manda el mismo nivel que ya tiene: si no, lo frena antes la regla de "solo el gerente cambia niveles"
    v_r := actualizar_cliente(v_cli_arj.id::INT, jsonb_build_object('nombre', 'CAMBIADO POR D1', 'rif', v_cli_arj.rif,
      'nivel', COALESCE(v_cli_arj.nivel, 'Publico')));
    res := res || jsonb_build_object('p', 'D1: NO puede modificar un cliente de ARJ',
      'ok', v_r->>'error' LIKE v_denegado, 'd', v_r->>'error');

    v_r := registrar_abono_atomico(v_fac_arj, 1, v_abono);
    res := res || jsonb_build_object('p', 'D1: NO puede abonar a una factura de ARJ',
      'ok', v_r->>'error' LIKE v_denegado, 'd', v_r->>'error');

    v_r := registrar_abono_atomico(v_fac_d1, 1, v_abono);
    res := res || jsonb_build_object('p', 'D1: SÍ abona a su propia factura',
      'ok', (v_r->>'ok')::BOOLEAN, 'd', COALESCE(v_r->>'error', 'saldo ' || (v_r->>'saldo_pendiente')));

    v_r := guardar_cotizacion(
      jsonb_build_object('empresa', 'distribuidora', 'cliente_id', v_cli_d1, 'cliente_nombre', 'PRUEBA CLIENTE DE D1'),
      jsonb_build_array(jsonb_build_object('producto_id', v_imp.id, 'cod_alt', v_imp.cod_alt, 'cantidad', 1, 'precio_unitario', v_precio)));
    SELECT propietario::TEXT INTO v_t FROM cotizaciones WHERE id = (v_r->>'id')::INT;
    res := res || jsonb_build_object('p', 'D1: cotiza a su cliente (queda como suya)',
      'ok', (v_r->>'ok')::BOOLEAN AND v_t = v_d1::TEXT, 'd', COALESCE(v_r->>'error', v_r->>'numero'));

    v_r := guardar_cotizacion(
      jsonb_build_object('empresa', 'distribuidora', 'cliente_id', v_cli_d1, 'cliente_nombre', 'PRUEBA CLIENTE DE D1'),
      jsonb_build_array(jsonb_build_object('producto_id', v_loc.id, 'cod_alt', v_loc.cod_alt, 'cantidad', 1,
        'precio_unitario', v_precio_loc)));
    res := res || jsonb_build_object('p', 'D1: NO puede cotizar un producto local',
      'ok', v_r->>'error' LIKE v_denegado, 'd', v_r->>'error');

    -- Lecturas
    SELECT COUNT(*) FILTER (WHERE propietario IS DISTINCT FROM v_d1), COUNT(*) FILTER (WHERE propietario = v_d1) INTO v_n, v_m FROM facturas;
    res := res || jsonb_build_object('p', 'D1 ve: solo sus facturas', 'ok', v_n = 0 AND v_m >= 1, 'd', v_m || ' suyas, ' || v_n || ' ajenas');
    SELECT COUNT(*) FILTER (WHERE propietario IS DISTINCT FROM v_d1), COUNT(*) FILTER (WHERE propietario = v_d1) INTO v_n, v_m FROM clientes;
    res := res || jsonb_build_object('p', 'D1 ve: solo sus clientes', 'ok', v_n = 0 AND v_m >= 1, 'd', v_m || ' suyos, ' || v_n || ' ajenos');
    SELECT COUNT(*) FILTER (WHERE propietario IS DISTINCT FROM v_d1) INTO v_n FROM cotizaciones;
    res := res || jsonb_build_object('p', 'D1 ve: solo sus cotizaciones', 'ok', v_n = 0, 'd', v_n || ' ajenas');
    SELECT COUNT(*) INTO v_n FROM pagos WHERE factura_id IS NULL OR factura_id NOT IN (v_fac_d1);
    SELECT COUNT(*) INTO v_m FROM pagos WHERE factura_id = v_fac_d1;
    res := res || jsonb_build_object('p', 'D1 ve: solo los pagos de sus facturas', 'ok', v_n = 0 AND v_m >= 1, 'd', v_m || ' suyos, ' || v_n || ' ajenos');
    SELECT COUNT(*) INTO v_n FROM factura_items WHERE factura_id <> v_fac_d1;
    res := res || jsonb_build_object('p', 'D1 ve: solo los renglones de sus facturas', 'ok', v_n = 0, 'd', v_n || ' ajenos');
    SELECT COUNT(*) FILTER (WHERE arj_origen_producto(origen, factor_landed) = 'local'),
           COUNT(*) FILTER (WHERE arj_origen_producto(origen, factor_landed) = 'importado') INTO v_n, v_m FROM productos;
    res := res || jsonb_build_object('p', 'D1 ve: solo productos importados', 'ok', v_n = 0 AND v_m > 0, 'd', v_m || ' importados, ' || v_n || ' locales');
    SELECT COUNT(*) INTO v_n FROM perfiles;
    res := res || jsonb_build_object('p', 'D1 ve: solo su propio perfil', 'ok', v_n = 1, 'd', v_n || ' perfiles');
    FOREACH v_t IN ARRAY ARRAY['embarques', 'recepciones', 'recepcion_items', 'traspasos', 'traspaso_items',
                               'movimientos_caja', 'bitacora', 'contadores'] LOOP
      CONTINUE WHEN to_regclass('public.' || v_t) IS NULL;
      BEGIN
        EXECUTE format('SELECT COUNT(*) FROM %I', v_t) INTO v_n;
      EXCEPTION WHEN insufficient_privilege THEN v_n := 0;
      END;
      res := res || jsonb_build_object('p', 'D1 NO ve: ' || v_t, 'ok', v_n = 0, 'd', v_n || ' filas');
    END LOOP;

    -- Escrituras directas (saltándose las funciones del servidor)
    BEGIN
      UPDATE productos SET stock_dist = COALESCE(stock_dist, 0) + 100 WHERE id = v_imp.id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_t := v_n || ' filas modificadas';
    EXCEPTION WHEN OTHERS THEN v_n := 0; v_t := SQLERRM;
    END;
    res := res || jsonb_build_object('p', 'D1: NO puede cambiar el stock directo en la tabla', 'ok', v_n = 0, 'd', v_t);
    BEGIN
      UPDATE facturas SET saldo_pendiente = 0 WHERE id = v_fac_d1;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_t := v_n || ' filas modificadas';
    EXCEPTION WHEN OTHERS THEN v_n := 0; v_t := SQLERRM;
    END;
    res := res || jsonb_build_object('p', 'D1: NO puede borrar su deuda directo en la tabla', 'ok', v_n = 0, 'd', v_t);

    -- ─── DISTRIBUIDORA 2 ────────────────────────────────────────────────────
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_d2::TEXT, TRUE);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_d2, 'role', 'authenticated')::TEXT, TRUE);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT (SELECT COUNT(*) FROM facturas) + (SELECT COUNT(*) FROM clientes) + (SELECT COUNT(*) FROM cotizaciones) INTO v_n;
    res := res || jsonb_build_object('p', 'D2 NO ve nada de D1 ni de ARJ', 'ok', v_n = 0, 'd', v_n || ' filas visibles');
    v_r := registrar_abono_atomico(v_fac_d1, 1, v_abono);
    res := res || jsonb_build_object('p', 'D2: NO puede abonar a una factura de D1',
      'ok', v_r->>'error' LIKE v_denegado, 'd', v_r->>'error');

    -- ─── VENDEDOR DE ARJ (opera en Distribuidora, no es distribuidora externa) ─
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_v::TEXT, TRUE);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_v, 'role', 'authenticated')::TEXT, TRUE);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT COUNT(*) INTO v_n FROM facturas WHERE propietario IS NOT NULL;
    SELECT COUNT(*) INTO v_m FROM facturas WHERE id = v_fac_arj;
    res := res || jsonb_build_object('p', 'Vendedor ARJ: ve las facturas de ARJ y no las de distribuidoras',
      'ok', v_n = 0 AND v_m = 1, 'd', v_n || ' de distribuidoras');
    SELECT COUNT(*) INTO v_n FROM clientes WHERE propietario IS NOT NULL;
    res := res || jsonb_build_object('p', 'Vendedor ARJ: no ve clientes de distribuidoras', 'ok', v_n = 0, 'd', v_n || ' visibles');
    SELECT COUNT(*) INTO v_n FROM productos WHERE id = v_loc.id;
    res := res || jsonb_build_object('p', 'Vendedor ARJ: sigue viendo los productos locales', 'ok', v_n = 1, 'd', NULL);
    v_r := emitir_factura_atomica(
      jsonb_build_object('empresa', 'distribuidora', 'cliente_id', v_cli_d1, 'cliente_nombre', 'PRUEBA CLIENTE DE D1',
        'tipo_pago', 'credito', 'dias_credito', 30, 'subtotal_usd', v_precio, 'saldo_pendiente', v_precio,
        'tasa_bcv', v_cfg.tasa_bcv, 'tasa_par', v_cfg.tasa_par, 'factor_bs', 1),
      jsonb_build_array(jsonb_build_object('producto_id', v_imp.id, 'cod_alt', v_imp.cod_alt, 'cantidad', 1, 'precio_unitario', v_precio)),
      '[]'::JSONB);
    res := res || jsonb_build_object('p', 'Vendedor ARJ: NO puede facturarle a un cliente de D1',
      'ok', v_r->>'error' LIKE v_denegado, 'd', v_r->>'error');

    -- ─── GERENTE ────────────────────────────────────────────────────────────
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', v_g::TEXT, TRUE);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_g, 'role', 'authenticated')::TEXT, TRUE);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT COUNT(*) INTO v_n FROM facturas WHERE id IN (v_fac_d1, v_fac_arj);
    SELECT COUNT(*) INTO v_m FROM clientes WHERE id = v_cli_d1;
    res := res || jsonb_build_object('p', 'Gerente: ve todo (ARJ y distribuidoras)', 'ok', v_n = 2 AND v_m = 1, 'd', NULL);
    SELECT COUNT(*) INTO v_n FROM bitacora WHERE accion = 'seguridad' AND critico AND usuario LIKE 'PRUEBA %';
    res := res || jsonb_build_object('p', 'Gerente: los intentos bloqueados quedaron como ALERTA en la bitácora',
      'ok', v_n >= 7, 'd', v_n || ' alertas (se esperan 7)');

    RAISE EXCEPTION 'arj_fin_pruebas';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'arj_fin_pruebas' THEN
      res := res || jsonb_build_object('p', 'ERROR INESPERADO (las pruebas se cortaron aquí)', 'ok', FALSE, 'd', SQLERRM);
    END IF;
  END;

  RETURN QUERY
  SELECT e.i::INT, e.x->>'p', CASE WHEN (e.x->>'ok')::BOOLEAN THEN 'PASÓ' ELSE '❌ FALLÓ' END, e.x->>'d'
  FROM jsonb_array_elements(res) WITH ORDINALITY AS e(x, i)
  ORDER BY e.i;
END $$;

SELECT * FROM pg_temp.arj_probar_distribuidora();
