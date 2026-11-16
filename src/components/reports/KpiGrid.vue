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

/* Tarjeta estilo analítico de alta gama con fondo oscuro sutil */
.kpi-card-dark {
  background: #0E1726;
  background: linear-gradient(145deg, #101B2E 0%, #0A111E 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 16px 18px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 14px 0 rgba(0, 0, 0, 0.25);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;
}

.kpi-card-dark:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: 0 8px 24px 0 rgba(0, 0, 0, 0.35);
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
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  backdrop-filter: blur(8px);
}

.icon-green {
  background: rgba(16, 185, 129, 0.16);
  color: #10B981;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.icon-blue {
  background: rgba(37, 99, 235, 0.16);
  color: #38BDF8;
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.icon-gold {
  background: rgba(245, 158, 11, 0.16);
  color: #FBBF24;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.icon-red {
  background: rgba(239, 68, 68, 0.16);
  color: #F87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

/* Badges en formato píldora */
.kpi-pill {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: capitalize;
  letter-spacing: 0.02em;
  padding: 3px 9px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.pill-green {
  background: rgba(16, 185, 129, 0.12);
  color: #34D399;
  border: 1px solid rgba(16, 185, 129, 0.22);
}

.pill-blue {
  background: rgba(56, 189, 248, 0.12);
  color: #38BDF8;
  border: 1px solid rgba(56, 189, 248, 0.22);
}

.pill-gold {
  background: rgba(245, 158, 11, 0.12);
  color: #FBBF24;
  border: 1px solid rgba(245, 158, 11, 0.22);
}

.pill-red {
  background: rgba(239, 68, 68, 0.12);
  color: #F87171;
  border: 1px solid rgba(239, 68, 68, 0.22);
}

/* Label de métrica */
.kpi-label {
  font-size: 11.5px;
  color: #94A3B8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

/* Monto grande bien resaltado */
.kpi-val {
  font-size: 26px;
  font-weight: 800;
  color: #F8FAFC;
  line-height: 1.15;
  letter-spacing: -0.03em;
  margin-bottom: 6px;
}

.val-unit {
  font-size: 14px;
  font-weight: 600;
  color: #94A3B8;
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
  color: #CBD5E1;
}

.sub-muted {
  color: #64748B;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
