<template>
  <div class="page active" id="page-dashboard">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="page-title"><i class="ti ti-chart-bar"></i> Reportes y Dashboard</h1>
        <p class="page-sub">Resumen del día · Comparativa entre empresas · Ranking · Reorden · Backup</p>
      </div>
    </div>

    <!-- SUB-NAVEGACIÓN -->
    <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--border);overflow-x:auto;flex-wrap:wrap">
      <button :class="['search-tab', { active: subRep === 'resumen' }]" @click="subRep = 'resumen'"><i class="ti ti-dashboard"></i> Resumen</button>
      <button :class="['search-tab', { active: subRep === 'comparativa' }]" @click="subRep = 'comparativa'"><i class="ti ti-arrows-left-right"></i> Comparar empresas</button>
      <button :class="['search-tab', { active: subRep === 'ranking' }]" @click="subRep = 'ranking'"><i class="ti ti-trophy"></i> Ranking clientes</button>
      <button :class="['search-tab', { active: subRep === 'reorden' }]" @click="subRep = 'reorden'"><i class="ti ti-package"></i> Qué reordenar</button>
      <button :class="['search-tab', { active: subRep === 'backup' }]" @click="subRep = 'backup'"><i class="ti ti-database"></i> Respaldos</button>
    </div>

    <!-- 1. RESUMEN -->
    <div v-if="subRep === 'resumen'">
      <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(4, 1fr);gap:12px;margin-bottom:20px">
        <div class="kpi-card green" style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div class="kpi-icon" style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--lgreen);color:var(--green);margin-bottom:8px"><i class="ti ti-trending-up"></i></div>
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:500">Ventas hoy</div>
          <div style="font-size:21px;color:var(--navy);font-weight:600">{{ fmtUSD(ventasHoy) }}</div>
          <div style="font-size:11px;color:var(--dgray);font-weight:600;margin-top:3px">{{ facturasHoy }} factura(s)</div>
        </div>
        <div class="kpi-card blue" style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div class="kpi-icon" style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--lblue);color:var(--blue);margin-bottom:8px"><i class="ti ti-calendar"></i></div>
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:500">Ventas este mes</div>
          <div style="font-size:21px;color:var(--navy);font-weight:600">{{ fmtUSD(ventasMes) }}</div>
          <div style="font-size:11px;color:var(--dgray);font-weight:600;margin-top:3px">{{ facturasMes }} factura(s)</div>
        </div>
        <div class="kpi-card gold" style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div class="kpi-icon" style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--lgold);color:var(--gold);margin-bottom:8px"><i class="ti ti-percentage"></i></div>
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:500">Margen del catálogo</div>
          <div style="font-size:21px;color:var(--navy);font-weight:600">{{ margenCatalogo }}%</div>
          <div style="font-size:11px;color:var(--dgray);font-weight:600;margin-top:3px">Teórico — todo a precio de lista</div>
        </div>
        <div class="kpi-card red" style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div class="kpi-icon" style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--lred);color:var(--red);margin-bottom:8px"><i class="ti ti-package"></i></div>
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:500">Stock crítico</div>
          <div style="font-size:21px;color:var(--navy);font-weight:600">{{ stockCritico.bajos }}</div>
          <div style="font-size:11px;color:var(--dgray);margin-top:3px">1 a 10 ud · {{ stockCritico.agotados }} agotados de {{ store.productos.length }}</div>
        </div>
        
        <div class="kpi-card green" style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div class="kpi-icon" style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--lgreen);color:var(--green);margin-bottom:8px"><i class="ti ti-coin"></i></div>
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:500">Utilidad bruta del mes</div>
          <div style="font-size:21px;color:var(--navy);font-weight:600">{{ fmtUSD(utilidadMes) }}</div>
          <div style="font-size:11px;color:var(--dgray);margin-top:3px">Ventas {{ fmtUSD(ventasMes) }} — costo {{ fmtUSD(ventasMes - utilidadMes) }}</div>
        </div>
        <div class="kpi-card gold" style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div class="kpi-icon" style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--lgold);color:var(--gold);margin-bottom:8px"><i class="ti ti-percentage"></i></div>
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:500">Margen real vendido</div>
          <div style="font-size:21px;color:var(--navy);font-weight:600">{{ margenRealMes }}%</div>
          <div style="font-size:11px;color:var(--dgray);margin-top:3px">Sobre lo efectivamente vendido</div>
        </div>
        <div class="kpi-card blue" style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div class="kpi-icon" style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--lblue);color:var(--blue);margin-bottom:8px"><i class="ti ti-scale"></i></div>
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:500">Punto de equilibrio</div>
          <div style="font-size:21px;color:var(--navy);font-weight:600">{{ fmtUSD(puntoEquilibrio) }}</div>
          <div style="font-size:11px;color:var(--dgray);margin-top:3px">Para cubrir los fijos</div>
        </div>
        <div class="kpi-card red" style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div class="kpi-icon" style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--lred);color:var(--red);margin-bottom:8px"><i class="ti ti-building-store"></i></div>
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:500">Costos fijos del mes</div>
          <div style="font-size:21px;color:var(--navy);font-weight:600">{{ fmtUSD(costosFijos) }}</div>
          <div style="font-size:11px;color:var(--dgray);margin-top:3px">Referencia local</div>
        </div>
      </div>

      <!-- IMPORTADO VS LOCAL -->
      <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;font-size:15px;color:var(--navy);font-weight:600"><i class="ti ti-world" style="color:var(--blue)"></i> Importado vs Local <span style="font-weight:500;color:var(--dgray);font-size:13px">— Este mes · {{ facturasMes }} factura(s)</span></h3>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="background:#EAF0F8;border-radius:8px;padding:12px">
            <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:600;margin-bottom:4px"><i class="ti ti-ship"></i> Importado</div>
            <div style="font-size:18px;color:var(--navy);font-weight:700">{{ fmtUSD(origenData.importado.venta) }}</div>
            <div style="font-size:11px;color:var(--dgray);margin-bottom:8px">{{ origenData.importado.pct.toFixed(1) }}% de la venta · {{ origenData.importado.uds }} uds · {{ origenData.importado.renglones }} renglones</div>
            <div style="background:#FFF;border-radius:4px;height:6px;overflow:hidden;margin-bottom:8px">
              <div :style="`background:var(--gold);height:100%;width:${origenData.importado.pct}%`"></div>
            </div>
            <div style="font-size:11.5px;color:var(--dgray)">Costo <strong>{{ fmtUSD(origenData.importado.costo) }}</strong></div>
            <div style="font-size:11.5px;color:var(--dgray)">Utilidad <strong :style="{ color: origenData.importado.utilidad >= 0 ? '#1E7B34' : '#B00020' }">{{ fmtUSD(origenData.importado.utilidad) }}</strong> · margen <strong>{{ origenData.importado.margen.toFixed(1) }}%</strong></div>
            <div style="font-size:11.5px;color:var(--dgray)">Aporta {{ (origenData.importado.utilidad / (origenData.importado.utilidad + origenData.local.utilidad) * 100 || 0).toFixed(1) }}% de la utilidad</div>
            <div v-if="origenData.importado.verde > 0" style="font-size:11.5px;color:#1E7B34;font-weight:600;margin-top:2px">≈ {{ fmtUSD(origenData.importado.verde) }} en efectivo verde</div>
          </div>
          <div style="background:#FBF3E0;border-radius:8px;padding:12px">
            <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:600;margin-bottom:4px"><i class="ti ti-building-store"></i> Compra Local</div>
            <div style="font-size:18px;color:var(--navy);font-weight:700">{{ fmtUSD(origenData.local.venta) }}</div>
            <div style="font-size:11px;color:var(--dgray);margin-bottom:8px">{{ origenData.local.pct.toFixed(1) }}% de la venta · {{ origenData.local.uds }} uds · {{ origenData.local.renglones }} renglones</div>
            <div style="background:#FFF;border-radius:4px;height:6px;overflow:hidden;margin-bottom:8px">
              <div :style="`background:var(--gold);height:100%;width:${origenData.local.pct}%`"></div>
            </div>
            <div style="font-size:11.5px;color:var(--dgray)">Costo <strong>{{ fmtUSD(origenData.local.costo) }}</strong></div>
            <div style="font-size:11.5px;color:var(--dgray)">Utilidad <strong :style="{ color: origenData.local.utilidad >= 0 ? '#1E7B34' : '#B00020' }">{{ fmtUSD(origenData.local.utilidad) }}</strong> · margen <strong>{{ origenData.local.margen.toFixed(1) }}%</strong></div>
            <div style="font-size:11.5px;color:var(--dgray)">Aporta {{ (origenData.local.utilidad / (origenData.importado.utilidad + origenData.local.utilidad) * 100 || 0).toFixed(1) }}% de la utilidad</div>
            <div v-if="origenData.local.verde > 0" style="font-size:11.5px;color:#1E7B34;font-weight:600;margin-top:2px">≈ {{ fmtUSD(origenData.local.verde) }} en efectivo verde</div>
          </div>
        </div>
        <div v-if="origenData.local.venta > 0 && origenData.importado.venta > 0" style="margin-top:12px;font-size:12px;color:var(--dgray)">
          El margen de <strong>{{ origenData.importado.margen >= origenData.local.margen ? 'importado' : 'local' }}</strong> es {{ Math.abs(origenData.importado.margen - origenData.local.margen).toFixed(1) }} puntos mayor. Utilidad total del mes: <strong>{{ fmtUSD(origenData.importado.utilidad + origenData.local.utilidad) }}</strong>.
        </div>
      </div>

      <!-- METAS DE VENTA -->
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h2 style="font-size:15px;color:var(--navy);font-weight:600;display:flex;align-items:center;gap:8px"><i class="ti ti-target"></i> Metas de venta del mes ({{ mesActualLbl }})</h2>
          <button class="btn btn-secondary btn-sm" @click="abrirModalEquipo"><i class="ti ti-users"></i> Gestionar equipo</button>
        </div>
        
        <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div>
              <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:500">Meta empresa</div>
              <div style="font-size:14px;font-weight:600;color:var(--navy)">{{ store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora' }}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:11.5px;color:var(--dgray)">Meta:</span>
              <input type="number" v-model.number="metaEmpresa" class="val-input" style="width:110px" @change="guardarMetas">
            </div>
          </div>
          <div style="background:var(--gray);border-radius:5px;height:24px;position:relative;overflow:hidden">
            <div :style="`position:absolute;inset:0;background:linear-gradient(90deg,var(--green),#4CAF50);width:${pctMetaEmpresa}%;transition:width 0.4s;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;color:#FFF;font-size:11px;font-weight:600`">{{ pctMetaEmpresa > 8 ? pctMetaEmpresa.toFixed(1) + '%' : '' }}</div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11.5px">
            <span style="color:var(--green);font-weight:600">Vendido: {{ fmtUSD(ventasMesEmpresa) }}</span>
            <span style="color:var(--dgray)">Falta: <strong :style="{ color: faltaMetaEmpresa > 0 ? 'var(--gold)' : 'var(--green)' }">{{ fmtUSD(faltaMetaEmpresa) }}</strong></span>
          </div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);font-size:11px;color:var(--dgray)">
            <i class="ti ti-bulb"></i> Sugerencias sobre el mes anterior ({{ fmtUSD(ventasMesAnteriorEmpresa) }}):
            <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;margin:2px" @click="metaEmpresa = Math.round(ventasMesAnteriorEmpresa * 0.9); guardarMetas()">Conservadora: {{ fmtUSD(Math.round(ventasMesAnteriorEmpresa * 0.9)) }}</button>
            <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;margin:2px" @click="metaEmpresa = Math.round(ventasMesAnteriorEmpresa * 1.1); guardarMetas()">Moderada: {{ fmtUSD(Math.round(ventasMesAnteriorEmpresa * 1.1)) }}</button>
            <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;margin:2px" @click="metaEmpresa = Math.round(ventasMesAnteriorEmpresa * 1.3); guardarMetas()">Agresiva: {{ fmtUSD(Math.round(ventasMesAnteriorEmpresa * 1.3)) }}</button>
          </div>
        </div>


      </div>

      <!-- COMPARATIVA -->
      <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:16px">
        <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--navy)"><i class="ti ti-chart-line" style="color:var(--blue)"></i> Comparativa de ventas — Mes actual vs Mes anterior</h3>
        <div style="margin-bottom:10px">
          <div style="font-size:11.5px;color:var(--dgray);margin-bottom:4px">Mes en curso</div>
          <div style="background:var(--gray);border-radius:4px;height:18px;position:relative;overflow:hidden">
            <div :style="`background:var(--navy);height:100%;width:${pctComparativa(ventasMes, maxComparativa)}%`"></div>
          </div>
          <div style="text-align:right;font-size:11px;color:var(--dgray);margin-top:2px">{{ fmtUSD(ventasMes) }}</div>
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:11.5px;color:var(--dgray);margin-bottom:4px">Mes anterior</div>
          <div style="background:var(--gray);border-radius:4px;height:18px;position:relative;overflow:hidden">
            <div :style="`background:var(--dgray);height:100%;width:${pctComparativa(ventasMesAnteriorTotal, maxComparativa)}%`"></div>
          </div>
          <div style="text-align:right;font-size:11px;color:var(--dgray);margin-top:2px">{{ fmtUSD(ventasMesAnteriorTotal) }}</div>
        </div>
        <div v-if="ventasMesAnteriorTotal > 0" :style="`font-size:11.5px;color:${ventasMes >= ventasMesAnteriorTotal ? 'var(--green)' : 'var(--red)'};font-weight:600;margin-top:10px;padding-top:10px;border-top:1px dashed var(--border)`">
          <i :class="ventasMes >= ventasMesAnteriorTotal ? 'ti ti-arrow-up' : 'ti ti-arrow-down'"></i> {{ Math.abs(((ventasMes - ventasMesAnteriorTotal) / ventasMesAnteriorTotal) * 100).toFixed(1) }}% respecto al mes anterior · diferencia {{ fmtUSD(Math.abs(ventasMes - ventasMesAnteriorTotal)) }}
        </div>
      </div>

      <!-- GRID TOP / RECIENTES -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:16px 18px">
          <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--navy)"><i class="ti ti-chart-bar" style="color:var(--blue)"></i> Productos más vendidos del mes</h3>
          <div v-for="p in topProductos" :key="p.cod" style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--navy);font-weight:600;margin-bottom:2px">
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:10px">{{ p.desc }}</span>
              <span>{{ p.cant }} ud · {{ fmtUSD(p.total) }}</span>
            </div>
            <div style="background:var(--gray);border-radius:2px;height:8px">
              <div :style="`background:var(--navy);height:100%;width:${(p.total / topProductosMax) * 100}%`"></div>
            </div>
          </div>
          <div v-if="topProductos.length === 0" style="font-size:12px;color:var(--dgray)">No hay ventas registradas este mes.</div>
        </div>
        <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:16px 18px">
          <h3 style="margin:0 0 12px 0;font-size:14px;color:var(--navy)"><i class="ti ti-receipt" style="color:var(--blue)"></i> Últimas ventas</h3>
          <div v-for="f in ultimasVentas" :key="f.id" style="display:flex;justify-content:space-between;border-bottom:1px solid var(--gray);padding:8px 0">
            <div>
              <div style="font-size:12px;color:var(--navy);font-weight:600">{{ f.cliente }}</div>
              <div style="font-size:10px;color:var(--dgray)">{{ f.num }} · {{ f.fecha }} · {{ f.vendedor }}</div>
            </div>
            <div style="font-size:13px;font-weight:700;color:var(--navy)">{{ fmtUSD(f.total) }}</div>
          </div>
          <div v-if="ultimasVentas.length === 0" style="font-size:12px;color:var(--dgray)">No hay ventas registradas.</div>
        </div>
      </div>
    </div>
    
    <!-- OTROS TABS (Comparativa, Ranking, Reorden, Backup) MANTENIDOS DEL ANTERIOR -->
    <!-- COMPARATIVA EMPRESAS -->
    <div v-if="subRep === 'comparativa'">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="card" style="border-top:3px solid var(--blue)">
          <div class="card-tit" style="color:var(--blue)"><i class="ti ti-building-store"></i> ARJ Venta Directa</div>
          <div style="margin-top:8px">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEE"><span>Facturas emitidas:</span><strong>{{ facturasVD.length }}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEE"><span>Total facturado:</span><strong style="color:var(--green)">{{ fmtUSD(ventasVD) }}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEE"><span>Saldo pendiente:</span><strong style="color:var(--red)">{{ fmtUSD(cobrarVD) }}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0"><span>Items en stock:</span><strong>{{ totalStockVD }} unidades</strong></div>
          </div>
        </div>
        <div class="card" style="border-top:3px solid var(--gold)">
          <div class="card-tit" style="color:var(--gold)"><i class="ti ti-truck-delivery"></i> Distribuidora ARJ</div>
          <div style="margin-top:8px">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEE"><span>Facturas emitidas:</span><strong>{{ facturasDist.length }}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEE"><span>Total facturado:</span><strong style="color:var(--green)">{{ fmtUSD(ventasDist) }}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEE"><span>Saldo pendiente:</span><strong style="color:var(--red)">{{ fmtUSD(cobrarDist) }}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0"><span>Items en stock:</span><strong>{{ totalStockDist }} unidades</strong></div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="subRep === 'ranking'" class="card">
      <div class="card-tit"><i class="ti ti-trophy"></i> Clientes Principales</div>
      <table class="tbl" style="margin-top:10px">
        <thead><tr><th class="center" style="width:5%">#</th><th>Cliente</th><th>RIF</th><th>Nivel</th><th class="num">Facturas</th><th class="num">Total USD</th></tr></thead>
        <tbody>
          <tr v-for="(c, idx) in rankingClientes" :key="c.id">
            <td class="center"><strong>{{ idx + 1 }}</strong></td><td><strong>{{ c.nombre }}</strong></td>
            <td style="font-family:monospace">{{ c.rif || '—' }}</td><td><span class="badge badge-info">{{ c.nivel }}</span></td>
            <td class="num">{{ c.compras_count }}</td><td class="num" style="font-weight:700;color:var(--green)">{{ fmtUSD(c.total_comprado) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="subRep === 'reorden'" class="card">
      <div class="card-tit"><i class="ti ti-package"></i> Repuestos con Stock Crítico</div>
      <table class="tbl" style="margin-top:10px">
        <thead><tr><th>Código</th><th>Descripción</th><th class="center">VD</th><th class="center">Dist</th><th class="center">Total</th></tr></thead>
        <tbody>
          <tr v-for="p in listCriticos" :key="p.id">
            <td><strong>{{ p.cod_alt }}</strong></td><td>{{ p.desc }}</td>
            <td class="center"><span :class="['badge', p.stock_vd <= 3 ? 'badge-danger' : 'badge-warning']">{{ p.stock_vd }}</span></td>
            <td class="center"><span :class="['badge', p.stock_dist <= 3 ? 'badge-danger' : 'badge-warning']">{{ p.stock_dist }}</span></td>
            <td class="center"><strong>{{ p.stock_vd + p.stock_dist }}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="subRep === 'backup'" class="card" style="max-width:600px">
      <div class="card-tit"><i class="ti ti-database"></i> Copias de Seguridad</div>
      <p style="font-size:12px;color:var(--dgray);margin:10px 0">Descarga una copia completa en formato JSON.</p>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn btn-primary" @click="descargarBackupCompleto"><i class="ti ti-download"></i> Descargar JSON</button>
      </div>
    </div>
    
    <!-- MODAL EQUIPO -->
    <div v-if="modalEquipo" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px">
      <div style="background:#FFF;border-radius:12px;padding:24px;width:100%;max-width:400px;position:relative">
        <button style="position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;font-size:20px;color:var(--dgray)" @click="modalEquipo = false">&times;</button>
        <h3 style="margin-top:0;margin-bottom:16px;color:var(--navy);font-size:18px"><i class="ti ti-users"></i> Gestionar Equipo</h3>
        <p style="font-size:12px;color:var(--dgray);margin-bottom:16px">Añade nombres de trabajadores para asignarles metas de venta individuales.</p>
        
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <input type="text" v-model="nuevoTrabajador" placeholder="Nombre del trabajador..." class="val-input" style="flex:1" @keyup.enter="agregarTrabajador">
          <button class="btn btn-primary" @click="agregarTrabajador">Añadir</button>
        </div>
        
        <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;background:#F9FAFB">
          <div v-for="(t, idx) in store.equipo_ventas" :key="idx" style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:#FFF">
            <span style="font-weight:600;font-size:13px">{{ t }}</span>
            <button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red);padding:2px 6px" @click="eliminarTrabajador(t)"><i class="ti ti-trash"></i></button>
          </div>
          <div v-if="store.equipo_ventas.length === 0" style="padding:16px;text-align:center;font-size:12px;color:var(--dgray)">No hay equipo registrado.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { cargarItemsVentasMes } from '../services/supabase.js';
import { guardarDatosLocal } from '../services/persistence.js';
import { fmtUSD, costoLanded, precioPublico } from '../services/pricing.js';

const store = useArjStore();
const subRep = ref('resumen');
const modalEquipo = ref(false);
const nuevoTrabajador = ref('');

// ==========================================
// LÓGICA DE FECHAS
// ==========================================
const hoy = new Date();
const currMonthKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
const currDateStr = hoy.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
const mesActualLbl = hoy.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });

