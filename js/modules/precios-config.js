// === Multiplicadores Precios ===
    // ─── MULTIPLICADORES DE PRECIO ──────────────────────────────
    function aplicarMultiplicador(mult) {
      const fob = parseFloat(document.getElementById('ep-fob').value) || 0;
      if (fob === 0) { notif('Primero ingresa el costo FOB', 'warning'); return; }
      // v13.12: los atajos multiplican sobre el COSTO LANDED, no sobre el FOB.
      // Antes el mismo boton daba margenes distintos segun el proveedor: "x2.50"
      // era 30,5% con Panegossi (1,7366) y 36,9% con Agrostahl (1,5764). El
      // nombre del boton mentia. Sobre el landed el margen es fijo y no depende
      // del factor:  margen = (mult - 1) / mult.  x1,80 -> 44,4% siempre.
      const _fEl = document.getElementById('ep-factor');
      const _fRaw = _fEl ? parseFloat(_fEl.value) : NaN;
      const factor = (isFinite(_fRaw) && _fRaw > 0) ? _fRaw : FACTOR_LANDED_FALLBACK;
      const costo = fob * factor;
      // x1,00 es "vender al costo" (traspaso interno FINARMA -> ARJ): sale EXACTO.
      // Redondear hacia arriba le meteria un margen que nadie pidio.
      const precio = (mult === 1)
        ? Math.round(costo * 100) / 100
        : redondeoBonito(costo * mult);
      document.getElementById('ep-precio-manual').value = precio.toFixed(2);
      actualizarPreviewPrecio();
    }

    function actualizarPreviewPrecio() {
      const fob = parseFloat(document.getElementById('ep-fob').value) || 0;
      const manual = parseFloat(document.getElementById('ep-precio-manual').value) || 0;
      const preview = document.getElementById('ep-preview-precio');
      if (!preview) return;
      const _fEl = document.getElementById('ep-factor');
      const _fRaw = _fEl ? parseFloat(_fEl.value) : NaN;
      const factor = (isFinite(_fRaw) && _fRaw > 0) ? _fRaw : FACTOR_LANDED_FALLBACK;
      const esLocal = (document.getElementById('ep-org-local') || {}).dataset
        ? document.getElementById('ep-org-local').dataset.activo === '1' : false;
      if (manual > 0 && fob > 0) {
        // El costo real NO es el FOB: es el FOB puesto en Acarigua (fob × factor del producto).
        // Antes estaba quemado en ×1.471, lo que inventaba flete en la mercancía comprada aquí.
        const costoLanded = fob * factor;
        const ganancia = manual - costoLanded;
        const margen = (ganancia / manual) * 100;
        const mult = costoLanded > 0 ? manual / costoLanded : 0;
        const col = margen < 25 ? 'var(--red)' : margen < 35 ? 'var(--gold)' : 'var(--green)';
        preview.innerHTML =
          '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline">' +
          '<span>Precio de venta: <strong style="color:var(--navy);font-size:15px">$' + manual.toFixed(2) + '</strong></span>' +
          '<span style="color:var(--dgray)">Te cuesta puesto aquí: <strong>$' + costoLanded.toFixed(2) + '</strong> <span style="font-size:10.5px">' + (factor === 1 ? '(compra local, sin flete de importación)' : '(costo $' + fob.toFixed(2) + ' × ' + factor.toFixed(3).replace('.', ',') + ')') + '</span></span>' +
          '</div>' +
          '<div style="margin-top:5px;padding-top:5px;border-top:1px dashed var(--border);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
          '<span>Ganas <strong style="color:' + col + ';font-size:15px">$' + ganancia.toFixed(2) + '</strong> por unidad</span>' +
          '<span style="color:var(--dgray)">Vendes a <strong>×' + mult.toFixed(1) + '</strong> el costo · Margen <strong style="color:' + col + '">' + margen.toFixed(1) + '%</strong></span>' +
          '</div>';
      } else if (manual > 0) {
        preview.innerHTML = 'Precio manual: <strong style="color:var(--navy)">$' + manual.toFixed(2) + ' USD</strong> <span style="color:var(--dgray)">(falta el FOB para calcular la ganancia)</span>';
      } else if (fob > 0) {
        if (esLocal) {
          preview.innerHTML = '<span style="color:var(--red);font-weight:600">Compra local: tienes que poner el precio de venta a mano.</span> <span style="color:var(--dgray)">El escalón automático asume costo de fábrica y aquí te sobrepreciaría.</span>';
        } else {
          const sugerido = precioPublico(fob);
          preview.innerHTML = `Precio sugerido automático (×2.5 escalonado): <strong style="color:var(--navy)">$${sugerido.toFixed(2)} USD</strong> <span style="color:var(--dgray)">(sin precio manual)</span>`;
        }
      } else {
        preview.innerHTML = 'Precio público sugerido: <strong style="color:var(--navy)">— USD</strong>';
      }
    }

    // ─── SISTEMAS EDITABLES POR GERENTE ─────────────────────────
    // v13.3 BUG CORREGIDO: esta funcion hacia SISTEMAS.push() y nada mas. El
    // sistema aparecia en el select y decia "guardado", pero al refrescar
    // cargarDatosSupabase() vaciaba el array y lo rellenaba desde la tabla,
    // donde nunca se habia insertado nada. Ahora escribe primero y solo suma al
    // array local si el insert salio bien.