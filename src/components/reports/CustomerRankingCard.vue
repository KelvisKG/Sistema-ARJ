<template>
  <div class="card">
    <div class="card-tit"><i class="ti ti-trophy"></i> Ranking de clientes</div>
    <div class="rp-ranking">
      <!-- Top 5 compradores del mes -->
      <div>
        <h3 style="font-size:13px;color:var(--navy);font-weight:600;margin-bottom:10px">
          <i class="ti ti-trophy" style="color:var(--gold)"></i> Top 5 compradores del mes · {{ nombreEmp }}
        </h3>
        <div v-if="!ranking.top.length" style="padding:20px;text-align:center;color:var(--dgray);font-size:12.5px">
          Nadie ha comprado este mes en {{ nombreEmp }}
        </div>
        <div v-for="(c, i) in ranking.top" :key="c.nombre" style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
            <span style="font-size:12.5px;font-weight:500">
              <span style="display:inline-block;width:20px">{{ ['🥇', '🥈', '🥉', '4', '5'][i] }}</span> {{ c.nombre }}
            </span>
            <span style="font-weight:700;color:var(--navy);font-size:13px">{{ fmtUSD(c.mes) }}</span>
          </div>
          <div style="background:var(--gray);border-radius:4px;height:8px;margin-left:24px">
            <div
              :style="{
                background: 'linear-gradient(90deg,var(--gold),#E0B020)',
                height: '100%',
                width: (c.mes / (ranking.top[0]?.mes || 1) * 100).toFixed(0) + '%',
                borderRadius: '4px'
              }"
            ></div>
          </div>
          <div style="font-size:10.5px;color:var(--dgray);margin-left:24px;margin-top:2px">
            {{ c.comprasMes }} {{ c.comprasMes === 1 ? 'compra' : 'compras' }} este mes · última {{ formatearFecha(c.ultima) }}
          </div>
        </div>
      </div>

      <!-- Clientes que dejaron de comprar -->
      <div>
        <h3 style="font-size:13px;color:var(--red);font-weight:600;margin-bottom:10px">
          <i class="ti ti-alert-triangle"></i> Clientes que dejaron de comprar
        </h3>
        <div v-if="!ranking.dormidos.length" style="padding:20px;text-align:center;color:var(--dgray);font-size:12.5px">
          Ningún cliente lleva más de 30 días sin comprar
        </div>
        <div
          v-for="c in ranking.dormidos"
          :key="c.nombre"
          style="background:#FEF5F5;border:1px solid #F5C0C0;border-radius:8px;padding:10px 12px;margin-bottom:8px"
        >
          <div style="font-weight:600;font-size:12.5px;color:#222">{{ c.nombre }}</div>
          <div style="font-size:11px;color:var(--red);font-weight:500;margin:2px 0">⚠ {{ c.dias }} días sin comprar</div>
          <div style="font-size:10.5px;color:var(--dgray)">
            {{ c.comprasHist }} compras históricas · ticket promedio {{ fmtUSD(c.prom) }} · última {{ formatearFecha(c.ultima) }}
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
.rp-ranking {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
}
@media (max-width: 760px) {
  .rp-ranking {
    grid-template-columns: 1fr;
  }
}
</style>