// ==========================================
// UTILIDADES COMPARTIDAS
// ==========================================
const facturasDelMes = computed(() => {
  const year = hoy.getFullYear();
  const month = hoy.getMonth();
  return store.todasFacturas.filter(f => {
    if (f.estado === 'anulada' || !f.fecha_raw) return false;
    const d = new Date(f.fecha_raw);
    return d.getFullYear() === year && d.getMonth() === month;
  });
});

const facturasDeHoy = computed(() => {
  return store.todasFacturas.filter(f => f.estado !== 'anulada' && f.fecha === currDateStr);
});

// ==========================================
// KPIs SUPERIORES
// ==========================================
const ventasHoy = computed(() => facturasDeHoy.value.reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0));
const facturasHoy = computed(() => facturasDeHoy.value.length);
const ventasMes = computed(() => facturasDelMes.value.reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0));
const facturasMes = computed(() => facturasDelMes.value.length);

const margenCatalogo = computed(() => {
  if (store.productos.length === 0) return 0;
  let totalP = 0, totalC = 0;
  store.productos.forEach(p => {
    totalP += precioPublico(p.fob || 0);
    totalC += costoLanded(p, store.productos);
  });
  return totalP > 0 ? Math.round(((totalP - totalC) / totalP) * 100) : 0;
});

