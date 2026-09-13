// === Equipo y Metas ===
    // ═══════════════════════════════════════════════════════════════
    // METAS DE VENTA
    // ═══════════════════════════════════════════════════════════════
    // v13.2 EQUIPO: lista de trabajadores a los que se les pone meta.
    // NO son usuarios del sistema. Un trabajador puede tener meta sin poder
    // entrar a facturar (ej: un vendedor de mostrador que reporta al gerente).
    // Crear un usuario que ENTRE al sistema se hace en Supabase > Authentication.
    // Formato: [{ nombre:'HUMBERTO ARJ', empresa:'ambas'|'directa'|'dist' }]
    let EQUIPO = [];

    // v13.2 METAS POR PERIODO: mismo criterio que costos_fijos_hist. Un solo
    // numero de meta reescribiria el pasado — al subir la meta en diciembre,
    // agosto pasaria de "cumplida" a "no cumplida" sola.
    // Formato: { '2026-08': { directa:5000, dist:3000, vendedores:{'JJ':2000} } }
    let METAS_HIST = {};
    let metasPeriodo = null; // periodo que se esta viendo; null = mes actual

    let ventasMesActual = { directa: 0, dist: 0, vendedores: {} };

    // Devuelve (creandolo si hace falta) el bloque de metas de un periodo.
    function metasDe(per) {
      if (!METAS_HIST[per]) METAS_HIST[per] = { directa: 0, dist: 0, vendedores: {} };
      const m = METAS_HIST[per];
      if (typeof m.directa !== 'number') m.directa = 0;
      if (typeof m.dist !== 'number') m.dist = 0;
      if (!m.vendedores || typeof m.vendedores !== 'object') m.vendedores = {};
      return m;
    }
    function metasPeriodoActivo() { return metasPeriodo || periodoDe(new Date()); }
    function renderMetas() {
      const cont = document.getElementById('metas-content');
      if (!cont) return;

      const per = metasPeriodoActivo();
      const perActual = periodoDe(new Date());
      const esMesCerrado = per !== perActual;
      const M = metasDe(per);

      const metaEmpresa = estado.empresa === 'directa' ? M.directa : M.dist;
      const ventasEmpresa = estado.empresa === 'directa' ? ventasMesActual.directa : ventasMesActual.dist;
      const nombreEmp = nombreEmpresa(estado.empresa);
      const pctEmp = metaEmpresa > 0 ? Math.min(100, (ventasEmpresa / metaEmpresa) * 100) : 0;
      const faltaEmp = Math.max(0, metaEmpresa - ventasEmpresa);

      // Base REAL para sugerir: lo vendido el mes anterior en esta empresa.
      // Antes las sugerencias se calculaban sobre la meta misma, asi que cada
      // clic la inflaba y el numero no salia de ningun dato.
      const baseSug = ventasMesAnteriorEmpresa();

      // opciones del selector de periodo: los que tienen meta + los ultimos 6 meses
      const setPer = new Set(Object.keys(METAS_HIST));
      const hoyP = new Date();
      for (let k = 0; k < 6; k++) setPer.add(periodoDe(new Date(hoyP.getFullYear(), hoyP.getMonth() - k, 1)));
      const opciones = [...setPer].sort().reverse()
        .map(x => `<option value="${x}" ${x === per ? 'selected' : ''}>${etiquetaPeriodo(x)}</option>`).join('');

      let html = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap">
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:11.5px;color:var(--dgray)">Período:</span>
      <select class="val-input" id="metas-periodo" onchange="cambiarPeriodoMetas(this.value)" style="width:150px">${opciones}</select>
      ${esMesCerrado ? '<span style="background:#FFF8E1;color:#5D4037;padding:2px 8px;border-radius:8px;font-size:10.5px;font-weight:600">MES CERRADO</span>' : ''}
    </div>
    <button class="btn btn-secondary btn-sm" onclick="abrirModalEquipo()"><i class="ti ti-users-plus"></i> Gestionar equipo</button>
  </div>`;

      if (esMesCerrado) {
        html += `<div style="background:#FFF8E1;border-left:3px solid var(--gold);border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:11.5px;color:#5D4037">
      <i class="ti ti-info-circle"></i> Estás viendo un mes distinto al actual. Las barras de "vendido" siempre muestran el <strong>mes en curso</strong>; solo la meta cambia de período.
    </div>`;
      }

      html += `
  <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div>
        <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:500">Meta empresa</div>
        <div style="font-size:14px;font-weight:600;color:var(--navy)">${nombreEmp}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:11.5px;color:var(--dgray)">Meta:</span>
        <input type="number" class="val-input" id="meta-emp-input" value="${metaEmpresa}" step="500" min="0" onchange="actualizarMetaEmpresa(this.value)" style="width:110px">
      </div>
    </div>
    <div style="background:var(--gray);border-radius:5px;height:24px;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;background:linear-gradient(90deg,var(--green),#4CAF50);width:${pctEmp}%;transition:width 0.4s;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;color:#FFF;font-size:11px;font-weight:600">${pctEmp > 8 ? pctEmp.toFixed(1) + '%' : ''}</div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11.5px">
      <span style="color:var(--green);font-weight:600">Vendido: ${fmtUSD(ventasEmpresa)}</span>
      <span style="color:var(--dgray)">Falta: <strong style="color:${faltaEmp > 0 ? 'var(--gold)' : 'var(--green)'}">${fmtUSD(faltaEmp)}</strong></span>
    </div>`;

      if (baseSug > 0) {
        html += `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);font-size:11px;color:var(--dgray)">
      <i class="ti ti-bulb"></i> Sugerencias sobre el mes anterior (${fmtUSD(baseSug)}):
      <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;margin:2px" onclick="sugerirMeta('conservadora')">Conservadora: ${fmtUSD(Math.round(baseSug * 0.9 / 100) * 100)}</button>
      <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;margin:2px" onclick="sugerirMeta('moderada')">Moderada: ${fmtUSD(Math.round(baseSug * 1.1 / 100) * 100)}</button>
      <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;margin:2px" onclick="sugerirMeta('agresiva')">Agresiva: ${fmtUSD(Math.round(baseSug * 1.3 / 100) * 100)}</button>
    </div>`;
      } else {
        html += `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);font-size:11px;color:var(--dgray)">
      <i class="ti ti-bulb"></i> Las sugerencias aparecen cuando haya ventas del mes anterior con qué compararse.
    </div>`;
      }
      html += `</div>`;

      // ── Metas por trabajador ──
      html += `<div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:500">Metas por trabajador</div>
      <button class="btn btn-secondary btn-sm" style="font-size:10.5px" onclick="abrirModalEquipo()"><i class="ti ti-plus"></i> Agregar</button>
    </div>`;

      // Quien aparece: el equipo asignado a esta empresa + cualquiera que haya
      // facturado (aunque no este en el equipo, para no esconder ventas reales).
      const delEquipo = EQUIPO
        .filter(t => t.empresa === 'ambas' || t.empresa === estado.empresa)
        .map(t => t.nombre);
      const lista = [...new Set(delEquipo.concat(Object.keys(ventasMesActual.vendedores)))].sort();

      if (lista.length === 0) {
        html += `<div style="padding:18px;text-align:center;color:var(--dgray);font-size:12px">
      Todavía no hay trabajadores en <strong>${nombreEmp}</strong>.<br>
      <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="abrirModalEquipo()"><i class="ti ti-user-plus"></i> Agregar el primero</button>
    </div>`;
      }

      const sumaMetas = lista.reduce((a, v) => a + (parseFloat(M.vendedores[v]) || 0), 0);

      lista.forEach(v => {
        const meta = parseFloat(M.vendedores[v]) || 0;
        const vendido = ventasMesActual.vendedores[v] || 0;
        const pct = meta > 0 ? Math.min(100, (vendido / meta) * 100) : 0;
        const falta = Math.max(0, meta - vendido);
        const cumplido = meta > 0 && vendido >= meta;
        const enEquipo = delEquipo.includes(v);
        html += `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px">
        <div style="display:flex;align-items:center;gap:6px;min-width:0">
          <i class="ti ti-user" style="color:var(--blue);flex-shrink:0"></i>
          <span style="font-weight:600;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v}</span>
          ${cumplido ? '<span style="background:var(--lgreen);color:var(--green);padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;flex-shrink:0">✓ CUMPLIDA</span>' : ''}
          ${!enEquipo ? '<span style="background:#FFF8E1;color:#5D4037;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;flex-shrink:0" title="Facturó pero no está en la lista de equipo">FUERA DEL EQUIPO</span>' : ''}
        </div>
        <input type="number" value="${meta}" step="500" min="0" onchange="actualizarMetaVendedor('${v.replace(/'/g, "\\'")}',this.value)" class="val-input" style="width:90px;flex-shrink:0">
      </div>
      <div style="background:var(--gray);border-radius:4px;height:14px;overflow:hidden">
        <div style="background:${cumplido ? 'linear-gradient(90deg,var(--green),#4CAF50)' : 'linear-gradient(90deg,var(--blue),var(--navy))'};height:100%;width:${pct}%;transition:width 0.4s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:11px;color:var(--dgray)">
        <span>${fmtUSD(vendido)}${meta > 0 ? ' (' + pct.toFixed(0) + '%)' : ''}</span>
        <span>${meta > 0 ? 'Falta ' + fmtUSD(falta) : 'Sin meta asignada'}</span>
      </div>
    </div>`;
      });

      // Aviso si la suma de metas individuales no cuadra con la meta de empresa.
      // Si la suma es menor, el equipo puede cumplir al 100% y la empresa fallar.
      if (lista.length > 0 && metaEmpresa > 0 && sumaMetas > 0) {
        const dif = sumaMetas - metaEmpresa;
        const pctDif = Math.abs(dif) / metaEmpresa * 100;
        if (pctDif >= 5) {
          const corta = dif < 0;
          html += `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);font-size:11.5px;color:${corta ? '#5D4037' : 'var(--dgray)'};background:${corta ? '#FFF8E1' : 'transparent'};border-radius:6px;padding:8px 10px">
      <i class="ti ti-${corta ? 'alert-triangle' : 'info-circle'}"></i>
      La suma de las metas individuales es <strong>${fmtUSD(sumaMetas)}</strong> contra ${fmtUSD(metaEmpresa)} de la empresa.
      ${corta ? 'Aunque <strong>todos cumplan</strong>, la empresa se queda ' + fmtUSD(Math.abs(dif)) + ' corta.' : 'Hay ' + fmtUSD(dif) + ' de colchón.'}
    </div>`;
        }
      }

      html += `</div>`;
      cont.innerHTML = html;
    }

    // Ventas del mes ANTERIOR en la empresa activa — base real para sugerir meta
    function ventasMesAnteriorEmpresa() {
      const hoy = new Date();
      const ini = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      let tot = 0;
      (TODAS_FACTURAS || []).forEach(f => {
        if (f.estado === 'anulada' || !f.fecha_raw) return;
        if (f.empresa !== estado.empresa) return;
        const d = new Date(f.fecha_raw);
        if (d >= ini && d < fin) tot += (f.total || 0);
      });
      return tot;
    }

    function etiquetaPeriodo(per) {
      const [a, m] = per.split('-');
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      return (meses[parseInt(m, 10) - 1] || m) + ' ' + a;
    }

    function cambiarPeriodoMetas(per) {
      metasPeriodo = per;
      renderMetas();
    }

    function actualizarMetaEmpresa(v) {
      const m = Math.max(0, parseFloat(v) || 0);
      const M = metasDe(metasPeriodoActivo());
      if (estado.empresa === 'directa') M.directa = m; else M.dist = m;
      renderMetas();
      guardarMetasSupabase();
      notif('Meta de empresa actualizada', 'success');
    }

    function actualizarMetaVendedor(v, val) {
      const M = metasDe(metasPeriodoActivo());
      const m = Math.max(0, parseFloat(val) || 0);
      if (m === 0) delete M.vendedores[v]; else M.vendedores[v] = m;
      renderMetas();
      guardarMetasSupabase();
      notif(`Meta de ${v} actualizada`, 'success');
    }

    function sugerirMeta(modalidad) {
      const base = ventasMesAnteriorEmpresa();
      if (base <= 0) { notif('No hay ventas del mes anterior para calcular la sugerencia', 'error'); return; }
      const factor = modalidad === 'conservadora' ? 0.9 : modalidad === 'moderada' ? 1.1 : 1.3;
      const nueva = Math.round(base * factor / 100) * 100;
      const M = metasDe(metasPeriodoActivo());
      if (estado.empresa === 'directa') M.directa = nueva; else M.dist = nueva;
      renderMetas();
      guardarMetasSupabase();
      notif(`Meta ajustada a ${fmtUSD(nueva)} (${modalidad})`, 'success');
    }


    function abrirModalEquipo() {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede gestionar el equipo', 'error'); return; }
      renderListaEquipo();
      document.getElementById('eq-nombre').value = '';
      document.getElementById('eq-empresa').value = estado.empresa;
      document.getElementById('modal-equipo').classList.add('show');
    }
    function cerrarModalEquipo() {
      document.getElementById('modal-equipo').classList.remove('show');
    }

    function renderListaEquipo() {
      const cont = document.getElementById('eq-lista');
      if (!cont) return;
      if (EQUIPO.length === 0) {
        cont.innerHTML = '<div style="padding:16px;text-align:center;color:var(--dgray);font-size:12px">Todavía no hay nadie en el equipo</div>';
        return;
      }
      const etq = { ambas: 'Ambas', directa: 'Venta Directa', dist: 'Distribuidora' };
      cont.innerHTML = EQUIPO.map((t, i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--border);gap:8px">
      <div style="min-width:0">
        <div style="font-weight:600;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.nombre}</div>
        <div style="font-size:10.5px;color:var(--dgray)">${etq[t.empresa] || t.empresa}</div>
      </div>
      <button class="btn btn-red btn-sm" onclick="quitarDelEquipo(${i})" title="Quitar del equipo"><i class="ti ti-trash"></i></button>
    </div>`).join('');
    }

    async function agregarAlEquipo() {
      const inp = document.getElementById('eq-nombre');
      const nombre = (inp.value || '').trim().toUpperCase();
      const empresa = document.getElementById('eq-empresa').value;
      if (!nombre) { notif('Escribe el nombre del trabajador', 'error'); return; }
      if (nombre.length < 3) { notif('El nombre es muy corto', 'error'); return; }
      if (EQUIPO.some(t => t.nombre === nombre)) { notif('Ese trabajador ya está en la lista', 'error'); return; }
      EQUIPO.push({ nombre, empresa });
      inp.value = '';
      renderListaEquipo();
      renderMetas();
      await guardarEquipoSupabase();
      logBitacora('config', `Agregó a ${nombre} al equipo (${empresa})`, false);
      notif(`${nombre} agregado al equipo`, 'success');
    }

    async function quitarDelEquipo(i) {
      const t = EQUIPO[i];
      if (!t) return;
      // Solo se saca de la LISTA. Las metas historicas y las facturas que emitio
      // NO se tocan: si vendio, va a seguir apareciendo marcado "fuera del equipo".
      if (!confirm(`¿Quitar a ${t.nombre} del equipo?\n\nSus ventas y metas anteriores NO se borran.`)) return;
      EQUIPO.splice(i, 1);
      renderListaEquipo();
      renderMetas();
      await guardarEquipoSupabase();
      logBitacora('config', `Quitó a ${t.nombre} del equipo`, false);
      notif(`${t.nombre} quitado del equipo`, 'warning');
    }

    async function guardarEquipoSupabase() {
      if (!_sb || !_supabaseConectado) { notif('Sin conexión: el cambio no se guardó', 'error'); return; }
      const { error } = await _sb.from('configuracion').update({ equipo: EQUIPO }).neq('id', 0);
      if (error) { console.error('[ARJ] guardarEquipo:', error); notif('Error guardando el equipo', 'error'); }
    }

    async function guardarMetasSupabase() {
      if (!_sb || !_supabaseConectado) { notif('Sin conexión: la meta no se guardó', 'error'); return; }
      const { error } = await _sb.from('configuracion').update({ metas_hist: METAS_HIST }).neq('id', 0);
      if (error) { console.error('[ARJ] guardarMetas:', error); notif('Error guardando la meta', 'error'); }
    }

    // ═══════════════════════════════════════════════════════════════
    // BITÁCORA — registro de actividad
    // ═══════════════════════════════════════════════════════════════

    function renderUsuariosConfig() {
      const tbody = document.getElementById('usuarios-body');
      if (!tbody) return;
      tbody.innerHTML = Object.entries(USUARIOS).map(([login, u]) => {
        let empBadge;
        if (u.empresa === 'ambas') empBadge = '<span style="background:var(--lgold);color:#854F0B;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:600">AMBAS</span>';
        else if (u.empresa === 'directa') empBadge = '<span style="background:var(--lblue);color:var(--blue);padding:2px 8px;border-radius:8px;font-size:10px;font-weight:600">VENTA DIRECTA</span>';
        else empBadge = '<span style="background:var(--lgreen);color:var(--green);padding:2px 8px;border-radius:8px;font-size:10px;font-weight:600">DISTRIBUIDORA</span>';
        const isCurrent = estado.usuario === u.nombre;
        return `<tr>
      <td><strong>${u.nombre}</strong><div style="font-size:10px;color:var(--dgray)">${login}</div></td>
      <td>${u.rol.toUpperCase()}</td>
      <td>${empBadge}</td>
      <td>${isCurrent ? '<span style="color:var(--green);font-weight:600">● Tú</span>' : '<span style="color:var(--dgray)">Inactivo</span>'}</td>
    </tr>`;
      }).join('');
    }
