// === Abonos ===
    // ═══ REGISTRAR ABONO A FACTURA (v12) ═══
    // v13.33 `montoUSD` viene en $BCV (es lo que se ACREDITA contra
    // saldo_pendiente). `entregado` trae lo que el cliente REALMENTE puso en la
    // mano: {verde, bs, tasa}. Antes se insertaba el $BCV en pagos.monto_usd,
    // que es $verde, inflando lo cobrado hasta 22%. Mismo patron que la emision.
    async function registrarAbono(facturaNum, montoUSD, metodo, referencia, entregado) {
      if (!_sb || !_supabaseConectado) { notif('Sin conexión a la base de datos', 'error'); return; }
      if (!montoUSD || montoUSD <= 0) { notif('Ingresa un monto válido', 'error'); return; }

      // Buscar factura en TODAS las facturas (no solo cuentas por cobrar)
      const factura = TODAS_FACTURAS.find(f => f.num === facturaNum) || FACTURAS_COBRAR.find(f => f.num === facturaNum);
      if (!factura) { notif('Factura no encontrada', 'error'); return; }
      if (montoUSD > factura.saldo_pendiente + 1) { notif('El abono excede el saldo pendiente', 'error'); return; }

      try {
        // 1. Insertar pago en Supabase
        // Si no viene `entregado` (llamada vieja), se reconstruye asumiendo pago
        // en $ al valor de la cara: montoUSD ya seria el efectivo entregado.
        const _ent = entregado || { verde: montoUSD, bs: montoUSD * estado.tasa_bcv, tasa: estado.tasa_bcv };
        const { error: pagErr } = await _sb.from('pagos').insert({
          factura_id: factura.id,
          monto_usd: Math.round(_ent.verde * 100) / 100,
          monto_bs: Math.round(_ent.bs * 100) / 100,
          tasa_usada: _ent.tasa,
          metodo: metodo || 'Efectivo USD',
          referencia: referencia || '',
          registrado_por: estado.usuario || 'Sistema'
        });
        if (pagErr) throw pagErr;

        // 2. Actualizar saldo en la factura
        const nuevoSaldo = Math.max(0, factura.saldo_pendiente - montoUSD);
        const nuevoEstado = nuevoSaldo <= 0.01 ? 'pagada' : 'parcial';
        // v13.33 Antes no se revisaba el error: el pago entraba y el saldo se
        // quedaba igual. El cliente pagaba y seguia debiendo lo mismo.
        const { error: facErr } = await _sb.from('facturas').update({
          saldo_pendiente: nuevoSaldo,
          estado: nuevoEstado
        }).eq('id', factura.id);
        if (facErr) {
          console.error('[ARJ] Error actualizando saldo de la factura:', facErr);
          notif('\u26a0 GRAVE: el pago de ' + fmtUSD(_ent.verde) + ' quedo registrado pero el saldo de '
              + facturaNum + ' NO bajo. Corrigelo antes de cobrar de nuevo.', 'error');
          renderCobrar();
          return;   // no se toca nada local: la pantalla debe seguir mostrando la deuda real
        }

        // 3. Actualizar saldo del cliente
        const cliente = CLIENTES.find(c => c.id === factura.cliente_id);
        if (cliente) {
          const campoSaldo = factura.empresa === 'directa' ? 'saldo_vd' : 'saldo_dist';
          const saldoActual = factura.empresa === 'directa' ? cliente.saldo_vd : cliente.saldo_dist;
          const nuevoSaldoCli = Math.max(0, saldoActual - montoUSD);
          // v13.33 El local solo se toca si la base confirmo.
          const { error: cliAbErr } = await _sb.from('clientes')
            .update({ [campoSaldo]: nuevoSaldoCli }).eq('id', cliente.id);
          if (cliAbErr) {
            console.error('[ARJ] Error actualizando saldo del cliente:', cliAbErr);
            notif('\u26a0 El abono se registro, pero el saldo global de ' + (cliente.nombre || 'el cliente')
                + ' NO bajo. Corrigelo a mano en Clientes.', 'error');
          } else {
            if (factura.empresa === 'directa') cliente.saldo_vd = nuevoSaldoCli;
            else cliente.saldo_dist = nuevoSaldoCli;
          }
        }

        // 4. Actualizar local: TODAS_FACTURAS y FACTURAS_COBRAR pueden tener referencias distintas al mismo objeto
        factura.abonado = (factura.abonado || 0) + montoUSD;
        factura.saldo_pendiente = nuevoSaldo;
        factura.estado = nuevoEstado;
        // También actualizar la referencia en TODAS_FACTURAS si es distinta
        const enTodas = TODAS_FACTURAS.find(f => f.num === facturaNum);
        if (enTodas && enTodas !== factura) {
          enTodas.abonado = factura.abonado;
          enTodas.saldo_pendiente = nuevoSaldo;
          enTodas.estado = nuevoEstado;
        }
        if (nuevoEstado === 'pagada') {
          // Quitar de FACTURAS_COBRAR
          const idx = FACTURAS_COBRAR.findIndex(f => f.num === facturaNum);
          if (idx >= 0) FACTURAS_COBRAR.splice(idx, 1);
        }

        // 5. Bitácora
        _sbLogBitacora(estado.usuario, factura.empresa, 'factura',
          'Abono $' + montoUSD.toFixed(2) + ' a ' + facturaNum + ' (' + metodo + '). Saldo: $' + nuevoSaldo.toFixed(2), false);
        logBitacora('factura', 'Abono $' + montoUSD.toFixed(2) + ' a ' + facturaNum + '. Saldo: $' + nuevoSaldo.toFixed(2), false);

        renderCobrar();
        notif('✓ Abono de $' + montoUSD.toFixed(2) + ' registrado. Saldo: $' + nuevoSaldo.toFixed(2), 'success');
      } catch (err) {
        console.error('[ARJ] Error registrando abono:', err);
        notif('Error registrando abono: ' + (err.message || err), 'error');
      }
    }


    function abrirAbono(num) {
      const f = TODAS_FACTURAS.find(x => x.num === num) || FACTURAS_COBRAR.find(x => x.num === num);
      if (!f) { notif('Factura no encontrada', 'error'); return; }
      cerrarDetalleFactura();
      // Bs a tasa del DÍA (no congelada)
      const saldoBsHoy = f.saldo_pendiente * factorBsDe(f) * estado.tasa_bcv; // v13.12: factor congelado de la factura
      // v13.32 Cuanto efectivo en $ salda esta factura HOY.
      // Si al emitir se acordo un monto redondo ("Cobrar en efectivo"), manda
      // ese; si no, el equivalente a la brecha del dia. Se prorratea sobre el
      // saldo: si ya hubo abonos parciales, el objetivo baja en proporcion.
      const _cvFactura = parseFloat(f.cobrar_verde) || 0;
      const _cvAcordado = _cvFactura > 0 && f.total > 0;
      const _efectivoObjetivo = _cvAcordado
        ? Math.round(_cvFactura * (f.saldo_pendiente / f.total) * 100) / 100
        : totalEnDivisas(f.saldo_pendiente);
      // v13.33 Filas que solo aparecen si aportan algo: con RESGUARDO_BS = 1.00
      // la fila del resguardo repetiria el saldo con un 0,0% al lado, y sin
      // abonos previos "Total" es el mismo numero que "Saldo".
      const _hayResguardo = Math.abs(factorBsDe(f) - 1) > 0.0001;
      const _hayAbonos = (parseFloat(f.abonado) || 0) > 0.009;
      let modal = document.getElementById('modal-abono');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-abono';
        modal.className = 'modal';
        document.body.appendChild(modal);
      }
      modal.innerHTML = `
    <div class="modal-content" style="max-width:460px;text-align:left">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px">
        <h2 style="margin:0;font-size:16px"><i class="ti ti-cash-banknote" style="color:var(--green)"></i> Registrar abono</h2>
        <button class="btn btn-secondary btn-sm" onclick="cerrarAbono()"><i class="ti ti-x"></i></button>
      </div>
      <div style="background:var(--sky);border-radius:6px;padding:10px 12px;margin-bottom:12px;font-size:12px">
        <div style="font-weight:600">${f.num} <span style="color:var(--dgray);font-weight:400">·</span> ${f.cliente}</div>
        ${_hayAbonos ? `<div style="margin-top:4px;color:var(--dgray);font-size:11px">Total ${fmtUSD(f.total)} · abonado ${fmtUSD(f.abonado || 0)}</div>` : ''}
        <div style="margin-top:8px;padding:8px;background:#FFF;border:1px solid var(--border);border-radius:6px">
          <div style="display:grid;grid-template-columns:auto auto;gap:5px 12px;font-size:11.5px">
            <span style="color:var(--dgray)">Saldo</span>
            <strong style="text-align:right;color:var(--red)">${fmtUSD(f.saldo_pendiente)}</strong>
            ${_hayResguardo ? `<span style="color:var(--dgray)" title="Resguardo cambiario congelado al emitir esta factura. Es la cifra que se convierte a bolívares.">Con resguardo (${((factorBsDe(f) - 1) * 100).toFixed(1)}%)</span>
            <strong style="text-align:right;color:var(--gold)">${fmtUSD(f.saldo_pendiente * factorBsDe(f))}</strong>` : ''}
            <span style="color:var(--dgray)">Efectivo hoy</span>
            <strong style="text-align:right;color:var(--green)" title="${_cvAcordado ? 'Objetivo de efectivo acordado al emitir esta factura.' : 'Equivalente del saldo en dólares físicos, a la brecha de hoy.'}">${fmtUSD(_efectivoObjetivo)}${_cvAcordado ? ' <span style="font-size:9px;color:var(--gold);font-weight:600">ACORDADO</span>' : ''}</strong>
            <span style="color:var(--dgray);border-top:1px solid var(--border);padding-top:5px">Bolívares hoy</span>
            <strong style="text-align:right;color:var(--navy);font-size:13px;border-top:1px solid var(--border);padding-top:5px">${fmtBS(saldoBsHoy)}</strong>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Monto del abono *</label>
          <div style="display:flex;gap:4px">
            <input type="text" id="abono-monto" placeholder="Pega o escribe el monto" style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:14px;font-family:inherit">
            <select id="abono-moneda" style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit">
              <option value="USD">USD</option>
              <option value="Bs">Bs</option>
            </select>
          </div>
          <div style="font-size:10.5px;color:var(--dgray);margin-top:3px"><i class="ti ti-info-circle"></i> Acepta cualquier formato: 59.818,55 · 59818.55 · 59818,55</div>
        </div>
        <!-- v13.32 Solo para pagos en $: el usuario decide como se acredita. -->
        <div id="abono-modo-box" style="display:none;background:#F2F5FA;border-radius:6px;padding:9px 11px">
          <div style="font-size:11.5px;font-weight:600;margin-bottom:6px">¿Cómo acredito este pago en efectivo?</div>
          <label style="display:flex;gap:7px;align-items:center;cursor:pointer;padding:3px 0;font-size:12px">
            <input type="radio" name="abono-modo" value="saldar" onchange="_abonoPreview()">
            <span style="flex:1">Saldar la factura completa</span>
            <strong id="abono-m1" style="font-variant-numeric:tabular-nums"></strong>
          </label>
          <label style="display:flex;gap:7px;align-items:center;cursor:pointer;padding:3px 0;font-size:12px">
            <input type="radio" name="abono-modo" value="convertir" onchange="_abonoPreview()">
            <span style="flex:1">Convertir a $BCV</span>
            <strong id="abono-m2" style="font-variant-numeric:tabular-nums"></strong>
          </label>
          <label style="display:flex;gap:7px;align-items:center;cursor:pointer;padding:3px 0;font-size:12px">
            <input type="radio" name="abono-modo" value="cara" onchange="_abonoPreview()">
            <span style="flex:1">Al valor de la cara</span>
            <strong id="abono-m3" style="font-variant-numeric:tabular-nums"></strong>
          </label>
          <div id="abono-preview" style="margin-top:7px;padding-top:6px;border-top:1px solid var(--border);font-size:12px;line-height:1.45"></div>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Método de pago *</label>
          <select id="abono-metodo" onchange="abonoToggleRefReq()" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit">
            <option>Efectivo USD</option><option>Zelle USD</option><option>Pago móvil Bs.</option><option>Transferencia Bs.</option><option>Efectivo Bs.</option><option>Punto de venta</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px" id="abono-ref-label">Referencia / N° confirmación <span id="abono-ref-req" style="color:var(--red);display:none">*</span></label>
          <input type="text" id="abono-ref" placeholder="N° de referencia bancaria, transferencia, voucher..." style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:inherit">
          <div id="abono-ref-help" style="font-size:10.5px;color:var(--dgray);margin-top:3px"></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;border-top:1px solid var(--border);padding-top:10px">
          <button class="btn btn-secondary" onclick="cerrarAbono()">Cancelar</button>
          <button class="btn btn-primary" onclick="confirmarAbono('${f.num}')"><i class="ti ti-check"></i> Registrar</button>
        </div>
      </div>
    </div>`;
