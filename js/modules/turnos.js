// === Turnos ===
    // ─── TURNOS / CIERRE DE CAJA ────────────────────────────────
    function renderTurnos() {
      // Mi turno actual
      const yo = estado.usuario || '';
      const miTurno = TURNOS.find(t => t.vendedor === yo && t.estado === 'abierto');
      const card = document.getElementById('mi-turno-card');
      const titulo = document.getElementById('mi-turno-titulo');
      const info = document.getElementById('mi-turno-info');
      const acciones = document.getElementById('mi-turno-acciones');
      const detalle = document.getElementById('mi-turno-detalle');

      if (miTurno) {
        card.style.borderLeftColor = 'var(--green)';
        titulo.innerHTML = `<i class="ti ti-circle-check" style="color:var(--green)"></i> Turno abierto desde las ${miTurno.apertura}`;
        info.innerHTML = `Empresa: <strong>${miTurno.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora'}</strong> · Efectivo apertura: <strong>${fmtUSD(miTurno.efec_ap_usd)}</strong> + <strong>${fmtBS(miTurno.efec_ap_bs)}</strong>`;
        acciones.innerHTML = `<button class="btn btn-gold" onclick="abrirCerrarTurno()"><i class="ti ti-clock-stop"></i> Cerrar turno</button>`;
        detalle.style.display = 'block';
        detalle.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
        <div style="background:#FAFBFC;border-radius:6px;padding:10px;text-align:center">
          <div style="font-size:11px;color:var(--dgray);font-weight:500">VENTAS EFECTIVO USD</div>
          <div style="font-size:18px;font-weight:600;color:var(--navy)">${fmtUSD(miTurno.ventas_efec_usd)}</div>
        </div>
        <div style="background:#FAFBFC;border-radius:6px;padding:10px;text-align:center">
          <div style="font-size:11px;color:var(--dgray);font-weight:500">VENTAS EFECTIVO BS</div>
          <div style="font-size:18px;font-weight:600;color:var(--navy)">${fmtBS(miTurno.ventas_efec_bs)}</div>
        </div>
        <div style="background:#FAFBFC;border-radius:6px;padding:10px;text-align:center">
          <div style="font-size:11px;color:var(--dgray);font-weight:500">DEBERÍA HABER USD</div>
          <div style="font-size:18px;font-weight:600;color:var(--green)">${fmtUSD(miTurno.efec_ap_usd + miTurno.ventas_efec_usd)}</div>
        </div>
        <div style="background:#FAFBFC;border-radius:6px;padding:10px;text-align:center">
          <div style="font-size:11px;color:var(--dgray);font-weight:500">DEBERÍA HABER BS</div>
          <div style="font-size:18px;font-weight:600;color:var(--green)">${fmtBS(miTurno.efec_ap_bs + miTurno.ventas_efec_bs)}</div>
        </div>
      </div>`;
      } else {
        card.style.borderLeftColor = 'var(--dgray)';
        titulo.innerHTML = '<i class="ti ti-clock-off" style="color:var(--dgray)"></i> No tienes turno abierto';
        info.textContent = 'Abre un turno declarando el efectivo inicial para registrar tus ventas del día.';
        acciones.innerHTML = `<button class="btn btn-green" onclick="abrirAbrirTurno()"><i class="ti ti-clock-play"></i> Abrir mi turno</button>`;
        detalle.style.display = 'none';
      }
      // Tabla de turnos
      const tbody = document.getElementById('turnos-body');
      tbody.innerHTML = TURNOS.map(t => {
        const esperadoUsd = t.efec_ap_usd + t.ventas_efec_usd;
        const esperadoBs = t.efec_ap_bs + t.ventas_efec_bs;
        let badge = '', difTxt = '—', difCls = '';
        if (t.estado === 'abierto') { badge = '<span class="turno-badge abierto"><i class="ti ti-circle-check"></i> EN CURSO</span>'; }
        else if (t.estado === 'cerrado_dif') { badge = '<span class="turno-badge diferencia-mal"><i class="ti ti-alert-triangle"></i> CON DIFERENCIA</span>'; difTxt = fmtUSD(t.diferencia); difCls = t.diferencia < 0 ? 'diferencia-negativa' : 'diferencia-positiva'; }
        else { badge = '<span class="turno-badge cerrado"><i class="ti ti-check"></i> CUADRÓ</span>'; difTxt = fmtUSD(0); difCls = 'diferencia-positiva'; }
        return `<tr>
      <td><strong>${t.vendedor}</strong></td>
      <td>${t.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora'}</td>
      <td>${t.apertura}</td>
      <td>${t.cierre || '—'}</td>
      <td class="num">${fmtUSD(t.efec_ap_usd)}<div style="font-size:10px;color:var(--dgray)">+${fmtBS(t.efec_ap_bs)}</div></td>
      <td class="num">${fmtUSD(t.ventas_efec_usd)}<div style="font-size:10px;color:var(--dgray)">+${fmtBS(t.ventas_efec_bs)}</div></td>
      <td class="num">${fmtUSD(esperadoUsd)}<div style="font-size:10px;color:var(--dgray)">+${fmtBS(esperadoBs)}</div></td>
      <td class="num">${t.estado === 'abierto' ? '—' : fmtUSD(t.real_usd)}<div style="font-size:10px;color:var(--dgray)">${t.estado === 'abierto' ? '' : '+' + fmtBS(t.real_bs)}</div></td>
      <td class="num ${difCls}">${difTxt}</td>
      <td>${badge}</td>
    </tr>`;
      }).join('');
    }

    function abrirAbrirTurno() {
      document.getElementById('turno-vendedor').value = estado.usuario;
      document.getElementById('turno-empresa').value = estado.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora';
      document.getElementById('turno-efectivo-usd').value = '0';
      document.getElementById('turno-efectivo-bs').value = '0';
      document.getElementById('modal-abrir-turno').classList.add('show');
    }
    function cerrarAbrirTurno() { document.getElementById('modal-abrir-turno').classList.remove('show'); }
    function confirmarAbrirTurno() {
      const usd = parseFloat(document.getElementById('turno-efectivo-usd').value) || 0;
      const bs = parseFloat(document.getElementById('turno-efectivo-bs').value) || 0;
      const ahora = new Date();
      const hora = ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
      TURNOS.push({
        id: TURNOS.length + 1, vendedor: estado.usuario, empresa: estado.empresa,
        apertura: hora, cierre: null,
        efec_ap_usd: usd, efec_ap_bs: bs,
        ventas_efec_usd: 0, ventas_efec_bs: 0,
        real_usd: 0, real_bs: 0, diferencia: null,
        estado: 'abierto', obs: ''
      });
      logBitacora('factura', `Abrió turno con ${fmtUSD(usd)} + ${fmtBS(bs)}`, false);
      cerrarAbrirTurno();
      renderTurnos();
      notif('Turno abierto correctamente. Las ventas en efectivo se sumarán aquí.', 'success');
    }

    let turnoCerrando = null;
    function abrirCerrarTurno() {
      const yo = estado.usuario;
      turnoCerrando = TURNOS.find(t => t.vendedor === yo && t.estado === 'abierto');
      if (!turnoCerrando) { notif('No tienes turno abierto', 'error'); return; }
      const espUsd = turnoCerrando.efec_ap_usd + turnoCerrando.ventas_efec_usd;
      const espBs = turnoCerrando.efec_ap_bs + turnoCerrando.ventas_efec_bs;
      document.getElementById('ct-resumen').innerHTML = `
    <div style="font-weight:600;color:var(--navy);margin-bottom:6px">Resumen del turno:</div>
    Apertura: ${turnoCerrando.apertura} · ${fmtUSD(turnoCerrando.efec_ap_usd)} + ${fmtBS(turnoCerrando.efec_ap_bs)}<br>
    Ventas efectivo: ${fmtUSD(turnoCerrando.ventas_efec_usd)} + ${fmtBS(turnoCerrando.ventas_efec_bs)}<br>
    <strong style="color:var(--green)">Deberías tener: ${fmtUSD(espUsd)} + ${fmtBS(espBs)}</strong>`;
      document.getElementById('ct-real-usd').value = espUsd;
      document.getElementById('ct-real-bs').value = espBs;
      document.getElementById('ct-obs').value = '';
      recalcularCierre();
      document.getElementById('modal-cerrar-turno').classList.add('show');
    }
    function cerrarCerrarTurno() { document.getElementById('modal-cerrar-turno').classList.remove('show'); turnoCerrando = null; }
    function recalcularCierre() {
      if (!turnoCerrando) return;
      const realUsd = parseFloat(document.getElementById('ct-real-usd').value) || 0;
      const realBs = parseFloat(document.getElementById('ct-real-bs').value) || 0;
      const espUsd = turnoCerrando.efec_ap_usd + turnoCerrando.ventas_efec_usd;
      const espBs = turnoCerrando.efec_ap_bs + turnoCerrando.ventas_efec_bs;
      const difUsd = realUsd - espUsd;
      const difBsEnUsd = (realBs - espBs) / estado.tasa_par;
      const difTotal = difUsd + difBsEnUsd;
      const res = document.getElementById('ct-resultado');
      if (Math.abs(difTotal) < 0.5) {
        res.style.background = '#E8F5E9'; res.style.color = ' #1B5E20'; res.style.borderLeft = '4px solid var(--green)';
        res.innerHTML = `<i class="ti ti-circle-check"></i> ¡Cuadra perfecto! Diferencia: ${fmtUSD(difTotal)}`;
      } else if (difTotal < 0) {
        res.style.background = '#FCEBEB'; res.style.color = 'var(--red)'; res.style.borderLeft = '4px solid var(--red)';
        res.innerHTML = `<i class="ti ti-alert-triangle"></i> FALTA dinero: ${fmtUSD(Math.abs(difTotal))} — Revisa antes de cerrar.`;
      } else {
        res.style.background = '#FFF8E1'; res.style.color = '#5D4037'; res.style.borderLeft = '4px solid var(--gold)';
        res.innerHTML = `<i class="ti ti-info-circle"></i> SOBRA dinero: ${fmtUSD(Math.abs(difTotal))}`;
      }
    }
    function confirmarCerrarTurno() {
      if (!turnoCerrando) return;
      const realUsd = parseFloat(document.getElementById('ct-real-usd').value) || 0;
      const realBs = parseFloat(document.getElementById('ct-real-bs').value) || 0;
      const espUsd = turnoCerrando.efec_ap_usd + turnoCerrando.ventas_efec_usd;
      const espBs = turnoCerrando.efec_ap_bs + turnoCerrando.ventas_efec_bs;
      const difUsd = realUsd - espUsd;
      const difBsEnUsd = (realBs - espBs) / estado.tasa_par;
      const dif = difUsd + difBsEnUsd;
      const ahora = new Date();
      turnoCerrando.cierre = ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
      turnoCerrando.real_usd = realUsd;
      turnoCerrando.real_bs = realBs;
      turnoCerrando.diferencia = dif;
      turnoCerrando.estado = Math.abs(dif) < 0.5 ? 'cerrado' : 'cerrado_dif';
      turnoCerrando.obs = document.getElementById('ct-obs').value;
      logBitacora('factura', `Cerró turno — Diferencia: ${fmtUSD(dif)} ${Math.abs(dif) < 0.5 ? '(cuadró)' : '(¡con diferencia!)'}`, Math.abs(dif) >= 0.5);
      cerrarCerrarTurno();
      renderTurnos();
      notif(`Turno cerrado. ${Math.abs(dif) < 0.5 ? '¡Cuadró perfecto!' : 'Quedó una diferencia de ' + fmtUSD(dif)}`, Math.abs(dif) < 0.5 ? 'success' : 'warning');
    }
