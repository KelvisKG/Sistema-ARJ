-- ==============================================================================
-- SISTEMA ARJ · 04 — BITÁCORA ESCRITA POR EL SERVIDOR
--
-- La app ya no inserta directo en `bitacora` (en desarrollo la RLS lo impedía y,
-- donde se permite, cualquiera podía firmar con otro nombre). Esta función
-- registra la entrada con el nombre del perfil del usuario autenticado.
--
-- Aplicar en desarrollo y en producción (después del 02). Idempotente.
-- ==============================================================================

CREATE OR REPLACE FUNCTION registrar_bitacora(p_empresa TEXT, p_accion TEXT, p_descripcion TEXT, p_critico BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_perfil perfiles;
BEGIN
  v_perfil := arj_exigir_usuario(FALSE);
  INSERT INTO bitacora (fecha, usuario, empresa, accion, descripcion, critico)
  VALUES (NOW(), v_perfil.nombre_display, COALESCE(p_empresa, 'directa'), LEFT(COALESCE(p_accion, 'sistema'), 50),
          LEFT(COALESCE(p_descripcion, ''), 2000), COALESCE(p_critico, FALSE));
  RETURN jsonb_build_object('ok', TRUE);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', FALSE, 'error', SQLERRM);
END $$;

REVOKE ALL ON FUNCTION registrar_bitacora(TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_bitacora(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
