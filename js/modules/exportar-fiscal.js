// === Exportar Fiscal ===
    // ─── EXPORTACIÓN FISCAL ─────────────────────────────────────
    // v13.6: era demo (`const ventas = []`, siempre vacía). Ahora delega en
    // renderExportFiscal(), que lee de TODAS_FACTURAS y actualiza también los KPIs.
    function renderVentasPendientes() { renderExportFiscal(); }

    // ═══════════════════════════════════════════════════════════════
    // EXPORTACIÓN FISCAL (v13.6)
    // Genera dos CSV: uno de ventas (una línea por factura) y otro de detalle
    // (una línea por renglón), para cargar al sistema fiscal homologado.
    //
    // SOBRE LA TASA — leer antes de usar:
    // El sistema cobra en Bs a `tasa_bcv × factor_bs`, y factor_bs lleva el
    // colchón anti-devaluación, así que el Bs cobrado va por encima del BCV puro.
    // El libro fiscal normalmente se lleva a tasa BCV. Por eso el reporte trae
    // LAS DOS columnas y la diferencia: cuál usar lo decide el contador, no
    // este código.
    // ═══════════════════════════════════════════════════════════════

    function _fiscalRango(tipo) {
      if (tipo === 'dia') {
        const hoy = new Date();
        const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        const h2 = new Date(d.getTime() + 86400000);
        return { desde: d, hasta: h2, etq: 'del día ' + d.toLocaleDateString('es-VE') };
      }
      const dv = document.getElementById('exp-desde').value;
      const hv = document.getElementById('exp-hasta').value;
      if (!dv || !hv) { notif('Selecciona el rango de fechas', 'error'); return null; }
      const d = new Date(dv + 'T00:00:00');
      // +1 día para que el "hasta" sea inclusivo: si pides 01 al 15, el 15
      // completo tiene que entrar.
      const h2 = new Date(new Date(hv + 'T00:00:00').getTime() + 86400000);
      if (h2 <= d) { notif('El rango de fechas está al revés', 'error'); return null; }
      return { desde: d, hasta: h2, etq: 'del ' + d.toLocaleDateString('es-VE') + ' al ' + new Date(hv + 'T00:00:00').toLocaleDateString('es-VE') };
    }

    function _fiscalFacturas(desde, hasta) {
      return (TODAS_FACTURAS || []).filter(f => {
        if (!f.fecha_raw) return false;
        const d = new Date(f.fecha_raw);
        return d >= desde && d < hasta;
      }).sort((a, b) => new Date(a.fecha_raw) - new Date(b.fecha_raw));
    }

    async function generarReporteFiscal(tipo) {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede exportar al fiscal', 'error'); return; }
      if (!_sb || !_supabaseConectado) { notif('Sin conexión a la base de datos', 'error'); return; }

      const R = _fiscalRango(tipo);
      if (!R) return;
      const facts = _fiscalFacturas(R.desde, R.hasta);
      if (!facts.length) { notif('No hay facturas ' + R.etq, 'warning'); return; }

      notif('Preparando reporte...', 'warning');

      // Los renglones se traen de Supabase: TODAS_FACTURAS no los carga.
      const ids = facts.map(f => f.id).filter(x => x);
      let items = [];
      if (ids.length) {
        const { data, error } = await _sb.from('factura_items').select('*').in('factura_id', ids);
        if (error) { console.error('[ARJ] items fiscal:', error); notif('Error trayendo el detalle', 'error'); return; }
        items = data || [];
      }
      const porFactura = {};
      items.forEach(it => { (porFactura[it.factura_id] = porFactura[it.factura_id] || []).push(it); });

      // ── CSV 1: ventas ──
      const V = [];
      V.push(['LIBRO DE VENTAS — ARJ / FINARMA C.A.']);
      V.push(['RIF emisor', 'J-29620983-9']);
      V.push(['Período', R.etq]);
      V.push(['Generado', new Date().toLocaleString('es-VE'), 'por', estado.usuario]);
      V.push(['NOTA', 'IVA exento — Decreto 126, Art. 63, Num. 02']);
      V.push(['NOTA', 'Bs cobrado incluye colchon sobre BCV. Bs a BCV es la conversion oficial. Verificar con el contador cual corresponde.']);
      V.push([]);
      V.push(['Fecha', 'Numero', 'Empresa', 'RIF cliente', 'Cliente', 'Direccion', 'Vendedor',
        'Tipo pago', 'Estado', 'Pidio fiscal', 'Total USD', 'Tasa BCV', 'Factor Bs',
        'Total Bs cobrado', 'Total Bs a BCV', 'Diferencia Bs', 'Saldo pendiente USD']);

      let tUSD = 0, tBsCob = 0, tBsBcv = 0;
      facts.forEach(f => {
        const anulada = f.estado === 'anulada';
        const usd = anulada ? 0 : (f.total || 0);
        const tbcv = f.tasa_bcv || 0;
        const fac = (f.factor_bs != null && f.factor_bs > 0) ? parseFloat(f.factor_bs) : 1;
        const bsCob = usd * fac * tbcv;
        const bsBcv = usd * tbcv;
        tUSD += usd; tBsCob += bsCob; tBsBcv += bsBcv;
        V.push([
          f.fecha, f.num, f.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora',
          f.cliente_rif_snap || '', f.cliente_nombre_snap || f.cliente || '',
          f.cliente_dir_snap || '', f.vendedor || '',
          f.tipo_pago || '', (f.estado || '').toUpperCase(), f.pidio_fiscal ? 'SI' : 'no',
          usd.toFixed(2), tbcv.toFixed(2), fac.toFixed(4),
          bsCob.toFixed(2), bsBcv.toFixed(2), (bsCob - bsBcv).toFixed(2),
          (f.saldo_pendiente || 0).toFixed(2)
        ]);
      });
      V.push([]);
      V.push(['TOTALES (sin anuladas)', '', '', '', '', '', '', '', '', '',
        tUSD.toFixed(2), '', '', tBsCob.toFixed(2), tBsBcv.toFixed(2), (tBsCob - tBsBcv).toFixed(2), '']);

      // ── CSV 2: detalle por renglón ──
      const D = [];
      D.push(['DETALLE DE RENGLONES — ARJ / FINARMA C.A.']);
      D.push(['Periodo', R.etq]);
      D.push([]);
      D.push(['Fecha', 'Numero', 'Estado factura', 'Codigo', 'Descripcion', 'Cantidad',
        'Precio unit USD', 'Total linea USD', 'Total linea Bs cobrado', 'Total linea Bs a BCV']);
      facts.forEach(f => {
        const tbcv = f.tasa_bcv || 0;
        const fac = (f.factor_bs != null && f.factor_bs > 0) ? parseFloat(f.factor_bs) : 1;
        (porFactura[f.id] || []).forEach(it => {
          const tot = it.total_linea || 0;
          D.push([f.fecha, f.num, (f.estado || '').toUpperCase(), it.cod_alt, it.descripcion,
            it.cantidad, (it.precio_unitario || 0).toFixed(2), tot.toFixed(2),
            (tot * fac * tbcv).toFixed(2), (tot * tbcv).toFixed(2)]);
        });
      });

      const sufijo = tipo === 'dia' ? _hoyArchivo() : (document.getElementById('exp-desde').value + '_a_' + document.getElementById('exp-hasta').value);
      _descargarCSV('ARJ_fiscal_ventas_' + sufijo + '.csv', V);
      // Pausa breve: dos descargas seguidas pueden bloquearse en el navegador.
      setTimeout(() => _descargarCSV('ARJ_fiscal_detalle_' + sufijo + '.csv', D), 700);

      const detalle = `Exportó reporte fiscal ${R.etq}: ${facts.length} facturas, ${fmtUSD(tUSD)}`;
      logBitacora('inventario', detalle, true);
      _sbLogBitacora(estado.usuario, estado.empresa, 'inventario', detalle, true);
      try { localStorage.setItem('arj_ultimo_export', new Date().toISOString()); } catch (e) { }

      renderExportFiscal();
      notif(`${facts.length} facturas exportadas (2 archivos)`, 'success');
    }

    // KPIs y tabla de la pantalla fiscal — antes estaban en 0 fijo en el HTML.
    function renderExportFiscal() {
      const hoy = new Date();
      const d0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      const d1 = new Date(d0.getTime() + 86400000);
      const delDia = _fiscalFacturas(d0, d1).filter(f => f.estado !== 'anulada');
      const conF = delDia.filter(f => f.pidio_fiscal);
      const sinF = delDia.filter(f => !f.pidio_fiscal);
      const sum = a => a.reduce((x, f) => x + (f.total || 0), 0);

      const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      set('exp-kpi-nofiscal', sinF.length); set('exp-kpi-nofiscal-sub', fmtUSD(sum(sinF)));
      set('exp-kpi-fiscal', conF.length); set('exp-kpi-fiscal-sub', fmtUSD(sum(conF)));
      set('exp-resumen-dia', `${delDia.length} ventas · ${fmtUSD(sum(delDia))}`);

      let ultimo = null;
      try { ultimo = localStorage.getItem('arj_ultimo_export'); } catch (e) { }
      set('exp-kpi-ultimo', ultimo ? new Date(ultimo).toLocaleDateString('es-VE') : '—');
      set('exp-kpi-ultimo-sub', ultimo ? new Date(ultimo).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : 'aún sin reportes');

      // "Pendientes" = facturas emitidas después del último export.
      const corte = ultimo ? new Date(ultimo) : null;
      const pend = (TODAS_FACTURAS || []).filter(f =>
        f.estado !== 'anulada' && f.fecha_raw && (!corte || new Date(f.fecha_raw) > corte));
      set('kpi-pendientes-exp', pend.length);

      const tb = document.getElementById('ventas-pendientes-body');
      if (tb) {
        const lista = pend.slice(0, 40);
        tb.innerHTML = lista.length ? lista.map(f => `<tr>
      <td>${f.num}</td>
      <td>${f.fecha}</td>
      <td>${f.cliente_nombre_snap || f.cliente || ''}</td>
      <td>${f.vendedor || ''}</td>
      <td class="num">${fmtUSD(f.total || 0)}</td>
      <td>${f.pidio_fiscal ? '<span style="color:var(--navy);font-weight:600">SÍ</span>' : '<span style="color:var(--dgray)">no</span>'}</td>
      <td>${(f.estado || '').toUpperCase()}</td>
    </tr>`).join('')
          : '<tr><td colspan="7" style="text-align:center;color:var(--dgray);padding:16px">No hay ventas pendientes de exportar</td></tr>';
      }
    }

    // ─── ABRIR NUEVO PRODUCTO (solo gerente) ────────────────────