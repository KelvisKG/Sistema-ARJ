// === App Startup & Event Listeners ===

    // ═══════════════════════════════════════════════════════════════
    // v11: CARGA FINAL DE DATOS GUARDADOS
    // Se ejecuta al final del script, cuando TODAS las variables (incluyendo
    // metas y ventasMesActual) ya están declaradas. Si hay datos en localStorage,
    // los aplica encima de los demos.
    // ═══════════════════════════════════════════════════════════════
    _arjDatosCargados = cargarDatos();
    _persistenciaLista = true;

    // v13: Al cargar la página, si hay sesión activa, restaurarla automáticamente
    // (Supabase guarda el token en localStorage por 7 días por default y lo refresca solo)
    restaurarSesionSiExiste();

    // v12: Help-box colapsables
    document.addEventListener('click', function (e) {
      const hb = e.target.closest('.help-box');
      if (hb) hb.classList.toggle('open');
    });