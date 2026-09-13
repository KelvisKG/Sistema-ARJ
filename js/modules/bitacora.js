// === Bitacora ===
    function logBitacora(accion, desc, critico = false) {
      const ahora = new Date();
      const fecha = ahora.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) + ' ' + ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
      BITACORA.unshift({ fecha, usuario: estado.usuario || 'Sistema', accion, desc, critico, empresa: estado.empresa || 'directa' });
      guardarDatos();
    }

    // v13.2: la bitacora se descarga de verdad (antes era un aviso "Demo:")
    function descargarBitacoraCSV() {
      if (!BITACORA.length) { notif('No hay actividad registrada', 'error'); return; }
      const filas = [['Fecha', 'Usuario', 'Empresa', 'Accion', 'Descripcion', 'Critico']];
      BITACORA.forEach(b => filas.push([b.fecha, b.usuario, b.empresa, b.accion, b.desc, b.critico ? 'SI' : 'no']));
      _descargarCSV('ARJ_bitacora_' + _hoyArchivo() + '.csv', filas);
      notif(BITACORA.length + ' registros descargados', 'success');
    }

    function renderBitacora() {
      const cont = document.getElementById('bitacora-list');
      if (!cont) return;
      const fUsuario = document.getElementById('bitacora-filtro-usuario').value;
      const fAccion = document.getElementById('bitacora-filtro-accion').value;
      const fEmpresa = document.getElementById('bitacora-filtro-empresa')?.value || '';
      const filtered = BITACORA.filter(b => {
        if (fUsuario && b.usuario !== fUsuario) return false;
        if (fAccion && b.accion !== fAccion) return false;
        if (fEmpresa && b.empresa !== fEmpresa && b.empresa !== 'ambas') return false;
        return true;
      });
      if (filtered.length === 0) {
        cont.innerHTML = '<div style="padding:30px;text-align:center;color:var(--dgray);font-size:13px">Sin registros para estos filtros</div>';
        return;
      }
      const iconos = { factura: 'ti-file-invoice', anulacion: 'ti-file-x', precio: 'ti-currency-dollar', inventario: 'ti-package', login: 'ti-login', cliente: 'ti-user' };
      const colores = { factura: '#185FA5', anulacion: '#A32D2D', precio: '#BF8F00', inventario: '#0F6E56', login: '#595959', cliente: '#3C3489' };
      cont.innerHTML = filtered.map(b => {
        const icono = iconos[b.accion] || 'ti-circle';
        const color = colores[b.accion] || '#595959';
        const empBadge = b.empresa === 'ambas' ? '<span style="background:var(--lgold);color:#854F0B;padding:1px 6px;border-radius:8px;font-size:9.5px;font-weight:600;margin-left:6px">AMBAS</span>' : b.empresa === 'directa' ? '<span style="background:var(--lblue);color:var(--blue);padding:1px 6px;border-radius:8px;font-size:9.5px;font-weight:600;margin-left:6px">VENTA DIRECTA</span>' : '<span style="background:var(--lgreen);color:var(--green);padding:1px 6px;border-radius:8px;font-size:9.5px;font-weight:600;margin-left:6px">DISTRIBUIDORA</span>';
        return `<div style="display:flex;align-items:flex-start;gap:12px;padding:11px 16px;border-bottom:1px solid var(--gray);${b.critico ? 'background:#FFF8E1' : ''}">
      <div style="width:32px;height:32px;border-radius:50%;background:${color}22;color:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ${icono}" style="font-size:15px"></i></div>
      <div style="flex:1">
        <div style="font-size:12.5px;color:#222">${b.desc}${b.critico ? ' <span style="background:#FFE082;color:#5D4037;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;margin-left:4px">CRÍTICO</span>' : ''}</div>
        <div style="font-size:11px;color:var(--dgray);margin-top:2px"><i class="ti ti-user" style="font-size:11px"></i> ${b.usuario}${empBadge} · <i class="ti ti-clock" style="font-size:11px"></i> ${b.fecha}</div>
      </div>
    </div>`;
      }).join('');
    }
