// === Alertas ===
    // ─── ALERTAS INTELIGENTES ───────────────────────────────────
    function renderAlertas() {
      const cont = document.getElementById('alertas-list');
      const lista = filtroAlertasActual === 'todas' ? ALERTAS : ALERTAS.filter(a => a.tipo === filtroAlertasActual);
      if (lista.length === 0) {
        cont.innerHTML = '<div style="background:#FFF;border:1px solid var(--border);border-radius:8px;padding:40px;text-align:center;color:var(--dgray)">No hay alertas en esta categoría.</div>';
        return;
      }
      cont.innerHTML = lista.map(a => `
    <div class="alerta-card ${a.tipo}">
      <div class="alerta-icon"><i class="ti ${a.icono}"></i></div>
      <div class="alerta-content">
        <div class="alerta-titulo">${a.titulo}</div>
        <div class="alerta-desc">${a.desc}</div>
        <div class="alerta-meta"><i class="ti ti-info-circle"></i> ${a.origen} · <i class="ti ti-clock"></i> ${a.fecha}</div>
      </div>
      <div class="alerta-acciones">
        <button class="btn btn-secondary btn-sm" onclick="descartarAlerta(${a.id})" title="Marcar como atendida"><i class="ti ti-check"></i></button>
      </div>
    </div>`).join('');
    }

    function filtrarAlertas(tipo) {
      filtroAlertasActual = tipo;
      document.querySelectorAll('.filtro-alerta').forEach(b => b.classList.toggle('active', b.dataset.filtro === tipo));
      renderAlertas();
    }

    function descartarAlerta(id) {
      ALERTAS = ALERTAS.filter(a => a.id !== id);
      renderAlertas();
      // Actualizar contadores
      document.getElementById('alertas-criticas').textContent = ALERTAS.filter(a => a.tipo === 'critica').length;
      document.getElementById('alertas-warning').textContent = ALERTAS.filter(a => a.tipo === 'warning').length;
      document.getElementById('alertas-info').textContent = ALERTAS.filter(a => a.tipo === 'info').length;
      guardarDatos();
      notif('Alerta marcada como atendida', 'success');
    }