_abonoCtx = { f: f, objetivo: _efectivoObjetivo, acordado: _cvAcordado };
      const _im = document.getElementById('abono-monto');
      const _mo = document.getElementById('abono-moneda');
      if (_im) _im.addEventListener('input', _abonoPreview);
      if (_mo) _mo.addEventListener('change', _abonoPreview);
      modal.classList.add('show');
      setTimeout(() => { document.getElementById('abono-monto')?.focus(); abonoToggleRefReq(); }, 100);
    }

    // Hace la referencia obligatoria para métodos electrónicos y autocambia la moneda
    function abonoToggleRefReq() {
      const m = document.getElementById('abono-metodo')?.value || '';
      const reqEl = document.getElementById('abono-ref-req');
      const helpEl = document.getElementById('abono-ref-help');
      const monedaSel = document.getElementById('abono-moneda');
      const requiere = /transferencia|pago m[oó]vil|punto de venta|zelle/i.test(m);
      if (reqEl) reqEl.style.display = requiere ? 'inline' : 'none';
      if (helpEl) helpEl.innerHTML = requiere
        ? '<span style="color:var(--red)"><i class="ti ti-alert-circle"></i> Obligatorio para ' + m + ' — para trazabilidad y disputas futuras</span>'
        : '';
      // Auto-cambiar moneda según método
      if (monedaSel) {
        if (/Bs\.|m[oó]vil|punto de venta/i.test(m)) monedaSel.value = 'Bs';
        else if (/USD|Zelle/i.test(m)) monedaSel.value = 'USD';
      }
      if (typeof _abonoPreview === 'function') _abonoPreview();
    }

    function cerrarAbono() { const m = document.getElementById('modal-abono'); if (m) m.classList.remove('show'); _abonoCtx = null; }

    // ═══════════════════════════════════════════════════════════════
    // v13.32 ACREDITACIÓN DE ABONOS EN EFECTivo — el usuario decide.
    // El problema: `saldo_pendiente` esta en $BCV y un pago en efectivo esta
    // en $verde. Restarlos directo deja al cliente debiendo de mas. Ahora se
    // muestran las tres lecturas posibles y se elige, con vista previa.
    // ═══════════════════════════════════════════════════════════════
    let _abonoCtx = null;   // { f, objetivo, acordado }

    function _abonoParse(s) {
      if (!s) return 0;
      s = String(s).replace(/[^\d.,]/g, '');
      const tieneComa = s.includes(','), tienePunto = s.includes('.');
      if (tieneComa && tienePunto) {
        s = (s.lastIndexOf(',') > s.lastIndexOf('.'))
          ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
      } else if (tieneComa) {
        const p = s.split(',');
        s = (p.length === 2 && p[1].length <= 2) ? p[0] + '.' + p[1] : s.replace(/,/g, '');
      } else if (tienePunto) {
        const p = s.split('.');
        if (p.length > 2) s = s.replace(/\./g, '');
        else if (p.length === 2 && p[1].length === 3 && p[0].length > 0) s = s.replace(/\./g, '');
      }
      return parseFloat(s) || 0;
    }

    // Cuanto $BCV acredita un monto en efectivo, segun el modo elegido.
    function _abonoAcredita(monto, modo) {
      const c = _abonoCtx; if (!c) return monto;
      if (modo === 'saldar') return c.f.saldo_pendiente;
      if (modo === 'convertir') {
        const d = dtoDivisaPct();
        return d < 100 ? Math.round(monto / (1 - d / 100) * 100) / 100 : monto;
      }
      return monto;                                   // 'cara'
    }

    function _abonoPreview() {
      const c = _abonoCtx; if (!c) return;
      const box = document.getElementById('abono-modo-box');
      const moneda = document.getElementById('abono-moneda')?.value || 'USD';
      const monto = _abonoParse(document.getElementById('abono-monto')?.value || '');
      // Los pagos en Bs ya tienen su propia regla (cubre el "Cobrar HOY" → salda).
      if (!box) return;
      if (moneda !== 'USD' || monto <= 0) { box.style.display = 'none'; return; }
      box.style.display = 'block';

      const cubre = monto >= c.objetivo - 1;
      // v13.33 Cada opcion muestra solo su monto; la explicacion es la de la
      // opcion elegida. Antes las tres explicaciones se leian a la vez y solo
      // una importaba.
      const s1 = document.getElementById('abono-m1');
      const s2 = document.getElementById('abono-m2');
      const s3 = document.getElementById('abono-m3');
      if (s1) s1.textContent = fmtUSD(c.f.saldo_pendiente);
      if (s2) s2.textContent = fmtUSD(_abonoAcredita(monto, 'convertir'));
      if (s3) s3.textContent = fmtUSD(monto);

      // Preselección: si cubre el objetivo, lo natural es saldar.
      let sel = document.querySelector('input[name="abono-modo"]:checked');
      if (!sel) {
        const v = cubre ? 'saldar' : 'convertir';
        const r = document.querySelector('input[name="abono-modo"][value="' + v + '"]');
        if (r) { r.checked = true; sel = r; }
      }
      const modo = sel ? sel.value : 'convertir';
      let acred = _abonoAcredita(monto, modo);
      acred = Math.min(acred, c.f.saldo_pendiente);
      const resto = Math.round((c.f.saldo_pendiente - acred) * 100) / 100;
      // Explicacion de la opcion activa + resultado.
      let _porque = '';
      if (modo === 'saldar') {
        _porque = cubre
          ? '<span style="color:#1E7B34">Cubre el objetivo de ' + fmtUSD(c.objetivo) + '.</span>'
          : '<span style="color:#B00020">Faltan ' + fmtUSD(c.objetivo - monto) + ' para el objetivo de ' + fmtUSD(c.objetivo) + '.</span>';
      } else if (modo === 'convertir') {
        _porque = 'El efectivo vale más en $BCV (brecha de hoy −' + dtoDivisaPct().toFixed(1) + '%).';
      } else {
        _porque = 'Sin convertir. Úsalo solo si el precio ya estaba en $BCV.';
      }
      const pv = document.getElementById('abono-preview');
      if (pv) pv.innerHTML = _porque + '<br>Acredita <strong>' + fmtUSD(acred)
        + '</strong> · saldo queda en <strong style="color:'
        + (resto <= 0.01 ? '#1E7B34' : '#B00020') + '">' + fmtUSD(Math.max(0, resto)) + '</strong>';
    }

   async function confirmarAbono(num){
  if(window._abonoEnProceso) return;
  const montoRaw = (document.getElementById('abono-monto')?.value||'').trim();
      const moneda = document.getElementById('abono-moneda')?.value || 'USD';
      const metodo = document.getElementById('abono-metodo')?.value || 'Efectivo USD';
      const ref = (document.getElementById('abono-ref')?.value || '').trim();

      // Parser inteligente: acepta formato venezolano (1.234,56) y formato US (1,234.56)
      // Si tiene coma Y punto: la última coma o punto es el decimal, los demás son miles
      // Si solo tiene punto y hay más de 1 punto, son separadores de miles
      // Si solo tiene una coma, es decimal venezolano
      function parseMonto(s) {
        if (!s) return 0;
        s = String(s).replace(/[^\d.,]/g, ''); // quita Bs, $, espacios, letras
        if (!s) return 0;
        const tieneComa = s.includes(',');
        const tienePunto = s.includes('.');
        if (tieneComa && tienePunto) {
          // Decimal es el ÚLTIMO separador que aparezca
          const ultComa = s.lastIndexOf(',');
          const ultPunto = s.lastIndexOf('.');
          if (ultComa > ultPunto) {
            // Formato venezolano: 59.818,55 → quitar puntos, cambiar coma a punto
            s = s.replace(/\./g, '').replace(',', '.');
          } else {
            // Formato US: 59,818.55 → quitar comas
            s = s.replace(/,/g, '');
          }
        } else if (tieneComa) {
          // Solo coma. Si hay 1 sola y van 2 dígitos después, es decimal venezolano
          const partes = s.split(',');
          if (partes.length === 2 && partes[1].length <= 2) {
            s = partes[0] + '.' + partes[1];
          } else {
            s = s.replace(/,/g, ''); // miles US
          }
        } else if (tienePunto) {
          // Solo puntos. Si hay más de uno O el último grupo tiene 3 dígitos exactos → miles venezolano
          const partes = s.split('.');
          if (partes.length > 2) {
            // Múltiples puntos = miles
            s = s.replace(/\./g, '');
          } else if (partes.length === 2 && partes[1].length === 3 && partes[0].length > 0) {
            // Un punto, último grupo de 3 dígitos: ambiguo, asumir miles venezolano (59.818)
            s = s.replace(/\./g, '');
          }
          // Si es solo "X.YY" (decimal claro), no tocar
        }
        return parseFloat(s) || 0;
      }

      const montoIn = parseMonto(montoRaw);
      if (!montoIn || montoIn <= 0) { notif('Ingresa un monto válido', 'error'); return; }

      // Referencia obligatoria para transferencias y pagos móviles
      const requiereRef = /transferencia|pago m[oó]vil|punto de venta|zelle/i.test(metodo);
      if (requiereRef && !ref) {
        notif('La referencia es obligatoria para ' + metodo, 'error');
        document.getElementById('abono-ref')?.focus();
        return;
      }

      // Convertir a USD: si paga en Bs, dividir entre PARALELO (valor real del bolívar)
      let montoUSD = moneda === 'USD' ? montoIn : montoIn / estado.tasa_par;

      // v13.33 Se congela lo que el cliente ENTREGO antes de que montoUSD se
      // reescriba a $BCV mas abajo. Mismo patron que la emision (~6164): en Bs
      // se guarda el bolivar real, no uno recalculado, para poder conciliar con
      // el comprobante del banco.
      const _entregado = {
        verde: moneda === 'USD' ? montoIn : montoIn / estado.tasa_par,
        bs:    moneda === 'Bs'  ? montoIn : montoIn * estado.tasa_bcv,
        tasa:  moneda === 'Bs'  ? estado.tasa_par : estado.tasa_bcv
      };

      // Validar contra saldo: si el monto pagado en Bs cubre el "saldo HOY en Bs",
      // se considera completo (incluye colchón BCV). Topear al saldo pendiente.
      const f = TODAS_FACTURAS.find(x => x.num === num) || FACTURAS_COBRAR.find(x => x.num === num);
      if (f) {
        const saldoBsHoy = f.saldo_pendiente * factorBsDe(f) * estado.tasa_bcv; // v13.12: factor congelado
        if (moneda === 'Bs') {
          // ¿El monto en Bs cubre o excede el "Cobrar HOY"? → es pago completo del saldo
          if (montoIn >= saldoBsHoy - 1) {
            montoUSD = f.saldo_pendiente; // saldar completamente
          } else if (montoUSD > f.saldo_pendiente + 1) {
            notif('El abono excede el saldo pendiente', 'error'); return;
          }
        } else {
          // v13.32 Pago en $: se acredita segun el modo elegido por el usuario.
          // Antes se restaba el valor de cara ($verde) contra saldo_pendiente
          // ($BCV) y el cliente quedaba debiendo de mas.
          const _sel = document.querySelector('input[name="abono-modo"]:checked');
          const _modo = _sel ? _sel.value : 'cara';
          montoUSD = _abonoAcredita(montoIn, _modo);
          if (montoUSD > f.saldo_pendiente) montoUSD = f.saldo_pendiente;  // topar, nunca saldo negativo
          if (montoUSD <= 0) { notif('El monto acreditado da cero. Revisa el modo elegido.', 'error'); return; }
        }
      }

    window._abonoEnProceso = true;
  try{
    await registrarAbono(num, montoUSD, metodo, ref, _entregado);
  } finally {
    window._abonoEnProceso = false;
  }
  cerrarAbono();
  renderHistorial();
  renderCobrar();
}