<template>
  <div class="page active" id="page-dashboard">
    <div class="dash-header-section">
      <div class="dash-header-title">
        <h1 class="page-title"><i class="ti ti-chart-bar"></i> Reportes y Dashboard</h1>
        <p class="page-sub">Resumen del día · Comparativa entre empresas · Ranking · Reorden · Backup</p>
      </div>
      <div class="dash-header-actions no-print">
        <button class="btn btn-secondary btn-sm" title="Imprimir reporte o exportar PDF" @click="imprimirReporte">
          <i class="ti ti-printer"></i> Imprimir Reporte
        </button>
      </div>
    </div>

    <!-- Sub-navegación de reportes en píldoras modernas -->
    <div class="report-nav-bar no-print">
      <button :class="['search-tab nav-pill', { active: sub === 'resumen' }]" @click="sub = 'resumen'"><i class="ti ti-dashboard"></i> Resumen</button>
      <button :class="['search-tab nav-pill', { active: sub === 'comparativa' }]" @click="sub = 'comparativa'"><i class="ti ti-arrows-left-right"></i> Comparar empresas</button>
      <button :class="['search-tab nav-pill', { active: sub === 'ranking' }]" @click="sub = 'ranking'"><i class="ti ti-trophy"></i> Ranking clientes</button>
      <button :class="['search-tab nav-pill', { active: sub === 'reorden' }]" @click="sub = 'reorden'">
        <i class="ti ti-package"></i> Qué reordenar
        <span v-if="stockCritico.agotados > 0" class="tab-count-badge">{{ stockCritico.agotados }}</span>
      </button>
      <button :class="['search-tab nav-pill', { active: sub === 'backup' }]" @click="sub = 'backup'"><i class="ti ti-database"></i> Respaldos</button>
    </div>

    <!-- ═══ RESUMEN ═══ -->
    <div v-show="sub === 'resumen'">
      <!-- SELECTOR DE PERÍODO GLOBAL -->
      <PeriodFilter
        v-model:rango="rango"
        v-model:custDesde="custDesde"
        v-model:custHasta="custHasta"
        :etiqueta="origen.etiqueta"
        :cargando="origen.estado === 'cargando'"
        @cambio="cambioRango"
        @aplicar="cargarOrigen"
      />

      <!-- ══ ALERTA STOCK CRÍTICO (Si hay agotados) ══ -->
      <div v-if="stockCritico.agotados > 0" class="stock-alert-banner no-print">
        <div class="stock-alert-left">
          <i class="ti ti-alert-triangle"></i>
          <div>
            <strong>{{ stockCritico.agotados }} producto{{ stockCritico.agotados !== 1 ? 's' : '' }} agotado{{ stockCritico.agotados !== 1 ? 's' : '' }}</strong>
            <span class="stock-alert-msg">— Umbral crítico activo (≤ {{ stockCritico.umbral }} uds). Revisa inventario.</span>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" @click="sub = 'reorden'"><i class="ti ti-package"></i> Ver reorden</button>
      </div>

      <!-- ══ HERO SECTION ══ -->
      <div class="hero-row">
        <!-- Columna izquierda: Revenue Hero Card -->
        <div class="hero-revenue-card">
          <div class="hero-top-row">
            <div class="hero-label"><i class="ti ti-report-money" style="margin-right:5px;color:var(--blue);"></i>Ingresos del período</div>
            <span class="hero-company-pill">{{ nombreEmp }}</span>
          </div>
          <div class="hero-amount">
            <span class="hero-currency">$</span>{{ (kpisPeriodo.totalVenta || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </div>
          <div>
            <span
              class="hero-var-pill"
              :class="compMeses.varPct > 0 ? 'up' : compMeses.varPct < 0 ? 'down' : 'neutral'"
            >
              <i :class="compMeses.varPct > 0 ? 'ti ti-trending-up' : compMeses.varPct < 0 ? 'ti ti-trending-down' : 'ti ti-minus'"></i>
              {{ compMeses.varPct > 0 ? '+' : '' }}{{ (compMeses.varPct || 0).toFixed(1) }}% vs mes anterior
            </span>
          </div>
          <div class="hero-meta">
            <div class="hero-meta-item">
              <span class="hero-meta-label">Facturas</span>
              <span class="hero-meta-val">{{ kpisPeriodo.nFacts || 0 }}</span>
            </div>
            <div class="hero-meta-item" title="Promedio facturado por cliente/venta">
              <span class="hero-meta-label">Ticket promedio</span>
              <span class="hero-meta-val font-blue">{{ fmtUSD(ticketPromedio) }}</span>
            </div>
            <div class="hero-meta-item" title="Estimación de facturación al cierre del mes al ritmo actual">
              <span class="hero-meta-label">Proyección mes</span>
              <span class="hero-meta-val font-green">{{ fmtUSD(proyeccionMes) }}</span>
            </div>
            <div class="hero-meta-item">
              <span class="hero-meta-label">Mes anterior</span>
              <span class="hero-meta-val">${{ (compMeses.ant || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>
            <div class="hero-meta-item">
              <span class="hero-meta-label">Hoy</span>
              <span class="hero-meta-val">${{ (ventas.totHoy || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>
          </div>

          <!-- ══ INDICADOR DE LIQUIDEZ (Caja vs Cuentas por Cobrar) ══ -->
          <div v-if="!liquidezMes.sinDatos" class="liquidity-bar-wrap">
            <div class="liquidity-header">
              <span class="liquidity-label"><i class="ti ti-droplet"></i> Liquidez del mes</span>
              <div class="liquidity-legend">
                <span class="liq-dot dot-green"></span>
                <span class="liq-legend-text">Cobrado {{ liquidezMes.pctCobrado.toFixed(0) }}%</span>
                <span class="liq-dot dot-gold" style="margin-left:10px"></span>
                <span class="liq-legend-text">Pendiente {{ liquidezMes.pctPendiente.toFixed(0) }}%</span>
              </div>
            </div>
            <div class="liquidity-track">
              <div
                class="liquidity-fill liq-cobrado"
                :style="{ width: Math.min(liquidezMes.pctCobrado, 100) + '%' }"
                :title="'Cobrado en caja/banco: ' + fmtUSD(liquidezMes.cobrado)"
              ></div>
              <div
                class="liquidity-fill liq-pendiente"
                :style="{ width: Math.min(liquidezMes.pctPendiente, 100) + '%' }"
                :title="'Cuentas por cobrar pendientes: ' + fmtUSD(liquidezMes.pendiente)"
              ></div>
            </div>
            <div class="liquidity-amounts">
              <span class="liq-amount-cobrado">
                <i class="ti ti-cash"></i> {{ fmtUSD(liquidezMes.cobrado) }} en caja
              </span>
              <span class="liq-amount-pendiente">
                <i class="ti ti-clock"></i> {{ fmtUSD(liquidezMes.pendiente) }} por cobrar
              </span>
            </div>
          </div>

          <!-- Barra de meta dentro del Hero (si hay meta) -->
          <div v-if="metaEmpresa > 0" class="hero-goal-bar-wrap">
            <div class="hero-goal-bar-header">
              <span class="hero-goal-label"><i class="ti ti-target" style="color:var(--green);"></i> Meta {{ nombreEmp }} ({{ metasPer }})</span>
              <span class="hero-goal-pct">{{ pctEmp.toFixed(1) }}%</span>
            </div>
            <div class="hero-goal-track">
              <div class="hero-goal-fill" :style="{ width: Math.min(pctEmp, 100) + '%' }"></div>
            </div>
            <div class="hero-goal-sub">
              <span>Vendido: <strong>{{ fmtUSD(ventasEmpresa) }}</strong></span>
              <span>Meta: <strong>{{ fmtUSD(metaEmpresa) }}</strong></span>
              <span v-if="faltaEmp > 0" class="text-gold">Faltan {{ fmtUSD(faltaEmp) }}</span>
              <span v-else class="text-green">¡Meta superada!</span>
            </div>
          </div>
        </div>

        <!-- Columna derecha: Top clientes + últimas ventas -->
        <div class="hero-side-panel">
          <!-- Top clientes del mes -->
          <div class="side-panel-card">
            <div class="side-panel-title">
              <i class="ti ti-crown"></i>
              Top clientes del mes
            </div>
            <div v-if="!ranking.top.length" class="empty-state-card" style="padding:12px;font-size:12px;">
              Sin ventas en el período
            </div>
            <div v-else>
              <div
                v-for="(c, idx) in ranking.top.slice(0, 3)"
                :key="c.nombre"
                class="hero-client-row clickable-row"
                title="Clic para ver módulo de clientes"
                @click="irAClientes"
              >
                <div class="client-avatar">{{ c.nombre.charAt(0).toUpperCase() }}</div>
                <div class="client-info">
                  <div class="client-nm">{{ c.nombre }}</div>
                  <div class="client-purchases">{{ c.comprasMes }} compra{{ c.comprasMes !== 1 ? 's' : '' }} este mes</div>
                </div>
                <div class="client-monto">${{ (c.mes || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
              </div>
            </div>
          </div>

          <!-- Últimas ventas -->
          <div class="side-panel-card">
            <div class="side-panel-title">
              <i class="ti ti-receipt"></i>
              Últimas ventas
            </div>
            <div v-if="!ventasRecientes.length" class="empty-state-card" style="padding:12px;font-size:12px;">
              Sin ventas recientes
            </div>
            <div v-else>
              <div
                v-for="v in ventasRecientes.slice(0, 3)"
                :key="v.id"
                class="mini-sale-row clickable-row"
                title="Clic para ver detalle de la factura"
                @click="verFactura(v)"
              >
                <div class="mini-sale-client">{{ v.cliente_nombre_snap || v.cliente }}</div>
                <div class="mini-sale-val">
                  {{ fmtUSD(v.total) }}
                  <i class="ti ti-chevron-right chevron-mini"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ KPI STRIP ══ -->
      <div class="kpi-strip">
        <!-- 1. Margen catálogo -->
        <div class="kpi-strip-card" title="Margen teórico promedio de todo el catálogo a precio de lista vs costo landed">
          <div class="kpi-strip-label"><i class="ti ti-percentage"></i> Margen Catálogo</div>
          <div class="kpi-strip-val">
            <span v-if="margenCatalogo != null">{{ margenCatalogo.toFixed(1) }}%</span>
            <span v-else style="font-size:14px;color:var(--text-muted);">—</span>
          </div>
          <div class="kpi-strip-sub">Teórico</div>
        </div>
        <!-- 2. Utilidad bruta -->
        <div class="kpi-strip-card" title="Utilidad bruta = Ventas del período − Costo landed congelado">
          <div class="kpi-strip-label"><i class="ti ti-coin"></i> Utilidad Bruta</div>
          <div class="kpi-strip-val" style="color:var(--green)">{{ kpisPeriodo.utilVal }}</div>
          <div class="kpi-strip-sub" :title="kpisPeriodo.utilSub">{{ kpisPeriodo.utilSub }}</div>
        </div>
        <!-- 3. Margen real -->
        <div class="kpi-strip-card" title="Margen efectivo sobre los productos realmente facturados">
          <div class="kpi-strip-label"><i class="ti ti-chart-pie"></i> Margen Real</div>
          <div class="kpi-strip-val" style="color:var(--gold)">{{ kpisPeriodo.margenVal }}</div>
          <div class="kpi-strip-sub" :title="kpisPeriodo.margenSub">{{ kpisPeriodo.margenSub }}</div>
        </div>
        <!-- 4. Punto de equilibrio -->
        <div class="kpi-strip-card" title="Monto de ventas necesario para cubrir los costos fijos al margen actual">
          <div class="kpi-strip-label"><i class="ti ti-scale"></i> Punto Equilibrio</div>
          <div class="kpi-strip-val">{{ kpisPeriodo.peVal }}</div>
          <div class="kpi-strip-sub" :title="kpisPeriodo.peSub">{{ kpisPeriodo.peSub }}</div>
        </div>
        <!-- 5. Costos fijos -->
        <div class="kpi-strip-card" title="Costos fijos configurados para el período">
          <div class="kpi-strip-label"><i class="ti ti-building-store"></i> Costos Fijos</div>
          <div class="kpi-strip-val">{{ fmtUSD(kpisPeriodo.cf || 0) }}</div>
          <div class="kpi-strip-sub" :title="kpisPeriodo.cfSub">{{ kpisPeriodo.cfSub }}</div>
        </div>
        <!-- 6. Stock crítico -->
        <div class="kpi-strip-card" title="Productos con stock igual o inferior al umbral mínimo">
          <div class="kpi-strip-label"><i class="ti ti-package"></i> Stock Crítico</div>
          <div class="kpi-strip-val" :style="{ color: stockCritico.agotados > 0 ? 'var(--red)' : 'var(--text)' }">
            {{ stockCritico.bajos || 0 }} <span style="font-size:12px;color:var(--text-muted);font-weight:600">bajos</span>
          </div>
          <div class="kpi-strip-sub">
            <span
              v-if="stockCritico.agotados > 0"
              class="kpi-strip-pill pill-red"
            >{{ stockCritico.agotados }} agotado{{ stockCritico.agotados !== 1 ? 's' : '' }}</span>
            <span v-else>Sin agotados</span>
          </div>
        </div>
      </div>

      <!-- ══ CUADRO ESTADÍSTICO: DINÁMICA DIARIA DE FACTURACIÓN ══ -->
      <SalesDynamicChart
        :facturas="validas.filter(f => f.empresa === store.empresa)"
        :etiqueta="origen.etiqueta"
      />

      <!-- ══ FILA DE ANÁLISIS (2 columnas) ══ -->
      <div class="analysis-row">
        <!-- Izquierda: Importado vs Local + Comparativa meses -->
        <div>
          <ComparisonCards
            :origen="origen"
            :r="R"
            :bloques-origen="bloquesOrigen"
            :tablas-detalle="tablasDetalle"
            :detalle-abierto="detalleAbierto"
            :comp-meses="compMeses"
            @toggle-detalle="detalleAbierto = !detalleAbierto"
            @descargar-csv="descargarDetalleOrigen"
          />
        </div>

        <!-- Derecha: Productos más vendidos -->
        <div class="top-prod-panel">
          <div class="dash-card-header">
            <div class="dash-title-wrap">
              <span class="dash-icon-badge blue"><i class="ti ti-chart-bar"></i></span>
              <div>
                <h3 class="dash-card-title">Productos más vendidos</h3>
                <span class="dash-card-subtitle">Ranking por {{ criterioTop === 'total' ? 'monto en USD' : 'unidades vendidas' }}</span>
              </div>
            </div>
            <div class="top-prod-toggle">
              <button
                :class="['toggle-pill', { active: criterioTop === 'total' }]"
                @click="criterioTop = 'total'"
              >
                Por $
              </button>
              <button
                :class="['toggle-pill', { active: criterioTop === 'cant' }]"
                @click="criterioTop = 'cant'"
              >
                Por Uds
              </button>
            </div>
          </div>

          <div v-if="!topOrdenado.length" class="empty-state-card">
            <i class="ti ti-chart-pie-off" style="font-size:24px;opacity:0.5;margin-bottom:6px"></i>
            <div>Sin ventas registradas en este período</div>
          </div>
          <div v-else class="top-prods-list">
            <div v-for="(p, idx) in topOrdenado.slice(0, 8)" :key="p.cod" class="top-prod-row">
              <div class="top-prod-header">
                <div class="top-prod-info">
                  <span class="top-prod-rank">#{{ idx + 1 }}</span>
                  <span class="top-prod-name" :title="p.desc || p.cod">{{ p.desc || p.cod }}</span>
                </div>
                <div class="top-prod-numbers">
                  <span class="top-prod-units" :class="{ 'units-highlight': criterioTop === 'cant' }">{{ p.cant }} ud</span>
                  <span class="top-prod-total" :class="{ 'total-highlight': criterioTop === 'total' }">{{ fmtUSD(p.total) }}</span>
                </div>
              </div>
              <div class="top-prod-bar-track">
                <div
                  class="top-prod-bar-fill"
                  :style="{
                    width: criterioTop === 'total'
                      ? (p.total / (topOrdenado[0].total || 1)) * 100 + '%'
                      : (p.cant / (topOrdenado[0].cant || 1)) * 100 + '%'
                  }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ FILA INFERIOR: Metas de ventas ══ -->
      <SalesGoalsCard
        v-model:metas-per="metasPer"
        :nombre-emp="nombreEmp"
        :opciones-periodo="opcionesPeriodo"
        :es-mes-cerrado="esMesCerrado"
        :meta-empresa="metaEmpresa"
        :pct-emp="pctEmp"
        :ventas-empresa="ventasEmpresa"
        :falta-emp="faltaEmp"
        :base-sug="baseSug"
        :lista-trab="listaTrab"
        :filas-trab="filasTrab"
        :aviso-suma="avisoSuma"
        @abrir-equipo="abrirEquipo"
        @actualizar-meta-empresa="actualizarMetaEmpresa"
        @actualizar-meta-vendedor="actualizarMetaVendedor"
        @sugerir-meta="sugerirMeta"
      />
    </div>

    <!-- ═══ COMPARATIVA ENTRE EMPRESAS (Activada con datos reales) ═══ -->
    <div v-if="sub === 'comparativa'">
      <CompanyComparison
        :todas-facturas="store.todasFacturas"
        :etiqueta-periodo="origen.etiqueta"
      />
    </div>

    <!-- ═══ RANKING DE CLIENTES ═══ -->
    <div v-if="sub === 'ranking'">
      <CustomerRankingCard
        :ranking="ranking"
        :nombre-emp="nombreEmp"
        :todas-facturas="store.todasFacturas"
        :clientes="store.clientes"
      />
    </div>

    <!-- ═══ REORDEN (Activado con asistente de compras) ═══ -->
    <div v-if="sub === 'reorden'">
      <ReorderReport
        :productos="store.productos"
        :empresa="store.empresa"
        :ventas-items="itsMes || []"
      />
    </div>

    <!-- ═══ RESPALDOS ═══ -->
    <div v-if="sub === 'backup'">
      <BackupCard
        :productos-count="store.productos.length"
        :clientes-count="store.clientes.length"
        :facturas-count="store.todasFacturas.length"
        :facts-semana-count="factsSemana.length"
        @backup-semanal="backupSemanal"
        @backup-completo="backupCompleto"
        @backup-inventario="backupInventario"
      />
    </div>

    <!-- MODAL EQUIPO DE TRABAJO (v13.2) -->
    <div v-if="equipoAbierto" class="modal show" id="modal-equipo">
      <div class="modal-content" style="max-width:480px;text-align:left">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:12px">
          <h3 style="margin:0;font-size:17px;color:var(--navy);font-weight:700"><i class="ti ti-users"></i> Equipo de trabajo</h3>
          <button class="btn btn-secondary btn-sm" @click="equipoAbierto = false"><i class="ti ti-x"></i></button>
        </div>
        <div class="help-box" style="margin-bottom:14px;font-size:12px">
          <i class="ti ti-info-circle"></i>
          <div>Esta lista es solo para <strong>ponerles metas</strong>. No crea usuarios que puedan entrar al sistema — eso se hace en Supabase.</div>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:14px">
          <div style="flex:1">
            <label style="font-size:11px;color:var(--dgray);font-weight:500;display:block;margin-bottom:4px">Nombre</label>
            <input v-model="eqNombre" type="text" class="val-input" placeholder="Ej: PEDRO PEREZ" style="width:100%;text-transform:uppercase" @keydown.enter.prevent="agregarAlEquipo">
          </div>
          <div style="width:140px">
            <label style="font-size:11px;color:var(--dgray);font-weight:500;display:block;margin-bottom:4px">Empresa</label>
            <select v-model="eqEmpresa" class="val-input" style="width:100%">
              <option value="directa">Venta Directa</option>
              <option value="dist">Distribuidora</option>
              <option value="ambas">Ambas</option>
            </select>
          </div>
          <button class="btn btn-primary" @click="agregarAlEquipo"><i class="ti ti-plus"></i></button>
        </div>
        <div style="border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;max-height:260px;overflow-y:auto">
          <div v-if="!equipo.length" style="padding:16px;text-align:center;color:var(--dgray);font-size:12px">Todavía no hay nadie en el equipo</div>
          <div v-for="(t, i) in equipo" :key="t.nombre" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--border);gap:8px">
            <div style="min-width:0">
              <div style="font-weight:600;font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ t.nombre }}</div>
              <div style="font-size:11px;color:var(--dgray)">{{ { ambas: 'Ambas', directa: 'Venta Directa', dist: 'Distribuidora' }[t.empresa] || t.empresa }}</div>
            </div>
            <button class="btn btn-red btn-sm" title="Quitar del equipo" @click="quitarDelEquipo(i)"><i class="ti ti-trash"></i></button>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;border-top:1px solid var(--border);padding-top:12px">
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
  normalizarEquipo, claveEmpresa
} from '../services/reportes.js';

import PeriodFilter from '../components/reports/PeriodFilter.vue';
import KpiGrid from '../components/reports/KpiGrid.vue';
import ComparisonCards from '../components/reports/ComparisonCards.vue';
import SalesGoalsCard from '../components/reports/SalesGoalsCard.vue';
import CustomerRankingCard from '../components/reports/CustomerRankingCard.vue';
import BackupCard from '../components/reports/BackupCard.vue';
import ReorderReport from '../components/reports/ReorderReport.vue';
import CompanyComparison from '../components/reports/CompanyComparison.vue';
import SalesDynamicChart from '../components/reports/SalesDynamicChart.vue';

const store = useArjStore();
const sub = ref('resumen');
const nombreEmp = computed(() => (store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora'));

// Criterio para ordenar productos más vendidos: por total $ o por cantidad de unidades
const criterioTop = ref('total');

// Proyección de facturación al cierre de mes (Run-Rate)
const proyeccionMes = computed(() => {
  const hoy = new Date();
  const dia = hoy.getDate();
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  if (dia === 0) return 0;
  const vend = ventasEmpresa.value || 0;
  return (vend / dia) * diasMes;
});

// Ticket promedio por venta
const ticketPromedio = computed(() => {
  const total = kpisPeriodo.value.totalVenta || 0;
  const n = kpisPeriodo.value.nFacts || 0;
  return n > 0 ? total / n : 0;
});

// ═══ LIQUIDEZ DEL MES: Cobrado en caja vs Pendiente en CxC ═══
// Calcula directamente desde las facturas en memoria del mes activo.
// No genera ninguna consulta adicional a Supabase.
const liquidezMes = computed(() => {
  const { mes0 } = cortes();
  let totalFacturado = 0;
  let totalPendiente = 0;
  validas.value
    .filter(f => f.empresa === store.empresa && new Date(f.fecha_raw) >= mes0)
    .forEach(f => {
      const t = f.total || 0;
      const p = f.saldo_pendiente || 0;
      totalFacturado += t;
      totalPendiente += p;
    });
  const cobrado = Math.max(0, totalFacturado - totalPendiente);
  const pctCobrado = totalFacturado > 0 ? (cobrado / totalFacturado) * 100 : 0;
  const pctPendiente = totalFacturado > 0 ? (totalPendiente / totalFacturado) * 100 : 0;
  return {
    totalFacturado,
    cobrado,
    pendiente: totalPendiente,
    pctCobrado,
    pctPendiente,
    sinDatos: totalFacturado === 0
  };
});

function verFactura(f) {
  store.facturaReciente = f;
  store.modalFacturaActivo = true;
}

function irAClientes() {
  store.cambiarVista('clientes');
}

function imprimirReporte() {
  window.print();
}

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
// Mejora v14.1: si el rango activo es "mes", reutiliza los items ya descargados
// por cargarOrigen() en lugar de hacer una segunda consulta redundante a Supabase.
const itsMes = ref(null);   // null = sin conexión / error · [] = sin ventas
const errorIts = ref('');
async function cargarUtilidad() {
  errorIts.value = '';
  if (!store.supabaseConectado) { itsMes.value = null; return; }
  // Caché unificada: si el rango de análisis ya cargó los items del mes actual,
  // se reutilizan directamente sin una segunda llamada a Supabase.
  if (rango.value === 'mes' && origen.value.estado === 'listo' && origen.value.data?.its) {
    itsMes.value = origen.value.data.its;
    return;
  }
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
    // Caché unificada v14.1: si el rango es "mes", reutilizar items descargados
    // en itsMes para que cargarUtilidad() no duplique la consulta.
    if (rango.value === 'mes' && store.empresa === empresaConsultada) {
      itsMes.value = d.its || [];
    }
  } catch (e) {
    origen.value = { estado: 'error', lbl: r.etiqueta, etiqueta: r.etiqueta, data: null, error: e.message || String(e) };
  }
}

const R = computed(() => (origen.value.data ? resumenOrigen(origen.value.data.its, origen.value.data.fmap, store.productos) : null));

const mesesEnRango = computed(() => {
  if (rango.value === 'mes' || rango.value === 'mes_ant') return 1;
  if (rango.value === '3m') return 3;
  if (rango.value === '6m') return 6;
  if (rango.value === '12m' || rango.value === 'anio') return 12;
  if (rango.value === 'custom' && custDesde.value && custHasta.value) {
    const d1 = new Date(custDesde.value);
    const d2 = new Date(custHasta.value);
    const m = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1;
    return Math.max(1, m);
  }
  return 1;
});

const kpisPeriodo = computed(() => {
  const cfMensual = fijos.value.cf;
  const meses = mesesEnRango.value;
  const cf = cfMensual * meses;
  const cfSub = meses === 1 ? fijos.value.sub : `${fmtUSD(cfMensual)}/mes × ${meses} meses`;

  if (origen.value.data && R.value) {
    const totalVenta = R.value.tot.venta;
    const totalCosto = R.value.tot.costo;
    const totalUtil = R.value.tot.util;
    const nFacts = origen.value.data.nFacts || 0;
    const margen = totalVenta > 0 ? (totalUtil / totalVenta) * 100 : 0;
    const sinCosto = R.value.sinCosto || 0;

    const res = {
      totalVenta,
      nFacts,
      cf,
      cfSub,
      utilVal: fmtUSD(totalUtil),
      utilSub: totalVenta > 0 ? `Ventas ${fmtUSD(totalVenta)} − costo ${fmtUSD(totalCosto)}` : `Sin ventas en ${origen.value.etiqueta}`,
      margenVal: margen.toFixed(1) + '%',
      margenSub: sinCosto > 0 ? `Ojo: ${sinCosto} renglón(es) sin costo — margen inflado` : 'Sobre lo efectivamente vendido',
      peVal: fmtUSD(0),
      peSub: 'Configura los costos fijos'
    };

    if (cf <= 0) {
      res.peVal = fmtUSD(0);
      res.peSub = 'Configura los costos fijos';
    } else if (margen <= 0) {
      res.peVal = '—';
      res.peSub = 'Margen en cero o negativo';
    } else {
      const pe = cf / (margen / 100);
      const falta = pe - totalVenta;
      res.peVal = fmtUSD(pe);
      res.peSub = falta > 0 ? `Faltan ${fmtUSD(falta)} para cubrir los fijos` : `Superado por ${fmtUSD(Math.abs(falta))}`;
    }
    return res;
  }

  const ingreso = rango.value === 'mes' ? ventas.value.totMes : 0;
  return {
    totalVenta: ingreso,
    nFacts: rango.value === 'mes' ? ventas.value.nMes : 0,
    cf,
    cfSub,
    utilVal: util.value.val,
    utilSub: util.value.sub,
    margenVal: util.value.margenVal,
    margenSub: util.value.margenSub,
    peVal: util.value.peVal,
    peSub: util.value.peSub
  };
});

const top = computed(() => {
  if (origen.value.data && origen.value.data.its && origen.value.data.its.length) {
    return topProductos(origen.value.data.its);
  }
  return (itsMes.value && itsMes.value.length ? topProductos(itsMes.value) : []);
});

const topOrdenado = computed(() => {
  const list = [...top.value];
  if (criterioTop.value === 'cant') {
    return list.sort((a, b) => (b.cant || 0) - (a.cant || 0));
  }
  return list.sort((a, b) => (b.total || 0) - (a.total || 0));
});
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
watch(() => store.todasFacturas.length, () => cargarUtilidad());
</script>

<style scoped>
/* Encabezado y sub-navegación */
.dash-header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.page-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
  color: var(--navy);
  font-weight: 800;
}
.page-title i {
  color: var(--blue);
}
.page-sub {
  color: var(--dgray);
  font-size: 13px;
}

.tab-count-badge {
  background: var(--red);
  color: #FFF;
  font-size: 10px;
  font-weight: 800;
  border-radius: var(--radius-full);
  padding: 1px 6px;
  margin-left: 4px;
}

/* Sub-navegación unificada con el sistema */
.report-nav-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  overflow-x: auto;
  flex-wrap: wrap;
  padding-bottom: 4px;
}

.nav-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 8px 16px;
  color: var(--dgray);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--trans-fast);
  box-shadow: var(--shadow-xs);
}

.nav-pill:hover {
  color: var(--text);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.nav-pill.active {
  background: var(--lblue);
  color: var(--blue);
  border-color: var(--blue);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

/* Alerta stock crítico banner */
.stock-alert-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: var(--lred);
  border: 1px solid var(--red);
  border-left: 4px solid var(--red);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  margin-bottom: 16px;
  color: var(--red);
  font-size: 13px;
}
.stock-alert-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stock-alert-left i {
  font-size: 20px;
  flex-shrink: 0;
}
.stock-alert-msg {
  color: var(--text-muted);
  font-size: 12px;
  margin-left: 6px;
}

/* ══ HERO SECTION ══ */
.hero-row {
  display: grid;
  grid-template-columns: 1.65fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 960px) {
  .hero-row { grid-template-columns: 1fr; }
}

.hero-revenue-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px 28px;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.hero-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.hero-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--dgray);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
}

.hero-company-pill {
  background: var(--lblue);
  color: var(--blue);
  border: 1px solid rgba(37, 99, 235, 0.2);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 700;
}

.hero-amount {
  font-size: 46px;
  font-weight: 800;
  color: var(--text);
  line-height: 1.1;
  letter-spacing: -0.03em;
  margin-bottom: 8px;
}

.hero-amount .hero-currency {
  font-size: 28px;
  font-weight: 600;
  color: var(--dgray);
  margin-right: 2px;
}

.hero-var-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 12px;
}
.hero-var-pill.up { background: var(--lgreen); color: var(--green); border: 1px solid rgba(16, 185, 129, 0.3); }
.hero-var-pill.down { background: var(--lred); color: var(--red); border: 1px solid rgba(239, 68, 68, 0.3); }
.hero-var-pill.neutral { background: var(--gray); color: var(--dgray); border: 1px solid var(--border); }

.hero-meta {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  padding: 10px 0;
  border-top: 1px solid var(--border);
  margin-top: 4px;
}
.hero-meta-item { display: flex; flex-direction: column; gap: 2px; }
.hero-meta-label { font-size: 11px; color: var(--dgray); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
.hero-meta-val { font-size: 15px; font-weight: 800; color: var(--text); }

/* Barra de progreso de meta dentro del hero */
.hero-goal-bar-wrap {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.hero-goal-bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.hero-goal-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--dgray);
  display: flex;
  align-items: center;
  gap: 5px;
}
.hero-goal-pct {
  font-size: 13px;
  font-weight: 800;
  color: var(--green);
}
.hero-goal-track {
  background: var(--gray);
  border-radius: var(--radius-full);
  height: 8px;
  overflow: hidden;
  margin-bottom: 6px;
}
.hero-goal-fill {
  background: linear-gradient(90deg, var(--blue), var(--green));
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.4s ease;
}
.hero-goal-sub {
  font-size: 11px;
  color: var(--dgray);
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.text-gold { color: var(--gold) !important; font-weight: 700; }
.text-green { color: var(--green) !important; font-weight: 700; }

/* Panel lateral del hero */
.hero-side-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.side-panel-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  flex: 1;
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.side-panel-title {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--navy);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.side-panel-title i { color: var(--blue); font-size: 15px; }

/* Top clientes en hero */
.hero-client-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid var(--gray);
}
.hero-client-row:last-child { border-bottom: none; }

.client-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--lblue);
  border: 1px solid rgba(37, 99, 235, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  color: var(--blue);
  flex-shrink: 0;
}
.client-info { flex: 1; min-width: 0; }
.client-nm { font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.client-purchases { font-size: 10.5px; color: var(--dgray); }
.client-monto { font-size: 13px; font-weight: 700; color: var(--green); white-space: nowrap; }

/* Últimas ventas mini */
.mini-sale-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--gray);
}
.mini-sale-row:last-child { border-bottom: none; }
.mini-sale-client { font-size: 12px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%; }
.mini-sale-val { font-size: 12.5px; font-weight: 700; color: var(--navy); }

/* ══ KPI STRIP ══ */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
@media (max-width: 1100px) { .kpi-strip { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 700px) { .kpi-strip { grid-template-columns: repeat(2, 1fr); } }

.kpi-strip-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 86px;
  transition: transform var(--trans-fast), box-shadow var(--trans-fast);
}
.kpi-strip-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-hover);
}
.kpi-strip-label {
  font-size: 11px;
  color: var(--dgray);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.kpi-strip-label i { color: var(--blue); }
.kpi-strip-val {
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
  line-height: 1.2;
}
.kpi-strip-sub {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kpi-strip-pill {
  display: inline-block;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 700;
}
.pill-red {
  background: var(--lred);
  color: var(--red);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* ══ FILA DE ANÁLISIS ══ */
.analysis-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 900px) { .analysis-row { grid-template-columns: 1fr; } }

/* Top productos panel */
.top-prod-panel {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 18px 20px;
  box-shadow: var(--shadow-sm);
}

.dash-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--gray);
}
.dash-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dash-icon-badge {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: var(--lblue);
  color: var(--blue);
}
.dash-card-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--navy);
}
.dash-card-subtitle {
  font-size: 11px;
  color: var(--dgray);
  display: block;
  margin-top: 2px;
}
.dash-pill-badge {
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 700;
  background: var(--lblue);
  color: var(--blue);
  border: 1px solid rgba(37, 99, 235, 0.25);
}