const stockCritico = computed(() => {
  const stockField = store.empresa === 'directa' ? 'stock_vd' : 'stock_dist';
  const bajos = store.productos.filter(p => p[stockField] > 0 && p[stockField] <= 10).length;
  const agotados = store.productos.filter(p => (p[stockField] || 0) <= 0).length;
  return { bajos, agotados };
});
const listCriticos = computed(() => {
  const stockField = store.empresa === 'directa' ? 'stock_vd' : 'stock_dist';
  return store.productos.filter(p => p[stockField] > 0 && p[stockField] <= 10);
});

const itemsVentasMes = ref([]);
const cargandoItems = ref(false);

const fetchItemsDelMes = async () => {
  const ids = facturasDelMes.value.map(f => f.id);
  if (ids.length > 0 && navigator.onLine && itemsVentasMes.value.length === 0) {
    cargandoItems.value = true;
    const items = await cargarItemsVentasMes(ids);
    itemsVentasMes.value = items;
    cargandoItems.value = false;
  }
};

onMounted(() => {
  fetchItemsDelMes();
});

watch(facturasDelMes, (newVal) => {
  if (newVal.length > 0 && itemsVentasMes.value.length === 0) {
    fetchItemsDelMes();
  }
}, { immediate: true });

const utilidadMes = computed(() => {
  let util = 0;
  itemsVentasMes.value.forEach(it => {
    let costo = 0;
    if (parseFloat(it.fob_unitario) > 0 && parseFloat(it.factor_landed) > 0) {
      costo = parseFloat(it.fob_unitario) * parseFloat(it.factor_landed);
    } else {
      const prod = store.productos.find(p => p.id === it.producto_id || p.cod_alt === it.cod_alt);
      if (prod) {
        costo = costoLanded(prod, store.productos);
      } else {
        const precioUnit = (parseFloat(it.total_linea) / (parseFloat(it.cantidad) || 1)) || parseFloat(it.precio_unitario) || 0;
        costo = precioUnit * 0.6; // fallback 60% costo
      }
    }
    const precioUnitario = (parseFloat(it.total_linea) / (parseFloat(it.cantidad) || 1)) || parseFloat(it.precio_unitario) || 0;
    util += (precioUnitario - costo) * (parseFloat(it.cantidad) || 1);
  });
  return util;
});

