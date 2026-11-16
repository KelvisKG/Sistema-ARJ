<template>
  <div class="page active" id="page-dashboard">
    <div class="dash-header-section">
      <div class="dash-header-title">
        <h1 class="page-title"><i class="ti ti-chart-bar"></i> Reportes y Dashboard</h1>
        <p class="page-sub">Resumen del día · Comparativa entre empresas · Ranking · Reorden · Backup</p>
      </div>
    </div>

    <!-- Sub-navegación de reportes en píldoras modernas -->
    <div class="report-nav-bar">
      <button :class="['search-tab nav-pill', { active: sub === 'resumen' }]" @click="sub = 'resumen'"><i class="ti ti-dashboard"></i> Resumen</button>
      <button :class="['search-tab nav-pill', { active: sub === 'comparativa' }]" @click="sub = 'comparativa'"><i class="ti ti-arrows-left-right"></i> Comparar empresas</button>
      <button :class="['search-tab nav-pill', { active: sub === 'ranking' }]" @click="sub = 'ranking'"><i class="ti ti-trophy"></i> Ranking clientes</button>
      <button :class="['search-tab nav-pill', { active: sub === 'reorden' }]" @click="sub = 'reorden'"><i class="ti ti-package"></i> Qué reordenar</button>
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

      <!-- ══ HERO SECTION ══ -->
      <div class="hero-row">
        <!-- Columna izquierda: Revenue Hero Card -->
        <div class="hero-revenue-card">
          <div class="hero-label"><i class="ti ti-report-money" style="margin-right:5px;color:#38BDF8;"></i>Ingresos del período</div>
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
            <div class="hero-meta-item">
              <span class="hero-meta-label">Mes anterior</span>
              <span class="hero-meta-val">${{ (compMeses.ant || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>
            <div class="hero-meta-item">
              <span class="hero-meta-label">Hoy</span>
              <span class="hero-meta-val">${{ (ventas.totHoy || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>
            <div class="hero-meta-item">
              <span class="hero-meta-label">Facturas hoy</span>
              <span class="hero-meta-val">{{ ventas.nHoy || 0 }}</span>
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
            <div v-if="!ranking.top.length" class="empty-state-dark" style="padding:12px;font-size:12px;">
              Sin ventas en el período
            </div>
            <div v-else>
              <div v-for="(c, idx) in ranking.top.slice(0, 4)" :key="c.nombre" class="hero-client-row">
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
            <div v-if="!ventasRecientes.length" class="empty-state-dark" style="padding:12px;font-size:12px;">
              Sin ventas recientes
            </div>
            <div v-else>
              <div v-for="v in ventasRecientes.slice(0, 4)" :key="v.id" class="mini-sale-row">
                <div class="mini-sale-client">{{ v.cliente_nombre_snap || v.cliente }}</div>
                <div class="mini-sale-val">{{ fmtUSD(v.total) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ KPI STRIP ══ -->
      <div class="kpi-strip">
        <!-- 1. Margen catálogo -->
        <div class="kpi-strip-card">
          <div class="kpi-strip-label">Margen Catálogo</div>
          <div class="kpi-strip-val">
            <span v-if="margenCatalogo != null">{{ margenCatalogo.toFixed(1) }}%</span>
            <span v-else style="font-size:14px;color:#64748B;">—</span>
          </div>
          <div class="kpi-strip-sub">Teórico</div>
        </div>
        <!-- 2. Utilidad bruta -->
        <div class="kpi-strip-card">
          <div class="kpi-strip-label">Utilidad Bruta</div>
          <div class="kpi-strip-val" style="font-size:17px;">{{ kpisPeriodo.utilVal }}</div>
          <div class="kpi-strip-sub">{{ kpisPeriodo.utilSub }}</div>
        </div>
        <!-- 3. Margen real -->
        <div class="kpi-strip-card">
          <div class="kpi-strip-label">Margen Real</div>
          <div class="kpi-strip-val">{{ kpisPeriodo.margenVal }}</div>
          <div class="kpi-strip-sub">{{ kpisPeriodo.margenSub }}</div>
        </div>
        <!-- 4. Punto de equilibrio -->
        <div class="kpi-strip-card">
          <div class="kpi-strip-label">Punto Equilibrio</div>
          <div class="kpi-strip-val" style="font-size:17px;">{{ kpisPeriodo.peVal }}</div>
          <div class="kpi-strip-sub">{{ kpisPeriodo.peSub }}</div>
        </div>
        <!-- 5. Costos fijos -->
        <div class="kpi-strip-card">
          <div class="kpi-strip-label">Costos Fijos</div>
          <div class="kpi-strip-val" style="font-size:17px;">{{ fmtUSD(kpisPeriodo.cf || 0) }}</div>
          <div class="kpi-strip-sub">{{ kpisPeriodo.cfSub }}</div>
        </div>
        <!-- 6. Stock crítico -->
        <div class="kpi-strip-card">
          <div class="kpi-strip-label">Stock Crítico</div>
          <div class="kpi-strip-val">{{ stockCritico.bajos || 0 }}</div>
          <div class="kpi-strip-sub">
            <span
              v-if="stockCritico.agotados > 0"
              class="kpi-strip-pill"
              style="background:rgba(239,68,68,0.15);color:#F87171;border:1px solid rgba(239,68,68,0.3);"
            >{{ stockCritico.agotados }} agotado{{ stockCritico.agotados !== 1 ? 's' : '' }}</span>
            <span v-else>Sin agotados</span>
          </div>
        </div>
      </div>

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
                <span class="dash-card-subtitle">Ranking por volumen en el período</span>
              </div>
            </div>
            <span class="dash-pill-badge blue">{{ top.length }} items</span>
          </div>

          <div v-if="!top.length" class="empty-state-dark">
            <i class="ti ti-chart-pie-off"></i>
            <span>Sin ventas registradas en este período</span>
          </div>
          <div v-else class="top-prods-list">
            <div v-for="(p, idx) in top.slice(0, 8)" :key="p.cod" class="top-prod-row">
              <div class="top-prod-header">
                <div class="top-prod-info">
                  <span class="top-prod-rank">#{{ idx + 1 }}</span>
                  <span class="top-prod-name" :title="p.desc || p.cod">{{ p.desc || p.cod }}</span>
                </div>
                <div class="top-prod-numbers">
                  <span class="top-prod-units">{{ p.cant }} ud</span>
                  <span class="top-prod-total">{{ fmtUSD(p.total) }}</span>
                </div>
              </div>
              <div class="top-prod-bar-track">
                <div class="top-prod-bar-fill" :style="{ width: (p.total / (top[0].total || 1)) * 100 + '%' }"></div>
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

    <!-- ═══ COMPARATIVA ENTRE EMPRESAS ═══ -->
    <div v-if="sub === 'comparativa'">
      <div class="dash-card-dark empty-card">
        <div class="empty-icon-wrap blue">
          <i class="ti ti-arrows-left-right"></i>
        </div>
        <h3 class="empty-title">Venta Directa vs Distribuidora — Este mes</h3>
        <p class="empty-desc">Sin ventas registradas todavía</p>
      </div>
    </div>

    <!-- ═══ RANKING DE CLIENTES ═══ -->
    <div v-if="sub === 'ranking'">
      <CustomerRankingCard
        :ranking="ranking"
        :nombre-emp="nombreEmp"
      />
    </div>

    <!-- ═══ REORDEN ═══ -->
    <div v-if="sub === 'reorden'">
      <div class="dash-card-dark empty-card">
        <div class="empty-icon-wrap amber">
          <i class="ti ti-package"></i>
        </div>
        <h3 class="empty-title">Productos que debes reordenar pronto</h3>
        <p class="empty-desc">El cálculo de reorden se activará cuando haya historial de ventas real</p>
      </div>
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
      <div class="modal-content modal-content-dark" style="max-width:480px;text-align:left">
        <div class="modal-header-dark">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="dash-icon-badge blue" style="width:32px;height:32px"><i class="ti ti-users"></i></span>
            <h3 style="margin:0;font-size:17px;color:#F8FAFC;font-weight:700">Equipo de trabajo</h3>
          </div>
          <button class="btn-close-dark" @click="equipoAbierto = false"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-alert-dark">
          <i class="ti ti-info-circle" style="font-size:16px;flex-shrink:0;margin-top:2px"></i>
          <div>Esta lista es solo para <strong>ponerles metas</strong>. No crea usuarios que puedan entrar al sistema — eso se hace en Supabase.</div>
        </div>
        <div class="modal-add-row">
          <div style="flex:1">
            <label class="modal-label">Nombre</label>
            <input v-model="eqNombre" type="text" class="modal-input" placeholder="Ej: PEDRO PEREZ" style="text-transform:uppercase" @keydown.enter.prevent="agregarAlEquipo">
          </div>
          <div style="width:140px">
            <label class="modal-label">Empresa</label>
            <select v-model="eqEmpresa" class="modal-input">
              <option value="directa">Venta Directa</option>
              <option value="dist">Distribuidora</option>
              <option value="ambas">Ambas</option>
            </select>
          </div>
          <button class="btn-add-dark" @click="agregarAlEquipo"><i class="ti ti-plus"></i></button>
        </div>
        <div class="modal-team-list">
          <div v-if="!equipo.length" class="empty-state-dark" style="padding:16px">Todavía no hay nadie en el equipo</div>
          <div v-for="(t, i) in equipo" :key="t.nombre" class="team-member-row">
            <div style="min-width:0">
              <div class="member-name">{{ t.nombre }}</div>
              <div class="member-role">{{ { ambas: 'Ambas', directa: 'Venta Directa', dist: 'Distribuidora' }[t.empresa] || t.empresa }}</div>
            </div>
            <button class="btn-trash-dark" title="Quitar del equipo" @click="quitarDelEquipo(i)"><i class="ti ti-trash"></i></button>
          </div>
        </div>
        <div class="modal-footer-dark">
          <button class="btn-secondary-dark" @click="equipoAbierto = false">Cerrar</button>
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

const store = useArjStore();
const sub = ref('resumen');
const nombreEmp = computed(() => (store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora'));

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
  margin-bottom: 16px;
}
.page-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.page-title i {
  color: #38BDF8;
}

.report-nav-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  overflow-x: auto;
  flex-wrap: wrap;
  padding-bottom: 4px;
}

.nav-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #101B2E;
  background: linear-gradient(145deg, #101B2E 0%, #0A111E 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  padding: 8px 16px;
  color: #94A3B8;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.nav-pill:hover {
  color: #F8FAFC;
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}

.nav-pill.active {
  background: #1E293B;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%);
  color: #38BDF8;
  border-color: rgba(56, 189, 248, 0.4);
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.2);
}

/* ══ HERO SECTION ══ */
.hero-row {
  display: grid;
  grid-template-columns: 1.8fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 900px) { .hero-row { grid-template-columns: 1fr; } }

.hero-revenue-card {
  background: linear-gradient(145deg, #0D1B30 0%, #0A1428 50%, #071020 100%);
  border: 1px solid rgba(56, 189, 248, 0.15);
  border-radius: 18px;
  padding: 28px 32px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
}
.hero-revenue-card::before {
  content: '';
  position: absolute;
  top: -60px; right: -60px;
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%);
  pointer-events: none;
}
.hero-label {
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}
.hero-amount {
  font-size: 48px;
  font-weight: 800;
  color: #F8FAFC;
  line-height: 1;
  letter-spacing: -0.04em;
  margin-bottom: 10px;
}
.hero-amount .hero-currency {
  font-size: 28px;
  font-weight: 600;
  color: #94A3B8;
  margin-right: 2px;
}
.hero-var-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 10px;
}
.hero-var-pill.up { background: rgba(16,185,129,0.15); color: #34D399; border: 1px solid rgba(16,185,129,0.3); }
.hero-var-pill.down { background: rgba(239,68,68,0.15); color: #F87171; border: 1px solid rgba(239,68,68,0.3); }
.hero-var-pill.neutral { background: rgba(100,116,139,0.15); color: #94A3B8; border: 1px solid rgba(100,116,139,0.3); }
.hero-meta {
  font-size: 12px;
  color: #64748B;
  margin-top: 8px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.hero-meta-item { display: flex; flex-direction: column; gap: 2px; }
.hero-meta-label { font-size: 10.5px; color: #475569; text-transform: uppercase; letter-spacing: 0.06em; }
.hero-meta-val { font-size: 14px; font-weight: 700; color: #CBD5E1; }

/* Panel lateral del hero */
.hero-side-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.side-panel-card {
  background: linear-gradient(145deg, #101B2E 0%, #0A111E 100%);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 16px 18px;
  flex: 1;
}
.side-panel-title {
  font-size: 11px;
  font-weight: 700;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.side-panel-title i { color: #38BDF8; font-size: 14px; }

/* Top clientes en hero */
.hero-client-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.hero-client-row:last-child { border-bottom: none; }
.client-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, #1E3A5F 0%, #0D2544 100%);
  border: 1px solid rgba(56,189,248,0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: #38BDF8; flex-shrink: 0;
}
.client-info { flex: 1; min-width: 0; }
.client-nm { font-size: 12px; font-weight: 600; color: #F8FAFC; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.client-purchases { font-size: 10.5px; color: #64748B; }
.client-monto { font-size: 13px; font-weight: 700; color: #34D399; white-space: nowrap; }

/* Últimas ventas mini */
.mini-sale-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.mini-sale-row:last-child { border-bottom: none; }
.mini-sale-client { font-size: 12px; font-weight: 600; color: #CBD5E1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 55%; }
.mini-sale-val { font-size: 12px; font-weight: 700; color: #F8FAFC; }

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
  background: linear-gradient(145deg, #101B2E 0%, #0A111E 100%);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 14px 16px;
  transition: border-color 0.2s, transform 0.2s;
}
.kpi-strip-card:hover { border-color: rgba(255,255,255,0.18); transform: translateY(-1px); }
.kpi-strip-label { font-size: 10px; color: #64748B; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
.kpi-strip-val { font-size: 20px; font-weight: 800; color: #F8FAFC; letter-spacing: -0.02em; line-height: 1.1; }
.kpi-strip-sub { font-size: 10px; color: #64748B; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kpi-strip-pill {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 9999px;
  font-size: 9.5px;
  font-weight: 700;
  margin-bottom: 4px;
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
  background: linear-gradient(145deg, #101B2E 0%, #0A111E 100%);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 4px 14px 0 rgba(0, 0, 0, 0.25);
}

/* Grid para analítica inferior */
.dash-grid-analytics {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 16px;
  margin-top: 18px;
}

@media (max-width: 900px) {
  .dash-grid-analytics {
    grid-template-columns: 1fr;
  }
}

/* Dark card base */
.dash-card-dark {
  background: #0E1726;
  background: linear-gradient(145deg, #101B2E 0%, #0A111E 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 4px 14px 0 rgba(0, 0, 0, 0.25);
  margin-bottom: 18px;
}

.dash-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.dash-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dash-icon-badge {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.dash-icon-badge.blue {
  background: rgba(56, 189, 248, 0.12);
  color: #38BDF8;
}
.dash-icon-badge.purple {
  background: rgba(168, 85, 247, 0.12);
  color: #A855F7;
}

.dash-card-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #F8FAFC;
  letter-spacing: 0.3px;
}

.dash-card-subtitle {
  font-size: 11px;
  color: #64748B;
  display: block;
  margin-top: 2px;
}

.dash-pill-badge {
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
}
.dash-pill-badge.blue {
  background: rgba(56, 189, 248, 0.12);
  color: #38BDF8;
  border: 1px solid rgba(56, 189, 248, 0.25);
}
.dash-pill-badge.purple {
  background: rgba(168, 85, 247, 0.12);
  color: #C084FC;
  border: 1px solid rgba(168, 85, 247, 0.25);
}

/* Empty states */
.empty-state-dark {
  padding: 28px 16px;
  text-align: center;
  color: #64748B;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.empty-state-dark i {
  font-size: 26px;
  opacity: 0.6;
}

.empty-card {
  text-align: center;
  padding: 48px 20px;
}
.empty-icon-wrap {
  display: inline-flex;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 14px;
}
.empty-icon-wrap.blue {
  background: rgba(56, 189, 248, 0.12);
  color: #38BDF8;
}
.empty-icon-wrap.amber {
  background: rgba(251, 191, 36, 0.12);
  color: #FBBF24;
}
.empty-title {
  color: #F8FAFC;
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 700;
}
.empty-desc {
  color: #94A3B8;
  margin: 0;
  font-size: 13px;
}

/* Top productos */
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
  color: #64748B;
  font-size: 11px;
  font-weight: 700;
  width: 22px;
}
.top-prod-name {
  color: #F8FAFC;
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
  background: rgba(255, 255, 255, 0.06);
  color: #94A3B8;
  padding: 1px 7px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
}
.top-prod-total {
  color: #38BDF8;
  font-weight: 700;
  font-size: 12.5px;
  font-family: monospace;
}
.top-prod-bar-track {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 9999px;
  height: 7px;
  overflow: hidden;
}
.top-prod-bar-fill {
  background: linear-gradient(90deg, #38BDF8 0%, #2563EB 100%);
  height: 100%;
  border-radius: 9999px;
  transition: width 0.3s ease;
}

/* Últimas ventas */
.recent-sales-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 380px;
  overflow-y: auto;
  padding-right: 4px;
}
.recent-sale-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 10px;
  border-radius: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.15s ease;
}
.recent-sale-row:hover {
  background: rgba(255, 255, 255, 0.03);
}
.recent-sale-client {
  min-width: 0;
}
.client-name {
  color: #F8FAFC;
  font-weight: 600;
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.client-sub {
  color: #64748B;
  font-size: 11px;
  margin-top: 2px;
}
.recent-sale-val {
  color: #34D399;
  font-weight: 700;
  font-size: 13px;
  font-family: monospace;
  white-space: nowrap;
  margin-left: 10px;
}

/* Modal dark styles */
.modal-content-dark {
  background: #0E1726 !important;
  background: linear-gradient(145deg, #101B2E 0%, #0A111E 100%) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 16px !important;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6) !important;
  color: #F8FAFC !important;
}
.modal-header-dark {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 12px;
}
.btn-close-dark {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94A3B8;
  border-radius: 8px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-close-dark:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #F8FAFC;
}
.modal-alert-dark {
  background: rgba(251, 191, 36, 0.08);
  border-left: 3px solid #FBBF24;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 14px;
  font-size: 11.5px;
  color: #FDE68A;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.4;
}
.modal-add-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  margin-bottom: 14px;
}
.modal-label {
  font-size: 11px;
  color: #94A3B8;
  font-weight: 500;
  display: block;
  margin-bottom: 4px;
}
.modal-input {
  width: 100%;
  background: #0A111E;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 8px 10px;
  color: #F8FAFC;
  font-size: 12.5px;
  box-sizing: border-box;
}
.modal-input:focus {
  outline: none;
  border-color: #38BDF8;
}
.btn-add-dark {
  background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%);
  color: #FFF;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 600;
  height: 35px;
}
.btn-add-dark:hover {
  background: linear-gradient(135deg, #0369A1 0%, #075985 100%);
}
.modal-team-list {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  max-height: 260px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.2);
}
.team-member-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  gap: 8px;
}
.team-member-row:last-child {
  border-bottom: none;
}
.member-name {
  font-weight: 600;
  font-size: 13px;
  color: #F8FAFC;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.member-role {
  font-size: 11px;
  color: #94A3B8;
  margin-top: 1px;
}
.btn-trash-dark {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #F87171;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-trash-dark:hover {
  background: rgba(239, 68, 68, 0.25);
  color: #FFF;
}
.modal-footer-dark {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 12px;
}
.btn-secondary-dark {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #94A3B8;
  border-radius: 8px;
  padding: 7px 16px;
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
}
.btn-secondary-dark:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #F8FAFC;
}
</style>
