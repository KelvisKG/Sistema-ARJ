<template>
  <div class="page active" id="page-dashboard">
    <h1 class="page-title"><i class="ti ti-chart-bar"></i> Reportes y Dashboard de Gerencia</h1>
    <p class="page-sub">Resumen del negocio · Comparativa entre empresas · Ranking de clientes · Reorden · Respaldos</p>

    <!-- SUB-NAVEGACIÓN DE REPORTES (MONOLITO) -->
    <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--border);overflow-x:auto;flex-wrap:wrap">
      <button
        :class="['search-tab', { active: subRep === 'resumen' }]"
        @click="subRep = 'resumen'"
      >
        <i class="ti ti-dashboard"></i> Resumen
      </button>
      <button
        :class="['search-tab', { active: subRep === 'comparativa' }]"
        @click="subRep = 'comparativa'"
      >
        <i class="ti ti-arrows-left-right"></i> Comparar empresas
      </button>
      <button
        :class="['search-tab', { active: subRep === 'ranking' }]"
        @click="subRep = 'ranking'"
      >
        <i class="ti ti-trophy"></i> Ranking clientes
      </button>
      <button
        :class="['search-tab', { active: subRep === 'reorden' }]"
        @click="subRep = 'reorden'"
      >
        <i class="ti ti-package"></i> Qué reordenar
      </button>
      <button
        :class="['search-tab', { active: subRep === 'backup' }]"
        @click="subRep = 'backup'"
      >
        <i class="ti ti-database"></i> Respaldos
      </button>
    </div>

    <!-- 1. SUB-SECCIÓN: RESUMEN -->
    <div v-if="subRep === 'resumen'">
      <div class="kpi-grid">
        <div class="kpi-card green">
          <div class="kpi-icon"><i class="ti ti-trending-up"></i></div>
          <div class="kpi-label">Ventas hoy</div>
          <div class="kpi-val">{{ fmtUSD(ventasHoy) }}</div>
          <div class="kpi-sub">Total facturado en el día</div>
        </div>

        <div class="kpi-card blue">
          <div class="kpi-icon"><i class="ti ti-calendar"></i></div>
          <div class="kpi-label">Ventas este mes</div>
          <div class="kpi-val">{{ fmtUSD(ventasTotales) }}</div>
          <div class="kpi-sub">{{ store.todasFacturas.length }} facturas emitidas</div>
        </div>

        <div class="kpi-card gold">
          <div class="kpi-icon"><i class="ti ti-percentage"></i></div>
          <div class="kpi-label">Margen del catálogo</div>
          <div class="kpi-val">~44%</div>
          <div class="kpi-sub">Cálculo sobre costo landed</div>
        </div>

        <div class="kpi-card red">
          <div class="kpi-icon"><i class="ti ti-package"></i></div>
          <div class="kpi-label">Stock crítico</div>
          <div class="kpi-val" style="color:var(--red)">{{ itemsCriticos.length }}</div>
          <div class="kpi-sub">≤ 5 unidades en almacén</div>
        </div>

        <div class="kpi-card green">
          <div class="kpi-icon"><i class="ti ti-coin"></i></div>
          <div class="kpi-label">Utilidad bruta estimada</div>
          <div class="kpi-val">{{ fmtUSD(ventasTotales * 0.42) }}</div>
          <div class="kpi-sub">Margen comercial bruto</div>
        </div>

        <div class="kpi-card blue">
          <div class="kpi-icon"><i class="ti ti-cash"></i></div>
          <div class="kpi-label">Cartera por cobrar</div>
          <div class="kpi-val">{{ fmtUSD(carteraTotal) }}</div>
          <div class="kpi-sub">{{ store.facturasCobrar.length }} deudas pendientes</div>
        </div>
      </div>
    </div>

    <!-- 2. SUB-SECCIÓN: COMPARATIVA DE EMPRESAS -->
    <div v-if="subRep === 'comparativa'">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <!-- VENTA DIRECTA -->
        <div class="card" style="border-top:3px solid var(--blue)">
          <div class="card-tit" style="color:var(--blue)">
            <i class="ti ti-building-store"></i> ARJ Venta Directa (Mostrador)
          </div>
          <div style="margin-top:8px">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEE">
              <span>Facturas emitidas:</span>
              <strong>{{ facturasVD.length }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEE">
              <span>Total facturado:</span>
              <strong style="color:var(--green)">{{ fmtUSD(ventasVD) }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEE">
              <span>Saldo pendiente por cobrar:</span>
              <strong style="color:var(--red)">{{ fmtUSD(cobrarVD) }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0">
              <span>Items en stock:</span>
              <strong>{{ totalStockVD }} unidades</strong>
            </div>
          </div>
        </div>

        <!-- DISTRIBUIDORA -->
        <div class="card" style="border-top:3px solid var(--gold)">
          <div class="card-tit" style="color:var(--gold)">
            <i class="ti ti-truck-delivery"></i> Distribuidora ARJ C.A. (Mayorista)
          </div>
          <div style="margin-top:8px">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEE">
              <span>Facturas emitidas:</span>
              <strong>{{ facturasDist.length }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEE">
              <span>Total facturado:</span>
              <strong style="color:var(--green)">{{ fmtUSD(ventasDist) }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #EEE">
              <span>Saldo pendiente por cobrar:</span>
              <strong style="color:var(--red)">{{ fmtUSD(cobrarDist) }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0">
              <span>Items en stock:</span>
              <strong>{{ totalStockDist }} unidades</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. SUB-SECCIÓN: RANKING DE CLIENTES -->
    <div v-if="subRep === 'ranking'" class="card">
      <div class="card-tit"><i class="ti ti-trophy"></i> Clientes Principales por Volumen de Facturación</div>
      <table class="tbl" style="margin-top:10px">
        <thead>
          <tr>
            <th class="center" style="width:5%">#</th>
            <th>Cliente</th>
            <th>RIF</th>
            <th>Nivel</th>
            <th class="num">Facturas</th>
            <th class="num">Total Comprado USD</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(c, idx) in rankingClientes" :key="c.id">
            <td class="center"><strong>{{ idx + 1 }}</strong></td>
            <td><strong>{{ c.nombre }}</strong></td>
            <td style="font-family:monospace">{{ c.rif || '—' }}</td>
            <td><span class="badge badge-info">{{ c.nivel }}</span></td>
            <td class="num">{{ c.compras_count }}</td>
            <td class="num" style="font-weight:700;color:var(--green)">{{ fmtUSD(c.total_comprado) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 4. SUB-SECCIÓN: QUÉ REORDENAR -->
    <div v-if="subRep === 'reorden'" class="card">
      <div class="card-tit"><i class="ti ti-package"></i> Repuestos con Stock Crítico (Sugerencia de Reorden)</div>
      <table class="tbl" style="margin-top:10px">
        <thead>
          <tr>
            <th>Código</th>
            <th>Descripción</th>
            <th>Marca</th>
            <th class="center">Stock Venta Directa</th>
            <th class="center">Stock Distribuidora</th>
            <th class="center">Total Existencia</th>
            <th class="center">Sugerencia Reorden</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in itemsCriticos" :key="p.id">
            <td><strong>{{ p.cod_alt }}</strong></td>
            <td>{{ p.desc }}</td>
            <td>{{ p.marca }}</td>
            <td class="center"><span :class="['badge', p.stock_vd <= 3 ? 'badge-danger' : 'badge-warning']">{{ p.stock_vd }}</span></td>
            <td class="center"><span :class="['badge', p.stock_dist <= 3 ? 'badge-danger' : 'badge-warning']">{{ p.stock_dist }}</span></td>
            <td class="center"><strong>{{ p.stock_vd + p.stock_dist }}</strong></td>
            <td class="center"><span class="badge badge-danger">Comprar +15 un.</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 5. SUB-SECCIÓN: RESPALDOS -->
    <div v-if="subRep === 'backup'" class="card" style="max-width:600px">
      <div class="card-tit"><i class="ti ti-database"></i> Copias de Seguridad del Sistema</div>
      <p style="font-size:12px;color:var(--dgray);margin:10px 0">
        Descarga una copia completa e independiente de los productos, clientes, facturas, cuentas por cobrar y bitácora en formato JSON.
      </p>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn btn-primary" @click="descargarBackupCompleto">
          <i class="ti ti-download"></i> Descargar Copia JSON
        </button>
        <button class="btn btn-secondary" @click="store.initApp">
          <i class="ti ti-refresh"></i> Sincronizar con Supabase
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD } from '../services/pricing.js';

const store = useArjStore();
const subRep = ref('resumen');

const ventasTotales = computed(() => {
  return store.todasFacturas.reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
});

const ventasHoy = computed(() => {
  return store.todasFacturas.slice(0, 3).reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
});

const carteraTotal = computed(() => {
  return store.facturasCobrar.reduce((acc, f) => acc + (parseFloat(f.saldo_pendiente) || 0), 0);
});

const itemsCriticos = computed(() => {
  return store.productos.filter(p => (p.stock_vd <= 5 || p.stock_dist <= 5));
});

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
    return {
      ...c,
      compras_count: facs.length,
      total_comprado: total
    };
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
