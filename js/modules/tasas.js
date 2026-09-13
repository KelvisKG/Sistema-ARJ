// === Tasas y Monitor Cambiario ===
    function renderVentasRecientes() {
      const cont = document.getElementById('ventas-recientes-list');
      cont.innerHTML = VENTAS_RECIENTES.map(v => `
    <div class="list-row">
      <div class="nombre"><div style="font-weight:600">${v.cliente}</div><div style="font-size:11px;color:var(--dgray)">${v.num} · ${v.fecha} · ${v.vendedor}</div></div>
      <div class="valor">${fmtUSD(v.total)}</div>
    </div>`).join('');
    }

    function actualizarTasas() {
      // v13.12 SE QUITARON LOS FALLBACKS `|| 215.50` y `|| 195.20`. Un campo
      // vacio daba parseFloat('') = NaN, que es falsy, y el sistema saltaba a
      // esas tasas de hace meses SIN AVISAR: con las reales cerca de 930 y 785,
      // habria facturado a un cuarto de su valor. Ahora se rechaza y se conserva.
      const _par = parseFloat(document.getElementById('cfg-par').value);
      const _bcv = parseFloat(document.getElementById('cfg-bcv').value);
      if (!isFinite(_par) || _par <= 0 || !isFinite(_bcv) || _bcv <= 0) {
        notif('Las tasas deben ser números mayores que cero. Se conservan las anteriores.', 'error');
        document.getElementById('cfg-par').value = estado.tasa_par;
        document.getElementById('cfg-bcv').value = estado.tasa_bcv;
        return;
      }
      if (_bcv > _par) {
        notif('El BCV quedó por encima del paralelo. Revisa: normalmente es al revés. No se guardó.', 'error');
        return;
      }
      estado.tasa_par = _par;
      estado.tasa_bcv = _bcv;
      estado.tasas_actualizadas = new Date().toISOString();
      document.getElementById('tasa-par').textContent = fmtBS(estado.tasa_par);
      document.getElementById('tasa-bcv').textContent = fmtBS(estado.tasa_bcv);
      recalcular();
      logBitacora('precio', `Confirmó tasas: Paralelo ${fmtBS(estado.tasa_par)} · BCV ${fmtBS(estado.tasa_bcv)}`, true);
      _sbGuardarTasas();
      revisarTasasDelDia();
      notif('Tasas confirmadas. Las facturas ya emitidas mantienen su tasa congelada.', 'success');
    }

    // ═══════════════════════════════════════════════════════════════
    // BANNER DE TASAS DEL DIA (v13.12)
    // El caso que hay que cubrir: si la tasa NO cambia (pasa en Venezuela,
    // poco pero pasa), el `onchange` de los inputs no dispara, actualizarTasas()
    // nunca corre, la fecha nunca se escribe y el banner se queda pegado para
    // siempre. Por eso el boton "Confirmar tasas de hoy" llama a la funcion
    // DIRECTAMENTE: confirmar es una accion del usuario, no un cambio de dato.
    // ═══════════════════════════════════════════════════════════════
    function tasasConfirmadasHoy() {
      const t = estado.tasas_actualizadas;
      if (!t) return false;
      const d = new Date(t);
      if (isNaN(d.getTime())) return false;
      const h = new Date();
      return d.getFullYear() === h.getFullYear()
        && d.getMonth() === h.getMonth()
        && d.getDate() === h.getDate();
    }

    function revisarTasasDelDia() {
      const b = document.getElementById('banner-tasas');
      if (!b) return;
      if (tasasConfirmadasHoy()) { b.classList.remove('show'); _pintarEstadoTasas(); return; }
      const sub = document.getElementById('bt-sub');
      if (sub) {
        const t = estado.tasas_actualizadas;
        let cuando = 'Nunca se han confirmado desde que existe el registro.';
        if (t) {
          const d = new Date(t);
          if (!isNaN(d.getTime())) {
            const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
            cuando = 'Última confirmación: ' + d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })
              + ' a las ' + d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
              + (dias >= 1 ? ' — hace ' + dias + (dias === 1 ? ' día' : ' días') : '');
          }
        }
        sub.textContent = cuando + '  ·  Vigentes: Paralelo ' + fmtBS(estado.tasa_par) + ' · BCV ' + fmtBS(estado.tasa_bcv);
      }
      b.classList.add('show');
      _pintarEstadoTasas();
    }

    // Confirma sin exigir que el valor cambie. Si las tasas siguen iguales,
    // igual queda registrado que hoy alguien las miro y las dio por buenas.
    function confirmarTasasHoy() { actualizarTasas(); }

    // v13.12: este boton existia SIN onclick desde hace versiones. No hacia nada
    // y no avisaba nada, lo que da la falsa impresion de que la carga automatica
    // ya funciona. Hasta que se construya, al menos dice la verdad.
    function avisoTasaAuto() {
      notif('La carga automática todavía no está construida. Por ahora escribe las tasas a mano y confírmalas.', 'warning');
    }

    // Pinta en Configuración cuándo se confirmaron por última vez.
    function _pintarEstadoTasas() {
      const el = document.getElementById('cfg-tasas-estado');
      if (!el) return;
      if (tasasConfirmadasHoy()) {
        el.style.color = 'var(--green)';
        el.innerHTML = '<i class="ti ti-circle-check"></i> Confirmadas hoy';
        return;
      }
      const t = estado.tasas_actualizadas;
      el.style.color = 'var(--red)';
      if (!t) { el.innerHTML = '<i class="ti ti-alert-circle"></i> Sin confirmar'; return; }
      const d = new Date(t);
      const dias = isNaN(d.getTime()) ? null : Math.floor((Date.now() - d.getTime()) / 86400000);
      el.innerHTML = '<i class="ti ti-alert-circle"></i> Sin confirmar hoy'
        + (dias != null ? ' — última vez hace ' + dias + (dias === 1 ? ' día' : ' días') : '');
    }

    function mostrarAyuda() {
      notif('Atajo: Esc o Ctrl+Q para salir rápido. Click en la campana para ver alertas.', 'warning');
    }

    // v12: mostrar/ocultar selector de días de crédito
    function toggleDiasCredito() {
      const tipo = document.getElementById('tipo-pago-factura').value;
      const dias = document.getElementById('dias-credito');
      if (dias) dias.style.display = tipo === 'credito' ? 'inline-block' : 'none';
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS Y MODAL CLIENTE
    // ═══════════════════════════════════════════════════════════════