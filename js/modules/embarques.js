// === Embarques ===
    // ═══ EQUIPO DE TRABAJO ═══
    // ═══════════════════════════════════════════════════════════════
    // EMBARQUES (v13.10) — cada contenedor con su costo real.
    // El factor se calcula en Postgres (columna generated), aquí solo se
    // previsualiza. Al recibir mercancía el factor se SELLA en cada producto,
    // así editar un embarque nunca reescribe el costo de lo ya vendido.
    // ═══════════════════════════════════════════════════════════════
    let EMBARQUES = [];

    function _embFactorCon(pf, pc, pd) {
      return (1 + (parseFloat(pf) || 0) / 100)
           * (1 + (parseFloat(pc) || 0) / 100)
           * (1 + (parseFloat(pd) || 0) / 100);
    }

    // manual=true cuando el gerente escribe el % a mano: no se recalcula desde
    // los montos, porque pisaría lo que acaba de escribir.
    function _embRecalc(manual) {
      const fob = parseFloat(document.getElementById('emb-fob').value) || 0;
      const fle = parseFloat(document.getElementById('emb-flete').value) || 0;
      const elPf = document.getElementById('emb-pct-flete');
      if (!manual && fob > 0) elPf.value = (fle / fob * 100).toFixed(4);
      const pf = parseFloat(elPf.value) || 0;
      const pc = parseFloat(document.getElementById('emb-pct-com').value) || 0;
      const pd = parseFloat(document.getElementById('emb-pct-div').value) || 0;
      const f = _embFactorCon(pf, pc, pd);
      const prev = document.getElementById('emb-preview');
      if (!prev) return;
      // Formulario vacío: no mostrar un factor fantasma (antes salía 1,2750).
      if (pf <= 0) { prev.innerHTML = '<div style="font-size:12px;opacity:.7">Escribe el monto o el % de flete para ver el factor.</div>'; return; }
      const mUno = m => (100 * (m - f) / m);
      const tramos = [['&lt;$2', 5], ['$2-5', 4], ['$5-10', 3], ['&ge;$10', 2.5]];
      prev.innerHTML = `<div style="font-size:15px;font-weight:600">Factor landed: ${f.toFixed(4)}</div>`
        + `<div style="font-size:11px;opacity:.75;margin-top:2px">Una pieza de FOB $10 te cuesta ${fmtUSD(10 * f)}</div>`
        + `<div style="display:flex;gap:10px;margin-top:7px;font-size:11px;flex-wrap:wrap">`
        + tramos.map(([lab, m]) => {
            const mg = mUno(m);
            const col = mg < 30 ? 'var(--gold)' : '#8BC34A';
            return `<span>FOB ${lab}: <strong style="color:${col}">${mg.toFixed(1)}%</strong></span>`;
          }).join('')
        + `</div>`;
    }

    function _embLimpiar() {
      ['emb-id', 'emb-codigo', 'emb-proveedor', 'emb-fecha', 'emb-fob', 'emb-flete', 'emb-pct-flete']
        .forEach(id => document.getElementById(id).value = '');
      document.getElementById('emb-pct-com').value = 2;
      document.getElementById('emb-pct-div').value = 25;
      document.getElementById('emb-form-titulo').textContent = 'Nuevo embarque';
      document.getElementById('emb-btn-guardar').innerHTML = '<i class="ti ti-check"></i> Guardar embarque';
      _embRecalc(true);
    }

    async function cargarEmbarques() {
      if (!_sb) return;
      const { data, error } = await _sb.from('embarques').select('*').order('fecha_llegada', { ascending: false });
      if (error) { console.warn('[ARJ] embarques:', error.message); return; }
      EMBARQUES = data || [];
    }

    function renderEmbarques() {
      const cont = document.getElementById('emb-lista');
      if (!cont) return;
      if (!EMBARQUES.length) {
        cont.innerHTML = '<div style="padding:18px;text-align:center;color:var(--dgray);font-size:12.5px">'
          + 'Todavía no hay embarques cargados.</div>';
        return;
      }
      cont.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px">'
        + '<thead><tr style="background:var(--navy);color:#fff">'
        + '<th style="padding:7px 9px;text-align:left">Código</th>'
        + '<th style="padding:7px 9px;text-align:left">Proveedor</th>'
        + '<th style="padding:7px 9px;text-align:right">Llegada</th>'
        + '<th style="padding:7px 9px;text-align:right">Factor</th>'
        + '<th style="padding:7px 9px;text-align:right">Piezas</th>'
        + '<th style="padding:7px 9px"></th></tr></thead><tbody>'
        + EMBARQUES.map(e => {
            const n = PRODUCTOS.filter(p => p.embarque_id === e.id).length;
            const f = parseFloat(e.factor) || 0;
            return `<tr style="border-bottom:1px solid var(--gray)">
              <td style="padding:7px 9px;font-weight:600">${e.codigo}</td>
              <td style="padding:7px 9px">${e.proveedor || ''}</td>
              <td style="padding:7px 9px;text-align:right">${e.fecha_llegada || '—'}</td>
              <td style="padding:7px 9px;text-align:right;font-weight:600">${f.toFixed(4)}</td>
              <td style="padding:7px 9px;text-align:right">${n}</td>
              <td style="padding:7px 9px;text-align:right">
                <button class="btn btn-secondary btn-sm" onclick="editarEmbarque('${e.id}')"><i class="ti ti-pencil"></i></button>
                <button class="btn btn-secondary btn-sm" onclick="recalcularEmbarque('${e.id}')" title="Recalcular costos de este embarque"><i class="ti ti-refresh"></i></button>
              </td></tr>`;
          }).join('')
        + '</tbody></table>';
    }

    // ═══════════════════════════════════════════════════════════════
    // RECALCULAR COSTOS DE UN EMBARQUE (v13.10)
    // Reescribe el factor_landed de los productos de ESE embarque para que
    // coincida con el del embarque. Es COSTO DE REPOSICIÓN: sirve para poner
    // precios. El costo histórico de lo ya vendido NO se toca — vive congelado
    // en factura_items (fob_unitario + factor_landed de cada renglón).
    // Nunca automático: un dedazo en el % reescribiría cientos de costos.
    // ═══════════════════════════════════════════════════════════════
    async function recalcularEmbarque(id) {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede recalcular costos', 'error'); return; }
      const e = EMBARQUES.find(x => x.id === id);
      if (!e) { notif('Embarque no encontrado', 'error'); return; }
      const fNuevo = parseFloat(e.factor) || 0;
      if (fNuevo <= 0) { notif('Ese embarque no tiene factor válido', 'error'); return; }

      const desfasados = PRODUCTOS.filter(p =>
        p.embarque_id === id && Math.abs((parseFloat(p.factor_landed) || 0) - fNuevo) > 0.000001);

      if (!PRODUCTOS.some(p => p.embarque_id === id)) {
        notif('Todavía no hay productos sellados con ' + e.codigo, 'error'); return;
      }
      if (!desfasados.length) { notif('Ya están todos al día con factor ' + fNuevo.toFixed(4), 'success'); return; }

      const fViejo = parseFloat(desfasados[0].factor_landed) || 0;
      const ej = desfasados.find(p => (parseFloat(p.fob) || 0) > 0);
      const lineaEj = ej
        ? `\nEjemplo — ${ej.cod_alt}: costo ${fmtUSD((parseFloat(ej.fob) || 0) * fViejo)} → ${fmtUSD((parseFloat(ej.fob) || 0) * fNuevo)}`
        : '';
      const sube = fNuevo > fViejo;

      if (!confirm(
        `Recalcular ${desfasados.length} producto(s) de ${e.codigo}.\n\n`
        + `Factor: ${fViejo.toFixed(4)} → ${fNuevo.toFixed(4)}  (${sube ? 'SUBE' : 'BAJA'} el costo)${lineaEj}\n\n`
        + `Las facturas ya emitidas NO cambian: guardan su propio costo.\n`
        + `Los precios de venta NO se tocan — solo el costo, o sea el margen.\n\n`
        + `¿Aplicar?`)) return;

      let hechos = 0; const fallos = [];
      for (const p of desfasados) {
        const { error } = await _sb.from('productos').update({ factor_landed: fNuevo }).eq('id', p.id);
        if (error) fallos.push(p.cod_alt + ' — ' + error.message);
        else { p.factor_landed = fNuevo; hechos++; }
      }
      await cargarEmbarques();
      renderEmbarques();
      if (typeof renderInventario === 'function') renderInventario();
      const det = `Recalculó ${hechos} producto(s) de ${e.codigo}: factor ${fViejo.toFixed(4)} → ${fNuevo.toFixed(4)}`
        + (fallos.length ? ` (${fallos.length} fallaron)` : '');
      logBitacora('inventario', det, true);
      _sbLogBitacora(estado.usuario, estado.empresa, 'inventario', det, true);
      notif(fallos.length ? `${hechos} recalculados, ${fallos.length} fallaron` : `${hechos} producto(s) recalculados`,
            fallos.length ? 'error' : 'success');
      if (fallos.length) console.warn('[ARJ] fallos recalculo:', fallos);
    }

    function abrirEmbarques() {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede gestionar embarques', 'error'); return; }
      _embLimpiar();
      renderEmbarques();
      document.getElementById('modal-embarques').classList.add('show');
    }

    function cerrarEmbarques() {
      document.getElementById('modal-embarques').classList.remove('show');
    }

    function editarEmbarque(id) {
      const e = EMBARQUES.find(x => x.id === id);
      if (!e) return;
      document.getElementById('emb-id').value = e.id;
      document.getElementById('emb-codigo').value = e.codigo || '';
      document.getElementById('emb-proveedor').value = e.proveedor || '';
      document.getElementById('emb-fecha').value = e.fecha_llegada || '';
      document.getElementById('emb-fob').value = e.fob_total ?? '';
      document.getElementById('emb-flete').value = e.monto_flete_aduana ?? '';
      document.getElementById('emb-pct-flete').value = e.pct_flete_aduana ?? '';
      document.getElementById('emb-pct-com').value = e.pct_comision ?? 2;
      document.getElementById('emb-pct-div').value = e.pct_divisas ?? 25;
      document.getElementById('emb-form-titulo').textContent = 'Editando: ' + e.codigo;
      document.getElementById('emb-btn-guardar').innerHTML = '<i class="ti ti-check"></i> Guardar cambios';
      _embRecalc(true);
    }

    async function guardarEmbarque() {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede gestionar embarques', 'error'); return; }
      const id = document.getElementById('emb-id').value;
      const codigo = (document.getElementById('emb-codigo').value || '').trim().toUpperCase();
      const proveedor = (document.getElementById('emb-proveedor').value || '').trim().toUpperCase();
      if (!codigo) { notif('El código es obligatorio', 'error'); return; }
      if (!proveedor) { notif('El proveedor es obligatorio', 'error'); return; }

      const pf = parseFloat(document.getElementById('emb-pct-flete').value) || 0;
      const pc = parseFloat(document.getElementById('emb-pct-com').value) || 0;
      const pd = parseFloat(document.getElementById('emb-pct-div').value) || 0;
      if (pf < 0 || pc < 0 || pd < 0) { notif('Los porcentajes no pueden ser negativos', 'error'); return; }

      const fecha = document.getElementById('emb-fecha').value;
      const fob = parseFloat(document.getElementById('emb-fob').value);
      const fle = parseFloat(document.getElementById('emb-flete').value);
      // factor NO se envía: lo calcula Postgres (columna generated).
      const fila = {
        codigo, proveedor,
        fecha_llegada: fecha || null,
        fob_total: isFinite(fob) ? fob : null,
        monto_flete_aduana: isFinite(fle) ? fle : null,
        pct_flete_aduana: pf, pct_comision: pc, pct_divisas: pd
      };

      const btn = document.getElementById('emb-btn-guardar');
      btn.disabled = true; btn.textContent = 'Guardando...';
      let error;
      if (id) ({ error } = await _sb.from('embarques').update(fila).eq('id', id));
      else    ({ error } = await _sb.from('embarques').insert(fila));
      btn.disabled = false;

      if (error) {
        notif('No se guardó: ' + error.message, 'error');
        _embRecalc(true);
        return;
      }
      await cargarEmbarques();
      renderEmbarques();
      const f = _embFactorCon(pf, pc, pd);
      const detalle = `${id ? 'Editó' : 'Creó'} embarque ${codigo} (${proveedor}) — factor ${f.toFixed(4)}`;
      logBitacora('inventario', detalle, true);
      _sbLogBitacora(estado.usuario, estado.empresa, 'inventario', detalle, true);
      _embLimpiar();
      notif('Embarque ' + codigo + ' guardado', 'success');
    }
