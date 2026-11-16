<template>
  <div class="kpi-grid">
    <!-- 1. Ventas hoy -->
    <div class="kpi-card green">
      <div class="kpi-icon"><i class="ti ti-trending-up"></i></div>
      <div class="kpi-label">Ventas hoy</div>
      <div class="kpi-val">{{ fmtUSD(totHoy) }}</div>
      <div class="kpi-sub" style="color:var(--dgray);font-weight:600">
        {{ nHoy === 0 ? 'Sin ventas hoy' : nHoy + (nHoy === 1 ? ' factura' : ' facturas') }}
      </div>
    </div>

    <!-- 2. Ventas del período -->
    <div class="kpi-card blue">
      <div class="kpi-icon"><i class="ti ti-calendar"></i></div>
      <div class="kpi-label">{{ rango === 'mes' ? 'Ventas este mes' : 'Ventas del período' }}</div>
      <div class="kpi-val">{{ fmtUSD(kpisPeriodo.totalVenta || 0) }}</div>
      <div class="kpi-sub" style="color:var(--dgray);font-weight:600">
        {{ (kpisPeriodo.nFacts || 0) === 0
          ? 'Sin ventas en ' + origenEtiqueta
          : (kpisPeriodo.nFacts || 0) + ((kpisPeriodo.nFacts || 0) === 1 ? ' factura' : ' facturas') + ' · ' + origenEtiqueta }}
      </div>
    </div>

    <!-- 3. Margen del catálogo -->
    <div class="kpi-card gold">
      <div class="kpi-icon"><i class="ti ti-percentage"></i></div>
      <div class="kpi-label">Margen del catálogo</div>
      <div class="kpi-val">{{ margenCatalogo == null ? '0%' : margenCatalogo.toFixed(1) + '%' }}</div>
      <div class="kpi-sub" style="color:var(--dgray);font-weight:600">
        {{ margenCatalogo == null ? 'Sin datos aún' : 'Teórico — todo a precio de lista' }}
      </div>
    </div>

    <!-- 4. Stock crítico -->
    <div class="kpi-card red">
      <div class="kpi-icon"><i class="ti ti-package"></i></div>
      <div class="kpi-label">Stock crítico</div>
      <div class="kpi-val">{{ stockCritico.bajos || 0 }}</div>
      <div class="kpi-sub">
        1 a {{ stockCritico.umbral || 10 }} ud · {{ stockCritico.agotados || 0 }} agotados de {{ totalProductos }}
      </div>
    </div>

    <!-- 5. Utilidad bruta -->
    <div class="kpi-card green">
      <div class="kpi-icon"><i class="ti ti-coin"></i></div>
      <div class="kpi-label">{{ rango === 'mes' ? 'Utilidad bruta del mes' : 'Utilidad bruta del período' }}</div>
      <div class="kpi-val">{{ kpisPeriodo.utilVal || '$0,00' }}</div>
      <div class="kpi-sub" style="color:var(--dgray);font-weight:600">{{ kpisPeriodo.utilSub || 'Sin datos' }}</div>
    </div>

    <!-- 6. Margen real vendido -->
    <div class="kpi-card gold">
      <div class="kpi-icon"><i class="ti ti-percentage"></i></div>
      <div class="kpi-label">{{ rango === 'mes' ? 'Margen real vendido' : 'Margen real del período' }}</div>
      <div class="kpi-val">{{ kpisPeriodo.margenVal || '0%' }}</div>
      <div class="kpi-sub" style="color:var(--dgray);font-weight:600">{{ kpisPeriodo.margenSub || 'Sin datos' }}</div>
    </div>

    <!-- 7. Punto de equilibrio -->
    <div class="kpi-card blue">
      <div class="kpi-icon"><i class="ti ti-scale"></i></div>
      <div class="kpi-label">Punto de equilibrio</div>
      <div class="kpi-val">{{ kpisPeriodo.peVal || '$0,00' }}</div>
      <div class="kpi-sub" style="color:var(--dgray);font-weight:600">{{ kpisPeriodo.peSub || 'Configura los costos fijos' }}</div>
    </div>

    <!-- 8. Costos fijos -->
    <div class="kpi-card red">
      <div class="kpi-icon"><i class="ti ti-building-store"></i></div>
      <div class="kpi-label">{{ rango === 'mes' ? 'Costos fijos del mes' : 'Costos fijos del período' }}</div>
      <div class="kpi-val">{{ fmtUSD(kpisPeriodo.cf || 0) }}</div>
      <div class="kpi-sub" style="color:var(--dgray);font-weight:600">{{ kpisPeriodo.cfSub || 'Sin datos' }}</div>
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
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
</style>
