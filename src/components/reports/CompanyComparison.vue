<template>
  <div class="company-comparison-card">
    <!-- ═══ HEADER ═══ -->
    <div class="comp-header">
      <div class="header-left">
        <div class="icon-wrap-blue">
          <i class="ti ti-arrows-left-right"></i>
        </div>
        <div>
          <h3 class="comp-title">Comparativa Corporativa de Empresas</h3>
          <p class="comp-sub">Desempeño cara a cara — {{ etiquetaPeriodo }}</p>
        </div>
      </div>
      <!-- Selector de período -->
      <div class="period-select-wrap">
        <i class="ti ti-calendar" style="color:var(--dgray);font-size:14px;"></i>
        <select v-model="periodoSel" class="comp-period-select">
          <option value="mes">Este mes</option>
          <option value="mes_ant">Mes anterior</option>
          <option value="3m">Últimos 3 meses</option>
          <option value="12m">Año en curso</option>
        </select>
      </div>
    </div>

    <!-- ═══ BARRA DE DISTRIBUCIÓN TOTAL ═══ -->
    <div class="share-chart-section">
      <div class="share-header">
        <span class="share-title">
          Facturación corporativa total:
          <strong>{{ fmtUSD(totales.corporativo) }}</strong>
          <span v-if="totales.corporativo === 0" class="no-data-hint">&nbsp;— Sin ventas en este período</span>
        </span>
        <div class="share-legend">
          <span class="legend-dot dot-directa"></span>
          Venta Directa <strong>&nbsp;{{ pctDirecta.toFixed(1) }}%</strong>
          <span class="legend-dot dot-dist" style="margin-left:14px"></span>
          Distribuidora <strong>&nbsp;{{ pctDist.toFixed(1) }}%</strong>
        </div>
      </div>
      <div class="share-progress-track">
        <div class="share-bar directa" :style="{ width: pctDirecta + '%' }">
          <span v-if="pctDirecta > 15">{{ pctDirecta.toFixed(1) }}%</span>
        </div>
        <div class="share-bar dist" :style="{ width: pctDist + '%' }">
          <span v-if="pctDist > 15">{{ pctDist.toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <!-- ═══ COLUMNAS CARA A CARA ═══ -->
    <div class="companies-grid">
      <!-- VENTA DIRECTA -->
      <div class="company-column directa-border">
        <div class="company-col-header directa-header">
          <div class="col-title-wrap">
            <i class="ti ti-building-store"></i>
            <div>
              <h4>Venta Directa</h4>
              <span>Mostrador y cliente final</span>
            </div>
          </div>
          <span class="share-pill blue">{{ pctDirecta.toFixed(0) }}% del total</span>
        </div>

        <!-- Sin datos -->
        <div v-if="totales.directa.nFacts === 0" class="no-data-box blue-hint">
          <i class="ti ti-inbox"></i>
          <span>Sin facturación en este período</span>
        </div>

        <template v-else>
          <div class="company-stat-main">
            <span class="stat-main-lbl">Facturación total</span>
            <div class="stat-main-val font-blue">{{ fmtUSD(totales.directa.total) }}</div>
            <span class="stat-main-sub">{{ totales.directa.nFacts }} facturas emitidas</span>
          </div>

          <div class="company-metrics-list">
            <div class="metric-row">
              <span class="m-label"><i class="ti ti-receipt"></i> Ticket promedio:</span>
              <span class="m-val">{{ fmtUSD(totales.directa.ticketProm) }}</span>
            </div>
            <div class="metric-row">
              <span class="m-label"><i class="ti ti-users"></i> Clientes activos:</span>
              <span class="m-val">{{ totales.directa.clientesCount }} clientes</span>
            </div>
            <div class="metric-row">
              <span class="m-label"><i class="ti ti-package"></i> Unidades movidas:</span>
              <span class="m-val">{{ totales.directa.unidades.toLocaleString('es-VE') }} uds</span>
            </div>
            <div class="metric-row">
              <span class="m-label"><i class="ti ti-cash"></i> Cobrado en caja:</span>
              <span class="m-val font-green">{{ fmtUSD(totales.directa.cobrado) }}</span>
            </div>
            <div class="metric-row">
              <span class="m-label"><i class="ti ti-clock"></i> Por cobrar (créditos):</span>
              <span class="m-val font-gold">{{ fmtUSD(totales.directa.porCobrar) }}</span>
            </div>
          </div>

          <!-- Badges de Liderazgo -->
          <div class="badges-row">
            <span v-if="lideres.facturacion === 'directa'" class="leader-badge blue">
              <i class="ti ti-trophy"></i> Mayor Facturación
            </span>
            <span v-if="lideres.ticket === 'directa'" class="leader-badge teal">
              <i class="ti ti-target"></i> Mejor Ticket Prom.
            </span>
            <span v-if="lideres.cobranza === 'directa'" class="leader-badge green">
              <i class="ti ti-bolt"></i> Mejor Tasa de Cobro
            </span>
          </div>
        </template>
      </div>

      <!-- DISTRIBUIDORA -->
      <div class="company-column dist-border">
        <div class="company-col-header dist-header">
          <div class="col-title-wrap">
            <i class="ti ti-truck-delivery"></i>
            <div>
              <h4>Distribuidora</h4>
              <span>Venta al mayor y talleres</span>
            </div>
          </div>
          <span class="share-pill amber">{{ pctDist.toFixed(0) }}% del total</span>
        </div>

        <!-- Sin datos -->
        <div v-if="totales.dist.nFacts === 0" class="no-data-box amber-hint">
          <i class="ti ti-inbox"></i>
          <span>Sin facturación en este período</span>
        </div>

        <template v-else>
          <div class="company-stat-main">
            <span class="stat-main-lbl">Facturación total</span>
            <div class="stat-main-val font-gold">{{ fmtUSD(totales.dist.total) }}</div>
            <span class="stat-main-sub">{{ totales.dist.nFacts }} facturas emitidas</span>
          </div>

          <div class="company-metrics-list">
            <div class="metric-row">
              <span class="m-label"><i class="ti ti-receipt"></i> Ticket promedio:</span>
              <span class="m-val">{{ fmtUSD(totales.dist.ticketProm) }}</span>
            </div>
            <div class="metric-row">
              <span class="m-label"><i class="ti ti-users"></i> Clientes activos:</span>
              <span class="m-val">{{ totales.dist.clientesCount }} clientes</span>
            </div>
            <div class="metric-row">
              <span class="m-label"><i class="ti ti-package"></i> Unidades movidas:</span>
              <span class="m-val">{{ totales.dist.unidades.toLocaleString('es-VE') }} uds</span>
            </div>
            <div class="metric-row">
              <span class="m-label"><i class="ti ti-cash"></i> Cobrado en caja:</span>
              <span class="m-val font-green">{{ fmtUSD(totales.dist.cobrado) }}</span>
            </div>
            <div class="metric-row">
              <span class="m-label"><i class="ti ti-clock"></i> Por cobrar (créditos):</span>
              <span class="m-val font-gold">{{ fmtUSD(totales.dist.porCobrar) }}</span>
            </div>
          </div>

          <!-- Badges de Liderazgo -->
          <div class="badges-row">
            <span v-if="lideres.facturacion === 'dist'" class="leader-badge amber">
              <i class="ti ti-trophy"></i> Mayor Facturación
            </span>
            <span v-if="lideres.ticket === 'dist'" class="leader-badge teal">
              <i class="ti ti-target"></i> Mejor Ticket Prom.
            </span>
            <span v-if="lideres.cobranza === 'dist'" class="leader-badge green">
              <i class="ti ti-bolt"></i> Mejor Tasa de Cobro
            </span>
          </div>
        </template>
      </div>
    </div>

    <!-- ═══ ESTADO DE CARTERA (Barras bicolor Cobrado + Pendiente) ═══ -->
    <div class="cash-health-box">
      <h5 class="cash-health-title">
        <i class="ti ti-wallet"></i> Estado de Cartera y Cobranza Corporativa
      </h5>
      <div class="cash-bars-grid">
        <!-- Venta Directa -->
        <div class="cash-company-item">
          <div class="cash-item-top">
            <span class="cash-co-name"><i class="ti ti-building-store" style="color:var(--blue)"></i> Venta Directa</span>
            <div class="cash-pct-labels">
              <span class="pct-green">Cobrado {{ (totales.directa.total > 0 ? (totales.directa.cobrado / totales.directa.total * 100) : 0).toFixed(1) }}%</span>
              <span class="pct-gold">Pendiente {{ (totales.directa.total > 0 ? (totales.directa.porCobrar / totales.directa.total * 100) : 0).toFixed(1) }}%</span>
            </div>
          </div>
          <div class="cash-progress">
            <div
              class="cash-seg cobrado-seg"
              :style="{ width: (totales.directa.total > 0 ? Math.min(totales.directa.cobrado / totales.directa.total * 100, 100) : 0) + '%' }"
              :title="'Cobrado: ' + fmtUSD(totales.directa.cobrado)"
            ></div>
            <div
              class="cash-seg pendiente-seg"
              :style="{ width: (totales.directa.total > 0 ? Math.min(totales.directa.porCobrar / totales.directa.total * 100, 100) : 0) + '%' }"
              :title="'Por cobrar: ' + fmtUSD(totales.directa.porCobrar)"
            ></div>
          </div>
          <div class="cash-amounts-row">
            <span class="cash-amt-green"><i class="ti ti-cash"></i> {{ fmtUSD(totales.directa.cobrado) }}</span>
            <span class="cash-amt-gold"><i class="ti ti-clock"></i> {{ fmtUSD(totales.directa.porCobrar) }}</span>
          </div>
          <div v-if="totales.directa.nFacts === 0" class="cash-no-data">Sin datos para este período</div>
        </div>

        <!-- Distribuidora -->
        <div class="cash-company-item">
          <div class="cash-item-top">
            <span class="cash-co-name"><i class="ti ti-truck-delivery" style="color:var(--gold)"></i> Distribuidora</span>
            <div class="cash-pct-labels">
              <span class="pct-green">Cobrado {{ (totales.dist.total > 0 ? (totales.dist.cobrado / totales.dist.total * 100) : 0).toFixed(1) }}%</span>
              <span class="pct-gold">Pendiente {{ (totales.dist.total > 0 ? (totales.dist.porCobrar / totales.dist.total * 100) : 0).toFixed(1) }}%</span>
            </div>
          </div>
          <div class="cash-progress">
            <div
              class="cash-seg cobrado-seg dist-cobrado"
              :style="{ width: (totales.dist.total > 0 ? Math.min(totales.dist.cobrado / totales.dist.total * 100, 100) : 0) + '%' }"
              :title="'Cobrado: ' + fmtUSD(totales.dist.cobrado)"
            ></div>
            <div
              class="cash-seg pendiente-seg"
              :style="{ width: (totales.dist.total > 0 ? Math.min(totales.dist.porCobrar / totales.dist.total * 100, 100) : 0) + '%' }"
              :title="'Por cobrar: ' + fmtUSD(totales.dist.porCobrar)"
            ></div>
          </div>
          <div class="cash-amounts-row">
            <span class="cash-amt-green"><i class="ti ti-cash"></i> {{ fmtUSD(totales.dist.cobrado) }}</span>
            <span class="cash-amt-gold"><i class="ti ti-clock"></i> {{ fmtUSD(totales.dist.porCobrar) }}</span>
          </div>
          <div v-if="totales.dist.nFacts === 0" class="cash-no-data">Sin datos para este período</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { fmtUSD } from '../../services/pricing.js';

const props = defineProps({
  todasFacturas: {
    type: Array,
    default: () => []
  },
  etiquetaPeriodo: {
    type: String,
    default: 'este mes'
  }
});

// Selector de período interno del componente
const periodoSel = ref('mes');

// Calcula los cortes de fecha según el período seleccionado
const cortesPeriodo = computed(() => {
  const hoy = new Date();
  const a = hoy.getFullYear();
  const m = hoy.getMonth();
  if (periodoSel.value === 'mes') {
    return new Date(a, m, 1);
  } else if (periodoSel.value === 'mes_ant') {
    return new Date(a, m - 1, 1);
  } else if (periodoSel.value === '3m') {
    return new Date(a, m - 2, 1);
  } else if (periodoSel.value === '12m') {
    return new Date(a, 0, 1);
  }
  return new Date(a, m, 1);
});

const etiquetaInterna = computed(() => {
  const labels = {
    mes: 'Este mes',
    mes_ant: 'Mes anterior',
    '3m': 'Últimos 3 meses',
    '12m': 'Año en curso'
  };
  return labels[periodoSel.value] || 'Este mes';
});

// Para el mes anterior también necesitamos una fecha límite
const hoyPeriodo = computed(() => {
  const hoy = new Date();
  const a = hoy.getFullYear();
  const m = hoy.getMonth();
  if (periodoSel.value === 'mes_ant') {
    return new Date(a, m, 1); // hasta inicio de este mes
  }
  return null; // null = hasta hoy
});

const totales = computed(() => {
  const mk = () => ({ total: 0, nFacts: 0, cobrado: 0, porCobrar: 0, clientes: new Set(), ticketProm: 0, unidades: 0, clientesCount: 0 });
  const d = mk();
  const dist = mk();

  const desde = cortesPeriodo.value;
  const hasta = hoyPeriodo.value;

  const facts = (props.todasFacturas || []).filter(f => {
    if (f.estado === 'anulada' || !f.fecha_raw) return false;
    const fch = new Date(f.fecha_raw);
    if (fch < desde) return false;
    if (hasta && fch >= hasta) return false;
    return true;
  });

  facts.forEach(f => {
    const isDirecta = f.empresa === 'directa';
    const tgt = isDirecta ? d : dist;
    const tot = f.total || 0;
    const saldo = f.saldo_pendiente || 0;
    const pagado = Math.max(0, tot - saldo);
    const cli = f.cliente_nombre_snap || f.cliente || 'Desconocido';
    // Unidades: sumar desde items si existen, sino usar 1 como approx
    const uds = Array.isArray(f.items) ? f.items.reduce((a, it) => a + (it.cantidad || 0), 0) : 1;

    tgt.total += tot;
    tgt.nFacts++;
    tgt.cobrado += pagado;
    tgt.porCobrar += saldo;
    tgt.clientes.add(cli);
    tgt.unidades += uds;
  });

  d.ticketProm = d.nFacts > 0 ? d.total / d.nFacts : 0;
  d.clientesCount = d.clientes.size;
  dist.ticketProm = dist.nFacts > 0 ? dist.total / dist.nFacts : 0;
  dist.clientesCount = dist.clientes.size;

  return { directa: d, dist, corporativo: d.total + dist.total };
});

const pctDirecta = computed(() => {
  const corp = totales.value.corporativo;
  return corp > 0 ? (totales.value.directa.total / corp) * 100 : 50;
});

const pctDist = computed(() => {
  const corp = totales.value.corporativo;
  return corp > 0 ? (totales.value.dist.total / corp) * 100 : 50;
});

// Badges: quién lidera en cada categoría
const lideres = computed(() => {
  const d = totales.value.directa;
  const dist = totales.value.dist;
  const facturacion = d.total >= dist.total ? 'directa' : 'dist';
  const ticket = d.ticketProm >= dist.ticketProm ? 'directa' : 'dist';
  const tasaD = d.total > 0 ? d.cobrado / d.total : 0;
  const tasaDist = dist.total > 0 ? dist.cobrado / dist.total : 0;
  const cobranza = tasaD >= tasaDist ? 'directa' : 'dist';
  return { facturacion, ticket, cobranza };
});
</script>

<style scoped>
.company-comparison-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 20px;
}

/* ── Header ── */
.comp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.icon-wrap-blue {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md);
  background: var(--lblue);
  color: var(--blue);
  border: 1px solid rgba(37, 99, 235, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}
.comp-title {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--navy);
}
.comp-sub {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: var(--dgray);
}

