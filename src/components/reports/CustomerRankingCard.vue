<template>
  <div class="dash-card-dark">
    <div class="dash-card-header">
      <div class="dash-title-wrap">
        <div class="dash-icon-badge gold-glow">
          <i class="ti ti-trophy"></i>
        </div>
        <div>
          <h3 class="dash-card-title">Ranking de clientes</h3>
          <div class="dash-card-sub">Top compradores del mes y cartera en riesgo · {{ nombreEmp }}</div>
        </div>
      </div>
    </div>

    <div class="ranking-grid-layout">
      <!-- 1. Top 5 compradores del mes -->
      <div class="ranking-column">
        <div class="column-header">
          <span class="column-title">
            <i class="ti ti-crown" style="color:#FBBF24"></i> Top 5 Compradores del Mes
          </span>
          <span v-if="ranking.top.length" class="kpi-pill pill-gold">
            {{ ranking.top.length }} líderes
          </span>
        </div>

        <div v-if="!ranking.top.length" class="empty-state">
          Nadie ha comprado este mes en {{ nombreEmp }}
        </div>

        <div class="ranking-list">
          <div
            v-for="(c, i) in ranking.top"
            :key="c.nombre"
            class="ranking-item-card"
          >
            <div class="ranking-item-top">
              <div class="customer-info-wrap">
                <span class="rank-medal-badge" :class="'rank-' + (i + 1)">
                  {{ ['🥇', '🥈', '🥉', '4', '5'][i] }}
                </span>
                <span class="customer-name">{{ c.nombre }}</span>
              </div>
              <span class="customer-amount">{{ fmtUSD(c.mes) }}</span>
            </div>

            <div class="ranking-track">
              <div
                class="ranking-fill"
                :style="{
                  width: (c.mes / (ranking.top[0]?.mes || 1) * 100).toFixed(0) + '%'
                }"
              ></div>
            </div>

            <div class="ranking-item-meta">
              <span class="meta-pill">
                <i class="ti ti-shopping-cart"></i> {{ c.comprasMes }} {{ c.comprasMes === 1 ? 'compra' : 'compras' }} este mes
              </span>
              <span class="meta-date">Última: {{ formatearFecha(c.ultima) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Clientes que dejaron de comprar -->
      <div class="ranking-column">
        <div class="column-header">
          <span class="column-title" style="color:#F87171">
            <i class="ti ti-user-x"></i> Clientes que dejaron de comprar
          </span>
          <span v-if="ranking.dormidos.length" class="kpi-pill pill-red">
            {{ ranking.dormidos.length }} en riesgo
          </span>
        </div>

        <div v-if="!ranking.dormidos.length" class="empty-state">
          Ningún cliente lleva más de 30 días sin comprar
        </div>

        <div class="dormant-list">
          <div
            v-for="c in ranking.dormidos"
            :key="c.nombre"
            class="dormant-item-card"
          >
            <div class="dormant-item-top">
              <span class="dormant-name">{{ c.nombre }}</span>
              <span class="kpi-pill pill-red">
                <i class="ti ti-alert-triangle"></i> {{ c.dias }} días inactivo
              </span>
            </div>
            <div class="dormant-meta-row">
              <span>{{ c.comprasHist }} compras históricas</span>
              <span>&middot;</span>
              <span>Ticket prom. <strong>{{ fmtUSD(c.prom) }}</strong></span>
              <span>&middot;</span>
              <span>Última: {{ formatearFecha(c.ultima) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { fmtUSD } from '../../services/pricing.js';

defineProps({
  ranking: {
    type: Object,
    default: () => ({ top: [], dormidos: [] })
  },
  nombreEmp: {
    type: String,
    default: 'Venta Directa'
  }
});

function formatearFecha(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
}
</script>

<style scoped>
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
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.gold-glow {
  background: rgba(245, 158, 11, 0.16);
  color: #FBBF24;
  border: 1px solid rgba(245, 158, 11, 0.25);
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

/* Layout de dos columnas analíticas */
.ranking-grid-layout {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 18px;
}

@media (max-width: 760px) {
  .ranking-grid-layout {
    grid-template-columns: 1fr;
  }
}

.ranking-column {
  display: flex;
  flex-direction: column;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.column-title {
  font-size: 13px;
  font-weight: 700;
  color: #F8FAFC;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ranking-list, .dormant-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Ítems del ranking de clientes */
.ranking-item-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 10px 12px;
  transition: all 0.2s;
}

.ranking-item-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}

.ranking-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.customer-info-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.rank-medal-badge {
  font-size: 13px;
  width: 22px;
  text-align: center;
  flex-shrink: 0;
}

.customer-name {
  font-size: 12.5px;
  font-weight: 600;
  color: #F8FAFC;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-amount {
  font-size: 14px;
  font-weight: 800;
  color: #FBBF24;
  letter-spacing: -0.01em;
}

.ranking-track {
  height: 5px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 6px;
}

.ranking-fill {
  height: 100%;
  background: linear-gradient(90deg, #F59E0B, #FBBF24);
  border-radius: 9999px;
  transition: width 0.4s ease;
}

.ranking-item-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10.5px;
  color: #94A3B8;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Clientes dormidos */
.dormant-item-card {
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.16);
  border-radius: 10px;
  padding: 10px 12px;
  transition: all 0.2s;
}

.dormant-item-card:hover {
  background: rgba(239, 68, 68, 0.09);
  border-color: rgba(239, 68, 68, 0.25);
}

.dormant-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.dormant-name {
  font-weight: 600;
  font-size: 12px;
  color: #F8FAFC;
}

.dormant-meta-row {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 10.5px;
  color: #94A3B8;
  flex-wrap: wrap;
}

.dormant-meta-row strong {
  color: #CBD5E1;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: #64748B;
  font-size: 12px;
}

/* Píldoras reutilizables */
.kpi-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
</style>
