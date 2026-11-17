<template>
  <div class="dash-card-dark">
    <!-- ═══ HEADER Y CONTROLES ═══ -->
    <div class="dash-card-header">
      <div class="dash-title-wrap">
        <div class="dash-icon-badge gold-glow">
          <i class="ti ti-trophy"></i>
        </div>
        <div>
          <h3 class="dash-card-title">Ranking Analítico de Clientes</h3>
          <div class="dash-card-sub">
            Concentración de cartera, fidelidad y detección de riesgo · {{ etiquetaPeriodo }}
          </div>
        </div>
      </div>

      <!-- Barra de Filtros y Segmentación -->
      <div class="header-controls">
        <!-- Selector de Empresa -->
        <div class="control-pill-select">
          <i class="ti ti-building" style="color:var(--dgray);font-size:13px"></i>
          <select v-model="empresaSel" class="dash-select">
            <option value="actual">Empresa activa</option>
            <option value="todas">Consolidado (Todas)</option>
            <option value="directa">Venta Directa</option>
            <option value="dist">Distribuidora</option>
          </select>
        </div>

        <!-- Selector de Período -->
        <div class="control-pill-select">
          <i class="ti ti-calendar" style="color:var(--dgray);font-size:13px"></i>
          <select v-model="periodoSel" class="dash-select">
            <option value="mes">Este mes</option>
            <option value="mes_ant">Mes anterior</option>
            <option value="3m">Últimos 3 meses</option>
            <option value="12m">Año en curso</option>
            <option value="hist">Histórico completo</option>
          </select>
        </div>

        <!-- Selector de Tamaño de Ranking -->
        <div class="top-size-selector">
          <button
            v-for="n in [5, 10, 20]"
            :key="n"
            :class="['top-btn', { active: limiteTop === n }]"
            @click="limiteTop = n"
          >
            Top {{ n }}
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ BANNER ANALÍTICO: LEY DE PARETO / CONCENTRACIÓN DE CARTERA ═══ -->
    <div class="pareto-card">
      <div class="pareto-top">
        <div class="pareto-main-stat">
          <span class="pareto-lbl">Concentración de Cartera (Ley de Pareto)</span>
          <div class="pareto-headline">
            El Top {{ Math.min(limiteTop, rankingData.top.length) }} concentra el
            <strong class="font-gold">{{ paretoStats.pctTop.toFixed(1) }}%</strong>
            de la facturación
          </div>
        </div>
        <div class="pareto-numbers">
          <div class="p-num-box">
            <span class="p-num-lbl">Top {{ Math.min(limiteTop, rankingData.top.length) }}</span>
            <span class="p-num-val font-gold">{{ fmtUSD(paretoStats.totalTop) }}</span>
          </div>
          <div class="p-divider">/</div>
          <div class="p-num-box">
            <span class="p-num-lbl">Total Período</span>
            <span class="p-num-val">{{ fmtUSD(paretoStats.totalPeriodo) }}</span>
          </div>
        </div>
      </div>

      <!-- Barra de progreso visual de concentración -->
      <div class="pareto-track">
        <div
          class="pareto-fill"
          :style="{ width: paretoStats.pctTop + '%' }"
          :title="'Top ' + limiteTop + ': ' + paretoStats.pctTop.toFixed(1) + '%'"
        ></div>
      </div>

      <!-- Diagnóstico comercial inteligente -->
      <div class="pareto-footer">
        <span class="pareto-diag" :class="paretoStats.diagClass">
          <i :class="paretoStats.diagIcon"></i> {{ paretoStats.diagMensaje }}
        </span>
        <span class="pareto-sub">
          {{ rankingData.totalClientesCompradores }} clientes activos compraron en este período
        </span>
      </div>
    </div>

    <!-- ═══ GRID DE 2 COLUMNAS: TOP CLIENTES VS CLIENTES EN RIESGO ═══ -->
    <div class="ranking-grid-layout">
      <!-- 1. COLUMNA: TOP COMPRADORES -->
      <div class="ranking-column">
        <div class="column-header">
          <div class="col-title-flex">
            <span class="column-title">
              <i class="ti ti-crown" style="color:var(--gold)"></i> Top {{ limiteTop }} Clientes Compradores
            </span>
            <span class="kpi-pill pill-gold">
              {{ rankingData.top.length }} líderes
            </span>
          </div>
          <div class="col-hint-text">Ordenado por volumen de compra</div>
        </div>

        <div v-if="!rankingData.top.length" class="empty-state">
          <i class="ti ti-receipt-off" style="font-size:28px;margin-bottom:6px;opacity:0.5"></i>
          <div>No hay facturación registrada para este período y filtro.</div>
        </div>

        <div v-else class="ranking-list">
          <div
            v-for="(c, i) in rankingData.top"
            :key="c.nombre + i"
            class="ranking-item-card"
          >
            <!-- Fila superior: Puesto, Nombre, Monto -->
            <div class="ranking-item-top">
              <div class="customer-info-wrap">
                <span class="rank-medal-badge" :class="'rank-' + (i + 1)">
                  {{ i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1) }}
                </span>
                <div class="cust-title-block">
                  <span class="customer-name" :title="c.nombre">{{ c.nombre }}</span>
                  <!-- Badge de Salud Crediticia (Deuda vs Al día) -->
                  <span
                    v-if="c.saldoPendiente > 0.01"
                    class="credit-badge debt"
                    :title="'Saldo pendiente por cobrar: ' + fmtUSD(c.saldoPendiente)"
                  >
                    <i class="ti ti-clock"></i> Debe {{ fmtUSD(c.saldoPendiente) }}
                  </span>
                  <span
                    v-else
                    class="credit-badge ok"
                    title="Al día sin deudas pendientes"
                  >
                    <i class="ti ti-circle-check"></i> Al día
                  </span>
                </div>
              </div>
              <div class="customer-amount-block">
                <span class="customer-amount">{{ fmtUSD(c.totalPeriodo) }}</span>
                <span class="cust-avg-label">Prom. {{ fmtUSD(c.promTicket) }} / fac</span>
              </div>
            </div>

            <!-- Barra relativa al cliente #1 -->
            <div class="ranking-track">
              <div
                class="ranking-fill"
                :style="{
                  width: (c.totalPeriodo / (rankingData.top[0]?.totalPeriodo || 1) * 100).toFixed(0) + '%'
                }"
              ></div>
            </div>

            <!-- Fila inferior de metadata -->
            <div class="ranking-item-meta">
              <span class="meta-pill">
                <i class="ti ti-shopping-cart"></i> {{ c.comprasPeriodo }} {{ c.comprasPeriodo === 1 ? 'compra' : 'compras' }}
              </span>
              <span class="meta-date">
                <i class="ti ti-calendar-event"></i> Última: {{ formatearFecha(c.ultimaFecha) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. COLUMNA: CLIENTES QUE DEJARON DE COMPRAR (EN RIESGO) -->
      <div class="ranking-column">
        <div class="column-header">
          <div class="col-title-flex">
            <span class="column-title" style="color:var(--red)">
              <i class="ti ti-user-x"></i> Clientes que dejaron de comprar
            </span>
            <span v-if="rankingData.dormidos.length" class="kpi-pill pill-red">
              {{ rankingData.dormidos.length }} en riesgo
            </span>
          </div>
          <div class="col-hint-text">≥ 30 días sin comprar con historial previo</div>
        </div>

        <div v-if="!rankingData.dormidos.length" class="empty-state state-healthy">
          <i class="ti ti-circle-check" style="font-size:28px;color:var(--green);margin-bottom:6px"></i>
          <div style="font-weight:700;color:var(--text)">¡Excelente retención!</div>
          <div>Ningún cliente frecuente lleva más de 30 días sin comprar.</div>
        </div>

        <div v-else class="dormant-list">
          <div
            v-for="c in rankingData.dormidos"
            :key="c.nombre"
            class="dormant-item-card"
          >
            <!-- Fila superior del cliente dormido -->
            <div class="dormant-item-top">
              <div class="dormant-name-wrap">
                <span class="dormant-name" :title="c.nombre">{{ c.nombre }}</span>
                <span
                  class="kpi-pill"
                  :class="c.dias >= 60 ? 'pill-deep-red' : 'pill-red'"
                >
                  <i class="ti ti-alert-triangle"></i> {{ c.dias }} días inactivo
                </span>
              </div>

              <!-- Botón rápido de acción comercial (WhatsApp) -->
              <a
                v-if="c.telefono"
                :href="generarUrlWhatsApp(c)"
                target="_blank"
                rel="noopener"
                class="btn-reactivar-wa"
                title="Contactar por WhatsApp para reactivación comercial"
              >
                <i class="ti ti-brand-whatsapp"></i> Reactivar
              </a>
              <span v-else class="no-tel-hint" title="Sin teléfono registrado en ficha de cliente">
                <i class="ti ti-phone-off"></i> Sin tel.
              </span>
            </div>

            <!-- Metadata histórica del cliente -->
            <div class="dormant-meta-row">
              <span><strong>{{ c.comprasHist }}</strong> compras históricas</span>
              <span>&middot;</span>
              <span>Ticket prom. <strong>{{ fmtUSD(c.promTicket) }}</strong></span>
              <span>&middot;</span>
              <span>Última: <strong>{{ formatearFecha(c.ultimaFecha) }}</strong></span>
            </div>

            <!-- Estado de saldo si debe dinero -->
            <div v-if="c.saldoPendiente > 0.01" class="dormant-debt-alert">
              <i class="ti ti-alert-circle"></i> Registra saldo pendiente de {{ fmtUSD(c.saldoPendiente) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { fmtUSD } from '../../services/pricing.js';

const props = defineProps({
  ranking: {
    type: Object,
    default: () => ({ top: [], dormidos: [] })
  },
  nombreEmp: {
    type: String,
    default: 'Venta Directa'
  },
  todasFacturas: {
    type: Array,
    default: () => []
  },
  clientes: {
    type: Array,
    default: () => []
  }
});

// Filtros interactivos internos
const periodoSel = ref('mes');
const empresaSel = ref('actual');
const limiteTop = ref(5);

// Etiqueta legible del período
const etiquetaPeriodo = computed(() => {
  const map = {
    mes: 'Este mes',
    mes_ant: 'Mes anterior',
    '3m': 'Últimos 3 meses',
    '12m': 'Año en curso',
    hist: 'Histórico completo'
  };
  return map[periodoSel.value] || 'Este mes';
});

// Límites de fecha según el período seleccionado
const rangoFechas = computed(() => {
  const hoy = new Date();
  const a = hoy.getFullYear();
  const m = hoy.getMonth();

  if (periodoSel.value === 'mes') {
    return { desde: new Date(a, m, 1), hasta: null };
  } else if (periodoSel.value === 'mes_ant') {
    return { desde: new Date(a, m - 1, 1), hasta: new Date(a, m, 1) };
  } else if (periodoSel.value === '3m') {
    return { desde: new Date(a, m - 2, 1), hasta: null };
  } else if (periodoSel.value === '12m') {
    return { desde: new Date(a, 0, 1), hasta: null };
  }
  // Histórico completo
  return { desde: new Date(2000, 0, 1), hasta: null };
});

// Mapa de teléfonos de clientes por nombre normalizado
const mapaTelefonos = computed(() => {
  const map = new Map();
  (props.clientes || []).forEach(cli => {
    if (cli.nombre && cli.tel) {
      map.set(cli.nombre.trim().toLowerCase(), cli.tel);
    }
  });
  return map;
});

// Mapa de deudas por cliente calculadas de todas las facturas vigentes
const mapaDeudas = computed(() => {
  const map = new Map();
  (props.todasFacturas || []).forEach(f => {
    if (f.estado === 'anulada') return;
    const nom = (f.cliente_nombre_snap || f.cliente || '').trim().toLowerCase();
    if (!nom) return;
    const saldo = Number(f.saldo_pendiente) || 0;
    if (saldo > 0) {
      map.set(nom, (map.get(nom) || 0) + saldo);
    }
  });
  return map;
});

// Cálculo analítico del ranking
const rankingData = computed(() => {
  // Si no hay facturas directas pasadas, usamos el prop ranking como fallback
  if (!props.todasFacturas || !props.todasFacturas.length) {
    const rawTop = props.ranking?.top || [];
    const rawDormidos = props.ranking?.dormidos || [];
    const top = rawTop.map(c => ({
      nombre: c.nombre,
      totalPeriodo: c.mes || 0,
      comprasPeriodo: c.comprasMes || 1,
      promTicket: c.comprasMes > 0 ? (c.mes / c.comprasMes) : c.mes,
      ultimaFecha: c.ultima,
      saldoPendiente: 0
    })).slice(0, limiteTop.value);

    const dormidos = rawDormidos.map(c => ({
      nombre: c.nombre,
      dias: c.dias || 30,
      comprasHist: c.comprasHist || 2,
      promTicket: c.prom || 0,
      ultimaFecha: c.ultima,
      telefono: mapaTelefonos.value.get(c.nombre?.trim().toLowerCase()) || null,
      saldoPendiente: 0
    }));

    return {
      top,
      dormidos,
      totalClientesCompradores: top.length,
      facturasPeriodo: []
    };
  }

  const hoy = new Date();
  const { desde, hasta } = rangoFechas.value;
  const porCliente = {};

  // Determinamos el filtro de empresa
  let filtroEmpresa = null;
  if (empresaSel.value === 'directa') filtroEmpresa = 'directa';
  else if (empresaSel.value === 'dist') filtroEmpresa = 'dist';
  else if (empresaSel.value === 'actual') {
    filtroEmpresa = props.nombreEmp.toLowerCase().includes('distribuidora') ? 'dist' : 'directa';
  }

  const facturasValidas = props.todasFacturas.filter(f => {
    if (f.estado === 'anulada' || !f.fecha_raw) return false;
    if (filtroEmpresa && f.empresa !== filtroEmpresa) return false;
    return true;
  });

  // Agrupamos clientes con su historial completo y desglose del período
  facturasValidas.forEach(f => {
    const nom = (f.cliente_nombre_snap || f.cliente || 'Sin cliente').trim();
    const nomKey = nom.toLowerCase();
    const fch = new Date(f.fecha_raw);
    const total = Number(f.total) || 0;

    if (!porCliente[nomKey]) {
      porCliente[nomKey] = {
        nombre: nom,
        totalPeriodo: 0,
        comprasPeriodo: 0,
        totalHist: 0,
        comprasHist: 0,
        ultimaFecha: null,
        saldoPendiente: mapaDeudas.value.get(nomKey) || 0,
        telefono: mapaTelefonos.value.get(nomKey) || null
      };
    }

    const c = porCliente[nomKey];
    c.totalHist += total;
    c.comprasHist++;

    if (!c.ultimaFecha || fch > c.ultimaFecha) {
      c.ultimaFecha = fch;
    }

    // Filtro por corte del período seleccionado
    const enPeriodo = fch >= desde && (!hasta || fch < hasta);
    if (enPeriodo) {
      c.totalPeriodo += total;
      c.comprasPeriodo++;
    }
  });

  const todos = Object.values(porCliente);

  // Top clientes del período
  const top = todos
    .filter(c => c.totalPeriodo > 0)
    .map(c => ({
      ...c,
      promTicket: c.comprasPeriodo > 0 ? (c.totalPeriodo / c.comprasPeriodo) : 0
    }))
    .sort((a, b) => b.totalPeriodo - a.totalPeriodo)
    .slice(0, limiteTop.value);

  // Clientes dormidos / en riesgo:
  // Al menos 2 compras históricas, no han comprado en el período actual y llevan >= 30 días sin comprar
  const dormidos = todos
    .filter(c => {
      if (c.comprasHist < 2 || !c.ultimaFecha) return false;
      const dias = Math.floor((hoy - c.ultimaFecha) / (1000 * 60 * 60 * 24));
      return dias >= 30;
    })
    .map(c => {
      const dias = Math.floor((hoy - c.ultimaFecha) / (1000 * 60 * 60 * 24));
      return {
        ...c,
        dias,
        promTicket: c.comprasHist > 0 ? (c.totalHist / c.comprasHist) : 0
      };
    })
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 10);

  return {
    top,
    dormidos,
    totalClientesCompradores: todos.filter(c => c.totalPeriodo > 0).length
  };
});

// Estadísticas de concentración de Pareto
const paretoStats = computed(() => {
  const topList = rankingData.value.top;
  const totalTop = topList.reduce((acc, c) => acc + c.totalPeriodo, 0);

  // Suma total del período según el filtro
  const { desde, hasta } = rangoFechas.value;
  let filtroEmpresa = null;
  if (empresaSel.value === 'directa') filtroEmpresa = 'directa';
  else if (empresaSel.value === 'dist') filtroEmpresa = 'dist';
  else if (empresaSel.value === 'actual') {
    filtroEmpresa = props.nombreEmp.toLowerCase().includes('distribuidora') ? 'dist' : 'directa';
  }

  const facturasPeriodo = (props.todasFacturas || []).filter(f => {
    if (f.estado === 'anulada' || !f.fecha_raw) return false;
    if (filtroEmpresa && f.empresa !== filtroEmpresa) return false;
    const fch = new Date(f.fecha_raw);
    return fch >= desde && (!hasta || fch < hasta);
  });

  const totalPeriodo = facturasPeriodo.reduce((acc, f) => acc + (Number(f.total) || 0), 0);
  const pctTop = totalPeriodo > 0 ? Math.min((totalTop / totalPeriodo) * 100, 100) : 0;

  // Diagnóstico inteligente
  let diagMensaje = 'Cartera diversificada y equilibrada';
  let diagIcon = 'ti ti-shield-check';
  let diagClass = 'diag-green';

  if (pctTop >= 75) {
    diagMensaje = 'Alta dependencia comercial: el Top genera más del 75% de los ingresos';
    diagIcon = 'ti ti-alert-triangle';
    diagClass = 'diag-red';
  } else if (pctTop >= 50) {
    diagMensaje = 'Concentración moderada: los clientes clave representan la mitad del negocio';
    diagIcon = 'ti ti-info-circle';
    diagClass = 'diag-gold';
  }

  return {
    totalTop,
    totalPeriodo,
    pctTop,
    diagMensaje,
    diagIcon,
    diagClass
  };
});

function formatearFecha(d) {
  if (!d) return 'Sin fecha';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
}

// Genera el enlace de WhatsApp con mensaje pre-redactado
function generarUrlWhatsApp(cliente) {
  const telLimpio = (cliente.telefono || '').replace(/\D/g, '');
  const nombreCorto = (cliente.nombre || '').split(' ')[0] || 'Estimado cliente';
  const mensaje = `Hola ${nombreCorto}, te saludamos de Repuestos ARJ. Esperamos te encuentres bien. Notamos que hace unos días no nos visitas y queríamos ponernos a tu disposición por si requieres repuestos, listas de precios actualizadas o cotizaciones para tus equipos. ¡Estamos a la orden!`;
  return `https://wa.me/${telLimpio}?text=${encodeURIComponent(mensaje)}`;
}
</script>

<style scoped>
.dash-card-dark {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 20px;
}

/* ── Header y Controles ── */
.dash-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}

.dash-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dash-icon-badge {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}

.gold-glow {
  background: var(--lgold);
  color: var(--gold);
  border: 1px solid rgba(217, 119, 6, 0.3);
}

.dash-card-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--navy);
  margin: 0;
}