const margenRealMes = computed(() => ventasMes.value > 0 ? Math.round((utilidadMes.value / ventasMes.value) * 100) : 0);

// Costos Fijos hardcodeado a 2500 como en el legacy por defecto
const costosFijos = 2500;
const puntoEquilibrio = computed(() => {
  const m = margenRealMes.value / 100;
  return m > 0 ? (costosFijos / m) : 0;
});

// ==========================================
// IMPORTADO VS LOCAL
// ==========================================
const origenData = computed(() => {
  let impV = 0, impC = 0, impU = 0, impR = 0;
  let locV = 0, locC = 0, locU = 0, locR = 0;
  const brecha = (store.configuracion?.tasa_par || 1) / (store.configuracion?.tasa_bcv || 1);
  const brechaEfectiva = brecha > 0 ? brecha : 1;

  itemsVentasMes.value.forEach(it => {
    let costo = 0;
    let esImportado = false;
    
    // Determinar origen como en el prototipo
    const o = (it.origen || '').toString().trim().toLowerCase();
    if (o === 'local' || o === 'importado') {
      esImportado = o === 'importado';
    } else {
      const prod = store.productos.find(p => p.id === it.producto_id || p.cod_alt === it.cod_alt);
      const oc = prod ? (prod.origen || '').toString().trim().toLowerCase() : '';
      if (oc === 'local' || oc === 'importado') {
        esImportado = oc === 'importado';
      } else {
        const f = parseFloat(it.factor_landed);
        esImportado = !(isFinite(f) && f > 0 && f <= 1.001);
      }
    }
    
    if (parseFloat(it.fob_unitario) > 0 && parseFloat(it.factor_landed) > 0) {
      costo = parseFloat(it.fob_unitario) * parseFloat(it.factor_landed);
    } else {
      const prod = store.productos.find(p => p.id === it.producto_id || p.cod_alt === it.cod_alt);
      if (prod) {
        costo = costoLanded(prod, store.productos);
      } else {
        const precioUnit = (parseFloat(it.total_linea) / (parseFloat(it.cantidad) || 1)) || parseFloat(it.precio_unitario) || 0;
        costo = precioUnit * 0.6;
      }
    }

    const ventaTotal = parseFloat(it.total_linea) || 0;
    const costoTotal = costo * (parseFloat(it.cantidad) || 1);
    const uds = parseFloat(it.cantidad) || 1;

    if (esImportado) {
      impV += ventaTotal; impC += costoTotal; impU += uds; impR++;
    } else {
      locV += ventaTotal; locC += costoTotal; locU += uds; locR++;
    }
  });

  const tV = (impV + locV) || 1;
  const utilImp = impV - impC;
  const utilLoc = locV - locC;
  return {
    importado: { venta: impV, costo: impC, utilidad: utilImp, margen: impV > 0 ? (utilImp / impV * 100) : 0, pct: (impV / tV) * 100, uds: impU, renglones: impR, verde: utilImp / brechaEfectiva },
    local: { venta: locV, costo: locC, utilidad: utilLoc, margen: locV > 0 ? (utilLoc / locV * 100) : 0, pct: (locV / tV) * 100, uds: locU, renglones: locR, verde: utilLoc / brechaEfectiva }
  };
});

