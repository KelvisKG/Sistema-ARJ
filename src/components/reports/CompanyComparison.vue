<template>
  <div class="company-comparison-card">
    <div class="comp-header">
      <div class="header-left">
        <div class="icon-wrap-blue">
          <i class="ti ti-arrows-left-right"></i>
        </div>
        <div>
          <h3 class="comp-title">Comparativa Corporativa de Empresas</h3>
          <p class="comp-sub">Desempeño cara a cara entre Venta Directa y Distribuidora — {{ etiquetaPeriodo }}</p>
        </div>
      </div>
      <div class="comp-period-pill">
        <i class="ti ti-calendar"></i> {{ etiquetaPeriodo }}
      </div>
    </div>

    <!-- Barra de Distribución Porcentual del Negocio (Cuadro Estadístico) -->
    <div class="share-chart-section">
      <div class="share-header">
        <span class="share-title">Distribución de Ventas Totales: <strong>{{ fmtUSD(totales.corporativo) }}</strong></span>
        <div class="share-legend">
          <span class="legend-dot dot-directa"></span> Venta Directa: <strong>{{ pctDirecta.toFixed(1) }}%</strong>
          <span class="legend-dot dot-dist" style="margin-left:14px"></span> Distribuidora: <strong>{{ pctDist.toFixed(1) }}%</strong>
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

    <!-- Comparativa Cara a Cara en 2 Columnas -->
    <div class="companies-grid">
      <!-- 1. VENTA DIRECTA -->
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
            <span class="m-label"><i class="ti ti-cash"></i> Cobrado efectivamente:</span>
            <span class="m-val font-green">{{ fmtUSD(totales.directa.cobrado) }}</span>
          </div>
          <div class="metric-row">
            <span class="m-label"><i class="ti ti-clock"></i> Por cobrar (créditos):</span>
            <span class="m-val font-gold">{{ fmtUSD(totales.directa.porCobrar) }}</span>
          </div>
        </div>
      </div>

      <!-- 2. DISTRIBUIDORA -->
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
            <span class="m-label"><i class="ti ti-cash"></i> Cobrado efectivamente:</span>
            <span class="m-val font-green">{{ fmtUSD(totales.dist.cobrado) }}</span>
          </div>
          <div class="metric-row">
            <span class="m-label"><i class="ti ti-clock"></i> Por cobrar (créditos):</span>
            <span class="m-val font-gold">{{ fmtUSD(totales.dist.porCobrar) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Comparativa de Cobranza Corporativa (Gráfico de barras apiladas) -->
    <div class="cash-health-box">
      <h5 class="cash-health-title"><i class="ti ti-wallet"></i> Estado de Cartera y Cobranza Corporativa</h5>
      <div class="cash-bars-grid">
        <div class="cash-company-item">
          <div class="cash-item-top">
            <span>Venta Directa</span>
            <span>Cobrado: <strong>{{ ((totales.directa.cobrado / (totales.directa.total || 1)) * 100).toFixed(1) }}%</strong></span>
          </div>
          <div class="cash-progress">
            <div class="cash-bar-paid" :style="{ width: (totales.directa.cobrado / (totales.directa.total || 1) * 100) + '%' }"></div>
          </div>
        </div>
        <div class="cash-company-item">
          <div class="cash-item-top">
            <span>Distribuidora</span>
            <span>Cobrado: <strong>{{ ((totales.dist.cobrado / (totales.dist.total || 1)) * 100).toFixed(1) }}%</strong></span>
          </div>
          <div class="cash-progress">
            <div class="cash-bar-paid dist-color" :style="{ width: (totales.dist.cobrado / (totales.dist.total || 1) * 100) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
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

// Fechas de corte para el mes en curso
const mes0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

const totales = computed(() => {
  const d = { total: 0, nFacts: 0, cobrado: 0, porCobrar: 0, clientes: new Set(), ticketProm: 0 };
  const dist = { total: 0, nFacts: 0, cobrado: 0, porCobrar: 0, clientes: new Set(), ticketProm: 0 };

  const facts = (props.todasFacturas || []).filter(f => f.estado !== 'anulada' && f.fecha_raw && new Date(f.fecha_raw) >= mes0);

  facts.forEach(f => {
    const isDirecta = f.empresa === 'directa';
    const tgt = isDirecta ? d : dist;
    const tot = f.total || 0;
    const saldo = f.saldo_pendiente || 0;
    const pagado = Math.max(0, tot - saldo);
    const cli = f.cliente_nombre_snap || f.cliente || 'Desconocido';

    tgt.total += tot;
    tgt.nFacts++;
    tgt.cobrado += pagado;
    tgt.porCobrar += saldo;
    tgt.clientes.add(cli);
  });

  d.ticketProm = d.nFacts > 0 ? d.total / d.nFacts : 0;
  d.clientesCount = d.clientes.size;

  dist.ticketProm = dist.nFacts > 0 ? dist.total / dist.nFacts : 0;
  dist.clientesCount = dist.clientes.size;

  const corp = d.total + dist.total;

  return {
    directa: d,
    dist,
    corporativo: corp
  };
});

const pctDirecta = computed(() => {
  const corp = totales.value.corporativo;
  return corp > 0 ? (totales.value.directa.total / corp) * 100 : 50;
});

const pctDist = computed(() => {
  const corp = totales.value.corporativo;
  return corp > 0 ? (totales.value.dist.total / corp) * 100 : 50;
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

.comp-period-pill {
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

/* Gráfico de Participación */
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

.share-title {
  color: var(--text);
}

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
.dot-dist { background: var(--amber); }

.share-progress-track {
  display: flex;
  height: 22px;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: rgba(0, 0, 0, 0.08);
}

.share-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #FFF;
  transition: width 0.4s ease;
}
.share-bar.directa { background: linear-gradient(90deg, #2563EB, #3B82F6); }
.share-bar.dist { background: linear-gradient(90deg, #D97706, #F59E0B); }

/* Columnas Cara a Cara */
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
.dist-border { border-top: 3px solid var(--amber); }

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
.dist-header i { color: var(--amber); }

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
.share-pill.blue { background: var(--lblue); color: var(--blue); }
.share-pill.amber { background: var(--lgold); color: var(--gold); }

.company-stat-main {
  margin-bottom: 14px;
}
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

.font-blue { color: var(--blue) !important; }
.font-gold { color: var(--gold) !important; }
.font-green { color: var(--green) !important; }

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
.m-val {
  font-weight: 700;
  color: var(--text);
}

/* Estado de Cartera */
.cash-health-box {
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
}

.cash-health-title {
  margin: 0 0 10px 0;
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
  gap: 16px;
}
@media (max-width: 600px) {
  .cash-bars-grid { grid-template-columns: 1fr; }
}

.cash-company-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cash-item-top {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--dgray);
}

.cash-progress {
  height: 8px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.cash-bar-paid {
  height: 100%;
  background: var(--green);
  border-radius: var(--radius-full);
  transition: width 0.4s ease;
}
.cash-bar-paid.dist-color {
  background: var(--amber);
}
</style>
