<template>
  <div class="kpi-grid">
    <!-- 1. Ventas hoy -->
    <div class="kpi-card-dark kpi-green">
      <div class="kpi-top">
        <div class="kpi-icon-wrap icon-green">
          <i class="ti ti-trending-up"></i>
        </div>
        <span class="kpi-pill pill-green">
          <i class="ti ti-clock-hour-4"></i> Hoy
        </span>
      </div>
      <div class="kpi-label">Ventas hoy</div>
      <div class="kpi-val">{{ fmtUSD(totHoy) }}</div>
      <div class="kpi-sub">
        <span class="sub-badge" :class="nHoy > 0 ? 'sub-active' : 'sub-muted'">
          {{ nHoy === 0 ? 'Sin ventas hoy' : nHoy + (nHoy === 1 ? ' factura' : ' facturas') }}
        </span>
      </div>
    </div>

    <!-- 2. Ventas del período -->
    <div class="kpi-card-dark kpi-blue">
      <div class="kpi-top">
        <div class="kpi-icon-wrap icon-blue">
          <i class="ti ti-calendar"></i>
        </div>
        <span class="kpi-pill pill-blue">
          {{ origenEtiqueta }}
        </span>
      </div>
      <div class="kpi-label">{{ rango === 'mes' ? 'Ventas este mes' : 'Ventas del período' }}</div>
      <div class="kpi-val">{{ fmtUSD(kpisPeriodo.totalVenta || 0) }}</div>
      <div class="kpi-sub">
        <span class="sub-badge" :class="(kpisPeriodo.nFacts || 0) > 0 ? 'sub-active' : 'sub-muted'">
          {{ (kpisPeriodo.nFacts || 0) === 0
            ? 'Sin ventas registradas'
            : (kpisPeriodo.nFacts || 0) + ((kpisPeriodo.nFacts || 0) === 1 ? ' factura' : ' facturas') }}
        </span>
      </div>
    </div>

    <!-- 3. Margen del catálogo -->
    <div class="kpi-card-dark kpi-gold">
      <div class="kpi-top">
        <div class="kpi-icon-wrap icon-gold">
          <i class="ti ti-percentage"></i>
        </div>
        <span class="kpi-pill pill-gold">
          Teórico
        </span>
      </div>
      <div class="kpi-label">Margen del catálogo</div>
      <div class="kpi-val">{{ margenCatalogo == null ? '0%' : margenCatalogo.toFixed(1) + '%' }}</div>
      <div class="kpi-sub">
        <span class="sub-muted">Todo a precio de lista</span>
      </div>
    </div>

    <!-- 4. Stock crítico -->
    <div class="kpi-card-dark kpi-red">
      <div class="kpi-top">
        <div class="kpi-icon-wrap icon-red">
          <i class="ti ti-package"></i>
        </div>
        <span class="kpi-pill pill-red">
          {{ stockCritico.agotados || 0 }} agotados
        </span>
      </div>
      <div class="kpi-label">Stock crítico</div>
      <div class="kpi-val">{{ stockCritico.bajos || 0 }} <span class="val-unit">ítems</span></div>
      <div class="kpi-sub">
        <span class="sub-muted">Umbral ≤ {{ stockCritico.umbral || 10 }} ud · {{ totalProductos }} productos</span>
      </div>
    </div>

    <!-- 5. Utilidad bruta -->
    <div class="kpi-card-dark kpi-green">
      <div class="kpi-top">
        <div class="kpi-icon-wrap icon-green">
          <i class="ti ti-coin"></i>
        </div>
        <span class="kpi-pill pill-green">
          Ganancia
        </span>
      </div>
      <div class="kpi-label">{{ rango === 'mes' ? 'Utilidad bruta del mes' : 'Utilidad bruta del período' }}</div>
      <div class="kpi-val">{{ kpisPeriodo.utilVal || '$0,00' }}</div>
      <div class="kpi-sub">
        <span class="sub-muted">{{ kpisPeriodo.utilSub || 'Sin datos' }}</span>
      </div>
    </div>

    <!-- 6. Margen real vendido -->
    <div class="kpi-card-dark kpi-gold">
      <div class="kpi-top">
        <div class="kpi-icon-wrap icon-gold">
          <i class="ti ti-chart-pie"></i>
        </div>
        <span class="kpi-pill pill-gold">
          Real
        </span>
      </div>
      <div class="kpi-label">{{ rango === 'mes' ? 'Margen real vendido' : 'Margen real del período' }}</div>
      <div class="kpi-val">{{ kpisPeriodo.margenVal || '0%' }}</div>
      <div class="kpi-sub">
        <span class="sub-muted">{{ kpisPeriodo.margenSub || 'Sobre lo efectivamente vendido' }}</span>
      </div>
    </div>

    <!-- 7. Punto de equilibrio -->
    <div class="kpi-card-dark kpi-blue">
      <div class="kpi-top">
        <div class="kpi-icon-wrap icon-blue">
          <i class="ti ti-scale"></i>
        </div>
        <span class="kpi-pill pill-blue">
          Equilibrio
        </span>
      </div>
      <div class="kpi-label">Punto de equilibrio</div>
      <div class="kpi-val">{{ kpisPeriodo.peVal || '$0,00' }}</div>
      <div class="kpi-sub">
        <span class="sub-muted">{{ kpisPeriodo.peSub || 'Configura los costos fijos' }}</span>
      </div>
    </div>

    <!-- 8. Costos fijos -->
    <div class="kpi-card-dark kpi-red">
      <div class="kpi-top">
        <div class="kpi-icon-wrap icon-red">
          <i class="ti ti-building-store"></i>
        </div>
        <span class="kpi-pill pill-red">
          Estructura
        </span>
      </div>
      <div class="kpi-label">{{ rango === 'mes' ? 'Costos fijos del mes' : 'Costos fijos del período' }}</div>
      <div class="kpi-val">{{ fmtUSD(kpisPeriodo.cf || 0) }}</div>
      <div class="kpi-sub">
        <span class="sub-muted">{{ kpisPeriodo.cfSub || 'Sin datos' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { fmtUSD } from '../../services/pricing.js';

defineProps({
  rango: {
    type: String,
    default: 'mes'
  },
  origenEtiqueta: {
    type: String,
    default: 'este mes'
  },
  totHoy: {
    type: Number,
    default: 0
  },
  nHoy: {
    type: Number,
    default: 0
  },
  kpisPeriodo: {
    type: Object,
    default: () => ({
      totalVenta: 0,
      nFacts: 0,
      cf: 0,
      cfSub: '',
      utilVal: '$0,00',
      utilSub: '',
      margenVal: '0%',
      margenSub: '',
      peVal: '$0,00',
      peSub: ''
    })
  },
  margenCatalogo: {
    type: Number,
    default: null
  },
  stockCritico: {
    type: Object,
    default: () => ({ bajos: 0, umbral: 10, agotados: 0 })
  },
  totalProductos: {
    type: Number,
    default: 0
  }
});
</script>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(235px, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

/* Tarjeta KPI usando variables del sistema */
.kpi-card-dark {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px 18px;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color var(--trans-fast), box-shadow var(--trans-fast);
  display: flex;
  flex-direction: column;
}

.kpi-card-dark:hover {
  transform: translateY(-2px);
  border-color: var(--border);
  box-shadow: var(--shadow-md);
}

/* Header de la tarjeta */
.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.kpi-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.icon-green {
  background: var(--lgreen);
  color: var(--green);
  border: 1px solid var(--green);
  opacity: 0.9;
}

.icon-blue {
  background: var(--lblue);
  color: var(--blue);
  border: 1px solid var(--blue);
}

.icon-gold {
  background: var(--lgold);
  color: var(--gold);
  border: 1px solid var(--gold);
}

.icon-red {
  background: var(--lred);
  color: var(--red);
  border: 1px solid var(--red);
}

/* Badges en formato píldora */
.kpi-pill {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: capitalize;
  letter-spacing: 0.02em;
  padding: 3px 9px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.pill-green {
  background: var(--lgreen);
  color: var(--green);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.pill-blue {
  background: var(--lblue);
  color: var(--blue);
  border: 1px solid rgba(37, 99, 235, 0.3);
}

.pill-gold {
  background: var(--lgold);
  color: var(--gold);
  border: 1px solid rgba(217, 119, 6, 0.3);
}

.pill-red {
  background: var(--lred);
  color: var(--red);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* Label de métrica */
.kpi-label {
  font-size: 11.5px;
  color: var(--dgray);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

/* Monto grande bien resaltado */
.kpi-val {
  font-size: 26px;
  font-weight: 800;
  color: var(--text);
  line-height: 1.15;
  letter-spacing: -0.03em;
  margin-bottom: 6px;
}

.val-unit {
  font-size: 14px;
  font-weight: 600;
  color: var(--dgray);
}

/* Subtítulos compactos */
.kpi-sub {
  font-size: 11px;
  margin-top: auto;
  min-height: 18px;
  display: flex;
  align-items: center;
}

.sub-badge {
  font-weight: 600;
}

.sub-active {
  color: var(--text);
}

.sub-muted {
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
