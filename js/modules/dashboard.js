// === Dashboard y Reportes ===
    function renderComparativa() {
      const cont = document.getElementById('comparativa-content');
      if (!cont) return;
      cont.innerHTML = '<div style="padding:20px;text-align:center;color:var(--dgray);font-size:13px">Sin ventas registradas todavía</div>';
      return;
      // Datos demo de cada empresa
      const datos = {
        directa: { ventas_mes: 47823, facturas: 128, margen: 42.8, clientes: 24, porcobrar: 5972, stockcritico: 7, ticket: 373 },
        dist: { ventas_mes: 68450, facturas: 64, margen: 38.2, clientes: 18, porcobrar: 8835, stockcritico: 12, ticket: 1070 },
      };
      const fila = (label, vd, dt, fmt, mejorMayor = true) => {
        const vdN = parseFloat(vd), dtN = parseFloat(dt);
        const vdMejor = mejorMayor ? vdN > dtN : vdN < dtN;
        return `<tr>
      <td style="font-weight:500">${label}</td>
      <td class="num" style="${vdMejor ? 'color:var(--green);font-weight:700' : ''}">${fmt(vd)}</td>
      <td class="num" style="${!vdMejor ? 'color:var(--green);font-weight:700' : ''}">${fmt(dt)}</td>
    </tr>`;
      };
      cont.innerHTML = `
    <table class="simple-tbl" style="margin-top:8px">
      <thead><tr><th>Indicador</th><th class="num" style="color:var(--blue)">Venta Directa</th><th class="num" style="color:var(--green)">Distribuidora</th></tr></thead>
      <tbody>
        ${fila('Ventas del mes', datos.directa.ventas_mes, datos.dist.ventas_mes, fmtUSD)}
        ${fila('N° de facturas', datos.directa.facturas, datos.dist.facturas, x => x)}
        ${fila('Ticket promedio', datos.directa.ticket, datos.dist.ticket, fmtUSD)}
        ${fila('Margen bruto %', datos.directa.margen, datos.dist.margen, x => x + '%')}
        ${fila('Clientes activos', datos.directa.clientes, datos.dist.clientes, x => x)}
        ${fila('Por cobrar', datos.directa.porcobrar, datos.dist.porcobrar, fmtUSD, false)}
        ${fila('Productos en stock crítico', datos.directa.stockcritico, datos.dist.stockcritico, x => x, false)}
      </tbody>
    </table>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px">
      <div style="background:var(--lblue);border-radius:8px;padding:14px;text-align:center">
        <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:600">TOTAL CONSOLIDADO MES</div>
        <div style="font-size:24px;font-weight:700;color:var(--navy);margin-top:4px">${fmtUSD(datos.directa.ventas_mes + datos.dist.ventas_mes)}</div>
        <div style="font-size:11px;color:var(--dgray)">${datos.directa.facturas + datos.dist.facturas} facturas combinadas</div>
      </div>
      <div style="background:var(--lgreen);border-radius:8px;padding:14px;text-align:center">
        <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:600">POR COBRAR CONSOLIDADO</div>
        <div style="font-size:24px;font-weight:700;color:var(--red);margin-top:4px">${fmtUSD(datos.directa.porcobrar + datos.dist.porcobrar)}</div>
        <div style="font-size:11px;color:var(--dgray)">entre ambas empresas</div>
      </div>
    </div>
    <div style="background:#FFF8E1;border-left:3px solid var(--gold);border-radius:6px;padding:10px 14px;margin-top:12px;font-size:12px;color:#5D4037">
      <i class="ti ti-bulb"></i> <strong>Observación:</strong> Distribuidora vende más en dinero ($68K vs $48K) con menos facturas (64 vs 128), porque su ticket promedio es 3× mayor. Venta Directa tiene mejor margen (42,8% vs 38,2%) pero más clientes por atender.
    </div>`;
    }

    // ─── RANKING DE CLIENTES ───
    // ═══ RANKING DE CLIENTES — DATOS REALES (v13.2) ═══
    // Lee de TODAS_FACTURAS, que ya viene de Supabase. NO hace consulta nueva.
    // Filtra por la empresa activa: mezclar Venta Directa con Distribuidora
    // daria un top falso, porque son dos negocios con precios distintos.
    function renderRanking() {
      const cont = document.getElementById('ranking-content');
      if (!cont) return;

      const hoy = new Date();
      const mes0 = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

      // acumulador: por cliente, del mes y de siempre
      const porCliente = {};
      (TODAS_FACTURAS || []).forEach(f => {
        if (f.estado === 'anulada' || !f.fecha_raw) return;
        if (f.empresa !== estado.empresa) return;
        const nom = f.cliente_nombre_snap || f.cliente || 'Sin cliente';
        if (!porCliente[nom]) porCliente[nom] = { nombre: nom, mes: 0, comprasMes: 0, ultima: null, totalHist: 0, comprasHist: 0 };
        const c = porCliente[nom];
        const fch = new Date(f.fecha_raw);
        const t = f.total || 0;
        c.totalHist += t; c.comprasHist++;
        if (!c.ultima || fch > c.ultima) c.ultima = fch;
        if (fch >= mes0) { c.mes += t; c.comprasMes++; }
      });

      const todos = Object.values(porCliente);
      const top = todos.filter(c => c.mes > 0).sort((a, b) => b.mes - a.mes).slice(0, 5);

      // "Dejo de comprar" = compro al menos 2 veces (para tener un patron) y
      // lleva mas dias sin comprar que el DOBLE de su frecuencia habitual.
      // Un cliente que compra cada 60 dias no esta perdido a los 31 dias.
      const dormidos = todos.filter(c => {
        if (c.comprasHist < 2 || !c.ultima) return false;
        const dias = Math.floor((hoy - c.ultima) / 86400000);
        return dias >= 30;
      }).map(c => {
        const dias = Math.floor((hoy - c.ultima) / 86400000);
        return { ...c, dias, prom: Math.round(c.totalHist / c.comprasHist) };
      }).sort((a, b) => b.dias - a.dias).slice(0, 6);

      const fechaCorta = d => d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
      const medallas = ['🥇', '🥈', '🥉', '4', '5'];
      const maxTotal = top.length ? top[0].mes : 1;

      let izq;
      if (top.length === 0) {
        izq = '<div style="padding:20px;text-align:center;color:var(--dgray);font-size:12.5px">Nadie ha comprado este mes en ' + nombreEmpresa(estado.empresa) + '</div>';
      } else {
        izq = top.map((c, i) => {
          const pct = (c.mes / maxTotal * 100).toFixed(0);
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
              <span style="font-size:12.5px;font-weight:500"><span style="display:inline-block;width:20px">${medallas[i]}</span> ${c.nombre}</span>
              <span style="font-weight:700;color:var(--navy);font-size:13px">${fmtUSD(c.mes)}</span>
            </div>
            <div style="background:var(--gray);border-radius:4px;height:8px;margin-left:24px"><div style="background:linear-gradient(90deg,var(--gold),#E0B020);height:100%;width:${pct}%;border-radius:4px"></div></div>
            <div style="font-size:10.5px;color:var(--dgray);margin-left:24px;margin-top:2px">${c.comprasMes} ${c.comprasMes === 1 ? 'compra' : 'compras'} este mes · última ${fechaCorta(c.ultima)}</div>
          </div>`;
        }).join('');
      }

      let der;
      if (dormidos.length === 0) {
        der = '<div style="padding:20px;text-align:center;color:var(--dgray);font-size:12.5px">Ningún cliente lleva más de 30 días sin comprar</div>';
      } else {
        der = dormidos.map(c => `
          <div style="background:#FEF5F5;border:1px solid #F5C0C0;border-radius:8px;padding:10px 12px;margin-bottom:8px">
            <div style="font-weight:600;font-size:12.5px;color:#222">${c.nombre}</div>
            <div style="font-size:11px;color:var(--red);font-weight:500;margin:2px 0">⚠ ${c.dias} días sin comprar</div>
            <div style="font-size:10.5px;color:var(--dgray)">${c.comprasHist} compras históricas · ticket promedio ${fmtUSD(c.prom)} · última ${fechaCorta(c.ultima)}</div>
          </div>`).join('');
      }

      cont.innerHTML = `
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px">
      <div>
        <h3 style="font-size:13px;color:var(--navy);font-weight:600;margin-bottom:10px"><i class="ti ti-trophy" style="color:var(--gold)"></i> Top 5 compradores del mes · ${nombreEmpresa(estado.empresa)}</h3>
        ${izq}
      </div>
      <div>
        <h3 style="font-size:13px;color:var(--red);font-weight:600;margin-bottom:10px"><i class="ti ti-alert-triangle"></i> Clientes que dejaron de comprar</h3>
        ${der}
      </div>
    </div>`;
    }

    // ─── PREDICTIVAS DE REORDEN ───
    function renderReorden() {
      const cont = document.getElementById('reorden-content');
      if (!cont) return;
      cont.innerHTML = '<div style="padding:20px;text-align:center;color:var(--dgray);font-size:13px">El cálculo de reorden se activará cuando haya historial de ventas real</div>';
      return;
      // Calcular productos que se van a agotar según stock y rotación demo
      const rotacion = { "STH-7842": 0.6, "LON-0089": 0.4, "BAR-3344": 0.3, "MP-9912": 0.5, "STH-9001": 0.2, "MP-4499": 0.35 };
      const items = PRODUCTOS.map(p => {
        const stock = estado.empresa === 'directa' ? p.stock_vd : p.stock_dist;
        const rot = rotacion[p.cod_alt] || 1.5;
        const diasRestantes = Math.round(stock / rot);
        return { ...p, stock, rot, diasRestantes };
      }).filter(p => p.diasRestantes <= 30).sort((a, b) => a.diasRestantes - b.diasRestantes);

      if (items.length === 0) {
        cont.innerHTML = '<div style="padding:30px;text-align:center;color:var(--dgray)">No hay productos próximos a agotarse en ' + nombreEmpresa(estado.empresa) + '.</div>';
        return;
      }
      cont.innerHTML = `
    <div style="background:#EBF3FB;border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--navy)">
      <i class="ti ti-bulb"></i> El sistema calcula cuántos días faltan para agotar cada producto según su ritmo de venta. El tiempo de reposición habitual desde Brasil/China es de <strong>45 días</strong>, así que pide con anticipación.
    </div>
    <table class="simple-tbl">
      <thead><tr><th>Producto</th><th class="num">Stock actual</th><th class="num">Venta/día</th><th class="num">Se agota en</th><th class="num">Pedido sugerido</th><th>Urgencia</th></tr></thead>
      <tbody>
        ${items.map(p => {
        const sugerido = Math.ceil(p.rot * 60); // 60 días de cobertura
        let urgencia, color;
        if (p.diasRestantes <= 7) { urgencia = 'CRÍTICO'; color = 'var(--red)'; }
        else if (p.diasRestantes <= 15) { urgencia = 'PRONTO'; color = 'var(--gold)'; }
        else { urgencia = 'PLANIFICAR'; color = 'var(--blue)'; }
        return `<tr>
            <td><strong>${p.cod_alt}</strong><div style="font-size:10.5px;color:var(--dgray)">${p.desc}</div></td>
            <td class="num">${p.stock}</td>
            <td class="num">${p.rot}</td>
            <td class="num" style="font-weight:700;color:${color}">${p.diasRestantes} días</td>
            <td class="num"><strong>${sugerido} ud</strong></td>
            <td><span style="background:${color}22;color:${color};padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:600">${urgencia}</span></td>
          </tr>`;
      }).join('')}
      </tbody>
    </table>
    <div style="margin-top:12px;text-align:right">

    </div>`;
    }


    // ─── SUB-NAVEGACIÓN DE REPORTES ───
    function cambiarSubReporte(sub) {
      document.querySelectorAll('[data-subrep]').forEach(b => b.classList.toggle('active', b.dataset.subrep === sub));
      document.querySelectorAll('.sub-reporte').forEach(s => s.style.display = 'none');
      const el = document.getElementById('subrep-' + sub);
      if (el) el.style.display = 'block';
      if (sub === 'comparativa') renderComparativa();
      if (sub === 'ranking') renderRanking();
      if (sub === 'reorden') renderReorden();
      if (sub === 'backup') renderBackup();
    }




    function actualizarKpisReportes() {
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      const ahora = new Date();
      const hoy0 = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      const mes0 = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

      const validas = (TODAS_FACTURAS || []).filter(f =>
        f.empresa === estado.empresa && f.estado !== 'anulada' && f.fecha_raw);

      let totHoy = 0, nHoy = 0, totMes = 0, nMes = 0;
      validas.forEach(f => {
        const d = new Date(f.fecha_raw);
        if (d >= hoy0) { totHoy += f.total || 0; nHoy++; }
        if (d >= mes0) { totMes += f.total || 0; nMes++; }
      });

      set('rep-ventas-hoy', fmtUSD(totHoy));
      set('rep-ventas-hoy-sub', nHoy === 0 ? 'Sin ventas hoy' : nHoy + (nHoy === 1 ? ' factura' : ' facturas'));
      set('rep-ventas-mes', fmtUSD(totMes));
      set('rep-ventas-mes-sub', nMes === 0 ? 'Sin ventas este mes' : nMes + (nMes === 1 ? ' factura' : ' facturas'));

      // Margen promedio: se estima con el precio de lista vs el FOB del catálogo,
      // ponderado por lo vendido este mes. Es aproximado — el margen exacto por
      // factura exigiría leer factura_items de cada una.
      let ingreso = 0, costo = 0;
      (PRODUCTOS || []).forEach(p => {
        const pr = precioConTier(p.fob, 'Publico', p);
        if (pr > 0 && p.fob > 0) { ingreso += pr; costo += costoLanded(p); }
      });
      if (ingreso > 0) {
        const margen = ((ingreso - costo) / ingreso) * 100;
        set('rep-margen', margen.toFixed(1) + '%');
        set('rep-margen-sub', 'Teórico — todo a precio de lista');
      } else {
        set('rep-margen', '0%');
        set('rep-margen-sub', 'Sin datos aún');
      }

      // ═══ VENTAS DEL MES POR EMPRESA Y POR VENDEDOR (v13.1) ═══
      // Antes ventasMesActual nacía en cero y nadie lo llenaba: por eso la meta
      // decía "Vendido $0" aunque hubiera facturas. Se recalcula desde las
      // facturas reales cada vez que se pintan los KPIs.
      ventasMesActual.directa = 0;
      ventasMesActual.dist = 0;
      Object.keys(ventasMesActual.vendedores).forEach(k => delete ventasMesActual.vendedores[k]);
      (TODAS_FACTURAS || []).forEach(f => {
        if (f.estado === 'anulada' || !f.fecha_raw) return;
        if (new Date(f.fecha_raw) < mes0) return;
        const t = f.total || 0;
        if (f.empresa === 'directa') ventasMesActual.directa += t; else ventasMesActual.dist += t;
        // El panel de vendedores acompaña a la meta de la empresa activa,
        // así que solo suma lo vendido en esa empresa.
        if (f.empresa === estado.empresa) {
          const v = f.vendedor || 'Sin vendedor';
          ventasMesActual.vendedores[v] = (ventasMesActual.vendedores[v] || 0) + t;
        }
      });
      if (typeof renderMetas === 'function') renderMetas();
      renderComparativaMeses();

      cargarUtilidadMes(totMes);
    }

    // ═══ COMPARATIVA MES ACTUAL vs MES ANTERIOR (v13.1) ═══
    function renderComparativaMeses() {
      const cont = document.getElementById('comp-meses-content');
      if (!cont) return;
      const ahora = new Date();
      const mes0 = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const mesAnt0 = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
      let act = 0, nAct = 0, ant = 0, nAnt = 0;
      (TODAS_FACTURAS || []).forEach(f => {
        if (f.empresa !== estado.empresa || f.estado === 'anulada' || !f.fecha_raw) return;
        const d = new Date(f.fecha_raw);
        if (d >= mes0) { act += f.total || 0; nAct++; }
        else if (d >= mesAnt0) { ant += f.total || 0; nAnt++; }
      });
      const nombreMes = d => d.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
      const tope = Math.max(act, ant, 1);
      const barra = (val, n, etiqueta, color) => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">
        <span style="color:var(--dgray);text-transform:capitalize">${etiqueta}</span>
        <span style="font-weight:600;color:var(--navy)">${fmtUSD(val)} · ${n} ${n === 1 ? 'factura' : 'facturas'}</span>
      </div>
      <div style="background:var(--gray);border-radius:5px;height:20px;overflow:hidden">
        <div style="background:${color};height:100%;width:${(val / tope) * 100}%;transition:width .4s"></div>
      </div>
    </div>`;
      let pie;
      if (ant === 0 && act === 0) {
        pie = '<div style="font-size:11.5px;color:var(--dgray)">Sin ventas en ninguno de los dos meses.</div>';
      } else if (ant === 0) {
        pie = '<div style="font-size:11.5px;color:var(--dgray)">No hay mes anterior con ventas: todavía no se puede comparar.</div>';
      } else {
        const varPct = ((act - ant) / ant) * 100;
        const sube = varPct >= 0;
        pie = `<div style="font-size:12px;padding-top:8px;border-top:1px dashed var(--border)">
      <span style="color:${sube ? 'var(--green)' : 'var(--red)'};font-weight:600">${sube ? '▲' : '▼'} ${Math.abs(varPct).toFixed(1)}%</span>
      <span style="color:var(--dgray)"> respecto al mes anterior · diferencia ${fmtUSD(Math.abs(act - ant))}</span>
    </div>`;
      }
      cont.innerHTML = '<div style="padding:4px 2px">'
        + barra(act, nAct, nombreMes(mes0) + ' (en curso)', 'linear-gradient(90deg,var(--blue),var(--navy))')
        + barra(ant, nAnt, nombreMes(mesAnt0), 'var(--dgray)')
        + pie + '</div>';
    }

    // ═══ PRODUCTOS MÁS VENDIDOS DEL MES (v13.1) ═══
    // Recibe los renglones que ya trajo cargarUtilidadMes: una sola consulta
    // alimenta la utilidad y este ranking.
    // ═══════════════════════════════════════════════════════════════
    // IMPORTADO vs LOCAL (v13.28) — sobre lo EFECTIVAMENTE vendido.
    // Lee el `origen` congelado en el renglon; si el renglon es viejo y no
    // lo trae, origenDe() lo deduce. Los renglones deducidos se cuentan y se
    // avisan: un numero estimado que se presenta como medido es peor que
    // ningun numero.
    // ═══════════════════════════════════════════════════════════════
    function renderOrigenMes(its, etiqueta) {
      const cont = document.getElementById('rep-origen-content');
      if (!cont) return;
      // v13.35: la etiqueta viene del selector. Sin ella se asume el mes en
      // curso, que es como se llamaba esta funcion antes.
      const per = etiqueta || 'este mes';
      const lbl = document.getElementById('rep-origen-lbl');
      if (lbl) lbl.textContent = '— ' + per.charAt(0).toUpperCase() + per.slice(1);
      if (its == null) { cont.innerHTML = '<div style="padding:14px;text-align:center;color:var(--dgray)">Sin conexión a la base.</div>'; return; }
      if (its.length === 0) { cont.innerHTML = '<div style="padding:14px;text-align:center;color:var(--dgray)">Sin ventas en ' + per + '.</div>'; return; }

      const Z = () => ({ venta: 0, costo: 0, uds: 0, lineas: 0, verde: 0 });
      const g = { importado: Z(), local: Z() };
      let deducidos = 0, sinCosto = 0;
      its.forEach(i => {
        const cant = parseFloat(i.cantidad) || 0;
        const fob = parseFloat(i.fob_unitario) || 0;
        const fac = parseFloat(i.factor_landed);
        const f = (isFinite(fac) && fac > 0) ? fac : FACTOR_LANDED_FALLBACK;
        const o = (i.origen || '').toString().trim().toLowerCase();
        if (o !== 'local' && o !== 'importado') deducidos++;
        if (fob <= 0) sinCosto++;
        const k = origenDe(i);
        // v13.37: equivalente en efectivo con la brecha congelada de la factura
        const fv = (typeof _factorVerde === 'function') ? _factorVerde(i.factura_id) : null;
        if (fv != null) g[k].verde += (parseFloat(i.total_linea) || 0) * fv;
        g[k].venta += parseFloat(i.total_linea) || 0;
        g[k].costo += fob * f * cant;
        g[k].uds += cant;
        g[k].lineas++;
      });
      const tot = { venta: g.importado.venta + g.local.venta, costo: g.importado.costo + g.local.costo };
      tot.util = tot.venta - tot.costo;
      ['importado', 'local'].forEach(k => { g[k].util = g[k].venta - g[k].costo; g[k].mg = g[k].venta > 0 ? g[k].util / g[k].venta * 100 : 0; });
      const pc = (x, b) => b > 0 ? (x / b * 100).toFixed(1) + '%' : '—';

      const bloque = (nom, c, col, icono) => {
        const w = tot.venta > 0 ? (c.venta / tot.venta * 100) : 0;
        return '<div style="flex:1 1 210px;background:' + col + ';border-radius:8px;padding:10px 12px">'
          + '<div style="font-size:11px;color:var(--dgray);text-transform:uppercase;letter-spacing:.4px;font-weight:600">'
          + icono + ' ' + nom + '</div>'
          + '<div style="font-size:20px;font-weight:800;color:var(--navy);line-height:1.25">' + fmtUSD(c.venta) + '</div>'
          + '<div style="font-size:11.5px;color:var(--dgray);margin-bottom:6px">' + pc(c.venta, tot.venta)
          + ' de la venta &middot; ' + c.uds.toLocaleString('es-VE') + ' uds &middot; ' + c.lineas + ' renglones</div>'
          + '<div style="height:5px;background:#FFF;border-radius:3px;overflow:hidden;margin-bottom:6px">'
          + '<div style="height:100%;width:' + w.toFixed(1) + '%;background:var(--gold)"></div></div>'
          + '<div style="font-size:12px;line-height:1.6">Costo <strong>' + fmtUSD(c.costo) + '</strong><br>'
          + 'Utilidad <strong style="color:' + (c.util >= 0 ? '#1E7B34' : '#B00020') + '">' + fmtUSD(c.util)
          + '</strong> &middot; margen <strong>' + c.mg.toFixed(1) + '%</strong><br>'
          + '<span style="color:var(--dgray)">Aporta ' + pc(c.util, tot.util) + ' de la utilidad</span>'
          + (c.verde > 0 ? '<br><span style="color:#1E7B34;font-weight:600">≈ ' + fmtUSD(c.verde)
            + ' en efectivo verde</span>' : '') + '</div></div>';
      };

      let h = '<div style="display:flex;flex-wrap:wrap;gap:10px">'
        + bloque('Importado', g.importado, '#EAF0F8', '<i class="ti ti-ship"></i>')
        + bloque('Compra local', g.local, '#FBF3E0', '<i class="ti ti-building-store"></i>')
        + '</div>';

      if (g.local.venta > 0 && g.importado.venta > 0) {
        const dif = g.importado.mg - g.local.mg;
        h += '<div style="margin-top:9px;font-size:12px;color:var(--dgray);line-height:1.5">'
          + 'El margen de <strong>' + (dif >= 0 ? 'importado' : 'local') + '</strong> es '
          + Math.abs(dif).toFixed(1) + ' puntos mayor. Utilidad total del mes: <strong>' + fmtUSD(tot.util) + '</strong>.</div>';
      }
      let av = [];
      if (deducidos > 0) av.push('<strong>' + deducidos + ' renglón(es) sin origen guardado</strong> — clasificados por el factor congelado, es una deducción');
      if (sinCosto > 0) av.push('<strong>' + sinCosto + ' renglón(es) sin costo</strong> — su margen sale inflado');
      if (av.length) {
        h += '<div style="margin-top:8px;padding:8px 10px;border-radius:6px;background:#FFF4E5;border-left:3px solid #BF8F00;font-size:11.5px;line-height:1.5">⚠ '
          + av.join('<br>⚠ ') + '</div>';
      }
      h += '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">'
        + '<button class="btn btn-sm" style="background:var(--navy);color:#FFF" onclick="toggleDetalleOrigen()">'
        + '<i class="ti ti-list-search"></i> Ver qué productos son</button>'
        + '<button class="btn btn-sm btn-secondary" onclick="descargarDetalleOrigen()">'
        + '<i class="ti ti-download"></i> Descargar detalle CSV</button></div>';
      cont.innerHTML = h;
    }

    // ═══════════════════════════════════════════════════════════════
    // SELECTOR DE PERIODO — IMPORTADO vs LOCAL (v13.35)
    //
    // NO reutiliza TODAS_FACTURAS: ese arreglo esta limitado a las ultimas
    // 500 facturas, asi que para rangos largos daria un numero INCOMPLETO sin
    // avisar. Se consulta Supabase directo, paginando.
    //
    // Sobre la frontera de fechas: se filtra con 'YYYY-MM-DD'. Si `fecha` es
    // timestamptz, el corte cae a medianoche UTC = 8:00 pm de Venezuela. Una
    // factura emitida despues de las 8 pm del ultimo dia del rango caeria en
    // el periodo siguiente. Con el horario del negocio esto no ocurre, pero
    // queda dicho por si algun dia se factura de noche.
    // ═══════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════
    // $BCV → $VERDE (v13.37)
    //
    // Las dos monedas del sistema. El precio se factura en $BCV; el efectivo
    // que entra a la caja son $verdes. La conversion usa la brecha CONGELADA
    // de cada factura (tasa_bcv / tasa_par), no la de hoy: una venta de hace
    // tres semanas se cobro con la brecha de ese dia.
    //
    // ESTO ES UN EQUIVALENTE, NO UNA COBRANZA. Dice cuanto efectivo saldaria
    // esa venta si se cobrara en divisas. Si el cliente paga en bolivares,
    // entra el monto $BCV en Bs y esta cifra no aplica. Por eso se rotula
    // siempre como "si se cobra en efectivo".
    // ═══════════════════════════════════════════════════════════════
    const _FMAP = {};              // factura_id → { numero, fecha, tasas… }
    let _ORIGEN_DATA = null;       // ultimo resultado cargado

    function _factorVerde(fid) {
      const f = _FMAP[fid];
      if (!f) return null;
      const tp = parseFloat(f.tasa_par), tb = parseFloat(f.tasa_bcv);
      if (!isFinite(tp) || !isFinite(tb) || tp <= 0 || tb <= 0 || tb > tp) return null;
      return tb / tp;
    }

    function toggleDetalleOrigen() {
      const d = document.getElementById('rep-origen-detalle');
      if (!d) return;
      const abrir = d.style.display !== 'block';
      d.style.display = abrir ? 'block' : 'none';
      if (abrir) renderDetalleOrigen();
    }

    // Agrupa por PRODUCTO, no por renglon: lo que el jefe pregunta es "cuales
    // productos", no "cuales lineas de factura".
    function _agruparProductos(its) {
      const acc = {};
      its.forEach(i => {
        const k = (i.cod_alt || '—') + '|' + (i.descripcion || '');
        if (!acc[k]) acc[k] = {
          cod: i.cod_alt || '—', desc: i.descripcion || '', origen: origenDe(i),
          uds: 0, venta: 0, verde: 0, costo: 0, sinTasa: 0
        };
        const a = acc[k];
        const cant = parseFloat(i.cantidad) || 0;
        const vta = parseFloat(i.total_linea) || 0;
        const fob = parseFloat(i.fob_unitario) || 0;
        const fac = parseFloat(i.factor_landed);
        a.uds += cant;
        a.venta += vta;
        a.costo += fob * ((isFinite(fac) && fac > 0) ? fac : FACTOR_LANDED_FALLBACK) * cant;
        const fv = _factorVerde(i.factura_id);
        if (fv == null) a.sinTasa++; else a.verde += vta * fv;
      });
      return Object.values(acc).sort((x, y) => y.venta - x.venta);
    }

    function renderDetalleOrigen() {
      const cont = document.getElementById('rep-origen-detalle');
      if (!cont) return;
      if (!_ORIGEN_DATA || !_ORIGEN_DATA.its || _ORIGEN_DATA.its.length === 0) {
        cont.innerHTML = '<div style="padding:14px;text-align:center;color:var(--dgray);font-size:12.5px">'
          + 'Escoge un período con ventas y vuelve a abrir el detalle.</div>';
        return;
      }
      const prods = _agruparProductos(_ORIGEN_DATA.its);
      const tabla = (titulo, lista, col) => {
        if (!lista.length) return '';
        const tV = lista.reduce((a, p) => a + p.venta, 0);
        const tW = lista.reduce((a, p) => a + p.verde, 0);
        let h = '<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:700;color:var(--navy);'
          + 'background:' + col + ';padding:6px 9px;border-radius:6px 6px 0 0">' + titulo
          + ' — ' + lista.length + ' producto(s) · ' + fmtUSD(tV) + ' $BCV · ≈ ' + fmtUSD(tW) + ' verde</div>'
          + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px">'
          + '<thead><tr style="background:#F7F7F7;color:var(--dgray)">'
          + '<th style="text-align:left;padding:5px 7px">Código</th>'
          + '<th style="text-align:left;padding:5px 7px">Descripción</th>'
          + '<th style="text-align:right;padding:5px 7px">Uds</th>'
          + '<th style="text-align:right;padding:5px 7px">Venta $BCV</th>'
          + '<th style="text-align:right;padding:5px 7px">≈ $verde</th>'
          + '<th style="text-align:right;padding:5px 7px">Costo</th>'
          + '<th style="text-align:right;padding:5px 7px">Utilidad</th>'
          + '<th style="text-align:right;padding:5px 7px">Margen</th></tr></thead><tbody>';
        lista.slice(0, 60).forEach(p => {
          const u = p.venta - p.costo;
          const m = p.venta > 0 ? (u / p.venta * 100) : 0;
          h += '<tr style="border-bottom:1px solid var(--border)">'
            + '<td style="padding:4px 7px;font-family:monospace">' + p.cod + '</td>'
            + '<td style="padding:4px 7px">' + p.desc + '</td>'
            + '<td style="padding:4px 7px;text-align:right">' + p.uds.toLocaleString('es-VE') + '</td>'
            + '<td style="padding:4px 7px;text-align:right;font-weight:600">' + fmtUSD(p.venta) + '</td>'
            + '<td style="padding:4px 7px;text-align:right;color:#1E7B34">' + (p.sinTasa ? '—' : fmtUSD(p.verde)) + '</td>'
            + '<td style="padding:4px 7px;text-align:right;color:var(--dgray)">' + fmtUSD(p.costo) + '</td>'
            + '<td style="padding:4px 7px;text-align:right;color:' + (u >= 0 ? '#1E7B34' : '#B00020') + '">' + fmtUSD(u) + '</td>'
            + '<td style="padding:4px 7px;text-align:right">' + m.toFixed(1) + '%</td></tr>';
        });
        h += '</tbody></table></div>';
        if (lista.length > 60) h += '<div style="font-size:11px;color:var(--dgray);padding:5px 7px">'
          + 'Mostrando los 60 de mayor venta. El CSV los trae todos.</div>';
        return h + '</div>';
      };
      cont.innerHTML =
        tabla('<i class="ti ti-ship"></i> IMPORTADO', prods.filter(p => p.origen === 'importado'), '#EAF0F8')
        + tabla('<i class="ti ti-building-store"></i> COMPRA LOCAL', prods.filter(p => p.origen === 'local'), '#FBF3E0')
        + '<div style="font-size:11px;color:var(--dgray);line-height:1.5;padding:6px 2px">'
        + 'La columna <strong>≈ $verde</strong> es un equivalente: cuánto efectivo en divisas saldaría esa venta '
        + 'con la brecha congelada de cada factura. Si el cliente pagó en bolívares, no aplica.</div>';
    }

    // CSV a nivel de RENGLON: una fila por producto por factura, para poder
    // rastrear cualquier cifra hasta su documento de origen.
    function descargarDetalleOrigen() {
      if (!_ORIGEN_DATA || !_ORIGEN_DATA.its || !_ORIGEN_DATA.its.length) {
        notif('No hay datos cargados para ese período', 'error'); return;
      }
      const filas = [['DETALLE DE VENTAS POR ORIGEN — ' + _ORIGEN_DATA.etiqueta],
      ['Empresa: ' + (estado.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora')
        + ' · ' + _ORIGEN_DATA.nFacts + ' factura(s)'],
      ['Los $BCV y los $verdes son unidades distintas. NO se suman entre si.'], [],
      ['Factura', 'Fecha', 'Cliente', 'Código', 'Descripción', 'Origen', 'Cantidad',
        'Venta $BCV', '≈ $verde', 'Costo $BCV', 'Utilidad $BCV', 'Margen %', 'Cobro verde acordado']];
      let tV = 0, tW = 0, tC = 0, sinTasa = 0;
      _ORIGEN_DATA.its.forEach(i => {
        const f = _FMAP[i.factura_id] || {};
        const cant = parseFloat(i.cantidad) || 0;
        const vta = parseFloat(i.total_linea) || 0;
        const fob = parseFloat(i.fob_unitario) || 0;
        const fl = parseFloat(i.factor_landed);
        const costo = fob * ((isFinite(fl) && fl > 0) ? fl : FACTOR_LANDED_FALLBACK) * cant;
        const util = vta - costo;
        const fv = _factorVerde(i.factura_id);
        if (fv == null) sinTasa++;
        const verde = fv == null ? null : vta * fv;
        tV += vta; tC += costo; if (verde != null) tW += verde;
        filas.push([
          f.numero || '', f.fecha ? new Date(f.fecha).toLocaleDateString('es-VE') : '',
          f.cliente_nombre || '', i.cod_alt || '', i.descripcion || '', origenDe(i),
          cant.toFixed(2), vta.toFixed(2), verde == null ? '' : verde.toFixed(2),
          costo.toFixed(2), util.toFixed(2), vta > 0 ? (util / vta * 100).toFixed(1) : '',
          (f.cobrar_verde != null && f.cobrar_verde > 0) ? parseFloat(f.cobrar_verde).toFixed(2) : ''
        ]);
      });
      filas.push([]);
      filas.push(['TOTAL VENTA $BCV', '', '', '', '', '', '', tV.toFixed(2)]);
      filas.push(['TOTAL COSTO $BCV', '', '', '', '', '', '', tC.toFixed(2)]);
      filas.push(['TOTAL UTILIDAD $BCV', '', '', '', '', '', '', (tV - tC).toFixed(2)]);
      filas.push(['EQUIVALENTE EN $VERDE (si todo se cobra en efectivo)', '', '', '', '', '', '', '', tW.toFixed(2)]);
      if (sinTasa > 0) filas.push([sinTasa + ' renglon(es) sin tasas congeladas: no se pudo convertir a verde']);
      _descargarCSV('ARJ_detalle_origen_' + _hoyArchivo() + '.csv', filas);
      notif(_ORIGEN_DATA.its.length + ' renglones descargados', 'success');
    }

    function _fISO(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        + '-' + String(d.getDate()).padStart(2, '0');
    }

    // Devuelve { desde, hastaExcl, etiqueta } — hastaExcl es el dia SIGUIENTE
    // al ultimo del rango, para poder usar `lt` y no perder el ultimo dia.
    function _rangoOrigen() {
      const sel = document.getElementById('rep-origen-rango')?.value || 'mes';
      const h = new Date();
      const y = h.getFullYear(), m = h.getMonth();
      const manana = new Date(y, m, h.getDate() + 1);
      if (sel === 'mes') return { desde: _fISO(new Date(y, m, 1)), hastaExcl: _fISO(manana), etiqueta: 'este mes' };
      if (sel === 'mes_ant') return { desde: _fISO(new Date(y, m - 1, 1)), hastaExcl: _fISO(new Date(y, m, 1)), etiqueta: new Date(y, m - 1, 1).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }) };
      if (sel === '3m') return { desde: _fISO(new Date(y, m - 2, 1)), hastaExcl: _fISO(manana), etiqueta: 'últimos 3 meses' };
      if (sel === '12m') return { desde: _fISO(new Date(y, m - 11, 1)), hastaExcl: _fISO(manana), etiqueta: 'últimos 12 meses' };
      if (sel === 'anio') return { desde: _fISO(new Date(y, 0, 1)), hastaExcl: _fISO(manana), etiqueta: 'año ' + y };
      if (sel === 'todo') return { desde: '2000-01-01', hastaExcl: _fISO(manana), etiqueta: 'todo el histórico' };
      // Personalizado
      const d = document.getElementById('rep-origen-desde')?.value || '';
      const ha = document.getElementById('rep-origen-hasta')?.value || '';
      if (!d || !ha) return { error: 'Escoge las dos fechas.' };
      if (d > ha) return { error: 'La fecha inicial es posterior a la final.' };
      const p = ha.split('-');
      const sig = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]) + 1);
      return { desde: d, hastaExcl: _fISO(sig), etiqueta: d + ' a ' + ha };
    }

    function repOrigenCambioRango() {
      const sel = document.getElementById('rep-origen-rango')?.value || 'mes';
      const box = document.getElementById('rep-origen-custom');
      if (box) box.style.display = (sel === 'custom') ? 'inline-flex' : 'none';
      if (sel === 'custom') {
        // Precargar con el mes en curso para que no arranque vacio
        const h = new Date();
        const di = document.getElementById('rep-origen-desde');
        const hi = document.getElementById('rep-origen-hasta');
        if (di && !di.value) di.value = _fISO(new Date(h.getFullYear(), h.getMonth(), 1));
        if (hi && !hi.value) hi.value = _fISO(h);
        return;   // espera al boton Aplicar
      }
      cargarOrigenPeriodo();
    }

    async function cargarOrigenPeriodo() {
      const cont = document.getElementById('rep-origen-content');
      const r = _rangoOrigen();
      if (r.error) { notif(r.error, 'error'); return; }
      if (!_sb || !_supabaseConectado) { renderOrigenMes(null, r.etiqueta); return; }
      if (cont) cont.innerHTML = '<div style="padding:14px;text-align:center;color:var(--dgray)">'
        + '<i class="ti ti-loader"></i> Leyendo ' + r.etiqueta + '…</div>';

      // 1) IDs de facturas del rango, paginando de 1000 en 1000.
      for (const k in _FMAP) delete _FMAP[k];
      let ids = [], desde = 0;
      for (let v = 0; v < 30; v++) {
        // v13.37: ya no basta el id. Para convertir a $verde hace falta la
        // brecha CONGELADA de cada factura (tasa_par / tasa_bcv), y para el
        // detalle hacen falta numero, fecha y cliente.
        const q = await _sb.from('facturas')
          .select('id,numero,fecha,cliente_nombre,tasa_par,tasa_bcv,cobrar_verde')
          .eq('empresa', estado.empresa).neq('estado', 'anulada')
          .gte('fecha', r.desde).lt('fecha', r.hastaExcl)
          .range(desde, desde + 999);
        if (q.error) {
          if (cont) cont.innerHTML = '<div style="padding:14px;text-align:center;color:var(--red)">No se pudieron leer las facturas: '
            + q.error.message + '</div>';
          return;
        }
        if (!q.data || q.data.length === 0) break;
        q.data.forEach(x => { ids.push(x.id); _FMAP[x.id] = x; });
        if (q.data.length < 1000) break;
        desde += 1000;
      }
      if (ids.length === 0) { _ORIGEN_DATA = null; renderOrigenMes([], r.etiqueta); return; }

      // 2) Renglones. Se parte en lotes: un `in` con cientos de ids arma una
      //    URL demasiado larga y el servidor la rechaza.
      const LOTE = 120, todos = [];
      let sinColOrigen = false;
      for (let i = 0; i < ids.length; i += LOTE) {
        const trozo = ids.slice(i, i + LOTE);
        let off = 0;
        for (let v = 0; v < 60; v++) {
          const cols = sinColOrigen
            ? 'factura_id,cod_alt,descripcion,cantidad,fob_unitario,factor_landed,total_linea'
            : 'factura_id,cod_alt,descripcion,cantidad,fob_unitario,factor_landed,total_linea,origen';
          let q = await _sb.from('factura_items').select(cols)
            .in('factura_id', trozo).range(off, off + 999);
          // Igual que en cargarUtilidadMes: si la columna no existe, se
          // reintenta sin ella y origenDe() deduce por el factor congelado.
          if (q.error && /origen/i.test(q.error.message || '')) {
            sinColOrigen = true;
            q = await _sb.from('factura_items')
              .select('factura_id,cod_alt,descripcion,cantidad,fob_unitario,factor_landed,total_linea')
              .in('factura_id', trozo).range(off, off + 999);
          }
          if (q.error) {
            if (cont) cont.innerHTML = '<div style="padding:14px;text-align:center;color:var(--red)">No se pudieron leer los renglones: '
              + q.error.message + '</div>';
            return;
          }
          if (!q.data || q.data.length === 0) break;
          q.data.forEach(x => todos.push(x));
          if (q.data.length < 1000) break;
          off += 1000;
        }
      }
      _ORIGEN_DATA = { its: todos, etiqueta: r.etiqueta, nFacts: ids.length };
      renderOrigenMes(todos, r.etiqueta + ' · ' + ids.length + ' factura(s)');
      if (document.getElementById('rep-origen-detalle')?.style.display === 'block') renderDetalleOrigen();
    }

    function renderTopProductos(items) {
      const cont = document.getElementById('top-productos-content');
      if (!cont) return;
      const vacio = '<div style="padding:20px;text-align:center;color:var(--dgray);font-size:13px">Sin ventas este mes</div>';
      if (!items || items.length === 0) { cont.innerHTML = vacio; return; }
      const acc = {};
      items.forEach(i => {
        const k = i.cod_alt || '—';
        if (!acc[k]) acc[k] = { cod: k, desc: i.descripcion || '', cant: 0, total: 0 };
        acc[k].cant += parseFloat(i.cantidad) || 0;
        acc[k].total += parseFloat(i.total_linea) || 0;
      });
      const top = Object.values(acc).sort((a, b) => b.total - a.total).slice(0, 5);
      if (top.length === 0) { cont.innerHTML = vacio; return; }
      const tope = top[0].total || 1;
      cont.innerHTML = '<div style="padding:4px 2px">' + top.map(p => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px;gap:8px">
        <span style="font-weight:600;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.desc || p.cod}</span>
        <span style="color:var(--dgray);white-space:nowrap">${p.cant} ud · ${fmtUSD(p.total)}</span>
      </div>
      <div style="background:var(--gray);border-radius:4px;height:14px;overflow:hidden">
        <div style="background:linear-gradient(90deg,var(--blue),var(--navy));height:100%;width:${(p.total / tope) * 100}%"></div>
      </div>
    </div>`).join('') + '</div>';
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILIDAD BRUTA Y PUNTO DE EQUILIBRIO (v13.1)
    //
    // El margen del catálogo de arriba es teórico: asume que todo se vende
    // a precio de lista. Esto de aquí es lo REAL: lee factura_items, que
    // guarda el fob y el factor CONGELADOS al momento de emitir.
    //
    // Ingreso = el mismo total del KPI "Ventas este mes", para que los dos
    // números de la pantalla siempre cuadren entre sí.
    // Costo   = suma de (fob congelado × factor congelado × cantidad).
    // ═══════════════════════════════════════════════════════════════
    async function cargarUtilidadMes(ventasMes) {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      const periodoAct = periodoDe(new Date());
      const cf = costosFijosDe(periodoAct);
      const propio = (estado.costos_fijos_hist || {})[periodoAct] != null;
      set('rep-fijos', fmtUSD(cf));
      set('rep-fijos-sub', cf <= 0 ? 'Sin configurar — ponlos en Configuración'
        : (propio ? 'Monto propio de ' + periodoAct : 'Heredado de un mes anterior'));

      if (!_sb || !_supabaseConectado) {
        set('rep-utilidad-sub', 'Sin conexión a la base');
        renderOrigenMes(null);
        return;
      }

      const ahora = new Date();
      const mes0 = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const ids = (TODAS_FACTURAS || [])
        .filter(f => f.empresa === estado.empresa && f.estado !== 'anulada'
          && f.fecha_raw && new Date(f.fecha_raw) >= mes0)
        .map(f => f.id).filter(Boolean);

      if (ids.length === 0) {
        renderTopProductos([]);
        renderOrigenMes([]);
        set('rep-utilidad', fmtUSD(0));
        set('rep-utilidad-sub', 'Sin ventas este mes');
        set('rep-margen-real', '0%');
        set('rep-margen-real-sub', 'Sin ventas este mes');
        set('rep-equilibrio', cf > 0 ? fmtUSD(cf) : fmtUSD(0));
        set('rep-equilibrio-sub', cf > 0 ? 'Sin margen aún para calcularlo' : 'Configura los costos fijos');
        return;
      }

      let { data: its, error } = await _sb.from('factura_items')
        .select('cantidad,fob_unitario,factor_landed,cod_alt,descripcion,total_linea,origen').in('factura_id', ids);
      // Si la columna `origen` aun no existe, el select entero falla. Se
      // reintenta sin ella: origenDe() sabe deducirla del factor congelado.
      if (error && /origen/i.test(error.message || '')) {
        const r2 = await _sb.from('factura_items')
          .select('cantidad,fob_unitario,factor_landed,cod_alt,descripcion,total_linea').in('factura_id', ids);
        its = r2.data; error = r2.error;
      }
      if (error || !its) {
        set('rep-utilidad-sub', 'No se pudieron leer los renglones');
        renderOrigenMes(null);
        return;
      }
      // v13.37: se delega en cargarOrigenPeriodo para que el panel tenga las
      // tasas congeladas de cada factura y pueda mostrar el equivalente verde.
      // `its` sigue alimentando los KPIs de abajo, que son solo $BCV.
      cargarOrigenPeriodo();

      // Un renglón con fob 0 calcula costo 0 y dispara el margen al 100%.
      // Se cuentan aparte para avisar que la utilidad está inflada, en vez de
      // mostrar un número bonito y falso.
      let costo = 0, sinCosto = 0;
      its.forEach(i => {
        const cant = parseFloat(i.cantidad) || 0;
        const fob = parseFloat(i.fob_unitario) || 0;
        const fac = parseFloat(i.factor_landed);
        if (fob <= 0) sinCosto++;
        costo += fob * ((isFinite(fac) && fac > 0) ? fac : FACTOR_LANDED_FALLBACK) * cant;
      });

      renderTopProductos(its);

      const ingreso = parseFloat(ventasMes) || 0;
      const util = ingreso - costo;
      const margen = ingreso > 0 ? (util / ingreso) * 100 : 0;

      set('rep-utilidad', fmtUSD(util));
      set('rep-utilidad-sub', 'Ventas ' + fmtUSD(ingreso) + ' − costo ' + fmtUSD(costo));
      set('rep-margen-real', margen.toFixed(1) + '%');
      set('rep-margen-real-sub', sinCosto > 0
        ? 'Ojo: ' + sinCosto + (sinCosto === 1 ? ' renglón sin costo' : ' renglones sin costo') + ' — margen inflado'
        : 'Sobre lo efectivamente vendido');

      if (cf <= 0) {
        set('rep-equilibrio', fmtUSD(0));
        set('rep-equilibrio-sub', 'Configura los costos fijos');
      } else if (margen <= 0) {
        set('rep-equilibrio', '—');
        set('rep-equilibrio-sub', 'Margen en cero o negativo');
      } else {
        const pe = cf / (margen / 100);
        const falta = pe - ingreso;
        set('rep-equilibrio', fmtUSD(pe));
        set('rep-equilibrio-sub', falta > 0
          ? 'Faltan ' + fmtUSD(falta) + ' para cubrir los fijos'
          : 'Superado por ' + fmtUSD(Math.abs(falta)));
      }
    }