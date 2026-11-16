<template>
  <div class="comparison-cards-container">
    <!-- ═══ 1. IMPORTADO vs LOCAL ═══ -->
    <div class="dash-card-dark">
      <div class="dash-card-header">
        <div class="dash-title-wrap">
          <div class="dash-icon-badge blue-glow">
            <i class="ti ti-world"></i>
          </div>
          <div>
            <h3 class="dash-card-title">
              Importado vs Local
            </h3>
            <div class="dash-card-sub">
              Origen de ventas efectivas — {{ (origen.lbl || '').charAt(0).toUpperCase() + (origen.lbl || '').slice(1) }}
            </div>
          </div>
        </div>

        <div v-if="R && R.g.local.venta > 0 && R.g.importado.venta > 0" class="trend-pill-header">
          <span class="kpi-pill" :class="R.g.importado.mg - R.g.local.mg >= 0 ? 'pill-blue' : 'pill-gold'">
            <i class="ti ti-sparkles"></i> Margen {{ R.g.importado.mg - R.g.local.mg >= 0 ? 'Importado' : 'Local' }} +{{ Math.abs(R.g.importado.mg - R.g.local.mg).toFixed(1) }}%
          </span>
        </div>
      </div>

      <div v-if="origen.estado === 'cargando'" class="state-container">
        <i class="ti ti-loader ti-spin"></i> Leyendo datos de {{ origen.etiqueta }}…
      </div>
      <div v-else-if="origen.estado === 'error'" class="state-container error">
        <i class="ti ti-alert-triangle"></i> {{ origen.error }}
      </div>
      <div v-else-if="origen.estado === 'sinconexion'" class="state-container">
        <i class="ti ti-wifi-off"></i> Sin conexión a la base de datos.
      </div>
      <div v-else-if="!origen.data || !origen.data.its || !origen.data.its.length" class="state-container">
        Sin ventas en {{ origen.etiqueta }}.
      </div>
      <template v-else-if="R">
        <!-- Bloques comparativos de origen -->
        <div class="origin-blocks-grid">
          <div
            v-for="b in bloquesOrigen"
            :key="b.key"
            class="origin-block-card"
            :class="b.key === 'importado' ? 'block-importado' : 'block-local'"
          >
            <div class="origin-block-top">
              <span class="origin-type-badge">
                <i :class="'ti ti-' + b.icono"></i> {{ b.nom }}
              </span>
              <span class="kpi-pill pill-neutral">
                {{ calcPc(b.c.venta, R.tot.venta) }} del total
              </span>
            </div>

            <div class="origin-amount-wrap">
              <div class="origin-amount">{{ fmtUSD(b.c.venta) }}</div>
              <div class="origin-details-micro">
                {{ (b.c.uds || 0).toLocaleString('es-VE') }} unidades &middot; {{ b.c.lineas }} renglones
              </div>
            </div>

            <!-- Barra de progreso de participación -->
            <div class="origin-progress-track">
              <div
                class="origin-progress-bar"
                :class="b.key === 'importado' ? 'bar-blue' : 'bar-gold'"
                :style="{ width: (R.tot.venta > 0 ? (b.c.venta / R.tot.venta) * 100 : 0).toFixed(1) + '%' }"
              ></div>
            </div>

            <!-- Métricas financieras del bloque -->
            <div class="origin-stats-row">
              <div class="origin-stat-item">
                <span class="stat-lbl">Costo landed</span>
                <span class="stat-val text-muted">{{ fmtUSD(b.c.costo) }}</span>
              </div>
              <div class="origin-stat-item">
                <span class="stat-lbl">Utilidad</span>
                <span class="stat-val" :class="b.c.util >= 0 ? 'text-green' : 'text-red'">{{ fmtUSD(b.c.util) }}</span>
              </div>
              <div class="origin-stat-item">
                <span class="stat-lbl">Margen</span>
                <span class="stat-val text-highlight">{{ (b.c.mg || 0).toFixed(1) }}%</span>
              </div>
            </div>

            <div class="origin-contribution-note">
              Aporta <strong class="text-white">{{ calcPc(b.c.util, R.tot.util) }}</strong> de la utilidad total
            </div>

            <!-- Desglose de caja: ya en caja vs por cobrar -->
            <div v-if="b.v && (b.v.enMano > 0 || b.v.porCobrar > 0)" class="cash-breakdown-card">
              <div class="cash-row in-hand">
                <span class="cash-tag tag-green">
                  <i class="ti ti-check"></i> Ya en caja
                </span>
                <span class="cash-amount font-green">{{ fmtUSD(b.v.enMano) }}</span>
              </div>
              <div v-if="b.v.efectivo > 0 || b.v.usdt > 0" class="cash-sub-micro">
                {{ [b.v.efectivo > 0 ? fmtUSD(b.v.efectivo) + ' efectivo' : '', b.v.usdt > 0 ? fmtUSD(b.v.usdt) + ' en USDT' : ''].filter(Boolean).join(' · ') }}
              </div>

              <template v-if="b.v.porCobrar > 0">
                <div class="cash-row pending">
                  <span class="cash-tag tag-gold">
                    <i class="ti ti-clock-hour-4"></i> Por cobrar
                  </span>
                  <span class="cash-amount font-gold">{{ fmtUSD(b.v.porCobrar) }}</span>
                </div>
                <div class="cash-sub-micro">
                  Sujeto a variación de brecha cambiaria.
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Alertas de datos (sin origen, sin costo, pendientes) -->
        <div v-if="R.deducidos > 0 || R.sinCosto > 0 || (R.VR && R.VR.nPend > 0)" class="alerts-stack">
          <div v-if="R.deducidos > 0" class="alert-pill-item alert-warning">
            <i class="ti ti-alert-triangle"></i>
            <span><strong>{{ R.deducidos }} renglones</strong> sin origen guardado (clasificados por factor).</span>
          </div>
          <div v-if="R.sinCosto > 0" class="alert-pill-item alert-danger">
            <i class="ti ti-alert-circle"></i>
            <span><strong>{{ R.sinCosto }} renglones</strong> sin costo registrado (margen inflado).</span>
          </div>
          <div v-if="R.VR && R.VR.nPend > 0" class="alert-pill-item alert-info">
            <i class="ti ti-receipt-refund"></i>
            <span><strong>{{ R.VR.nPend }} facturas</strong> con saldo pendiente por cobrar.</span>
          </div>
        </div>

        <!-- Barra de herramientas de análisis -->
        <div class="origin-actions-bar">
          <button class="btn-dark-action" @click="$emit('toggle-detalle')">
            <i class="ti ti-list-search"></i>
            <span>{{ detalleAbierto ? 'Ocultar desglose detallado' : 'Ver productos de este período' }}</span>
          </button>
          <button class="btn-dark-secondary" @click="$emit('descargar-csv')">
            <i class="ti ti-download"></i>
            <span>Exportar CSV</span>
          </button>
        </div>
      </template>

      <!-- Tabla desplegable de productos por origen -->
      <div v-if="detalleAbierto" class="origin-table-section">
        <div v-if="!origen.data || !origen.data.its.length" class="state-container">
          Escoge un período con ventas y vuelve a abrir el detalle.
        </div>
        <template v-else>
          <div v-for="t in tablasDetalle" :key="t.key" class="table-group-card">
            <div class="table-group-header" :class="t.key === 'importado' ? 'header-blue' : 'header-gold'">
              <div class="table-group-title">
                <i :class="'ti ti-' + t.icono"></i> {{ t.titulo }}
              </div>
              <div class="table-group-summary">
                <span class="summary-pill">{{ t.lista.length }} productos</span>
                <span class="summary-pill">{{ fmtUSD(t.tV) }} $BCV</span>
                <span class="summary-pill font-green">≈ {{ fmtUSD(t.tW) }} verde</span>
              </div>
            </div>

            <div class="table-responsive-wrap">
              <table class="dark-data-table">
                <thead>
                  <tr>
                    <th style="text-align:left">Código</th>
                    <th style="text-align:left">Descripción</th>
                    <th style="text-align:right">Uds</th>
                    <th style="text-align:right">Venta $BCV</th>
                    <th style="text-align:right">$Verde Facturado</th>
                    <th style="text-align:right">Costo</th>
                    <th style="text-align:right">Utilidad</th>
                    <th style="text-align:right">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in t.lista.slice(0, 60)" :key="p.cod + p.desc">
                    <td class="code-cell">{{ p.cod }}</td>
                    <td class="desc-cell">{{ p.desc }}</td>
                    <td style="text-align:right">{{ (p.uds || 0).toLocaleString('es-VE') }}</td>
                    <td style="text-align:right;font-weight:600;color:#F8FAFC">{{ fmtUSD(p.venta) }}</td>
                    <td style="text-align:right;color:#34D399;font-weight:600">{{ p.sinTasa ? '—' : fmtUSD(p.verde) }}</td>
                    <td style="text-align:right;color:#94A3B8">{{ fmtUSD(p.costo) }}</td>
                    <td style="text-align:right;font-weight:600" :class="p.venta - p.costo >= 0 ? 'text-green' : 'text-red'">
                      {{ fmtUSD(p.venta - p.costo) }}
                    </td>
                    <td style="text-align:right;font-weight:600;color:#FBBF24">
                      {{ (p.venta > 0 ? ((p.venta - p.costo) / p.venta) * 100 : 0).toFixed(1) }}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="t.lista.length > 60" class="table-footer-notice">
              Mostrando los 60 ítems de mayor venta. El archivo CSV contiene el 100% de los registros.
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- ═══ 2. COMPARATIVA MES vs MES ═══ -->
    <div class="dash-card-dark" style="margin-bottom:18px">
      <div class="dash-card-header">
        <div class="dash-title-wrap">
          <div class="dash-icon-badge green-glow">
            <i class="ti ti-chart-line"></i>
          </div>
          <div>
            <h3 class="dash-card-title">Comparativa de ventas</h3>
            <div class="dash-card-sub">Mes actual en curso vs Mes anterior</div>
          </div>
        </div>

        <div v-if="compMeses.ant > 0 || compMeses.act > 0" class="trend-pill-wrap">
          <span
            class="kpi-pill"
            :class="compMeses.varPct >= 0 ? 'pill-green' : 'pill-red'"
          >
            <i :class="compMeses.varPct >= 0 ? 'ti ti-arrow-up-right' : 'ti ti-arrow-down-right'"></i>
            {{ compMeses.varPct >= 0 ? '+' : '' }}{{ compMeses.varPct.toFixed(1) }}% vs mes anterior
          </span>
        </div>
      </div>

      <div class="comparison-bars-body">
        <div v-for="b in compMeses.barras" :key="b.etiqueta" class="month-bar-row">
          <div class="month-bar-meta">
            <span class="month-name">{{ b.etiqueta }}</span>
            <span class="month-total">{{ fmtUSD(b.val) }} <span class="month-invoices">({{ b.n }} {{ b.n === 1 ? 'factura' : 'facturas' }})</span></span>
          </div>
          <div class="month-track">
            <div
              class="month-fill"
              :style="{
                background: b.color.includes('linear-gradient') ? 'linear-gradient(90deg, #2563EB, #38BDF8)' : '#334155',
                width: (compMeses.tope > 0 ? (b.val / compMeses.tope) * 100 : 0) + '%'
              }"
            ></div>
          </div>
        </div>

        <div v-if="compMeses.ant === 0 && compMeses.act === 0" class="state-container">
          Sin ventas registradas en ninguno de los dos meses.
        </div>
        <div v-else-if="compMeses.ant === 0" class="state-container">
          No hay registros del mes anterior para comparar.
        </div>
        <div v-else class="comparison-net-diff">
          <span class="diff-label">Diferencia neta:</span>
          <strong class="text-white">{{ fmtUSD(Math.abs(compMeses.act - compMeses.ant)) }}</strong>
          <span class="diff-context">({{ compMeses.act >= compMeses.ant ? 'a favor este mes' : 'por debajo del mes pasado' }})</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { fmtUSD } from '../../services/pricing.js';

