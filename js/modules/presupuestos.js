// === Presupuestos / Cotizaciones ===
    // ═══════════════════════════════════════════════════════════════
    // COTIZACIONES
    // ═══════════════════════════════════════════════════════════════
    function renderCotizaciones() {
      const tbody = document.getElementById('cotizaciones-body');
      if (!tbody) return;
      // FILTRO POR EMPRESA
      const delaEmpresa = COTIZACIONES.filter(c => c.empresa === estado.empresa);

      // KPIs vivos (antes estaban en 0 fijo en el HTML)
      const nAct = delaEmpresa.filter(c => c.estado === 'activa').length;
      const nPor = delaEmpresa.filter(c => c.estado === 'por_vencer').length;
      const nVen = delaEmpresa.filter(c => c.estado === 'vencida').length;
      const nCon = delaEmpresa.filter(c => c.estado === 'convertida').length;
      const nRec = delaEmpresa.filter(c => c.estado === 'rechazada').length;
      const setK = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      setK('pre-kpi-activas', nAct); setK('pre-kpi-porvencer', nPor);
      setK('pre-kpi-vencidas', nVen); setK('pre-kpi-convertidas', nCon);
      const cerrados = nCon + nRec;
      const tasaEl = document.getElementById('pre-kpi-tasa');
      if (tasaEl) tasaEl.textContent = cerrados > 0 ? (Math.round(nCon / cerrados * 100) + '% de cierre') : '—';

      // Los rechazados se ocultan salvo que el usuario los pida
      const verRech = document.getElementById('pre-ver-rechazados')?.checked;
      const filtradas = delaEmpresa.filter(c => verRech ? true : c.estado !== 'rechazada');

      if (filtradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--dgray)">Sin presupuestos en ' + nombreEmpresa(estado.empresa) + '</td></tr>';
        return;
      }
      tbody.innerHTML = filtradas.map(c => {
        let badgeColor, badgeText, badgeIcon;
        if (c.estado === 'rechazada') { badgeColor = 'var(--dgray)'; badgeText = 'RECHAZADA'; badgeIcon = 'ti-archive'; }
        else if (c.estado === 'convertida') { badgeColor = 'var(--blue)'; badgeText = 'CONVERTIDA'; badgeIcon = 'ti-file-invoice'; }
        else if (c.estado === 'vencida') { badgeColor = 'var(--red)'; badgeText = 'VENCIDA'; badgeIcon = 'ti-x-circle'; }
        else if (c.estado === 'por_vencer') { badgeColor = 'var(--gold)'; badgeText = 'POR VENCER'; badgeIcon = 'ti-alert-triangle'; }
        else { badgeColor = 'var(--green)'; badgeText = 'ACTIVA'; badgeIcon = 'ti-circle-check'; }
        const diasTxt = c.dias_restantes >= 0 ? `${c.dias_restantes} días restantes` : `Venció hace ${Math.abs(c.dias_restantes)} días`;
        const puedeFacturar = c.estado === 'activa' || c.estado === 'por_vencer';
        const puedeRechazar = c.estado !== 'convertida' && c.estado !== 'rechazada';
        return `<tr${c.estado === 'rechazada' ? ' style="opacity:0.55"' : ''}>
      <td><strong>${c.num}</strong><div style="font-size:10.5px;color:var(--dgray)">${c.items} ítems · ${c.vendedor}</div></td>
      <td>${c.cliente}</td>
      <td style="font-size:11.5px">${c.fecha}</td>
      <td style="font-size:11.5px">${c.vence}<div style="font-size:10.5px;color:var(--dgray)">${diasTxt}</div></td>
      <td class="num"><strong>${fmtUSD(c.total)}</strong></td>
      <td><span style="background:${badgeColor}22;color:${badgeColor};padding:3px 8px;border-radius:10px;font-size:10.5px;font-weight:600"><i class="ti ${badgeIcon}"></i> ${badgeText}</span></td>
      <td style="text-align:center;white-space:nowrap">
        <button class="btn btn-secondary btn-sm" onclick="verPresupuesto(${c.id || 'null'})" title="Ver / imprimir"><i class="ti ti-eye"></i></button>
        ${puedeFacturar ? `<button class="btn btn-green btn-sm" onclick="convertirCotizacionAFactura(${c.id || 'null'},'${c.num}')" title="Convertir a factura"><i class="ti ti-file-invoice"></i></button>` : ''}
        ${puedeRechazar ? `<button class="btn btn-red btn-sm" onclick="rechazarPresupuesto(${c.id || 'null'},'${c.num}')" title="Marcar como rechazado (se archiva, no se borra)"><i class="ti ti-archive"></i></button>` : ''}
      </td>
    </tr>`;
      }).join('');
    }

    // Marcar un presupuesto como rechazado. NUNCA se borra de Supabase:
    // conservar el historial permite medir la tasa de conversión real.
    async function rechazarPresupuesto(cotId, cotNum) {
      if (!cotId) { notif('Presupuesto sin ID', 'error'); return; }
      if (!confirm('¿Marcar ' + cotNum + ' como RECHAZADO?\n\nNo se borra: se archiva y deja de aparecer en la lista.\nPuedes verlo activando "Ver rechazados".')) return;
      try {
        const { error } = await _sb.from('cotizaciones').update({ estado: 'rechazada' }).eq('id', cotId);
        if (error) { notif('Error: ' + error.message, 'error'); return; }
        const cl = COTIZACIONES.find(c => c.id === cotId);
        if (cl) cl.estado = 'rechazada';
        renderCotizaciones();
        notif('✓ ' + cotNum + ' archivado como rechazado', 'success');
        logBitacora('factura', 'Marcó presupuesto ' + cotNum + ' como rechazado', false);
      } catch (err) { notif('Error: ' + (err.message || err), 'error'); }
    }

    // Ver / reimprimir un presupuesto guardado (antes era un notif de demo)
    async function verPresupuesto(cotId) {
      if (!cotId) { notif('Presupuesto sin ID, no se puede mostrar', 'error'); return; }
      try {
        const { data: cot, error: e1 } = await _sb.from('cotizaciones').select('*').eq('id', cotId).single();
        if (e1 || !cot) { notif('Presupuesto no encontrado', 'error'); return; }
        const { data: items } = await _sb.from('cotizacion_items').select('*').eq('cotizacion_id', cotId);
        const cli = CLIENTES.find(c => c.id === cot.cliente_id);
        const fechaTxt = new Date(cot.fecha).toLocaleDateString('es-VE');
        const venceTxt = new Date(cot.fecha_vence).toLocaleDateString('es-VE');
        const total = parseFloat(cot.subtotal_usd) || 0;
        document.getElementById('dc-numero').textContent = cot.numero;
        document.getElementById('dc-fecha').textContent = fechaTxt;
        const f2 = document.getElementById('dc-fecha2'); if (f2) f2.textContent = fechaTxt;
        document.getElementById('dc-vence').textContent = venceTxt;
        document.getElementById('dc-cli-nombre').textContent = cot.cliente_nombre || (cli ? cli.nombre : '—');
        document.getElementById('dc-cli-rif').textContent = 'RIF: ' + (cli ? cli.rif : '—');
        document.getElementById('dc-cli-tel').textContent = 'Teléfono: ' + (cli && cli.tel ? cli.tel : '—');
        document.getElementById('dc-cli-dir').textContent = 'Dirección: ' + (cli && cli.direccion ? cli.direccion : '—');
        document.getElementById('dc-vendedor').textContent = cot.vendedor || '—';
        document.getElementById('dc-empresa-op').textContent = nombreEmpresa(cot.empresa);
        document.getElementById('dc-items').innerHTML = (items || []).map((it, i) =>
          `<tr><td>${i + 1}</td><td><strong>${it.cod_alt}</strong></td><td>${it.descripcion}</td><td class="num">${it.cantidad}</td><td class="num">${fmtUSD(parseFloat(it.precio_unitario))}</td><td class="num"><strong>${fmtUSD(parseFloat(it.total_linea))}</strong></td></tr>`).join('');
        document.getElementById('dc-subtotal').textContent = fmtUSD(total);
        document.getElementById('dc-total').textContent = fmtUSD(total);
        // Presupuesto: el Bs se muestra a tasa de HOY (es una oferta viva, no un documento fiscal)
        document.getElementById('dc-equiv').innerHTML = '<strong>Cobrar en Bs.:</strong> ' + fmtBS(total * colchonFactor() * estado.tasa_bcv) + ' <span style="font-size:10px;color:var(--dgray)">(a tasa de hoy)</span>';
        document.querySelector('.dc-num-label').textContent = 'PRESUPUESTO';
        const h2v = document.querySelector('#modal-print-cotizacion h2');
        if (h2v) h2v.innerHTML = '<i class="ti ti-file-text"></i> Presupuesto: ' + cot.numero;
        document.getElementById('modal-print-cotizacion').classList.add('show');
      } catch (err) {
        console.error('[ARJ] Error mostrando presupuesto:', err);
        notif('Error: ' + (err.message || err), 'error');
      }
    }

    // ─── NUEVO FLUJO DE PRESUPUESTO (pantalla completa) ───
    let preEstado = { cliente: null, tier: 'Publico', items: [] };

    function nuevaCotizacion() {
      // Ir a la pantalla completa de nuevo presupuesto
      preLimpiar();
      preLlenarClientes();
      document.getElementById('pre-empresa').textContent = nombreEmpresa(estado.empresa);
      // Navegar a la página
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-nuevo-presupuesto').classList.add('active');
    }

    function preLlenarClientes() {
      const sel = document.getElementById('pre-cliente-select');
      sel.innerHTML = '<option value="">-- Selecciona un cliente --</option>';
      CLIENTES.filter(c => c.empresa === estado.empresa || c.empresa === 'ambas').forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.nombre + ' (' + c.rif + ')';
        sel.appendChild(opt);
      });
    }

    function preSeleccionarCliente() {
      const id = parseInt(document.getElementById('pre-cliente-select').value);
      preEstado.cliente = CLIENTES.find(c => c.id === id) || null;
      if (preEstado.cliente) {
        // En Venta Directa siempre público; en Distribuidora el nivel del cliente
        preEstado.tier = estado.empresa === 'directa' ? 'Publico' : preEstado.cliente.nivel;
        document.querySelectorAll('[data-pretier]').forEach(b => b.classList.toggle('active', b.dataset.pretier === preEstado.tier));
        preActualizarPrecios();
        preRecalcular();
      }
    }

    function preCambiarTier(t) {
      preEstado.tier = t;
      document.querySelectorAll('[data-pretier]').forEach(b => b.classList.toggle('active', b.dataset.pretier === t));
      preActualizarPrecios();
      preRecalcular();
    }

    function preActualizarPrecios() {
      preEstado.items.forEach(it => {
        const p = PRODUCTOS.find(x => x.cod_alt === it.cod_alt);
        it.precio = precioConTier(it.fob, preEstado.tier, p);
      });
      preRenderItems();
    }

    function preBuscarProducto() {
      const q = document.getElementById('pre-busqueda-prod').value.trim();
      const sis = document.getElementById('pre-busqueda-sistema')?.value || '';
      const cont = document.getElementById('pre-search-results');
      if (!q && !sis) { cont.classList.remove('show'); return; }
      const qNorm = normalize(q);
      const words = qNorm.split(/\s+/).filter(w => w.length >= 1);
      const matches = PRODUCTOS.filter(p => {
        if (sis && (p.sistema || '') !== sis) return false;
        if (!q) return true;
        const hay = normalize(p.cod_alt + ' ' + p.cod_orig + ' ' + (p.cod_barras || '') + ' ' + p.desc + ' ' + p.marca);
        return words.every(w => hay.includes(w));
      }).slice(0, 12);
      if (matches.length === 0) {
        cont.innerHTML = '<div class="search-item" style="color:var(--dgray);cursor:default"><span>Sin resultados</span></div>';
        cont.classList.add('show'); return;
      }
      cont.innerHTML = matches.map(p => {
        const precio = precioConTier(p.fob, preEstado.tier, p);
        const stock = estado.empresa === 'directa' ? p.stock_vd : p.stock_dist;
        const aplicTxt = p.sistema ? `<div style="font-size:10.5px;color:var(--blue);margin-top:2px"><i class="ti ti-settings" style="font-size:10px"></i> ${p.sistema}${p.marca_modelo ? ' · ' + p.marca_modelo.substring(0, 30) : ''}</div>` : '';
        return `<div class="search-item" onclick="preAgregarProducto('${p.cod_alt}')">
      <div style="flex:1"><div class="codigo">${p.cod_alt} · ${p.marca}</div><div class="desc">${p.desc}</div>${aplicTxt}</div>
      <div style="text-align:right"><div class="precio">${fmtUSD(precio)}</div><div class="stock">Stock: ${stock}</div></div>
    </div>`;
      }).join('');
      cont.classList.add('show');
    }

    function preAgregarProducto(cod) {
      const p = PRODUCTOS.find(x => x.cod_alt === cod);
      if (!p) return;
      const ex = preEstado.items.find(i => i.cod_alt === cod);
      if (ex) { ex.cant += 1; }
      else {
        preEstado.items.push({ producto_id: p.id, cod_alt: p.cod_alt, desc: p.desc, marca: p.marca, fob: p.fob, cant: 1, precio: precioConTier(p.fob, preEstado.tier, p) });
      }
      document.getElementById('pre-busqueda-prod').value = '';
      document.getElementById('pre-search-results').classList.remove('show');
      preRenderItems();
      preRecalcular();
    }

    function preRenderItems() {
      const tbody = document.getElementById('pre-items-body');
      if (preEstado.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--dgray)">No has agregado productos. Usa el buscador de arriba ↑</td></tr>';
        return;
      }
      tbody.innerHTML = preEstado.items.map((it, i) => `
    <tr>
      <td><strong>${it.cod_alt}</strong></td>
      <td>${it.desc}<div style="font-size:11px;color:var(--dgray)">${it.marca}</div></td>
      <td class="num"><input type="number" class="qty-cell" value="${it.cant}" min="1" onchange="preCambiarCant(${i},this.value)"></td>
      <td class="num">${fmtUSD(it.precio)}</td>
      <td class="num"><strong>${fmtUSD(it.cant * it.precio)}</strong></td>
      <td><button class="del-btn" onclick="preQuitarItem(${i})"><i class="ti ti-x"></i></button></td>
    </tr>${sinFob(it) ? `<tr><td colspan="6" style="padding:0"><div style="margin:0;background:#FDECEA;border-left:3px solid var(--red);padding:8px 12px;font-size:11.5px;color:#8B1A10;display:flex;gap:8px;align-items:flex-start">
      <i class="ti ti-alert-octagon" style="font-size:15px;margin-top:1px"></i>
      <div><strong>${it.cod_alt} no tiene costo cargado (FOB en 0).</strong> ${it.precio > 0 ? 'El precio no est\u00e1 respaldado por un costo.' : 'Saldr\u00eda en el presupuesto a $0,00.'} No se podr\u00e1 guardar ni imprimir hasta corregir el FOB en Inventario.</div></div></td></tr>` : ''}`).join('');
    }

    // v13.18 Validador de FOB del flujo de presupuesto. Devuelve true si se
    // puede seguir. Un solo sitio para los dos botones (Imprimir y Convertir),
    // asi no se puede arreglar uno y olvidar el otro.
    function preValidarFob() {
      const sinCosto = preEstado.items.filter(sinFob);
      if (sinCosto.length === 0) return true;
      const lista = sinCosto.map(it => '\u2022 ' + it.cod_alt + ' \u2014 ' + (it.desc || 'sin descripcion')).join('\n');
      alert('No se puede guardar el presupuesto: ' + sinCosto.length + (sinCosto.length === 1 ? ' producto no tiene' : ' productos no tienen') + ' costo cargado (FOB en 0).\n\n' + lista + '\n\nEl presupuesto se le entrega al cliente y el precio queda comprometido. Corrige el FOB en Inventario, o quita el producto del presupuesto.');
      notif('Presupuesto bloqueado: ' + sinCosto.length + ' producto(s) sin FOB', 'error');
      return false;
    }

    function preCambiarCant(i, v) { preEstado.items[i].cant = parseInt(v) || 1; preRenderItems(); preRecalcular(); }
    function preQuitarItem(i) { preEstado.items.splice(i, 1); preRenderItems(); preRecalcular(); }

    function preRecalcular() {
      const total = preEstado.items.reduce((a, i) => a + i.cant * i.precio, 0);
      const _fPre = colchonFactor();
      document.getElementById('pre-t-subtotal').textContent = fmtUSD(total);
      document.getElementById('pre-t-total').textContent = fmtUSD(total);
      document.getElementById('pre-t-bs').textContent = fmtBS(total * _fPre * estado.tasa_bcv);
    }

    function preLimpiar() {
      preEstado = { cliente: null, tier: 'Publico', items: [] };
      const sel = document.getElementById('pre-cliente-select'); if (sel) sel.value = '';
      const notas = document.getElementById('pre-notas'); if (notas) notas.value = '';
      document.querySelectorAll('[data-pretier]').forEach(b => b.classList.remove('active'));
      preRenderItems();
      preRecalcular();
    }

    async function preImprimir() {
      if (!preEstado.cliente) { notif('Selecciona un cliente', 'error'); return; }
      if (preEstado.items.length === 0) { notif('Agrega al menos un producto', 'error'); return; }
      // v13.18 El presupuesto SI se le entrega al cliente: es un compromiso
      // comercial en papel. Un presupuesto en $0,00 es peor que una factura
      // mala, porque el precio queda congelado al convertirlo a venta.
      if (!tasasListas('guardar el presupuesto')) return;
      if (!preValidarFob()) return;

      notif('Guardando presupuesto...', 'warning');
      const ahora = new Date();
      const venc = new Date(ahora.getTime() + 45 * 86400000);
      const total = preEstado.items.reduce((a, i) => a + i.cant * i.precio, 0);
      const prefijo = estado.empresa === 'directa' ? 'PRE-VD' : 'PRE-DT';
      const tipoContador = estado.empresa === 'directa' ? 'presupuesto_vd' : 'presupuesto_dist';
      const anio = new Date().getFullYear();
      let numero = '';
      let cotizacionId = null;

      try {
        if (_sb && _supabaseConectado) {
          const { data: cont, error: ce } = await _sb.from('contadores').select('*').eq('tipo', tipoContador).eq('anio', anio).single();
          if (!ce && cont) {
            const nuevoNum = cont.ultimo_numero + 1;
            await _sb.from('contadores').update({ ultimo_numero: nuevoNum }).eq('id', cont.id);
            numero = prefijo + '-' + anio + '-' + String(nuevoNum).padStart(4, '0');
          } else { numero = prefijo + '-' + anio + '-' + String(Math.floor(Math.random() * 900) + 100).padStart(4, '0'); }

          const { data: cotIns, error: cotErr } = await _sb.from('cotizaciones').insert({
            numero, empresa: estado.empresa, cliente_id: preEstado.cliente.id,
            cliente_nombre: preEstado.cliente.nombre, vendedor: estado.usuario || 'Sistema',
            fecha_vence: venc.toISOString(), subtotal_usd: total,
            tasa_par: estado.tasa_par, tasa_bcv: estado.tasa_bcv, estado: 'activa'
          }).select().single();
          if (!cotErr && cotIns) {
            cotizacionId = cotIns.id;
            const itemsDB = preEstado.items.map(it => ({
              cotizacion_id: cotizacionId, producto_id: it.producto_id || null,
              cod_alt: it.cod_alt, descripcion: it.desc, cantidad: it.cant,
              fob_unitario: it.fob || 0, precio_unitario: it.precio,
              total_linea: it.cant * it.precio, tier: preEstado.tier || 'Publico'
            }));
            await _sb.from('cotizacion_items').insert(itemsDB);
          }
          _sbLogBitacora(estado.usuario, estado.empresa, 'factura', 'Creó presupuesto ' + numero + ' para ' + preEstado.cliente.nombre, false);
        } else { numero = prefijo + '-' + anio + '-' + String(Math.floor(Math.random() * 900) + 100).padStart(4, '0'); }

        COTIZACIONES.unshift({
          id: cotizacionId, num: numero, empresa: estado.empresa, cliente: preEstado.cliente.nombre,
          fecha: ahora.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
          vence: venc.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
          total, estado: 'activa', dias_restantes: 45, items: preEstado.items.length, vendedor: estado.usuario
        });
      } catch (err) { console.error('[ARJ] Error guardando presupuesto:', err); }
      // Llenar el documento imprimible
      const fechaTxt = ahora.toLocaleDateString('es-VE');
      document.getElementById('dc-numero').textContent = numero;
      document.getElementById('dc-fecha').textContent = fechaTxt;
      document.getElementById('dc-fecha2').textContent = fechaTxt;
      document.getElementById('dc-vence').textContent = venc.toLocaleDateString('es-VE');
      document.getElementById('dc-cli-nombre').textContent = preEstado.cliente.nombre;
      document.getElementById('dc-cli-rif').textContent = 'RIF: ' + preEstado.cliente.rif;
      document.getElementById('dc-cli-tel').textContent = 'Teléfono: ' + (preEstado.cliente.tel || '—');
      document.getElementById('dc-cli-dir').textContent = 'Dirección: —';
      document.getElementById('dc-vendedor').textContent = estado.usuario || '—';
      document.getElementById('dc-empresa-op').textContent = nombreEmpresa(estado.empresa);
      document.getElementById('dc-items').innerHTML = preEstado.items.map((it, i) => `
    <tr><td>${i + 1}</td><td><strong>${it.cod_alt}</strong></td><td>${it.desc}</td><td class="num">${it.cant}</td><td class="num">${fmtUSD(it.precio)}</td><td class="num"><strong>${fmtUSD(it.cant * it.precio)}</strong></td></tr>`).join('');
      document.getElementById('dc-subtotal').textContent = fmtUSD(total);
      document.getElementById('dc-total').textContent = fmtUSD(total);
      const _factorPrint2 = colchonFactor();
      document.getElementById('dc-equiv').innerHTML = '<strong>Cobrar en Bs.:</strong> ' + fmtBS(total * _factorPrint2 * estado.tasa_bcv);
      document.querySelector('.dc-num-label').textContent = 'PRESUPUESTO';
      logBitacora('factura', `Creó presupuesto ${numero} para ${preEstado.cliente.nombre} (válido 45 días) · ${nombreEmpresa(estado.empresa)}`, false);
      document.getElementById('modal-print-cotizacion').classList.add('show');
      notif(`✓ Presupuesto ${numero} guardado — válido 45 días`, 'success');
    }

    async function preConvertirVenta() {
      if (!preEstado.cliente) { notif('Selecciona un cliente', 'error'); return; }
      if (preEstado.items.length === 0) { notif('Agrega al menos un producto', 'error'); return; }
      // v13.18 Este camino tambien GUARDA el presupuesto antes de convertir.
      if (!tasasListas('convertir a venta')) return;
      if (!preValidarFob()) return;

      // FLUJO UNIFICADO: guardar el presupuesto PRIMERO, luego convertir por el
      // mismo camino que el botón de la lista. Si el usuario abandona el carrito,
      // el presupuesto queda guardado y ACTIVO — nunca se pierde trabajo.
      if (_sb && _supabaseConectado) {
        notif('Guardando presupuesto...', 'warning');
        try {
          const ahora = new Date();
          const venc = new Date(ahora.getTime() + 45 * 86400000);
          const total = preEstado.items.reduce((a, i) => a + i.cant * i.precio, 0);
          const prefijo = estado.empresa === 'directa' ? 'PRE-VD' : 'PRE-DT';
          const tipoContador = estado.empresa === 'directa' ? 'presupuesto_vd' : 'presupuesto_dist';
          const anio = ahora.getFullYear();
          let numero = '';
          const { data: cont, error: ce } = await _sb.from('contadores').select('*').eq('tipo', tipoContador).eq('anio', anio).single();
          if (!ce && cont) {
            const nuevoNum = cont.ultimo_numero + 1;
            await _sb.from('contadores').update({ ultimo_numero: nuevoNum }).eq('id', cont.id);
            numero = prefijo + '-' + anio + '-' + String(nuevoNum).padStart(4, '0');
          } else { numero = prefijo + '-' + anio + '-' + String(Math.floor(Math.random() * 900) + 100).padStart(4, '0'); }

          const { data: cotIns, error: cotErr } = await _sb.from('cotizaciones').insert({
            numero, empresa: estado.empresa, cliente_id: preEstado.cliente.id,
            cliente_nombre: preEstado.cliente.nombre, vendedor: estado.usuario || 'Sistema',
            fecha_vence: venc.toISOString(), subtotal_usd: total,
            tasa_par: estado.tasa_par, tasa_bcv: estado.tasa_bcv, estado: 'activa'
          }).select().single();
          if (cotErr || !cotIns) { notif('Error guardando presupuesto: ' + (cotErr ? cotErr.message : ''), 'error'); return; }

          const itemsDB = preEstado.items.map(it => ({
            cotizacion_id: cotIns.id, producto_id: it.producto_id || null,
            cod_alt: it.cod_alt, descripcion: it.desc, cantidad: it.cant,
            fob_unitario: it.fob || 0, precio_unitario: it.precio,
            total_linea: it.cant * it.precio, tier: preEstado.tier || 'Publico'
          }));
          await _sb.from('cotizacion_items').insert(itemsDB);

          COTIZACIONES.unshift({
            id: cotIns.id, num: numero, empresa: estado.empresa, cliente: preEstado.cliente.nombre,
            fecha: ahora.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
            vence: venc.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
            total, estado: 'activa', dias_restantes: 45, items: preEstado.items.length, vendedor: estado.usuario
          });
          _sbLogBitacora(estado.usuario, estado.empresa, 'factura', 'Creó presupuesto ' + numero + ' (convertir ahora) para ' + preEstado.cliente.nombre, false);

          preLimpiar();
          await convertirCotizacionAFactura(cotIns.id, numero, true); // sin confirm: el usuario ya decidió
          return;
        } catch (err) {
          console.error('[ARJ] Error en convertir ahora:', err);
          notif('Error: ' + (err.message || err), 'error');
          return;
        }
      }

      // FALLBACK sin conexión: transferencia directa al carrito (comportamiento anterior)
      estado.cliente = preEstado.cliente;
      estado.tier = preEstado.tier;
      estado.items = preEstado.items.map(it => {
        const p = PRODUCTOS.find(x => x.cod_alt === it.cod_alt);
        return {
          cod: it.cod_alt, cod_alt: it.cod_alt, cod_orig: p ? p.cod_orig : '', desc: it.desc, marca: it.marca, fob: it.fob,
          stock_vd: p ? p.stock_vd : 0, stock_dist: p ? p.stock_dist : 0, precio_manual: p ? p.precio_manual : null,
          cant: it.cant, precio: it.precio, precio_base: it.precio, precio_fijo: true
        };
      });
      estado.pagos = [];
      navTo('facturacion');
      document.getElementById('cliente-select').value = estado.cliente.id;
      seleccionarCliente();
      renderItems();
      agregarPago();
      recalcular();
      notif('Presupuesto convertido a venta. Revisa y emite la factura.', 'success');
    }

    // v13.4: eliminadas cerrarCotizacion(), crearCotizacion() y
    // convertirACotizacion(). Las tres eran codigo muerto del modal borrado.
    // crearCotizacion() usaba Math.random() para el numero y anunciaba exito sin
    // insertar; convertirACotizacion() solo mostraba un aviso "Demo:" (con
    // backtick, por eso sobrevivio a la limpieza de v13.2).

    // ═══════════════════════════════════════════════════════════════
    // APARTADOS
    // ═══════════════════════════════════════════════════════════════

    function limpiarPresupuestosVencidos() {
      // POLÍTICA: nada se borra. Los vencidos se conservan (regla "NUNCA DELETE en
      // cotizaciones"). Se quedan visibles con badge VENCIDA; para sacarlos de la
      // vista, el usuario los marca como rechazados.
      return;
    }


    // CONVERTIR COTIZACIÓN A FACTURA
    // Diseño: aquí SOLO se carga el carrito. La cotización se marca 'convertida'
    // únicamente cuando la factura se EMITE con éxito (ver emitirFactura → _cotOrigen).
    // Así, si el usuario abandona el carrito, el presupuesto sigue activo.
    let _cotOrigen = null; // { id, num } de la cotización cargada al carrito
    async function convertirCotizacionAFactura(cotId, cotNum, skipConfirm) {
      if (!cotId) { notif('Cotización sin ID, no se puede convertir', 'error'); return; }
      if (!skipConfirm && !confirm('¿Convertir cotización ' + cotNum + ' a factura?\n\nSe cargarán los productos al carrito de facturación y podrás emitir la factura.')) return;

      try {
        // Cargar items de la cotización desde Supabase
        const { data: cot, error: e1 } = await _sb.from('cotizaciones').select('*').eq('id', cotId).single();
        if (e1 || !cot) { notif('Cotización no encontrada', 'error'); return; }
        const { data: items, error: e2 } = await _sb.from('cotizacion_items').select('*').eq('cotizacion_id', cotId);
        if (e2) { notif('Error cargando items', 'error'); return; }
        if (!items || items.length === 0) { notif('La cotización no tiene ítems guardados', 'error'); return; }

        // Limpiar carrito actual
        estado.items = [];
        estado.pagos = [];

        // Cargar cliente
        const cliente = CLIENTES.find(c => c.id === cot.cliente_id);
        if (cliente) {
          estado.cliente = cliente;
        } else {
          notif('⚠ El cliente original no está en la lista — selecciónalo manualmente', 'warning');
        }

        // Cargar items al carrito.
        // v13.17: el renglon cotizado solo guarda precio y cantidad. Todo el
        // CONTEXTO (marca, cod_orig, stock, precio_manual, factor) se rescata
        // del catalogo VIVO. El stock tiene que ser el de HOY, no el del dia
        // que se cotizo: guardarlo congelado daria una alerta que miente.
        // El PRECIO no se toca nunca: cotizado = compromiso comercial.
        let _cotSinCatalogo = 0;
        (items || []).forEach(it => {
          const p = (typeof PRODUCTOS !== 'undefined')
            ? PRODUCTOS.find(x => x.cod_alt === it.cod_alt) : null;
          if (!p) _cotSinCatalogo++;
          // FOB congelado de la cotizacion; si vino en 0 se rescata del catalogo
          // para que el margen no se calcule sobre cero (daria 100% falso).
          const _fobCot = parseFloat(it.fob_unitario) || 0;
          estado.items.push({
            producto_id: it.producto_id || (p ? p.id : null),
            cod: it.cod_alt, cod_alt: it.cod_alt,
            cod_orig: p ? p.cod_orig : '',
            desc: it.descripcion,
            marca: p ? p.marca : '',
            cant: it.cantidad,
            precio: parseFloat(it.precio_unitario),
            precio_base: parseFloat(it.precio_unitario), // v13.9: base congelada para descuentos
            precio_fijo: true, // precio COTIZADO: compromiso comercial, no se recalcula
            precio_manual: p ? p.precio_manual : null,
            fob: _fobCot > 0 ? _fobCot : (p ? (parseFloat(p.fob) || 0) : 0),
            stock_vd: p ? p.stock_vd : 0,
            stock_dist: p ? p.stock_dist : 0,
            factor_landed: p ? p.factor_landed : null,
            origen: p ? p.origen : null,
            subtotal: parseFloat(it.total_linea)
          });
        });
        // Producto cotizado que ya no existe en el catalogo: se carga con stock 0
        // (la alerta de stock disparara sola) pero hay que decirlo explicitamente.
        if (_cotSinCatalogo > 0) {
          notif('\u26a0 ' + _cotSinCatalogo + ' producto(s) de la cotizacion ya no estan en el catalogo: quedaron sin marca, sin stock y sin costo. Revisalos antes de emitir.', 'warning');
        }

        // Anotar el origen — la marca 'convertida' se hace al EMITIR
        _cotOrigen = { id: cotId, num: cotNum };

        // Navegar a facturación (la página se llama 'facturacion')
        navTo('facturacion');
        setTimeout(() => {
          if (cliente) {
            const sel = document.getElementById('cliente-select');
            if (sel) {
              sel.value = cliente.id;
              seleccionarCliente();
            }
          }
          renderItems();
          recalcular();
          agregarPago();
        }, 200);

        notif('✓ Cotización ' + cotNum + ' cargada al carrito. Revisa y emite la factura.', 'success');
        logBitacora('factura', 'Cargó cotización ' + cotNum + ' al carrito de facturación', false);
      } catch (err) {
        console.error('[ARJ] Error convirtiendo cotización:', err);
        notif('Error: ' + (err.message || err), 'error');
      }
    }
