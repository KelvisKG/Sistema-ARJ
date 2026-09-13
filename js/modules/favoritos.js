// === Favoritos ===
    // ─── FAVORITOS ──────────────────────────────────────────────
    function getFavoritosUsuario() {
      const personales = FAVORITOS_PERSONALES[estado.usuario] || [];
      return { obligatorios: FAVORITOS_OBLIGATORIOS, personales };
    }

    function renderFavoritos() {
      const cont = document.getElementById('favoritos-grid');
      if (!cont) return;
      const { obligatorios, personales } = getFavoritosUsuario();
      const todos = [...obligatorios.map(c => ({ cod: c, obligatorio: true })), ...personales.map(c => ({ cod: c, obligatorio: false }))];
      if (todos.length === 0) {
        cont.innerHTML = '<div style="grid-column:1/-1;padding:30px;text-align:center;color:var(--dgray)"><i class="ti ti-star" style="font-size:36px;display:block;margin-bottom:8px;color:#CCC"></i>No tienes favoritos aún. Haz clic en "Gestionar mis favoritos" para agregar.</div>';
        return;
      }
      cont.innerHTML = todos.map(f => {
        const p = PRODUCTOS.find(x => x.cod_alt === f.cod);
        if (!p) return '';
        const precio = precioConTier(p.fob, estado.tier, p);
        const stock = estado.empresa === 'directa' ? p.stock_vd : p.stock_dist;
        return `<div class="fav-card ${f.obligatorio ? 'obligatorio' : ''}" onclick="agregarProducto('${p.cod_alt}')">
      ${f.obligatorio ? '<i class="ti ti-star-filled fav-star"></i>' : `<button class="fav-delete" onclick="event.stopPropagation();quitarFavorito('${p.cod_alt}')" title="Quitar de mis favoritos">✕</button>`}
      <div class="fav-cod">${p.cod_alt}</div>
      <div class="fav-desc">${p.desc.substring(0, 50)}${p.desc.length > 50 ? '...' : ''}</div>
      <div class="fav-precio">${fmtUSD(precio)}</div>
      <div style="font-size:10px;color:var(--dgray);margin-top:2px">Stock: ${stock}</div>
    </div>`;
      }).join('');
    }

    function quitarFavorito(cod) {
      const personales = FAVORITOS_PERSONALES[estado.usuario] || [];
      FAVORITOS_PERSONALES[estado.usuario] = personales.filter(c => c !== cod);
      renderFavoritos();
      guardarDatos();
      notif('Producto quitado de tus favoritos', 'warning');
    }

    function abrirGestorFavoritos() {
      renderFavManagerActuales();
      renderFavManagerDisponibles();
      document.getElementById('modal-favoritos').classList.add('show');
    }

    function cerrarGestorFavoritos() {
      document.getElementById('modal-favoritos').classList.remove('show');
      renderFavoritos();
    }

    function renderFavManagerActuales() {
      const cont = document.getElementById('fm-actuales');
      const { obligatorios, personales } = getFavoritosUsuario();
      const total = obligatorios.length + personales.length;
      document.getElementById('fm-cant').textContent = total;
      const todos = [...obligatorios.map(c => ({ cod: c, obligatorio: true })), ...personales.map(c => ({ cod: c, obligatorio: false }))];
      cont.innerHTML = todos.map(f => {
        const p = PRODUCTOS.find(x => x.cod_alt === f.cod);
        if (!p) return '';
        return `<div class="fav-manager-item">
      <div style="flex:1">
        ${f.obligatorio ? '<i class="ti ti-star-filled" style="color:var(--gold);font-size:11px;margin-right:4px"></i>' : ''}
        <strong style="font-size:11px">${p.cod_alt}</strong> <span style="color:var(--dgray);font-size:11px">${p.desc.substring(0, 30)}</span>
      </div>
      ${!f.obligatorio ? `<button onclick="quitarFavoritoManager('${p.cod_alt}')" style="color:var(--red)" title="Quitar">✕</button>` : '<span style="font-size:10px;color:var(--gold);font-weight:600">OBLIGATORIO</span>'}
    </div>`;
      }).join('');
    }

    function renderFavManagerDisponibles() {
      const cont = document.getElementById('fm-disponibles');
      const q = normalize(document.getElementById('fm-busqueda').value || '');
      const { obligatorios, personales } = getFavoritosUsuario();
      const yaFavoritos = new Set([...obligatorios, ...personales]);
      const disponibles = PRODUCTOS.filter(p => {
        if (yaFavoritos.has(p.cod_alt)) return false;
        if (!q) return true;
        return normalize(p.cod_alt + ' ' + p.desc + ' ' + p.marca).includes(q);
      }).slice(0, 30);
      cont.innerHTML = disponibles.map(p => `
    <div class="fav-manager-item">
      <div style="flex:1"><strong style="font-size:11px">${p.cod_alt}</strong> <span style="color:var(--dgray);font-size:11px">${p.desc.substring(0, 35)}</span></div>
      <button onclick="agregarFavoritoManager('${p.cod_alt}')" style="color:var(--green)" title="Agregar a favoritos">+</button>
    </div>`).join('');
      if (disponibles.length === 0) cont.innerHTML = '<div style="padding:20px;text-align:center;color:var(--dgray);font-size:12px">Sin productos disponibles</div>';
    }

    function agregarFavoritoManager(cod) {
      const personales = FAVORITOS_PERSONALES[estado.usuario] || (FAVORITOS_PERSONALES[estado.usuario] = []);
      const total = FAVORITOS_OBLIGATORIOS.length + personales.length;
      if (total >= 12) { notif('Ya tienes 12 favoritos. Quita alguno antes de agregar más.', 'warning'); return; }
      if (!personales.includes(cod)) personales.push(cod);
      renderFavManagerActuales();
      renderFavManagerDisponibles();
      guardarDatos();
      notif('Agregado a tus favoritos', 'success');
    }

    function quitarFavoritoManager(cod) {
      const personales = FAVORITOS_PERSONALES[estado.usuario] || [];
      FAVORITOS_PERSONALES[estado.usuario] = personales.filter(c => c !== cod);
      renderFavManagerActuales();
      renderFavManagerDisponibles();
      guardarDatos();
    }
