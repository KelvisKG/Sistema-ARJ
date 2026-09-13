// === Navigation & UI ===
    // ═══════════════════════════════════════════════════════════════
    // NAVEGACIÓN
    // ═══════════════════════════════════════════════════════════════
    function navTo(page) {
      // Verificar permisos
      const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
      if (navItem && navItem.dataset.restrict === 'gerente' && estado.rol !== 'gerente') {
        notif('No tienes permisos para acceder a esa sección', 'error');
        return;
      }
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById('page-' + page).classList.add('active');
      if (navItem) navItem.classList.add('active');
      if (page === 'inventario') renderInventario();
      if (page === 'cobrar') renderCobrar();
      if (page === 'clientes') renderClientes();
      if (page === 'cotizaciones') { limpiarPresupuestosVencidos(); renderCotizaciones(); }
      if (page === 'historial') renderHistorial();
      if (page === 'bitacora') renderBitacora();
      if (page === 'turnos') renderTurnos();
      if (page === 'movimientos') { movInitMes(); renderMovimientos(); }
      if (page === 'alertas') renderAlertas();
      if (page === 'exportar') renderVentasPendientes();
      if (page === 'config') { renderListasPrecios(); renderUsuariosConfig(); renderInfoBackup(); _respUltimo(); }
      if (page === 'dashboard') {
        // v13.35: si el usuario dejo el selector en otro rango, se respeta.
        const _selOr = document.getElementById('rep-origen-rango');
        if (_selOr && _selOr.value !== 'mes' && _selOr.value !== 'custom') setTimeout(cargarOrigenPeriodo, 300); renderVentasRecientes(); renderMetas(); actualizarKpiStockCritico(); cambiarSubReporte('resumen'); }
    }

    // ═══════════════════════════════════════════════════════════════
    // CAMBIO DE EMPRESA — CONFIRMACIÓN + ANIMACIÓN
    // ═══════════════════════════════════════════════════════════════
    function pedirConfirmacionCambio() {
      // Vendedores NO pueden cambiar empresa
      if (estado.empresa_usuario !== 'ambas') {
        notif('No tienes permisos para cambiar de empresa. Estás asignado a ' + nombreEmpresa(estado.empresa_usuario), 'error');
        return;
      }
      const nueva = estado.empresa === 'directa' ? 'dist' : 'directa';
      estado.empresa_pendiente = nueva;
      const actualName = estado.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora';
      const nuevaName = nueva === 'directa' ? 'Venta Directa' : 'Distribuidora';
      document.getElementById('confirm-text').innerHTML = `Vas a cambiar de <strong>${actualName}</strong> a <strong>${nuevaName}</strong>. Toda la información que veas a continuación será de la otra empresa.`;
      document.getElementById('confirm-modal').classList.add('show');
    }

    function cancelarCambioEmpresa() {
      document.getElementById('confirm-modal').classList.remove('show');
      estado.empresa_pendiente = null;
    }

    function confirmarCambioEmpresa() {
      document.getElementById('confirm-modal').classList.remove('show');
      estado.empresa = estado.empresa_pendiente;
      estado.empresa_pendiente = null;
      // Animación
      const trans = document.getElementById('empresa-transition');
      const card = document.getElementById('transition-card');
      const icon = document.getElementById('transition-icon');
      const title = document.getElementById('transition-title');
      const sub = document.getElementById('transition-sub');
      if (estado.empresa === 'directa') {
        card.className = 'transition-card directa';
        icon.className = 'ti ti-building-store';
        title.textContent = 'Venta Directa';
        sub.textContent = 'Cambiando a empresa de venta al público...';
      } else {
        card.className = 'transition-card dist';
        icon.className = 'ti ti-truck-delivery';
        title.textContent = 'Distribuidora';
        sub.textContent = 'Cambiando a empresa distribuidora...';
      }
      trans.classList.add('show');
      setTimeout(() => {
        trans.classList.remove('show');
        aplicarEmpresaUI();
        llenarClientes();
        estado.cliente = null;
        document.getElementById('cliente-select').value = '';
        // Limpiar la factura en curso (datos diferentes en cada empresa)
        estado.items = []; estado.pagos = [];
        renderItems();
        agregarPago();
        // Re-renderizar todas las páginas
        renderInventario();
        renderCobrar();
        renderClientes();
        renderCotizaciones();
        renderHistorial();
        logBitacora('login', `Cambió de empresa a ${nombreEmpresa(estado.empresa)}`, false);
        notif(`Ahora estás en: ${nombreEmpresa(estado.empresa)}`, 'success');
      }, 1500);
    }

    // ═══════════════════════════════════════════════════════════════
    // NOTIFICACIONES (campana)
    // ═══════════════════════════════════════════════════════════════
    function toggleNotifs() {
      document.getElementById('notif-panel').classList.toggle('show');
    }
    document.addEventListener('click', e => {
      if (!e.target.closest('.bell-btn') && !e.target.closest('.notif-panel')) {
        document.getElementById('notif-panel').classList.remove('show');
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // CLIENTES — FACTURACIÓN
    // ═══════════════════════════════════════════════════════════════
    function llenarClientes() {
      const sel = document.getElementById('cliente-select');
      sel.innerHTML = '<option value="">-- Selecciona un cliente --</option>';
      // FILTRO POR EMPRESA: solo mostrar clientes activos en la empresa actual o en ambas
      const clientesFiltrados = CLIENTES.filter(c => c.empresa === estado.empresa || c.empresa === 'ambas');
      clientesFiltrados.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.nombre + ' (' + c.rif + ')';
        sel.appendChild(opt);
      });
    }
