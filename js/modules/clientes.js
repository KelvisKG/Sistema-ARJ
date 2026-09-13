// === Clientes ===
    function renderClientes() {
      const tbody = document.getElementById('clientes-body');
      // Filtrar clientes por empresa activa (ambas siempre se ven)
      const filtrados = CLIENTES.filter(c => c.empresa === estado.empresa || c.empresa === 'ambas');
      renderPanelOrigen(filtrados);
      tbody.innerHTML = filtrados.map(c => {
        const cp = c.contacto_principal || { nombre: '—', cargo: '—' };
        const adicNum = (c.contactos_adicionales || []).length;
        const saldo = saldoCliente(c);
        const empresaBadge = c.empresa === 'ambas' ? '<span style="background:var(--lgold);color:#854F0B;padding:1px 6px;border-radius:8px;font-size:9.5px;font-weight:600;margin-left:4px">AMBAS</span>' : '';
        return `<tr onclick="abrirModalCliente(${c.id})" style="cursor:pointer">
      <td><strong>${c.nombre}</strong>${empresaBadge}</td>
      <td>${c.rif}</td>
      <td>${c.tel || '—'}</td>
      <td><div style="font-weight:600;color:#222">${cp.nombre}</div><div style="font-size:11px;color:var(--dgray)">${cp.cargo}${adicNum > 0 ? ` <span style="color:var(--blue)">+${adicNum} más</span>` : ''}</div></td>
      <td><span class="cliente-info">${TIER_NAMES[c.nivel]}</span></td>
      <td><span class="cliente-info ${c.tipo}">${c.tipo === 'credito' ? 'Crédito' : 'Contado'}</span></td>
      <td style="font-size:11.5px">${origenTxt(c)}</td>
      <td style="text-align:right">${saldo > 0 ? '<strong style="color:var(--red)">' + fmtUSD(saldo) + '</strong>' : '<span style="color:var(--green)">$ 0,00</span>'}</td>
    </tr>`;
      }).join('');
    }

    // v13.34: de donde vienen los clientes de la empresa activa.
    // Cuenta clientes captados, no ventas: es la medida de captacion, no de facturacion.
    function renderPanelOrigen(lista) {
      const cont = document.getElementById('clientes-origen-panel');
      if (!cont) return;
      const nuevos = lista.filter(c => (c.origen || '') !== 'historico' && (c.origen || '') !== '');
      const sinRegistrar = lista.filter(c => !c.origen).length;
      if (nuevos.length === 0) {
        cont.innerHTML = sinRegistrar > 0
          ? '<div style="font-size:11.5px;color:var(--dgray);background:#F7F7F7;border-radius:6px;padding:7px 10px">' +
          '<i class="ti ti-info-circle"></i> ' + sinRegistrar + ' cliente(s) sin origen registrado. Edítalos para completarlos.</div>'
          : '';
        return;
      }
      const porGrupo = {};
      nuevos.forEach(c => {
        const g = ORIGEN_GRUPO[c.origen] || 'Sin clasificar';
        porGrupo[g] = (porGrupo[g] || 0) + 1;
      });
      const total = nuevos.length;
      const orden = ['Digital', 'Boca a boca', 'Esfuerzo propio', 'Sin clasificar'].filter(g => porGrupo[g]);
      let barra = '<div style="display:flex;height:9px;border-radius:5px;overflow:hidden;margin-bottom:7px">';
      orden.forEach(g => {
        barra += '<div title="' + g + ': ' + porGrupo[g] + '" style="width:' + (porGrupo[g] / total * 100).toFixed(1) +
          '%;background:' + ORIGEN_COLOR[g] + '"></div>';
      });
      barra += '</div>';
      let chips = '<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px">';
      orden.forEach(g => {
        chips += '<span style="display:inline-flex;align-items:center;gap:5px">' +
          '<span style="width:9px;height:9px;border-radius:2px;background:' + ORIGEN_COLOR[g] + '"></span>' +
          '<strong>' + g + '</strong> ' + porGrupo[g] + ' (' + (porGrupo[g] / total * 100).toFixed(0) + '%)</span>';
      });
      if (sinRegistrar > 0) chips += '<span style="color:var(--dgray)">· ' + sinRegistrar + ' sin registrar</span>';
      chips += '</div>';
      cont.innerHTML = '<div class="card" style="margin:0;padding:10px 12px">' +
        '<div style="font-size:10.5px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:7px">' +
        'Cómo nos consiguieron · ' + total + ' cliente(s) registrados</div>' + barra + chips + '</div>';
    }


    function getClienteIdByName(nombre) {
      const c = CLIENTES.find(c => c.nombre === nombre);
      return c ? c.id : 0;
    }

    function abrirModalCliente(id, facturaResaltar) {
      const c = CLIENTES.find(x => x.id === id);
      if (!c) return;
      document.getElementById('mc-nombre').textContent = c.nombre;
      document.getElementById('mc-rif').textContent = 'RIF: ' + c.rif;
      const empresaTxt = c.empresa === 'ambas' ? '<span style="background:var(--lgold);color:#854F0B;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600">CLIENTE DE AMBAS EMPRESAS</span>' : c.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora';
      document.getElementById('mc-datos').innerHTML = `
    <div><strong>Teléfono:</strong> ${c.tel || '—'}</div>
    <div><strong>Tipo:</strong> ${c.tipo === 'credito' ? 'A crédito' : 'Contado'}</div>
    <div><strong>Nivel precio:</strong> ${TIER_NAMES[c.nivel]}</div>
    <div><strong>Empresa(s):</strong> ${empresaTxt}</div>
    <div><strong>Nos consiguió por:</strong> ${origenTxt(c)}${c.origen_detalle ? ' <span style="color:var(--dgray)">(' + c.origen_detalle + ')</span>' : ''}</div>`;

      // Saldos separados por empresa
      let saldoHTML = '';
      const sVD = c.saldo_vd || 0;
      const sDist = c.saldo_dist || 0;
      if (c.empresa === 'ambas') {
        saldoHTML = `
      <div><strong>Saldos por empresa:</strong></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
        <div style="background:#FFF;border-radius:5px;padding:6px 8px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--dgray);text-transform:uppercase">Venta Directa</div>
          <div style="font-size:15px;font-weight:700;color:${sVD > 0 ? 'var(--red)' : 'var(--green)'}">${fmtUSD(sVD)}</div>
        </div>
        <div style="background:#FFF;border-radius:5px;padding:6px 8px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--dgray);text-transform:uppercase">Distribuidora</div>
          <div style="font-size:15px;font-weight:700;color:${sDist > 0 ? 'var(--red)' : 'var(--green)'}">${fmtUSD(sDist)}</div>
        </div>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">
        <strong>Total adeudado:</strong> <span style="font-size:16px;font-weight:700;color:${(sVD + sDist) > 0 ? 'var(--red)' : 'var(--green)'}">${fmtUSD(sVD + sDist)}</span>
      </div>`;
      } else {
        const saldo = saldoCliente(c);
        saldoHTML = `
      <div><strong>Saldo deudor actual:</strong></div>
      <div style="font-size:22px;font-weight:700;color:${saldo > 0 ? 'var(--red)' : 'var(--green)'};margin:4px 0">${fmtUSD(saldo)}</div>
      <div style="font-size:11px;color:var(--dgray)">${saldo > 0 ? 'Tiene facturas pendientes' : 'Cliente al día'}</div>`;
      }
      document.getElementById('mc-saldo').innerHTML = saldoHTML;

      // Contactos
      const contCont = document.getElementById('mc-contactos');
      const cp = c.contacto_principal || { nombre: '—', cargo: '—', tel: '' };
      let html = `<div style="background:#FFF;border-radius:6px;padding:8px 10px;margin-bottom:6px;border-left:3px solid var(--navy)">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-weight:600;color:var(--navy);font-size:13px">${cp.nombre} <span style="background:var(--navy);color:#FFF;padding:1px 6px;border-radius:8px;font-size:10px;margin-left:4px">PRINCIPAL</span></div>
        <div style="font-size:11.5px;color:var(--dgray)">${cp.cargo} · <i class="ti ti-phone"></i> ${cp.tel || 'sin teléfono'}</div>
      </div>

    </div>
  </div>`;
      (c.contactos_adicionales || []).forEach(ca => {
        html += `<div style="background:#FFF;border-radius:6px;padding:8px 10px;margin-bottom:6px;border-left:3px solid var(--blue)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600;color:var(--navy);font-size:13px">${ca.nombre}</div>
          <div style="font-size:11.5px;color:var(--dgray)">${ca.cargo} · <i class="ti ti-phone"></i> ${ca.tel || 'sin teléfono'}</div>
        </div>

      </div>
    </div>`;
      });
      if ((c.contactos_adicionales || []).length === 0) {
        html += `<div style="font-size:12px;color:var(--dgray);font-style:italic;text-align:center;padding:6px">No hay contactos adicionales. Haz clic en "Agregar contacto".</div>`;
      }
      contCont.innerHTML = html;

      // Facturas pendientes (solo de la empresa activa, o todas si el gerente lo solicita)
      const facs = FACTURAS_COBRAR.filter(f => f.cliente === c.nombre);
      const facCont = document.getElementById('mc-facturas');
      if (facs.length === 0) {
        facCont.innerHTML = '<div style="font-size:12px;color:var(--green);font-style:italic;padding:6px">✓ Sin facturas pendientes</div>';
      } else {
        facCont.innerHTML = facs.map(f => {
          const saldo = f.total - f.abonado;
          const resaltar = facturaResaltar === f.num ? 'background:#FFF8E1;border:2px solid var(--gold)' : '';
          const empBadge = `<span style="background:${f.empresa === 'directa' ? 'var(--lblue)' : 'var(--lgreen)'};color:${f.empresa === 'directa' ? 'var(--blue)' : 'var(--green)'};padding:1px 5px;border-radius:6px;font-size:9.5px;font-weight:600;margin-left:4px">${f.empresa === 'directa' ? 'VD' : 'DT'}</span>`;
          return `<div style="display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--gray);font-size:12px;${resaltar}">
        <div>
          <div style="font-weight:600">${f.num}${empBadge}</div>
          <div style="font-size:11px;color:var(--dgray)">Emit: ${f.fecha} · Vence: ${f.vence}${f.estado === 'vencida' ? ' <span style="color:var(--red);font-weight:600">(VENCIDA)</span>' : ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;color:${f.estado === 'vencida' ? 'var(--red)' : 'var(--navy)'}">${fmtUSD(saldo)}</div>
          ${f.abonado > 0 ? `<div style="font-size:10.5px;color:var(--dgray)">Abonado: ${fmtUSD(f.abonado)}</div>` : ''}
        </div>
      </div>`;
        }).join('');
      }
      _clienteModalAbierto = c;
      document.getElementById('modal-cliente').classList.add('show');
    }

    // Cliente cuya ficha está abierta (para el botón Editar de esa ficha)
    let _clienteModalAbierto = null;
    function editarDesdeModalCliente() {
      if (!_clienteModalAbierto) { notif('No hay cliente abierto', 'error'); return; }
      const c = _clienteModalAbierto;
      cerrarModalCliente();
      abrirEditarCliente(c);
    }

    function cerrarModalCliente() {
      document.getElementById('modal-cliente').classList.remove('show');
    }

    // ═══════════════════════════════════════════════════════════════
    // RECEPCIÓN DE MERCANCÍA (v13.4)
    // Carga masiva de stock pegando "codigo cantidad". Existe porque cargar un
    // contenedor de ~250 renglones producto por producto son ~2,5 horas de clics,
    // y un error a mitad de camino no se detecta con nada.
    //
    // Regla de diseño: NADA se escribe hasta que el usuario vea el preview. El
    // paso de revision no es opcional ni se puede saltar.
    // ═══════════════════════════════════════════════════════════════
    let _recAnalisis = null;


    // v13.3: agregar contacto de verdad. Escribe en contactos_cliente y refresca
    // la ficha sin recargar toda la data.
    function agregarContactoDemo() { abrirNuevoContacto(); }

    function abrirNuevoContacto() {
      if (!_clienteModalAbierto) { notif('Abre primero la ficha de un cliente', 'error'); return; }
      document.getElementById('nc-cliente-nombre').textContent = _clienteModalAbierto.nombre;
      document.getElementById('nc-nombre').value = '';
      document.getElementById('nc-cargo').value = '';
      document.getElementById('nc-tel').value = '';
      document.getElementById('nc-principal').checked = false;
      document.getElementById('modal-nuevo-contacto').classList.add('show');
      setTimeout(() => document.getElementById('nc-nombre').focus(), 100);
    }
    function cerrarNuevoContacto() {
      document.getElementById('modal-nuevo-contacto').classList.remove('show');
    }

    async function guardarNuevoContacto() {
      const c = _clienteModalAbierto;
      if (!c) { notif('No hay cliente abierto', 'error'); return; }
      if (!_sb || !_supabaseConectado) { notif('Sin conexión: no se puede guardar', 'error'); return; }
      const nombre = (document.getElementById('nc-nombre').value || '').trim();
      const cargo = (document.getElementById('nc-cargo').value || '').trim();
      const tel = (document.getElementById('nc-tel').value || '').trim();
      const esPrincipal = document.getElementById('nc-principal').checked;
      if (!nombre) { notif('El nombre del contacto es obligatorio', 'error'); return; }
      if (!c.id) { notif('Este cliente todavía no está guardado en la base', 'error'); return; }

      const btn = document.getElementById('nc-guardar');
      if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

      // Si este pasa a ser el principal, los demas dejan de serlo. Sin esto la
      // ficha muestra dos principales y la carga inicial elige uno al azar.
      if (esPrincipal) {
        const { error: eDes } = await _sb.from('contactos_cliente')
          .update({ es_principal: false }).eq('cliente_id', c.id);
        if (eDes) console.error('[ARJ] Error quitando principal previo:', eDes);
      }

      const { error } = await _sb.from('contactos_cliente').insert({
        cliente_id: c.id, nombre, cargo, telefono: tel, es_principal: esPrincipal
      });

      if (btn) { btn.disabled = false; btn.textContent = 'Guardar contacto'; }

      if (error) {
        console.error('[ARJ] Error insertando contacto:', error);
        notif('Error guardando el contacto', 'error');
        return;
      }

      // Refresca el objeto en memoria para que la ficha muestre el cambio ya.
      if (esPrincipal) {
        if (c.contacto_principal && c.contacto_principal.nombre && c.contacto_principal.nombre !== '—') {
          c.contactos_adicionales = c.contactos_adicionales || [];
          c.contactos_adicionales.push({ ...c.contacto_principal });
        }
        c.contacto_principal = { nombre, cargo, tel };
      } else {
        c.contactos_adicionales = c.contactos_adicionales || [];
        c.contactos_adicionales.push({ nombre, cargo, tel });
      }

      cerrarNuevoContacto();
      cerrarModalCliente();
      abrirModalCliente(c.id);
      logBitacora('cliente', `Agregó contacto ${nombre} a ${c.nombre}`, false);
      notif('Contacto agregado', 'success');
    }


    // ═══════════════════════════════════════════════════════════════
    // v12: NUEVO CLIENTE RÁPIDO (desde facturación)
    // ═══════════════════════════════════════════════════════════════
    // Cliente que se está editando. null = estamos creando uno nuevo.
    let _clienteEditando = null;

    function abrirNuevoClienteRapido() {
      _clienteEditando = null;
      const t = document.getElementById('ncr-titulo');
      if (t) t.innerHTML = '<i class="ti ti-user-plus" style="color:var(--blue)"></i> Nuevo cliente';
      const b = document.getElementById('ncr-btn-guardar');
      if (b) b.innerHTML = '<i class="ti ti-check"></i> Crear y seleccionar';
      const nc = document.getElementById('ncr-canal'); if (nc) nc.disabled = false;
      const avN = document.getElementById('ncr-aviso-canal'); if (avN) avN.style.display = 'none';
      document.getElementById('modal-nuevo-cliente-rapido').classList.add('show');
      ['ncr-nombre', 'ncr-rif', 'ncr-tel', 'ncr-correo', 'ncr-direccion', 'ncr-contacto', 'ncr-cargo', 'ncr-notas'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      // Pre-seleccionar canal según la empresa activa
      const cnl = document.getElementById('ncr-canal'); if (cnl) cnl.value = estado.empresa || 'directa';
      const niv = document.getElementById('ncr-nivel'); if (niv) niv.value = 'Publico';
      const org = document.getElementById('ncr-origen'); if (org) org.value = '';
      const orgD = document.getElementById('ncr-origen-detalle'); if (orgD) orgD.value = '';
      ncrToggleOrigen();
      ncrToggleTier();
      const n = document.getElementById('ncr-nombre'); if (n) n.focus();
    }

    // Abrir el MISMO modal en modo edición, con los datos del cliente cargados.
    function abrirEditarCliente(cli) {
      if (!cli) { notif('Selecciona un cliente primero', 'error'); return; }
      _clienteEditando = cli;
      document.getElementById('modal-nuevo-cliente-rapido').classList.add('show');
      const t = document.getElementById('ncr-titulo');
      if (t) t.innerHTML = '<i class="ti ti-edit" style="color:var(--gold)"></i> Editar cliente';
      const b = document.getElementById('ncr-btn-guardar');
      if (b) b.innerHTML = '<i class="ti ti-device-floppy"></i> Guardar cambios';
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
      set('ncr-nombre', cli.nombre);
      set('ncr-rif', cli.rif);
      set('ncr-tel', cli.tel);
      set('ncr-direccion', cli.direccion);
      set('ncr-contacto', cli.contacto_principal ? cli.contacto_principal.nombre : '');
      set('ncr-cargo', cli.contacto_principal ? cli.contacto_principal.cargo : '');
      // El correo se guardó dentro de notas con el prefijo "Correo: "
      let correoTxt = cli.correo || '';
      let notasTxt = cli.notas || '';
      const m = notasTxt.match(/^Correo:\s*(.+)$/m);
      if (m) { if (!correoTxt) correoTxt = m[1].trim(); notasTxt = notasTxt.replace(/^Correo:\s*.+\n?/m, ''); }
      set('ncr-correo', correoTxt);
      set('ncr-notas', notasTxt.trim());
      const cnl = document.getElementById('ncr-canal');
      const avisoC = document.getElementById('ncr-aviso-canal');
      if (cnl) {
        cnl.value = cli.empresa || 'directa';
        // El canal define en qué saldo vive su deuda: cambiarlo con saldo abierto
        // descuadraría CxC. Se bloquea si el cliente ya debe algo.
        const debe = (cli.saldo_vd || 0) + (cli.saldo_dist || 0);
        cnl.disabled = debe > 0.009;
        if (avisoC) {
          if (cnl.disabled) {
            avisoC.style.display = 'block';
            avisoC.innerHTML = '<i class="ti ti-lock"></i> Canal bloqueado: debe ' + fmtUSD(debe) + '. Cóbrale el saldo para poder moverlo.';
          } else { avisoC.style.display = 'none'; }
        }
      }
      const niv = document.getElementById('ncr-nivel'); if (niv) niv.value = cli.nivel || 'Publico';
      const org = document.getElementById('ncr-origen'); if (org) org.value = cli.origen || '';
      const orgD = document.getElementById('ncr-origen-detalle'); if (orgD) orgD.value = cli.origen_detalle || '';
      ncrToggleOrigen();
      ncrToggleTier();
      const n = document.getElementById('ncr-nombre'); if (n) n.focus();
    }

    // Atajo desde la pantalla de facturación: edita el cliente del dropdown.
    function abrirEditarClienteActual() {
      const id = parseInt(document.getElementById('cliente-select')?.value);
      const cli = CLIENTES.find(c => c.id === id) || estado.cliente;
      if (!cli) { notif('Selecciona un cliente primero', 'error'); return; }
      abrirEditarCliente(cli);
    }
    function cerrarNuevoClienteRapido() { document.getElementById('modal-nuevo-cliente-rapido').classList.remove('show'); }

    // v13.34: el campo "detalle" solo aparece donde de verdad agrega informacion.
    // En referido es el que mas vale: sin el no puedes premiar a quien te refiere.
    const _ORIGEN_DETALLE = {
      'referido': ['¿Quién lo refirió?', 'Nombre del cliente que lo mandó'],
      'instagram': ['¿Qué publicación o reel?', 'Ej: reel de filtros New Holland'],
      'facebook': ['¿Qué publicación?', 'Ej: post de bombas de inyección'],
      'tiktok': ['¿Qué video?', 'Ej: video de rodamientos'],
      'feria': ['¿Cuál feria o evento?', 'Ej: Expo Agrícola Acarigua 2026'],
      'vendedor': ['¿Cuál vendedor?', 'Nombre del vendedor que lo captó'],
      'otro': ['Explica', 'Ej: nos vio en la valla de la vía']
    };
    function ncrToggleOrigen() {
      const v = document.getElementById('ncr-origen')?.value || '';
      const wrap = document.getElementById('ncr-origen-detalle-wrap');
      const lbl = document.getElementById('ncr-origen-detalle-lbl');
      const inp = document.getElementById('ncr-origen-detalle');
      if (!wrap) return;
      const cfg = _ORIGEN_DETALLE[v];
      if (cfg) {
        wrap.style.display = 'block';
        if (lbl) lbl.textContent = cfg[0];
        if (inp) inp.placeholder = cfg[1];
      } else {
        wrap.style.display = 'none';
        if (inp) inp.value = '';
      }
    }

    // Si canal es 'directa', el nivel se fuerza a Público y se deshabilita
    function ncrToggleTier() {
      const canal = document.getElementById('ncr-canal')?.value || 'directa';
      const niv = document.getElementById('ncr-nivel');
      const wrap = document.getElementById('ncr-tier-wrap');
      if (!niv) return;
      if (canal === 'directa') {
        niv.value = 'Publico';
        niv.disabled = true;
        if (wrap) wrap.style.opacity = '0.5';
      } else {
        niv.disabled = false;
        if (wrap) wrap.style.opacity = '1';
      }
    }

    async function guardarClienteRapido() {
      const nombre = (document.getElementById('ncr-nombre')?.value || '').trim();
      const rif = (document.getElementById('ncr-rif')?.value || '').trim();
      const tel = (document.getElementById('ncr-tel')?.value || '').trim();
      const correo = (document.getElementById('ncr-correo')?.value || '').trim();
      const direccion = (document.getElementById('ncr-direccion')?.value || '').trim();
      const contacto = (document.getElementById('ncr-contacto')?.value || '').trim();
      const cargo = (document.getElementById('ncr-cargo')?.value || '').trim();
      const canal = document.getElementById('ncr-canal')?.value || 'directa';
      const nivel = canal === 'directa' ? 'Publico' : (document.getElementById('ncr-nivel')?.value || 'Publico');
      const notasTxt = (document.getElementById('ncr-notas')?.value || '').trim();
      const origen = document.getElementById('ncr-origen')?.value || '';
      const origenDetalle = (document.getElementById('ncr-origen-detalle')?.value || '').trim();
      if (!nombre) { notif('El nombre es obligatorio', 'error'); return; }
      // v13.34: obligatorio. Si se deja opcional nadie lo llena y el campo
      // no sirve para nada. Los clientes viejos tienen la opcion 'historico'.
      if (!origen) {
        notif('Indica cómo nos consiguió el cliente. Si no lo sabes, usa "Anterior al registro".', 'error');
        const o = document.getElementById('ncr-origen'); if (o) { o.focus(); o.style.borderColor = 'var(--red)'; setTimeout(() => { o.style.borderColor = 'var(--border)'; }, 2500); }
        return;
      }
      // Construir notas con campos extra (correo va aquí para no requerir cambios en BD)
      let notasFinal = '';
      if (correo) notasFinal += 'Correo: ' + correo + '\n';
      if (notasTxt) notasFinal += notasTxt;

      // ── MODO EDICIÓN: actualizar el cliente existente ──
      if (_clienteEditando) {
        const c = _clienteEditando;
        const canalPrevio = c.empresa;
        // REGLA DE NEGOCIO (validada aquí, no en la UI): con saldo abierto el canal
        // no se puede mover. El deshabilitado del selector es solo un aviso visual;
        // esta es la verificación que de verdad manda.
        const debeTotal = (c.saldo_vd || 0) + (c.saldo_dist || 0);
        let canalFinal = canal;
        if (debeTotal > 0.009 && canal !== canalPrevio) {
          canalFinal = canalPrevio;
          notif('⚠ El canal NO se cambió: el cliente debe ' + fmtUSD(debeTotal) + '. Cobra el saldo primero.', 'error');
        }
        c.nombre = nombre.toUpperCase();
        c.rif = rif; c.tel = tel; c.direccion = direccion;
        c.correo = correo; c.notas = notasFinal;
        c.nivel = nivel; c.empresa = canalFinal;
        c.origen = origen; c.origen_detalle = origenDetalle;
        c.contacto_principal = { nombre: contacto || '—', cargo: cargo || '—', tel };
        // OJO: saldo_vd y saldo_dist NO se tocan. Se calculan de las facturas;
        // pisarlos aquí borraría lo que el cliente debe.
        await _sbGuardarCliente(c);
        llenarClientes();
        const selE = document.getElementById('cliente-select');
        if (selE) { selE.value = c.id; seleccionarCliente(); }
        cerrarNuevoClienteRapido();
        if (typeof renderClientes === 'function') { try { renderClientes(); } catch (e) { } }
        const cambioCanal = canalPrevio !== canalFinal ? ' (canal: ' + canalPrevio + ' → ' + canalFinal + ')' : '';
        logBitacora('cliente', 'Editó cliente: ' + c.nombre + cambioCanal, false);
        _sbLogBitacora(estado.usuario, estado.empresa, 'cliente', 'Editó cliente: ' + c.nombre + cambioCanal, false);
        notif('✓ Cliente actualizado: ' + c.nombre, 'success');
        _clienteEditando = null;
        return;
      }

      const nuevo = {
        nombre: nombre.toUpperCase(), rif, nivel, tipo: 'contado',
        saldo_vd: 0, saldo_dist: 0, tel, empresa: canal,
        direccion, notas: notasFinal, correo,
        origen, origen_detalle: origenDetalle,
        contacto_principal: { nombre: contacto || '—', cargo: cargo || '—', tel },
        contactos_adicionales: []
      };
      await _sbGuardarCliente(nuevo);
      CLIENTES.push(nuevo);
      llenarClientes();
      const sel = document.getElementById('cliente-select');
      if (sel) { for (let i = 0; i < sel.options.length; i++) { if (sel.options[i].text.includes(nombre.toUpperCase())) { sel.selectedIndex = i; seleccionarCliente(); break; } } }
      cerrarNuevoClienteRapido();
      logBitacora('cliente', 'Creó cliente: ' + nombre.toUpperCase() + ' (RIF: ' + (rif || '—') + ', Canal: ' + canal + ', Nivel: ' + nivel + ', Origen: ' + (ORIGEN_NAMES[origen] || origen) + ')', false);
      _sbLogBitacora(estado.usuario, estado.empresa, 'cliente', 'Creó cliente: ' + nombre.toUpperCase(), false);
      notif('✓ Cliente creado: ' + nombre.toUpperCase(), 'success');
    }