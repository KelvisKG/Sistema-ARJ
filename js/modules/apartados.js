// === Apartados ===
    function renderApartados() {
      const cont = document.getElementById('apartados-list');
      if (!cont) return;
      // FILTRO POR EMPRESA
      const filtrados = APARTADOS.filter(a => a.empresa === estado.empresa);
      cont.innerHTML = filtrados.map(a => {
        const urgente = a.horas_restantes <= 12;
        return `<div style="background:#FFF;border:1px solid var(--border);border-left:4px solid ${urgente ? 'var(--gold)' : 'var(--green)'};border-radius:8px;padding:14px 16px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:600;color:var(--navy);font-size:13.5px">${a.num}</span>
            <span style="background:${urgente ? '#FFE082' : '#C8E6C9'};color:${urgente ? '#5D4037' : '#1B5E20'};padding:2px 8px;border-radius:8px;font-size:10.5px;font-weight:600">${urgente ? '⚠ POR VENCER ' : '✓ ACTIVO'} ${a.horas_restantes}h</span>
          </div>
          <div style="font-size:13px;color:#222;margin-bottom:3px"><strong>${a.cliente}</strong></div>
          <div style="font-size:11.5px;color:var(--dgray);margin-bottom:6px"><i class="ti ti-message"></i> ${a.razon}</div>
          <div style="font-size:11.5px;color:var(--dgray)"><i class="ti ti-package"></i> ${a.items.join(' · ')}</div>
          <div style="font-size:11px;color:var(--dgray);margin-top:4px"><i class="ti ti-clock"></i> Creado: ${a.fecha} · Vence: ${a.vence} · ${a.vendedor}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;color:var(--navy);font-size:16px">${fmtUSD(a.total)}</div>
          <div style="display:flex;gap:4px;margin-top:8px">

            <button class="btn btn-green btn-sm" onclick="convertirApartado('${a.num}')" title="Convertir a factura"><i class="ti ti-file-invoice"></i></button>
            <button class="btn btn-red btn-sm" onclick="liberarApartado('${a.num}')" title="Liberar stock"><i class="ti ti-x"></i></button>
          </div>
        </div>
      </div>
    </div>`;
      }).join('');
      if (filtrados.length === 0) {
        cont.innerHTML = '<div style="background:#FFF;border:1px solid var(--border);border-radius:8px;padding:40px;text-align:center;color:var(--dgray)"><i class="ti ti-clock-pause" style="font-size:36px;display:block;margin-bottom:8px;color:#CCC"></i>No hay apartados activos en ' + nombreEmpresa(estado.empresa) + '.</div>';
      }
    }

    function nuevoApartado() {
      const sel = document.getElementById('apa-cliente');
      sel.innerHTML = '<option>-- Selecciona --</option>' + CLIENTES.map(c => `<option>${c.nombre}</option>`).join('');
      document.getElementById('modal-apartado').classList.add('show');
    }
    function cerrarApartado() { document.getElementById('modal-apartado').classList.remove('show'); }
    function crearApartado() {
      const cli = document.getElementById('apa-cliente').value;
      const razon = document.getElementById('apa-razon').value;
      if (cli.startsWith('--')) { notif('Selecciona un cliente', 'error'); return; }
      if (!razon.trim()) { notif('Indica la razón del apartado', 'error'); return; }
      const prefijo = estado.empresa === 'directa' ? 'VD' : 'DT';
      const numero = 'APA-' + prefijo + '-2026-' + String(Math.floor(Math.random() * 100) + 20).padStart(4, '0');
      logBitacora('factura', `Creó apartado ${numero} para ${cli} — vence en 48h · ${nombreEmpresa(estado.empresa)}`, false);
      cerrarApartado();
      notif(`Apartado ${numero} creado. Stock reservado por 48 horas`, 'success');
    }
    function convertirApartado(num) {
      notif(`${num} convertido a factura. Stock confirmado.`, 'success');
      logBitacora('factura', `Convirtió apartado ${num} en factura`, false);
    }
    function liberarApartado(num) {
      if (!confirm('¿Liberar este apartado? El stock volverá al inventario disponible.')) return;
      APARTADOS = APARTADOS.filter(a => a.num !== num);
      renderApartados();
      logBitacora('factura', `Liberó apartado ${num} manualmente`, false);
      notif('Apartado liberado. Stock disponible nuevamente.', 'warning');
    }
