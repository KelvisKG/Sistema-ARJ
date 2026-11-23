<template>
  <div class="sales-chart-card">
    <div class="chart-header">
      <div class="chart-header-left">
        <div class="chart-icon-wrap">
          <i class="ti ti-chart-dots-3"></i>
        </div>
        <div>
          <h4 class="chart-title">Dinámica Diaria de Facturación</h4>
          <span class="chart-subtitle">Curva de ventas día a día durante {{ etiqueta }}</span>
        </div>
      </div>
      <div class="chart-stats-pill">
        <span>Promedio diario: <strong>{{ fmtUSD(promedioDiario) }}</strong></span>
        <span v-if="diaPico.total > 0" class="peak-badge">
          <i class="ti ti-flame"></i> Pico: Día {{ diaPico.dia }} ({{ fmtUSD(diaPico.total) }})
        </span>
      </div>
    </div>

    <!-- Contenedor del Gráfico SVG Interactivo -->
    <div v-if="diasData.length === 0 || maxVenta === 0" class="chart-empty">
      <i class="ti ti-chart-line" style="font-size:28px;opacity:0.4;margin-bottom:6px"></i>
      <div>No hay historial de ventas en este período para graficar</div>
    </div>

    <div v-else class="chart-svg-container">
      <!-- Tooltip interactivo flotante -->
      <div
        v-if="hoverDay != null"
        class="chart-tooltip"
        :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }"
      >
        <div class="tooltip-title">Día {{ hoverDay.dia }}</div>
        <div class="tooltip-val">{{ fmtUSD(hoverDay.total) }}</div>
        <div class="tooltip-sub">{{ hoverDay.count }} factura{{ hoverDay.count !== 1 ? 's' : '' }}</div>
      </div>

      <!-- Gráfico SVG de barras y línea promedio -->
      <svg class="chart-svg" viewBox="0 0 600 140" preserveAspectRatio="none">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#2563EB" stop-opacity="0.25" />
          </linearGradient>
          <linearGradient id="peakGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#34D399" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#10B981" stop-opacity="0.3" />
          </linearGradient>
        </defs>

        <!-- Línea horizontal de promedio diario -->
        <line
          v-if="promedioDiario > 0 && maxVenta > 0"
          x1="20"
          :y1="120 - (promedioDiario / maxVenta) * 100"
          x2="580"
          :y2="120 - (promedioDiario / maxVenta) * 100"
          stroke="rgba(245, 158, 11, 0.45)"
          stroke-dasharray="4,4"
          stroke-width="1.5"
        />

        <!-- Barras de cada día del mes -->
        <g v-for="(d, i) in diasData" :key="d.dia">
          <!-- Área de interacción transparente ancha para capturar mouse -->
          <rect
            :x="20 + i * colWidth"
            y="10"
            :width="colWidth"
            height="115"
            fill="transparent"
            class="interactive-col"
            @mouseenter="onHover(d, $event)"
            @mouseleave="hoverDay = null"
          />

          <!-- Barra visible -->
          <rect
            :x="20 + i * colWidth + Math.max(1, colWidth * 0.15)"
            :y="120 - Math.max(d.total > 0 ? 4 : 1, (d.total / (maxVenta || 1)) * 105)"
            :width="Math.max(2, colWidth * 0.7)"
            :height="Math.max(d.total > 0 ? 4 : 1, (d.total / (maxVenta || 1)) * 105)"
            :rx="Math.max(1, colWidth * 0.2)"
            :fill="d.dia === diaPico.dia && d.total > 0 ? 'url(#peakGrad)' : 'url(#barGrad)'"
            :class="['bar-node', { 'active-bar': hoverDay && hoverDay.dia === d.dia }]"
          />
        </g>
      </svg>

      <!-- Eje X con etiquetas de días -->
      <div class="chart-x-axis">
        <span>Día 1</span>
        <span>Día 5</span>
        <span>Día 10</span>
        <span>Día 15</span>
        <span>Día 20</span>
        <span>Día 25</span>
        <span>Día {{ diasData.length }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { fmtUSD } from '../../services/pricing.js';

const props = defineProps({
  facturas: {
    type: Array,
    default: () => []
  },
  etiqueta: {
    type: String,
    default: 'este mes'
  }
});

const hoverDay = ref(null);
const tooltipPos = ref({ x: 0, y: 0 });

function onHover(day, event) {
  hoverDay.value = day;
  const rect = event.currentTarget.getBoundingClientRect();
  const parent = event.currentTarget.closest('.chart-svg-container').getBoundingClientRect();
  tooltipPos.value = {
    x: Math.min(Math.max(rect.left - parent.left - 40, 10), parent.width - 110),
    y: Math.max(10, rect.top - parent.top - 55)
  };
}

// Determinar el número de días del mes en curso
const numDias = computed(() => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
});

// Agrupar facturas por día del mes
const diasData = computed(() => {
  const totalDias = numDias.value;
  const res = [];
  const map = {};

  (props.facturas || []).forEach(f => {
    if (!f.fecha_raw || f.estado === 'anulada') return;
    const d = new Date(f.fecha_raw);
    const dayNum = d.getDate();
    if (!map[dayNum]) map[dayNum] = { total: 0, count: 0 };
    map[dayNum].total += (f.total || 0);
    map[dayNum].count++;
  });

  for (let i = 1; i <= totalDias; i++) {
    res.push({
      dia: i,
      total: map[i] ? map[i].total : 0,
      count: map[i] ? map[i].count : 0
    });
  }
  return res;
});

const maxVenta = computed(() => {
  return Math.max(...diasData.value.map(d => d.total), 0);
});

const colWidth = computed(() => {
  const n = diasData.value.length || 1;
  return 560 / n;
});

const promedioDiario = computed(() => {
  const total = diasData.value.reduce((acc, d) => acc + d.total, 0);
  const diasConVenta = diasData.value.filter(d => d.total > 0).length || 1;
  return total / diasConVenta;
});

const diaPico = computed(() => {
  let peak = { dia: 1, total: 0 };
  diasData.value.forEach(d => {
    if (d.total > peak.total) peak = d;
  });
  return peak;
});
</script>

<style scoped>
.sales-chart-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 18px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.chart-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chart-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--lblue);
  color: var(--blue);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.chart-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--navy);
}

.chart-subtitle {
  font-size: 11px;
  color: var(--dgray);
}

.chart-stats-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--dgray);
}

.peak-badge {
  background: var(--lgreen);
  color: var(--green);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.chart-empty {
  padding: 30px;
  text-align: center;
  color: var(--dgray);
  font-size: 12.5px;
}

.chart-svg-container {
  position: relative;
  width: 100%;
}

.chart-svg {
  width: 100%;
  height: 120px;
  display: block;
}

.interactive-col {
  cursor: pointer;
}

.bar-node {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.bar-node.active-bar {
  filter: brightness(1.25);
  stroke: #FFF;
  stroke-width: 1px;
}

.chart-tooltip {
  position: absolute;
  pointer-events: none;
  background: var(--navy);
  color: #FFF;
  padding: 6px 10px;
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  font-size: 11px;
  z-index: 10;
  text-align: center;
  white-space: nowrap;
  animation: fadeIn 0.15s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.tooltip-title {
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 700;
}
.tooltip-val {
  font-size: 13px;
  font-weight: 800;
  color: #34D399;
}
.tooltip-sub {
  font-size: 9.5px;
  color: rgba(255, 255, 255, 0.6);
}

.chart-x-axis {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--dgray);
  padding: 4px 20px 0 20px;
  border-top: 1px solid var(--border);
  margin-top: 4px;
}
</style>
