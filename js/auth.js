// === Auth & Session ===
    // ═══════════════════════════════════════════════════════════════
    // LOGIN
    // ═══════════════════════════════════════════════════════════════
    function autofill(u, p) {
      document.getElementById('login-user').value = u;
      document.getElementById('login-pass').value = p;
    }
    async function doLogin() {
      const email = document.getElementById('login-user').value.trim().toLowerCase();
      const pass = document.getElementById('login-pass').value;
      const errorEl = document.getElementById('login-error');

      // Validación básica
      if (!email || !pass) {
        errorEl.querySelector('i').nextSibling.textContent = ' Completa email y contraseña';
        errorEl.classList.add('show');
        return;
      }

      // Asegurar que Supabase esté disponible
      if (!_sb) {
        errorEl.querySelector('i').nextSibling.textContent = ' Sin conexión al servidor. Revisa tu internet.';
        errorEl.classList.add('show');
        return;
      }

      // ── PASO 1: Autenticación con Supabase Auth ──
      const { data: authData, error: authError } = await _sb.auth.signInWithPassword({ email, password: pass });
      if (authError || !authData || !authData.user) {
        errorEl.querySelector('i').nextSibling.textContent = ' Email o contraseña incorrectos';
        errorEl.classList.add('show');
        return;
      }

      // ── PASO 2: Cargar el perfil del usuario desde tabla perfiles ──
      const { data: perfil, error: perfilError } = await _sb
        .from('perfiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (perfilError || !perfil) {
        // El usuario está autenticado pero no tiene perfil → error de configuración
        await _sb.auth.signOut();
        errorEl.querySelector('i').nextSibling.textContent = ' Usuario sin perfil asignado. Contacta al gerente.';
        errorEl.classList.add('show');
        return;
      }

      if (perfil.activo === false) {
        await _sb.auth.signOut();
        errorEl.querySelector('i').nextSibling.textContent = ' Usuario desactivado. Contacta al gerente.';
        errorEl.classList.add('show');
        return;
      }

      // ── PASO 3: Entrar al sistema con el perfil ──
      await _entrarConPerfil(perfil, /*esRestauracion*/ false);
    }

    // v13: Lógica común para "entrar al app con un perfil ya validado".
    // Usada tanto por doLogin() (login normal) como por restaurarSesionSiExiste()
    // (cuando hay un token guardado de una sesión anterior).
    async function _entrarConPerfil(perfil, esRestauracion) {
      estado.rol = perfil.rol;
      estado.usuario = perfil.nombre_display;
      // ASIGNACIÓN AUTOMÁTICA DE EMPRESA según perfil
      if (perfil.empresa === 'ambas') {
        estado.empresa = 'directa'; // gerente arranca en VD por defecto
        estado.empresa_usuario = 'ambas'; // puede cambiar
      } else {
        estado.empresa = perfil.empresa; // vendedor entra directo a SU empresa
        estado.empresa_usuario = perfil.empresa; // bloqueado
      }

      // Mostrar pantalla y ocultar login
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').style.display = 'block';
      document.getElementById('user-name').textContent = perfil.nombre_display;
      document.getElementById('user-role').textContent = perfil.rol.toUpperCase();
      document.body.classList.add('role-' + perfil.rol);

      // Cargar datos desde Supabase
      if (!esRestauracion) notif('Conectando a la base de datos...', 'warning');
      const sbOk = await cargarDatosSupabase();

      const accionLog = esRestauracion ? 'reanudó sesión' : 'inició sesión';
      logBitacora('login', `${perfil.nombre_display} ${accionLog} en ${nombreEmpresa(estado.empresa)}`, false);
      aplicarPermisos();
      aplicarEmpresaUI();
      // Aplicar tasas a los inputs y displays
      const _cfgPar = document.getElementById('cfg-par');
      const _cfgBcv = document.getElementById('cfg-bcv');
      if (_cfgPar) _cfgPar.value = tasaOk(estado.tasa_par) ? estado.tasa_par.toFixed(2) : '';
      if (_cfgBcv) _cfgBcv.value = tasaOk(estado.tasa_bcv) ? estado.tasa_bcv.toFixed(2) : '';
      const _tpEl = document.getElementById('tasa-par');
      const _tbEl = document.getElementById('tasa-bcv');
      if (_tpEl) _tpEl.textContent = fmtBS(estado.tasa_par);
      if (_tbEl) _tbEl.textContent = fmtBS(estado.tasa_bcv);
      llenarClientes();
      llenarDropdownSistemas();
      agregarPago();
      renderItems();
      setTimeout(() => {
        const hint = document.getElementById('shortcut-hint');
        if (hint) {
          hint.style.opacity = '0';
          hint.style.transition = 'opacity 1s';
          setTimeout(() => hint.style.display = 'none', 1000);
        }
      }, 5000);

      // Mensaje según conexión
      const verboBienv = esRestauracion ? 'Sesión reanudada' : 'Bienvenido';
      if (sbOk) {
        notif('✓ Conectado · ' + PRODUCTOS.length + ' productos · ' + CLIENTES.length + ' clientes', 'success');
        setTimeout(() => notif(verboBienv + ', ' + perfil.nombre_display + ' · ' + nombreEmpresa(estado.empresa), 'success'), 2500);
      } else {
        // v13.2: ya no hay "datos locales" que usar. Si la carga fallo, los
        // arrays estan vacios a proposito y facturar esta bloqueado.
        notif('⚠ SIN CONEXION. No se puede facturar. Revisa el internet y recarga (Ctrl+Shift+R).', 'error');
        setTimeout(() => notif('Sistema en solo lectura — sin datos cargados', 'error'), 2500);
      }
    }

    // v13: Al cargar la página, si hay sesión activa de una visita anterior,
    // restaurarla automáticamente sin pedir login otra vez.
    // Supabase guarda el token en localStorage y lo refresca solo.
    async function restaurarSesionSiExiste() {
      if (!_sb) return;
      try {
        const { data: { session } } = await _sb.auth.getSession();
        if (!session || !session.user) return; // No hay sesión guardada

        // Hay sesión: traer perfil y entrar
        const { data: perfil, error } = await _sb
          .from('perfiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error || !perfil) {
          console.warn('[ARJ] Sesión activa pero sin perfil válido. Cerrando sesión.');
          await _sb.auth.signOut();
          return;
        }
        if (perfil.activo === false) {
          console.warn('[ARJ] Sesión activa pero usuario desactivado.');
          await _sb.auth.signOut();
          return;
        }

        // Restaurar sesión en el app
        await _entrarConPerfil(perfil, /*esRestauracion*/ true);
      } catch (e) {
        console.error('[ARJ] Error restaurando sesión:', e);
      }
    }


    function aplicarEmpresaUI() {
      // Actualizar header según empresa actual
      const hdr = document.getElementById('header');
      const empName = document.getElementById('empresa-actual');
      if (estado.empresa === 'directa') {
        hdr.className = 'header empresa-directa';
        empName.textContent = 'Venta Directa';
      } else {
        hdr.className = 'header empresa-dist';
        empName.textContent = 'Distribuidora';
      }
      document.querySelectorAll('#empresa-fact,#emp-inv,#emp-cobrar,#emp-mov').forEach(el => el.textContent = empName.textContent);
      // v13.5: el despacho va de Distribuidora a Directa. Estando en Directa no
      // hay nada que despachar, y el boton solo confunde.
      const bd = document.getElementById('btn-despachar');
      if (bd) bd.style.display = estado.empresa === 'dist' ? '' : 'none';
      // Ocultar/mostrar switcher según permisos
      const sw = document.getElementById('empresa-switch');
      if (estado.empresa_usuario === 'ambas') {
        sw.style.display = 'flex';
      } else {
        sw.style.display = 'none'; // vendedores no pueden cambiar empresa
      }
      // NIVELES DE PRECIO: solo Distribuidora usa descuentos por nivel
      const esVD = estado.empresa === 'directa';
      const setDisp = (id, disp) => { const el = document.getElementById(id); if (el) el.style.display = disp; };
      // Facturación
      setDisp('fila-nivel-precio', esVD ? 'none' : 'flex');
      setDisp('fila-precio-publico-vd', esVD ? 'flex' : 'none');
      // Presupuesto
      setDisp('pre-fila-nivel-precio', esVD ? 'none' : 'flex');
      setDisp('pre-fila-precio-publico-vd', esVD ? 'flex' : 'none');
      // En VD forzar precio público
      if (esVD) {
        estado.tier = 'Publico';
        if (typeof preEstado !== 'undefined') preEstado.tier = 'Publico';
      }
    }

    function aplicarPermisos() {
      // Ocultar nav items restringidos
      document.querySelectorAll('[data-restrict]').forEach(el => {
        if (el.dataset.restrict === 'gerente' && estado.rol !== 'gerente') {
          el.style.display = 'none';
        }
      });
      // Ocultar botones de gerente
      document.querySelectorAll('[data-role="gerente"]').forEach(el => {
        if (estado.rol !== 'gerente') el.style.display = 'none';
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // BOTÓN DE PÁNICO + ATAJO ESC
    // ═══════════════════════════════════════════════════════════════
    async function botonPanico() {
      // Ocultar todo, limpiar pantalla, volver a login
      document.getElementById('app').style.display = 'none';
      document.getElementById('login-screen').classList.remove('hidden');
      document.getElementById('login-user').value = '';
      document.getElementById('login-pass').value = '';
      document.getElementById('login-error').classList.remove('show');
      // Limpiar estado
      estado.items = []; estado.pagos = []; estado.cliente = null; estado.tier = 'Publico';
      estado.cobrar_verde = null;
      estado.rol = null; estado.usuario = null;
      document.body.classList.remove('role-gerente', 'role-vendedor');
      // v13: Cerrar sesión real en Supabase Auth
      if (_sb) {
        try { await _sb.auth.signOut(); } catch (e) { console.error('[ARJ] signOut error:', e); }
      }
      // Recargar la página para borrar memoria del navegador (más seguro)
      setTimeout(() => location.reload(), 200);
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (document.getElementById('app').style.display === 'block') {
          botonPanico();
        }
      }
      // Ctrl+Q también cierra
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        botonPanico();
      }
    });