.dash-card-sub {
  font-size: 12px;
  color: var(--dgray);
  margin-top: 2px;
}

/* ── Controles en cabecera ── */
.header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.control-pill-select {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 4px 12px;
}

.dash-select {
  background: transparent;
  border: none;
  outline: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  appearance: auto;
}

.top-size-selector {
  display: flex;
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 2px;
  gap: 2px;
}

.top-btn {
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  color: var(--dgray);
  cursor: pointer;
  transition: var(--trans-fast);
}

.top-btn.active {
  background: var(--card-bg);
  color: var(--blue);
  box-shadow: var(--shadow-xs);
}

/* ── Banner de Pareto / Concentración ── */
.pareto-card {
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  margin-bottom: 20px;
}

.pareto-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 10px;
}

.pareto-lbl {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--dgray);
}

.pareto-headline {
  font-size: 13.5px;
  color: var(--text);
  margin-top: 2px;
}

.pareto-numbers {
  display: flex;
  align-items: center;
  gap: 12px;
}

.p-num-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.p-num-lbl {
  font-size: 10.5px;
  color: var(--dgray);
}

.p-num-val {
  font-size: 15px;
  font-weight: 800;
}

.p-divider {
  font-size: 18px;
  color: var(--border);
  font-weight: 300;
}

