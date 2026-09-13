// === Traspaso y Notas de Entrega ===
    // ═══════════════════════════════════════════════════════════════
    // TRASPASO DISTRIBUIDORA → VENTA DIRECTA (v13.5)
    // Toda la mercancía importada entra por Distribuidora; Directa se surte de
    // ahí. Antes solo se podía mover editando cada producto a mano.
    //
    // OJO FISCAL: ARJ y FINARMA son dos entidades legalmente separadas. Este
    // módulo mueve el stock y deja constancia en bitácora, pero NO emite el
    // documento de transferencia entre empresas. Consultar con el contador si
    // hace falta soporte documental por cada despacho.
    // ═══════════════════════════════════════════════════════════════
    let _trasAnalisis = null;

    function abrirTraspaso() {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede despachar', 'error'); return; }
      // Validado aqui y no solo escondiendo el boton: ocultar un control es un
      // aviso visual, no una regla. Esta es la que de verdad manda.
      if (estado.empresa !== 'dist') { notif('El despacho sale de Distribuidora. Cambia de empresa primero.', 'error'); return; }
      if (!_sb || !_supabaseConectado) { notif('Sin conexión a la base de datos', 'error'); return; }
      if (!PRODUCTOS.length) { notif('No hay catálogo cargado', 'error'); return; }
      _trasAnalisis = null;
      _trasUltimaNota = null;
      _trasCant = {};
      document.getElementById('tras-texto').value = '';
      document.getElementById('tras-ref').value = '';
      document.getElementById('tras-buscar').value = '';
      _trasLlenarEmbarques();
      trasTab('sel');
      trasRenderSel();
      trasVolver();
      document.getElementById('modal-traspaso').classList.add('show');
    }
    function cerrarTraspaso() {
      document.getElementById('modal-traspaso').classList.remove('show');
      _trasAnalisis = null;
    }
    // ══════════════════════════════════════════════════════════════
    // v13.14 DESPACHO POR SELECCION
    // El textarea sigue vivo para quien llega con la lista en Excel. Esta
    // pestana es para quien no se sabe los codigos. Ambas terminan en el
    // MISMO trasAnalizar(): la validacion probada no se toca ni se duplica.
    //
    // Regla de JJ: sellado = llego al galpon. Un producto sin embarque_id no
    // esta fisicamente aqui, asi que no se puede despachar. Por eso el filtro
    // por embarque es obligatorio y no una comodidad.
    // ══════════════════════════════════════════════════════════════
    let _trasCant = {};   // { cod_alt: cantidad } — sobrevive a los re-render
    let _trasModo = 'sel';

    function trasTab(m) {
      _trasModo = m;
      const esSel = m === 'sel';
      document.getElementById('tras-modo-sel').style.display = esSel ? '' : 'none';
      document.getElementById('tras-modo-txt').style.display = esSel ? 'none' : '';
      document.getElementById('tras-tab-sel').className = esSel ? 'btn btn-sm' : 'btn btn-secondary btn-sm';
      document.getElementById('tras-tab-txt').className = esSel ? 'btn btn-secondary btn-sm' : 'btn btn-sm';
    }

    // Solo embarques que de verdad tienen algo que despachar.
    function _trasLlenarEmbarques() {
      const sel = document.getElementById('tras-emb');
      if (!sel) return;
      const conStock = EMBARQUES
        .map(e => ({ e, n: PRODUCTOS.filter(p => p.embarque_id === e.id && (p.stock_dist || 0) > 0 && p.activo !== false).length }))
        .filter(x => x.n > 0);
      // Si hay stock sin sellar es una senal: algo entro sin pasar por Recepcion.
      // No se esconde — se muestra aparte para que JJ se entere.
      const huerfanos = PRODUCTOS.filter(p => !p.embarque_id && (p.stock_dist || 0) > 0 && p.activo !== false).length;
      let h = conStock.map(x => `<option value="${x.e.id}">${x.e.codigo} · ${x.n} con stock</option>`).join('');
      if (huerfanos) h += `<option value="__sin__">⚠ Sin embarque · ${huerfanos} con stock</option>`;
      sel.innerHTML = h || '<option value="">— Nada sellado con stock —</option>';
    }

    function _trasFiltrados() {
      const embId = (document.getElementById('tras-emb') || {}).value || '';
      const q = ((document.getElementById('tras-buscar') || {}).value || '').trim().toLowerCase();
      let lista = PRODUCTOS.filter(p => p.activo !== false && (p.stock_dist || 0) > 0);
      if (embId === '__sin__') lista = lista.filter(p => !p.embarque_id);
      else if (embId) lista = lista.filter(p => p.embarque_id === embId);
      else return [];
      if (q) lista = lista.filter(p => (String(p.cod_alt) + ' ' + String(p.cod_orig || '') + ' ' + String(p.desc || '') + ' ' + String(p.marca || '')).toLowerCase().includes(q));
      return lista.sort((a, b) => String(a.cod_alt).localeCompare(String(b.cod_alt)));
    }

    function trasRenderSel() {
      const cont = document.getElementById('tras-lista');
      if (!cont) return;
      const lista = _trasFiltrados();
      if (!lista.length) {
        cont.innerHTML = '<div style="padding:22px;text-align:center;color:var(--dgray);font-size:12px">'
          + '<i class="ti ti-package-off" style="font-size:26px;display:block;margin-bottom:6px"></i>'
          + 'No hay productos con stock en Distribuidora para este filtro.</div>';
        _trasContador(); return;
      }
      let t = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--gray);position:sticky;top:0;z-index:1">'
        + '<th style="text-align:left;padding:7px 10px">Producto</th>'
        + '<th style="text-align:right;padding:7px 8px">Distrib.</th>'
        + '<th style="text-align:right;padding:7px 8px">Directa</th>'
        + '<th style="text-align:right;padding:7px 10px;width:96px">Mover</th></tr></thead><tbody>';
      lista.forEach(p => {
        const v = _trasCant[p.cod_alt] || '';
        t += `<tr style="border-top:1px solid var(--border)">
        <td style="padding:6px 10px"><span style="font-family:ui-monospace,monospace;font-weight:600">${p.cod_alt}</span>
          <div style="font-size:11px;color:var(--dgray)">${(p.desc || '').slice(0, 40)}${p.marca ? ' · ' + p.marca : ''}</div></td>
        <td style="padding:6px 8px;text-align:right;font-weight:600">${p.stock_dist || 0}</td>
        <td style="padding:6px 8px;text-align:right;color:var(--dgray)">${p.stock_vd || 0}</td>
        <td style="padding:6px 10px;text-align:right">
          <input type="text" inputmode="numeric" value="${v}" data-cod="${p.cod_alt}" data-max="${p.stock_dist || 0}"
            oninput="trasSetCant(this)" style="width:74px;text-align:right;padding:5px 7px;border:1px solid var(--border);border-radius:6px;font-size:12.5px;font-family:inherit"></td></tr>`;
      });
      cont.innerHTML = t + '</tbody></table>';
      _trasContador();
    }

    // Se valida al escribir, no al final: enterarse en el paso 2 de que pediste
    // mas de lo que hay es tarde y obliga a devolverse.
    function trasSetCant(inp) {
      const cod = inp.dataset.cod, max = parseInt(inp.dataset.max, 10) || 0;
      let v = String(inp.value).replace(/[^\d]/g, '');
      let n = parseInt(v, 10);
      if (!isFinite(n) || n <= 0) { delete _trasCant[cod]; inp.value = v; inp.style.borderColor = 'var(--border)'; _trasContador(); return; }
      if (n > max) { n = max; notif('Solo hay ' + max + ' en Distribuidora', 'warning'); }
      inp.value = n;
      inp.style.borderColor = 'var(--green)';
      _trasCant[cod] = n;
      _trasContador();
    }

    function trasMitad() {
      const lista = _trasFiltrados();
      if (!lista.length) { notif('No hay productos para repartir', 'error'); return; }
      let n = 0;
      lista.forEach(p => {
        const mitad = Math.floor((p.stock_dist || 0) / 2);
        if (mitad > 0) { _trasCant[p.cod_alt] = mitad; n++; }
      });
      trasRenderSel();
      notif(n + ' producto(s) cargados con la mitad de su stock', 'success');
    }

    function trasLimpiar() { _trasCant = {}; trasRenderSel(); }

    function _trasContador() {
      const el = document.getElementById('tras-contador');
      if (!el) return;
      let prods = 0, unids = 0, valor = 0;
      Object.keys(_trasCant).forEach(cod => {
        const c = _trasCant[cod]; if (!c) return;
        const p = PRODUCTOS.find(x => String(x.cod_alt) === String(cod));
        if (!p) return;
        prods++; unids += c; valor += costoLanded(p) * c;
      });
      el.innerHTML = `<span style="color:var(--dgray)">${prods} producto(s) · ${unids.toLocaleString('es-VE')} unidades</span>`
        + `<span style="font-weight:600;color:var(--navy)">Valor a costo: ${fmtUSD(valor)}</span>`;
    }

    // Puente entre las dos pestanas. El modo seleccion escribe el MISMO formato
    // que se pegaria a mano y deja que trasAnalizar() haga su trabajo de siempre.
    function trasRevisar() {
      if (_trasModo === 'sel') {
        const filas = Object.keys(_trasCant).filter(c => _trasCant[c] > 0).map(c => c + '\t' + _trasCant[c]);
        if (!filas.length) { notif('No has puesto ninguna cantidad', 'error'); return; }
        document.getElementById('tras-texto').value = filas.join('\n');
      }
      trasAnalizar();
    }

    function trasVolver() {
      document.getElementById('tras-paso1').style.display = '';
      document.getElementById('tras-paso2').style.display = 'none';
      document.getElementById('tras-paso3').style.display = 'none';
      document.getElementById('tras-btn-analizar').style.display = '';
      document.getElementById('tras-btn-aplicar').style.display = 'none';
      document.getElementById('tras-btn-volver').style.display = 'none';
      document.getElementById('tras-btn-cancelar').style.display = '';
      document.getElementById('tras-btn-cancelar').textContent = 'Cancelar';
    }

    function trasAnalizar() {
      const texto = document.getElementById('tras-texto').value;
      if (!texto.trim()) { notif('Pega la lista primero', 'error'); return; }
      const filas = _recParsear(texto);
      const acum = {}, malas = [];

      filas.forEach(f => {
        if (f.error) { malas.push(f); return; }
        const p = _recBuscar(f.cod);
        if (!p) { malas.push({ ...f, error: 'Código no existe en el catálogo' }); return; }
        if (f.cant === 0) { malas.push({ ...f, error: 'Cantidad en cero' }); return; }
        if (acum[p.cod_alt]) { acum[p.cod_alt].cant += f.cant; acum[p.cod_alt].lineas.push(f.linea); }
        else acum[p.cod_alt] = { prod: p, cant: f.cant, lineas: [f.linea] };
      });

      const ok = [], sinStock = [];
      Object.values(acum).forEach(c => {
        const disp = c.prod.stock_dist || 0;
        const fila = {
          prod: c.prod, cod: c.prod.cod_alt, cant: c.cant, lineas: c.lineas,
          distAntes: disp, distDespues: disp - c.cant,
          vdAntes: c.prod.stock_vd || 0, vdDespues: (c.prod.stock_vd || 0) + c.cant
        };
        // No se permite dejar Distribuidora en negativo: seria stock inventado.
        if (c.cant > disp) sinStock.push({ ...fila, falta: c.cant - disp });
        else ok.push(fila);
      });

      _trasAnalisis = { ok, sinStock, malas };

      const unid = ok.reduce((a, r) => a + r.cant, 0);
      const valor = ok.reduce((a, r) => a + costoLanded(r.prod) * r.cant, 0);
      document.getElementById('tras-resumen').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${_recKpi('Se despachan', ok.length, 'var(--green)', 'var(--lgreen)')}
      ${_recKpi('Unidades', unid.toLocaleString('es-VE'), 'var(--navy)', 'var(--lblue)')}
      ${_recKpi('Valor a costo', fmtUSD(valor), '#854F0B', 'var(--lgold)')}
    </div>
    ${sinStock.length ? `<div style="background:#FEF5F5;border-left:3px solid var(--red);border-radius:6px;padding:8px 12px;margin-top:8px;font-size:11.5px;color:#B71C1C">
      <i class="ti ti-alert-triangle"></i> <strong>${sinStock.length} producto(s) no tienen suficiente stock en Distribuidora</strong> y no se van a mover. Distribuidora no puede quedar en negativo.</div>` : ''}
    ${malas.length ? `<div style="background:#FEF5F5;border-left:3px solid var(--red);border-radius:6px;padding:8px 12px;margin-top:8px;font-size:11.5px;color:#B71C1C">
      <i class="ti ti-x"></i> ${malas.length} línea(s) con problema.</div>` : ''}`;

      let t = `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--gray);position:sticky;top:0">
      <th style="text-align:left;padding:7px 10px">Código</th><th style="text-align:left;padding:7px 10px">Descripción</th>
      <th style="text-align:right;padding:7px 10px">Mueve</th>
      <th style="text-align:right;padding:7px 10px">Distrib.</th><th style="text-align:right;padding:7px 10px">Directa</th></tr></thead><tbody>`;
      ok.forEach(r => {
        t += `<tr style="border-top:1px solid var(--border)">
      <td style="padding:6px 10px;font-family:ui-monospace,monospace">${r.cod}</td>
      <td style="padding:6px 10px;color:var(--dgray)">${(r.prod.desc || '').slice(0, 34)}</td>
      <td style="padding:6px 10px;text-align:right;font-weight:600">${r.cant}</td>
      <td style="padding:6px 10px;text-align:right;color:var(--dgray)">${r.distAntes} → <strong style="color:var(--navy)">${r.distDespues}</strong></td>
      <td style="padding:6px 10px;text-align:right;color:var(--dgray)">${r.vdAntes} → <strong style="color:var(--green)">${r.vdDespues}</strong></td></tr>`;
      });
      sinStock.forEach(r => {
        t += `<tr style="border-top:1px solid var(--border);background:#FEF5F5">
      <td style="padding:6px 10px;font-family:ui-monospace,monospace;color:var(--red)">${r.cod}</td>
      <td colspan="4" style="padding:6px 10px;color:var(--red)">Pides ${r.cant} y solo hay ${r.distAntes} en Distribuidora (faltan ${r.falta})</td></tr>`;
      });
      malas.forEach(m => {
        t += `<tr style="border-top:1px solid var(--border);background:#FEF5F5">
      <td style="padding:6px 10px;font-family:ui-monospace,monospace;color:var(--red)">${m.cod || '—'}</td>
      <td colspan="4" style="padding:6px 10px;color:var(--red)">Línea ${m.linea}: ${m.error}</td></tr>`;
      });
      document.getElementById('tras-tabla').innerHTML = t + '</tbody></table>';

      document.getElementById('tras-paso1').style.display = 'none';
      document.getElementById('tras-paso2').style.display = '';
      document.getElementById('tras-btn-analizar').style.display = 'none';
      document.getElementById('tras-btn-volver').style.display = '';
      document.getElementById('tras-btn-cancelar').style.display = 'none';
      document.getElementById('tras-btn-aplicar').style.display = ok.length ? '' : 'none';
    }

    async function trasAplicar() {
      const A = _trasAnalisis;
      if (!A || !A.ok.length) return;
      const ref = (document.getElementById('tras-ref').value || '').trim();
      if (!confirm(`Se van a mover ${A.ok.length} producto(s) de Distribuidora a Venta Directa.\n\n¿Despachar?`)) return;

      const btn = document.getElementById('tras-btn-aplicar');
      btn.disabled = true;
      document.getElementById('tras-btn-volver').style.display = 'none';

      let hechos = 0; const fallos = [];
      for (let i = 0; i < A.ok.length; i++) {
        const r = A.ok[i];
        btn.textContent = `Moviendo ${i + 1} de ${A.ok.length}...`;
        // Los dos campos van en un solo update: si se hicieran por separado y
        // fallara el segundo, la mercancía desaparecería de Distribuidora sin
        // llegar a Directa.
        const { error } = await _sb.from('productos')
          .update({ stock_dist: r.distDespues, stock_vd: r.vdDespues }).eq('id', r.prod.id);
        if (error) fallos.push({ cod: r.cod, msg: error.message });
        else { r.prod.stock_dist = r.distDespues; r.prod.stock_vd = r.vdDespues; hechos++; }
      }

      btn.disabled = false; btn.style.display = 'none';
      document.getElementById('tras-paso2').style.display = 'none';
      document.getElementById('tras-paso3').style.display = '';
      document.getElementById('tras-btn-cancelar').style.display = '';
      document.getElementById('tras-btn-cancelar').textContent = 'Cerrar';

      // v13.14 La nota se emite DESPUES de mover, y solo sobre lo que de verdad
      // se movio. Al reves gastaria un correlativo en un despacho que fallo.
      const movidos = A.ok.filter(r => !fallos.some(f => f.cod === r.cod));
      const nota = await _trasGuardarNota(movidos, ref);

      document.getElementById('tras-paso3').innerHTML = `
    <div style="text-align:center;padding:22px 10px">
      <i class="ti ti-${fallos.length ? 'alert-triangle' : 'circle-check'}" style="font-size:44px;color:${fallos.length ? 'var(--gold)' : 'var(--green)'}"></i>
      <div style="font-size:17px;font-weight:600;color:var(--navy);margin-top:10px">${hechos} producto(s) despachados a Venta Directa</div>
      ${ref ? `<div style="font-size:12.5px;color:var(--dgray);margin-top:4px">${ref}</div>` : ''}
      ${nota ? `<div style="margin-top:14px">
        <div style="font-size:12.5px;color:var(--dgray);margin-bottom:8px">Nota de entrega <strong style="color:var(--navy)">${nota.numero}</strong></div>
        <button class="btn btn-primary" onclick="imprimirNotaEntrega()"><i class="ti ti-printer"></i> Ver / imprimir nota de entrega</button>
      </div>` : `<div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;padding:10px;margin-top:14px;font-size:11.5px;color:#854F0B">
        <i class="ti ti-alert-triangle"></i> El stock se movió bien, pero la nota de entrega no se pudo guardar. Revisa la conexión.</div>`}
      ${fallos.length ? `<div style="background:#FEF5F5;border:1px solid #F5C0C0;border-radius:8px;padding:12px;margin-top:14px;text-align:left;font-size:12px;color:#B71C1C">
        <strong>${fallos.length} fallaron y NO se movieron:</strong><br>${fallos.map(f => '· ' + f.cod + ' — ' + f.msg).join('<br>')}</div>` : ''}
    </div>`;

      const detalle = `Despacho Distribuidora → Venta Directa${ref ? ' "' + ref + '"' : ''}: ${hechos} productos${fallos.length ? ' (' + fallos.length + ' fallaron)' : ''}`;
      logBitacora('inventario', detalle, true);
      _sbLogBitacora(estado.usuario, estado.empresa, 'inventario', detalle, true);
      renderInventario();
      notif(`${hechos} producto(s) despachados`, fallos.length ? 'warning' : 'success');
    }


    // ══════════════════════════════════════════════════════════════
    // LISTADO DE NOTAS DE ENTREGA (v13.16)
    // Lee de Supabase, no de memoria: las notas viven en la base y este listado
    // debe verlas aunque las haya emitido otro usuario en otra maquina.
    // ══════════════════════════════════════════════════════════════
    let _NOTAS = [];

    async function abrirNotas() {
      document.getElementById('notas-buscar').value = '';
      document.getElementById('notas-lista').innerHTML =
        '<div style="padding:26px;text-align:center;color:var(--dgray);font-size:12px"><i class="ti ti-loader-2" style="font-size:24px;display:block;margin-bottom:6px"></i>Cargando…</div>';
      document.getElementById('modal-notas').classList.add('show');
      if (!_sb || !_supabaseConectado) {
        document.getElementById('notas-lista').innerHTML =
          '<div style="padding:26px;text-align:center;color:var(--dgray);font-size:12px">Sin conexión a Supabase. Las notas de entrega viven en la base de datos.</div>';
        return;
      }
      try {
        const { data, error } = await _sb.from('traspasos').select('*').order('fecha', { ascending: false }).limit(200);
        if (error) throw error;
        _NOTAS = data || [];
        renderNotas();
      } catch (err) {
        console.error('[ARJ] cargar notas:', err);
        document.getElementById('notas-lista').innerHTML =
          '<div style="padding:22px;text-align:center;color:var(--red);font-size:12px">No se pudieron cargar las notas: ' + (err.message || err) + '</div>';
      }
    }

    function cerrarNotas() { document.getElementById('modal-notas').classList.remove('show'); }

    function renderNotas() {
      const cont = document.getElementById('notas-lista');
      if (!cont) return;
      const q = (document.getElementById('notas-buscar').value || '').trim().toLowerCase();
      let lista = _NOTAS;
      if (q) lista = lista.filter(n => (String(n.numero) + ' ' + String(n.embarque_codigo || '') + ' ' + String(n.referencia || '')).toLowerCase().includes(q));
      if (!lista.length) {
        cont.innerHTML = '<div style="padding:26px;text-align:center;color:var(--dgray);font-size:12px">'
          + '<i class="ti ti-file-off" style="font-size:26px;display:block;margin-bottom:6px"></i>'
          + (q ? 'Ninguna nota coincide con la búsqueda.' : 'Todavía no se ha emitido ninguna nota de entrega.') + '</div>';
        return;
      }
      let t = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--gray)">'
        + '<th style="text-align:left;padding:8px 10px">Número</th>'
        + '<th style="text-align:left;padding:8px 10px">Fecha</th>'
        + '<th style="text-align:left;padding:8px 10px">Embarque</th>'
        + '<th style="text-align:right;padding:8px 8px">Rengl.</th>'
        + '<th style="text-align:right;padding:8px 8px">Unid.</th>'
        + '<th style="text-align:right;padding:8px 10px">Costo</th>'
        + '<th style="padding:8px 10px"></th></tr></thead><tbody>';
      lista.forEach(n => {
        const f = new Date(n.fecha);
        const fTxt = f.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
          + ' ' + f.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
        t += `<tr style="border-top:1px solid var(--border);${n.anulado ? 'opacity:.5' : ''}">
        <td style="padding:7px 10px"><strong>${n.numero}</strong>${n.anulado ? ' <span style="color:var(--red);font-size:10px">ANULADA</span>' : ''}
          ${n.referencia ? `<div style="font-size:10.5px;color:var(--dgray)">${n.referencia}</div>` : ''}</td>
        <td style="padding:7px 10px;color:var(--dgray)">${fTxt}</td>
        <td style="padding:7px 10px">${n.embarque_codigo || '—'}</td>
        <td style="padding:7px 8px;text-align:right">${n.productos_count || 0}</td>
        <td style="padding:7px 8px;text-align:right">${(n.unidades_count || 0).toLocaleString('es-VE')}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:600">${fmtUSD(n.total_costo || 0)}</td>
        <td style="padding:7px 10px;text-align:right"><button class="btn btn-secondary btn-sm" onclick="reimprimirNota('${n.id}')"><i class="ti ti-printer"></i></button></td></tr>`;
      });
      cont.innerHTML = t + '</tbody></table>'
        + `<div style="margin-top:9px;font-size:11px;color:var(--dgray);text-align:right">${lista.length} nota(s)</div>`;
    }


    // ══════════════════════════════════════════════════════════════
    // NOTA DE ENTREGA (v13.14)
    // Documento INTERNO de gestión: deja constancia de qué salió del galpón de
    // Distribuidora hacia el mostrador. No es un documento fiscal.
    //
    // Los renglones guardan una FOTO (descripcion, marca, costo del momento).
    // Si manana cambia el nombre o se recalcula el costo, la nota vieja sigue
    // diciendo lo que decia el dia que se imprimio.
    // ══════════════════════════════════════════════════════════════
    let _trasUltimaNota = null;

    async function _trasGuardarNota(movidos, ref) {
      if (!movidos || !movidos.length) return null;
      if (!_sb || !_supabaseConectado) return null;
      try {
        const anio = new Date().getFullYear();
        const { data: cont, error: ce } = await _sb.from('contadores')
          .select('*').eq('tipo', 'nota_entrega').eq('anio', anio).single();
        if (ce || !cont) { console.error('[ARJ] contador nota_entrega:', ce && ce.message); return null; }
        const nuevoNum = (cont.ultimo_numero || 0) + 1;
        const numero = (cont.prefijo || 'NE') + '-' + anio + '-' + String(nuevoNum).padStart(5, '0');
        // v13.15 EL CONTADOR SE SUBE AL FINAL, NO AQUI. Al reves quemaba el
        // correlativo aunque el insert fallara: dos intentos fallidos dejaron
        // el contador en 2 sin una sola nota guardada. La columna `numero` es
        // unique, asi que si dos despachos coinciden, la base rechaza el
        // duplicado en vez de dejar pasar dos notas con el mismo numero.

        // El embarque se toma de los productos movidos, no del filtro: si la
        // lista se pegó a mano puede mezclar embarques y el campo debe decirlo.
        const embIds = [...new Set(movidos.map(r => r.prod.embarque_id).filter(Boolean))];
        let embTxt = '';
        if (embIds.length === 1) {
          const e = EMBARQUES.find(x => x.id === embIds[0]);
          embTxt = e ? e.codigo : '';
        } else if (embIds.length > 1) embTxt = 'Varios (' + embIds.length + ')';

        const unidades = movidos.reduce((a, r) => a + r.cant, 0);
        const totalCosto = Math.round(movidos.reduce((a, r) => a + costoLanded(r.prod) * r.cant, 0) * 100) / 100;

        const { data: ins, error: ie } = await _sb.from('traspasos').insert({
          numero, origen: 'dist', destino: 'directa',
          embarque_codigo: embTxt, referencia: ref || null,
          usuario: estado.usuario || 'Sistema',
          productos_count: movidos.length, unidades_count: unidades, total_costo: totalCosto
        }).select().single();
        if (ie || !ins) { console.error('[ARJ] insert traspaso:', ie && ie.message); return null; }

        const items = movidos.map(r => {
          const cu = Math.round(costoLanded(r.prod) * 10000) / 10000;
          return {
            traspaso_id: ins.id, producto_id: String(r.prod.id),
            cod_alt: r.prod.cod_alt, descripcion: r.prod.desc || '', marca: r.prod.marca || '',
            cantidad: r.cant, costo_unitario: cu,
            total_linea: Math.round(cu * r.cant * 100) / 100,
            stock_dist_antes: r.distAntes, stock_dist_despues: r.distDespues,
            stock_vd_antes: r.vdAntes, stock_vd_despues: r.vdDespues
          };
        });
        const { error: iie } = await _sb.from('traspaso_items').insert(items);
        if (iie) console.error('[ARJ] insert traspaso_items:', iie.message);

        // Recien ahora, con la nota ya en la base, el numero queda consumido.
        await _sb.from('contadores').update({ ultimo_numero: nuevoNum }).eq('id', cont.id);

        _trasUltimaNota = { numero, fecha: new Date(), embarque: embTxt, ref: ref || '', items, totalCosto, unidades };
        return _trasUltimaNota;
      } catch (err) {
        console.error('[ARJ] nota de entrega:', err);
        return null;
      }
    }

    // Reusa el documento de impresion que ya existe cambiando sus etiquetas.
    function imprimirNotaEntrega() {
      const n = _trasUltimaNota;
      if (!n) { notif('No hay nota de entrega para mostrar', 'error'); return; }
      const f = n.fecha.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      document.getElementById('dc-numero').textContent = n.numero;
      document.getElementById('dc-fecha').textContent = f;
      const f2 = document.getElementById('dc-fecha2'); if (f2) f2.textContent = f;
      document.getElementById('dc-cli-nombre').textContent = 'VENTA DIRECTA — ARJ';
      document.getElementById('dc-cli-rif').textContent = 'Despacho interno desde Distribuidora';
      document.getElementById('dc-cli-dir').textContent = 'Dirección: Mostrador Acarigua';
      document.getElementById('dc-cli-tel').textContent = 'Recibe: ______________________';
      document.getElementById('dc-vendedor').textContent = estado.usuario || 'Sistema';
      const vl = document.getElementById('dc-vence-label'); if (vl) vl.textContent = 'Embarque:';
      document.getElementById('dc-vence').textContent = n.embarque || '—';
      document.getElementById('dc-empresa-op').textContent = 'Distribuidora → Venta Directa';
      document.getElementById('dc-items').innerHTML = n.items.map((it, i) =>
        `<tr><td>${i + 1}</td><td><strong>${it.cod_alt}</strong></td><td>${it.descripcion}${it.marca ? ' · ' + it.marca : ''}</td>`
        + `<td class="num">${it.cantidad}</td><td class="num">${fmtUSD(it.costo_unitario)}</td>`
        + `<td class="num"><strong>${fmtUSD(it.total_linea)}</strong></td></tr>`).join('');
      document.getElementById('dc-subtotal').textContent = fmtUSD(n.totalCosto);
      document.getElementById('dc-total').textContent = fmtUSD(n.totalCosto);
      document.getElementById('dc-equiv').innerHTML =
        '<strong>Documento interno de control.</strong> Valores expresados al costo, no constituyen precio de venta.'
        + `<br>${n.unidades.toLocaleString('es-VE')} unidad(es) en ${n.items.length} renglón(es).`
        + (n.ref ? '<br>Referencia: ' + n.ref : '');
      document.querySelector('.dc-num-label').textContent = 'NOTA DE ENTREGA';
      const h2n = document.querySelector('#modal-print-cotizacion h2');
      if (h2n) h2n.innerHTML = '<i class="ti ti-printer"></i> Nota de entrega: ' + n.numero;
      cerrarTraspaso();
      document.getElementById('modal-print-cotizacion').classList.add('show');
    }