// ==========================================
// METAS DE VENTA
// ==========================================
// Inicializar
if (!store.metas_hist[currMonthKey]) {
  store.metas_hist[currMonthKey] = { directa: 0, dist: 0, vendedores: {} };
}
const mObj = computed(() => store.metas_hist[currMonthKey] || { directa: 0, dist: 0, vendedores: {} });

const metaEmpresa = ref(store.empresa === 'directa' ? (mObj.value.directa || 0) : (mObj.value.dist || 0));
const metasVendedores = ref(mObj.value.vendedores || {});

const equipoActivo = computed(() => {
  const keys = Object.keys(metasVendedores.value);
  const fromStore = store.equipo_ventas || [];
  return [...new Set([...keys, ...fromStore])].sort();
});

watch(() => store.empresa, (nv) => {
  metaEmpresa.value = nv === 'directa' ? (mObj.value.directa || 0) : (mObj.value.dist || 0);
});

const guardarMetas = () => {
  const base = store.metas_hist[currMonthKey] || { directa: 0, dist: 0, vendedores: {} };
  if (store.empresa === 'directa') base.directa = metaEmpresa.value;
  else base.dist = metaEmpresa.value;
  
  // Limpiar vacios
  Object.keys(metasVendedores.value).forEach(k => {
    if (!metasVendedores.value[k]) delete metasVendedores.value[k];
  });
  base.vendedores = { ...metasVendedores.value };
  
  store.metas_hist[currMonthKey] = base;
  guardarDatosLocal(store.$state);
};