/* ── Selector de Período ── */
.period-select-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 4px 10px 4px 10px;
}
.comp-period-select {
  background: transparent;
  border: none;
  outline: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  padding: 0;
  appearance: auto;
}

/* ── Distribución Total ── */
.share-chart-section {
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  margin-bottom: 18px;
}
.share-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 12.5px;
}
.share-title { color: var(--text); }
.no-data-hint { color: var(--dgray); font-weight: 400; }
.share-legend {
  display: flex;
  align-items: center;
  color: var(--dgray);
  font-size: 12px;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 5px;
}
.dot-directa { background: var(--blue); }
.dot-dist { background: var(--gold); }

.share-progress-track {
  display: flex;
  height: 22px;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--border);
}
.share-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #FFF;
  transition: width 0.4s ease;
  min-width: 0;
}
.share-bar.directa { background: linear-gradient(90deg, #2563EB, #3B82F6); }
.share-bar.dist    { background: linear-gradient(90deg, #D97706, #F59E0B); }

/* ── Columnas cara a cara ── */
.companies-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 18px;
}
@media (max-width: 800px) {
  .companies-grid { grid-template-columns: 1fr; }
}

.company-column {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px 18px;
  box-shadow: var(--shadow-xs);
}
.directa-border { border-top: 3px solid var(--blue); }
.dist-border    { border-top: 3px solid var(--gold); }

.company-col-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}
.col-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.col-title-wrap i { font-size: 20px; }
.directa-header i { color: var(--blue); }
.dist-header i    { color: var(--gold); }
.col-title-wrap h4 {
  margin: 0;
  font-size: 14.5px;
  font-weight: 800;
  color: var(--navy);
}
.col-title-wrap span {
  font-size: 11px;
  color: var(--dgray);
}

.share-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}
.share-pill.blue  { background: var(--lblue); color: var(--blue); }
.share-pill.amber { background: var(--lgold); color: var(--gold); }

/* Sin datos en columna */
.no-data-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 12px;
  border-radius: var(--radius-md);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--dgray);
  text-align: center;
}
.blue-hint  { background: var(--lblue);  border: 1px dashed rgba(37,99,235,0.3); }
.amber-hint { background: var(--lgold);  border: 1px dashed rgba(217,119,6,0.3); }
.no-data-box i { font-size: 24px; opacity: 0.5; }

