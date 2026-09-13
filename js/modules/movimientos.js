// === Movimientos de Caja ===

    // ═══════════════════════════════════════════════════════════════
    // MÓDULO MOVIMIENTOS — Entradas y Salidas de caja (v14)
    //
    // Regla central: esto mide PLATA, no ventas.
    //   · Las entradas por venta NO se teclean: se leen de `pagos`.
    //     Una factura de contado inserta su pago al emitirse; una factura
    //     a crédito no mueve la caja hasta que el cliente abone.
    //   · Las salidas y las entradas que no son venta (aporte de socio,
    //     préstamo, devolución de proveedor) se registran a mano aquí.
    //   · Nada se borra. Se anula con motivo (estado='anulado').
    //
    // `clasificacion` se guarda congelada en cada fila, no se recalcula:
    //   opex       → gasto del mes, entra al punto de equilibrio
    //   inventario → costo de mercancía / flete / aduana. YA está dentro
    //                del factor ×1,471. NUNCA sumarlo como gasto operativo
    //   capex      → activo que se deprecia (galpón, equipos)
    //   no_gasto   → movimiento de capital (aporte, préstamo, retiro)
    // ═══════════════════════════════════════════════════════════════

    const MOV_CAT_SALIDA = [
      { id: 'sueldos', label: 'Sueldos', clas: 'opex', hint: 'Gasto del mes' },
      { id: 'mercancia', label: 'Mercancía', clas: 'inventario', hint: 'Costo de mercancía — no es gasto del mes' },
      { id: 'flete_aduana', label: 'Flete y aduana', clas: 'inventario', hint: 'Ya va dentro del costo landed (×1,471)' },
      { id: 'construccion', label: 'Construcción y galpón', clas: 'capex', hint: 'Mejora del local — no es gasto del mes' },
      { id: 'equipos', label: 'Equipos', clas: 'capex', hint: 'Activo que se deprecia — no es gasto del mes' },
      { id: 'servicios', label: 'Servicios', clas: 'opex', hint: 'Gasto del mes' },
      { id: 'contador', label: 'Contador', clas: 'opex', hint: 'Gasto del mes' },
      { id: 'bancos', label: 'Bancos', clas: 'opex', hint: 'Comisiones bancarias — gasto del mes' },
      { id: 'retiro', label: 'Retiro del dueño', clas: 'no_gasto', hint: 'Movimiento de capital — no es gasto' },
      // v13.8: usada por las notas de crédito. No es gasto: es plata que el
      // cliente ya había pagado y se le regresa.
      { id: 'dev_cliente', label: 'Devolución a cliente', clas: 'no_gasto', hint: 'Nota de crédito — no es gasto' },
      { id: 'otros', label: 'Otros', clas: 'opex', hint: 'Gasto del mes' }
    ];

    const MOV_CAT_ENTRADA = [
      { id: 'aporte', label: 'Aporte de socio', clas: 'no_gasto', hint: 'Capital que entra — no es venta' },
      { id: 'prestamo', label: 'Préstamo', clas: 'no_gasto', hint: 'Pasivo — hay que devolverlo' },
      { id: 'dev_proveedor', label: 'Devolución de proveedor', clas: 'inventario', hint: 'Reduce el costo de la mercancía' },
      { id: 'venta_activo', label: 'Venta de un activo', clas: 'no_gasto', hint: 'Sale un bien, entra plata' },
      { id: 'otros_ing', label: 'Otros ingresos', clas: 'opex', hint: 'Ingreso que no viene de una factura' }
    ];

    let MOVIMIENTOS = [];
    let _movTipo = 'salida';
    let _movMoneda = 'Bs';
    let _movCat = null;
    let _movEmpresa = 'directa';
    let _movEmpresaPend = null;
    let _movAnularId = null;

    function movCatalogo() { return _movTipo === 'salida' ? MOV_CAT_SALIDA : MOV_CAT_ENTRADA; }

    function movInitMes() {
      const el = document.getElementById('mov-mes');
      if (el && !el.value) {
        const h = new Date();
        el.value = h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0');
      }
    }

    function movRango() {
      const v = (document.getElementById('mov-mes') || {}).value;
      const h = new Date();
      let y = h.getFullYear(), m = h.getMonth();
      if (v && /^\d{4}-\d{2}$/.test(v)) { y = parseInt(v.slice(0, 4), 10); m = parseInt(v.slice(5, 7), 10) - 1; }
      return {
        desde: new Date(y, m, 1).toISOString(),
        hasta: new Date(y, m + 1, 1).toISOString()
      };
    }

    // ── Carga: movimientos manuales + pagos (entradas automáticas) ──
    async function renderMovimientos() {
      const cont = document.getElementById('mov-list');
      if (!cont) return;

      if (!_sb || !_supabaseConectado) {
        cont.innerHTML = '<div class="card" style="text-align:center;color:var(--dgray);padding:24px">Sin conexión a la base de datos. Los movimientos no se pueden consultar sin internet.</div>';
        ['kpi-mov-entro', 'kpi-mov-salio', 'kpi-mov-saldo'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = '—'; });
        return;
      }

      cont.innerHTML = '<div class="card" style="text-align:center;color:var(--dgray);padding:24px">Cargando…</div>';
      const { desde, hasta } = movRango();
      const filtro = (document.getElementById('mov-filtro-emp') || {}).value || 'activa';
      const empresaConsultada = estado.empresa;

      try {
        // 1) Movimientos manuales
        const { data: movs, error: e1 } = await _sb.from('movimientos_caja')
          .select('*').gte('fecha', desde).lt('fecha', hasta).order('fecha', { ascending: false });
        if (e1) throw e1;

        // 2) Pagos del período (entradas automáticas)
        const { data: pagos, error: e2 } = await _sb.from('pagos')
          .select('id, factura_id, monto_usd, monto_bs, tasa_usada, metodo, referencia, fecha')
          .gte('fecha', desde).lt('fecha', hasta);
        if (e2) throw e2;

        // 3) Empresa y estado de las facturas de esos pagos
        let mapaFact = {};
        const ids = [...new Set((pagos || []).map(p => p.factura_id).filter(Boolean))];
        if (ids.length) {
          const { data: facts, error: e3 } = await _sb.from('facturas')
            .select('id, numero, empresa, estado, cliente_nombre_snap, cliente_nombre').in('id', ids);
          if (e3) throw e3;
          (facts || []).forEach(f => { mapaFact[f.id] = f; });
        }

        // Si el usuario cambió de empresa mientras la consulta viajaba, no pisamos nada
        if (estado.empresa !== empresaConsultada) return;

        // 4) Unificar en una sola lista
        const lista = [];

        (movs || []).forEach(m => lista.push({
          origen: 'manual', id: m.id, fecha: m.fecha, tipo: m.tipo, empresa: m.empresa,
          categoria: m.categoria, clasificacion: m.clasificacion, concepto: m.concepto,
          monto_usd: parseFloat(m.monto_usd) || 0, monto_bs: parseFloat(m.monto_bs) || 0,
          metodo: m.metodo || '', anulado: m.estado === 'anulado', motivo: m.anulado_motivo || '',
          afecta_caja: m.afecta_caja !== false,
          tasa_bcv_ref: parseFloat(m.tasa_bcv_ref) || 0
        }));

        (pagos || []).forEach(p => {
          const f = mapaFact[p.factura_id];
          if (!f) return;
          if (f.estado === 'anulada') return;   // la anulación ya generó su pago negativo
          const usd = parseFloat(p.monto_usd) || 0;
          const cliente = f.cliente_nombre_snap || f.cliente_nombre || 'Cliente';
          lista.push({
            origen: 'auto', id: 'p' + p.id, fecha: p.fecha, tipo: usd >= 0 ? 'entrada' : 'salida',
            empresa: f.empresa, categoria: usd >= 0 ? 'Cobro de factura' : 'Devolución por anulación',
            clasificacion: 'venta',
            concepto: (f.numero || '') + ' · ' + cliente + (p.referencia ? ' · ' + p.referencia : ''),
            monto_usd: Math.abs(usd), monto_bs: Math.abs(parseFloat(p.monto_bs) || 0),
            metodo: p.metodo || '', anulado: false, motivo: '', afecta_caja: true
          });
        });

        // 5) Filtro por empresa
        const pasa = (m) => {
          if (filtro === 'todas') return true;
          if (filtro === 'activa') return m.empresa === estado.empresa || m.empresa === 'ambas';
          return m.empresa === filtro;
        };
        MOVIMIENTOS = lista.filter(pasa).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        movPintar();

      } catch (err) {
        console.error('[ARJ] Error cargando movimientos:', err);
        cont.innerHTML = '<div class="card" style="text-align:center;color:var(--red);padding:24px">No se pudieron cargar los movimientos.</div>';
      }
    }

    function movPintar() {
      const cont = document.getElementById('mov-list');
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

      // KPIs — solo lo que afecta caja y no está anulado
      let entro = 0, salio = 0, nE = 0, nS = 0;
      // v13.7: el total de "Salió" mezclaba sueldos con compra de mercancía y con
      // el retiro del dueño. Salir de caja y ser gasto son cosas distintas:
      // comprar inventario baja la caja pero no la utilidad. Se desglosa.
      const cls = { opex: 0, inventario: 0, capex: 0, no_gasto: 0 };
      MOVIMIENTOS.forEach(m => {
        if (m.anulado || !m.afecta_caja) return;
        if (m.tipo === 'entrada') { entro += m.monto_usd; nE++; }
        else {
          salio += m.monto_usd; nS++;
          // Sin clasificación (movimientos viejos) cae en opex: es el supuesto
          // conservador — cuenta como gasto y no infla la utilidad.
          const c = cls[m.clasificacion] !== undefined ? m.clasificacion : 'opex';
          cls[c] += m.monto_usd;
        }
      });
      const saldo = entro - salio;
      set('kpi-mov-entro', fmtUSD(entro));
      set('kpi-mov-entro-sub', nE + (nE === 1 ? ' movimiento' : ' movimientos'));
      set('kpi-mov-salio', fmtUSD(salio));
      set('kpi-mov-salio-sub', nS + (nS === 1 ? ' movimiento' : ' movimientos'));
      set('kpi-mov-saldo', fmtUSD(saldo));
      const elSaldo = document.getElementById('kpi-mov-saldo');
      if (elSaldo) elSaldo.style.color = saldo < 0 ? 'var(--red)' : 'var(--navy)';

      // Desglose de salidas
      const card = document.getElementById('mov-desglose-card');
      if (card) card.style.display = salio > 0 ? '' : 'none';
      ['opex', 'inventario', 'capex', 'no_gasto'].forEach(k => set('mov-cls-' + k, fmtUSD(cls[k])));
      const nota = document.getElementById('mov-desglose-nota');
      if (nota) {
        const noGasto = cls.inventario + cls.capex + cls.no_gasto;
        nota.innerHTML = (salio > 0 && noGasto > 0)
          ? `<div style="background:var(--lgreen);border-left:3px solid var(--green);border-radius:6px;padding:9px 12px;font-size:11.5px;color:#1B5E20">
        <i class="ti ti-info-circle"></i> De los <strong>${fmtUSD(salio)}</strong> que salieron de caja, solo <strong>${fmtUSD(cls.opex)}</strong> son gasto que baja la utilidad. Los otros ${fmtUSD(noGasto)} siguen siendo tuyos: están en mercancía, en el local o se los llevó el dueño.
      </div>`
          : '';
      }

      if (MOVIMIENTOS.length === 0) {
        cont.innerHTML = '<div class="card" style="text-align:center;color:var(--dgray);padding:28px"><i class="ti ti-inbox" style="font-size:28px;display:block;margin-bottom:8px;opacity:.5"></i>Sin movimientos en este período.</div>';
        return;
      }

      const badgeEmp = (e) => {
        if (e === 'ambas') return '<span style="background:var(--lgold);color:#854F0B;padding:1px 6px;border-radius:8px;font-size:9.5px;font-weight:600;margin-left:5px">AMBAS</span>';
        if (e === 'directa') return '<span style="background:var(--lblue);color:var(--blue);padding:1px 5px;border-radius:6px;font-size:9.5px;font-weight:600;margin-left:5px">VD</span>';
        return '<span style="background:var(--lgreen);color:var(--green);padding:1px 5px;border-radius:6px;font-size:9.5px;font-weight:600;margin-left:5px">DT</span>';
      };

      cont.innerHTML = '<div class="card" style="padding:0;overflow:hidden">' + MOVIMIENTOS.map(m => {
        const esEnt = m.tipo === 'entrada';
        const color = m.anulado ? 'var(--dgray)' : (esEnt ? 'var(--green)' : 'var(--red)');
        const tach = m.anulado ? 'text-decoration:line-through;opacity:.6' : '';
        const fecha = new Date(m.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
        const auto = m.origen === 'auto'
          ? '<span style="background:var(--sky);color:var(--blue);padding:1px 6px;border-radius:8px;font-size:9.5px;font-weight:600;margin-left:5px">AUTO</span>' : '';
        const btnAnular = (m.origen === 'manual' && !m.anulado)
          ? `<button class="btn btn-secondary btn-sm" style="padding:3px 7px;font-size:10px;color:var(--red);margin-left:8px" onclick="abrirMovAnular(${m.id})" title="Anular"><i class="ti ti-file-x"></i></button>` : '';
        return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid var(--gray)">
          <div style="flex:1;min-width:0;${tach}">
            <div style="font-size:12.5px;font-weight:600;color:var(--text)">${m.concepto}${badgeEmp(m.empresa)}${auto}</div>
            <div style="font-size:10.5px;color:var(--dgray)">${fecha} · ${m.categoria}${m.metodo ? ' · ' + m.metodo : ''}${m.anulado ? ' · ANULADO: ' + m.motivo : ''}</div>
          </div>
          <div style="text-align:right;${tach}">
            <div style="font-size:13.5px;font-weight:700;color:${color};white-space:nowrap">${esEnt ? '+' : '−'}${fmtUSD(m.monto_usd)}</div>
            <div style="font-size:10px;color:var(--dgray);white-space:nowrap">${fmtBS(m.monto_bs)}${m.tasa_bcv_ref > 0 ? ' · ' + fmtUSD(m.monto_bs / m.tasa_bcv_ref) + ' BCV' : ''}</div>
          </div>
          ${btnAnular}
        </div>`;
      }).join('') + '</div>';
    }

    // ── Modal de registro ──
    function abrirModalMovimiento(tipo) {
      if (estado.rol !== 'gerente') { notif('Solo el gerente registra movimientos de caja', 'error'); return; }
      _movTipo = tipo;
      _movMoneda = 'Bs';
      _movCat = null;
      _movEmpresa = estado.empresa;

      document.getElementById('mov-modal-tit').innerHTML = tipo === 'salida'
        ? '<i class="ti ti-arrow-up-right"></i> Registrar salida'
        : '<i class="ti ti-arrow-down-left"></i> Registrar entrada';

      document.getElementById('mov-monto').value = '';
      document.getElementById('mov-concepto').value = '';
      document.getElementById('mov-fecha').value = new Date().toISOString().slice(0, 10);
      document.getElementById('mov-cat-hint').innerHTML = '&nbsp;';
      document.getElementById('mov-conversion').innerHTML = '&nbsp;';

      if (tipo === 'entrada') {
        document.getElementById('mov-cat-hint').innerHTML =
          '<i class="ti ti-info-circle"></i> Los cobros de factura entran solos. Esto es para lo que <strong>no</strong> es venta.';
      }

      // Fichas de categoría
      document.getElementById('mov-cats').innerHTML = movCatalogo().map(c =>
        `<button type="button" class="mov-chip" id="mov-cat-${c.id}" onclick="movSetCategoria('${c.id}')">${c.label}</button>`
      ).join('');

      movSetMoneda('Bs');
      movPintarEmpresa();
      document.getElementById('modal-movimiento').classList.add('show');
      setTimeout(() => document.getElementById('mov-monto').focus(), 80);
    }

    function cerrarModalMovimiento() {
      document.getElementById('modal-movimiento').classList.remove('show');
    }

    function movSetMoneda(m) {
      _movMoneda = m;
      document.getElementById('mov-simbolo').textContent = m === 'Bs' ? 'Bs' : '$';
      const on = { background: 'var(--navy)', color: '#FFF' };
      const off = { background: 'transparent', color: 'var(--dgray)' };
      const bs = document.getElementById('mov-mon-bs'), usd = document.getElementById('mov-mon-usd');
      Object.assign(bs.style, m === 'Bs' ? on : off);
      Object.assign(usd.style, m === 'USD' ? on : off);
      movCalcular();
    }

    function movCalcular() {
      const raw = parseFloat(document.getElementById('mov-monto').value) || 0;
      const el = document.getElementById('mov-conversion');
      if (raw <= 0) { el.innerHTML = '&nbsp;'; return; }
      const tp = estado.tasa_par, tb = estado.tasa_bcv;
      // El registro SIEMPRE se guarda valorado a paralela (el dolar que repones
      // lo compras a paralela). El BCV se muestra solo como referencia fiscal.
      const usdPar = _movMoneda === 'USD' ? raw : raw / tp;
      const bs = _movMoneda === 'Bs' ? raw : raw * tp;
      const usdBcv = tb > 0 ? bs / tb : 0;
      const fmtT = (n) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      el.innerHTML =
        '<strong>Se guarda: ' + fmtUSD(usdPar) + '</strong> &nbsp;·&nbsp; ' + fmtBS(bs) +
        '<br><span style="color:var(--dgray)">Paralela ' + fmtT(tp) + ' &nbsp;·&nbsp; al BCV (' + fmtT(tb) + ') seria ' + fmtUSD(usdBcv) + '</span>';
    }

    function movSetCategoria(id) {
      _movCat = movCatalogo().find(c => c.id === id) || null;
      movCatalogo().forEach(c => {
        const b = document.getElementById('mov-cat-' + c.id);
        if (b) b.classList.toggle('on', c.id === id);
      });
      const h = document.getElementById('mov-cat-hint');
      h.innerHTML = _movCat ? '<i class="ti ti-info-circle"></i> ' + _movCat.hint : '&nbsp;';
    }

    // ── Selector de empresa con advertencia ──
    function movPintarEmpresa() {
      ['directa', 'dist', 'ambas'].forEach(e => {
        const b = document.getElementById('mov-emp-' + e);
        if (b) b.classList.toggle('on', e === _movEmpresa);
      });
      const h = document.getElementById('mov-emp-hint');
      if (_movEmpresa === 'ambas') {
        h.innerHTML = '<i class="ti ti-info-circle"></i> Costo compartido — se reparte después entre las dos empresas.';
      } else if (_movEmpresa !== estado.empresa) {
        h.innerHTML = '<span style="color:var(--gold)"><i class="ti ti-alert-triangle"></i> Distinta a la empresa donde estás trabajando.</span>';
      } else {
        h.innerHTML = '&nbsp;';
      }
    }

    function movSetEmpresa(emp) {
      // Advertencia solo cuando se elige la empresa CONTRARIA a la activa.
      // "Ambas" no advierte: es un gasto compartido legítimo, no un error.
      if (emp !== 'ambas' && emp !== estado.empresa) {
        _movEmpresaPend = emp;
        document.getElementById('mov-warn-tit').textContent = 'Estás en ' + nombreEmpresa(estado.empresa);
        document.getElementById('mov-warn-dest').textContent = nombreEmpresa(emp);
        document.getElementById('mov-warn-ok').textContent = 'Sí, es de ' + nombreEmpresa(emp);
        document.getElementById('modal-mov-empresa').classList.add('show');
        return;
      }
      _movEmpresa = emp;
      movPintarEmpresa();
    }

    function movCancelarEmpresa() {
      _movEmpresaPend = null;
      document.getElementById('modal-mov-empresa').classList.remove('show');
    }

    function movConfirmarEmpresa() {
      if (_movEmpresaPend) _movEmpresa = _movEmpresaPend;
      _movEmpresaPend = null;
      document.getElementById('modal-mov-empresa').classList.remove('show');
      movPintarEmpresa();
    }

    // ── Guardar ──
    async function guardarMovimiento() {
      // Las reglas se validan ACÁ, en la función que guarda, no en la interfaz.
      if (estado.rol !== 'gerente') { notif('Solo el gerente registra movimientos de caja', 'error'); return; }
      if (!_sb || !_supabaseConectado) { notif('Sin conexión: no se puede guardar el movimiento', 'error'); return; }

      const raw = parseFloat(document.getElementById('mov-monto').value) || 0;
      if (raw <= 0) { notif('Escribe cuánto entró o salió', 'error'); return; }
      if (!_movCat) { notif('Elige en qué fue el movimiento', 'error'); return; }

      const concepto = (document.getElementById('mov-concepto').value || '').trim();
      if (!concepto) { notif('Escribe a quién o para qué', 'error'); return; }

      const fechaStr = document.getElementById('mov-fecha').value;
      if (!fechaStr) { notif('Falta la fecha', 'error'); return; }

      if (!['directa', 'dist', 'ambas'].includes(_movEmpresa)) { notif('Empresa inválida', 'error'); return; }
      if (!['opex', 'inventario', 'capex', 'no_gasto'].includes(_movCat.clas)) { notif('Clasificación inválida', 'error'); return; }

      const t = estado.tasa_par;
      const montoUSD = _movMoneda === 'USD' ? raw : raw / t;
      const montoBs = _movMoneda === 'Bs' ? raw : raw * t;

      // Mediodía local: evita que la fecha se corra un día al convertir a UTC
      const fechaISO = new Date(fechaStr + 'T12:00:00').toISOString();

      const btn = document.getElementById('mov-btn-guardar');
      btn.disabled = true;

      try {
        const { error } = await _sb.from('movimientos_caja').insert({
          fecha: fechaISO,
          tipo: _movTipo,
          empresa: _movEmpresa,
          categoria: _movCat.label,
          clasificacion: _movCat.clas,
          concepto: concepto,
          monto_usd: Math.round(montoUSD * 100) / 100,
          monto_bs: Math.round(montoBs * 100) / 100,
          tasa_usada: t,
          tasa_bcv_ref: estado.tasa_bcv,
          moneda_origen: _movMoneda,
          metodo: document.getElementById('mov-metodo').value,
          afecta_caja: true,
          estado: 'activo',
          registrado_por: estado.usuario || 'Sistema'
        });
        if (error) throw error;

        _sbLogBitacora(estado.usuario, _movEmpresa, 'caja',
          (_movTipo === 'salida' ? 'Registró salida ' : 'Registró entrada ') +
          fmtUSD(montoUSD) + ' — ' + _movCat.label + ' — ' + concepto, false);

        notif(_movTipo === 'salida' ? 'Salida registrada' : 'Entrada registrada', 'success');
        cerrarModalMovimiento();
        renderMovimientos();

      } catch (err) {
        console.error('[ARJ] Error guardando movimiento:', err);
        notif('No se pudo guardar: ' + (err.message || 'error desconocido'), 'error');
      } finally {
        btn.disabled = false;
      }
    }

    // ── Anulación (nunca DELETE) ──
    function abrirMovAnular(id) {
      const m = MOVIMIENTOS.find(x => x.id === id);
      if (!m) return;
      _movAnularId = id;
      document.getElementById('mov-anular-info').textContent =
        m.concepto + ' · ' + m.categoria + ' · ' + fmtUSD(m.monto_usd);
      document.getElementById('mov-anular-motivo').value = '';
      document.getElementById('modal-mov-anular').classList.add('show');
    }

    function cerrarMovAnular() {
      _movAnularId = null;
      document.getElementById('modal-mov-anular').classList.remove('show');
    }

    async function confirmarMovAnular() {
      const motivo = (document.getElementById('mov-anular-motivo').value || '').trim();
      if (!motivo) { notif('El motivo es obligatorio', 'error'); return; }
      if (!_movAnularId) return;
      try {
        const { error } = await _sb.from('movimientos_caja')
          .update({ estado: 'anulado', anulado_motivo: motivo })
          .eq('id', _movAnularId);
        if (error) throw error;
        _sbLogBitacora(estado.usuario, estado.empresa, 'caja',
          'Anuló movimiento de caja #' + _movAnularId + ' — ' + motivo, true);
        notif('Movimiento anulado', 'success');
        cerrarMovAnular();
        renderMovimientos();
      } catch (err) {
        console.error('[ARJ] Error anulando movimiento:', err);
        notif('No se pudo anular: ' + (err.message || 'error'), 'error');
      }
    }