const ventasMesEmpresa = computed(() => {
  return facturasDelMes.value.filter(f => f.empresa === store.empresa).reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
});
const pctMetaEmpresa = computed(() => metaEmpresa.value > 0 ? Math.min(100, (ventasMesEmpresa.value / metaEmpresa.value) * 100) : 0);
const faltaMetaEmpresa = computed(() => Math.max(0, metaEmpresa.value - ventasMesEmpresa.value));

const ventasMesAnteriorEmpresa = computed(() => {
  const mAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const year = mAnt.getFullYear();
  const month = mAnt.getMonth();
  return store.todasFacturas.filter(f => {
    if (f.estado === 'anulada' || f.empresa !== store.empresa || !f.fecha_raw) return false;
    const d = new Date(f.fecha_raw);
    return d.getFullYear() === year && d.getMonth() === month;
  }).reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
});

const ventasVendedor = (vend) => facturasDelMes.value.filter(f => f.vendedor === vend || f.vendedor === vend.toLowerCase()).reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
const pctVendedor = (vend) => {
  const m = metasVendedores.value[vend] || 0;
  if (m <= 0) return 0;
  return Math.min(100, (ventasVendedor(vend) / m) * 100);
};
const faltaVendedor = (vend) => Math.max(0, (metasVendedores.value[vend] || 0) - ventasVendedor(vend));
const esCumplida = (vend) => (metasVendedores.value[vend] > 0) && (ventasVendedor(vend) >= metasVendedores.value[vend]);

