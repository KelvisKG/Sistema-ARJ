// === Busqueda Avanzada ===
    function cambiarTabBusqueda(tab) {
      document.querySelectorAll('.search-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      document.querySelectorAll('.search-tab-content').forEach(c => {
        c.style.display = c.id === 'tab-' + tab ? 'block' : 'none';
      });
      // Auto-focus en el campo correspondiente
      setTimeout(() => {
        if (tab === 'normal') document.getElementById('busqueda-prod')?.focus();
        if (tab === 'aplicacion') { document.getElementById('busqueda-aplicacion')?.focus(); renderMarcasFrecuentes(); }
        if (tab === 'barras') document.getElementById('busqueda-barras')?.focus();
        if (tab === 'favoritos') renderFavoritos();
      }, 50);
    }

    // ─── BÚSQUEDA POR APLICACIÓN DE TRACTOR ─────────────────────
    function buscarPorAplicacion() {
      const q = document.getElementById('busqueda-aplicacion').value.trim();
      const sis = document.getElementById('busqueda-sistema')?.value || '';
      const cont = document.getElementById('search-results-aplicacion');
      // Si no hay texto Y no hay sistema, no buscar
      if (!q && !sis) { cont.classList.remove('show'); return; }
      const qNorm = normalize(q);
      const words = qNorm.split(/\s+/).filter(w => w.length >= 2);
      const matches = PRODUCTOS.filter(p => {
        if (sis && (p.sistema || '') !== sis) return false;
        if (!q) return true; // solo filtro por sistema
        const hay = normalize((p.marca_modelo || '') + ' ' + (p.sistema || ''));
        return words.every(w => hay.includes(w));
      }).slice(0, 15);
      if (matches.length === 0) {
        cont.innerHTML = '<div class="search-item" style="color:var(--dgray);cursor:default"><span>Sin resultados</span></div>';
        cont.classList.add('show'); return;
      }
      cont.innerHTML = matches.map(p => {
        const precio = precioConTier(p.fob, estado.tier, p);
        const stock = estado.empresa === 'directa' ? p.stock_vd : p.stock_dist;
        const stockCls = stock <= (estado.empresa === 'directa' ? 10 : 20) ? 'warn' : '';
        const aplicTxt = (p.sistema ? `<strong>${p.sistema}</strong> · ` : '') + (p.marca_modelo || '');
        return `<div class="search-item" onclick="agregarProducto('${p.cod_alt}');document.getElementById('busqueda-aplicacion').value='';document.getElementById('search-results-aplicacion').classList.remove('show')">
      <div style="flex:1">
        <div class="codigo">${p.cod_alt} · ${p.marca}</div>
        <div class="desc">${p.desc}</div>
        <div style="font-size:11px;color:var(--blue);margin-top:2px"><i class="ti ti-tractor" style="font-size:11px"></i> ${highlight(aplicTxt, qNorm)}</div>
      </div>
      <div style="text-align:right;margin-left:10px"><div class="precio">${fmtUSD(precio)}</div><div class="stock ${stockCls}">Stock: ${stock}</div></div>
    </div>`;
      }).join('');
      cont.classList.add('show');
    }

    // Llena los dropdowns de sistemas en facturación, presupuestos e inventario
    function llenarDropdownSistemas() {
      const ids = ['busqueda-sistema', 'pre-busqueda-sistema', 'inv-sistema'];
      ids.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const valActual = sel.value;
        sel.innerHTML = '<option value="">Todos los sistemas</option>' +
          SISTEMAS.map(s => `<option value="${s}">${s}</option>`).join('');
        if (valActual) sel.value = valActual;
      });
    }

    function renderMarcasFrecuentes() {
      const marcas = ['John Deere', 'Ford', 'Massey Ferguson', 'New Holland', 'Case IH', 'Perkins', '4045T', '6068'];
      const cont = document.getElementById('marcas-frecuentes');
      if (!cont) return;
      cont.innerHTML = marcas.map(m => `<span class="marca-chip" onclick="filtrarPorMarca('${m}')"><i class="ti ti-tractor"></i> ${m}</span>`).join('');
    }

    function filtrarPorMarca(marca) {
      document.getElementById('busqueda-aplicacion').value = marca;
      buscarPorAplicacion();
    }

    document.addEventListener('click', e => {
      if (!e.target.closest('#tab-aplicacion')) {
        document.getElementById('search-results-aplicacion')?.classList.remove('show');
      }
    });

    // ─── CÓDIGO DE BARRAS ───────────────────────────────────────
    function escanearCodigo() {
      const inp = document.getElementById('busqueda-barras');
      const codigo = inp.value.trim().toUpperCase();
      if (!codigo) return;
      // Buscar primero por código de barras (lo más común con escáner), luego por código alternativo o original
      const p = PRODUCTOS.find(x => (x.cod_barras || '').toUpperCase() === codigo)
        || PRODUCTOS.find(x => x.cod_alt.toUpperCase() === codigo || x.cod_orig.toUpperCase() === codigo);
      if (!p) {
        document.getElementById('ultimo-escaneado').textContent = '✗ No encontrado: ' + codigo;
        document.getElementById('ultimo-escaneado').style.color = 'var(--red)';
        notif('Código no encontrado: ' + codigo, 'error');
        inp.value = '';
        setTimeout(() => inp.focus(), 100);
        return;
      }
      agregarProducto(p.cod_alt);
      document.getElementById('ultimo-escaneado').textContent = '✓ ' + p.desc;
      document.getElementById('ultimo-escaneado').style.color = 'var(--green)';
      inp.value = '';
      setTimeout(() => inp.focus(), 100);
    }