.pareto-track {
  height: 10px;
  background: var(--border);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: 10px;
}

.pareto-fill {
  height: 100%;
  background: linear-gradient(90deg, #2563EB, #F59E0B);
  border-radius: var(--radius-full);
  transition: width 0.4s ease;
}

.pareto-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11.5px;
}

.pareto-diag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 600;
}

.diag-green { color: var(--green); }
.diag-gold  { color: var(--gold); }
.diag-red   { color: var(--red); }

.pareto-sub {
  color: var(--dgray);
}

/* ── Layout de 2 columnas ── */
.ranking-grid-layout {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 18px;
}

@media (max-width: 860px) {
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
  flex-wrap: wrap;
  gap: 6px;
}

.col-title-flex {
  display: flex;
  align-items: center;
  gap: 8px;
}

.column-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.col-hint-text {
  font-size: 11px;
  color: var(--dgray);
}

.ranking-list, .dormant-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Ítems del Top Compradores ── */
.ranking-item-card {
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  transition: border-color var(--trans-fast), transform var(--trans-fast), box-shadow var(--trans-fast);
}

.ranking-item-card:hover {
  border-color: var(--gold);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.ranking-item-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  gap: 10px;
}

.customer-info-wrap {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.rank-medal-badge {
  font-size: 15px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-weight: 800;
  color: var(--dgray);
}

.cust-title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.customer-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.credit-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  width: fit-content;
}