function abrirModalEquipo() {
  modalEquipo.value = true;
}
function agregarTrabajador() {
  if (nuevoTrabajador.value.trim() && !store.equipo_ventas.includes(nuevoTrabajador.value.trim())) {
    store.equipo_ventas.push(nuevoTrabajador.value.trim());
    if (!metasVendedores.value[nuevoTrabajador.value.trim()]) metasVendedores.value[nuevoTrabajador.value.trim()] = 0;
    nuevoTrabajador.value = '';
    guardarDatosLocal(store.$state);
  }
}
function eliminarTrabajador(t) {
  store.equipo_ventas = store.equipo_ventas.filter(x => x !== t);
  delete metasVendedores.value[t];
  guardarMetas();
}

// ==========================================
// COMPARATIVA MES A MES
// ==========================================
const ventasMesAnteriorTotal = computed(() => {
  const mAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const year = mAnt.getFullYear();
  const month = mAnt.getMonth();
  return store.todasFacturas.filter(f => {
    if (f.estado === 'anulada' || !f.fecha_raw) return false;
    const d = new Date(f.fecha_raw);
    return d.getFullYear() === year && d.getMonth() === month;
  }).reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
});
const maxComparativa = computed(() => Math.max(ventasMes.value, ventasMesAnteriorTotal.value) || 1);
const pctComparativa = (val, max) => (val / max) * 100;

