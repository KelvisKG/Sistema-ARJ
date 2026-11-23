<template>
  <div class="sales-chart-card">
    <div class="chart-header">
      <div class="chart-header-left">
        <div class="chart-icon-wrap">
          <i class="ti ti-chart-dots-3"></i>
        </div>
        <div>
          <h4 class="chart-title">Dinámica de Facturación</h4>
          <span class="chart-subtitle">{{ subtituloDinamica }}</span>
        </div>
      </div>
      <div class="chart-controls-and-stats">
        <!-- Selector de resolución (día / semana) cuando el rango lo amerita -->
        <div v-if="permiteAlternarModo" class="chart-mode-toggle no-print">
          <button
            type="button"
            :class="['mode-toggle-btn', { active: modoVista === 'dia' }]"
            @click="modoVista = 'dia'"
          >
            Día a día
          </button>
          <button
            type="button"
            :class="['mode-toggle-btn', { active: modoVista === 'semana' }]"
            @click="modoVista = 'semana'"
          >
            Por semana
          </button>
        </div>

        <div class="chart-stats-pill">
          <span>{{ etiquetaPromedio }}: <strong>{{ fmtUSD(promedioCalculado) }}</strong></span>
          <span v-if="diaPico.total > 0" class="peak-badge" :title="'Mayor venta: ' + diaPico.tooltipLabel">
            <i class="ti ti-flame"></i> Pico: {{ diaPico.label }} ({{ fmtUSD(diaPico.total) }})
          </span>
          <span class="total-facts-badge">
            {{ totalFacturas }} fact{{ totalFacturas !== 1 ? 's' : '' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Contenedor del Gráfico SVG Interactivo -->
    <div v-if="buckets.length === 0 || maxVenta === 0" class="chart-empty">
      <i class="ti ti-chart-line" style="font-size:28px;opacity:0.4;margin-bottom:6px"></i>
      <div>No hay historial de facturación en {{ etiqueta }} para graficar</div>
    </div>

    <div v-else class="chart-svg-container">
      <!-- Tooltip interactivo flotante -->
      <div
        v-if="hoverBucket != null"
        class="chart-tooltip"
        :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }"
      >
        <div class="tooltip-title">{{ hoverBucket.tooltipLabel || hoverBucket.label }}</div>
        <div class="tooltip-val">{{ fmtUSD(hoverBucket.total) }}</div>
        <div class="tooltip-sub">{{ hoverBucket.count }} factura{{ hoverBucket.count !== 1 ? 's' : '' }}</div>
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

        <!-- Línea horizontal de promedio -->
        <line
          v-if="promedioCalculado > 0 && maxVenta > 0"
          x1="20"
          :y1="Math.max(15, 120 - (promedioCalculado / maxVenta) * 100)"
          x2="580"
          :y2="Math.max(15, 120 - (promedioCalculado / maxVenta) * 100)"
          stroke="rgba(245, 158, 11, 0.45)"
          stroke-dasharray="4,4"
          stroke-width="1.5"
        />

        <!-- Barras del período -->
        <g v-for="(b, i) in buckets" :key="b.key || i">
          <!-- Área de interacción transparente ancha para capturar mouse/touch -->
          <rect
            :x="20 + i * colWidth"
            y="10"
            :width="colWidth"
            height="115"
            fill="transparent"
            class="interactive-col"
            @mouseenter="onHover(b, $event)"
            @mouseleave="hoverBucket = null"
          />

          <!-- Barra visible -->
          <rect
            :x="20 + i * colWidth + Math.max(1, colWidth * 0.15)"
            :y="120 - Math.max(b.total > 0 ? 4 : 1, (b.total / (maxVenta || 1)) * 105)"
            :width="Math.max(2, colWidth * 0.7)"
            :height="Math.max(b.total > 0 ? 4 : 1, (b.total / (maxVenta || 1)) * 105)"
            :rx="Math.max(1, colWidth * 0.18)"
            :fill="b.key === diaPico.key && b.total > 0 ? 'url(#peakGrad)' : 'url(#barGrad)'"
            :class="['bar-node', { 'active-bar': hoverBucket && hoverBucket.key === b.key }]"
          />
        </g>
      </svg>

      <!-- Eje X con etiquetas distribuidas proporcionalmente -->
      <div class="chart-x-axis">
        <span v-for="tag in etiquetasEjeX" :key="tag">{{ tag }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { fmtUSD } from '../../services/pricing.js';

const props = defineProps({
  facturas: {
    type: Array,
    default: () => []
  },
  etiqueta: {
    type: String,
    default: 'este mes'
  },
  rango: {
    type: String,
    default: 'mes'
  },
  desde: {
    type: String,
    default: ''
  },
  hastaExcl: {
    type: String,
    default: ''
  }
});

const mesesCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const mesesLargos = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function fISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Determinar modo inicial de visualización según el rango
const modoVista = ref('dia');

// Si el período cambia, adaptar modo por defecto
watch(() => props.rango, nuevoRango => {
  if (nuevoRango === '3m') {
    modoVista.value = 'semana';
  } else if (['6m', '12m', 'anio', 'todo'].includes(nuevoRango)) {
    modoVista.value = 'mes';
  } else {
    modoVista.value = 'dia';
  }
}, { immediate: true });

const permiteAlternarModo = computed(() => {
  return props.rango === '3m' || (props.rango === 'custom' && totalDiasRango.value >= 30 && totalDiasRango.value <= 100);
});

const subtituloDinamica = computed(() => {
  if (modoVista.value === 'mes') return `Evolución mensual de facturación durante ${props.etiqueta}`;
  if (modoVista.value === 'semana') return `Evolución semanal de facturación durante ${props.etiqueta}`;
  return `Curva de ventas día a día durante ${props.etiqueta}`;
});

const etiquetaPromedio = computed(() => {
  if (modoVista.value === 'mes') return 'Promedio mensual';
  if (modoVista.value === 'semana') return 'Promedio semanal';
  return 'Promedio diario';
});

const hoverBucket = ref(null);
const tooltipPos = ref({ x: 0, y: 0 });

function onHover(bucket, event) {
  hoverBucket.value = bucket;
  const rect = event.currentTarget.getBoundingClientRect();
  const parent = event.currentTarget.closest('.chart-svg-container').getBoundingClientRect();
  tooltipPos.value = {
    x: Math.min(Math.max(rect.left - parent.left - 40, 10), parent.width - 120),
    y: Math.max(10, rect.top - parent.top - 55)
  };
}

// Fechas límites del rango activo
const limitesRango = computed(() => {
  const hoy = new Date();
  if (props.desde && props.hastaExcl) {
    return {
      dIni: new Date(props.desde + 'T00:00:00'),
      dFin: new Date(props.hastaExcl + 'T00:00:00')
    };
  }
  // Fallback: mes actual
  const dIni = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const dFin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  return { dIni, dFin };
});

const totalDiasRango = computed(() => {
  const { dIni, dFin } = limitesRango.value;
  return Math.max(1, Math.round((dFin.getTime() - dIni.getTime()) / 86400000));
});

// Facturas filtradas que pertenecen al rango
const facturasValidas = computed(() => {
  return (props.facturas || []).filter(f => {
    if (!f.fecha_raw && !f.fecha) return false;
    if (f.estado === 'anulada') return false;
    return true;
  });
});

// Generar cubos (buckets) según modoVista
const buckets = computed(() => {
  const facts = facturasValidas.value;
  const { dIni, dFin } = limitesRango.value;

  // 1. MODO MENSUAL (> 100 días / 6m / 12m / anio)
  if (modoVista.value === 'mes') {
    const list = [];
    const cur = new Date(dIni.getFullYear(), dIni.getMonth(), 1);
    const end = new Date(dFin.getFullYear(), dFin.getMonth(), 1);

    while (cur <= end) {
      const año = cur.getFullYear();
      const mes = cur.getMonth();
      const key = `${año}-${String(mes + 1).padStart(2, '0')}`;
      list.push({
        key,
        label: mesesCortos[mes] + (dIni.getFullYear() !== dFin.getFullYear() ? ` '${String(año).slice(2)}` : ''),
        tooltipLabel: `${mesesLargos[mes]} ${año}`,
        total: 0,
        count: 0
      });
      cur.setMonth(cur.getMonth() + 1);
    }

    const map = new Map(list.map(b => [b.key, b]));
    facts.forEach(f => {
      const fch = String(f.fecha_raw || f.fecha || '').slice(0, 7);
      if (map.has(fch)) {
        const b = map.get(fch);
        b.total += (parseFloat(f.total) || 0);
        b.count++;
      }
    });

    return list;
  }

  // 2. MODO SEMANAL (~90 días / 3m)
  if (modoVista.value === 'semana') {
    const list = [];
    let cur = new Date(dIni.getTime());
    let semNum = 1;

    while (cur < dFin) {
      const finSem = new Date(Math.min(dFin.getTime(), cur.getTime() + 7 * 86400000));
      const key = fISO(cur);
      const finMostrada = new Date(finSem.getTime() - (finSem.getTime() > cur.getTime() ? 86400000 : 0));
      list.push({
        key,
        desdeISO: fISO(cur),
        hastaExclISO: fISO(finSem),
        label: `Sem ${semNum}`,
        tooltipLabel: `Semana ${semNum} (${cur.getDate()} ${mesesCortos[cur.getMonth()]} - ${finMostrada.getDate()} ${mesesCortos[finMostrada.getMonth()]})`,
        total: 0,
        count: 0
      });
      cur = new Date(finSem.getTime());
      semNum++;
    }

    facts.forEach(f => {
      const fch = String(f.fecha_raw || f.fecha || '').slice(0, 10);
      const b = list.find(s => fch >= s.desdeISO && fch < s.hastaExclISO);
      if (b) {
        b.total += (parseFloat(f.total) || 0);
        b.count++;
      }
    });

    return list;
  }

  // 3. MODO DIARIO (por defecto para mes, mes pasado o períodos cortos)
  const list = [];
  let cur = new Date(dIni.getTime());

  while (cur < dFin) {
    const key = fISO(cur);
    const diaNum = cur.getDate();
    list.push({
      key,
      dia: diaNum,
      fecha: key,
      label: `${diaNum} ${mesesCortos[cur.getMonth()]}`,
      tooltipLabel: `${diaNum} de ${mesesLargos[cur.getMonth()]} ${cur.getFullYear()}`,
      total: 0,
      count: 0
    });
    cur.setDate(cur.getDate() + 1);
  }

  const map = new Map(list.map(b => [b.key, b]));
  facts.forEach(f => {
    const fch = String(f.fecha_raw || f.fecha || '').slice(0, 10);
    if (map.has(fch)) {
      const b = map.get(fch);
      b.total += (parseFloat(f.total) || 0);
      b.count++;
    }
  });

  return list;
});

const maxVenta = computed(() => {
  return Math.max(...buckets.value.map(d => d.total), 0);
});

const totalFacturado = computed(() => {
  return buckets.value.reduce((acc, d) => acc + d.total, 0);
});

const totalFacturas = computed(() => {
  return buckets.value.reduce((acc, d) => acc + d.count, 0);
});

const colWidth = computed(() => {
  const n = buckets.value.length || 1;
  return 560 / n;
});

const promedioCalculado = computed(() => {
  const total = totalFacturado.value;
  const n = buckets.value.length;
  if (n === 0) return 0;
  return total / n;
});

const diaPico = computed(() => {
  let peak = { key: '', label: 'Sin datos', tooltipLabel: '', total: 0 };
  buckets.value.forEach(d => {
    if (d.total > peak.total) peak = d;
  });
  return peak;
});

// Etiquetas para el eje X distribuidas armoniosamente
const etiquetasEjeX = computed(() => {
  const b = buckets.value;
  if (!b.length) return [];
  if (b.length <= 8) return b.map(x => x.label);

  const res = [];
  const paso = (b.length - 1) / 5;
  for (let i = 0; i < 6; i++) {
    const idx = Math.min(b.length - 1, Math.round(i * paso));
    if (!res.includes(b[idx].label)) {
      res.push(b[idx].label);
    }
  }
  return res;
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

.chart-controls-and-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.chart-mode-toggle {
  display: flex;
  background: var(--gray);
  padding: 2px;
  border-radius: var(--radius-sm);
  gap: 2px;
}

.mode-toggle-btn {
  border: none;
  background: transparent;
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 600;
  color: var(--dgray);
  border-radius: 4px;
  cursor: pointer;
  transition: all var(--trans-fast);
}

.mode-toggle-btn.active {
  background: var(--card-bg);
  color: var(--blue);
  box-shadow: var(--shadow-xs);
}

.chart-stats-pill {
  display: flex;
  align-items: center;
  gap: 8px;
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

.total-facts-badge {
  background: var(--gray);
  color: var(--text);
  padding: 2px 7px;
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 11px;
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

@media (max-width: 768px) {
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .chart-controls-and-stats {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
