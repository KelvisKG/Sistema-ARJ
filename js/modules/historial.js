// === Historial de Facturas ===
    // ═══════════════════════════════════════════════════════════════
    // v12: HISTORIAL DE DOCUMENTOS
    // ═══════════════════════════════════════════════════════════════
    let _histTab = 'facturas';

    function tabHistorial(tab) {
      _histTab = tab;
      document.querySelectorAll('[data-tab-hist]').forEach(b => {
        if (b.dataset.tabHist === tab) { b.style.background = 'var(--navy)'; b.style.color = '#FFF'; }
        else { b.style.background = ''; b.style.color = ''; }
      });
      renderHistorial();
    }

    function filtrarHist(v){
  const s = document.getElementById('hist-estado');
  if(s) s.value = v;
  renderHistorial();
}
function renderHistorial(){
      const buscar = (document.getElementById('hist-buscar')?.value || '').toLowerCase();
      const filtroEstado = document.getElementById('hist-estado')?.value || '';
      const cont = document.getElementById('historial-tabla');
      if (!cont) return;

      const estadoBadge = (est) => {
        const map = { pagada: 'background:var(--lgreen);color:var(--green)', pendiente: 'background:var(--lgold);color:var(--gold)', parcial: 'background:#E3F2FD;color:var(--blue)', vencida: 'background:var(--lred);color:var(--red)', anulada: 'background:#F5F5F5;color:#999', activa: 'background:var(--lgreen);color:var(--green)', por_vencer: 'background:var(--lgold);color:var(--gold)', convertida: 'background:var(--lblue);color:var(--blue)' };
        return `<span style="${map[est] || ''};padding:2px 8px;border-radius:8px;font-size:10px;font-weight:600;text-transform:uppercase">${est}</span>`;
      };

      if (_histTab === 'facturas') {
        let datos = TODAS_FACTURAS.filter(f => f.empresa === estado.empresa);
        if (buscar) datos = datos.filter(f => (f.num || '').toLowerCase().includes(buscar) || (f.cliente || '').toLowerCase().includes(buscar) || (f.vendedor || '').toLowerCase().includes(buscar));
      // v13.33 Sin filtro explicito, las anuladas NO se listan: el KPI "Total
      // facturas" de arriba ya las excluye y la tabla mostraba mas filas que el
      // numero. Siguen accesibles eligiendo "Anuladas" en el selector. No se
      // borra nada: la anulacion es el registro de que la operacion existio.
      const _anulOcultas = datos.filter(f => f.estado === 'anulada').length;
      if(filtroEstado === 'no_pagada') datos = datos.filter(f => f.estado !== 'pagada' && f.estado !== 'anulada');
    else if(filtroEstado) datos = datos.filter(f => f.estado === filtroEstado);
      else datos = datos.filter(f => f.estado !== 'anulada');
        const all = TODAS_FACTURAS.filter(f => f.empresa === estado.empresa && f.estado !== 'anulada');
        const el1 = document.getElementById('hist-total-facturas');
        const el2 = document.getElementById('hist-pagadas');
        const el3 = document.getElementById('hist-pendientes');
        const el4 = document.getElementById('hist-ventas-mes');
        if (el1) el1.textContent = all.length;
        if (el2) el2.textContent = all.filter(f => f.estado === 'pagada').length;
        if (el3) el3.textContent = all.filter(f => f.estado !== 'pagada').length;
        const mes = new Date().getMonth(), anio = new Date().getFullYear();
        const ventasMes = all.filter(f => { const d = new Date(f.fecha_raw); return d.getMonth() === mes && d.getFullYear() === anio; }).reduce((a, f) => a + f.total, 0);
        if (el4) el4.textContent = fmtUSD(ventasMes);

        if (datos.length === 0) { cont.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--dgray);background:#FFF;border-radius:8px;border:1px solid var(--border)"><i class="ti ti-file-off" style="font-size:48px;display:block;margin-bottom:12px;opacity:0.4"></i><div style="font-size:14px;font-weight:600;color:var(--dgray)">No hay facturas ' + (buscar ? 'que coincidan' : 'aún') + '</div><div style="font-size:12px;margin-top:4px">Las facturas aparecerán aquí al emitirlas</div></div>'; return; }
        let html = '';
        if (!filtroEstado && _anulOcultas > 0) {
          html += '<div style="font-size:11px;color:var(--dgray);margin-bottom:6px">'
               + '<i class="ti ti-eye-off"></i> ' + _anulOcultas + ' anulada'
               + (_anulOcultas === 1 ? '' : 's') + ' oculta' + (_anulOcultas === 1 ? '' : 's')
               + ' \u00b7 elige "Anuladas" en el filtro para verlas</div>';
        }
        html += '<div style="background:#FFF;border-radius:8px;border:1px solid var(--border);overflow:hidden"><table class="data-table" style="margin:0"><thead style="background:var(--sky)"><tr><th style="width:5%">#</th><th>N°</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th class="num">Total</th><th class="num">Saldo</th><th>Estado</th><th>Tipo</th><th class="center" style="width:60px">Acción</th></tr></thead><tbody>';
        datos.forEach((f, idx) => {
          const anuladaStyle = f.estado === 'anulada' ? 'opacity:0.55;text-decoration:line-through' : '';
          const rowBg = idx % 2 ? 'background:#FAFBFC' : '';
          html += `<tr style="cursor:pointer;${anuladaStyle};${rowBg}" onclick="verDetalleFactura('${f.num}')" onmouseover="this.style.background='#F0F7FF'" onmouseout="this.style.background='${idx % 2 ? '#FAFBFC' : '#FFF'}'">
        <td class="center" style="color:var(--dgray);font-size:11px">${idx + 1}</td>
        <td style="font-weight:700;color:var(--navy);font-family:monospace;font-size:12px">${f.num}</td>
        <td style="font-size:11.5px">${f.fecha}</td>
        <td><strong>${f.cliente}</strong></td>
        <td style="font-size:11.5px;color:var(--dgray)">${f.vendedor || '—'}</td>
        <td class="num" style="font-weight:700">${fmtUSD(f.total)}</td>
        <td class="num" style="color:${f.saldo_pendiente > 0 ? 'var(--red)' : 'var(--green)'};font-weight:600">${f.saldo_pendiente > 0 ? fmtUSD(f.saldo_pendiente) : '—'}</td>
        <td>${estadoBadge(f.estado)}</td>
        <td style="font-size:11px">${etiquetaCredito(f)}</td>
        <td class="center"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();abrirAnular('${f.num}','${f.cliente}')" ${f.estado === 'anulada' ? 'disabled' : ''} title="Anular"><i class="ti ti-x"></i></button></td>
      </tr>`;
        });
        html += '</tbody></table></div>';
        cont.innerHTML = html;
      } else {
        let datos = COTIZACIONES.filter(c => c.empresa === estado.empresa);
        if (buscar) datos = datos.filter(c => (c.num || '').toLowerCase().includes(buscar) || (c.cliente || '').toLowerCase().includes(buscar));
        if (datos.length === 0) { cont.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--dgray);background:#FFF;border-radius:8px;border:1px solid var(--border)"><i class="ti ti-file-off" style="font-size:48px;display:block;margin-bottom:12px;opacity:0.4"></i><div style="font-size:14px;font-weight:600">No hay cotizaciones aún</div></div>'; return; }
        let html = '<div style="background:#FFF;border-radius:8px;border:1px solid var(--border);overflow:hidden"><table class="data-table" style="margin:0"><thead style="background:var(--sky)"><tr><th style="width:5%">#</th><th>N°</th><th>Fecha</th><th>Vence</th><th>Cliente</th><th class="num">Total</th><th>Estado</th><th class="center" style="width:130px">Acciones</th></tr></thead><tbody>';
        datos.forEach((c, idx) => {
          const rowBg = idx % 2 ? 'background:#FAFBFC' : '';
          const puedeFacturar = c.estado === 'activa' || c.estado === 'por_vencer';
          html += `<tr style="${rowBg}" onmouseover="this.style.background='#F0F7FF'" onmouseout="this.style.background='${idx % 2 ? '#FAFBFC' : '#FFF'}'">
        <td class="center" style="color:var(--dgray);font-size:11px">${idx + 1}</td>
        <td style="font-weight:700;color:var(--navy);font-family:monospace;font-size:12px">${c.num}</td>
        <td style="font-size:11.5px">${c.fecha}</td>
        <td style="font-size:11.5px">${c.vence}</td>
        <td><strong>${c.cliente}</strong></td>
        <td class="num" style="font-weight:700">${fmtUSD(c.total)}</td>
        <td>${estadoBadge(c.estado)}</td>
        <td class="center"><button class="btn btn-primary btn-sm" onclick="convertirCotizacionAFactura(${c.id || 'null'},'${c.num}')" ${puedeFacturar ? '' : 'disabled'} title="Convertir a factura"><i class="ti ti-file-invoice"></i> Facturar</button></td>
      </tr>`;
        });
        html += '</tbody></table></div>';
        cont.innerHTML = html;
      }
    }

    // v13.12 TRAZABILIDAD DEL PAGO EN DIVISAS.
    // En el documento tiene que quedar escrito: cuanto se cobro en efectivo,
    // que parte fue conversion (no es descuento) y que parte se regalo de
    // verdad. Si no se distingue, dentro de tres meses nadie sabe si un total
    // bajo fue la brecha del dia o una concesion comercial.
    // v13.33 Las tasas con las que se emitio la factura quedan guardadas
    // (facturas.tasa_bcv / tasa_par / factor_bs) pero no se veian en ninguna
    // parte. Sin eso, ver un total de $592 saldado con un pago de $492,30
    // parece un error, cuando es la brecha de ese dia. Es informacion interna:
    // no sale en el documento que se le entrega al cliente.
    function _bloqueTasas(f) {
      const tb = parseFloat(f.tasa_bcv), tp = parseFloat(f.tasa_par);
      const hayBcv = isFinite(tb) && tb > 0, hayPar = isFinite(tp) && tp > 0;
      if (!hayBcv && !hayPar) return '';
      const fila = (et, val, extra) => '<div style="display:flex;justify-content:space-between;gap:10px;'
        + 'font-size:11.5px;margin-bottom:3px' + (extra || '') + '">'
        + '<span style="color:var(--dgray)">' + et + '</span><strong style="font-variant-numeric:tabular-nums">'
        + val + '</strong></div>';
      let filas = '';
      if (hayBcv) filas += fila('BCV al emitir', fmtBS(tb));
      if (hayPar) filas += fila('Paralelo al emitir', fmtBS(tp));
      if (hayBcv && hayPar) {
        const br = (tp / tb - 1) * 100;
        filas += fila('Brecha de ese día', br.toFixed(2) + '%');
      }
      const fac = f.factor_bs != null ? parseFloat(f.factor_bs) : null;
      if (fac != null && isFinite(fac) && Math.abs(fac - 1) > 0.0001) {
        filas += fila('Resguardo congelado', ((fac - 1) * 100).toFixed(2) + '%');
      }
      if (hayBcv) {
        filas += fila('Total en Bs (a BCV congelado)', fmtBS((f.total || 0) * (fac || 1)  * tb),
          ';border-top:1px solid var(--border);padding-top:5px;margin-top:5px');
      }
      let nota = '';
      if (hayBcv && hayPar) {
        const verde = (f.total || 0) / (tp / tb);
        nota = '<div style="font-size:10.5px;color:var(--dgray);line-height:1.45;margin-top:6px;'
          + 'border-top:1px solid var(--border);padding-top:5px">'
          + 'El total está en $BCV. En efectivo valía <strong>' + fmtUSD(verde)
          + '</strong> ese día — por eso un pago menor puede dejar la factura en cero.</div>';
      }
      return '<div style="background:#F5F5F5;border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-top:8px">'
        + '<div style="font-size:10.5px;text-transform:uppercase;font-weight:700;color:var(--dgray);margin-bottom:6px">'
        + 'Tasas congeladas <span style="color:#999;font-weight:600">· interno</span></div>' + filas + nota + '</div>';
    }

    function _bloqueDivisas(f, pagos) {
      const enUsd = (pagos || []).filter(p => (p.metodo || '').toLowerCase().indexOf('usd') >= 0
        || (p.metodo || '').toLowerCase().indexOf('divisa') >= 0
        || (p.metodo || '').toLowerCase().indexOf('efectivo $') >= 0);
      const dto = parseFloat(f.descuento_manual) || 0;
      const motivo = f.motivo_descuento || '';
      const huboDivisas = enUsd.length > 0 || motivo.indexOf('Pago en divisas') >= 0;
      if (!huboDivisas && dto <= 0) return '';
      let filas = '';
      if (huboDivisas) {
        const montoUsd = enUsd.reduce((a, p) => a + (parseFloat(p.monto_usd) || 0), 0);
        filas += '<div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">'
          + '<span><i class="ti ti-coins"></i> Pagado en divisas:</span><strong>' + fmtUSD(montoUsd) + '</strong></div>';
      }
      if (dto > 0) {
        filas += '<div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px;color:var(--red)">'
          + '<span>Descuento registrado:</span><strong>' + fmtUSD(dto) + '</strong></div>';
      }
      if (motivo) {
        filas += '<div style="font-size:10.5px;color:var(--dgray);line-height:1.45;border-top:1px solid var(--border);padding-top:5px;margin-top:4px">'
          + motivo + '</div>';
      }
      return '<div style="background:#FFF8E1;border:1px solid var(--gold);border-radius:8px;padding:10px 12px;margin-top:8px">'
        + '<div style="font-size:10.5px;text-transform:uppercase;font-weight:700;color:#5D4037;margin-bottom:6px">'
        + 'Forma de pago y descuentos</div>' + filas + '</div>';
    }

    async function verDetalleFactura(num) {
      const f = TODAS_FACTURAS.find(x => x.num === num);
      if (!f) { notif('Factura no encontrada', 'error'); return; }

      let items = [], pagos = [], motivoAnul = '', fechaAnul = '';
      if (_sb && _supabaseConectado && f.id) {
        try {
          const [itemsRes, pagosRes, factRes] = await Promise.all([
            _sb.from('factura_items').select('*').eq('factura_id', f.id),
            _sb.from('pagos').select('*').eq('factura_id', f.id).order('fecha'),
            _sb.from('facturas').select('motivo_anulacion,fecha_anulacion').eq('id', f.id).single()
          ]);
          items = itemsRes.data || [];
          pagos = pagosRes.data || [];
          if (factRes.data) {
            motivoAnul = factRes.data.motivo_anulacion || '';
            fechaAnul = factRes.data.fecha_anulacion || '';
          }
        } catch (e) { console.error('[ARJ] Error cargando detalle:', e); }
      }

      const estadoBadge = (est) => {
        const map = { pagada: 'background:var(--lgreen);color:var(--green)', pendiente: 'background:var(--lgold);color:var(--gold)', parcial: 'background:#E3F2FD;color:var(--blue)', vencida: 'background:var(--lred);color:var(--red)', anulada: 'background:#F5F5F5;color:#999' };
        return `<span style="${map[est] || ''};padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700;text-transform:uppercase">${est}</span>`;
      };

      let itemsHTML = items.length ? items.map((it, i) => `
    <tr><td class="center">${i + 1}</td><td style="font-family:monospace;font-weight:600">${it.cod_alt}</td><td>${it.descripcion}</td><td class="num">${it.cantidad}</td><td class="num">${fmtUSD(it.precio_unitario)}</td><td class="num"><strong>${fmtUSD(it.total_linea)}</strong></td></tr>
  `).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--dgray);padding:20px">Sin ítems registrados</td></tr>';

      // v13.33 Se muestran los bolivares realmente movidos debajo del monto:
      // en un pago movil, el Bs es la cifra que aparece en el comprobante del
      // banco y es lo unico con lo que se puede conciliar.
      let pagosHTML = pagos.length ? pagos.map(p => {
        const bs = parseFloat(p.monto_bs) || 0;
        return `
    <tr><td>${new Date(p.fecha).toLocaleString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td><td>${p.metodo}</td><td>${p.referencia || '—'}</td><td class="num"><strong>${fmtUSD(p.monto_usd)}</strong>${Math.abs(bs) > 0.009 ? `<div style="font-size:10px;color:var(--dgray);font-weight:400">${fmtBS(bs)}</div>` : ''}</td></tr>`;
      }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--dgray);padding:14px">Sin pagos registrados</td></tr>';

      const anuladaBox = (f.estado === 'anulada' && motivoAnul) ? `
    <div style="background:var(--lred);border:2px solid var(--red);border-radius:8px;padding:12px 14px;margin-bottom:14px">
      <div style="font-weight:700;color:var(--red);font-size:13px;margin-bottom:6px"><i class="ti ti-ban"></i> FACTURA ANULADA</div>
      <div style="font-size:12px;color:#5D1A1A"><strong>Fecha:</strong> ${fechaAnul ? new Date(fechaAnul).toLocaleString('es-VE') : '—'}</div>
      <div style="font-size:12px;color:#5D1A1A;margin-top:4px"><strong>Motivo:</strong> ${motivoAnul}</div>
    </div>` : '';

      const html = `
    <div class="modal-content" style="max-width:900px;text-align:left;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:2px solid var(--border);padding-bottom:12px">
        <div>
          <h2 style="margin:0;font-size:18px;color:var(--navy)"><i class="ti ti-file-invoice"></i> Factura ${f.num}</h2>
          <div style="font-size:11.5px;color:var(--dgray);margin-top:4px">${f.fecha} · ${nombreEmpresa(f.empresa)} · Vendedor: ${f.vendedor || '—'}</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="cerrarDetalleFactura()"><i class="ti ti-x"></i></button>
      </div>

      ${anuladaBox}

      <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">
        <div style="background:var(--sky);border-radius:8px;padding:12px 14px">
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:600;margin-bottom:4px">Cliente</div>
          <div style="font-weight:700;font-size:14px;color:var(--navy)">${f.cliente}</div>
        </div>
        <div style="background:#FFF8E1;border-radius:8px;padding:12px 14px;text-align:right">
          <div style="font-size:11px;color:#5D4037;text-transform:uppercase;font-weight:600;margin-bottom:4px">Estado</div>
          <div>${estadoBadge(f.estado)}</div>
          <div style="font-size:11px;color:#5D4037;margin-top:4px">${etiquetaCredito(f)}${f.tipo_pago === 'credito' ? ' · Vence: ' + (f.vence || '—') : ''}</div>
        </div>
      </div>

      <div style="margin-bottom:14px">
        <h3 style="font-size:13px;color:var(--navy);margin-bottom:8px"><i class="ti ti-list"></i> Productos</h3>
        <table class="data-table" style="margin:0">
          <thead style="background:var(--sky)"><tr><th style="width:5%" class="center">#</th><th style="width:15%">Código</th><th>Descripción</th><th class="num" style="width:8%">Cant.</th><th class="num" style="width:12%">P.Unit</th><th class="num" style="width:13%">Total</th></tr></thead>
          <tbody>${itemsHTML}</tbody>
        </table>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <h3 style="font-size:13px;color:var(--navy);margin-bottom:8px"><i class="ti ti-cash"></i> Historial de pagos</h3>
          <table class="data-table" style="margin:0;font-size:11px">
            <thead style="background:var(--sky)"><tr><th>Fecha</th><th>Método</th><th>Ref.</th><th class="num" title="Dólares en efectivo (verde) — no $BCV">Cobrado $</th></tr></thead>
            <tbody>${pagosHTML}</tbody>
          </table>
        </div>
        <div>
          <div style="background:var(--navy);color:#FFF;border-radius:8px;padding:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px"><span style="opacity:0.8">Subtotal:</span><span style="font-weight:700">${fmtUSD(f.total)}</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px;color:var(--lgold)"><span style="opacity:0.8">IVA (exento):</span><span>$0.00</span></div>
            <div style="border-top:1px solid rgba(255,255,255,0.2);padding-top:8px;display:flex;justify-content:space-between;font-size:16px;font-weight:800"><span>TOTAL:</span><span>${fmtUSD(f.total)}</span></div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--lgreen)"><span style="opacity:0.8">Abonado:</span><span style="font-weight:700">${fmtUSD(f.abonado || 0)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:${f.saldo_pendiente > 0 ? '#FFCDD2' : '#C8E6C9'}"><span>Saldo pendiente:</span><span>${fmtUSD(f.saldo_pendiente || 0)}</span></div>
          </div>
          ${_bloqueDivisas(f, pagos)}
          ${_bloqueTasas(f)}
          ${f.estado !== 'anulada' && f.estado !== 'pagada' ? `<button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="abrirAbono('${f.num}')"><i class="ti ti-cash-banknote"></i> Registrar abono</button>` : ''}
          ${f.estado !== 'anulada' ? `<button class="btn btn-secondary" style="width:100%;margin-top:6px" onclick="reimprimirFactura('${f.num}')"><i class="ti ti-printer"></i> Reimprimir</button>` : ''}
          ${f.estado !== 'anulada' ? `<button class="btn btn-secondary" style="width:100%;margin-top:6px;color:var(--red);border-color:var(--red)" onclick="cerrarDetalleFactura();abrirAnular('${f.num}','${f.cliente}')"><i class="ti ti-ban"></i> Anular factura</button>` : ''}
        </div>
      </div>
    </div>`;

      // Crear o reusar modal
      let modal = document.getElementById('modal-detalle-factura');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-detalle-factura';
        modal.className = 'modal';
        document.body.appendChild(modal);
      }
      modal.innerHTML = html;
      modal.classList.add('show');
    }

    function cerrarDetalleFactura() {
      const m = document.getElementById('modal-detalle-factura');
      if (m) m.classList.remove('show');
    }

    // REIMPRIMIR factura existente
    async function reimprimirFactura(num) {
      const f = TODAS_FACTURAS.find(x => x.num === num);
      if (!f) { notif('Factura no encontrada', 'error'); return; }
      let items = [];
      if (_sb && _supabaseConectado && f.id) {
        const { data } = await _sb.from('factura_items').select('*').eq('factura_id', f.id);
        items = data || [];
      }
      // Llenar el doc de impresión
      const tbcv = f.tasa_bcv || estado.tasa_bcv;
      const tpar = f.tasa_par || estado.tasa_par;
      const factor = (f.factor_bs != null && f.factor_bs > 0)
        ? parseFloat(f.factor_bs)
        : colchonFactorCon(tpar, tbcv);
      // Datos del cliente CONGELADOS al emitir. Si la factura es vieja y no tiene
      // snapshot, se cae al cliente actual (comportamiento anterior).
      const cliente = CLIENTES.find(c => c.id === f.cliente_id) || { nombre: f.cliente, rif: '—', tel: '—' };
      const cliNom = f.cliente_nombre_snap || cliente.nombre || f.cliente;
      const cliRif = f.cliente_rif_snap || cliente.rif || '—';
      const cliTel = f.cliente_tel_snap || cliente.tel || '—';
      const cliDir = f.cliente_dir_snap || cliente.direccion || '—';
      document.getElementById('dc-numero').textContent = f.num;
      document.getElementById('dc-fecha').textContent = f.fecha;
      document.getElementById('dc-fecha2').textContent = f.fecha;
      document.getElementById('dc-vence').textContent = f.vence || '—';
      document.getElementById('dc-cli-nombre').textContent = cliNom;
      document.getElementById('dc-cli-rif').textContent = 'RIF: ' + cliRif;
      document.getElementById('dc-cli-tel').textContent = 'Teléfono: ' + cliTel;
      document.getElementById('dc-cli-dir').textContent = 'Dirección: ' + cliDir;
      document.getElementById('dc-vendedor').textContent = f.vendedor || '—';
      document.getElementById('dc-empresa-op').textContent = nombreEmpresa(f.empresa);
      document.getElementById('dc-items').innerHTML = items.map((it, i) => `<tr><td>${i + 1}</td><td><strong>${it.cod_alt}</strong></td><td>${it.descripcion}</td><td class="num">${it.cantidad}</td><td class="num">${fmtUSD(it.precio_unitario)}</td><td class="num"><strong>${fmtUSD(it.total_linea)}</strong></td></tr>`).join('');
      document.getElementById('dc-subtotal').textContent = fmtUSD(f.total);
      document.getElementById('dc-total').textContent = fmtUSD(f.total);
      document.getElementById('dc-equiv').innerHTML = '<strong>Cobrar en Bs.:</strong> ' + fmtBS(f.total * factor * tbcv);
      document.querySelector('.dc-num-label').textContent = 'FACTURA';
      const h2r = document.querySelector('#modal-print-cotizacion h2');
  if(h2r) h2r.innerHTML = '<i class="ti ti-printer"></i> Factura: ' + f.num;
  const vl2 = document.getElementById('dc-vence-label');
  if(vl2) vl2.textContent = 'Vence:';
      cerrarDetalleFactura();
      document.getElementById('modal-print-cotizacion').classList.add('show');
    }

    // ABRIR MODAL DE ABONO