// ==========================================
// TOP PRODUCTOS Y ULTIMAS VENTAS
// ==========================================
const topProductosRaw = computed(() => {
  const map = {};
  itemsVentasMes.value.forEach(it => {
    const cod = it.cod_alt || '-';
    if (!map[cod]) map[cod] = { cod: cod, desc: it.descripcion || it.desc || cod, cant: 0, total: 0 };
    map[cod].cant += parseFloat(it.cantidad) || 1;
    map[cod].total += parseFloat(it.total_linea) || 0;
  });
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
});
const topProductos = computed(() => topProductosRaw.value);
const topProductosMax = computed(() => topProductos.value[0]?.total || 1);

const ultimasVentas = computed(() => {
  return [...store.todasFacturas].filter(f => f.estado !== 'anulada').sort((a, b) => new Date(b.fecha_raw) - new Date(a.fecha_raw)).slice(0, 8);
});

// ==========================================
// OTROS COMPONENTES
// ==========================================
const facturasVD = computed(() => store.todasFacturas.filter(f => f.empresa === 'directa'));
const ventasVD = computed(() => facturasVD.value.reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0));
const cobrarVD = computed(() => store.facturasCobrar.filter(f => f.empresa === 'directa').reduce((acc, f) => acc + (parseFloat(f.saldo_pendiente) || 0), 0));
const totalStockVD = computed(() => store.productos.reduce((acc, p) => acc + (p.stock_vd || 0), 0));

const facturasDist = computed(() => store.todasFacturas.filter(f => f.empresa === 'distribuidora'));
const ventasDist = computed(() => facturasDist.value.reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0));
const cobrarDist = computed(() => store.facturasCobrar.filter(f => f.empresa === 'distribuidora').reduce((acc, f) => acc + (parseFloat(f.saldo_pendiente) || 0), 0));
const totalStockDist = computed(() => store.productos.reduce((acc, p) => acc + (p.stock_dist || 0), 0));

const rankingClientes = computed(() => {
  return store.clientes.map(c => {
    const facs = store.todasFacturas.filter(f => f.cliente_id === c.id || f.cliente === c.nombre);
    const total = facs.reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
    return { ...c, compras_count: facs.length, total_comprado: total };
  }).sort((a, b) => b.total_comprado - a.total_comprado);
});

function descargarBackupCompleto() {
  const data = {
    fecha: new Date().toISOString(),
    productos: store.productos,
    clientes: store.clientes,
    facturas: store.todasFacturas,
    presupuestos: store.presupuestos,
    movimientos: store.movimientos,
    turnos: store.turnos,
    bitacora: store.bitacora
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `backup_completo_arj_${new Date().toISOString().slice(0,10)}.json`);
  dlAnchor.click();
  store.notif('Respaldo completo descargado en JSON', 'success');
}
</script>
