-- ==============================================================================
-- SISTEMA ARJ · 07 — CERRAR LAS ESCRITURAS DIRECTAS A LAS TABLAS
--
-- Prueba del 06-oct-2026 en desarrollo: un VENDEDOR autenticado podía, desde la
-- consola del navegador, modificar o borrar filas de facturas, pagos, productos,
-- clientes, configuración, contadores... y MODIFICAR SU PROPIO PERFIL (por
-- ejemplo, ponerse rol 'gerente'). Eso anula todas las validaciones de las
-- funciones del servidor.
--
-- La app Vue ya no escribe directo en ninguna tabla: todo pasa por funciones
-- SECURITY DEFINER (02, 04, 06), que no dependen de estos permisos.
--
-- ⚠ PRODUCCIÓN: el MONOLITO escribe directo en las tablas. Si todavía se usa,
--   aplicar este script en producción LO ROMPE. Aplicarlo allí solo cuando el
--   monolito deje de usarse. La sección 1 (perfiles) sí conviene aplicarla ya
--   en ambas bases: el monolito no modifica perfiles.
-- ==============================================================================

-- 1. PERFILES: nadie los modifica desde la app (se gestionan en el panel de Supabase)
REVOKE INSERT, UPDATE, DELETE ON perfiles FROM anon, authenticated;

-- 2. Resto de tablas del sistema: solo lectura para usuarios autenticados
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'facturas', 'factura_items', 'pagos', 'productos', 'clientes', 'contactos_cliente',
    'cotizaciones', 'cotizacion_items', 'traspasos', 'traspaso_items', 'recepciones',
    'recepcion_items', 'embarques', 'movimientos_caja', 'configuracion', 'contadores',
    'bitacora', 'sistemas', 'usuarios', 'inventario'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON %I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

-- Verificación: debe devolver 0 filas
-- SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
--   AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
