// === Facturacion ===
    // Helper para obtener el saldo del cliente en la empresa actual
    function saldoCliente(c) {
      if (!c) return 0;
      return estado.empresa === 'directa' ? (c.saldo_vd || 0) : (c.saldo_dist || 0);
    }

    function seleccionarCliente() {
      const id = parseInt(document.getElementById('cliente-select').value);
      estado.cliente = CLIENTES.find(c => c.id === id) || null;
      // El botón de editar solo tiene sentido con un cliente seleccionado
      const btnEd = document.getElementById('btn-editar-cliente');
      if (btnEd) btnEd.disabled = !estado.cliente;
      if (estado.cliente) {
        // En Venta Directa SIEMPRE precio público; en Distribuidora se usa el nivel del cliente
        if (estado.empresa === 'directa') {
          estado.tier = 'Publico';
          estado.dto_manual = 0;
          estado.dto_motivo = '';
          const dtoInfo = document.getElementById('dto-manual-info'); if (dtoInfo) dtoInfo.textContent = '';
        } else {
          estado.tier = estado.cliente.nivel;
          actualizarTierUI();
        }
        const saldo = saldoCliente(estado.cliente);
        document.getElementById('info-cliente').innerHTML = `<i class="ti ti-info-circle"></i> Nivel asignado: <strong>${estado.empresa === 'directa' ? 'Público (Venta Directa)' : TIER_NAMES[estado.cliente.nivel]}</strong> · Tipo: <span class="cliente-info ${estado.cliente.tipo}">${estado.cliente.tipo === 'credito' ? 'A crédito' : 'Contado'}</span>${saldo > 0 ? ' · Debe en ' + nombreEmpresa(estado.empresa) + ': <strong style="color:var(--red)">' + fmtUSD(saldo) + '</strong>' : ''}`;
        actualizarPreciosPorTier();
        recalcular();
      } else {
        document.getElementById('info-cliente').textContent = 'Selecciona un cliente para empezar';
      }
    }

    // ─── DESCUENTO MANUAL (solo gerente en VD) ───
    function abrirDescuentoManual() {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede aplicar descuentos manuales', 'error'); return; }
      if (!estado.cliente) { notif('Selecciona primero un cliente', 'error'); return; }
      document.getElementById('dto-manual-pct').value = estado.dto_manual || 0;
      document.getElementById('dto-manual-motivo').value = estado.dto_motivo || '';
      previewDtoManual();
      document.getElementById('modal-dto-manual').classList.add('show');
    }
    function cerrarDescuentoManual() { document.getElementById('modal-dto-manual').classList.remove('show'); }
    function previewDtoManual() {
      const pct = parseFloat(document.getElementById('dto-manual-pct').value) || 0;
      const prev = document.getElementById('dto-manual-preview');
      const subtotal = estado.items.reduce((a, i) => a + i.cant * precioBaseItem(i), 0);
      if (pct <= 0) { prev.innerHTML = 'Sin descuento: se cobra precio público.'; return; }
      if (pct > 50) { prev.innerHTML = '<span style="color:var(--red)">El descuento máximo es 50%.</span>'; return; }
      const ahorro = subtotal * pct / 100;
      prev.innerHTML = `Subtotal sin descuento: <strong>${fmtUSD(subtotal)}</strong><br>Descuento ${pct}%: <strong style="color:var(--red)">−${fmtUSD(ahorro)}</strong><br>Total con descuento: <strong style="color:var(--green)">${fmtUSD(subtotal - ahorro)}</strong>`;
    }
    function aplicarDescuentoManual() {
      const pct = parseFloat(document.getElementById('dto-manual-pct').value) || 0;
      const motivo = document.getElementById('dto-manual-motivo').value.trim();
      if (pct < 0 || pct > 50) { notif('El descuento debe estar entre 0% y 50%', 'error'); return; }
      if (pct > 0 && !motivo) { notif('Indica el motivo del descuento', 'error'); return; }
      estado.dto_manual = pct;
      estado.dto_motivo = motivo;
      const info = document.getElementById('dto-manual-info');
      if (info) info.textContent = pct > 0 ? `−${pct}% aplicado` : '';
      if (pct > 0) {
        const _msg = `Aplicó descuento manual ${pct}% a ${estado.cliente.nombre} — motivo: "${motivo}" · Venta Directa`;
        logBitacora('precio', _msg, true);
        // v13.9: antes solo quedaba en memoria/localStorage — un refresh lo borraba.
        _sbLogBitacora(estado.usuario, estado.empresa, 'precio', _msg, true);
      }
      cerrarDescuentoManual();
      // v13.9: una sola ruta de precios — la misma que usa el cambio de tier.
      actualizarPreciosPorTier();
      recalcular();
      notif(pct > 0 ? `Descuento de ${pct}% aplicado` : 'Descuento removido', 'success');
    }

    function cambiarTier(t) {
      // Solo gerente puede cambiar tier
      if (estado.rol !== 'gerente') {
        notif('Solo el gerente puede cambiar el nivel de precio', 'error');
        return;
      }
      estado.tier = t;
      actualizarTierUI();
      actualizarPreciosPorTier();
      recalcular();
    }

    function actualizarTierUI() {
      document.querySelectorAll('.tier-btn').forEach(b => b.classList.toggle('active', b.dataset.tier === estado.tier));
      // Si no es gerente, deshabilitar tier-btns
      if (estado.rol !== 'gerente') {
        document.querySelectorAll('.tier-btn').forEach(b => b.style.opacity = '0.6');
      }
    }

    function actualizarPreciosPorTier() {
      const dto = (estado.empresa === 'directa' && estado.dto_manual > 0) ? estado.dto_manual : 0;
      estado.items.forEach(it => {
        if (dto > 0) {
          // v13.9: descuento manual sobre el precio BASE (cotizado > manual > fórmula).
          // Aplica a TODOS los renglones, incluidos los cotizados: el congelado
          // protege contra recálculos automáticos, no contra la decisión del gerente.
          it.precio = Math.round(precioBaseItem(it) * (1 - dto / 100) * 100) / 100;
        } else if (it.precio_fijo) {
          it.precio = precioBaseItem(it); // sin descuento: vuelve al precio cotizado
        } else {
          it.precio = precioConTier(it.fob, estado.tier, it);
        }
      });
      renderItems();
    }

    // ═══════════════════════════════════════════════════════════════
    // BÚSQUEDA POR COINCIDENCIA (parcial, fuzzy básico)
    // ═══════════════════════════════════════════════════════════════

    function buscarProducto() {
      const q = document.getElementById('busqueda-prod').value.trim();
      const cont = document.getElementById('search-results');
      if (!q) { cont.classList.remove('show'); return; }
      const qNorm = normalize(q);
      const words = qNorm.split(/\s+/).filter(w => w.length >= 1);
      // Coincidencia: cada palabra del query debe aparecer en algún campo del producto
      const matches = PRODUCTOS.filter(p => {
        const haystack = normalize(p.cod_alt + ' ' + p.cod_orig + ' ' + (p.cod_barras || '') + ' ' + p.desc + ' ' + p.marca);
        return words.every(w => haystack.includes(w));
      }).sort((a, b) => {
        // Relevancia: primero los que EMPIEZAN por lo buscado, luego por
        // qué tan al principio aparece. Si no, se veían resultados donde la
        // coincidencia estaba escondida a mitad de la descripción.
        const rank = p => {
          const cod = normalize(p.cod_alt), desc = normalize(p.desc), mar = normalize(p.marca);
          if (cod.startsWith(qNorm)) return 0;
          if (desc.startsWith(qNorm)) return 1;
          if (mar.startsWith(qNorm)) return 2;
          const i = desc.indexOf(qNorm);
          return i >= 0 ? 3 + i / 1000 : 99;
        };
        const ra = rank(a), rb = rank(b);
        if (ra !== rb) return ra - rb;
        return normalize(a.desc).localeCompare(normalize(b.desc));
      }).slice(0, 8);
      if (matches.length === 0) {
        cont.innerHTML = '<div class="search-item" style="color:var(--dgray);cursor:default"><span>Sin resultados para "' + q + '"</span></div>';
        cont.classList.add('show'); return;
      }
      cont.innerHTML = matches.map(p => {
        const precio = precioConTier(p.fob, estado.tier, p);
        const stock = estado.empresa === 'directa' ? p.stock_vd : p.stock_dist;
        const umbralCritico = estado.empresa === 'directa' ? 10 : 20;
        const stockCls = stock <= umbralCritico ? 'warn' : '';
        return `<div class="search-item" onclick="agregarProducto('${p.cod_alt}')">
      <div><div class="codigo">${highlight(p.cod_alt, qNorm)} · ${highlight(p.marca, qNorm)}</div><div class="desc">${highlight(p.desc, qNorm)}</div></div>
      <div style="text-align:right"><div class="precio">${fmtUSD(precio)}</div><div class="stock ${stockCls}">Stock: ${stock}</div></div>
    </div>`;
      }).join('');
      cont.classList.add('show');
    }

    document.addEventListener('click', e => {
      if (!e.target.closest('.search-box')) {
        document.getElementById('search-results')?.classList.remove('show');
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // ITEMS DE FACTURA
    // ═══════════════════════════════════════════════════════════════
    function agregarProducto(cod) {
      const p = PRODUCTOS.find(x => x.cod_alt === cod);
      if (!p) return;
      const ex = estado.items.find(i => i.cod_alt === cod);
      if (ex) { ex.cant += 1; }
      else {
        const dto = (estado.empresa === 'directa' && estado.dto_manual > 0) ? estado.dto_manual : 0;
        const _basePr = (p.precio_manual != null && p.precio_manual > 0) ? p.precio_manual : precioPublico(p.fob);
        const precio = dto > 0 ? Math.round(_basePr * (1 - dto / 100) * 100) / 100 : precioConTier(p.fob, estado.tier, p);
        estado.items.push({
          producto_id: p.id, cod: p.cod_alt, // v12: id para Supabase + alias corto
          cod_alt: p.cod_alt, cod_orig: p.cod_orig, desc: p.desc, marca: p.marca, fob: p.fob,
          stock_vd: p.stock_vd, stock_dist: p.stock_dist,
          precio_manual: p.precio_manual,
          factor_landed: p.factor_landed, origen: p.origen,
          cant: 1, precio: precio, subtotal: precio // v12: subtotal se recalcula en renderItems
        });
      }
      document.getElementById('busqueda-prod').value = '';
      document.getElementById('search-results').classList.remove('show');
      renderItems();
      recalcular();
    }

    function renderItems() {
      const tbody = document.getElementById('items-body');
      if (estado.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--dgray)">No has agregado productos. Usa el buscador de arriba ↑</td></tr>';
        return;
      }
      tbody.innerHTML = estado.items.map((it, i) => {
        const stock = estado.empresa === 'directa' ? it.stock_vd : it.stock_dist;
        const stockOther = estado.empresa === 'directa' ? it.stock_dist : it.stock_vd;
        const otraEmp = estado.empresa === 'directa' ? 'Distribuidora' : 'Venta Directa';
        const sinStock = it.cant > stock;
        const umbralCritico = estado.empresa === 'directa' ? 10 : 20;
        const stockCls = stock <= umbralCritico ? 'stock-warn' : 'stock-ok';
        // v13.16 Con precio 0 esto daba -Infinity y pintaba la celda en rojo sin
        // decir nada util. Ahora se marca como sin margen calculable.
        const margenNum = it.precio > 0 ? ((it.precio - costoLanded(it)) / it.precio * 100) : NaN;
        const margen = isFinite(margenNum) ? margenNum.toFixed(1) : '--';
        const priceDisabled = estado.rol !== 'gerente' ? 'disabled' : '';
        const alertaFila = sinStock ? `<tr><td colspan="8" style="padding:0"><div class="alert-stock danger" style="margin:0"><i class="ti ti-alert-triangle"></i><div><strong>Stock insuficiente para ${it.desc}.</strong> Aquí quedan ${stock}, ${otraEmp} tiene ${stockOther}. Se permitirá facturar (stock negativo registrado como préstamo).</div></div></td></tr>` : '';

        // v13.16 Aviso de margen bajo. Solo gerente: el margen se deduce del
        // costo, y el costo no se le muestra a los demas roles.
        const margenBajo = estado.rol === 'gerente' && isFinite(margenNum) && margenNum < MARGEN_MINIMO;
        const alertaMargen = margenBajo ? `<tr><td colspan="8" style="padding:0"><div style="margin:0;background:#FFF8E1;border-left:3px solid var(--gold);padding:8px 12px;font-size:11.5px;color:#854F0B;display:flex;gap:8px;align-items:flex-start">
        <i class="ti ti-trending-down" style="font-size:15px;margin-top:1px"></i>
        <div><strong>Margen de ${margen}% en ${it.desc}</strong> — por debajo del mínimo de ${MARGEN_MINIMO}%. Costo ${fmtUSD(costoLanded(it))} · precio ${fmtUSD(it.precio)}. Para llegar al ${MARGEN_MINIMO}% el precio sería ${fmtUSD(costoLanded(it) / (1 - MARGEN_MINIMO / 100))}.</div></div></td></tr>` : '';
        // v13.17 Aviso de producto sin FOB. Se le muestra a TODOS los roles:
        // no revela el costo (justamente porque no hay), y quien esta armando
        // la factura necesita saber que no va a poder emitirla.
        const faltaFob = sinFob(it);
        const alertaFob = faltaFob ? `<tr><td colspan="8" style="padding:0"><div style="margin:0;background:#FDECEA;border-left:3px solid var(--red);padding:8px 12px;font-size:11.5px;color:#8B1A10;display:flex;gap:8px;align-items:flex-start">
        <i class="ti ti-alert-octagon" style="font-size:15px;margin-top:1px"></i>
        <div><strong>${it.cod_alt} no tiene costo cargado (FOB en 0).</strong> ${it.precio > 0 ? 'El margen que se muestra es falso.' : 'Se factur\u00eda en $0,00.'} No se podr\u00e1 emitir hasta corregir el FOB en Inventario.</div></div></td></tr>` : '';
        return `<tr>
      <td><strong>${it.cod_alt}</strong><div style="font-size:10px;color:var(--dgray)">Orig: ${it.cod_orig}</div></td>
      <td>${it.desc}<div style="font-size:11px;color:var(--dgray)">${it.marca}</div></td>
      <td class="num ${sinStock ? 'stock-neg' : stockCls}">${stock}${sinStock ? ' ⚠' : ''}</td>
      <td class="num"><input type="number" class="qty-cell" value="${it.cant}" min="1" onchange="cambiarCant(${i},this.value)"></td>
      <td class="num">${it._modoVerde
        ? `<input type="number" class="price-edit-cell" value="${bcvAVerde(it.precio).toFixed(2)}" step="0.01" ${priceDisabled} onchange="cambiarPrecioVerde(${i},this.value)" style="background:#E8F5E9;border-color:var(--green)">`
        : `<input type="number" class="price-edit-cell" value="${it.precio.toFixed(2)}" step="0.01" ${priceDisabled} onchange="cambiarPrecio(${i},this.value)">`}
        ${estado.rol === 'gerente' ? `<button onclick="toggleModoVerde(${i})" title="${it._modoVerde ? 'Volver a $BCV' : 'Escribir el precio en $ efectivo (verde)'}" style="border:none;background:${it._modoVerde ? 'var(--green)' : 'var(--gray)'};color:${it._modoVerde ? '#FFF' : 'var(--dgray)'};border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;margin-left:3px;font-weight:700">\u21c4</button>` : ''}
        ${it._modoVerde ? `<div style="font-size:9px;color:var(--green);font-weight:600">verde · ${fmtUSD(it.precio)} BCV</div>` : ''}</td>
      <td class="num col-restricted" style="color:${!isFinite(margenNum) ? 'var(--dgray)' : margenNum < 25 ? 'var(--red)' : margenNum < 35 ? 'var(--gold)' : 'var(--green)'};font-weight:600">${margen}${isFinite(margenNum) ? '%' : ''}</td>
      <td class="num"><strong>${fmtUSD(it.cant * it.precio)}</strong></td>
      <td><button class="del-btn" onclick="quitarItem(${i})" title="Quitar"><i class="ti ti-x"></i></button></td>
    </tr>${alertaFob}${alertaFila}${alertaMargen}`;
      }).join('');
    }

    function cambiarCant(i, v) { estado.items[i].cant = parseInt(v) || 1; renderItems(); recalcular(); }
    function cambiarPrecio(i, v) {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede modificar precios', 'error'); renderItems(); return; }
      const precioAnt = estado.items[i].precio;
      estado.items[i].precio = parseFloat(v) || 0;
      logBitacora('precio', `Modificó precio de '${estado.items[i].desc}' de ${fmtUSD(precioAnt)} a ${fmtUSD(estado.items[i].precio)}`, true);
      renderItems(); recalcular();
    }
    function quitarItem(i) { estado.items.splice(i, 1); renderItems(); recalcular(); }

    // ═══════════════════════════════════════════════════════════════
    // PAGOS — DESCUENTAN DEL TOTAL
    // ═══════════════════════════════════════════════════════════════
    const METODOS_PAGO = ['Pago móvil Bs.', 'Transferencia Bs.', 'Zelle USD', 'Efectivo USD', 'Efectivo Bs.', 'Punto de venta'];

    function agregarPago() {
      estado.pagos.push({ metodo: METODOS_PAGO[0], monto: 0, moneda: 'Bs' });
      renderPagos();
    }

    function renderPagos() {
      const cont = document.getElementById('pagos-list');
      cont.innerHTML = estado.pagos.map((p, i) => {
        // La moneda de cada línea se muestra explícita: antes había que deducirla
        // del nombre del método y era fácil equivocarse de campo.
        const mon = p.moneda === 'USD' ? '$' : 'Bs';
        return `<div class="pago-row">
      <select onchange="cambiarMetodoPago(${i},this.value)">
        ${METODOS_PAGO.map(m => `<option ${m === p.metodo ? 'selected' : ''}>${m}</option>`).join('')}
      </select>
      <span class="pago-moneda">${mon}</span>
      <input type="text" inputmode="decimal" placeholder="0,00" value="${p.monto || ''}" onchange="cambiarMontoPago(${i},this.value)">
      <button class="btn btn-secondary btn-sm" style="padding:5px 9px;font-size:10.5px;white-space:nowrap" onclick="completarPago(${i})" title="Llenar con el monto exacto que falta">Completar</button>
      <button class="del-pago" onclick="quitarPago(${i})" title="Quitar"><i class="ti ti-x"></i></button>
    </div>`;
      }).join('');
      recalcular();
    }

    function cambiarMetodoPago(i, v) {
      estado.pagos[i].metodo = v;
      estado.pagos[i].moneda = v.includes('USD') ? 'USD' : 'Bs';
      renderPagos(); // repinta para que el indicador Bs/$ quede al día
    }

    function cambiarMontoPago(i, v) { estado.pagos[i].monto = parseMontoVE(v); recalcular(); }
    function completarPago(i) {
      const total = estado.items.reduce((a, it) => a + it.cant * it.precio, 0);
      if (total <= 0) return;
      const factorBcv = colchonFactor();
      const totalBs = total * factorBcv * estado.tasa_bcv; // mismo número que "Cobrar en Bs"
      // v13.23 Mismo criterio que la validacion: si hay cobro redondo fijado,
      // "Completar" tiene que llenar ESE numero, no el teorico.
      const _ajC = ajusteVerde(totalEnDivisas(total));
      const totalUsd = _ajC ? _ajC.objetivo : totalEnDivisas(total); // v13.12: el que salda en verde
      // Fracción de la factura ya cubierta por los OTROS pagos, cada uno según su precio anunciado
      let fraccion = 0;
      estado.pagos.forEach((p, j) => {
        if (j === i) return;
        fraccion += p.moneda === 'USD'
          ? (totalUsd > 0 ? p.monto / totalUsd : 0)
          : (totalBs > 0 ? p.monto / totalBs : 0);
      });
      const faltaFrac = Math.max(0, 1 - fraccion);
      estado.pagos[i].monto = estado.pagos[i].moneda === 'USD'
        ? Math.round(faltaFrac * totalUsd * 100) / 100
        : Math.round(faltaFrac * totalBs * 100) / 100;
      renderPagos();
    }
    function quitarPago(i) { estado.pagos.splice(i, 1); renderPagos(); }

    // ═══════════════════════════════════════════════════════════════
    // v13.22 COBRAR EN EFECTIVO REDONDO
    // El cliente paga con billetes y los billetes no tienen centavos. Este
    // ajuste NO toca ningun precio: guarda aparte cuanto se va a cobrar en
    // verde y la diferencia se registra como descuento (o recargo).
    // Asi convive con el boton ⇄ del renglon: ese cambia precios, este no.
    // ═══════════════════════════════════════════════════════════════
    function aplicarCobrarVerde(v) {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede ajustar el cobro', 'error'); return; }
      const n = parseFloat(v);
      estado.cobrar_verde = (isFinite(n) && n > 0) ? Math.round(n * 100) / 100 : null;
      recalcular();
    }
    function limpiarCobrarVerde() {
      estado.cobrar_verde = null;
      const el = document.getElementById('t-cobrar-verde'); if (el) el.value = '';
      recalcular();
    }
    function redondearVerde() {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede ajustar el cobro', 'error'); return; }
      const subtotal = estado.items.reduce((a, i) => a + i.cant * i.precio, 0);
      if (subtotal <= 0) { notif('Agrega productos primero', 'error'); return; }
      const objetivo = Math.round(totalEnDivisas(subtotal));
      estado.cobrar_verde = objetivo > 0 ? objetivo : null;
      const el = document.getElementById('t-cobrar-verde'); if (el) el.value = objetivo > 0 ? objetivo : '';
      recalcular();
    }

    // Devuelve el ajuste vigente o null. Un solo sitio de verdad.
    function ajusteVerde(totalUsdBase) {
      const cv = parseFloat(estado.cobrar_verde);
      if (!isFinite(cv) || cv <= 0 || totalUsdBase <= 0) return null;
      const dif = Math.round((cv - totalUsdBase) * 100) / 100;
      return { objetivo: cv, base: totalUsdBase, dif, arriba: dif > 0.004 };
    }

    // ═══════════════════════════════════════════════════════════════
    // RECALCULAR (IVA SIEMPRE = 0, pagos descuentan del total)
    // ═══════════════════════════════════════════════════════════════
    function recalcular() {
      const subtotal = estado.items.reduce((a, i) => a + i.cant * i.precio, 0);
      const iva = 0; // SIEMPRE 0
      const total = subtotal + iva;
      // v13.12: los precios de ARJ ya estan en $ BCV (el 25% de compra de divisas
      // vive dentro del costo, y el precio sale de multiplicar ese costo). El
      // factor ya NO convierte de paralelo a BCV — solo aplica el resguardo por
      // el riesgo cambiario de cobrar en bolivares.
      const factorBcv = colchonFactor();
      const totalBcv = total * factorBcv;
      const totalBs = totalBcv * estado.tasa_bcv; // Bs = precio BCV × tasa BCV (incluye colchón)

      // v13.12: el efectivo en divisas que salda esta factura.
      const totalUsdBase = totalEnDivisas(total);
      // v13.22: si el gerente fijo un monto redondo en efectivo, ese manda.
      const _aj = ajusteVerde(totalUsdBase);
      const totalUsd = _aj ? _aj.objetivo : totalUsdBase;

      const _avVerde = document.getElementById('t-verde-aviso');
      if (_avVerde) {
        if (_aj && Math.abs(_aj.dif) >= 0.005) {
          const arriba = _aj.arriba;
          _avVerde.style.display = '';
          _avVerde.style.background = arriba ? 'rgba(220,60,40,.40)' : 'rgba(255,255,255,.15)';
          _avVerde.style.color = arriba ? '#FFD9D9' : '#FFF';
          _avVerde.innerHTML = arriba
            ? `<strong>\u26a0 Est\u00e1s cobrando ${fmtUSD(_aj.dif)} de M\u00c1S.</strong> El total en efectivo es ${fmtUSD(_aj.base)} y fijaste ${fmtUSD(_aj.objetivo)}. Aseg\u00farate de que el cliente lo sepa.`
            : `Ajuste de ${fmtUSD(Math.abs(_aj.dif))} para que pague ${fmtUSD(_aj.objetivo)} en billetes. Sale de tu utilidad.`;
        } else {
          _avVerde.style.display = 'none';
        }
      }

      document.getElementById('t-subtotal').textContent = fmtUSD(subtotal);
      document.getElementById('t-total').textContent = fmtUSD(totalUsd);
      document.getElementById('t-total-bcv').textContent = fmtUSD(totalBcv);
      document.getElementById('t-bs').textContent = fmtBS(totalBs);
      const badge = document.getElementById('t-factor-badge');
      if (badge) badge.textContent = '×' + factorBcv.toFixed(2);
      const badgeUsd = document.getElementById('t-usd-badge');
      if (badgeUsd) {
        const ex = dtoDivisaExcedentePct();
        badgeUsd.textContent = '−' + dtoDivisaPct().toFixed(1) + '%';
        badgeUsd.style.background = ex > 0 ? 'var(--red)' : 'var(--blue)';
        badgeUsd.title = ex > 0
          ? 'Conversión ' + dtoDivisaNeutro().toFixed(1) + '% + ' + ex.toFixed(1) + ' puntos de descuento real'
          : 'Solo conversión a la brecha del día. No regalas margen.';
      }
      const avisoUsd = document.getElementById('t-usd-aviso');
      if (avisoUsd) {
        const ex = dtoDivisaExcedentePct();
        if (ex > 0) {
          const regalado = Math.round(total * (ex / 100) * 100) / 100;
          avisoUsd.style.display = '';
          avisoUsd.textContent = 'Regalas ' + ex.toFixed(1) + ' pts sobre la brecha = ' + fmtUSD(regalado) + '. Se registra como descuento.';
        } else {
          avisoUsd.style.display = 'none';
        }
      }

      // Pagos en USD equivalente (paralelo)
      // USD cuenta 1:1. Bs se divide entre tasa PARALELO (valor real del bolívar).
      // Cada pago cubre una fracción de la factura según su precio anunciado:
      // USD contra el total en USD; Bs contra el precio en Bs (con colchón BCV)
      let fraccionPagada = 0;
      estado.pagos.forEach(p => {
        if (total <= 0) return;
        // v13.12: el pago en USD se mide contra el total EN DIVISAS, no contra
        // el total en $BCV. Antes un cliente que pagaba lo que decia la pantalla
        // quedaba corto y el sistema le pedia mas.
        fraccionPagada += p.moneda === 'USD'
          ? (totalUsd > 0 ? p.monto / totalUsd : 0)
          : (totalBs > 0 ? p.monto / totalBs : 0);
      });
      const falta = total > 0 ? total * (1 - fraccionPagada) : 0;
      const row = document.getElementById('saldo-pago-row');
      const lbl = row.querySelector('span');
      const val = document.getElementById('saldo-pago');
      // Solo alertar si FALTA dinero. Exceso (vuelto) o diferencias menores a $1 son normales
      // por redondeo de bolívares y el colchón BCV.
      if (falta > 0.1) {
        lbl.textContent = 'Falta por pagar:';
        val.textContent = fmtUSD(falta);
        row.className = 'saldo-row parcial';
      } else {
        lbl.textContent = '✓ Pago completo:';
        val.textContent = fmtUSD(0);
        row.className = 'saldo-row cubierto';
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // EMITIR FACTURA
    // ═══════════════════════════════════════════════════════════════
    function emitirFactura() {
      if (estado.items.length === 0) { notif('Agrega al menos un producto', 'error'); return; }
      if (!estado.cliente) { notif('Selecciona un cliente', 'error'); return; }
      // v13.17 BLOQUEO: producto sin FOB no se factura. Decision de JJ: el FOB
      // en 0 significa que se cargo mal o que no habia costo al hacer el pedido.
      // Se corrige a mano en Inventario, no se adivina aqui.
      if (!tasasListas('emitir la factura')) return;
      const sinCosto = estado.items.filter(sinFob);
      if (sinCosto.length > 0) {
        const lista = sinCosto.map(it => '\u2022 ' + it.cod_alt + ' \u2014 ' + (it.desc || 'sin descripcion')).join('\n');
        alert('No se puede emitir: ' + sinCosto.length + (sinCosto.length === 1 ? ' producto no tiene' : ' productos no tienen') + ' costo cargado (FOB en 0).\n\n' + lista + '\n\nSin FOB el margen es falso y el precio p\u00fablico sale en cero. Corrige el FOB en Inventario y vuelve a intentar.\n\nSi no lo necesitas en esta factura, qu\u00edtalo del carrito.');
        notif('Emisi\u00f3n bloqueada: ' + sinCosto.length + ' producto(s) sin FOB', 'error');
        return;
      }
      const total = estado.items.reduce((a, i) => a + i.cant * i.precio, 0);
      const tipoPago = document.getElementById('tipo-pago-factura')?.value || 'contado';
      const diasCredito = tipoPago === 'credito' ? (parseInt(document.getElementById('dias-credito')?.value) || 30) : null;
      // v13.24 Antes esto convertia los bolivares dividiendo entre la PARALELA
      // y comparaba el resultado contra un total en $BCV. Con el modelo nuevo
      // (se cobra en Bs a la tasa BCV) daba "Falta pagar" sobre facturas ya
      // saldadas. Ahora usa el MISMO modelo de fracciones que la validacion
      // real del guardado: cada pago se mide contra su propio precio anunciado.
      const tp = estado.pagos.reduce((a, p) => a + (p.moneda === 'USD' ? p.monto : p.monto / estado.tasa_par), 0);
      const tasaCongelada = { paralelo: estado.tasa_par, bcv: estado.tasa_bcv, fecha: new Date().toLocaleString('es-VE') };
      const pidioFiscal = document.getElementById('emitir-fiscal')?.checked || false;
      const negativos = estado.items.filter(it => {
        const s = estado.empresa === 'directa' ? it.stock_vd : it.stock_dist;
        return it.cant > s;
      });
      const factorBcv = colchonFactor();
      const totalBcv = total * factorBcv;
      // v13.23 El modal es lo ultimo que ve el gerente antes de emitir: tiene
      // que mostrar el MISMO numero que el panel de totales.
      const _ajM = ajusteVerde(totalEnDivisas(total));
      let resumen = `
    <div class="modal-summary-row"><span>Empresa:</span><strong><span style="background:${estado.empresa === 'directa' ? 'var(--lblue)' : 'var(--lgreen)'};color:${estado.empresa === 'directa' ? 'var(--blue)' : 'var(--green)'};padding:1px 7px;border-radius:8px;font-size:10px;font-weight:600">${nombreEmpresa(estado.empresa).toUpperCase()}</span></strong></div>
    <div class="modal-summary-row"><span>Cliente:</span><strong>${estado.cliente.nombre}</strong></div>
    <div class="modal-summary-row"><span>Ítems:</span><strong>${estado.items.length} productos</strong></div>
    <div class="modal-summary-row"><span>Total USD (si paga dólares):</span><strong>${fmtUSD(_ajM ? _ajM.objetivo : totalEnDivisas(total))}</strong></div>
    ${_ajM && Math.abs(_ajM.dif) >= 0.005 ? `<div class="modal-summary-row" style="background:${_ajM.arriba ? '#FDECEA' : '#E8F5E9'};margin:4px -8px;padding:6px 12px;border-radius:4px;font-size:11.5px">
      <span style="color:${_ajM.arriba ? '#8B1A10' : '#1B5E20'}">${_ajM.arriba ? '\u26a0 Cobro redondo — DE M\u00c1S' : 'Cobro redondo en efectivo'}:</span>
      <strong style="color:${_ajM.arriba ? '#8B1A10' : '#1B5E20'}">${fmtUSD(_ajM.base)} \u2192 ${fmtUSD(_ajM.objetivo)} (${_ajM.dif > 0 ? '+' : ''}${fmtUSD(_ajM.dif)})</strong></div>` : ''}
    <div class="modal-summary-row" style="background:#FDF6E3;margin:4px -8px;padding:6px 12px;border-radius:4px"><span style="color:#5D4037">Total USD (si paga Bs)${estado.rol === 'gerente' ? ' <span style="font-size:9px;background:var(--gold);color:#FFF;padding:1px 5px;border-radius:6px">×' + factorBcv.toFixed(2) + '</span>' : ''}:</span><strong style="color:#5D4037">${fmtUSD(totalBcv)}</strong></div>
    <div class="modal-summary-row"><span>Cobrar en Bs:</span><strong style="color:var(--navy)">${fmtBS(totalBcv * estado.tasa_bcv)}</strong></div>
    <div class="modal-summary-row"><span>Tipo de pago:</span><strong>${tipoPago === 'contado' ? 'CONTADO' : 'CRÉDITO ' + diasCredito + ' días'}</strong></div>`;
      if (tipoPago === 'contado') {
        // Fraccion de la factura cubierta, cada pago contra su propia moneda.
        const _totUsdPago = _ajM ? _ajM.objetivo : totalEnDivisas(total);
        const _totBsPago = totalBcv * estado.tasa_bcv;
        let _frac = 0;
        estado.pagos.forEach(p => {
          const m = parseFloat(p.monto) || 0;
          _frac += p.moneda === 'USD'
            ? (_totUsdPago > 0 ? m / _totUsdPago : 0)
            : (_totBsPago > 0 ? m / _totBsPago : 0);
        });
        const _faltaFrac = Math.max(0, 1 - _frac);
        resumen += `<div class="modal-summary-row"><span>Pagado:</span><strong>${(_frac * 100).toFixed(1)}% de la factura</strong></div>`;
        if (_faltaFrac > 0.0005) {
          resumen += `<div class="modal-summary-row"><span>⚠ Falta pagar:</span><strong style="color:var(--red)">${fmtUSD(_faltaFrac * _totUsdPago)} en efectivo · ${fmtBS(_faltaFrac * _totBsPago)}</strong></div>`;
        } else {
          resumen += `<div class="modal-summary-row"><span>Estado:</span><strong style="color:var(--green)">✓ Saldada</strong></div>`;
        }
      }
      resumen += `<div class="modal-summary-row"><span>IVA:</span><strong style="color:var(--gold)">$ 0.00 (exento)</strong></div>`;
      // v13.21 Se muestran las DOS tasas. Antes solo salia la paralela, que con
      // el modelo nuevo es la equivocada: lo que se le cobra al cliente en
      // bolivares sale de la BCV. La paralela queda como referencia comercial
      // interna (sirve para leer la brecha del dia), pero se rotula distinto
      // para que nunca se confundan. NINGUNA de las dos va en el PDF del cliente.
      resumen += `<div style="background:#FFF8E1;margin:6px -8px;padding:8px 12px;border-radius:4px">
      <div style="font-size:9.5px;color:#8D6E63;font-weight:600;letter-spacing:.4px;margin-bottom:4px"><i class="ti ti-snowflake" style="color:var(--blue)"></i> TASAS CONGELADAS EN ESTA FACTURA · USO INTERNO</div>
      <div class="modal-summary-row" style="padding:2px 0"><span>BCV <span style="font-size:9px;color:#8D6E63">— con esta se cobra</span>:</span><strong style="color:var(--blue)">${fmtBS(tasaCongelada.bcv)}/USD</strong></div>
      <div class="modal-summary-row" style="padding:2px 0"><span>Paralelo <span style="font-size:9px;color:#8D6E63">— referencia</span>:</span><strong style="color:#8D6E63">${fmtBS(tasaCongelada.paralelo)}/USD</strong></div>
      ${tasaOk(tasaCongelada.bcv) && tasaOk(tasaCongelada.paralelo) ? `<div class="modal-summary-row" style="padding:2px 0;border-top:1px dashed #D7CCC8;margin-top:3px"><span>Brecha del día:</span><strong style="color:#8D6E63">${((tasaCongelada.paralelo / tasaCongelada.bcv - 1) * 100).toFixed(2)}%</strong></div>` : ''}
    </div>`;
      if (negativos.length > 0) {
        resumen += `<div class="modal-summary-row"><span>⚠ Préstamo inter-empresarial:</span><strong style="color:var(--gold)">${negativos.length} producto(s)</strong></div>`;
      }
      resumen += `<div class="modal-summary-row"><span>Stock:</span><strong style="color:var(--green)">✓ ${estado.items.length} ítems se descontarán</strong></div>`;
      if (pidioFiscal) {
        resumen += `<div style="background:#E3F2FD;border:2px solid #2196F3;border-radius:6px;padding:10px 12px;margin-top:10px;color:#0D47A1;font-size:12.5px">
      <strong><i class="ti ti-alert-circle"></i> RECORDATORIO</strong><br>
      El cliente pidió factura fiscal. Registrar en el sistema fiscal homologado.
    </div>`;
      }
      document.getElementById('modal-summary').innerHTML = resumen;
      document.getElementById('modal-factura').classList.add('show');
    }

    function cerrarPrintCotizacion() {
      document.getElementById('modal-print-cotizacion').classList.remove('show');
    }

    // ═══ IMPRIMIR (v13.1) ═══
    // Chrome usa el <title> del documento como nombre sugerido al "Guardar como PDF".
    // Se pone el número del documento antes de imprimir y se restaura después,
    // para que el archivo salga como VD-2026-00003.pdf sin renombrarlo a mano.
    function imprimirDocumento() {
      const tituloPrevio = document.title;
      const num = (document.getElementById('dc-numero') || {}).textContent || '';
      const lbl = (document.querySelector('#modal-print-cotizacion .dc-num-label') || {}).textContent || 'DOCUMENTO';
      const limpio = num.replace(/^N°\s*/i, '').trim();
      if (limpio) document.title = lbl.trim() + ' ' + limpio;
      window.print();
      // El restore corre después de que el navegador cierra el diálogo de impresión.
      setTimeout(function () { document.title = tituloPrevio; }, 800);
    }

    function generarVistaImpresion() {
      if (!estado.cliente) { notif('Selecciona un cliente', 'error'); return; }
      if (estado.items.length === 0) { notif('Agrega productos primero', 'error'); return; }
      const ahora = new Date();
      const prefijo = estado.empresa === 'directa' ? 'VD' : 'DT';
      const numero = prefijo + '-2026-' + String(Math.floor(Math.random() * 900) + 100).padStart(5, '0');
      const fechaTxt = ahora.toLocaleDateString('es-VE');
      const venc = new Date(ahora.getTime() + 45 * 86400000);
      const vencTxt = venc.toLocaleDateString('es-VE');
      document.getElementById('dc-numero').textContent = numero;
      document.getElementById('dc-fecha').textContent = fechaTxt;
      document.getElementById('dc-fecha2').textContent = fechaTxt;
      document.getElementById('dc-vence').textContent = vencTxt;
      document.getElementById('dc-cli-nombre').textContent = estado.cliente.nombre;
      document.getElementById('dc-cli-rif').textContent = 'RIF: ' + estado.cliente.rif;
      document.getElementById('dc-cli-tel').textContent = 'Teléfono: ' + (estado.cliente.tel || '—');
      document.getElementById('dc-cli-dir').textContent = 'Dirección: —';
      document.getElementById('dc-vendedor').textContent = estado.usuario || '—';
      document.getElementById('dc-empresa-op').textContent = nombreEmpresa(estado.empresa);
      const tbody = document.getElementById('dc-items');
      tbody.innerHTML = estado.items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${it.cod_alt}</strong></td>
      <td>${it.desc}</td>
      <td class="num">${it.cant}</td>
      <td class="num">${fmtUSD(it.precio)}</td>
      <td class="num"><strong>${fmtUSD(it.cant * it.precio)}</strong></td>
    </tr>`).join('');
      const total = estado.items.reduce((a, i) => a + i.cant * i.precio, 0);
      const _factorPrint = colchonFactor();
      const _totalBsPrint = total * _factorPrint * estado.tasa_bcv;
      document.getElementById('dc-subtotal').textContent = fmtUSD(total);
      document.getElementById('dc-total').textContent = fmtUSD(total);
      document.getElementById('dc-equiv').innerHTML = '<strong>Cobrar en Bs.:</strong> ' + fmtBS(_totalBsPrint);
      // Título del documento: COTIZACIÓN (las ventas se imprimen como cotización)
      const lbl=document.querySelector('.dc-num-label');if(lbl)lbl.textContent='COTIZACIÓN';
  const vl3=document.getElementById('dc-vence-label');if(vl3)vl3.textContent='Válida hasta:';
  const h2c=document.querySelector('#modal-print-cotizacion h2');if(h2c)h2c.innerHTML='<i class="ti ti-printer"></i> Vista previa de cotización';
      document.getElementById('modal-print-cotizacion').classList.add('show');
    }

   function cerrarModal() {
      document.getElementById('modal-factura').classList.remove('show');
    }

    // v12: Confirmar y emitir factura real
    async function confirmarYEmitir() {
      // Deshabilitar botón para evitar doble click
      const btn = document.getElementById('btn-confirmar-factura');
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> Emitiendo...'; }
      document.getElementById('modal-factura').classList.remove('show');

      if (_supabaseConectado) {
        await emitirFacturaReal();
      } else {
        // Modo offline: solo cosmético como antes
        notif('⚠ Sin conexión a Supabase. La factura no se guardó.', 'error');
      }
      // Rehabilitar botón
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> Confirmar y Emitir'; }
    }

    function limpiarFactura() {
      estado.items = []; estado.pagos = []; estado.cliente = null; estado.tier = 'Publico';
      estado.cobrar_verde = null;
      if (typeof _cotOrigen !== 'undefined') _cotOrigen = null; // abandonó el carrito → el presupuesto sigue activo
      estado.dto_manual = 0; estado.dto_motivo = ''; estado.cobrar_verde = null;
      estado.dto_divisa = null; // v13.12: vuelve a la brecha del dia en la proxima factura
      document.getElementById('cliente-select').value = '';
      document.getElementById('info-cliente').textContent = 'Selecciona un cliente para empezar';
      const fc = document.getElementById('emitir-fiscal'); if (fc) fc.checked = false;
      const tp = document.getElementById('tipo-pago-factura'); if (tp) tp.value = 'contado'; // v12
      const dc = document.getElementById('dias-credito'); if (dc) dc.style.display = 'none'; // v12
      const dtoInfo = document.getElementById('dto-manual-info'); if (dtoInfo) dtoInfo.textContent = '';
      actualizarTierUI();
      renderItems();
      agregarPago();
      recalcular();
    }

    // ═══════════════════════════════════════════════════════════════
    // INVENTARIO
    // ═══════════════════════════════════════════════════════════════

    // ═══ EMITIR FACTURA REAL (v12) ═══
    // Esta función reemplaza la cosmética del v10/v11. Ahora:
    // 1. Obtiene número correlativo real
    // 2. Crea la factura en Supabase
    // 3. Crea los ítems de la factura
    // 4. Descuenta stock
    // 5. Registra pagos
    // 6. Actualiza saldo del cliente si es crédito
    // 7. Loguea en bitácora
    async function emitirFacturaReal() {
      // v13.2: si no hay conexion, no se arranca. Antes se recorria media
      // funcion y se moria al pedir el numero a `contadores`, dejando al papa
      // con el cliente enfrente sin saber que paso.
      if (!_sb || !_supabaseConectado) {
        notif('Sin conexion a la base de datos. No se puede emitir la factura.', 'error');
        return;
      }
      // Validaciones
      if (estado.items.length === 0) { notif('Agrega productos antes de facturar', 'error'); return; }

      // v13.3 RED DE SEGURIDAD: ningun renglon puede salir sin descripcion.
      // La validacion principal esta en guardarEditProducto(), pero un producto
      // cargado por CSV o por SQL directo no pasa por ahi. Una factura emitida
      // no se corrige: mejor detenerla aqui.
      const _sinDesc = estado.items.filter(it => !it.desc || !String(it.desc).trim());
      if (_sinDesc.length > 0) {
        notif('Hay ' + _sinDesc.length + ' renglón(es) sin descripción (' + _sinDesc.map(i => i.cod).join(', ') + '). Corrige el producto en Inventario antes de facturar.', 'error');
        return;
      }

      const clienteSel = estado.cliente;
      if (!clienteSel) { notif('Selecciona un cliente', 'error'); return; }

      // Determinar tipo de pago
      const tipoPagoSel = document.getElementById('tipo-pago-factura');
      const tipoPago = tipoPagoSel ? tipoPagoSel.value : 'contado';
      const diasCredito = tipoPago === 'credito' ? (parseInt(document.getElementById('dias-credito')?.value) || 30) : null;
      const pidioFiscal = document.getElementById('emitir-fiscal')?.checked || false;

      // Calcular totales
      let subtotal = 0;
      estado.items.forEach(it => { it.subtotal = it.cant * it.precio; subtotal += it.subtotal; });

      // Descuento manual (v13.9). Antes se leían los IDs 'desc-manual-pct' y
      // 'desc-manual-motivo', que NO EXISTEN en el HTML: descuento_manual se
      // guardaba en 0 en todas las facturas. La verdad vive en estado.dto_manual.
      // Los renglones YA salen rebajados de actualizarPreciosPorTier(); volver a
      // multiplicar el subtotal aquí sería descontar DOS VECES. Solo se registra.
      const descManual = (estado.empresa === 'directa' && estado.dto_manual > 0) ? estado.dto_manual : 0;
      const motivoDesc = descManual > 0 ? (estado.dto_motivo || '') : '';
      if (descManual > 0 && estado.rol !== 'gerente') {
        notif('Solo el gerente puede aplicar descuentos manuales', 'error'); return;
      }

      // v13.12 BUG CORREGIDO. Antes hacia `m / estado.tasa_par` para los pagos en
      // Bs: el sistema COBRABA a tasa BCV y ACREDITABA a tasa paralelo. Un cliente
      // que pagaba EXACTO lo que decia la pantalla quedaba corto y la emision se
      // bloqueaba ("Los pagos no cubren el total"). En una factura de $500 el hueco
      // era de $69. Ahora se usa el mismo modelo de fracciones de recalcular():
      // cada pago se mide contra el precio anunciado EN SU MONEDA.
      const _factorBs = colchonFactor();
      const _totalBs = subtotal * _factorBs * estado.tasa_bcv;
      // v13.23 El ajuste por cobro redondo tiene que mandar tambien aqui.
      // Si el panel dice \$20 y la validacion mide contra \$20,83, el gerente
      // paga lo que ve y el sistema le dice que falta. Un solo numero.
      const _ajUsd = ajusteVerde(totalEnDivisas(subtotal));
      const _totalUsd = _ajUsd ? _ajUsd.objetivo : totalEnDivisas(subtotal);
      let _fraccion = 0;
      estado.pagos.forEach(p => {
        const m = parseFloat(p.monto) || 0;
        if (subtotal <= 0) return;
        _fraccion += p.moneda === 'USD'
          ? (_totalUsd > 0 ? m / _totalUsd : 0)
          : (_totalBs > 0 ? m / _totalBs : 0);
      });
      if (tipoPago === 'contado') {
        const _faltaUSD = subtotal * (1 - _fraccion);
        if (_faltaUSD > 1) {
          notif('Los pagos no cubren el total. Faltan $' + _faltaUSD.toFixed(2), 'error'); return;
        }
      }
      // v13.29 ABONO INICIAL EN CREDITO. Antes los pagos de una factura a
      // credito se descartaban: la condicion de guardado era `=== 'contado'`.
      // El cliente entregaba plata, quedaba debiendo el total completo y el
      // pago no existia en ninguna tabla.
      // El monto se mide con _fraccion (cada pago contra el total anunciado EN
      // SU MONEDA) y da $BCV, que es la unidad de saldo_pendiente. Restar
      // pagos.monto_usd seria mezclar $verde con $BCV.
      const _abonoIni = (tipoPago === 'credito')
        ? Math.min(subtotal, Math.round(subtotal * _fraccion * 100) / 100) : 0;
      const _saldoIni = (tipoPago === 'contado') ? 0
        : Math.max(0, Math.round((subtotal - _abonoIni) * 100) / 100);

      // v13.12 TRAZABILIDAD DEL DESCUENTO POR DIVISAS.
      // Solo lo que se dio POR ENCIMA de la brecha es descuento de verdad: la
      // conversion a la brecha no regala nada. Se calcula sobre la parte de la
      // factura efectivamente pagada en divisas, no sobre el total.
      let _dtoDivPct = 0, _dtoDivMonto = 0, _pagoEnDivisas = false;
      // v13.22 Ajuste por cobro redondo en efectivo. Negativo = se cobro de
      // menos (descuento real). Positivo = se cobro de mas.
      const _ajV = ajusteVerde(totalEnDivisas(subtotal));
      const _ajVerdeDif = _ajV ? _ajV.dif : 0;
      estado.pagos.forEach(p => { if (p.moneda === 'USD' && (parseFloat(p.monto) || 0) > 0) _pagoEnDivisas = true; });
      const _exDiv = dtoDivisaExcedentePct();
      if (_exDiv > 0 && _totalUsd > 0) {
        let _fracUsd = 0;
        estado.pagos.forEach(p => {
          if (p.moneda === 'USD') _fracUsd += (parseFloat(p.monto) || 0) / _totalUsd;
        });
        _fracUsd = Math.min(1, Math.max(0, _fracUsd));
        _dtoDivPct = _exDiv;
        _dtoDivMonto = Math.round(subtotal * (_exDiv / 100) * _fracUsd * 100) / 100;
      }

      // Mostrar loading
      notif('Emitiendo factura...', 'warning');

      try {
        // 1. Obtener número correlativo
        const tipoContador = estado.empresa === 'directa' ? 'factura_vd' : 'factura_dist';
        const prefijo = estado.empresa === 'directa' ? 'VD' : 'DT';
        const anio = new Date().getFullYear();

        // Incrementar contador manualmente
        const { data: contData, error: contErr } = await _sb.from('contadores').select('*').eq('tipo', tipoContador).eq('anio', anio).single();
        if (contErr || !contData) { notif('Error obteniendo número de factura', 'error'); return; }
        const nuevoNum = contData.ultimo_numero + 1;
        // v13.33 SEGURIDAD: si no se puede reservar el correlativo, NO se emite.
        // Emitir sin avanzar el contador haria que la proxima factura repita numero.
        const { error: contUpdErr } = await _sb.from('contadores')
          .update({ ultimo_numero: nuevoNum }).eq('id', contData.id);
        if (contUpdErr) {
          console.error('[ARJ] Error reservando correlativo:', contUpdErr);
          notif('No se pudo reservar el numero de factura. NO se emitio nada. Reintenta.', 'error');
          return;
        }
        const numFactura = prefijo + '-' + anio + '-' + String(nuevoNum).padStart(5, '0');

        // Fecha vencimiento
        const ahora = new Date();
        let fechaVence = null;
        if (tipoPago === 'credito' && diasCredito) {
          fechaVence = new Date(ahora.getTime() + diasCredito * 24 * 60 * 60 * 1000).toISOString();
        }

        // 2. Crear factura en Supabase
        const facturaObj = {
          numero: numFactura,
          empresa: estado.empresa,
          cliente_id: clienteSel.id,
          cliente_nombre: clienteSel.nombre,
          // SNAPSHOT fiscal: datos del cliente TAL COMO ESTABAN al emitir.
          // Si mañana se edita el cliente, este documento no cambia.
          cliente_nombre_snap: clienteSel.nombre || '',
          cliente_rif_snap: clienteSel.rif || '',
          cliente_tel_snap: clienteSel.tel || '',
          cliente_dir_snap: clienteSel.direccion || '',
          vendedor: estado.usuario || 'Sistema',
          subtotal_usd: subtotal,
          tasa_par: estado.tasa_par,
          tasa_bcv: estado.tasa_bcv,
          tipo_pago: tipoPago,
          dias_credito: diasCredito,
          fecha_vence: fechaVence,
          estado: (tipoPago === 'contado' || _saldoIni <= 0.01) ? 'pagada'
            : (_abonoIni > 0 ? 'parcial' : 'pendiente'),
          saldo_pendiente: _saldoIni,
          // v13.12: el descuento por divisas POR ENCIMA de la brecha se suma al
          // descuento manual y se deja escrito en el motivo. Asi queda en la
          // factura, en el historial y en el export fiscal, no solo en bitacora.
          descuento_manual: Math.round((descManual + _dtoDivMonto + Math.max(0, -_ajVerdeDif)) * 100) / 100,
          motivo_descuento: [motivoDesc, _ajVerdeDif !== 0 ? ('Cobro redondo en efectivo: ' + fmtUSD(_ajV.objetivo) + ' (' + (_ajVerdeDif > 0 ? '+' : '') + fmtUSD(_ajVerdeDif) + ')') : '', _dtoDivMonto > 0
            ? 'Pago en divisas: ' + _dtoDivPct.toFixed(1) + ' pts sobre la brecha ('
              + fmtUSD(_dtoDivMonto) + ')' : ''].filter(Boolean).join(' · '),
          pidio_fiscal: pidioFiscal,
          factor_bs: colchonFactor(),
          // v13.32 El objetivo de "Cobrar en efectivo" se CONGELA en la factura.
          // Antes vivia solo en el carrito: se usaba para calcular el descuento
          // y se perdia. Al abonar despues, nadie sabia que se habia acordado
          // saldar con X en efectivo, y el pago en $ se restaba a valor de cara
          // contra un saldo en $BCV. Mezcla de unidades.
          cobrar_verde: (_ajV && _ajV.objetivo > 0) ? _ajV.objetivo : null
        };
        let { data: factInsert, error: factErr } = await _sb.from('facturas').insert(facturaObj).select().single();
        if (factErr && /cobrar_verde/i.test(factErr.message || '')) {
          console.warn('[ARJ] facturas.cobrar_verde no existe — corre el ALTER TABLE.');
          const sinCV = Object.assign({}, facturaObj); delete sinCV.cobrar_verde;
          const r2 = await _sb.from('facturas').insert(sinCV).select().single();
          factInsert = r2.data; factErr = r2.error;
          if (!factErr) notif('\u26a0 Emitida, pero el objetivo en efectivo no se guardó: falta la columna.', 'warning');
        }
        if (factErr) { notif('Error creando factura: ' + factErr.message, 'error'); return; }
        const facturaId = factInsert.id;

        // 2b. Si esta factura nació de una cotización, marcarla 'convertida' AHORA
        // (no antes: si el usuario abandonaba el carrito, el presupuesto seguía activo)
        if (typeof _cotOrigen !== 'undefined' && _cotOrigen && _cotOrigen.id) {
          await _sb.from('cotizaciones').update({ estado: 'convertida' }).eq('id', _cotOrigen.id);
          const _cotL = COTIZACIONES.find(c => c.id === _cotOrigen.id);
          if (_cotL) _cotL.estado = 'convertida';
          _sbLogBitacora(estado.usuario, estado.empresa, 'factura',
            'Emitió ' + numFactura + ' desde presupuesto ' + _cotOrigen.num, false);
          _cotOrigen = null;
        }

        // 3. Crear ítems de la factura
        const itemsDB = estado.items.map(it => ({
          factura_id: facturaId,
          producto_id: it.producto_id || null,
          cod_alt: it.cod,
          descripcion: it.desc,
          cantidad: it.cant,
          fob_unitario: it.fob || 0,
          // El factor se CONGELA aquí, igual que factor_bs. Si mañana ajustas
          // el factor real de un proveedor, la utilidad de las ventas ya hechas
          // no se reescribe: cada renglón guarda el costo con el que se vendió.
          factor_landed: factorLandedDe(it),
          precio_unitario: it.precio,
          total_linea: it.subtotal,
          tier: estado.tier || 'Publico',
          // v13.28 Se congela igual que factor_landed: es una foto, no una
          // referencia viva a `productos`.
          origen: origenDe(it)
        }));
        let { error: itemsErr } = await _sb.from('factura_items').insert(itemsDB);
        // Si la columna `origen` todavia no existe en la base, el insert
        // completo falla y la factura quedaria SIN renglones. Se reintenta sin
        // ella: mejor perder la clasificacion que perder la factura.
        if (itemsErr && /origen/i.test(itemsErr.message || '')) {
          console.warn('[ARJ] factura_items.origen no existe — reintentando sin esa columna. Corre el ALTER TABLE.');
          const sinOrigen = itemsDB.map(r => { const c = Object.assign({}, r); delete c.origen; return c; });
          const r2 = await _sb.from('factura_items').insert(sinOrigen);
          itemsErr = r2.error;
          if (!itemsErr) notif('\u26a0 Factura emitida, pero sin clasificar origen: falta la columna en la base.', 'warning');
        }
        // Antes esto solo iba a la consola. Una factura sin renglones se ve
        // normal en el listado y no cuadra nada: hay que decirlo en pantalla.
        if (itemsErr) {
          console.error('[ARJ] Error insertando items:', itemsErr);
          notif('\u26a0 GRAVE: la factura se creó pero sus renglones NO se guardaron. Anúlala y avisa.', 'error');
        }

        // 4. Descontar stock
        // v13.33 SEGURIDAD: antes el update no revisaba error y el local se
        // actualizaba igual. Resultado: la pantalla mostraba un stock y la base
        // otro, sin aviso. Ahora el local solo se toca si la base confirmo, asi
        // al recargar no hay dos verdades.
        const campoStock = estado.empresa === 'directa' ? 'stock_vd' : 'stock_dist';
        const _stockFallo = [];
        for (const it of estado.items) {
          // Buscar el producto por cod_alt para obtener su id y stock actual
          const prod = PRODUCTOS.find(p => p.cod_alt === it.cod);
          if (prod) {
            const stockActual = estado.empresa === 'directa' ? prod.stock_vd : prod.stock_dist;
            const nuevoStock = stockActual - it.cant;
            let _stockOk = true;
            // Actualizar en Supabase
            if (prod.id) {
              const { error: stkErr } = await _sb.from('productos')
                .update({ [campoStock]: nuevoStock }).eq('id', prod.id);
              if (stkErr) {
                _stockOk = false;
                _stockFallo.push(it.cod);
                console.error('[ARJ] Error descontando stock de ' + it.cod + ':', stkErr);
              }
            }
            // Actualizar local SOLO si la base confirmo
            if (_stockOk) {
              if (estado.empresa === 'directa') prod.stock_vd = nuevoStock;
              else prod.stock_dist = nuevoStock;
            }
          }
        }
        if (_stockFallo.length > 0) {
          notif('\u26a0 El stock NO se descargo de: ' + _stockFallo.join(', ')
              + '. Ajustalo a mano en Inventario.', 'error');
        }

        // 5. Registrar pagos. v13.29: antes solo se guardaban en contado y el
        // abono inicial de una factura a credito se perdia.
        if (estado.pagos.length > 0) {
          const pagosDB = estado.pagos.filter(p => parseFloat(p.monto) > 0).map(p => {
            const montoRaw = parseFloat(p.monto) || 0;
            const montoUSD = p.moneda === 'USD' ? montoRaw : montoRaw / estado.tasa_par;
            const montoBs = p.moneda === 'Bs' ? montoRaw : montoRaw * estado.tasa_bcv;
            return {
              factura_id: facturaId,
              monto_usd: montoUSD,
              monto_bs: montoBs,
              tasa_usada: p.moneda === 'Bs' ? estado.tasa_par : estado.tasa_bcv,
              metodo: p.metodo || 'Efectivo USD',
              referencia: '',
              registrado_por: estado.usuario || 'Sistema'
            };
          });
          if (pagosDB.length > 0) {
            const { error: pagErr } = await _sb.from('pagos').insert(pagosDB);
            if (pagErr) console.error('[ARJ] Error insertando pagos:', pagErr);
          }
        }

        // 6. Actualizar saldo del cliente si es crédito
        if (tipoPago === 'credito') {
          const campoSaldo = estado.empresa === 'directa' ? 'saldo_vd' : 'saldo_dist';
          const saldoActual = estado.empresa === 'directa' ? clienteSel.saldo_vd : clienteSel.saldo_dist;
          const nuevoSaldo = (saldoActual || 0) + _saldoIni;
          // v13.33 SEGURIDAD: el mas peligroso de los tres. Si esto fallaba en
          // silencio quedaba una factura a credito emitida que el cliente no debe.
          // El local no se toca si la base fallo, para que el error sea visible.
          const { error: cliErr } = await _sb.from('clientes')
            .update({ [campoSaldo]: nuevoSaldo }).eq('id', clienteSel.id);
          if (cliErr) {
            console.error('[ARJ] Error actualizando saldo del cliente:', cliErr);
            notif('\u26a0 GRAVE: ' + numFactura + ' se emitio pero el saldo de '
                + clienteSel.nombre + ' NO subio $' + _saldoIni.toFixed(2)
                + '. Corrigelo a mano en Clientes.', 'error');
          } else {
            // Actualizar local
            if (estado.empresa === 'directa') clienteSel.saldo_vd = nuevoSaldo;
            else clienteSel.saldo_dist = nuevoSaldo;
          }
        }

        // 7. Bitácora
        _sbLogBitacora(estado.usuario, estado.empresa, 'factura',
          'Emitió ' + numFactura + ' a ' + clienteSel.nombre + ' — $' + subtotal.toFixed(2), false);
        logBitacora('factura', 'Emitió ' + numFactura + ' a ' + clienteSel.nombre + ' — $' + subtotal.toFixed(2), false);

        // 8. Agregar a arrays locales para que se vean inmediatamente
        const fechaCorta = ahora.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) + ' ' + ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
        const objFactura = {
          id: facturaId, num: numFactura, empresa: estado.empresa, cliente: clienteSel.nombre,
          cliente_id: clienteSel.id, vendedor: estado.usuario,
          fecha: ahora.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
          fecha_raw: ahora.toISOString(),
          vence: fechaVence ? new Date(fechaVence).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
          cobrar_verde: (_ajV && _ajV.objetivo > 0) ? _ajV.objetivo : null,
          total: subtotal, abonado: tipoPago === 'contado' ? subtotal : _abonoIni,
          saldo_pendiente: _saldoIni,
          estado: facturaObj.estado,
          dias: diasCredito || 0, tipo_pago: tipoPago, tasa_par: estado.tasa_par, tasa_bcv: estado.tasa_bcv,
          factor_bs: facturaObj.factor_bs,
          cliente_nombre_snap: facturaObj.cliente_nombre_snap,
          cliente_rif_snap: facturaObj.cliente_rif_snap,
          cliente_tel_snap: facturaObj.cliente_tel_snap,
          cliente_dir_snap: facturaObj.cliente_dir_snap
        };
        TODAS_FACTURAS.unshift(objFactura);
        VENTAS_RECIENTES.unshift({
          id: facturaId, num: numFactura, cliente: clienteSel.nombre,
          fecha: fechaCorta, total: subtotal, vendedor: estado.usuario, estado: facturaObj.estado
        });
        if (tipoPago === 'credito') {
          FACTURAS_COBRAR.unshift(objFactura);
        }

        // 9. Abrir modal de impresión con datos reales
        _mostrarFacturaEmitida(numFactura, clienteSel, estado.items, subtotal, tipoPago, ahora);

        // 10. Limpiar carrito
        estado.items = [];
        estado.pagos = [];
        renderItems();
        agregarPago();
        actualizarKpiStockCritico();

        notif('✓ Factura ' + numFactura + ' emitida correctamente', 'success');
        if (pidioFiscal) setTimeout(() => notif('📋 Recordatorio: el cliente pidió factura fiscal', 'warning'), 2000);

      } catch (err) {
        console.error('[ARJ] Error emitiendo factura:', err);
        notif('Error emitiendo factura: ' + (err.message || err), 'error');
      }
    }

    // Mostrar el modal de factura emitida (reutiliza el print layout existente)
    function _mostrarFacturaEmitida(num, cliente, items, subtotal, tipoPago, fecha) {
      // Reutilizar la vista de impresión existente (generarVistaImpresion)
      // pero con el número real de factura
      generarVistaImpresion();
      // Sobreescribir el número con el real
      const elNum = document.getElementById('dc-numero');
      if (elNum) elNum.textContent = num;
      // Cambiar título del modal
      const h2 = document.querySelector('#modal-print-cotizacion h2');
     if(h2) h2.innerHTML = '<i class="ti ti-file-check"></i> Factura emitida: ' + num;
  const lblDoc = document.querySelector('#modal-print-cotizacion .dc-num-label');
  if(lblDoc) lblDoc.textContent = 'FACTURA';
  const vl = document.getElementById('dc-vence-label');
  if(vl) vl.textContent = 'Condición:';
  const vv = document.getElementById('dc-vence');
  if(vv) vv.textContent = (tipoPago === 'contado') ? 'Contado' : 'Crédito';
}