/* Top productos list */
.top-prods-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.top-prod-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.top-prod-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
}
.top-prod-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.top-prod-rank {
  color: var(--dgray);
  font-size: 11px;
  font-weight: 700;
  width: 22px;
}
.top-prod-name {
  color: var(--text);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.top-prod-numbers {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.top-prod-units {
  background: var(--gray);
  color: var(--dgray);
  padding: 1px 7px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
}
.top-prod-total {
  color: var(--navy);
  font-weight: 700;
  font-size: 12.5px;
}
.top-prod-bar-track {
  background: var(--gray);
  border-radius: var(--radius-full);
  height: 7px;
  overflow: hidden;
}
.top-prod-bar-fill {
  background: linear-gradient(90deg, var(--blue), var(--navy));
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

/* Empty states */
.empty-state-card {
  padding: 24px 16px;
  text-align: center;
  color: var(--dgray);
  font-size: 13px;
}
.empty-card {
  text-align: center;
  padding: 48px 20px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.empty-icon-wrap {
  display: inline-flex;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 14px;
}
.empty-icon-wrap.blue { background: var(--lblue); color: var(--blue); }
.empty-icon-wrap.amber { background: var(--lgold); color: var(--gold); }
.empty-title {
  color: var(--text);
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 700;
}
.empty-desc {
  color: var(--dgray);
  margin: 0;
  font-size: 13px;
}

/* Interactions & Print additions */
.clickable-row {
  cursor: pointer;
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  transition: background var(--trans-fast), transform var(--trans-fast);
}
.clickable-row:hover {
  background: var(--gray);
  transform: translateX(2px);
}
.chevron-mini {
  font-size: 10px;
  color: var(--dgray);
  margin-left: 4px;
}
.top-prod-toggle {
  display: flex;
  gap: 4px;
  background: var(--gray);
  padding: 2px;
  border-radius: var(--radius-full);
}
.toggle-pill {
  border: none;
  background: transparent;
  color: var(--dgray);
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--trans-fast);
}
.toggle-pill.active {
  background: var(--card-bg);
  color: var(--blue);
  box-shadow: var(--shadow-xs);
}
.units-highlight {
  background: var(--lblue) !important;
  color: var(--blue) !important;
  font-weight: 700 !important;
}
.total-highlight {
  color: var(--navy) !important;
  font-weight: 800 !important;
}
@media print {
  .no-print { display: none !important; }
  .page { padding: 0 !important; }
  .hero-revenue-card, .side-panel-card, .kpi-strip-card, .top-prod-panel, .sales-chart-card {
    break-inside: avoid;
    box-shadow: none !important;
    border: 1px solid #CCC !important;
  }
}

/* ═══ Indicador de Liquidez ═══ */
.liquidity-bar-wrap {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.liquidity-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 7px;
  flex-wrap: wrap;
  gap: 6px;
}
.liquidity-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--dgray);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 5px;
}
.liquidity-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  color: var(--dgray);
}
.liq-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.dot-green { background: var(--green); }
.dot-gold  { background: var(--gold); }
.liq-legend-text { font-weight: 600; }
.liquidity-track {
  display: flex;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--gray);
  overflow: hidden;
  gap: 1px;
}
.liquidity-fill {
  height: 100%;
  transition: width 0.4s ease;
  flex-shrink: 0;
}
.liq-cobrado {
  background: linear-gradient(90deg, var(--green), #34D399);
  border-radius: var(--radius-full) 0 0 var(--radius-full);
}
.liq-pendiente {
  background: linear-gradient(90deg, #F59E0B, var(--gold));
  border-radius: 0 var(--radius-full) var(--radius-full) 0;
}
.liquidity-amounts {
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
  flex-wrap: wrap;
  gap: 4px;
}
.liq-amount-cobrado {
  font-size: 11px;
  font-weight: 700;
  color: var(--green);
  display: flex;
  align-items: center;
  gap: 4px;
}
.liq-amount-pendiente {
  font-size: 11px;
  font-weight: 700;
  color: var(--gold);
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