defineProps({
  origen: {
    type: Object,
    default: () => ({ estado: 'listo', lbl: 'este mes', etiqueta: 'este mes', data: null, error: '' })
  },
  R: {
    type: Object,
    default: null
  },
  bloquesOrigen: {
    type: Array,
    default: () => []
  },
  tablasDetalle: {
    type: Array,
    default: () => []
  },
  detalleAbierto: {
    type: Boolean,
    default: false
  },
  compMeses: {
    type: Object,
    default: () => ({
      act: 0,
      ant: 0,
      tope: 1,
      varPct: 0,
      barras: []
    })
  }
});

defineEmits(['toggle-detalle', 'descargar-csv']);

function calcPc(x, b) {
  return b > 0 ? ((x / b) * 100).toFixed(1) + '%' : '—';
}
</script>

<style scoped>
.comparison-cards-container {
  display: flex;
  flex-direction: column;
}

/* Card principal oscura con borde fino */
.dash-card-dark {
  background: #0E1726;
  background: linear-gradient(145deg, #101B2E 0%, #0A111E 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 4px 14px 0 rgba(0, 0, 0, 0.25);
}

.dash-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
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
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.blue-glow {
  background: rgba(37, 99, 235, 0.16);
  color: #38BDF8;
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.green-glow {
  background: rgba(16, 185, 129, 0.16);
  color: #34D399;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.dash-card-title {
  font-size: 15px;
  font-weight: 700;
  color: #F8FAFC;
  margin: 0;
  letter-spacing: -0.01em;
}

.dash-card-sub {
  font-size: 11.5px;
  color: #94A3B8;
  margin-top: 2px;
}

/* Grid de bloques de origen */
.origin-blocks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.origin-block-card {
  border-radius: 12px;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
}

.block-importado {
  background: linear-gradient(145deg, #132238 0%, #0C1626 100%);
  border-color: rgba(56, 189, 248, 0.2);
}

.block-local {
  background: linear-gradient(145deg, #2A1D0B 0%, #171005 100%);
  border-color: rgba(245, 158, 11, 0.25);
}

.origin-block-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.origin-type-badge {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #CBD5E1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.origin-amount-wrap {
  margin-bottom: 10px;
}

.origin-amount {
  font-size: 24px;
  font-weight: 800;
  color: #F8FAFC;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.origin-details-micro {
  font-size: 11px;
  color: #94A3B8;
  margin-top: 2px;
}

.origin-progress-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 12px;
}

.origin-progress-bar {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.4s ease;
}

.bar-blue {
  background: linear-gradient(90deg, #2563EB, #38BDF8);
}

.bar-gold {
  background: linear-gradient(90deg, #D97706, #FBBF24);
}

/* Métricas en mini grid */
.origin-stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  margin-bottom: 10px;
}

.origin-stat-item {
  display: flex;
  flex-direction: column;
}

.stat-lbl {
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  color: #94A3B8;
  letter-spacing: 0.04em;
}

.stat-val {
  font-size: 12.5px;
  font-weight: 700;
  margin-top: 2px;
}

.origin-contribution-note {
  font-size: 11px;
  color: #94A3B8;
  margin-bottom: 10px;
}

/* Desglose de caja */
.cash-breakdown-card {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cash-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.cash-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tag-green {
  background: rgba(16, 185, 129, 0.15);
  color: #34D399;
}

.tag-gold {
  background: rgba(245, 158, 11, 0.15);
  color: #FBBF24;
}

.cash-amount {
  font-weight: 700;
}

.cash-sub-micro {
  font-size: 10.5px;
  color: #94A3B8;
  padding-left: 2px;
}

/* Alertas estilo píldora */
.alerts-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.alert-pill-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 11.5px;
}

.alert-warning {
  background: rgba(245, 158, 11, 0.1);
  color: #FBBF24;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.alert-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #F87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.alert-info {
  background: rgba(56, 189, 248, 0.1);
  color: #38BDF8;
  border: 1px solid rgba(56, 189, 248, 0.2);
}

/* Botones de acción */
.origin-actions-bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-dark-action {
  background: #1E293B;
  color: #F8FAFC;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-dark-action:hover {
  background: #2D3D54;
  border-color: rgba(255, 255, 255, 0.25);
}

.btn-dark-secondary {
  background: transparent;
  color: #94A3B8;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-dark-secondary:hover {
  color: #F8FAFC;
  border-color: rgba(255, 255, 255, 0.2);
}

/* Tabla oscura moderna */
.origin-table-section {
  margin-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 16px;
}

.table-group-card {
  background: #0B1220;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 14px;
}

.table-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.header-blue {
  background: rgba(37, 99, 235, 0.18);
  color: #38BDF8;
}

.header-gold {
  background: rgba(245, 158, 11, 0.18);
  color: #FBBF24;
}

.table-group-summary {
  display: flex;
  gap: 8px;
}

.summary-pill {
  font-size: 10.5px;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.35);
  color: #E2E8F0;
}

.table-responsive-wrap {
  overflow-x: auto;
}

.dark-data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11.5px;
}

.dark-data-table th {
  padding: 7px 10px;
  color: #94A3B8;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.04em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: #080D17;
}

.dark-data-table td {
  padding: 6px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  color: #CBD5E1;
}

.dark-data-table tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

.code-cell {
  font-family: monospace;
  color: #38BDF8;
  font-weight: 600;
}

.desc-cell {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-footer-notice {
  font-size: 11px;
  color: #64748B;
  padding: 8px 12px;
  background: #080D17;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

/* Comparativa mes actual vs anterior */
.comparison-bars-body {
  padding: 4px 0;
}

.month-bar-row {
  margin-bottom: 14px;
}

.month-bar-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  margin-bottom: 5px;
}

.month-name {
  color: #94A3B8;
  text-transform: capitalize;
  font-weight: 500;
}

.month-total {
  font-weight: 700;
  color: #F8FAFC;
}

.month-invoices {
  font-weight: 400;
  color: #64748B;
  font-size: 11px;
}

.month-track {
  height: 14px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 9999px;
  overflow: hidden;
}

.month-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.4s ease;
}

.comparison-net-diff {
  font-size: 12px;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.diff-label {
  color: #94A3B8;
}

.diff-context {
  color: #64748B;
  font-size: 11.5px;
}

/* Colores utilitarios */
.text-white { color: #F8FAFC !important; }
.text-muted { color: #94A3B8 !important; }
.text-green { color: #34D399 !important; }
.text-red { color: #F87171 !important; }
.text-highlight { color: #FBBF24 !important; }
.font-green { color: #34D399; }
.font-gold { color: #FBBF24; }

/* Estados vacíos */
.state-container {
  padding: 20px;
  text-align: center;
  color: #64748B;
  font-size: 12.5px;
}

.state-container.error {
  color: #F87171;
}

/* Píldoras reutilizables */
.kpi-pill {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.pill-green {
  background: rgba(16, 185, 129, 0.15);
  color: #34D399;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.pill-blue {
  background: rgba(56, 189, 248, 0.15);
  color: #38BDF8;
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.pill-gold {
  background: rgba(245, 158, 11, 0.15);
  color: #FBBF24;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.pill-red {
  background: rgba(239, 68, 68, 0.15);
  color: #F87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.pill-neutral {
  background: rgba(255, 255, 255, 0.08);
  color: #CBD5E1;
  border: 1px solid rgba(255, 255, 255, 0.12);
}
</style>
