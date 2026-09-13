// === Cuentas por Cobrar ===
    // ═══ KPI "COBRADO MES" (CxC) — v13 ═══
    // Suma monto_usd de la tabla `pagos` del mes en curso, filtrado por empresa
    // activa y EXCLUYENDO pagos de facturas anuladas (regla de negocio: al anular
    // se devuelve el dinero al cliente, por lo tanto ese pago ya no es cobranza).
    async function renderCobradoMes() {
      const elVal = document.getElementById('kpi-cobrado-mes');
      const elSub = document.getElementById('kpi-cobrado-mes-sub');
      if (!elVal || !elSub) return;

      if (!_sb || !_supabaseConectado) {
        elVal.textContent = '—';
        elSub.textContent = 'sin conexión';
        return;
      }

      elVal.textContent = '…';
      elSub.textContent = 'calculando';

      // Si el usuario cambia de empresa mientras la consulta viaja, no pisamos el valor nuevo
      const empresaConsultada = estado.empresa;

      try {
        // 1) Rango del mes en curso (medianoche local → ISO UTC, correcto para Venezuela UTC-4)
        const hoy = new Date();
        const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
        const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1).toISOString();

        // 2) Pagos del mes (todas las empresas, todavía sin filtrar)
        const { data: pagosMes, error: e1 } = await _sb.from('pagos')
          .select('monto_usd, factura_id')
          .gte('fecha', desde)
          .lt('fecha', hasta);
        if (e1) throw e1;

        if (!pagosMes || pagosMes.length === 0) {
          if (estado.empresa !== empresaConsultada) return;
          elVal.textContent = fmtUSD(0);
          elSub.textContent = '0 pagos';
          return;
        }

        // 3) Empresa y estado de las facturas involucradas
        const ids = [...new Set(pagosMes.map(p => p.factura_id).filter(Boolean))];
        const { data: facts, error: e2 } = await _sb.from('facturas')
          .select('id, empresa, estado')
          .in('id', ids);
        if (e2) throw e2;

        const mapa = {};
        (facts || []).forEach(f => { mapa[f.id] = f; });

        // 4) Filtro: misma empresa + factura NO anulada
        let total = 0, cuenta = 0;
        pagosMes.forEach(p => {
          const f = mapa[p.factura_id];
          if (!f) return;
          if (f.empresa !== empresaConsultada) return;
          if (f.estado === 'anulada') return;
          total += parseFloat(p.monto_usd) || 0;
          cuenta++;
        });

        if (estado.empresa !== empresaConsultada) return;
        elVal.textContent = fmtUSD(total);
        elSub.textContent = cuenta + (cuenta === 1 ? ' pago' : ' pagos');

      } catch (err) {
        console.error('[ARJ] Error calculando Cobrado mes:', err);
        elVal.textContent = '—';
        elSub.textContent = 'error al calcular';
      }
    }

    function renderCobrar() {
      const c = document.getElementById('deudas-list');
      // FILTRO POR EMPRESA: solo facturas de la empresa actual
      const facturasFiltradas = FACTURAS_COBRAR.filter(f => f.empresa === estado.empresa);

      // Calcular KPIs dinámicos
      const total = facturasFiltradas.reduce((a, f) => a + (f.total - f.abonado), 0);
      const vencidas = facturasFiltradas.filter(f => f.estado === 'vencida');
      const totalVencidas = vencidas.reduce((a, f) => a + (f.total - f.abonado), 0);
      const porVencer = facturasFiltradas.filter(f => f.estado === 'por_vencer');
      const totalPV = porVencer.reduce((a, f) => a + (f.total - f.abonado), 0);
      const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      setText('kpi-cobrar-total', fmtUSD(total));
      setText('kpi-cobrar-total-sub', facturasFiltradas.length + ' factura(s)');
      setText('kpi-cobrar-vencidas', fmtUSD(totalVencidas));
      setText('kpi-cobrar-vencidas-sub', vencidas.length + ' factura(s)');
      setText('kpi-cobrar-porvencer', fmtUSD(totalPV));
      setText('kpi-cobrar-porvencer-sub', porVencer.length + ' factura(s)');

      // KPI "Cobrado mes" (consulta a Supabase, se resuelve aparte)
      renderCobradoMes();

      if (facturasFiltradas.length === 0) {
        c.innerHTML = '<div style="background:#FFF;border:1px solid var(--border);border-radius:8px;padding:40px;text-align:center;color:var(--dgray)"><i class="ti ti-check" style="font-size:36px;display:block;margin-bottom:8px;color:var(--green)"></i>Sin cuentas por cobrar en ' + nombreEmpresa(estado.empresa) + '.</div>';
        return;
      }
      // Factor con tasa del día (NO la congelada de la factura)
      c.innerHTML = facturasFiltradas.map(f => {
        const saldo = f.total - f.abonado;
        // v13.12: el factor sale de LA FACTURA (congelado al emitir), no del
        // global de hoy. La tasa BCV si es la del dia: anti-descapitalizacion.
        const saldoBsHoy = saldo * factorBsDe(f) * estado.tasa_bcv;
        let cls = f.estado, fechaTxt = '';
        if (f.estado === 'vencida') fechaTxt = `<i class="ti ti-alert-circle"></i> Venció ${f.vence} (${f.dias} días)`;
        else if (f.estado === 'por_vencer') fechaTxt = `<i class="ti ti-clock"></i> Vence ${f.vence} (en ${f.dias} días)`;
        else fechaTxt = `<i class="ti ti-calendar"></i> Vence ${f.vence} (en ${f.dias} días)`;
        const abonoTxt = f.abonado > 0 ? `<div class="deuda-abono">Abonado: ${fmtUSD(f.abonado)} de ${fmtUSD(f.total)}</div>` : '';
        return `<div class="deuda-row ${cls}" onclick="verDetalleFactura('${f.num}')" style="cursor:pointer">
      <div class="deuda-info-block">
        <span class="deuda-cliente">${f.cliente}</span>
        <span class="deuda-fecha ${f.estado === 'vencida' ? 'vencida' : ''}">${f.num} · ${fechaTxt}</span>
      </div>
      <div class="deuda-monto-block">
        <div class="deuda-monto">${fmtUSD(saldo)}</div>
        <div style="font-size:11px;color:var(--gold);font-weight:600">con resguardo ${fmtUSD(saldo * factorBsDe(f))} · ${fmtBS(saldoBsHoy)}</div>
        ${abonoTxt}
      </div>
      <div style="display:flex;gap:4px" onclick="event.stopPropagation()">
        <button class="btn btn-primary btn-sm" onclick="abrirAbono('${f.num}')" title="Registrar abono"><i class="ti ti-cash-banknote"></i></button>
        <button class="btn btn-gold btn-sm" onclick="abrirNotaCredito('${f.num}')" title="Nota de crédito"><i class="ti ti-receipt-refund"></i></button>
        <button class="btn btn-red btn-sm" onclick="abrirAnular('${f.num}','${f.cliente}')" title="Anular factura"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
      }).join('');
    }


    // ═══════════════════════════════════════════════════════════════
    // ESTADO DE CUENTA WHATSAPP
    // ═══════════════════════════════════════════════════════════════
    let clienteEC = null;
    function abrirEstadoCuenta() {
      // Tomar el cliente del modal actual
      const nombre = document.getElementById('mc-nombre').textContent;
      const cli = CLIENTES.find(c => c.nombre === nombre);
      if (!cli) { notif('Selecciona un cliente primero', 'error'); return; }
      clienteEC = cli;
      const facs = FACTURAS_COBRAR.filter(f => f.cliente === cli.nombre);
      let msg = `📋 *Estado de cuenta — ARJ Compañía Anónima*\n\n`;
      msg += `Estimado/a *${cli.nombre}*,\n\n`;
      msg += `A continuación su estado de cuenta al ${new Date().toLocaleDateString('es-VE')}:\n\n`;
      if (facs.length === 0) {
        msg += `✅ Sin facturas pendientes. ¡Gracias por estar al día!\n\n`;
      } else {
        msg += `*Facturas pendientes:*\n`;
        facs.forEach(f => {
          const saldo = f.total - f.abonado;
          const estado = f.estado === 'vencida' ? '⚠️ VENCIDA' : f.estado === 'por_vencer' ? '⏰ Por vencer' : '✓ Al día';
          msg += `\n${estado}\n• ${f.num}\n  Emitida: ${f.fecha} · Vence: ${f.vence}\n  Total: ${fmtUSD(f.total)}${f.abonado > 0 ? ` (abonado ${fmtUSD(f.abonado)})` : ''}\n  *Saldo: ${fmtUSD(saldo)}*\n`;
        });
        msg += `\n💰 *Total adeudado: ${fmtUSD(cli.saldo)}*\n`;
      }
      msg += `\n📞 Para coordinar pago contáctanos al 0255-622-4400`;
      msg += `\n🙏 Gracias por su preferencia.`;
      document.getElementById('ec-preview').textContent = msg;
      document.getElementById('modal-estado-cuenta').classList.add('show');
    }
    function cerrarEstadoCuenta() { document.getElementById('modal-estado-cuenta').classList.remove('show'); }
    function copiarMensaje() {
      const t = document.getElementById('ec-preview').textContent;
      navigator.clipboard.writeText(t).then(() => notif('Mensaje copiado al portapapeles', 'success'));
    }
    function enviarWhatsApp() {
      if (!clienteEC) { return; }
      const tel = (clienteEC.tel || '').replace(/[^\d]/g, '');
      const msg = document.getElementById('ec-preview').textContent;
      // Venezuela: 58 + número sin el primer 0
      const numWA = tel ? '58' + tel.replace(/^0/, '') : '';
      const url = `https://wa.me/${numWA}?text=${encodeURIComponent(msg)}`;
      logBitacora('cliente', `Envió estado de cuenta por WhatsApp a ${clienteEC.nombre} (${tel || 'sin tel'})`, false);
      notif('Abriendo WhatsApp...', 'success');
      // Simulado en demo: solo mostramos notif
      if (numWA) {
        window.open(url, '_blank');
      } else {
        notif('Este cliente no tiene teléfono registrado', 'error');
      }
      cerrarEstadoCuenta();
    }

    // ═══════════════════════════════════════════════════════════════
    // LOTE A — NUEVAS FUNCIONALIDADES
    // ═══════════════════════════════════════════════════════════════

    // ─── TABS DE BÚSQUEDA ───────────────────────────────────────