/* Stats principales */
.company-stat-main { margin-bottom: 14px; }
.stat-main-lbl {
  font-size: 11px;
  color: var(--dgray);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.stat-main-val {
  font-size: 26px;
  font-weight: 800;
  line-height: 1.15;
  margin: 4px 0 2px 0;
}
.stat-main-sub {
  font-size: 11.5px;
  color: var(--text-muted);
}

.font-blue  { color: var(--blue)  !important; }
.font-gold  { color: var(--gold)  !important; }
.font-green { color: var(--green) !important; }

/* Métricas de fila */
.company-metrics-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--gray);
  padding-top: 12px;
}
.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12.5px;
}
.m-label {
  color: var(--dgray);
  display: flex;
  align-items: center;
  gap: 5px;
}
.m-val { font-weight: 700; color: var(--text); }

/* Badges de liderazgo */
.badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  min-height: 28px;
}
.leader-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: var(--radius-full);
}
.leader-badge.blue  { background: var(--lblue);  color: var(--blue); border: 1px solid rgba(37,99,235,0.3); }
.leader-badge.amber { background: var(--lgold);  color: var(--gold); border: 1px solid rgba(217,119,6,0.3); }
.leader-badge.teal  { background: rgba(20,184,166,0.12); color: #0D9488; border: 1px solid rgba(20,184,166,0.3); }
.leader-badge.green { background: var(--lgreen); color: var(--green); border: 1px solid rgba(16,185,129,0.3); }

/* ── Estado de Cartera (barras bicolor) ── */
.cash-health-box {
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
}
.cash-health-title {
  margin: 0 0 14px 0;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--navy);
  display: flex;
  align-items: center;
  gap: 6px;
}
.cash-bars-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
@media (max-width: 600px) {
  .cash-bars-grid { grid-template-columns: 1fr; }
}
.cash-company-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cash-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.cash-co-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 5px;
}
.cash-pct-labels {
  display: flex;
  gap: 8px;
  font-size: 10.5px;
  font-weight: 600;
}
.pct-green { color: var(--green); }
.pct-gold  { color: var(--gold); }

/* Barra bicolor: carril visible en modo oscuro con var(--border) */
.cash-progress {
  display: flex;
  height: 10px;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--border);
  gap: 1px;
}
.cash-seg {
  height: 100%;
  transition: width 0.4s ease;
  flex-shrink: 0;
}
.cobrado-seg  { background: linear-gradient(90deg, var(--green), #34D399); border-radius: var(--radius-full) 0 0 var(--radius-full); }
.dist-cobrado { background: linear-gradient(90deg, #0D9488, #14B8A6); }
.pendiente-seg { background: linear-gradient(90deg, #F59E0B, var(--gold)); border-radius: 0 var(--radius-full) var(--radius-full) 0; }

.cash-amounts-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 700;
}
.cash-amt-green { color: var(--green); display: flex; align-items: center; gap: 3px; }
.cash-amt-gold  { color: var(--gold);  display: flex; align-items: center; gap: 3px; }

.cash-no-data {
  font-size: 11px;
  color: var(--dgray);
  font-style: italic;
  text-align: center;
  padding: 4px 0;
}
</style>
