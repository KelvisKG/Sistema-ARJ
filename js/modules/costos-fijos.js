// === Costos Fijos ===
    // ═══ COSTOS FIJOS POR PERÍODO (v13.1) ═══
    // Los costos fijos son un ESTIMADO que cambia mes a mes. Guardar un solo
    // número reescribiría el punto de equilibrio de los meses ya cerrados,
    // el mismo error que ya evitamos con factor_bs y con factor_landed.
    // Cada mes guarda el suyo en un mapa { 'AAAA-MM': monto }.
    function periodoDe(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    // Un mes sin monto propio hereda el del último mes ANTERIOR registrado.
    // Nunca hereda de un mes futuro: el pasado no se estima con datos que aún no existían.
    function costosFijosDe(periodo) {
      const h = estado.costos_fijos_hist || {};
      if (h[periodo] != null) return parseFloat(h[periodo]) || 0;
      const previos = Object.keys(h).filter(k => k < periodo).sort();
      if (previos.length) return parseFloat(h[previos[previos.length - 1]]) || 0;
      return parseFloat(estado.costos_fijos_mes) || 0;
    }

    async function _sbGuardarCostosFijos() {
      if (!_sb || !_supabaseConectado) return;
      const { error } = await _sb.from('configuracion').update({
        costos_fijos_hist: estado.costos_fijos_hist,
        costos_fijos_mes: costosFijosDe(periodoDe(new Date()))
      }).eq('id', 1);
      if (error) console.error('[ARJ] Error guardando costos fijos:', error);
    }

    function cambiarPeriodoFijos() {
      const selM = document.getElementById('cfg-fijos-mes');
      const inp = document.getElementById('cfg-fijos');
      if (!selM || !inp) return;
      if (!selM.value) selM.value = periodoDe(new Date());
      const h = estado.costos_fijos_hist || {};
      inp.value = (h[selM.value] != null) ? h[selM.value] : '';
      inp.placeholder = (h[selM.value] == null)
        ? 'Sin dato — hereda ' + fmtUSD(costosFijosDe(selM.value)) : '';
      renderListaFijos();
    }

    function renderListaFijos() {
      const cont = document.getElementById('cfg-fijos-lista');
      if (!cont) return;
      const h = estado.costos_fijos_hist || {};
      const meses = Object.keys(h).sort().reverse().slice(0, 6);
      cont.innerHTML = meses.length === 0
        ? 'Ningún mes registrado todavía.'
        : 'Registrados: ' + meses.map(m => m + ' · ' + fmtUSD(parseFloat(h[m]) || 0)).join('  |  ');
    }

    function actualizarCostosFijos(v) {
      const selM = document.getElementById('cfg-fijos-mes');
      const periodo = (selM && selM.value) ? selM.value : periodoDe(new Date());
      const raw = String(v).trim();
      if (raw === '') {
        delete estado.costos_fijos_hist[periodo];
        _sbGuardarCostosFijos();
        cambiarPeriodoFijos();
        if (typeof actualizarKpisReportes === 'function') actualizarKpisReportes();
        notif('Se borró el monto de ' + periodo + '. Ese mes vuelve a heredar del anterior.', 'warning');
        return;
      }
      const c = parseFloat(raw);
      if (!isFinite(c) || c < 0) {
        notif('Los costos fijos no pueden ser negativos', 'error');
        cambiarPeriodoFijos();
        return;
      }
      estado.costos_fijos_hist[periodo] = c;
      logBitacora('precio', 'Fijó los costos fijos de ' + periodo + ' en ' + fmtUSD(c), true);
      _sbGuardarCostosFijos();
      cambiarPeriodoFijos();
      if (typeof actualizarKpisReportes === 'function') actualizarKpisReportes();
      notif('Costos fijos de ' + periodo + ': ' + fmtUSD(c) + '. Los otros meses no se tocaron.', 'success');
    }

    function actualizarFactorDefault(v) {
      const f = parseFloat(v);
      if (!isFinite(f) || f < 1 || f > 5) {
        notif('El factor debe estar entre 1 y 5. Se mantiene ' + estado.factor_default, 'error');
        document.getElementById('cfg-factor').value = estado.factor_default;
        return;
      }
      estado.factor_default = f;
      logBitacora('inventario', 'Cambió el factor landed por defecto a ×' + f.toFixed(3) + ' (solo productos nuevos)', true);
      _sbGuardarFactorDefault();
      notif('Factor por defecto: ×' + f.toFixed(3) + '. Aplica solo a productos nuevos; los ' + PRODUCTOS.length + ' actuales conservan el suyo.', 'success');
    }
