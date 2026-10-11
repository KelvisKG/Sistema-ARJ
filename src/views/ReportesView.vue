<template>
  <div class="page active" id="page-dashboard">
    <h1 class="page-title"><i class="ti ti-chart-bar"></i> Reportes y Dashboard</h1>
    <p class="page-sub">Resumen del día · Comparativa entre empresas · Ranking · Reorden · Backup</p>

    <!-- Sub-navegación de reportes -->
    <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--border);overflow-x:auto;flex-wrap:wrap">
      <button :class="['search-tab', { active: sub === 'resumen' }]" @click="sub = 'resumen'"><i class="ti ti-dashboard"></i> Resumen</button>
      <button :class="['search-tab', { active: sub === 'comparativa' }]" @click="sub = 'comparativa'"><i class="ti ti-arrows-left-right"></i> Comparar empresas</button>
      <button :class="['search-tab', { active: sub === 'ranking' }]" @click="sub = 'ranking'"><i class="ti ti-trophy"></i> Ranking clientes</button>
      <button :class="['search-tab', { active: sub === 'reorden' }]" @click="sub = 'reorden'"><i class="ti ti-package"></i> Qué reordenar</button>
      <button :class="['search-tab', { active: sub === 'backup' }]" @click="sub = 'backup'"><i class="ti ti-database"></i> Respaldos</button>
    </div>

    <!-- ═══ RESUMEN ═══ -->
    <div v-show="sub === 'resumen'">
      <div class="kpi-grid">
        <div class="kpi-card green">
          <div class="kpi-icon"><i class="ti ti-trending-up"></i></div>
          <div class="kpi-label">Ventas hoy</div>
          <div class="kpi-val">{{ fmtUSD(ventas.totHoy) }}</div>
          <div class="kpi-sub" style="color:var(--dgray);font-weight:600">{{ ventas.nHoy === 0 ? 'Sin ventas hoy' : ventas.nHoy + (ventas.nHoy === 1 ? ' factura' : ' facturas') }}</div>
        </div>
        <div class="kpi-card blue">
          <div class="kpi-icon"><i class="ti ti-calendar"></i></div>
          <div class="kpi-label">Ventas este mes</div>
          <div class="kpi-val">{{ fmtUSD(ventas.totMes) }}</div>
          <div class="kpi-sub" style="color:var(--dgray);font-weight:600">{{ ventas.nMes === 0 ? 'Sin ventas este mes' : ventas.nMes + (ventas.nMes === 1 ? ' factura' : ' facturas') }}</div>
        </div>
        <div class="kpi-card gold">
          <div class="kpi-icon"><i class="ti ti-percentage"></i></div>
          <div class="kpi-label">Margen del catálogo</div>
          <div class="kpi-val">{{ margenCatalogo == null ? '0%' : margenCatalogo.toFixed(1) + '%' }}</div>
          <div class="kpi-sub" style="color:var(--dgray);font-weight:600">{{ margenCatalogo == null ? 'Sin datos aún' : 'Teórico — todo a precio de lista' }}</div>
        </div>
        <div class="kpi-card red">
          <div class="kpi-icon"><i class="ti ti-package"></i></div>
          <div class="kpi-label">Stock crítico</div>
          <div class="kpi-val">{{ stockCritico.bajos }}</div>
          <div class="kpi-sub">1 a {{ stockCritico.umbral }} ud · {{ stockCritico.agotados }} agotados de {{ store.productos.length }}</div>
        </div>
        <div class="kpi-card green">
          <div class="kpi-icon"><i class="ti ti-coin"></i></div>
          <div class="kpi-label">Utilidad bruta del mes</div>
          <div class="kpi-val">{{ util.val }}</div>
          <div class="kpi-sub" style="color:var(--dgray);font-weight:600">{{ util.sub }}</div>
        </div>
        <div class="kpi-card gold">
          <div class="kpi-icon"><i class="ti ti-percentage"></i></div>
          <div class="kpi-label">Margen real vendido</div>
          <div class="kpi-val">{{ util.margenVal }}</div>
          <div class="kpi-sub" style="color:var(--dgray);font-weight:600">{{ util.margenSub }}</div>
        </div>
        <div class="kpi-card blue">
          <div class="kpi-icon"><i class="ti ti-scale"></i></div>
          <div class="kpi-label">Punto de equilibrio</div>
          <div class="kpi-val">{{ util.peVal }}</div>
          <div class="kpi-sub" style="color:var(--dgray);font-weight:600">{{ util.peSub }}</div>
        </div>
        <div class="kpi-card red">
          <div class="kpi-icon"><i class="ti ti-building-store"></i></div>
          <div class="kpi-label">Costos fijos del mes</div>
          <div class="kpi-val">{{ fmtUSD(fijos.cf) }}</div>
          <div class="kpi-sub" style="color:var(--dgray);font-weight:600">{{ fijos.sub }}</div>
        </div>
      </div>

      <!-- VENTAS POR ORIGEN (v13.28) · selector de período (v13.35) -->
      <div class="chart-card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">
          <h3 style="margin:0"><i class="ti ti-world" style="color:var(--blue)"></i> Importado vs Local
            <span style="font-weight:500;color:var(--dgray)">— {{ origen.lbl.charAt(0).toUpperCase() + origen.lbl.slice(1) }}</span></h3>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <select v-model="rango" class="rp-in" @change="cambioRango">
              <option value="mes">Este mes</option>
              <option value="mes_ant">Mes pasado</option>
              <option value="3m">Últimos 3 meses</option>
              <option value="12m">Últimos 12 meses</option>
              <option value="anio">Este año</option>
              <option value="todo">Todo el histórico</option>
              <option value="custom">Personalizado…</option>
            </select>
            <span v-if="rango === 'custom'" style="display:inline-flex;gap:6px;align-items:center">
              <input v-model="custDesde" type="date" class="rp-in">
              <span style="font-size:11.5px;color:var(--dgray)">a</span>
              <input v-model="custHasta" type="date" class="rp-in">
              <button class="btn btn-primary btn-sm" @click="cargarOrigen">Aplicar</button>
            </span>
          </div>
        </div>

        <div v-if="origen.estado === 'cargando'" style="padding:14px;text-align:center;color:var(--dgray)"><i class="ti ti-loader"></i> Leyendo {{ origen.etiqueta }}…</div>
        <div v-else-if="origen.estado === 'error'" style="padding:14px;text-align:center;color:var(--red)">{{ origen.error }}</div>
        <div v-else-if="origen.estado === 'sinconexion'" style="padding:14px;text-align:center;color:var(--dgray)">Sin conexión a la base.</div>
        <div v-else-if="!origen.data || !origen.data.its.length" style="padding:14px;text-align:center;color:var(--dgray)">Sin ventas en {{ origen.etiqueta }}.</div>
        <template v-else>
          <div style="display:flex;flex-wrap:wrap;gap:10px">
            <div v-for="b in bloquesOrigen" :key="b.key" :style="{ flex: '1 1 210px', background: b.col, borderRadius: '8px', padding: '10px 12px' }">
              <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;letter-spacing:.4px;font-weight:600"><i :class="'ti ti-' + b.icono"></i> {{ b.nom }}</div>
              <div style="font-size:20px;font-weight:800;color:var(--navy);line-height:1.25">{{ fmtUSD(b.c.venta) }}</div>
              <div style="font-size:11.5px;color:var(--dgray);margin-bottom:6px">{{ pc(b.c.venta, R.tot.venta) }} de la venta &middot; {{ b.c.uds.toLocaleString('es-VE') }} uds &middot; {{ b.c.lineas }} renglones</div>
              <div style="height:5px;background:#FFF;border-radius:3px;overflow:hidden;margin-bottom:6px">
                <div :style="{ height: '100%', width: (R.tot.venta > 0 ? b.c.venta / R.tot.venta * 100 : 0).toFixed(1) + '%', background: 'var(--gold)' }"></div></div>
              <div style="font-size:12px;line-height:1.6">Costo <strong>{{ fmtUSD(b.c.costo) }}</strong><br>
                Utilidad <strong :style="{ color: b.c.util >= 0 ? '#1E7B34' : '#B00020' }">{{ fmtUSD(b.c.util) }}</strong> &middot; margen <strong>{{ b.c.mg.toFixed(1) }}%</strong><br>
                <span style="color:var(--dgray)">Aporta {{ pc(b.c.util, R.tot.util) }} de la utilidad</span>
                <!-- Desglose de caja: lo que YA está y lo que falta por cobrar son cosas distintas -->
                <div v-if="b.v && (b.v.enMano > 0 || b.v.porCobrar > 0)" style="margin-top:8px;padding-top:7px;border-top:1px solid rgba(0,0,0,.08)">
                  <div style="color:#1E7B34;font-weight:700;font-size:13px">✓ Ya en caja: {{ fmtUSD(b.v.enMano) }}</div>
                  <div v-if="b.v.efectivo > 0 || b.v.usdt > 0" style="font-size:11px;color:var(--dgray);margin-top:1px">
                    {{ [b.v.efectivo > 0 ? fmtUSD(b.v.efectivo) + ' efectivo' : '', b.v.usdt > 0 ? fmtUSD(b.v.usdt) + ' a convertir en USDT' : ''].filter(Boolean).join(' · ') }}</div>
                  <template v-if="b.v.porCobrar > 0">
                    <div style="color:#BF8F00;font-weight:600;font-size:12.5px;margin-top:5px">⏳ Por cobrar: {{ fmtUSD(b.v.porCobrar) }}</div>
                    <div style="font-size:11px;color:var(--dgray);margin-top:1px">Aún no es plata. Sujeto a que la brecha se mueva.</div>
                  </template>
                </div>
              </div>
            </div>
          </div>
          <div v-if="R.g.local.venta > 0 && R.g.importado.venta > 0" style="margin-top:9px;font-size:12px;color:var(--dgray);line-height:1.5">
            El margen de <strong>{{ R.g.importado.mg - R.g.local.mg >= 0 ? 'importado' : 'local' }}</strong> es
            {{ Math.abs(R.g.importado.mg - R.g.local.mg).toFixed(1) }} puntos mayor. Utilidad total del mes: <strong>{{ fmtUSD(R.tot.util) }}</strong>.</div>
          <div v-if="R.deducidos > 0 || R.sinCosto > 0" style="margin-top:8px;padding:8px 10px;border-radius:6px;background:#FFF4E5;border-left:3px solid #BF8F00;font-size:11.5px;line-height:1.5">
            <div v-if="R.deducidos > 0">⚠ <strong>{{ R.deducidos }} renglón(es) sin origen guardado</strong> — clasificados por el factor congelado, es una deducción</div>
            <div v-if="R.sinCosto > 0">⚠ <strong>{{ R.sinCosto }} renglón(es) sin costo</strong> — su margen sale inflado</div>
          </div>
          <div v-if="R.VR.nPend > 0" style="margin-top:10px;padding:8px 10px;border-radius:6px;background:#FFF9E6;border-left:3px solid #BF8F00;font-size:11.5px;line-height:1.5">
            <strong>{{ R.VR.nPend }} factura(s) sin cobrar del todo.</strong> Lo de "por cobrar" no está en tu caja:
            mientras esos bolívares no entren, la brecha sigue corriendo y el objetivo en USDT baja cada día.</div>
          <div v-if="R.VR.sinTasa > 0" style="margin-top:8px;font-size:11px;color:var(--dgray)">{{ R.VR.sinTasa }} factura(s) sin tasas congeladas: no entran en el cálculo de caja.</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm" style="background:var(--navy);color:#FFF" @click="detalleAbierto = !detalleAbierto"><i class="ti ti-list-search"></i> Ver qué productos son</button>
            <button class="btn btn-sm btn-secondary" @click="descargarDetalleOrigen"><i class="ti ti-download"></i> Descargar detalle CSV</button>
          </div>
        </template>

        <!-- Detalle por producto -->
        <div v-if="detalleAbierto" style="margin-top:12px">
          <div v-if="!origen.data || !origen.data.its.length" style="padding:14px;text-align:center;color:var(--dgray);font-size:12.5px">Escoge un período con ventas y vuelve a abrir el detalle.</div>
          <template v-else>
            <div v-for="t in tablasDetalle" :key="t.key" style="margin-bottom:14px">
              <div :style="{ fontSize: '12px', fontWeight: 700, color: 'var(--navy)', background: t.col, padding: '6px 9px', borderRadius: '6px 6px 0 0' }">
                <i :class="'ti ti-' + t.icono"></i> {{ t.titulo }} — {{ t.lista.length }} producto(s) · {{ fmtUSD(t.tV) }} $BCV · ≈ {{ fmtUSD(t.tW) }} verde</div>
              <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;font-size:11.5px">
                  <thead><tr style="background:#F7F7F7;color:var(--dgray)">
                    <th style="text-align:left;padding:5px 7px">Código</th><th style="text-align:left;padding:5px 7px">Descripción</th>
                    <th style="text-align:right;padding:5px 7px">Uds</th><th style="text-align:right;padding:5px 7px">Venta $BCV</th>
                    <th style="text-align:right;padding:5px 7px">$verde facturado</th><th style="text-align:right;padding:5px 7px">Costo</th>
                    <th style="text-align:right;padding:5px 7px">Utilidad</th><th style="text-align:right;padding:5px 7px">Margen</th></tr></thead>
                  <tbody>
                    <tr v-for="p in t.lista.slice(0, 60)" :key="p.cod + p.desc" style="border-bottom:1px solid var(--border)">
                      <td style="padding:4px 7px;font-family:monospace">{{ p.cod }}</td>
                      <td style="padding:4px 7px">{{ p.desc }}</td>
                      <td style="padding:4px 7px;text-align:right">{{ p.uds.toLocaleString('es-VE') }}</td>
                      <td style="padding:4px 7px;text-align:right;font-weight:600">{{ fmtUSD(p.venta) }}</td>
                      <td style="padding:4px 7px;text-align:right;color:#1E7B34">{{ p.sinTasa ? '—' : fmtUSD(p.verde) }}</td>
                      <td style="padding:4px 7px;text-align:right;color:var(--dgray)">{{ fmtUSD(p.costo) }}</td>
                      <td :style="{ padding: '4px 7px', textAlign: 'right', color: p.venta - p.costo >= 0 ? '#1E7B34' : '#B00020' }">{{ fmtUSD(p.venta - p.costo) }}</td>
                      <td style="padding:4px 7px;text-align:right">{{ (p.venta > 0 ? (p.venta - p.costo) / p.venta * 100 : 0).toFixed(1) }}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="t.lista.length > 60" style="font-size:11px;color:var(--dgray);padding:5px 7px">Mostrando los 60 de mayor venta. El CSV los trae todos.</div>
            </div>
            <div style="font-size:11px;color:var(--dgray);line-height:1.5;padding:6px 2px">
              La columna <strong>$verde facturado</strong> es el equivalente de lo <em>facturado</em> con la brecha congelada
              de cada factura, esté cobrado o no, y sin descontar. No es caja. La caja real, ya separada entre cobrado y
              pendiente, está en el recuadro de arriba.</div>
          </template>
        </div>
      </div>

      <!-- METAS DE VENTA -->
      <div style="margin-bottom:20px">
        <h2 style="font-size:15px;color:var(--navy);font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:8px"><i class="ti ti-target"></i> Metas de venta del mes</h2>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:11.5px;color:var(--dgray)">Período:</span>
            <select v-model="metasPer" class="val-input" style="width:150px">
              <option v-for="x in opcionesPeriodo" :key="x" :value="x">{{ etiquetaPeriodo(x) }}</option>
            </select>
            <span v-if="esMesCerrado" style="background:#FFF8E1;color:#5D4037;padding:2px 8px;border-radius:8px;font-size:10.5px;font-weight:600">MES CERRADO</span>
          </div>
          <button class="btn btn-secondary btn-sm" @click="abrirEquipo"><i class="ti ti-users-plus"></i> Gestionar equipo</button>
        </div>
        <div v-if="esMesCerrado" style="background:#FFF8E1;border-left:3px solid var(--gold);border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:11.5px;color:#5D4037">
          <i class="ti ti-info-circle"></i> Estás viendo un mes distinto al actual. Las barras de "vendido" siempre muestran el <strong>mes en curso</strong>; solo la meta cambia de período.
        </div>

        <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div>
              <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:500">Meta empresa</div>
              <div style="font-size:14px;font-weight:600;color:var(--navy)">{{ nombreEmp }}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:11.5px;color:var(--dgray)">Meta:</span>
              <input type="number" class="val-input" :value="metaEmpresa" step="500" min="0" style="width:110px" @change="actualizarMetaEmpresa($event.target.value)">
            </div>
          </div>
          <div style="background:var(--gray);border-radius:5px;height:24px;position:relative;overflow:hidden">
            <div :style="{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,var(--green),#4CAF50)', width: pctEmp + '%', transition: 'width 0.4s', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px', color: '#FFF', fontSize: '11px', fontWeight: 600 }">{{ pctEmp > 8 ? pctEmp.toFixed(1) + '%' : '' }}</div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11.5px">
            <span style="color:var(--green);font-weight:600">Vendido: {{ fmtUSD(ventasEmpresa) }}</span>
            <span style="color:var(--dgray)">Falta: <strong :style="{ color: faltaEmp > 0 ? 'var(--gold)' : 'var(--green)' }">{{ fmtUSD(faltaEmp) }}</strong></span>
          </div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);font-size:11px;color:var(--dgray)">
            <template v-if="baseSug > 0">
              <i class="ti ti-bulb"></i> Sugerencias sobre el mes anterior ({{ fmtUSD(baseSug) }}):
              <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;margin:2px" @click="sugerirMeta('conservadora')">Conservadora: {{ fmtUSD(Math.round(baseSug * 0.9 / 100) * 100) }}</button>
              <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;margin:2px" @click="sugerirMeta('moderada')">Moderada: {{ fmtUSD(Math.round(baseSug * 1.1 / 100) * 100) }}</button>
              <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;margin:2px" @click="sugerirMeta('agresiva')">Agresiva: {{ fmtUSD(Math.round(baseSug * 1.3 / 100) * 100) }}</button>
            </template>
            <template v-else><i class="ti ti-bulb"></i> Las sugerencias aparecen cuando haya ventas del mes anterior con qué compararse.</template>
          </div>
        </div>

        <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:500">Metas por trabajador</div>
            <button class="btn btn-secondary btn-sm" style="font-size:10.5px" @click="abrirEquipo"><i class="ti ti-plus"></i> Agregar</button>
          </div>
          <div v-if="!listaTrab.length" style="padding:18px;text-align:center;color:var(--dgray);font-size:12px">
            Todavía no hay trabajadores en <strong>{{ nombreEmp }}</strong>.<br>
            <button class="btn btn-primary btn-sm" style="margin-top:8px" @click="abrirEquipo"><i class="ti ti-user-plus"></i> Agregar el primero</button>
          </div>
          <div v-for="t in filasTrab" :key="t.v" style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px">
              <div style="display:flex;align-items:center;gap:6px;min-width:0">
                <i class="ti ti-user" style="color:var(--blue);flex-shrink:0"></i>
                <span style="font-weight:600;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ t.v }}</span>
                <span v-if="t.cumplido" style="background:var(--lgreen);color:var(--green);padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;flex-shrink:0">✓ CUMPLIDA</span>
                <span v-if="!t.enEquipo" style="background:#FFF8E1;color:#5D4037;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;flex-shrink:0" title="Facturó pero no está en la lista de equipo">FUERA DEL EQUIPO</span>
              </div>
              <input type="number" :value="t.meta" step="500" min="0" class="val-input" style="width:90px;flex-shrink:0" @change="actualizarMetaVendedor(t.v, $event.target.value)">
            </div>
            <div style="background:var(--gray);border-radius:4px;height:14px;overflow:hidden">
              <div :style="{ background: t.cumplido ? 'linear-gradient(90deg,var(--green),#4CAF50)' : 'linear-gradient(90deg,var(--blue),var(--navy))', height: '100%', width: t.pct + '%', transition: 'width 0.4s' }"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:11px;color:var(--dgray)">
              <span>{{ fmtUSD(t.vendido) }}{{ t.meta > 0 ? ' (' + t.pct.toFixed(0) + '%)' : '' }}</span>
              <span>{{ t.meta > 0 ? 'Falta ' + fmtUSD(t.falta) : 'Sin meta asignada' }}</span>
            </div>
          </div>
          <!-- Si la suma de metas individuales no cuadra con la de la empresa -->
          <div v-if="avisoSuma" :style="{ marginTop: '10px', fontSize: '11.5px', color: avisoSuma.corta ? '#5D4037' : 'var(--dgray)', background: avisoSuma.corta ? '#FFF8E1' : 'transparent', borderTop: '1px dashed var(--border)', borderRadius: '6px', padding: '8px 10px' }">
            <i :class="'ti ti-' + (avisoSuma.corta ? 'alert-triangle' : 'info-circle')"></i>
            La suma de las metas individuales es <strong>{{ fmtUSD(avisoSuma.suma) }}</strong> contra {{ fmtUSD(metaEmpresa) }} de la empresa.
            <template v-if="avisoSuma.corta">Aunque <strong>todos cumplan</strong>, la empresa se queda {{ fmtUSD(Math.abs(avisoSuma.dif)) }} corta.</template>
            <template v-else>Hay {{ fmtUSD(avisoSuma.dif) }} de colchón.</template>
          </div>
        </div>
      </div>

      <!-- COMPARATIVA MES vs MES -->
      <div class="chart-card" style="margin-bottom:16px">
        <h3><i class="ti ti-chart-line" style="color:var(--blue)"></i> Comparativa de ventas — Mes actual vs Mes anterior</h3>
        <div style="padding:4px 2px">
          <div v-for="b in compMeses.barras" :key="b.etiqueta" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">
              <span style="color:var(--dgray);text-transform:capitalize">{{ b.etiqueta }}</span>
              <span style="font-weight:600;color:var(--navy)">{{ fmtUSD(b.val) }} · {{ b.n }} {{ b.n === 1 ? 'factura' : 'facturas' }}</span>
            </div>
            <div style="background:var(--gray);border-radius:5px;height:20px;overflow:hidden">
              <div :style="{ background: b.color, height: '100%', width: (b.val / compMeses.tope * 100) + '%', transition: 'width .4s' }"></div>
            </div>
          </div>
          <div v-if="compMeses.ant === 0 && compMeses.act === 0" style="font-size:11.5px;color:var(--dgray)">Sin ventas en ninguno de los dos meses.</div>
          <div v-else-if="compMeses.ant === 0" style="font-size:11.5px;color:var(--dgray)">No hay mes anterior con ventas: todavía no se puede comparar.</div>
          <div v-else style="font-size:12px;padding-top:8px;border-top:1px dashed var(--border)">
            <span :style="{ color: compMeses.varPct >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }">{{ compMeses.varPct >= 0 ? '▲' : '▼' }} {{ Math.abs(compMeses.varPct).toFixed(1) }}%</span>
            <span style="color:var(--dgray)"> respecto al mes anterior · diferencia {{ fmtUSD(Math.abs(compMeses.act - compMeses.ant)) }}</span>
          </div>
        </div>
      </div>

      <div class="dash-grid">
        <div class="chart-card">
          <h3><i class="ti ti-chart-bar" style="color:var(--blue)"></i> Productos más vendidos del mes</h3>
          <div v-if="!top.length" style="padding:20px;text-align:center;color:var(--dgray);font-size:13px">Sin ventas este mes</div>
          <div v-else style="padding:4px 2px">
            <div v-for="p in top" :key="p.cod" style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:3px;gap:8px">
                <span style="font-weight:600;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ p.desc || p.cod }}</span>
                <span style="color:var(--dgray);white-space:nowrap">{{ p.cant }} ud · {{ fmtUSD(p.total) }}</span>
              </div>
              <div style="background:var(--gray);border-radius:4px;height:14px;overflow:hidden">
                <div :style="{ background: 'linear-gradient(90deg,var(--blue),var(--navy))', height: '100%', width: (p.total / (top[0].total || 1)) * 100 + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="list-card">
          <h3><i class="ti ti-receipt" style="color:var(--blue)"></i> Últimas ventas</h3>
          <div v-for="v in ventasRecientes" :key="v.id" class="list-row">
            <div class="nombre"><div style="font-weight:600">{{ v.cliente }}</div><div style="font-size:11px;color:var(--dgray)">{{ v.num }} · {{ fechaReciente(v.fecha_raw) }} · {{ v.vendedor }}</div></div>
            <div class="valor">{{ fmtUSD(v.total) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ COMPARATIVA ENTRE EMPRESAS (en el monolito todavía no está activa) ═══ -->
    <div v-if="sub === 'comparativa'">
      <div class="card">
        <div class="card-tit"><i class="ti ti-arrows-left-right"></i> Venta Directa vs Distribuidora — Este mes</div>
        <div style="padding:20px;text-align:center;color:var(--dgray);font-size:13px">Sin ventas registradas todavía</div>
      </div>
    </div>

    <!-- ═══ RANKING DE CLIENTES (v13.2) ═══ -->
    <div v-if="sub === 'ranking'">
      <div class="card">
        <div class="card-tit"><i class="ti ti-trophy"></i> Ranking de clientes</div>
        <div class="rp-ranking">
          <div>
            <h3 style="font-size:13px;color:var(--navy);font-weight:600;margin-bottom:10px"><i class="ti ti-trophy" style="color:var(--gold)"></i> Top 5 compradores del mes · {{ nombreEmp }}</h3>
            <div v-if="!ranking.top.length" style="padding:20px;text-align:center;color:var(--dgray);font-size:12.5px">Nadie ha comprado este mes en {{ nombreEmp }}</div>
            <div v-for="(c, i) in ranking.top" :key="c.nombre" style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                <span style="font-size:12.5px;font-weight:500"><span style="display:inline-block;width:20px">{{ ['🥇', '🥈', '🥉', '4', '5'][i] }}</span> {{ c.nombre }}</span>
                <span style="font-weight:700;color:var(--navy);font-size:13px">{{ fmtUSD(c.mes) }}</span>
              </div>
              <div style="background:var(--gray);border-radius:4px;height:8px;margin-left:24px"><div :style="{ background: 'linear-gradient(90deg,var(--gold),#E0B020)', height: '100%', width: (c.mes / ranking.top[0].mes * 100).toFixed(0) + '%', borderRadius: '4px' }"></div></div>
              <div style="font-size:10.5px;color:var(--dgray);margin-left:24px;margin-top:2px">{{ c.comprasMes }} {{ c.comprasMes === 1 ? 'compra' : 'compras' }} este mes · última {{ fechaCortaRk(c.ultima) }}</div>
            </div>
          </div>
          <div>
            <h3 style="font-size:13px;color:var(--red);font-weight:600;margin-bottom:10px"><i class="ti ti-alert-triangle"></i> Clientes que dejaron de comprar</h3>
            <div v-if="!ranking.dormidos.length" style="padding:20px;text-align:center;color:var(--dgray);font-size:12.5px">Ningún cliente lleva más de 30 días sin comprar</div>
            <div v-for="c in ranking.dormidos" :key="c.nombre" style="background:#FEF5F5;border:1px solid #F5C0C0;border-radius:8px;padding:10px 12px;margin-bottom:8px">
              <div style="font-weight:600;font-size:12.5px;color:#222">{{ c.nombre }}</div>
              <div style="font-size:11px;color:var(--red);font-weight:500;margin:2px 0">⚠ {{ c.dias }} días sin comprar</div>
              <div style="font-size:10.5px;color:var(--dgray)">{{ c.comprasHist }} compras históricas · ticket promedio {{ fmtUSD(c.prom) }} · última {{ fechaCortaRk(c.ultima) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ REORDEN (en el monolito se activa cuando haya historial de ventas real) ═══ -->
    <div v-if="sub === 'reorden'">
      <div class="card">
        <div class="card-tit"><i class="ti ti-package"></i> Productos que debes reordenar pronto</div>
        <div style="padding:20px;text-align:center;color:var(--dgray);font-size:13px">El cálculo de reorden se activará cuando haya historial de ventas real</div>
      </div>
    </div>

    <!-- ═══ RESPALDOS (v13.2) ═══ -->
    <div v-if="sub === 'backup'">
      <div class="card">
        <div class="card-tit"><i class="ti ti-database"></i> Respaldos y seguridad de datos</div>
        <div class="rp-2col">
          <div style="background:var(--lgreen);border-radius:8px;padding:16px">
            <div style="font-size:13px;font-weight:600;color:var(--green);margin-bottom:6px"><i class="ti ti-cloud-check"></i> Respaldo automático en la nube</div>
            <div style="font-size:12px;color:var(--dgray);line-height:1.6">
              Estado: <strong style="color:var(--green)">● Activo</strong> — cada factura, cliente y producto se guarda en Supabase al instante.<br>
              Cargado ahora: <strong>{{ store.productos.length }}</strong> productos · <strong>{{ store.clientes.length }}</strong> clientes · <strong>{{ store.todasFacturas.length }}</strong> facturas
            </div>
          </div>
          <div style="background:var(--lblue);border-radius:8px;padding:16px">
            <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:6px"><i class="ti ti-shield-check"></i> Por qué descargar igual</div>
            <div style="font-size:12px;color:var(--dgray);line-height:1.6">
              El respaldo en la nube te protege de que se dañe la computadora.<br>
              El respaldo <strong>en tu mano</strong> te protege de un borrado por error o de perder el acceso a la cuenta.
            </div>
          </div>
        </div>
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:16px;margin-top:14px">
          <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:12px">Descargar respaldo manual</div>
          <div class="rp-3col">
            <button class="btn btn-secondary" :disabled="!factsSemana.length" :title="factsSemana.length ? '' : 'No hay facturas esta semana'" @click="backupSemanal"><i class="ti ti-file-spreadsheet"></i> Resumen semanal ({{ factsSemana.length }})</button>
            <button class="btn btn-secondary" @click="backupCompleto"><i class="ti ti-database-export"></i> Respaldo completo (.json)</button>
            <button class="btn btn-secondary" :disabled="!store.productos.length" @click="backupInventario"><i class="ti ti-package"></i> Solo inventario ({{ store.productos.length }})</button>
          </div>
          <div style="background:#FFF8E1;border-left:3px solid var(--gold);border-radius:6px;padding:10px 14px;margin-top:14px;font-size:12px;color:#5D4037">
            <i class="ti ti-info-circle"></i> <strong>Rutina sugerida:</strong> cada viernes descarga el "Resumen semanal" y guárdalo en una carpeta o pendrive. Los dos primeros abren con doble clic en Excel; el <strong>.json</strong> no se lee a simple vista, pero es el que sirve para reconstruir todo si hace falta.
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL EQUIPO DE TRABAJO (v13.2) -->
    <div v-if="equipoAbierto" class="modal show" id="modal-equipo">
      <div class="modal-content" style="max-width:460px;text-align:left">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:12px">
          <h3 style="margin:0;font-size:18px;color:var(--navy);font-weight:600"><i class="ti ti-users"></i> Equipo de trabajo</h3>
          <button class="btn btn-secondary btn-sm" @click="equipoAbierto = false"><i class="ti ti-x"></i></button>
        </div>
        <div style="background:#FFF8E1;border-left:3px solid var(--gold);border-radius:6px;padding:9px 12px;margin-bottom:12px;font-size:11.5px;color:#5D4037">
          <i class="ti ti-info-circle"></i> Esta lista es solo para <strong>ponerles metas</strong>. No crea usuarios que puedan entrar al sistema — eso se hace en Supabase.
        </div>
        <div style="display:flex;gap:6px;align-items:flex-end;margin-bottom:12px">
          <div style="flex:1">
            <label style="font-size:11px;color:var(--dgray);font-weight:500;display:block;margin-bottom:3px">Nombre</label>
            <input v-model="eqNombre" type="text" class="val-input" placeholder="Ej: PEDRO PEREZ" style="width:100%;text-transform:uppercase" @keydown.enter.prevent="agregarAlEquipo">
          </div>
          <div style="width:130px">
            <label style="font-size:11px;color:var(--dgray);font-weight:500;display:block;margin-bottom:3px">Empresa</label>
            <select v-model="eqEmpresa" class="val-input" style="width:100%">
              <option value="directa">Venta Directa</option>
              <option value="dist">Distribuidora</option>
              <option value="ambas">Ambas</option>
            </select>
          </div>
          <button class="btn btn-primary" @click="agregarAlEquipo"><i class="ti ti-plus"></i></button>
        </div>
        <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;max-height:280px;overflow-y:auto">
          <div v-if="!equipo.length" style="padding:16px;text-align:center;color:var(--dgray);font-size:12px">Todavía no hay nadie en el equipo</div>
          <div v-for="(t, i) in equipo" :key="t.nombre" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--border);gap:8px">
            <div style="min-width:0">
              <div style="font-weight:600;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ t.nombre }}</div>
              <div style="font-size:10.5px;color:var(--dgray)">{{ { ambas: 'Ambas', directa: 'Venta Directa', dist: 'Distribuidora' }[t.empresa] || t.empresa }}</div>
            </div>
            <button class="btn btn-red btn-sm" title="Quitar del equipo" @click="quitarDelEquipo(i)"><i class="ti ti-trash"></i></button>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;border-top:1px solid var(--gray);padding-top:12px">
          <button class="btn btn-secondary" @click="equipoAbierto = false">Cerrar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { cargarItemsVentasMes, cargarVentasPeriodo } from '../services/supabase.js';
import {
  fmtUSD, precioConTier, precioLista, costoLanded, costoSinDivisas, FACTOR_LANDED_FALLBACK
} from '../services/pricing.js';
import { periodoDe } from '../services/fechas.js';
import { descargarCSV, descargarArchivo, hoyArchivo } from '../services/monolito.js';
import {
  resumenOrigen, agruparProductos, filasDetalleOrigen, costoRenglones, topProductos, rangoOrigen, fISO,
  normalizarEquipo, claveEmpresa, etiquetaPeriodo
} from '../services/reportes.js';

const store = useArjStore();
const sub = ref('resumen');
const nombreEmp = computed(() => (store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora'));
const pc = (x, b) => (b > 0 ? (x / b * 100).toFixed(1) + '%' : '—');

// Fechas de corte locales (medianoche de hoy y día 1 del mes), igual que el monolito
const cortes = () => {
  const a = new Date();
  return { hoy0: new Date(a.getFullYear(), a.getMonth(), a.getDate()), mes0: new Date(a.getFullYear(), a.getMonth(), 1), mesAnt0: new Date(a.getFullYear(), a.getMonth() - 1, 1) };
};
const validas = computed(() => store.todasFacturas.filter(f => f.estado !== 'anulada' && f.fecha_raw));

// ═══ KPIs (actualizarKpisReportes) ═══
const ventas = computed(() => {
  void store.reloj;
  const { hoy0, mes0 } = cortes();
  let totHoy = 0, nHoy = 0, totMes = 0, nMes = 0;
  validas.value.filter(f => f.empresa === store.empresa).forEach(f => {
    const d = new Date(f.fecha_raw);
    if (d >= hoy0) { totHoy += f.total || 0; nHoy++; }
    if (d >= mes0) { totMes += f.total || 0; nMes++; }
  });
  return { totHoy, nHoy, totMes, nMes };
});

// Margen teórico: precio de lista vs costo landed de todo el catálogo
const margenCatalogo = computed(() => {
  let ingreso = 0, costo = 0;
  store.productos.forEach(p => {
    const pr = precioConTier(p.fob, 'Publico', p);
    if (pr > 0 && p.fob > 0) { ingreso += pr; costo += costoLanded(p, store.productos); }
  });
  return ingreso > 0 ? ((ingreso - costo) / ingreso) * 100 : null;
});

// "Agotado" y "bajo" son problemas distintos: se cuentan aparte
const stockCritico = computed(() => {
  const umbral = store.empresa === 'directa' ? 10 : 20;
  const campo = store.empresa === 'directa' ? 'stock_vd' : 'stock_dist';
  return {
    umbral,
    agotados: store.productos.filter(p => (p[campo] || 0) <= 0).length,
    bajos: store.productos.filter(p => (p[campo] || 0) > 0 && (p[campo] || 0) <= umbral).length
  };
});

const fijos = computed(() => {
  const per = periodoDe(new Date());
  const cf = store.costosFijosDe(per);
  const propio = ((store.configuracion && store.configuracion.costos_fijos_hist) || {})[per] != null;
  return { cf, sub: cf <= 0 ? 'Sin configurar — ponlos en Configuración' : (propio ? 'Monto propio de ' + per : 'Heredado de un mes anterior') };
});

// ═══ UTILIDAD BRUTA Y PUNTO DE EQUILIBRIO (cargarUtilidadMes) ═══
// Lee factura_items: fob y factor CONGELADOS al emitir. Ingreso = KPI "Ventas este mes".
const itsMes = ref(null);   // null = sin conexión / error · [] = sin ventas
const errorIts = ref('');
async function cargarUtilidad() {
  errorIts.value = '';
  if (!store.supabaseConectado) { itsMes.value = null; return; }
  const { mes0 } = cortes();
  const ids = validas.value.filter(f => f.empresa === store.empresa && new Date(f.fecha_raw) >= mes0).map(f => f.id).filter(Boolean);
  if (!ids.length) { itsMes.value = []; return; }
  try {
    itsMes.value = await cargarItemsVentasMes(ids);
  } catch (e) {
    console.error('[ARJ] utilidad del mes:', e);
    itsMes.value = null;
    errorIts.value = 'No se pudieron leer los renglones';
  }
}

const util = computed(() => {
  const cf = fijos.value.cf;
  if (itsMes.value == null) {
    const t = errorIts.value || (store.supabaseConectado ? 'Calculando…' : 'Sin conexión a la base');
    return { val: fmtUSD(0), sub: t, margenVal: '0%', margenSub: 'Sin datos aún', peVal: fmtUSD(0), peSub: 'Configura los costos fijos' };
  }
  if (!itsMes.value.length) {
    return {
      val: fmtUSD(0), sub: 'Sin ventas este mes', margenVal: '0%', margenSub: 'Sin ventas este mes',
      peVal: fmtUSD(cf > 0 ? cf : 0), peSub: cf > 0 ? 'Sin margen aún para calcularlo' : 'Configura los costos fijos'
    };
  }
  const { costo, sinCosto } = costoRenglones(itsMes.value);
  const ingreso = ventas.value.totMes;
  const u = ingreso - costo;
  const margen = ingreso > 0 ? (u / ingreso) * 100 : 0;
  const r = {
    val: fmtUSD(u), sub: 'Ventas ' + fmtUSD(ingreso) + ' − costo ' + fmtUSD(costo),
    margenVal: margen.toFixed(1) + '%',
    // Un renglón con fob 0 dispara el margen al 100%: se avisa en vez de mostrar un número bonito y falso
    margenSub: sinCosto > 0 ? 'Ojo: ' + sinCosto + (sinCosto === 1 ? ' renglón sin costo' : ' renglones sin costo') + ' — margen inflado' : 'Sobre lo efectivamente vendido'
  };
  if (cf <= 0) { r.peVal = fmtUSD(0); r.peSub = 'Configura los costos fijos'; }
  else if (margen <= 0) { r.peVal = '—'; r.peSub = 'Margen en cero o negativo'; }
  else {
    const pe = cf / (margen / 100);
    const falta = pe - ingreso;
    r.peVal = fmtUSD(pe);
    r.peSub = falta > 0 ? 'Faltan ' + fmtUSD(falta) + ' para cubrir los fijos' : 'Superado por ' + fmtUSD(Math.abs(falta));
  }
  return r;
});
const top = computed(() => (itsMes.value && itsMes.value.length ? topProductos(itsMes.value) : []));

// ═══ IMPORTADO vs LOCAL con selector de período ═══
const rango = ref('mes');
const custDesde = ref('');
const custHasta = ref('');
const origen = ref({ estado: 'cargando', lbl: 'este mes', etiqueta: 'este mes', data: null, error: '' });
const detalleAbierto = ref(false);

function cambioRango() {
  if (rango.value === 'custom') {
    // Se precarga con el mes en curso y espera al botón Aplicar
    const h = new Date();
    if (!custDesde.value) custDesde.value = fISO(new Date(h.getFullYear(), h.getMonth(), 1));
    if (!custHasta.value) custHasta.value = fISO(h);
    return;
  }
  cargarOrigen();
}

async function cargarOrigen() {
  const r = rangoOrigen(rango.value, custDesde.value, custHasta.value);
  if (r.error) { store.notif(r.error, 'error'); return; }
  if (!store.supabaseConectado) { origen.value = { estado: 'sinconexion', lbl: r.etiqueta, etiqueta: r.etiqueta, data: null }; return; }
  const empresaConsultada = store.empresa;
  origen.value = { estado: 'cargando', lbl: origen.value.lbl, etiqueta: r.etiqueta, data: null };
  try {
    const d = await cargarVentasPeriodo(empresaConsultada, r.desde, r.hastaExcl);
    if (store.empresa !== empresaConsultada) return;
    const lbl = d.nFacts ? r.etiqueta + ' · ' + d.nFacts + ' factura(s)' : r.etiqueta;
    origen.value = { estado: 'listo', lbl, etiqueta: r.etiqueta, data: d.nFacts ? { ...d, etiqueta: r.etiqueta } : null };
  } catch (e) {
    origen.value = { estado: 'error', lbl: r.etiqueta, etiqueta: r.etiqueta, data: null, error: e.message || String(e) };
  }
}

const R = computed(() => (origen.value.data ? resumenOrigen(origen.value.data.its, origen.value.data.fmap, store.productos) : null));
const bloquesOrigen = computed(() => (R.value ? [
  { key: 'importado', nom: 'Importado', c: R.value.g.importado, col: '#EAF0F8', icono: 'ship', v: R.value.VR.importado },
  { key: 'local', nom: 'Compra local', c: R.value.g.local, col: '#FBF3E0', icono: 'building-store', v: R.value.VR.local }
] : []));
const tablasDetalle = computed(() => {
  if (!origen.value.data) return [];
  const prods = agruparProductos(origen.value.data.its, origen.value.data.fmap, store.productos);
  return [
    { key: 'importado', titulo: 'IMPORTADO', icono: 'ship', col: '#EAF0F8', lista: prods.filter(p => p.origen === 'importado') },
    { key: 'local', titulo: 'COMPRA LOCAL', icono: 'building-store', col: '#FBF3E0', lista: prods.filter(p => p.origen === 'local') }
  ].filter(t => t.lista.length).map(t => ({ ...t, tV: t.lista.reduce((a, p) => a + p.venta, 0), tW: t.lista.reduce((a, p) => a + p.verde, 0) }));
});

function descargarDetalleOrigen() {
  const d = origen.value.data;
  if (!d || !d.its.length) { store.notif('No hay datos cargados para ese período', 'error'); return; }
  descargarCSV('ARJ_detalle_origen_' + hoyArchivo() + '.csv', filasDetalleOrigen(d, nombreEmp.value, store.productos));
  store.notif(d.its.length + ' renglones descargados', 'success');
}

// ═══ METAS DE VENTA (v13.1 / v13.2) ═══
// Por período: subir la meta en diciembre no reescribe si agosto se cumplió
const metasHist = computed(() => (store.configuracion && store.configuracion.metas_hist) || {});
const equipo = computed(() => normalizarEquipo(store.configuracion && store.configuracion.equipo));
const metasPer = ref(periodoDe(new Date()));
const esMesCerrado = computed(() => metasPer.value !== periodoDe(new Date()));
const opcionesPeriodo = computed(() => {
  const s = new Set(Object.keys(metasHist.value));
  const h = new Date();
  for (let k = 0; k < 6; k++) s.add(periodoDe(new Date(h.getFullYear(), h.getMonth() - k, 1)));
  return [...s].sort().reverse();
});
function metasDe(per, hist = metasHist.value) {
  const m = hist[per] || {};
  return {
    directa: typeof m.directa === 'number' ? m.directa : (parseFloat(m.directa) || 0),
    dist: typeof m.dist === 'number' ? m.dist : (parseFloat(m.dist) || 0),
    vendedores: (m.vendedores && typeof m.vendedores === 'object') ? { ...m.vendedores } : {}
  };
}
const M = computed(() => metasDe(metasPer.value));
const metaEmpresa = computed(() => M.value[claveEmpresa(store.empresa)] || 0);

// Ventas del mes en curso: por empresa y, en la empresa activa, por vendedor
const ventasMesActual = computed(() => {
  const { mes0 } = cortes();
  const r = { directa: 0, distribuidora: 0, vendedores: {} };
  validas.value.forEach(f => {
    if (new Date(f.fecha_raw) < mes0) return;
    const t = f.total || 0;
    if (f.empresa === 'directa') r.directa += t; else r.distribuidora += t;
    if (f.empresa === store.empresa) {
      const v = f.vendedor || 'Sin vendedor';
      r.vendedores[v] = (r.vendedores[v] || 0) + t;
    }
  });
  return r;
});
const ventasEmpresa = computed(() => ventasMesActual.value[store.empresa] || 0);
const pctEmp = computed(() => (metaEmpresa.value > 0 ? Math.min(100, (ventasEmpresa.value / metaEmpresa.value) * 100) : 0));
const faltaEmp = computed(() => Math.max(0, metaEmpresa.value - ventasEmpresa.value));

// Base REAL para sugerir: lo vendido el mes anterior en esta empresa
const baseSug = computed(() => {
  const { mes0, mesAnt0 } = cortes();
  return validas.value.filter(f => f.empresa === store.empresa)
    .reduce((a, f) => { const d = new Date(f.fecha_raw); return (d >= mesAnt0 && d < mes0) ? a + (f.total || 0) : a; }, 0);
});

// Aparecen: el equipo de esta empresa + cualquiera que haya facturado
const delEquipo = computed(() => equipo.value.filter(t => t.empresa === 'ambas' || t.empresa === claveEmpresa(store.empresa)).map(t => t.nombre));
const listaTrab = computed(() => [...new Set(delEquipo.value.concat(Object.keys(ventasMesActual.value.vendedores)))].sort());
const filasTrab = computed(() => listaTrab.value.map(v => {
  const meta = parseFloat(M.value.vendedores[v]) || 0;
  const vendido = ventasMesActual.value.vendedores[v] || 0;
  return {
    v, meta, vendido, pct: meta > 0 ? Math.min(100, (vendido / meta) * 100) : 0,
    falta: Math.max(0, meta - vendido), cumplido: meta > 0 && vendido >= meta, enEquipo: delEquipo.value.includes(v)
  };
}));
// Si la suma es menor, el equipo puede cumplir al 100% y la empresa fallar
const avisoSuma = computed(() => {
  const suma = listaTrab.value.reduce((a, v) => a + (parseFloat(M.value.vendedores[v]) || 0), 0);
  if (!listaTrab.value.length || metaEmpresa.value <= 0 || suma <= 0) return null;
  const dif = suma - metaEmpresa.value;
  if (Math.abs(dif) / metaEmpresa.value * 100 < 5) return null;
  return { suma, dif, corta: dif < 0 };
});

async function guardarMetas(mod, mensaje) {
  if (!store.supabaseConectado) { store.notif('Sin conexión: la meta no se guardó', 'error'); return; }
  const hist = JSON.parse(JSON.stringify(metasHist.value));
  const m = metasDe(metasPer.value, hist);
  mod(m);
  hist[metasPer.value] = m;
  if (await store.actualizarConfiguracion({ metas_hist: hist })) store.notif(mensaje, 'success');
  else store.notif('Error guardando la meta', 'error');
}
function actualizarMetaEmpresa(v) {
  const n = Math.max(0, parseFloat(v) || 0);
  guardarMetas(m => { m[claveEmpresa(store.empresa)] = n; }, 'Meta de empresa actualizada');
}
function actualizarMetaVendedor(vend, val) {
  const n = Math.max(0, parseFloat(val) || 0);
  guardarMetas(m => { if (n === 0) delete m.vendedores[vend]; else m.vendedores[vend] = n; }, `Meta de ${vend} actualizada`);
}
function sugerirMeta(modalidad) {
  const base = baseSug.value;
  if (base <= 0) { store.notif('No hay ventas del mes anterior para calcular la sugerencia', 'error'); return; }
  const factor = modalidad === 'conservadora' ? 0.9 : modalidad === 'moderada' ? 1.1 : 1.3;
  const nueva = Math.round(base * factor / 100) * 100;
  guardarMetas(m => { m[claveEmpresa(store.empresa)] = nueva; }, `Meta ajustada a ${fmtUSD(nueva)} (${modalidad})`);
}

// ═══ EQUIPO DE TRABAJO: solo para ponerles metas, no crea usuarios ═══
const equipoAbierto = ref(false);
const eqNombre = ref('');
const eqEmpresa = ref('directa');
function abrirEquipo() {
  if (store.rol !== 'gerente') { store.notif('Solo el gerente puede gestionar el equipo', 'error'); return; }
  eqNombre.value = '';
  eqEmpresa.value = claveEmpresa(store.empresa);
  equipoAbierto.value = true;
}
async function guardarEquipo(lista) {
  if (!store.supabaseConectado) { store.notif('Sin conexión: el cambio no se guardó', 'error'); return false; }
  const ok = await store.actualizarConfiguracion({ equipo: lista });
  if (!ok) store.notif('Error guardando el equipo', 'error');
  return ok;
}
async function agregarAlEquipo() {
  const nombre = eqNombre.value.trim().toUpperCase();
  if (!nombre) { store.notif('Escribe el nombre del trabajador', 'error'); return; }
  if (nombre.length < 3) { store.notif('El nombre es muy corto', 'error'); return; }
  if (equipo.value.some(t => t.nombre === nombre)) { store.notif('Ese trabajador ya está en la lista', 'error'); return; }
  if (!(await guardarEquipo([...equipo.value, { nombre, empresa: eqEmpresa.value }]))) return;
  eqNombre.value = '';
  store.logBitacora('config', `Agregó a ${nombre} al equipo (${eqEmpresa.value})`, false);
  store.notif(`${nombre} agregado al equipo`, 'success');
}
// Solo se saca de la LISTA: sus ventas y metas anteriores no se borran
async function quitarDelEquipo(i) {
  const t = equipo.value[i];
  if (!t) return;
  if (!confirm(`¿Quitar a ${t.nombre} del equipo?\n\nSus ventas y metas anteriores NO se borran.`)) return;
  if (!(await guardarEquipo(equipo.value.filter((_, k) => k !== i)))) return;
  store.logBitacora('config', `Quitó a ${t.nombre} del equipo`, false);
  store.notif(`${t.nombre} quitado del equipo`, 'warning');
}

// ═══ COMPARATIVA MES ACTUAL vs MES ANTERIOR ═══
const compMeses = computed(() => {
  const { mes0, mesAnt0 } = cortes();
  let act = 0, nAct = 0, ant = 0, nAnt = 0;
  validas.value.filter(f => f.empresa === store.empresa).forEach(f => {
    const d = new Date(f.fecha_raw);
    if (d >= mes0) { act += f.total || 0; nAct++; } else if (d >= mesAnt0) { ant += f.total || 0; nAnt++; }
  });
  const nombreMes = d => d.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
  return {
    act, ant, tope: Math.max(act, ant, 1), varPct: ant > 0 ? ((act - ant) / ant) * 100 : 0,
    barras: [
      { etiqueta: nombreMes(mes0) + ' (en curso)', val: act, n: nAct, color: 'linear-gradient(90deg,var(--blue),var(--navy))' },
      { etiqueta: nombreMes(mesAnt0), val: ant, n: nAnt, color: 'var(--dgray)' }
    ]
  };
});

// Últimas 20 ventas (todas las empresas, como el monolito)
const ventasRecientes = computed(() => store.todasFacturas.slice(0, 20));
function fechaReciente(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

// ═══ RANKING DE CLIENTES (v13.2): solo la empresa activa ═══
const ranking = computed(() => {
  const hoy = new Date();
  const { mes0 } = cortes();
  const porCliente = {};
  validas.value.filter(f => f.empresa === store.empresa).forEach(f => {
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
  const topC = todos.filter(c => c.mes > 0).sort((a, b) => b.mes - a.mes).slice(0, 5);
  // "Dejó de comprar": compró al menos 2 veces y lleva 30 días o más sin comprar
  const dormidos = todos.filter(c => c.comprasHist >= 2 && c.ultima && Math.floor((hoy - c.ultima) / 86400000) >= 30)
    .map(c => ({ ...c, dias: Math.floor((hoy - c.ultima) / 86400000), prom: Math.round(c.totalHist / c.comprasHist) }))
    .sort((a, b) => b.dias - a.dias).slice(0, 6);
  return { top: topC, dormidos };
});
const fechaCortaRk = d => d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });

// ═══ RESPALDOS (v13.2 / v13.36) ═══
const factsSemana = computed(() => {
  const desde = new Date(Date.now() - 7 * 86400000);
  return store.todasFacturas.filter(f => f.fecha_raw && new Date(f.fecha_raw) >= desde);
});

function backupInventario() {
  if (!store.productos.length) { store.notif('No hay productos cargados', 'error'); return; }
  // 'Costo sin recargo divisas' es VISTA DE GESTIÓN, no cifra contable
  const filas = [['Codigo', 'Cod. original', 'Descripcion', 'Marca', 'Sistema', 'Origen', 'Proveedor',
    'Embarque', 'FOB USD', 'Factor landed', 'Costo landed USD', 'Costo sin recargo divisas USD',
    'Precio publico USD', 'Margen %', 'Stock VD', 'Stock Dist', 'Aplicacion']];
  store.productos.forEach(p => {
    const emb = store.embarques.find(x => x.id === p.embarque_id);
    const sd = costoSinDivisas(p, store.embarques, store.productos);
    const pv = precioLista(p);
    const cl = costoLanded(p, store.productos);
    const mg = pv > 0 ? (100 * (pv - cl) / pv) : 0;
    filas.push([
      p.cod_alt, p.cod_orig || '', p.desc, p.marca || '', p.sistema || '',
      p.origen || 'importado', p.proveedor || '', emb ? emb.codigo : '',
      (p.fob || 0).toFixed(2), (p.factor_landed || FACTOR_LANDED_FALLBACK).toFixed(4),
      cl.toFixed(2), sd == null ? '' : sd.toFixed(2), pv.toFixed(2), mg.toFixed(1),
      p.stock_vd || 0, p.stock_dist || 0, p.marca_modelo || ''
    ]);
  });
  descargarCSV('ARJ_inventario_' + hoyArchivo() + '.csv', filas);
  store.logBitacora('inventario', 'Descargó respaldo de inventario (' + store.productos.length + ' productos)', false);
  store.notif(store.productos.length + ' productos descargados', 'success');
}

// v13.36: unidades separadas. Bruto y descuento en $BCV; el cobro en efectivo son $verdes
function backupSemanal() {
  const hoy = new Date();
  const desde = new Date(hoy.getTime() - 7 * 86400000);
  const facts = factsSemana.value;
  if (!facts.length) { store.notif('No hay facturas en los últimos 7 días', 'error'); return; }
  const filas = [['RESUMEN SEMANAL ARJ — ' + desde.toLocaleDateString('es-VE') + ' al ' + hoy.toLocaleDateString('es-VE')],
    ['Los montos $BCV y los $verdes son unidades distintas. NO se suman entre si.'], [],
    ['Factura', 'Fecha', 'Empresa', 'Cliente', 'Vendedor', 'Tipo', 'Estado',
      'Bruto $BCV', 'Descuento $BCV', 'Neto $BCV', 'Cobrado en $verde', 'Abonado $BCV', 'Saldo $BCV', 'Motivo del descuento']];
  let totBruto = 0, totDto = 0, totNeto = 0, totVerde = 0, totSaldo = 0, totAbon = 0, nVerde = 0;
  facts.forEach(f => {
    const bruto = f.total || 0;
    const dto = f.descuento_manual || 0;
    const neto = Math.round((bruto - dto) * 100) / 100;
    const saldo = f.saldo_pendiente || 0;
    // Abonado real = lo saldado del NETO (partir del bruto contaba el descuento como pago)
    const abon = Math.round((neto - saldo) * 100) / 100;
    const cv = (f.cobrar_verde != null && f.cobrar_verde > 0) ? f.cobrar_verde : null;
    if (f.estado !== 'anulada') {
      totBruto += bruto; totDto += dto; totNeto += neto; totSaldo += saldo; totAbon += abon;
      if (cv != null) { totVerde += cv; nVerde++; }
    }
    filas.push([f.num, f.fecha, f.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora',
      f.cliente_nombre_snap || f.cliente, f.vendedor || '', f.tipo_pago || '', (f.estado || '').toUpperCase(),
      bruto.toFixed(2), dto.toFixed(2), neto.toFixed(2), cv != null ? cv.toFixed(2) : '',
      abon.toFixed(2), saldo.toFixed(2), f.motivo_descuento || '']);
  });
  filas.push([]);
  filas.push(['TOTAL BRUTO $BCV (sin anuladas)', '', '', '', '', '', '', totBruto.toFixed(2)]);
  filas.push(['TOTAL DESCUENTOS $BCV', '', '', '', '', '', '', totDto.toFixed(2)]);
  filas.push(['TOTAL NETO FACTURADO $BCV', '', '', '', '', '', '', totNeto.toFixed(2)]);
  filas.push(['TOTAL COBRADO $BCV', '', '', '', '', '', '', totAbon.toFixed(2)]);
  filas.push(['TOTAL POR COBRAR $BCV', '', '', '', '', '', '', totSaldo.toFixed(2)]);
  filas.push([]);
  filas.push(['TOTAL ACORDADO EN $VERDE (' + nVerde + ' factura(s))', '', '', '', '', '', '', '', '', '', totVerde.toFixed(2)]);
  filas.push(['Esta cifra NO se suma con las de arriba: son dolares distintos.']);
  descargarCSV('ARJ_semana_' + hoyArchivo() + '.csv', filas);
  store.logBitacora('inventario', 'Descargó resumen semanal (' + facts.length + ' facturas)', false);
  store.notif(facts.length + ' facturas de la semana descargadas', 'success');
}

// JSON con todo lo que hay en memoria: es lo que sirve para reconstruir
function backupCompleto() {
  const cfg = store.configuracion || {};
  const dump = {
    generado: new Date().toISOString(),
    version: 'v13.2',
    tasas: { par: store.tasa_par, bcv: store.tasa_bcv },
    equipo: cfg.equipo || [],
    metas_hist: cfg.metas_hist || {},
    costos_fijos_hist: cfg.costos_fijos_hist || {},
    productos: store.productos,
    clientes: store.clientes,
    facturas: store.todasFacturas,
    cotizaciones: store.presupuestos,
    bitacora: store.bitacora
  };
  descargarArchivo('ARJ_respaldo_completo_' + hoyArchivo() + '.json', JSON.stringify(dump, null, 2), 'application/json');
  store.logBitacora('inventario', 'Descargó respaldo completo del sistema', true);
  store.notif('Respaldo completo descargado', 'success');
}

// ═══ Carga y recarga ═══
function recargarTodo() {
  cargarUtilidad();
  cargarOrigen();
}
onMounted(recargarTodo);
watch(() => store.empresa, () => { detalleAbierto.value = false; recargarTodo(); });
// Una venta nueva cambia la utilidad y el panel de origen
watch(() => store.todasFacturas.length, () => cargarUtilidad());
</script>

<style scoped>
.rp-in { padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; font-family: inherit }
.rp-ranking { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px }
.rp-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px }
.rp-3col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px }
@media (max-width: 760px) {
  .rp-ranking, .rp-2col, .rp-3col { grid-template-columns: 1fr }
}
</style>
