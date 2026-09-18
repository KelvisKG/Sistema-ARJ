-- Función para insertar automáticamente un perfil cuando un usuario se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles (id, rol, empresa, nombre_display, activo)
  VALUES (
    NEW.id,
    'vendedor', -- rol por defecto para nuevos registros
    COALESCE(NEW.raw_user_meta_data->>'empresa', 'ambas'), 
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    false -- ¡Importante! Siempre inactivo hasta aprobación manual del gerente
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que escucha inserciones en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
