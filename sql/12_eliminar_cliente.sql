-- =====================================================================
-- 12. ELIMINAR O DESACTIVAR CLIENTE
--
-- Regla de integridad fiscal:
--   · Si el cliente nunca ha tenido facturas ni saldo deudor, se puede
--     eliminar definitivamente.
--   · Si ya tiene facturas, se desactiva (activo = FALSE) para conservar
--     el histórico contable y fiscal.
-- =====================================================================

CREATE OR REPLACE FUNCTION eliminar_cliente(p_id INT, p_definitivo BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_c clientes;
  v_veces INT;
BEGIN
  PERFORM arj_exigir_usuario(FALSE);
  SELECT * INTO v_c FROM clientes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARJ: cliente no encontrado'; END IF;

  IF (COALESCE(v_c.saldo_vd, 0) + COALESCE(v_c.saldo_dist, 0)) > 0.01 THEN
    RAISE EXCEPTION 'ARJ: el cliente % tiene saldo pendiente y no se puede eliminar ni desactivar', v_c.nombre;
  END IF;

  SELECT COUNT(*) INTO v_veces FROM facturas WHERE cliente_id = p_id;

  IF p_definitivo THEN
    IF v_veces > 0 THEN
      RAISE EXCEPTION 'ARJ: % tiene % factura(s) y no se puede borrar definitivamente. Se debe desactivar.',
        v_c.nombre, v_veces;
    END IF;
    BEGIN
      DELETE FROM contactos_cliente WHERE cliente_id = p_id;
      DELETE FROM clientes WHERE id = p_id;
      RETURN jsonb_build_object('ok', TRUE, 'accion', 'eliminado', 'veces', 0);
    EXCEPTION WHEN foreign_key_violation THEN
      UPDATE clientes SET activo = FALSE WHERE id = p_id;
      RETURN jsonb_build_object('ok', TRUE, 'accion', 'desactivado', 'veces', 0,
        'nota', 'tiene registros vinculados: se desactivó en vez de borrar');
    END;
  END IF;

  UPDATE clientes SET activo = FALSE WHERE id = p_id;
  RETURN jsonb_build_object('ok', TRUE, 'accion', 'desactivado', 'veces', v_veces);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

REVOKE ALL ON FUNCTION eliminar_cliente(INT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION eliminar_cliente(INT, BOOLEAN) TO authenticated;