.credit-badge.ok {
  background: var(--lgreen);
  color: var(--green);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.credit-badge.debt {
  background: var(--lgold);
  color: var(--gold);
  border: 1px solid rgba(217, 119, 6, 0.3);
}

.customer-amount-block {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.customer-amount {
  font-size: 15px;
  font-weight: 800;
  color: var(--gold);
  letter-spacing: -0.01em;
}

.cust-avg-label {
  font-size: 10.5px;
  color: var(--dgray);
  margin-top: 2px;
}

.ranking-track {
  height: 6px;
  background: var(--border);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: 8px;
}

.ranking-fill {
  height: 100%;
  background: linear-gradient(90deg, #F59E0B, var(--gold));
  border-radius: var(--radius-full);
  transition: width 0.4s ease;
}

.ranking-item-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--dgray);
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--lblue);
  color: var(--blue);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-weight: 600;
}

.meta-date {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--dgray);
}

/* ── Clientes dormidos / en riesgo ── */
.dormant-item-card {
  background: var(--card-bg);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-left: 3px solid var(--red);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  transition: var(--trans-fast);
}

.dormant-item-card:hover {
  border-color: var(--red);
  box-shadow: var(--shadow-xs);
}

.dormant-item-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
  gap: 8px;
}

.dormant-name-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.dormant-name {
  font-weight: 700;
  font-size: 12.5px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-reactivar-wa {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #25D366;
  color: #FFFFFF;
  text-decoration: none;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  transition: var(--trans-fast);
  flex-shrink: 0;
}

.btn-reactivar-wa:hover {
  background: #1EBE5D;
  transform: translateY(-1px);
}

.no-tel-hint {
  font-size: 10.5px;
  color: var(--dgray);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.dormant-meta-row {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 11px;
  color: var(--dgray);
  flex-wrap: wrap;
}

.dormant-meta-row strong {
  color: var(--text);
}

.dormant-debt-alert {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(239, 68, 68, 0.2);
  font-size: 10.5px;
  font-weight: 700;
  color: var(--red);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ── Estados vacíos ── */
.empty-state {
  padding: 30px 16px;
  text-align: center;
  color: var(--dgray);
  font-size: 12px;
  background: var(--gray);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.state-healthy {
  background: var(--lgreen);
  border-color: rgba(16, 185, 129, 0.3);
}

/* ── Píldoras ── */
.kpi-pill {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
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

.pill-deep-red {
  background: rgba(239, 68, 68, 0.2);
  color: #DC2626;
  border: 1px solid rgba(239, 68, 68, 0.5);
  font-weight: 800;
}

.font-gold {
  color: var(--gold) !important;
}
</style>
