// === Simulador de Precios LPA ===
    // ═══════════════════════════════════════════════════════════════
    // v13.25 SIMULADOR DE PRECIOS DE LA LISTA — SOLO GERENTE.
    // Misma seleccion de marcas que la lista del cliente. Muestra cada
    // producto con su multiplicador REAL (precio / FOB) y permite moverlo
    // para ver el efecto en la utilidad total antes de mandar nada.
    //
    // ES UNA SIMULACION: no escribe en `productos`. Al cerrar se pierde.
    // Estimado a precio publico para las dos empresas (decision de JJ):
    // si vendes por Distribuidora con tier, la utilidad real sera menor.
    // ═══════════════════════════════════════════════════════════════
    let _LPA = [];        // filas simuladas
    let _lpaSoloBajos = false;
    // Canal Distribuidora: por defecto se estima a precio publico (decision de
    // JJ). El selector deja ver el efecto real del descuento de aliado, que es
    // donde vive el riesgo de canibalizacion del T3.
    let _lpaTier = 'Publico';
    let _lpaDetAbierto = false;   // el desglose se re-dibuja en cada tecla
    function _lpaDet(o) { _lpaDetAbierto = !!o; }
    function _lpaFacDist() { return PRECIOS_TIER[_lpaTier] || 1; }
    function _lpaCambioTier(v) { _lpaTier = v; _lpaRenderTabla(); _lpaKpis(); }

    function listaPreciosAnalisis() {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede ver los indicadores', 'error'); return; }
      if (_lpMarcasSel.length === 0) { notif('Elige al menos una marca antes de ver los indicadores', 'error'); return; }
      const filas = _productosParaLista();
      if (filas.length === 0) { notif('No hay productos para analizar', 'error'); return; }

      _LPA = filas.map(p => {
        const fob = parseFloat(p.fob) || 0;
        const pr = precioLista(p);
        const c = fob > 0 ? costoLanded(p) : 0;
        const sd = fob > 0 ? costoSinDivisas(p) : null;
        return {
          cod: p.cod_alt, desc: (p.desc || '').trim(), marca: (p.marca || '').trim(),
          uvd: (parseInt(p.stock_vd) || 0), udist: (parseInt(p.stock_dist) || 0),
          uds: (parseInt(p.stock_vd) || 0) + (parseInt(p.stock_dist) || 0),
          fob: fob, costo: c, sinDiv: (sd == null ? c : sd), sdOk: (sd != null),
          manual: (p.precio_manual != null && p.precio_manual > 0),
          pr0: pr,            // precio original, para el boton Restaurar
          pr: pr,             // precio simulado
          tocado: false
        };
      });
      _lpaSoloBajos = false; _lpaDetAbierto = false;
      const b = document.getElementById('lpa-solo-bajos'); if (b) b.checked = false;
      const g = document.getElementById('lpa-mult-global'); if (g) g.value = '';
      _lpaTier = 'Publico';
      const s = document.getElementById('lpa-tier'); if (s) s.value = 'Publico';
      _lpaRenderTabla();
      _lpaKpis();
      document.getElementById('modal-lp-analisis').classList.add('show');
      logBitacora('precio', 'Abrió el simulador de precios — ' + _lpNombreMarcas() + ' (' + filas.length + ' productos)', false);
    }
    function cerrarLpAnalisis() { document.getElementById('modal-lp-analisis').classList.remove('show'); }

    // Multiplicador real de una fila: cuantas veces el FOB es el precio.
    function _lpaMult(r) { return r.fob > 0 ? r.pr / r.fob : NaN; }
    // El total de la fila respeta el tier: las unidades de Distribuidora no
    // valen lo mismo que las de Venta Directa si hay descuento de aliado.
    function _lpaTotalFila(r) { return r.pr * r.uvd + r.pr * _lpaFacDist() * r.udist; }
    function _lpaMargen(r) { return r.pr > 0 && r.fob > 0 ? (r.pr - r.costo) / r.pr * 100 : NaN; }
    function _lpaColorMg(m) { return !isFinite(m) ? 'var(--dgray)' : (m < MARGEN_MINIMO ? '#B00020' : (m < 40 ? '#BF8F00' : '#1E7B34')); }

    // ── Totales, recalculados desde _LPA en cada cambio ──
    function _lpaTotales() {
      const fd = _lpaFacDist();
      const Z = () => ({ uds: 0, venta: 0, costo: 0 });
      const vd = Z(), di = Z();
      let uds = 0, venta = 0, costo = 0, fobT = 0, sinDiv = 0;
      let nSF = 0, udsSF = 0, ventaSF = 0, nSinEmb = 0, nBajos = 0, nTocados = 0;
      let venta0 = 0;
      _LPA.forEach(r => {
        if (r.tocado) nTocados++;
        const prD = r.pr * fd;
        if (r.fob <= 0) {
          nSF++; udsSF += r.uds; ventaSF += r.pr * r.uvd + prD * r.udist; return;
        }
        vd.uds += r.uvd; vd.venta += r.pr * r.uvd; vd.costo += r.costo * r.uvd;
        di.uds += r.udist; di.venta += prD * r.udist; di.costo += r.costo * r.udist;
        uds += r.uds; venta += r.pr * r.uvd + prD * r.udist;
        venta0 += r.pr0 * r.uvd + r.pr0 * fd * r.udist;
        costo += r.costo * r.uds; fobT += r.fob * r.uds; sinDiv += r.sinDiv * r.uds;
        if (!r.sdOk) nSinEmb++;
        const m = _lpaMargen(r); if (isFinite(m) && m < MARGEN_MINIMO) nBajos++;
      });
      const fin = o => { o.util = o.venta - o.costo; o.mg = o.venta > 0 ? o.util / o.venta * 100 : 0; return o; };
      const util = venta - costo;
      return {
        vd: fin(vd), di: fin(di), tier: _lpaTier, facDist: fd,
        uds: uds, venta: venta, venta0: venta0, costo: costo, fobT: fobT, sinDiv: sinDiv,
        util: util, mg: venta > 0 ? util / venta * 100 : 0,
        util0: venta0 - costo,
        multFob: fobT > 0 ? venta / fobT : 0, multCosto: costo > 0 ? venta / costo : 0,
        prima: costo - sinDiv, logis: sinDiv - fobT,
        nSF: nSF, udsSF: udsSF, ventaSF: ventaSF, nSinEmb: nSinEmb,
        nBajos: nBajos, nTocados: nTocados
      };
    }

    function _lpaKpis() {
      const t = _lpaTotales();
      const dto = dtoDivisaPct();
      const ventaV = t.venta * (1 - dto / 100);
      const utilV = ventaV - t.costo;
      const dif = t.util - t.util0;
      const pc = (x, b) => b > 0 ? (x / b * 100).toFixed(1) + '%' : '—';
      const st = (lbl, val, sub, color) => '<div class="lpa-st"><b>' + lbl + '</b><s'
        + (color ? ' style="color:' + color + '"' : '') + '>' + val + '</s><i>' + (sub || '&nbsp;') + '</i></div>';

      // ── Tira 1: el resultado, en una sola linea ──
      let h = '<div class="lpa-tira">'
        + st('Facturación', fmtUSD(t.venta), t.uds.toLocaleString('es-VE') + ' uds')
        + st('Costo landed', fmtUSD(t.costo), pc(t.costo, t.venta) + ' de la venta')
        + st('Utilidad bruta', fmtUSD(t.util), 'margen ' + t.mg.toFixed(1) + '%', t.util >= 0 ? '#1E7B34' : '#B00020')
        + st('Multiplicador', '×' + t.multCosto.toFixed(2), 'sobre costo real')
        + st('En efectivo −' + dto.toFixed(1) + '%', fmtUSD(utilV), 'margen ' + (ventaV > 0 ? (utilV / ventaV * 100).toFixed(1) : '0') + '%')
        + '</div>';

      // ── Tira 2: los dos canales ──
      const canal = (nom, c, col) => '<div class="lpa-st" style="background:' + col + '"><b>' + nom + '</b>'
        + '<s style="font-size:13.5px">' + fmtUSD(c.util) + '</s>'
        + '<i>' + c.uds.toLocaleString('es-VE') + ' uds · factura ' + fmtUSD(c.venta) + ' · ' + c.mg.toFixed(1) + '%</i></div>';
      h += '<div class="lpa-tira" style="margin-top:5px">'
        + canal('Venta Directa', t.vd, '#EAF0F8')
        + canal('Distribuidora' + (_lpaTier !== 'Publico' ? ' · ' + _lpaTier : ''), t.di, '#FBF3E0')
        + '</div>';

      if (t.nTocados > 0) {
        h += '<div style="margin-top:5px;padding:5px 8px;border-radius:5px;background:#EAF6EC;font-size:11.5px">'
          + '<strong>' + t.nTocados + '</strong> producto(s) modificado(s) · utilidad original ' + fmtUSD(t.util0)
          + ' &rarr; <strong style="color:' + (dif >= 0 ? '#1E7B34' : '#B00020') + '">'
          + (dif >= 0 ? '+' : '−') + fmtUSD(Math.abs(dif)) + '</strong></div>';
      }

      // ── Avisos: cortos, siempre visibles ──
      let av = [];
      if (t.nBajos > 0) av.push('<span style="color:#B00020;font-weight:700">' + t.nBajos + ' bajo el ' + MARGEN_MINIMO + '%</span>');
      if (t.nSF > 0) av.push('<span style="color:#BF8F00;font-weight:700">' + t.nSF + ' sin FOB</span> (' + fmtUSD(t.ventaSF) + ', fuera del cálculo)');
      if (t.nSinEmb > 0) av.push('<span style="color:#BF8F00">' + t.nSinEmb + ' sin embarque</span>');
      if (av.length) h += '<div style="margin-top:5px;font-size:11.5px">⚠ ' + av.join(' · ') + '</div>';

      // ── Detalle, plegado: no le roba altura a la tabla ──
      const fl = (l, v, e) => '<tr><td style="padding:2px 6px">' + l + '</td>'
        + '<td style="padding:2px 6px;text-align:right;white-space:nowrap">' + v + '</td>'
        + '<td style="padding:2px 6px;text-align:right;color:var(--dgray);white-space:nowrap">' + (e || '') + '</td></tr>';
      h += '<details class="lpa-det" ontoggle="_lpaDet(this.open)"' + (_lpaDetAbierto ? ' open' : '') + '>'
        + '<summary>Ver desglose del costo y detalle por canal</summary>'
        + '<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px">'
        + '<table style="flex:1 1 260px;border-collapse:collapse">'
        + '<tr><th colspan="3" style="text-align:left;padding:2px 6px;color:var(--dgray);font-size:10px;text-transform:uppercase">De qué está hecho el costo</th></tr>'
        + fl('FOB (la mercancía)', fmtUSD(t.fobT), pc(t.fobT, t.costo))
        + fl('Flete + aduana + comisión', fmtUSD(t.logis), pc(t.logis, t.costo))
        + fl('Prima por compra de divisas', fmtUSD(t.prima), pc(t.prima, t.costo))
        + fl('<strong>Costo landed</strong>', '<strong>' + fmtUSD(t.costo) + '</strong>', '100%')
        + fl('Multiplicador sobre FOB', '×' + t.multFob.toFixed(2), '')
        + '</table>'
        + '<table style="flex:1 1 300px;border-collapse:collapse">'
        + '<tr><th style="text-align:left;padding:2px 6px;color:var(--dgray);font-size:10px;text-transform:uppercase">Por canal</th>'
        + '<th style="text-align:right;padding:2px 6px;color:var(--dgray);font-size:10px;text-transform:uppercase">V. Directa</th>'
        + '<th style="text-align:right;padding:2px 6px;color:var(--dgray);font-size:10px;text-transform:uppercase">Distrib.</th></tr>'
        + fl('Unidades', t.vd.uds.toLocaleString('es-VE'), t.di.uds.toLocaleString('es-VE'))
        + fl('Facturación', fmtUSD(t.vd.venta), fmtUSD(t.di.venta))
        + fl('Costo landed', fmtUSD(t.vd.costo), fmtUSD(t.di.costo))
        + fl('<strong>Utilidad</strong>', '<strong>' + fmtUSD(t.vd.util) + '</strong>', '<strong>' + fmtUSD(t.di.util) + '</strong>')
        + fl('Margen', t.vd.mg.toFixed(1) + '%', t.di.mg.toFixed(1) + '%')
        + fl('Aporte a la utilidad', pc(t.vd.util, t.util), pc(t.di.util, t.util))
        + '</table></div>'
        + '<div style="font-size:10.5px;color:var(--dgray);margin-top:3px">Venta Directa siempre a precio público. Distribuidora valorada '
        + (_lpaTier === 'Publico' ? 'a precio público' : 'con descuento ' + _lpaTier + ' (' + Math.round((1 - t.facDist) * 100) + '%)')
        + '.</div></details>';

      document.getElementById('lpa-kpis').innerHTML = h;
    }

    // ── Tabla ──
    function _lpaRenderTabla() {
      const cont = document.getElementById('lpa-tbody');
      if (!cont) return;
      const vis = _LPA.map((r, i) => [r, i]).filter(([r]) => !_lpaSoloBajos || (() => { const m = _lpaMargen(r); return isFinite(m) && m < MARGEN_MINIMO; })());
      if (vis.length === 0) { cont.innerHTML = '<tr><td colspan="9" style="padding:14px;text-align:center;color:var(--dgray)">Ningún producto bajo el ' + MARGEN_MINIMO + '%.</td></tr>'; return; }
      cont.innerHTML = vis.map(([r, i]) => _lpaFilaHTML(r, i)).join('');
    }

    function _lpaFilaHTML(r, i) {
      const td = 'padding:3px 6px;border-bottom:1px solid var(--border);white-space:nowrap';
      const m = _lpaMult(r), mg = _lpaMargen(r);
      const sinFob = r.fob <= 0;
      return '<tr id="lpa-r' + i + '"' + (r.tocado ? ' style="background:#EAF6EC"' : '') + '>'
        + '<td style="' + td + ';white-space:normal;min-width:150px"><strong>' + r.cod + '</strong>'
        + (r.manual ? ' <span style="font-size:9px;color:#BF8F00;font-weight:700">MANUAL</span>' : '')
        + '<br><span style="color:var(--dgray);font-size:10.5px">' + r.desc.slice(0, 42) + '</span></td>'
        + '<td style="' + td + ';text-align:right">' + (r.uvd || '<span style="color:var(--dgray)">—</span>') + '</td>'
        + '<td style="' + td + ';text-align:right">' + (r.udist || '<span style="color:var(--dgray)">—</span>') + '</td>'
        + '<td style="' + td + ';text-align:right">' + (sinFob ? '<span style="color:#B00020">—</span>' : fmtUSD(r.fob)) + '</td>'
        + '<td style="' + td + ';text-align:right">' + (sinFob ? '—' : fmtUSD(r.costo)) + '</td>'
        + '<td style="' + td + ';text-align:center">'
        + (sinFob ? '<span style="color:var(--dgray)">—</span>'
          : '<input type="number" step="0.05" min="0" id="lpa-m' + i + '" value="' + m.toFixed(2) + '"'
          + ' oninput="_lpaCambioMult(' + i + ',this.value)"'
          + ' style="width:62px;padding:3px;border:1px solid var(--border);border-radius:4px;text-align:center;font-size:12px;font-family:inherit;background:var(--card,#FFF);color:inherit">')
        + '</td>'
        + '<td style="' + td + ';text-align:center">'
        + '<input type="number" step="0.5" min="0" id="lpa-p' + i + '" value="' + r.pr.toFixed(2) + '"'
        + ' oninput="_lpaCambioPrecio(' + i + ',this.value)"'
        + ' style="width:76px;padding:3px;border:1px solid var(--border);border-radius:4px;text-align:right;font-size:12px;font-weight:600;font-family:inherit;background:var(--card,#FFF);color:inherit"></td>'
        + '<td style="' + td + ';text-align:right;font-weight:700;color:' + _lpaColorMg(mg) + '" id="lpa-g' + i + '">'
        + (isFinite(mg) ? mg.toFixed(1) + '%' : '—') + '</td>'
        + '<td style="' + td + ';text-align:right;font-weight:600" id="lpa-t' + i + '">' + fmtUSD(_lpaTotalFila(r)) + '</td>'
        + '</tr>';
    }

    // Refresca SOLO las celdas derivadas: reescribir la fila entera mataria
    // el foco del input mientras se escribe.
    function _lpaRefrescarFila(i) {
      const r = _LPA[i];
      const mg = _lpaMargen(r);
      const g = document.getElementById('lpa-g' + i);
      const t = document.getElementById('lpa-t' + i);
      const tr = document.getElementById('lpa-r' + i);
      if (g) { g.textContent = isFinite(mg) ? mg.toFixed(1) + '%' : '—'; g.style.color = _lpaColorMg(mg); }
      if (t) t.textContent = fmtUSD(_lpaTotalFila(r));
      if (tr) tr.style.background = r.tocado ? '#EAF6EC' : '';
      _lpaKpis();
    }

    function _lpaCambioMult(i, v) {
      const r = _LPA[i];
      const m = parseFloat(v);
      if (!isFinite(m) || m < 0 || r.fob <= 0) return;
      r.pr = Math.round(r.fob * m * 100) / 100;
      r.tocado = true;
      const inp = document.getElementById('lpa-p' + i);
      if (inp && document.activeElement !== inp) inp.value = r.pr.toFixed(2);
      _lpaRefrescarFila(i);
    }

    function _lpaCambioPrecio(i, v) {
      const r = _LPA[i];
      const p = parseFloat(v);
      if (!isFinite(p) || p < 0) return;
      r.pr = Math.round(p * 100) / 100;
      r.tocado = true;
      const inp = document.getElementById('lpa-m' + i);
      if (inp && document.activeElement !== inp && r.fob > 0) inp.value = _lpaMult(r).toFixed(2);
      _lpaRefrescarFila(i);
    }

    // Aplica un multiplicador a TODOS los que tienen FOB. Los sin FOB no se
    // pueden multiplicar: se cuentan y se avisa en vez de tocarlos en silencio.
    function _lpaAplicarGlobal() {
      const v = parseFloat(document.getElementById('lpa-mult-global').value);
      if (!isFinite(v) || v <= 0) { notif('Escribe un multiplicador válido (ej. 2.5)', 'error'); return; }
      let n = 0, saltados = 0;
      _LPA.forEach(r => {
        if (r.fob <= 0) { saltados++; return; }
        r.pr = Math.round(r.fob * v * 100) / 100; r.tocado = true; n++;
      });
      _lpaRenderTabla(); _lpaKpis();
      notif('×' + v + ' aplicado a ' + n + ' producto(s)' + (saltados > 0 ? ' · ' + saltados + ' sin FOB quedaron igual' : ''), 'success');
    }

    // Lleva al MARGEN_MINIMO solo a los que estan por debajo. El resto no se toca.
    function _lpaSubirBajos() {
      let n = 0;
      _LPA.forEach(r => {
        const m = _lpaMargen(r);
        if (!isFinite(m) || m >= MARGEN_MINIMO || r.fob <= 0) return;
        r.pr = Math.round(r.costo / (1 - MARGEN_MINIMO / 100) * 100) / 100; r.tocado = true; n++;
      });
      if (n === 0) { notif('No hay productos por debajo del ' + MARGEN_MINIMO + '%', 'success'); return; }
      _lpaRenderTabla(); _lpaKpis();
      notif('✓ ' + n + ' producto(s) llevados al ' + MARGEN_MINIMO + '% de margen', 'success');
    }

    function _lpaRestaurar() {
      _LPA.forEach(r => { r.pr = r.pr0; r.tocado = false; });
      _lpaRenderTabla(); _lpaKpis();
      notif('Precios restaurados a los de la lista', 'success');
    }

    function _lpaToggleBajos(on) { _lpaSoloBajos = !!on; _lpaRenderTabla(); }

    // Saca la simulacion a CSV. Lleva costo y margen: es documento interno,
    // NUNCA se le manda a un cliente.
    // Saca la simulacion a CSV. Lleva costo y margen: es documento interno,
    // NUNCA se le manda a un cliente.
    function _lpaCSV() {
      const fd = _lpaFacDist();
      const num = x => isFinite(x) ? x.toFixed(2).replace('.', ',') : '';
      let csv = 'Codigo;Descripcion;Marca;Uds V.Directa;Uds Distribuidora;FOB;Costo landed;'
        + 'Precio actual;Precio simulado;xFOB;Margen %;Total V.Directa;Total Distribuidora;Total linea\n';
      _LPA.forEach(r => {
        csv += [r.cod, r.desc.replace(/[\r\n;]+/g, ' '), r.marca, r.uvd, r.udist,
        num(r.fob), num(r.costo), num(r.pr0), num(r.pr), num(_lpaMult(r)), num(_lpaMargen(r)),
        num(r.pr * r.uvd), num(r.pr * fd * r.udist), num(_lpaTotalFila(r))].join(';') + '\n';
      });
      const t = _lpaTotales();
      csv += ';;;;;;;;;;;;;\n';
      csv += 'TOTALES;;;' + t.vd.uds + ';' + t.di.uds + ';' + num(t.fobT) + ';' + num(t.costo)
        + ';' + num(t.venta0) + ';' + num(t.venta) + ';' + num(t.multFob) + ';' + num(t.mg)
        + ';' + num(t.vd.venta) + ';' + num(t.di.venta) + ';' + num(t.venta) + '\n';
      csv += 'UTILIDAD;;;;;;;;;;;' + num(t.vd.util) + ';' + num(t.di.util) + ';' + num(t.util) + '\n';
      csv += 'Distribuidora valorada con tier;' + _lpaTier + '\n';
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ARJ_INTERNO_Simulacion_Precios_' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      logBitacora('precio', 'Exportó simulación de precios (INTERNO) — ' + _LPA.length + ' productos', false);
      notif('✓ CSV interno descargado — no se lo mandes a un cliente', 'success');
    }

    // ── INFORME PDF (v13.26) ──────────────────────────────────────
    // Documento INTERNO: lleva costo, margen y utilidad. Va rotulado en la
    // cabecera, en cada pagina y al pie para que nunca se confunda con la
    // lista del cliente, que es el documento que SI sale de la empresa.
    function _lpaPDF() {
      if (!_LPA || _LPA.length === 0) { notif('No hay nada que informar', 'error'); return; }
      const t = _lpaTotales();
      const dto = dtoDivisaPct();
      const ventaV = t.venta * (1 - dto / 100);
      const utilV = ventaV - t.costo;
      const hoy = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
      const pc = (x, b) => b > 0 ? (x / b * 100).toFixed(1) + '%' : '—';
      const nTier = { 'Publico': 'precio público', 'T1': 'Aliado T1 (−5%)', 'T2': 'Aliado T2 (−10%)', 'T3': 'Aliado T3 (−20%)' }[_lpaTier] || _lpaTier;

      let h = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ARJ Informe Interno de Precios</title><style>'
        + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
        + 'body{font-family:Arial,sans-serif;font-size:10.5px;color:#222;margin:20px}'
        + 'h1{color:#1F3864;font-size:18px;text-align:center;margin:0 0 2px}'
        + '.sub{text-align:center;color:#595959;font-size:10.5px;margin-bottom:3px}'
        + '.sello{text-align:center;background:#B00020;color:#FFF;font-weight:bold;font-size:11px;'
        + 'padding:4px;border-radius:4px;margin:8px 0 12px;letter-spacing:.5px}'
        + 'h2{color:#1F3864;font-size:12.5px;margin:14px 0 5px;border-bottom:2px solid #BF8F00;padding-bottom:2px}'
        + 'table{width:100%;border-collapse:collapse;margin-bottom:4px}'
        + 'th{background:#BF8F00;color:#FFF;padding:4px 6px;text-align:left;font-size:10px}'
        + 'th.n,td.n{text-align:right}'
        + 'td{padding:3px 6px;border-bottom:1px solid #E0E0E0}'
        + 'tr:nth-child(even) td{background:#F7F7F7}'
        + '.big{background:#F2F5FA;border-radius:6px;padding:10px;text-align:center;margin-bottom:10px}'
        + '.big .n{font-size:22px;font-weight:800;color:#1E7B34}'
        + '.tot td{font-weight:bold;background:#EDEFF4 !important;border-top:2px solid #1F3864}'
        + '.rojo{color:#B00020;font-weight:bold}.verde{color:#1E7B34}'
        + '.nota{font-size:9px;color:#595959;font-style:italic;margin-top:3px;line-height:1.4}'
        + '.pie{margin-top:12px;padding-top:6px;border-top:1px solid #D9D9D9;text-align:center;color:#B00020;font-size:9px;font-weight:bold}'
        + '@media print{body{margin:10mm}thead{display:table-header-group}tr{page-break-inside:avoid}}'
        + '</style></head><body>'
        + '<h1>ARJ — AGRO REPUESTOS Y SERVICIOS JIMÉNEZ</h1>'
        + '<div class="sub">Informe de precios y rentabilidad · ' + hoy + '</div>'
        + '<div class="sub"><strong>' + _lpNombreMarcas() + '</strong> · ' + _LPA.length + ' productos · '
        + (t.uds + t.udsSF).toLocaleString('es-VE') + ' unidades en existencia</div>'
        + '<div class="sello">DOCUMENTO INTERNO — CONTIENE COSTOS Y MÁRGENES — NO ENTREGAR A CLIENTES</div>';

      h += '<div class="big"><div style="font-size:10px;color:#595959;text-transform:uppercase;letter-spacing:.5px">Utilidad bruta estimada</div>'
        + '<div class="n">' + fmtUSD(t.util) + '</div>'
        + '<div style="font-size:10.5px;color:#595959">margen ' + t.mg.toFixed(1) + '% sobre una facturación de '
        + fmtUSD(t.venta) + '</div></div>';

      h += '<h2>Resultado por canal</h2><table>'
        + '<tr><th>Concepto</th><th class="n">Venta Directa</th><th class="n">Distribuidora</th><th class="n">Total</th></tr>'
        + '<tr><td>Unidades</td><td class="n">' + t.vd.uds.toLocaleString('es-VE') + '</td><td class="n">'
        + t.di.uds.toLocaleString('es-VE') + '</td><td class="n">' + t.uds.toLocaleString('es-VE') + '</td></tr>'
        + '<tr><td>Facturación</td><td class="n">' + fmtUSD(t.vd.venta) + '</td><td class="n">'
        + fmtUSD(t.di.venta) + '</td><td class="n">' + fmtUSD(t.venta) + '</td></tr>'
        + '<tr><td>Costo landed</td><td class="n">' + fmtUSD(t.vd.costo) + '</td><td class="n">'
        + fmtUSD(t.di.costo) + '</td><td class="n">' + fmtUSD(t.costo) + '</td></tr>'
        + '<tr class="tot"><td>Utilidad bruta</td><td class="n">' + fmtUSD(t.vd.util) + '</td><td class="n">'
        + fmtUSD(t.di.util) + '</td><td class="n">' + fmtUSD(t.util) + '</td></tr>'
        + '<tr><td>Margen</td><td class="n">' + t.vd.mg.toFixed(1) + '%</td><td class="n">'
        + t.di.mg.toFixed(1) + '%</td><td class="n">' + t.mg.toFixed(1) + '%</td></tr>'
        + '<tr><td>Aporte a la utilidad</td><td class="n">' + pc(t.vd.util, t.util) + '</td><td class="n">'
        + pc(t.di.util, t.util) + '</td><td class="n">100%</td></tr>'
        + '</table>'
        + '<div class="nota">Venta Directa valorada a precio público. Distribuidora valorada a ' + nTier + '.</div>';

      h += '<h2>De qué está hecho el costo</h2><table>'
        + '<tr><th>Componente</th><th class="n">Monto</th><th class="n">% del costo</th></tr>'
        + '<tr><td>FOB (la mercancía)</td><td class="n">' + fmtUSD(t.fobT) + '</td><td class="n">' + pc(t.fobT, t.costo) + '</td></tr>'
        + '<tr><td>Flete + aduana + comisión</td><td class="n">' + fmtUSD(t.logis) + '</td><td class="n">' + pc(t.logis, t.costo) + '</td></tr>'
        + '<tr><td>Prima por compra de divisas</td><td class="n">' + fmtUSD(t.prima) + '</td><td class="n">' + pc(t.prima, t.costo) + '</td></tr>'
        + '<tr class="tot"><td>Costo landed total</td><td class="n">' + fmtUSD(t.costo) + '</td><td class="n">100%</td></tr>'
        + '</table>'
        + '<div class="nota">Multiplicador promedio ponderado: ×' + t.multFob.toFixed(2) + ' sobre FOB · ×'
        + t.multCosto.toFixed(2) + ' sobre costo landed real. El segundo es el que se compara contra la competencia.</div>';

      h += '<h2>Si todo se cobrara en efectivo (−' + dto.toFixed(1) + '%)</h2><table>'
        + '<tr><th>Concepto</th><th class="n">Monto</th></tr>'
        + '<tr><td>Facturación en $ verde</td><td class="n">' + fmtUSD(ventaV) + '</td></tr>'
        + '<tr class="tot"><td>Utilidad en ese escenario</td><td class="n">' + fmtUSD(utilV) + ' · '
        + (ventaV > 0 ? (utilV / ventaV * 100).toFixed(1) : '0') + '%</td></tr></table>'
        + '<div class="nota">El descuento por pago en efectivo no es un regalo: es la conversión exacta de $BCV a $ físico.</div>';

      if (t.nBajos > 0 || t.nSF > 0) {
        h += '<h2>Puntos de atención</h2><ul style="margin:4px 0 0 16px;padding:0;line-height:1.6">';
        if (t.nBajos > 0) h += '<li><span class="rojo">' + t.nBajos + ' producto(s)</span> por debajo del ' + MARGEN_MINIMO + '% de margen.</li>';
        if (t.nSF > 0) h += '<li><span class="rojo">' + t.nSF + ' producto(s) sin FOB</span> (' + t.udsSF.toLocaleString('es-VE')
          + ' unidades, ' + fmtUSD(t.ventaSF) + '): sin costo calculable, excluidos de la utilidad.</li>';
        if (t.nSinEmb > 0) h += '<li>' + t.nSinEmb + ' producto(s) sin embarque localizable: su prima de divisas quedó dentro del FOB.</li>';
        h += '</ul>';
      }

      h += '<h2>Detalle por producto</h2><table>'
        + '<thead><tr><th>Código</th><th>Descripción</th><th class="n">V.D.</th><th class="n">Dist.</th>'
        + '<th class="n">FOB</th><th class="n">Costo</th><th class="n">×FOB</th><th class="n">Precio</th>'
        + '<th class="n">Margen</th><th class="n">Total</th></tr></thead><tbody>';
      _LPA.slice().sort((a, b) => (a.marca + a.desc).localeCompare(b.marca + b.desc)).forEach(r => {
        const m = _lpaMult(r), mg = _lpaMargen(r);
        const bajo = isFinite(mg) && mg < MARGEN_MINIMO;
        h += '<tr><td>' + r.cod + '</td><td>' + r.desc.slice(0, 44) + '</td>'
          + '<td class="n">' + (r.uvd || '—') + '</td><td class="n">' + (r.udist || '—') + '</td>'
          + '<td class="n">' + (r.fob > 0 ? fmtUSD(r.fob) : '—') + '</td>'
          + '<td class="n">' + (r.fob > 0 ? fmtUSD(r.costo) : '—') + '</td>'
          + '<td class="n">' + (isFinite(m) ? '×' + m.toFixed(2) : '—') + '</td>'
          + '<td class="n">' + fmtUSD(r.pr) + '</td>'
          + '<td class="n' + (bajo ? '" style="color:#B00020;font-weight:bold' : '') + '">'
          + (isFinite(mg) ? mg.toFixed(1) + '%' : '—') + '</td>'
          + '<td class="n">' + fmtUSD(_lpaTotalFila(r)) + '</td></tr>';
      });
      h += '<tr class="tot"><td colspan="2">TOTALES</td><td class="n">' + t.vd.uds.toLocaleString('es-VE')
        + '</td><td class="n">' + t.di.uds.toLocaleString('es-VE') + '</td>'
        + '<td class="n">' + fmtUSD(t.fobT) + '</td><td class="n">' + fmtUSD(t.costo) + '</td>'
        + '<td class="n">×' + t.multFob.toFixed(2) + '</td><td class="n">—</td>'
        + '<td class="n">' + t.mg.toFixed(1) + '%</td><td class="n">' + fmtUSD(t.venta) + '</td></tr>'
        + '</tbody></table>';

      h += '<div class="nota">Estimado de gestión sobre el inventario en existencia. No contempla costos fijos '
        + 'ni gastos operativos, y supone que se vende la totalidad del stock listado.</div>'
        + '<div class="pie">DOCUMENTO INTERNO — NO ENTREGAR A CLIENTES · ARJ · Acarigua, Portuguesa</div>'
        + '</body></html>';

      const w = window.open('', '_blank');
      if (!w) { notif('El navegador bloqueó la ventana. Permite popups para este sitio.', 'error'); return; }
      w.document.write(h);
      w.document.close();
      setTimeout(() => { w.print(); }, 400);
      logBitacora('precio', 'Generó informe PDF interno de precios — ' + _lpNombreMarcas() + ' (' + _LPA.length + ' productos)', false);
    }
