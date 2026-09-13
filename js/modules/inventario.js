// === Inventario ===
    function renderInventario() {
      // Determinar tab activo
      const tabActivo = document.querySelector('[data-tab-inv].active')?.dataset.tabInv || 'normal';
      let filtered;

      if (tabActivo === 'aplicacion') {
        const qMM = (document.getElementById('inv-marca-modelo')?.value || '').trim();
        const qSis = document.getElementById('inv-sistema')?.value || '';
        const qMMNorm = normalize(qMM);
        const words = qMMNorm.split(/\s+/).filter(w => w.length >= 1);
        filtered = PRODUCTOS.filter(p => {
          if (qSis && p.sistema !== qSis) return false;
          if (qMM) {
            const hay = normalize(p.marca_modelo || '');
            return words.every(w => hay.includes(w));
          }
          return true;
        });
      } else {
        const q = (document.getElementById('inv-busqueda')?.value || '').trim();
        const qNorm = normalize(q);
        filtered = PRODUCTOS.filter(p => {
          if (!q) return true;
          const hay = normalize(p.cod_alt + ' ' + p.cod_orig + ' ' + (p.cod_barras || '') + ' ' + p.desc + ' ' + p.marca);
          return qNorm.split(/\s+/).every(w => hay.includes(w));
        });
      }

      const tbody = document.getElementById('inv-body');
      const esGerente = estado.rol === 'gerente';
      tbody.innerHTML = filtered.map((p, idx) => {
        const stockAca = estado.empresa === 'directa' ? p.stock_vd : p.stock_dist;
        const stockOtra = estado.empresa === 'directa' ? p.stock_dist : p.stock_vd;
        const otraEmp = estado.empresa === 'directa' ? 'Distribuidora' : 'Venta Directa';
        let cls = 'alto';
        const umbralCritico = estado.empresa === 'directa' ? 10 : 20;
        const umbralMedio = estado.empresa === 'directa' ? 20 : 40;
        if (stockAca < 0) cls = 'neg'; else if (stockAca <= umbralCritico) cls = 'bajo'; else if (stockAca <= umbralMedio) cls = 'medio';
        const editBtn = esGerente ? `<button class="btn btn-secondary btn-sm" style="padding:3px 8px;font-size:10px" onclick="abrirEditProducto('${p.cod_alt}')"><i class="ti ti-edit"></i></button>` : '';
        const delBtn = esGerente ? `<button class="btn btn-secondary btn-sm" style="padding:3px 8px;font-size:10px;color:var(--red)" onclick="eliminarProducto('${p.cod_alt}')"><i class="ti ti-trash"></i></button>` : '';
        const precioPub = p.precio_manual || precioPublico(p.fob);
        const aplicTxt = (p.sistema || p.marca_modelo) ? `<div style="font-size:10.5px"><strong style="color:var(--blue)">${p.sistema || '—'}</strong><div style="color:var(--dgray);font-size:10px">${(p.marca_modelo || '').substring(0, 32)}${(p.marca_modelo || '').length > 32 ? '...' : ''}</div></div>` : '<span style="color:var(--dgray);font-size:10.5px">—</span>';
        return `<tr>
      <td class="center" style="color:var(--dgray);font-size:11px;font-weight:600">${idx + 1}</td>
      <td><strong>${p.cod_alt}</strong></td>
      <td><span style="color:var(--dgray)">${p.cod_orig}</span></td>
     <td><div style="display:flex;align-items:center;gap:8px">${p.imagen_url ? `<div style="position:relative"><img src="${p.imagen_url.split('|')[0]}" loading="lazy" onclick="verFotoProducto('${p.cod_alt}')" style="width:34px;height:34px;object-fit:cover;border-radius:5px;cursor:zoom-in;border:1px solid #e0e0e0">${_fotosDe(p).length > 1 ? `<span style="position:absolute;bottom:-4px;right:-4px;background:var(--gold);color:#fff;border-radius:50%;width:14px;height:14px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700">${_fotosDe(p).length}</span>` : ''}</div>` : ''}<span>${p.desc}</span></div></td>
      <td>${p.marca}</td>
      <td>${aplicTxt}</td>
      <td class="num col-restricted">${fmtUSD(p.fob)}</td>
      <td class="num"><strong>${fmtUSD(precioPub)}</strong>${p.precio_manual ? '<div style="font-size:9px;color:var(--gold)">manual</div>' : ''}</td>
      <td class="center"><span class="inv-stock-badge ${cls}">${stockAca}</span></td>
      <td class="center"><span class="inv-stock-other disponible" title="${otraEmp} tiene ${stockOtra}">${otraEmp}: ${stockOtra}</span></td>
    ${esGerente ? `<td class="center" style="white-space:nowrap">${editBtn} ${delBtn}</td>` : ''}
    </tr>`;
      }).join('');
      document.getElementById('total-prods').textContent = filtered.length;
    }

    // ═══════════════════════════════════════════════════════════════
    // CXC
    // ═══════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════
    // EDICIÓN DE PRODUCTOS (solo gerente)
    // ═══════════════════════════════════════════════════════════════
    let prodEditando = null;
    async function eliminarProducto(codAlt) {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede eliminar productos', 'error'); return; }
      const p = PRODUCTOS.find(x => x.cod_alt === codAlt);
      if (!p) { notif('Producto no encontrado', 'error'); return; }

      // 1. Preguntar a Supabase cuántas veces está facturado
      let vecesFacturado = 0;
      try {
        const { count, error } = await _sb.from('factura_items').select('id', { count: 'exact', head: true }).eq('producto_id', p.id);
        if (error) throw error;
        vecesFacturado = count || 0;
      } catch (e) {
        notif('No se pudo verificar en la base de datos. Intenta de nuevo.', 'error');
        console.error('[eliminarProducto]', e);
        return;
      }

      // 2. Decidir según el resultado
      if (vecesFacturado === 0) {
        // Nunca facturado → borrado real
        if (!confirm(`¿Eliminar DEFINITIVAMENTE el producto "${p.desc}" (${p.cod_alt})?\n\nEste producto nunca ha sido facturado. Esta acción no se puede deshacer.`)) return;
        try {
          const { error } = await _sb.from('productos').delete().eq('id', p.id);
          if (error) throw error;
          const idx = PRODUCTOS.indexOf(p);
          if (idx >= 0) PRODUCTOS.splice(idx, 1);
          logBitacora('inventario', `Eliminó producto ${p.cod_alt} - ${p.desc} (borrado definitivo, sin facturas)`, true);
          renderInventario();
          notif('✓ Producto eliminado', 'success');
        } catch (e) {
          notif('Error al eliminar en la base de datos', 'error');
          console.error('[eliminarProducto/delete]', e);
        }
      } else {
        // Ya facturado → desactivar (soft delete)
        if (!confirm(`El producto "${p.desc}" (${p.cod_alt}) aparece en ${vecesFacturado} factura(s).\n\nNo se puede borrar sin dañar el histórico fiscal.\n\n¿Deseas DESACTIVARLO? Desaparecerá de la lista pero el histórico se conserva.`)) return;
        try {
          const { error } = await _sb.from('productos').update({ activo: false }).eq('id', p.id);
          if (error) throw error;
          const idx = PRODUCTOS.indexOf(p);
          if (idx >= 0) PRODUCTOS.splice(idx, 1);
          logBitacora('inventario', `Desactivó producto ${p.cod_alt} - ${p.desc} (estaba en ${vecesFacturado} factura(s))`, true);
          renderInventario();
          notif('✓ Producto desactivado (histórico conservado)', 'success');
        } catch (e) {
          notif('Error al desactivar en la base de datos', 'error');
          console.error('[eliminarProducto/update]', e);
        }
      }
    }
    function abrirEditProducto(codAlt) {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede editar productos', 'error'); return; }
      const p = PRODUCTOS.find(x => x.cod_alt === codAlt);
      if (!p) return;
      prodEditando = p;
      document.getElementById('ep-cod-alt').value = p.cod_alt;
      document.getElementById('ep-cod-alt').readOnly = true;
      document.getElementById('ep-cod-alt').style.background = '#F5F5F5';
      document.getElementById('ep-cod-alt').style.color = 'var(--dgray)';
      document.getElementById('ep-cod-orig').value = p.cod_orig;
      document.getElementById('ep-cod-barras').value = p.cod_barras || '';
      document.getElementById('ep-desc').value = p.desc;
      document.getElementById('ep-marca').value = p.marca;
      document.getElementById('ep-marca-modelo').value = p.marca_modelo || '';
      llenarSelectSistemas('ep-sistema', p.sistema || '');
      document.getElementById('ep-fob').value = p.fob;
      document.getElementById('ep-factor').value = p.factor_landed || FACTOR_LANDED_FALLBACK;
      document.getElementById('ep-proveedor').value = p.proveedor || '';
      _llenarProveedores();
      epSetOrigen(p.origen || 'importado', true);
      document.getElementById('ep-precio-manual').value = p.precio_manual || '';
      document.getElementById('ep-foto').value = '';
      _renderFotosPreview(p);
      document.getElementById('ep-stock-vd').value = p.stock_vd;
      document.getElementById('ep-stock-dist').value = p.stock_dist;
      actualizarPreviewPrecio();
      document.getElementById('modal-edit-prod').classList.add('show');
    }

    function cerrarEditProducto() {
      document.getElementById('modal-edit-prod').classList.remove('show');
      prodEditando = null;
    }

    function guardarEditProducto() {
      if (!prodEditando) return;
      const fobAnt = prodEditando.fob;
      const barrasAnt = prodEditando.cod_barras || '';
      const nuevoBarras = document.getElementById('ep-cod-barras').value.trim();
      // Validar que el código de barras no esté duplicado en otro producto
      if (nuevoBarras && nuevoBarras !== barrasAnt) {
        const duplicado = PRODUCTOS.find(p => p !== prodEditando && p.cod_barras === nuevoBarras);
        if (duplicado) {
          notif(`Ese código de barras ya está asignado a ${duplicado.cod_alt} (${duplicado.desc})`, 'error');
          return;
        }
      }
      // Si es nuevo producto, validar código alternativo
      if (prodEditando._nuevo) {
        const codAlt = document.getElementById('ep-cod-alt').value.trim();
        if (!codAlt) { notif('El código alternativo es obligatorio', 'error'); return; }
        if (PRODUCTOS.find(p => p.cod_alt === codAlt)) { notif('Ya existe un producto con ese código alternativo', 'error'); return; }
        prodEditando.cod_alt = codAlt;
      }
      // v13.3: la descripcion es obligatoria. Un producto sin descripcion sale
      // con el renglon EN BLANCO en la factura del cliente, y la factura queda
      // congelada asi. Paso el 11 ago con el codigo 5191547-2.
      // Va aqui (funcion que guarda) y no como `required` en el input: un
      // `required` se salta si el campo se llena por codigo o si el navegador
      // no lo respeta.
      const _desc = (document.getElementById('ep-desc').value || '').trim();
      if (!_desc) { notif('La descripción del producto es obligatoria', 'error'); return; }
      if (_desc.length < 4) { notif('La descripción es muy corta para identificar el producto', 'error'); return; }

      // El origen tiene su propio campo desde v13.1. Escribirlo tambien en la
      // descripcion ensucia la factura del cliente ("DISTRIBUIDOR LOCAL ROTULA
      // DE GATO..."). Se avisa una vez y se deja continuar: puede haber un
      // producto que de verdad se llame asi.
      if (/^\s*(DISTRIBUIDOR|LOCAL|IMPORTADO)\b/i.test(_desc)) {
        if (!confirm('La descripción empieza con "' + _desc.split(/\s+/)[0] + '".\n\nEl origen ya tiene su propio campo — ese prefijo va a salir impreso en la factura del cliente.\n\n¿Guardar así de todos modos?')) return;
      }

      prodEditando.cod_orig = document.getElementById('ep-cod-orig').value;
      prodEditando.cod_barras = nuevoBarras;
      prodEditando.desc = _desc;
      prodEditando.marca = document.getElementById('ep-marca').value;
      prodEditando.marca_modelo = document.getElementById('ep-marca-modelo').value;
      prodEditando.sistema = document.getElementById('ep-sistema').value;
      prodEditando.fob = parseFloat(document.getElementById('ep-fob').value) || 0;
      const _org = document.getElementById('ep-org-local').dataset.activo === '1' ? 'local' : 'importado';
      const _fac = parseFloat(document.getElementById('ep-factor').value);
      if (!isFinite(_fac) || _fac < 1 || _fac > 5) {
        notif('El factor landed debe estar entre 1 y 5. Importado ≈1,471 · Local =1,000', 'error');
        return;
      }
      const _pmEl = document.getElementById('ep-precio-manual');
      const pm = _pmEl.value.trim();
      // v13.12: el input es type=number. Si se escribe "12,50" con coma (como se
      // escribe aqui), el navegador NO lo acepta y deja .value VACIO. Sin este
      // chequeo el producto se guardaba con precio_manual = null: el precio puesto
      // a mano desaparecia solo y el producto se iba al x2.5 automatico, callado.
      if (!pm && _pmEl.validity && _pmEl.validity.badInput) {
        notif('No se entendio el precio de venta. Usa punto decimal, no coma (ej: 12.50).', 'error');
        return;
      }
      // v13.12: si el campo trae algo que no es un numero valido, parseFloat da NaN.
      // NaN se guardaba tal cual, y despues `precio_manual > 0` daba false: el
      // producto caia calladito al x2.5 automatico, sin un solo mensaje. Un precio
      // puesto a mano que desaparece sin avisar es peor que un error visible.
      const _pmNum = pm ? parseFloat(pm) : null;
      if (pm && (!isFinite(_pmNum) || _pmNum <= 0)) {
        notif('El precio de venta no es un numero valido. Escribelo con punto decimal (ej: 12.50), o dejalo vacio para usar el automatico.', 'error');
        return;
      }
      // REGLA DE NEGOCIO: un producto de compra local NO puede usar el multiplicador
      // escalonado de FOB. Ese escalón asume costo de fábrica; el precio del distribuidor
      // local ya trae su margen adentro, así que ×2.5 sobre él es sobreprecio automático.
      // Se valida AQUÍ, en la función que guarda, no con un disabled en pantalla.
      if (_org === 'local' && !pm) {
        notif('Producto de compra local: el precio de venta es obligatorio. El ×2.5 automático solo sirve para mercancía importada.', 'error');
        return;
      }
      prodEditando.origen = _org;
      prodEditando.factor_landed = _fac;
      prodEditando.proveedor = document.getElementById('ep-proveedor').value.trim().toUpperCase();
      prodEditando.precio_manual = _pmNum;
      prodEditando.stock_vd = parseInt(document.getElementById('ep-stock-vd').value) || 0;
      prodEditando.stock_dist = parseInt(document.getElementById('ep-stock-dist').value) || 0;

      if (prodEditando._nuevo) {
        delete prodEditando._nuevo;
        PRODUCTOS.push(prodEditando);
        logBitacora('inventario', `Creó nuevo producto ${prodEditando.cod_alt} - ${prodEditando.desc}`, true);
      } else if (fobAnt !== prodEditando.fob) {
        logBitacora('inventario', `Editó producto ${prodEditando.cod_alt} — FOB de ${fmtUSD(fobAnt)} a ${fmtUSD(prodEditando.fob)}`, true);
      } else if (barrasAnt !== nuevoBarras) {
        logBitacora('inventario', `Editó producto ${prodEditando.cod_alt} — código de barras actualizado a ${nuevoBarras || '(vacío)'}`, false);
      } else {
        logBitacora('inventario', `Editó producto ${prodEditando.cod_alt} (${prodEditando.desc})`, false);
      }
      const prodGuardar = prodEditando;
      const fotosNuevas = document.getElementById('ep-foto').files;
      cerrarEditProducto();
      renderInventario();
      guardarProductoConFoto(prodGuardar, fotosNuevas);
    }

    function _fotosDe(p) { return (p.imagen_url || '').split('|').filter(Boolean); }

    function _renderFotosPreview(p) {
      const cont = document.getElementById('ep-fotos-preview');
      const fotos = _fotosDe(p);
      cont.innerHTML = fotos.map((u, i) => `<div style="position:relative"><img src="${u}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #ddd"><button onclick="quitarFotoProducto(${i})" title="Quitar foto" style="position:absolute;top:-6px;right:-6px;background:#c0392b;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1">×</button></div>`).join('') || '<span style="font-size:11px;color:var(--dgray)">Sin fotos</span>';
    }

    function quitarFotoProducto(i) {
      const fotos = _fotosDe(prodEditando);
      fotos.splice(i, 1);
      prodEditando.imagen_url = fotos.join('|');
      _renderFotosPreview(prodEditando);
    }

    async function guardarProductoConFoto(prod, files) {
      if (files && files.length) {
        const actuales = _fotosDe(prod);
        const espacio = 3 - actuales.length;
        const aSubir = Array.from(files).slice(0, Math.max(0, espacio));
        if (files.length > espacio) notif('Máximo 3 fotos por producto. Se subirán ' + aSubir.length, 'warning');
        if (aSubir.length) notif('Subiendo ' + aSubir.length + ' foto(s)...', 'warning');
        for (const f of aSubir) {
          const url = await subirFotoProducto(prod, f);
          if (url) actuales.push(url);
        }
        prod.imagen_url = actuales.join('|');
      }
      const ok = await _sbGuardarProducto(prod);
      if (ok) { notif('Producto guardado. Los vendedores ven los cambios inmediatamente.', 'success'); renderInventario(); }
    }

    async function subirFotoProducto(prod, file) {
      try {
        const img = await _comprimirImagen(file, 1280, 0.85);
        const nombre = 'prod_' + (prod.id || prod.cod_alt.replace(/[^a-zA-Z0-9_-]/g, '')) + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.jpg';
        const { error } = await _sb.storage.from('productos-img').upload(nombre, img, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
        const { data } = _sb.storage.from('productos-img').getPublicUrl(nombre);
        return data.publicUrl;
      } catch (e) {
        console.error('[foto]', e);
        notif('No se pudo subir la foto: ' + (e.message || e), 'error');
        return null;
      }
    }

    function verFotoProducto(codAlt) {
      const p = PRODUCTOS.find(x => x.cod_alt === codAlt);
      const fotos = p ? _fotosDe(p) : [];
      if (!fotos.length) return;
      let ov = document.getElementById('foto-overlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'foto-overlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:zoom-out;flex-direction:column;gap:12px';
        ov.onclick = () => ov.style.display = 'none';
        ov.innerHTML = '<div id="foto-overlay-imgs" style="display:flex;gap:14px;max-width:92vw;overflow-x:auto;align-items:center;padding:10px"></div><div id="foto-overlay-cap" style="color:#fff;font-weight:600"></div>';
        document.body.appendChild(ov);
      }
      document.getElementById('foto-overlay-imgs').innerHTML = fotos.map(u => `<img src="${u}" style="max-height:76vh;max-width:80vw;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.5)">`).join('');
      document.getElementById('foto-overlay-cap').textContent = p.cod_alt + ' — ' + p.desc;
      ov.style.display = 'flex';
    }

    function _comprimirImagen(file, maxLado, calidad) {
      return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxLado || h > maxLado) { const f = maxLado / Math.max(w, h); w = Math.round(w * f); h = Math.round(h * f); }
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          cv.toBlob(b => b ? res(b) : rej(new Error('No se pudo procesar la imagen')), 'image/jpeg', calidad);
        };
        img.onerror = () => rej(new Error('Archivo de imagen inválido'));
        img.src = URL.createObjectURL(file);
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // v7 — NUEVAS FUNCIONES
    // ═══════════════════════════════════════════════════════════════

    // ─── TAB DE INVENTARIO (búsqueda normal/aplicación) ──────────
    function cambiarTabInv(tab) {
      document.querySelectorAll('[data-tab-inv]').forEach(t => t.classList.toggle('active', t.dataset.tabInv === tab));
      document.getElementById('tab-inv-normal').style.display = tab === 'normal' ? 'block' : 'none';
      document.getElementById('tab-inv-aplicacion').style.display = tab === 'aplicacion' ? 'block' : 'none';
      if (tab === 'aplicacion') {
        // Llenar select de sistemas
        const sel = document.getElementById('inv-sistema');
        sel.innerHTML = '<option value="">Todos los sistemas</option>' + SISTEMAS.map(s => `<option>${s}</option>`).join('');
      }
      renderInventario();
    }

    // ─── ORIGEN DEL PRODUCTO (importado / compra local) ─────────
    // Cambiar el origen solo PROPONE el factor típico; el número sigue siendo
    // editable, porque una compra local con IVA no recuperable o flete interno
    // no tiene factor 1,000 exacto.
    function epSetOrigen(org, silencioso) {
      const bImp = document.getElementById('ep-org-importado');
      const bLoc = document.getElementById('ep-org-local');
      const lbl = document.getElementById('ep-lbl-fob');
      const inpF = document.getElementById('ep-factor');
      if (!bImp || !bLoc) return;
      const esLocal = org === 'local';
      bImp.dataset.activo = esLocal ? '0' : '1';
      bLoc.dataset.activo = esLocal ? '1' : '0';
      bImp.style.background = esLocal ? '#FFF' : '#FFE082';
      bLoc.style.background = esLocal ? '#FFE082' : '#FFF';
      if (lbl) lbl.textContent = esLocal ? 'Costo de compra USD:' : 'Costo FOB USD:';
      // Al cambiar de origen a mano se propone el factor típico. Al abrir un producto
      // existente (silencioso) se respeta el factor que ya tiene guardado.
      if (!silencioso && inpF) inpF.value = esLocal ? '1.000' : (estado.factor_default || FACTOR_LANDED_FALLBACK);
      actualizarPreviewPrecio();
    }

    // Lista de proveedores: se arma sola con los que ya existen en el catálogo.
    function _llenarProveedores() {
      const dl = document.getElementById('lista-proveedores');
      if (!dl) return;
      const vistos = [...new Set((PRODUCTOS || []).map(p => (p.proveedor || '').trim()).filter(Boolean))].sort();
      dl.innerHTML = vistos.map(v => `<option value="${v}">`).join('');
    }


    async function agregarSistemaNuevo() {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede crear sistemas', 'error'); return; }
      if (!_sb || !_supabaseConectado) { notif('Sin conexión: no se puede crear el sistema', 'error'); return; }
      const nombre = prompt('Nombre del nuevo sistema (ej: Transmisión, Aire acondicionado...):');
      if (!nombre || !nombre.trim()) return;
      const nombreLimpio = nombre.trim();
      if (SISTEMAS.includes(nombreLimpio)) { notif('Ese sistema ya existe', 'warning'); return; }

      // Se coloca al final de la lista. Si un dia quieres reordenarlos, se hace
      // con un update de `orden` en Supabase, no desde aqui.
      const { error } = await _sb.from('sistemas').insert({
        nombre: nombreLimpio,
        orden: SISTEMAS.length + 1
      });

      if (error) {
        console.error('[ARJ] Error insertando sistema:', error);
        notif('No se pudo guardar el sistema: ' + (error.message || 'error desconocido'), 'error');
        return;
      }

      SISTEMAS.push(nombreLimpio);
      llenarSelectSistemas('ep-sistema', nombreLimpio);
      llenarSelectSistemas('inv-sistema', '');
      logBitacora('inventario', `Agregó nuevo sistema "${nombreLimpio}" a la lista`, false);
      notif(`Sistema "${nombreLimpio}" guardado.`, 'success');
    }

    function llenarSelectSistemas(selectId, valorSel) {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      const firstOption = selectId === 'inv-sistema' ? '<option value="">Todos los sistemas</option>' : '<option value="">-- Selecciona --</option>';
      sel.innerHTML = firstOption + SISTEMAS.map(s => `<option ${s === valorSel ? 'selected' : ''}>${s}</option>`).join('');
    }

    // ─── ELIMINACIÓN AUTOMÁTICA DE PRESUPUESTOS VENCIDOS ────────

    function abrirNuevoProducto() {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede crear productos', 'error'); return; }
      prodEditando = { cod_alt: '', cod_orig: '', cod_barras: '', desc: '', marca: '', fob: 0, stock_vd: 0, stock_dist: 0, marca_modelo: '', sistema: '', precio_manual: null, origen: 'importado', factor_landed: (estado.factor_default || FACTOR_LANDED_FALLBACK), proveedor: '', _nuevo: true };
      document.getElementById('ep-cod-alt').value = '';
      document.getElementById('ep-cod-alt').readOnly = false;
      document.getElementById('ep-cod-alt').style.background = '#FFF';
      document.getElementById('ep-cod-alt').style.color = '#222';
      document.getElementById('ep-cod-orig').value = '';
      document.getElementById('ep-cod-barras').value = '';
      document.getElementById('ep-desc').value = '';
      document.getElementById('ep-marca').value = '';
      document.getElementById('ep-marca-modelo').value = '';
      llenarSelectSistemas('ep-sistema', '');
      document.getElementById('ep-fob').value = '0';
      document.getElementById('ep-factor').value = (estado.factor_default || FACTOR_LANDED_FALLBACK);
      document.getElementById('ep-proveedor').value = '';
      _llenarProveedores();
      epSetOrigen('importado', true);
      document.getElementById('ep-precio-manual').value = '';
      document.getElementById('ep-stock-vd').value = '0';
      document.getElementById('ep-stock-dist').value = '0';
      actualizarPreviewPrecio();
      document.getElementById('modal-edit-prod').classList.add('show');
    }


    function actualizarKpiStockCritico() {
      const umbral = estado.empresa === 'directa' ? 10 : 20;
      const stockField = estado.empresa === 'directa' ? 'stock_vd' : 'stock_dist';
      // "Agotado" (0 unidades) y "bajo" (1 a umbral) son problemas distintos:
      // mezclarlos daba un número que abarcaba casi todo el catálogo mientras
      // la importación no llega, y por eso no servía para decidir nada.
      const agotados = PRODUCTOS.filter(p => (p[stockField] || 0) <= 0).length;
      const bajos = PRODUCTOS.filter(p => (p[stockField] || 0) > 0 && (p[stockField] || 0) <= umbral).length;
      const el = document.getElementById('kpi-stock-critico');
      const sub = document.getElementById('kpi-stock-sub');
      if (el) el.textContent = bajos;
      if (sub) sub.textContent = `1 a ${umbral} ud · ${agotados} agotados de ${PRODUCTOS.length}`;
      actualizarKpisReportes();
    }

    // KPIs de Reportes con datos REALES (antes eran ceros escritos en el HTML).
    // Se calculan sobre facturas emitidas, excluyendo SIEMPRE las anuladas:
    // una factura anulada no es una venta.