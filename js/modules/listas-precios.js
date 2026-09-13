// === Listas de Precios ===
    // ═══════════════════════════════════════════════════════════════
    // ELEGIBILIDAD PARA LA LISTA DEL CLIENTE (v13.12)
    // Tres condiciones, todas obligatorias:
    //   1. EMBARQUE SELLADO. Sin embarque_id el producto arrastra el factor
    //      FACTOR_LANDED_FALLBACK, que fue un estimado y nunca fue real: su
    //      precio esta mal calculado y no puede salir a un cliente.
    //      Los de compra local tampoco salen (decision de JJ, 22-ago-2026).
    //   2. EXISTENCIA en al menos una de las dos empresas. Cero en las dos =
    //      no se puede vender, no se ofrece.
    //   3. PRECIO CALCULABLE: FOB valido o precio_manual.
    // ═══════════════════════════════════════════════════════════════
    function _lpElegible(p) {
      if (!p || p.activo === false) return false;
      if (!p.embarque_id) return false;
      const sv = parseInt(p.stock_vd) || 0;
      const sd = parseInt(p.stock_dist) || 0;
      if (sv + sd <= 0) return false;
      return (p.fob > 0) || (p.precio_manual != null && p.precio_manual > 0);
    }

    let _lpMarcasSel = [];   // marcas marcadas por el usuario

    function _lpMarcasDisponibles() {
      // Solo marcas que tengan al menos un producto elegible. Devuelve [[marca, n], ...]
      const m = {};
      (PRODUCTOS || []).forEach(p => {
        if (!_lpElegible(p)) return;
        const k = (p.marca || '(sin marca)').trim() || '(sin marca)';
        m[k] = (m[k] || 0) + 1;
      });
      return Object.keys(m).sort((a, b) => a.localeCompare(b)).map(k => [k, m[k]]);
    }

    function descargarListaPrecios() {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede generar la lista de precios', 'error'); return; }
      const disp = _lpMarcasDisponibles();
      // Por defecto NADA marcado: obliga a elegir a conciencia en vez de mandar
      // el catalogo entero por inercia.
      _lpMarcasSel = [];
      const buscar = document.getElementById('lp-buscar');
      if (buscar) buscar.value = '';
      _lpRenderMarcas(disp);
      _lpActualizarConteo();
      document.getElementById('modal-lista-precios').classList.add('show');
    }
    function cerrarListaPrecios() { document.getElementById('modal-lista-precios').classList.remove('show'); }

    function _lpRenderMarcas(disp) {
      const cont = document.getElementById('lp-marcas');
      if (!cont) return;
      if (!disp || disp.length === 0) {
        cont.innerHTML = '<div class="lp-vacio"><strong>No hay nada que listar.</strong><br>'
          + 'Ningun producto cumple: embarque sellado + existencia.<br>'
          + 'Sella los costos desde Inventario &rarr; Conteo fisico.</div>';
        return;
      }
      const q = ((document.getElementById('lp-buscar') || {}).value || '').trim().toLowerCase();
      const vis = q ? disp.filter(([m]) => m.toLowerCase().includes(q)) : disp;
      if (vis.length === 0) {
        cont.innerHTML = '<div class="lp-vacio">Ninguna marca coincide con "' + q + '"</div>';
        return;
      }
      cont.innerHTML = vis.map(([m, n]) => {
        const chk = _lpMarcasSel.indexOf(m) >= 0 ? ' checked' : '';
        const id = 'lpm-' + m.replace(/[^A-Za-z0-9]/g, '_');
        return '<label class="lp-marca" for="' + id + '">'
          + '<input type="checkbox" id="' + id + '"' + chk
          + ' onchange="_lpToggleMarca(this.checked, ' + JSON.stringify(m).replace(/"/g, '&quot;') + ')">'
          + '<span>' + m + '</span><span class="n">' + n + '</span></label>';
      }).join('');
    }

    function _lpFiltrarMarcas() { _lpRenderMarcas(_lpMarcasDisponibles()); }

    function _lpToggleMarca(on, marca) {
      const i = _lpMarcasSel.indexOf(marca);
      if (on && i < 0) _lpMarcasSel.push(marca);
      if (!on && i >= 0) _lpMarcasSel.splice(i, 1);
      _lpActualizarConteo();
    }

    function _lpMarcarTodas(on) {
      // Marca/desmarca TODAS las disponibles, no solo las visibles en el filtro:
      // "Todas" que solo marca lo que se ve seria una trampa silenciosa.
      _lpMarcasSel = on ? _lpMarcasDisponibles().map(x => x[0]) : [];
      _lpRenderMarcas(_lpMarcasDisponibles());
      _lpActualizarConteo();
    }

    function _lpActualizarConteo() {
      const n = _productosParaLista().length;
      const el = document.getElementById('lp-conteo');
      const pdf = document.getElementById('lp-btn-pdf');
      const csv = document.getElementById('lp-btn-csv');
      const ana = document.getElementById('lp-btn-analisis');
      if (el) {
        el.classList.toggle('cero', n === 0);
        if (_lpMarcasSel.length === 0) {
          el.innerHTML = 'Elige al menos una marca arriba.';
        } else {
          const marcasTxt = _lpMarcasSel.length === 1
            ? _lpMarcasSel[0]
            : _lpMarcasSel.length + ' marcas';
          el.innerHTML = '<strong>' + n + '</strong> producto(s) en la lista &middot; ' + marcasTxt;
        }
      }
      const off = (n === 0);
      [pdf, csv, ana].forEach(b => { if (b) { b.disabled = off; b.style.opacity = off ? '0.45' : ''; b.style.cursor = off ? 'not-allowed' : ''; } });
    }

    // v13.12 LEYENDA DE MONEDA (art. 128 Ley del BCV / Convenio Cambiario N.1 de
    // 2018 / art. 51 Reglamento de la Ley del IVA). Una lista que dice "precios en
    // USD" a secas, sin declarar moneda de pago ni tasa, no cumple. Se declaran las
    // tres cosas en una linea: el USD es moneda de CUENTA, el bolivar es la moneda
    // de PAGO, y cual tasa BCV se uso. Consultar al contador ante cualquier duda.
    function _lpLeyendaMoneda() {
      const t = parseFloat(estado.tasa_bcv);
      const base = 'Precios referenciales en USD · Pago en Bs a la tasa BCV del día de la venta';
      if (!isFinite(t) || t <= 0) return base;
      const tTxt = t.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return base + ' · Bs. ' + tTxt + '/USD';
    }

    function _lpNombreMarcas() {
      if (_lpMarcasSel.length === 0) return '';
      if (_lpMarcasSel.length === 1) return _lpMarcasSel[0];
      const disp = _lpMarcasDisponibles().length;
      if (_lpMarcasSel.length === disp) return 'Todas las marcas';
      return _lpMarcasSel.slice().sort().join(', ');
    }

    function _productosParaLista() {
      // Elegibles + de las marcas marcadas. Ordenados por marca y descripcion.
      return PRODUCTOS
        .filter(p => _lpElegible(p))
        .filter(p => _lpMarcasSel.indexOf((p.marca || '(sin marca)').trim() || '(sin marca)') >= 0)
        .slice()
        .sort((a, b) => ((a.marca || '') + a.desc).localeCompare((b.marca || '') + b.desc));
    }

    function listaPreciosCSV() {
      if (_lpMarcasSel.length === 0) { notif('Elige al menos una marca antes de descargar', 'error'); return; }
      const filas = _productosParaLista();
      if (filas.length === 0) { notif('No hay productos para la lista', 'error'); return; }
      let csv = 'Codigo;Descripcion;Marca;Precio USD\n';
      filas.forEach(p => {
        const desc = (p.desc || '').replace(/[\r\n;]+/g, ' ').trim();
        // Coma decimal: esta lista se arma a mano y no pasa por _csvEsc.
        const pr = precioLista(p).toFixed(2).replace('.', ',');
        csv += p.cod_alt + ';' + desc + ';' + (p.marca || '') + ';' + pr + '\n';
      });
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const hoy = new Date().toISOString().slice(0, 10);
      // El nombre lleva la marca: evita que dos listas distintas se pisen en la
      // carpeta de descargas y que se mande la equivocada por WhatsApp.
      const _sufijo = _lpMarcasSel.length === 1
        ? '_' + _lpMarcasSel[0].replace(/[^A-Za-z0-9]/g, '')
        : (_lpMarcasSel.length === _lpMarcasDisponibles().length ? '' : '_' + _lpMarcasSel.length + 'marcas');
      a.download = 'ARJ_Lista_Precios' + _sufijo + '_' + hoy + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      logBitacora('precio', 'Descargó lista de precios CSV — ' + _lpNombreMarcas() + ' (' + filas.length + ' productos)', false);
      cerrarListaPrecios();
      notif('✓ Lista CSV descargada (' + filas.length + ' productos)', 'success');
    }

    function listaPreciosPDF() {
      if (_lpMarcasSel.length === 0) { notif('Elige al menos una marca antes de generar el PDF', 'error'); return; }
      const filas = _productosParaLista();
      if (filas.length === 0) { notif('No hay productos para la lista', 'error'); return; }
      const hoy = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
      let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ARJ Lista de Precios</title><style>'
        + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
        + 'body{font-family:Arial,sans-serif;font-size:11px;color:#222;margin:24px}'
        + 'h1{color:#1F3864;font-size:20px;text-align:center;margin-bottom:2px}'
        + '.sub{text-align:center;color:#595959;font-style:italic;font-size:10.5px;margin-bottom:4px}'
        + '.marcas{text-align:center;color:#1F3864;font-weight:bold;font-size:12px;margin-bottom:3px}'
        + '.moneda{text-align:center;color:#7A7A7A;font-size:9px;margin-bottom:12px}'
        + 'table{width:100%;border-collapse:collapse}'
        + 'th{background:#BF8F00;color:#FFF;padding:5px 8px;text-align:left;font-size:11px}'
        + 'th.num,td.num{text-align:right}'
        + 'td{padding:4px 8px;border-bottom:1px solid #E0E0E0}'
        + 'tr:nth-child(even) td{background:#F7F7F7}'
        + '.pie{margin-top:14px;text-align:center;color:#595959;font-style:italic;font-size:9.5px}'
        + '@media print{body{margin:10mm}thead{display:table-header-group}}'
        + '</style></head><body>'
        + '<h1>ARJ — AGRO REPUESTOS Y SERVICIOS JIMÉNEZ</h1>'
        + '<div class="sub">Lista de Precios · Repuestos para Maquinaria Agrícola · ' + hoy + '</div>'
        + '<div class="marcas">' + _lpNombreMarcas() + '</div>'
        + '<div class="moneda">' + _lpLeyendaMoneda() + '</div>'
        + '<table><thead><tr><th>Código</th><th>Descripción</th><th>Marca</th><th class="num">Ref. USD</th></tr></thead><tbody>';
      filas.forEach(p => {
        const desc = (p.desc || '').replace(/[\r\n]+/g, ' ').trim();
        html += '<tr><td>' + p.cod_alt + '</td><td>' + desc + '</td><td>' + (p.marca || '') + '</td><td class="num">$ ' + precioLista(p).toFixed(2) + '</td></tr>';
      });
      html += '</tbody></table>'
        + '<div class="pie">Precios sujetos a cambio sin previo aviso · Consulte disponibilidad · IVA exento (Decreto 126) · Acarigua, Portuguesa — Venezuela</div>'
        + '</body></html>';
      const w = window.open('', '_blank');
      if (!w) { notif('El navegador bloqueó la ventana. Permite popups para este sitio.', 'error'); return; }
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.print(); }, 400);
      logBitacora('precio', 'Generó lista de precios PDF — ' + _lpNombreMarcas() + ' (' + filas.length + ' productos)', false);
      cerrarListaPrecios();
    }


    // ─── LISTAS DE PRECIOS PERSONALIZADAS ──────────────────────
    function renderListasPrecios() {
      const cont = document.getElementById('listas-precios-cont');
      if (!cont) return;
      // Listas estándar
      let html = `
    <div class="lista-precio-row" style="background:#F5F8FC">
      <div><div class="lp-nombre">Público (estándar)</div><div class="lp-desc">Sin descuento — todos los clientes nuevos</div></div>
      <span class="lp-tag">SISTEMA</span>
    </div>
    <div class="lista-precio-row" style="background:#F5F8FC">
      <div><div class="lp-nombre">Aliado T1</div><div class="lp-desc">–5% — compras de $2.500 a $4.999</div></div>
      <span class="lp-tag">SISTEMA</span>
    </div>
    <div class="lista-precio-row" style="background:#F5F8FC">
      <div><div class="lp-nombre">Aliado T2</div><div class="lp-desc">–10% — compras de $5.000 a $14.999</div></div>
      <span class="lp-tag">SISTEMA</span>
    </div>
    <div class="lista-precio-row" style="background:#F5F8FC">
      <div><div class="lp-nombre">Aliado T3</div><div class="lp-desc">–20% — compras desde $15.000</div></div>
      <span class="lp-tag">SISTEMA</span>
    </div>`;
      // Listas personalizadas
      html += LISTAS_PRECIOS.map(l => `
    <div class="lista-precio-row">
      <div>
        <div class="lp-nombre">${l.nombre}</div>
        <div class="lp-desc">${l.desc} · ${l.descuento}% ${l.tipo === 'descuento' ? 'descuento' : l.tipo === 'costo' ? 'sobre costo' : 'precio fijo'} · ${l.clientes} cliente(s) asignado(s)</div>
      </div>
      <div style="display:flex;gap:4px">

        <button class="btn btn-secondary btn-sm" onclick="eliminarLista('${l.nombre}')" title="Eliminar" style="color:var(--red)"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('');
      cont.innerHTML = html;
    }

    function abrirNuevaLista() {
      document.getElementById('lp-nombre').value = '';
      document.getElementById('lp-desc').value = '';
      document.getElementById('lp-descuento').value = '15';
      document.getElementById('modal-nueva-lista').classList.add('show');
    }
    function cerrarNuevaLista() { document.getElementById('modal-nueva-lista').classList.remove('show'); }
    function crearLista() {
      const nombre = document.getElementById('lp-nombre').value.trim();
      const desc = document.getElementById('lp-desc').value.trim();
      const descuento = parseFloat(document.getElementById('lp-descuento').value) || 0;
      const tipo = document.getElementById('lp-tipo').value;
      if (!nombre) { notif('Indica un nombre', 'error'); return; }
      if (LISTAS_PRECIOS.find(l => l.nombre === nombre)) { notif('Ya existe una lista con ese nombre', 'error'); return; }
      LISTAS_PRECIOS.push({ nombre, desc, descuento, tipo, clientes: 0 });
      logBitacora('precio', `Creó lista de precios personalizada "${nombre}" (${descuento}% ${tipo})`, true);
      cerrarNuevaLista();
      renderListasPrecios();
      notif(`Lista "${nombre}" creada. Asígnala a clientes desde su ficha individual.`, 'success');
    }

    function eliminarLista(nombre) {
      if (!confirm(`¿Eliminar la lista "${nombre}"? Los clientes asignados volverán al nivel Público.`)) return;
      LISTAS_PRECIOS = LISTAS_PRECIOS.filter(l => l.nombre !== nombre);
      logBitacora('precio', `Eliminó lista de precios "${nombre}"`, true);
      renderListasPrecios();
      notif(`Lista "${nombre}" eliminada`, 'warning');
    }
