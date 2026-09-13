// === Anulacion de Facturas ===
    // ═══════════════════════════════════════════════════════════════
    // ANULAR FACTURA
    // ═══════════════════════════════════════════════════════════════
    let facturaAnular = null;
    function abrirAnular(num, cliente) {
      facturaAnular = { num, cliente };
      document.getElementById('anular-info').textContent = `${num} · ${cliente}`;
      document.getElementById('anular-motivo').value = '';
      // ¿Tiene abonos? → advertir cuánto dinero hay que devolver al cliente
      const _fA = TODAS_FACTURAS.find(f => f.num === num);
      const _abonado = _fA ? (_fA.abonado || 0) : 0;
      const _dev = document.getElementById('anular-devolucion');
      if (_dev) {
        if (_abonado > 0.009) {
          const _bsHoyDev = _abonado * colchonFactor() * estado.tasa_bcv;
          _dev.style.display = 'block';
          _dev.innerHTML = '<i class="ti ti-cash-banknote"></i> <strong>Esta factura tiene abonos por ' + fmtUSD(_abonado) + '.</strong><br>Al anular debes devolver ese dinero al cliente: <strong>' + fmtUSD(_abonado) + '</strong> o su equivalente hoy <strong>' + fmtBS(_bsHoyDev) + '</strong>. La devolución quedará registrada.';
        } else {
          _dev.style.display = 'none';
          _dev.innerHTML = '';
        }
      }
      document.getElementById('modal-anular').classList.add('show');
    }
    function cerrarAnular() { document.getElementById('modal-anular').classList.remove('show'); facturaAnular = null; }
    async function confirmarAnular() {
      const motivo = document.getElementById('anular-motivo').value.trim();
      if (!motivo) { notif('Debes indicar el motivo de la anulación', 'error'); return; }

      const factura = TODAS_FACTURAS.find(f => f.num === facturaAnular.num);
      if (!factura) { notif('Factura no encontrada', 'error'); cerrarAnular(); return; }
      if (factura.estado === 'anulada') { notif('Esta factura ya está anulada', 'warning'); cerrarAnular(); return; }

      try {
        if (_sb && _supabaseConectado) {
          // 1. Marcar como anulada en Supabase.
          // v13.33 Antes no se revisaba el error y el flujo seguia: devolvia el
          // stock de una factura que en la base seguia ACTIVA. Inventario
          // inflado y la venta todavia contando. Ahora nada se mueve si esto falla.
          const { error: anulErr } = await _sb.from('facturas').update({
            estado: 'anulada',
            fecha_anulacion: new Date().toISOString(),
            motivo_anulacion: motivo
          }).eq('id', factura.id);
          if (anulErr) {
            console.error('[ARJ] Error anulando la factura:', anulErr);
            notif('No se pudo anular ' + factura.num + '. No se movio stock ni saldos. Reintenta.', 'error');
            return;
          }

          // 2. Devolver stock: buscar items de la factura
          const _stockAnFallo = [];
          const { data: items } = await _sb.from('factura_items').select('*').eq('factura_id', factura.id);
          if (items) {
            const campoStock = factura.empresa === 'directa' ? 'stock_vd' : 'stock_dist';
            for (const it of items) {
              // Leer stock actual y sumar la cantidad devuelta
              const { data: prod } = await _sb.from('productos').select(campoStock).eq('id', it.producto_id).single();
              if (prod) {
                const nuevoStock = (prod[campoStock] || 0) + it.cantidad;
                // v13.33 El local solo se toca si la base confirmo.
                const { error: stkAnErr } = await _sb.from('productos')
                  .update({ [campoStock]: nuevoStock }).eq('id', it.producto_id);
                if (stkAnErr) {
                  console.error('[ARJ] Error devolviendo stock:', stkAnErr);
                  _stockAnFallo.push(it.cod_alt || it.producto_id);
                } else {
                  // Actualizar local
                  const pLocal = PRODUCTOS.find(p => p.id === it.producto_id);
                  if (pLocal) {
                    if (factura.empresa === 'directa') pLocal.stock_vd = nuevoStock;
                    else pLocal.stock_dist = nuevoStock;
                  }
                }
              }
            }
          }

          // 3. Si era crédito, revertir saldo del cliente
          if (factura.tipo_pago === 'credito' && factura.saldo_pendiente > 0) {
            const cliente = CLIENTES.find(c => c.id === factura.cliente_id);
            if (cliente) {
              const campoSaldo = factura.empresa === 'directa' ? 'saldo_vd' : 'saldo_dist';
              const saldoActual = factura.empresa === 'directa' ? cliente.saldo_vd : cliente.saldo_dist;
              const nuevoSaldo = Math.max(0, saldoActual - factura.saldo_pendiente);
              const { error: cliAnErr } = await _sb.from('clientes')
                .update({ [campoSaldo]: nuevoSaldo }).eq('id', cliente.id);
              if (cliAnErr) {
                console.error('[ARJ] Error revirtiendo saldo del cliente:', cliAnErr);
                notif('\u26a0 ' + factura.num + ' quedo anulada, pero el saldo de ' + (cliente.nombre || 'el cliente')
                    + ' NO bajo ' + fmtUSD(factura.saldo_pendiente) + '. Corrigelo en Clientes.', 'error');
              } else {
                if (factura.empresa === 'directa') cliente.saldo_vd = nuevoSaldo;
                else cliente.saldo_dist = nuevoSaldo;
              }
            }
          }

          // 3b. Si tenía abonos, registrar la DEVOLUCIÓN como pago negativo
          // Regla de negocio: al anular con abonos, el dinero SE DEVUELVE al cliente.
          // Se registra en `pagos` (mismo lugar por donde entró) con monto negativo,
          // valorado en USD a tasa de HOY (anti-descapitalización, igual que al cobrar).
          // v13.33 UNIDADES. `factura.abonado` esta en $BCV y pagos.monto_usd en
          // $verde: registrar -abonado sobrevaluaba la devolucion ~16%. En vez de
          // convertir con la brecha (aproximado), se SUMAN LOS PAGOS REALES de
          // esta factura, que ya estan en $verde y en Bs reales. Es exacto:
          // se devuelve justo lo que entro.
          let _devVerde = 0, _devBs = 0;
          const { data: _pagosPrev } = await _sb.from('pagos')
            .select('monto_usd, monto_bs').eq('factura_id', factura.id);
          if (_pagosPrev && _pagosPrev.length) {
            _pagosPrev.forEach(p => {
              _devVerde += parseFloat(p.monto_usd) || 0;
              _devBs    += parseFloat(p.monto_bs)  || 0;
            });
          }
          _devVerde = Math.round(_devVerde * 100) / 100;
          _devBs    = Math.round(_devBs * 100) / 100;
          // Si no hay pagos legibles se cae al valor viejo, convertido a $verde.
          const abonadoDev = _devVerde > 0.009
            ? _devVerde
            : Math.round((factura.abonado || 0) * (1 - dtoDivisaNeutro() / 100) * 100) / 100;
          if (abonadoDev > 0.009) {
            const { error: devErr } = await _sb.from('pagos').insert({
              factura_id: factura.id,
              monto_usd: -abonadoDev,
              monto_bs: -(_devBs > 0.009 ? _devBs : abonadoDev * estado.tasa_par),
              tasa_usada: estado.tasa_par,
              metodo: 'Devolución por anulación',
              referencia: 'Anulación ' + factura.num + ' — ' + motivo,
              registrado_por: estado.usuario || 'Sistema'
            });
            if (devErr) console.error('[ARJ] Error registrando devolución:', devErr);
            _sbLogBitacora(estado.usuario, factura.empresa, 'anulacion',
              'Devolvió ' + fmtUSD(abonadoDev) + ' al cliente por anulación de ' + factura.num, true);
          }

          if (_stockAnFallo.length > 0) {
            notif('\u26a0 ' + factura.num + ' quedo anulada, pero el stock NO volvio de: '
                + _stockAnFallo.join(', ') + '. Ajustalo en Inventario.', 'error');
          }

          _sbLogBitacora(estado.usuario, factura.empresa, 'anulacion',
            'Anuló ' + facturaAnular.num + ' (' + facturaAnular.cliente + ') — ' + motivo, true);
        }

        // 4. Actualizar arrays locales
        factura.estado = 'anulada';
        // Quitar de FACTURAS_COBRAR si estaba
        const idxCxC = FACTURAS_COBRAR.findIndex(f => f.num === facturaAnular.num);
        if (idxCxC >= 0) FACTURAS_COBRAR.splice(idxCxC, 1);

        logBitacora('anulacion', `Anuló ${facturaAnular.num} (${facturaAnular.cliente}) — motivo: "${motivo}"`, true);
        const _abonadoNotif = factura.abonado || 0;
        notif(`✓ Factura ${facturaAnular.num} anulada. Stock devuelto.` + (_abonadoNotif > 0.009 ? ` Devolución al cliente registrada: ${fmtUSD(_abonadoNotif)}.` : ''), 'success');
        renderHistorial();
        renderCobrar();
        cerrarAnular();
      } catch (err) {
        console.error('[ARJ] Error anulando:', err);
        notif('Error al anular: ' + (err.message || err), 'error');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // NOTA DE CRÉDITO (v13.8 — reconstruida)
    // Antes mostraba items DEMO y no escribía nada, pero decía "emitida, stock
    // restaurado". Ahora lee los renglones reales de la factura y escribe.
    //
    // Se registra como PAGO NEGATIVO en `pagos`, el mismo patrón que usa la
    // anulación con abonos. Así no hace falta tabla nueva y el histórico de
    // movimientos de la factura queda en un solo lugar.
    //
    // El precio sale de `precio_unitario` del renglón (congelado al emitir), no
    // se recalcula: el cliente pagó ese precio y ese se le devuelve.
    // ═══════════════════════════════════════════════════════════════
    let facturaNC = null;
    let ncItems = [];
