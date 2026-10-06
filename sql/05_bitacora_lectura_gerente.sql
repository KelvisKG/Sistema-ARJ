-- ==============================================================================
-- SISTEMA ARJ · 05 — LECTURA DE LA BITÁCORA PARA GERENTES
--
-- En desarrollo `bitacora` tiene RLS sin ninguna regla de lectura: las entradas
-- se guardan (vía registrar_bitacora) pero la pantalla Bitácora no las puede ver.
-- Esta regla deja leerla solo a perfiles gerente activos (la pantalla es solo
-- para gerentes). Es aditiva: si ya existe otra regla de lectura, no la quita.
--
-- Aplicar en desarrollo. En producción es opcional e inofensivo. Idempotente.
-- ==============================================================================

ALTER TABLE bitacora ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bitacora'
                 AND policyname = 'arj_bitacora_lectura_gerente') THEN
    CREATE POLICY arj_bitacora_lectura_gerente ON bitacora
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'gerente' AND p.activo = TRUE));
  END IF;
END $$;
