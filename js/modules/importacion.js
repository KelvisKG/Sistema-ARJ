// === Importacion ===
    // ─── IMPORTACIÓN MASIVA POR EXCEL ──────────────────────────
    function procesarImportacion() {
      const texto = document.getElementById('importar-textarea').value.trim();
      if (!texto) { notif('Pega los códigos primero', 'error'); return; }
      const lineas = texto.split('\n').map(l => l.trim()).filter(l => l);
      let agregados = 0, errores = [];
      lineas.forEach(linea => {
        // Acepta separación por tab o múltiples espacios
        const partes = linea.split(/[\t\s]+/);
        if (partes.length < 2) { errores.push(linea); return; }
        const cod = partes[0].toUpperCase();
        const cant = parseInt(partes[1]) || 0;
        if (cant <= 0) { errores.push(linea + ' (cantidad inválida)'); return; }
        const p = PRODUCTOS.find(x => x.cod_alt.toUpperCase() === cod || x.cod_orig.toUpperCase() === cod);
        if (!p) { errores.push(linea + ' (código no encontrado)'); return; }
        const ex = estado.items.find(i => i.cod_alt === p.cod_alt);
        if (ex) { ex.cant += cant; }
        else {
          estado.items.push({
            producto_id: p.id, cod: p.cod_alt,
            cod_alt: p.cod_alt, cod_orig: p.cod_orig, desc: p.desc, marca: p.marca, fob: p.fob,
            stock_vd: p.stock_vd, stock_dist: p.stock_dist,
            precio_manual: p.precio_manual,
            factor_landed: p.factor_landed, origen: p.origen,
            cant, precio: precioConTier(p.fob, estado.tier, p), subtotal: cant * precioConTier(p.fob, estado.tier, p)
          });
        }
        agregados++;
      });
      renderItems();
      recalcular();
      const status = document.getElementById('import-status');
      if (errores.length === 0) {
        status.innerHTML = `<span style="color:var(--green);font-weight:600">✓ ${agregados} productos agregados correctamente</span>`;
        notif(`${agregados} productos agregados a la factura`, 'success');
        document.getElementById('importar-textarea').value = '';
      } else {
        status.innerHTML = `<span style="color:var(--gold);font-weight:600">${agregados} agregados, ${errores.length} con error:</span><div style="font-size:10.5px;color:var(--red);margin-top:4px;max-height:60px;overflow-y:auto">${errores.map(e => '• ' + e).join('<br>')}</div>`;
        notif(`${agregados} agregados, ${errores.length} errores`, 'warning');
      }
    }

    // ─── MODO CAJA ──────────────────────────────────────────────
    let cajaItems = [];
