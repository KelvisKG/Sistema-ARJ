// === Notas de Credito ===
    async function abrirNotaCredito(num) {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede emitir notas de crédito', 'error'); return; }
      if (!_sb || !_supabaseConectado) { notif('Sin conexión a la base de datos', 'error'); return; }

      const f = TODAS_FACTURAS.find(x => x.num === num);
      if (!f) { notif('Factura no encontrada', 'error'); return; }
      if (f.estado === 'anulada') { notif('No se puede acreditar una factura anulada', 'error'); return; }

      facturaNC = f;
      ncItems = [];
      document.getElementById('nc-info').textContent = `${f.num} · ${f.cliente_nombre_snap || f.cliente} · cargando…`;
      document.getElementById('nc-items').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--dgray)">Cargando renglones…</td></tr>';
      document.getElementById('nc-motivo').value = '';
      document.getElementById('nc-destino-wrap').style.display = 'none';
      document.getElementById('modal-nota-credito').classList.add('show');

      const { data: items, error } = await _sb.from('factura_items').select('*').eq('factura_id', f.id);
      if (error || !items || !items.length) {
        console.error('[ARJ] items NC:', error);
        document.getElementById('nc-items').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--red)">No se pudieron cargar los renglones de esta factura</td></tr>';
        return;
      }

      // Notas de crédito anteriores sobre esta misma factura: hay que restarlas
      // para no permitir devolver dos veces lo mismo.
      const { data: pagosPrev } = await _sb.from('pagos').select('referencia, monto_usd')
        .eq('factura_id', f.id).lt('monto_usd', 0);
      const yaDev = {};
      (pagosPrev || []).forEach(pg => {
        const m = /NC:([^|]+)\|/.exec(pg.referencia || '');
        if (!m) return;
        m[1].split(';').forEach(par => {
          const [cod, cant] = par.split('=');
          if (cod) yaDev[cod] = (yaDev[cod] || 0) + (parseInt(cant, 10) || 0);
        });
      });

      ncItems = items.map(it => ({
        producto_id: it.producto_id,
        cod: it.cod_alt,
        desc: it.descripcion,
        cantFacturada: it.cantidad,
        yaDevuelto: yaDev[it.cod_alt] || 0,
        precio: it.precio_unitario || 0,
        devolver: 0
      }));

      const abon = f.abonado || 0;
      document.getElementById('nc-info').textContent =
        `${f.num} · ${f.cliente_nombre_snap || f.cliente} · ${fmtUSD(f.total || 0)} · abonado ${fmtUSD(abon)}`;
      renderNCItems();
    }

    function renderNCItems() {
      const tbody = document.getElementById('nc-items');
      tbody.innerHTML = ncItems.map((it, i) => {
        const disp = it.cantFacturada - it.yaDevuelto;
        return `<tr${disp <= 0 ? ' style="opacity:.5"' : ''}>
      <td><strong>${it.cod}</strong><div style="font-size:11px;color:var(--dgray)">${it.desc || ''}</div></td>
      <td class="num">${it.cantFacturada}</td>
      <td class="num">${it.yaDevuelto > 0 ? '<span style="color:var(--gold);font-weight:600">' + it.yaDevuelto + '</span>' : '—'}</td>
      <td class="num">${fmtUSD(it.precio)}</td>
      <td class="num">${disp > 0
            ? `<input type="number" min="0" max="${disp}" value="${it.devolver}" onchange="actualizarNCItem(${i},this.value)" style="width:70px;padding:4px 8px;text-align:right;border:1px solid var(--border);border-radius:5px;font-family:inherit">`
            : '<span style="font-size:11px;color:var(--dgray)">devuelto</span>'}</td>
      <td class="num"><strong style="color:var(--gold)">${fmtUSD(it.devolver * it.precio)}</strong></td>
    </tr>`;
      }).join('');
      recalcularNC();
    }

    function actualizarNCItem(i, v) {
      const it = ncItems[i];
      const disp = it.cantFacturada - it.yaDevuelto;
      it.devolver = Math.max(0, Math.min(parseInt(v) || 0, disp));
      renderNCItems();
    }

    function recalcularNC() {
      const tot = ncItems.reduce((a, it) => a + it.devolver * it.precio, 0);
      document.getElementById('nc-total').textContent = fmtUSD(tot);
      // El selector de destino solo aparece si no hay saldo pendiente que
      // absorba el crédito: ahí sí hay que decidir a dónde va la plata.
      const saldo = facturaNC ? (facturaNC.saldo_pendiente || 0) : 0;
      const wrap = document.getElementById('nc-destino-wrap');
      if (wrap) wrap.style.display = (tot > 0.009 && saldo < 0.01) ? '' : 'none';
    }

    function cerrarNotaCredito() {
      document.getElementById('modal-nota-credito').classList.remove('show');
      facturaNC = null; ncItems = [];
    }

    async function confirmarNotaCredito() {
      if (!facturaNC) return;
      const motivo = document.getElementById('nc-motivo').value.trim();
      const dev = ncItems.filter(it => it.devolver > 0);
      const totDev = dev.reduce((a, it) => a + it.devolver, 0);
      const tot = dev.reduce((a, it) => a + it.devolver * it.precio, 0);

      if (totDev === 0) { notif('Indica cuántas unidades devuelve el cliente', 'error'); return; }
      if (!motivo) { notif('Indica el motivo de la devolución', 'error'); return; }
      if (!_sb || !_supabaseConectado) { notif('Sin conexión: no se puede emitir', 'error'); return; }

      const f = facturaNC;
      const saldoAntes = f.saldo_pendiente || 0;
      // El crédito primero cancela lo que el cliente aún debe. Solo el sobrante
      // se le devuelve o le queda a favor.
      const aplicaSaldo = Math.min(tot, saldoAntes);
      const sobrante = tot - aplicaSaldo;
      const destino = sobrante > 0.009
        ? (document.getElementById('nc-destino').value || 'favor') : 'favor';

      let msg = `NOTA DE CRÉDITO sobre ${f.num}\n\n${totDev} unidad(es) · ${fmtUSD(tot)}\n\n`;
      msg += `El stock de esos productos vuelve a ${f.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora'}.\n\n`;
      if (aplicaSaldo > 0.009) msg += `Baja ${fmtUSD(aplicaSaldo)} del saldo pendiente.\n`;
      if (sobrante > 0.009) msg += destino === 'efectivo'
        ? `Se devuelven ${fmtUSD(sobrante)} en efectivo (sale de caja).\n` : `Quedan ${fmtUSD(sobrante)} a favor del cliente.\n`;
      msg += '\nEsto no se puede deshacer. ¿Emitir?';
      if (!confirm(msg)) return;

      const btn = document.getElementById('nc-btn-emitir');
      btn.disabled = true; btn.textContent = 'Emitiendo...';

      try {
        // 1. Stock de vuelta al almacén de la empresa de la factura.
        // v13.33 El local solo se toca si la base confirmo, para no mostrar un
        // stock que la base no tiene.
        const campoStock = f.empresa === 'directa' ? 'stock_vd' : 'stock_dist';
        const _ncStockFallo = [];
        for (const it of dev) {
          if (!it.producto_id) continue;
          const { data: prod } = await _sb.from('productos').select(campoStock).eq('id', it.producto_id).single();
          if (!prod) continue;
          const nuevo = (prod[campoStock] || 0) + it.devolver;
          const { error: ncStkErr } = await _sb.from('productos')
            .update({ [campoStock]: nuevo }).eq('id', it.producto_id);
          if (ncStkErr) {
            console.error('[ARJ] NC: error devolviendo stock de ' + it.cod + ':', ncStkErr);
            _ncStockFallo.push(it.cod);
            continue;
          }
          const pl = PRODUCTOS.find(p => p.id === it.producto_id);
          if (pl) pl[campoStock] = nuevo;
        }
        if (_ncStockFallo.length > 0) {
          notif('\u26a0 El stock NO volvio de: ' + _ncStockFallo.join(', ') + '. Ajustalo en Inventario.', 'error');
        }

        // 2. Pago negativo. La referencia lleva el detalle codificado para poder
        //    reconstruir cuánto se devolvió de cada renglón en notas futuras.
        // v13.33 UNIDADES. `tot` sale de los precios de la factura, o sea $BCV,
        // pero pagos.monto_usd es $verde: registrar -tot inflaba el credito ~16%
        // y ensuciaba el KPI "Cobrado mes ($ verde)". Se convierte a la brecha
        // del dia, igual que en la anulacion.
        const _aVerde = (bcv) => Math.round(bcv * (1 - dtoDivisaNeutro() / 100) * 100) / 100;
        const _totVerde = _aVerde(tot);
        const detalle = dev.map(it => `${it.cod}=${it.devolver}`).join(';');
        const { error: ncPagErr } = await _sb.from('pagos').insert({
          factura_id: f.id,
          monto_usd: -_totVerde,
          monto_bs: -Math.round(_totVerde * estado.tasa_par * 100) / 100,
          tasa_usada: estado.tasa_par,
          metodo: 'Nota de crédito',
          referencia: `NC:${detalle}| ${motivo}`,
          registrado_por: estado.usuario || 'Sistema'
        });
        if (ncPagErr) throw ncPagErr;   // sin este registro la nota no existe

        // 3. Saldo de la factura
        const nuevoSaldo = Math.max(0, saldoAntes - aplicaSaldo);
        // v13.33 Antes el local se actualizaba aunque la base fallara: la
        // pantalla decia "pagada" y la base seguia con el saldo entero.
        const { error: ncFacErr } = await _sb.from('facturas').update({
          saldo_pendiente: nuevoSaldo,
          estado: nuevoSaldo < 0.01 ? 'pagada' : f.estado
        }).eq('id', f.id);
        if (ncFacErr) {
          console.error('[ARJ] NC: error actualizando saldo de la factura:', ncFacErr);
          notif('\u26a0 GRAVE: el stock volvio y la nota quedo registrada, pero el saldo de '
              + f.num + ' NO bajo ' + fmtUSD(aplicaSaldo) + '. Corrigelo antes de cobrar.', 'error');
        } else {
          f.saldo_pendiente = nuevoSaldo;
          if (nuevoSaldo < 0.01) f.estado = 'pagada';
        }

        // 4. Saldo del cliente
        const cli = CLIENTES.find(c => c.id === f.cliente_id);
        if (cli) {
          const campoSaldo = f.empresa === 'directa' ? 'saldo_vd' : 'saldo_dist';
          const actual = (f.empresa === 'directa' ? cli.saldo_vd : cli.saldo_dist) || 0;
          // Si sobra y queda "a favor", el saldo puede irse a negativo: eso es
          // justamente un anticipo a favor del cliente, no un error.
          const baja = destino === 'favor' ? tot : aplicaSaldo;
          const nuevoCli = actual - baja;
          const { error: ncCliErr } = await _sb.from('clientes')
            .update({ [campoSaldo]: nuevoCli }).eq('id', cli.id);
          if (ncCliErr) {
            console.error('[ARJ] NC: error actualizando saldo del cliente:', ncCliErr);
            notif('\u26a0 El saldo global de ' + (cli.nombre || 'el cliente')
                + ' NO bajo ' + fmtUSD(baja) + '. Corrigelo en Clientes.', 'error');
          } else {
            if (f.empresa === 'directa') cli.saldo_vd = nuevoCli; else cli.saldo_dist = nuevoCli;
          }
        }

        // 5. Si se devuelve efectivo, sale de caja y tiene que verse en Movimientos
        if (destino === 'efectivo' && sobrante > 0.009) {
          // v13.33 movimientos_caja.monto_usd tambien es $verde: es plata que
          // sale de caja de verdad, no valor de factura.
          const _sobVerde = _aVerde(sobrante);
          const { error: ncMovErr } = await _sb.from('movimientos_caja').insert({
            tipo: 'salida', categoria: 'dev_cliente', clasificacion: 'no_gasto',
            concepto: `Devolución por nota de crédito ${f.num}`,
            monto_usd: _sobVerde,
            monto_bs: Math.round(_sobVerde * estado.tasa_par * 100) / 100,
            moneda: 'USD', tasa_usada: estado.tasa_par, tasa_bcv_ref: estado.tasa_bcv,
            empresa: f.empresa, afecta_caja: true, anulado: false,
            registrado_por: estado.usuario || 'Sistema'
          });
          if (ncMovErr) {
            console.error('[ARJ] NC: error registrando la salida de caja:', ncMovErr);
            notif('\u26a0 Se devolvieron ' + fmtUSD(_sobVerde)
                + ' en efectivo pero NO quedaron en Movimientos. Registralo a mano.', 'error');
          }
        }

        const txt = `Nota de crédito sobre ${f.num} por ${fmtUSD(tot)} (${totDev} unidades: ${detalle}) — ${destino === 'efectivo' ? 'efectivo devuelto' : 'a favor del cliente'} — motivo: "${motivo}"`;
        logBitacora('anulacion', txt, true);
        _sbLogBitacora(estado.usuario, estado.empresa, 'anulacion', txt, true);

        cerrarNotaCredito();
        renderHistorial();
        notif(`Nota de crédito por ${fmtUSD(tot)} emitida. Stock devuelto.`, 'success');
      } catch (err) {
        console.error('[ARJ] Error en nota de crédito:', err);
        notif('Error emitiendo la nota de crédito. Revisa la factura antes de reintentar.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-receipt-refund"></i> Emitir nota de crédito';
      }
    }
