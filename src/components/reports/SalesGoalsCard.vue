<template>
  <div class="dash-card-dark" style="margin-bottom:20px">
    <div class="dash-card-header">
      <div class="dash-title-wrap">
        <div class="dash-icon-badge gold-glow">
          <i class="ti ti-target"></i>
        </div>
        <div>
          <h3 class="dash-card-title">Metas de venta del mes</h3>
          <div class="dash-card-sub">Objetivos empresariales e individuales de {{ nombreEmp }}</div>
        </div>
      </div>

      <div class="goals-period-controls">
        <div class="period-select-wrap">
          <span class="ctrl-lbl">Período:</span>
          <select
            :value="metasPer"
            class="rp-select-dark"
            @change="$emit('update:metasPer', $event.target.value)"
          >
            <option v-for="x in opcionesPeriodo" :key="x" :value="x">{{ etiquetaPeriodo(x) }}</option>
          </select>
        </div>
        <span v-if="esMesCerrado" class="kpi-pill pill-gold">
          <i class="ti ti-lock"></i> Mes cerrado
        </span>
        <button class="btn-dark-secondary" @click="$emit('abrir-equipo')">
          <i class="ti ti-users-plus"></i> Gestionar equipo
        </button>
      </div>
    </div>

    <div v-if="esMesCerrado" class="notice-pill-box">
      <i class="ti ti-info-circle"></i>
      <span>Estás viendo un mes cerrado. Las barras de ventas reflejan el <strong>mes en curso</strong>; solo la meta corresponde al período seleccionado.</span>
    </div>

    <!-- 1. Tarjeta Meta Empresa -->
    <div class="company-goal-card">
      <div class="company-goal-top">
        <div>
          <div class="goal-sub-lbl">Meta Global de Empresa</div>
          <div class="goal-emp-name">{{ nombreEmp }}</div>
        </div>
        <div class="goal-input-wrap">
          <span class="goal-input-lbl">Meta USD:</span>
          <input
            type="number"
            class="dark-val-input"
            :value="metaEmpresa"
            step="500"
            min="0"
            @change="$emit('actualizar-meta-empresa', $event.target.value)"
          >
        </div>
      </div>

      <!-- Barra de progreso de empresa -->
      <div class="goal-progress-track large">
        <div
          class="goal-progress-fill"
          :style="{
            width: pctEmp + '%',
            background: 'linear-gradient(90deg, #10B981, #34D399)'
          }"
        >
          <span v-if="pctEmp > 8" class="progress-pct-label">{{ pctEmp.toFixed(1) }}%</span>
        </div>
      </div>

      <div class="goal-metrics-row">
        <span class="metric-sold">
          <i class="ti ti-check-circle"></i> Vendido: <strong class="text-white">{{ fmtUSD(ventasEmpresa) }}</strong>
        </span>
        <span class="metric-pending">
          Falta: <strong :class="faltaEmp > 0 ? 'text-gold' : 'text-green'">{{ fmtUSD(faltaEmp) }}</strong>
        </span>
      </div>

      <!-- Sugerencias automáticas en formato píldora -->
      <div class="suggestions-strip">
        <template v-if="baseSug > 0">
          <span class="sug-hint"><i class="ti ti-bulb"></i> Sugerencias (base {{ fmtUSD(baseSug) }}):</span>
          <div class="sug-pills-wrap">
            <button class="sug-pill-btn" @click="$emit('sugerir-meta', 'conservadora')">
              Conservadora: {{ fmtUSD(Math.round(baseSug * 0.9 / 100) * 100) }}
            </button>
            <button class="sug-pill-btn active" @click="$emit('sugerir-meta', 'moderada')">
              Moderada: {{ fmtUSD(Math.round(baseSug * 1.1 / 100) * 100) }}
            </button>
            <button class="sug-pill-btn" @click="$emit('sugerir-meta', 'agresiva')">
              Agresiva: {{ fmtUSD(Math.round(baseSug * 1.3 / 100) * 100) }}
            </button>
          </div>
        </template>
        <template v-else>
          <span class="sug-hint"><i class="ti ti-bulb"></i> Las sugerencias de meta se activarán al contar con ventas registradas del mes anterior.</span>
        </template>
      </div>
    </div>

    <!-- 2. Tarjeta Metas por Trabajador -->
    <div class="team-goals-card">
      <div class="team-goals-header">
        <div class="goal-sub-lbl">Metas individuales por trabajador</div>
        <button class="btn-mini-add" @click="$emit('abrir-equipo')">
          <i class="ti ti-plus"></i> Añadir trabajador
        </button>
      </div>

      <div v-if="!listaTrab.length" class="empty-state">
        Todavía no hay trabajadores registrados en <strong>{{ nombreEmp }}</strong>.<br>
        <button class="btn-dark-action" style="margin-top:8px" @click="$emit('abrir-equipo')">
          <i class="ti ti-user-plus"></i> Registrar trabajador
        </button>
      </div>

      <div class="team-workers-grid">
        <div v-for="t in filasTrab" :key="t.v" class="worker-goal-row">
          <div class="worker-row-top">
            <div class="worker-identity">
              <div class="worker-avatar-mini">
                <i class="ti ti-user"></i>
              </div>
              <span class="worker-name">{{ t.v }}</span>
              <span v-if="t.cumplido" class="kpi-pill pill-green">
                <i class="ti ti-check"></i> Cumplida
              </span>
              <span v-if="!t.enEquipo" class="kpi-pill pill-gold" title="Facturó pero no está en la lista de equipo">
                Fuera del equipo
              </span>
            </div>
            <div class="worker-input-wrap">
              <span class="micro-lbl">Meta USD:</span>
              <input
                type="number"
                :value="t.meta"
                step="500"
                min="0"
                class="dark-val-input small"
                @change="$emit('actualizar-meta-vendedor', t.v, $event.target.value)"
              >
            </div>
          </div>

          <div class="goal-progress-track">
            <div
              class="goal-progress-fill"
              :style="{
                background: t.cumplido ? 'linear-gradient(90deg, #10B981, #34D399)' : 'linear-gradient(90deg, #2563EB, #38BDF8)',
                width: t.pct + '%'
              }"
            ></div>
          </div>

          <div class="worker-row-bottom">
            <span>{{ fmtUSD(t.vendido) }} <span v-if="t.meta > 0" class="text-muted">({{ t.pct.toFixed(0) }}%)</span></span>
            <span class="text-muted">{{ t.meta > 0 ? 'Falta ' + fmtUSD(t.falta) : 'Sin meta asignada' }}</span>
          </div>
        </div>
      </div>

      <!-- Alerta si las metas del equipo difieren de la meta global -->
      <div v-if="avisoSuma" class="team-sum-alert" :class="avisoSuma.corta ? 'alert-corta' : 'alert-cushion'">
        <i :class="'ti ti-' + (avisoSuma.corta ? 'alert-triangle' : 'info-circle')"></i>
        <span>
          La suma de metas individuales es <strong>{{ fmtUSD(avisoSuma.suma) }}</strong> frente a {{ fmtUSD(metaEmpresa) }} de la empresa.
          <template v-if="avisoSuma.corta">Aunque todos cumplan, la empresa quedaría <strong>{{ fmtUSD(Math.abs(avisoSuma.dif)) }}</strong> por debajo.</template>
          <template v-else>Hay <strong>{{ fmtUSD(avisoSuma.dif) }}</strong> de margen de cobertura.</template>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { fmtUSD } from '../../services/pricing.js';
import { etiquetaPeriodo } from '../../services/reportes.js';

defineProps({
  nombreEmp: {
    type: String,
    default: 'Venta Directa'
  },
  metasPer: {
    type: String,
    default: ''
  },
  opcionesPeriodo: {
    type: Array,
    default: () => []
  },
  esMesCerrado: {
    type: Boolean,
    default: false
  },
  metaEmpresa: {
    type: Number,
    default: 0
  },
  pctEmp: {
    type: Number,
    default: 0
  },
  ventasEmpresa: {
    type: Number,
    default: 0
  },
  faltaEmp: {
    type: Number,
    default: 0
  },
  baseSug: {
    type: Number,
    default: 0
  },
  listaTrab: {
    type: Array,
    default: () => []
  },
  filasTrab: {
    type: Array,
    default: () => []
  },
  avisoSuma: {
    type: Object,
    default: null
  }
});

defineEmits([
  'update:metasPer',
  'abrir-equipo',
  'actualizar-meta-empresa',
  'actualizar-meta-vendedor',
  'sugerir-meta'
]);
</script>

<style scoped>
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

.goals-period-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.period-select-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ctrl-lbl {
  font-size: 11.5px;
  color: #94A3B8;
}

.rp-select-dark {
  background: #1E293B;
  color: #F8FAFC;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 11.5px;
  font-weight: 600;
  outline: none;
}

.notice-pill-box {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 14px;
  font-size: 11.5px;
  color: #FBBF24;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Tarjeta meta empresa */
.company-goal-card {
  background: #0B1220;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
}

.company-goal-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.goal-sub-lbl {
  font-size: 10.5px;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #94A3B8;
}

.goal-emp-name {
  font-size: 15px;
  font-weight: 700;
  color: #F8FAFC;
  margin-top: 2px;
}

.goal-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.goal-input-lbl {
  font-size: 11.5px;
  color: #94A3B8;
}

.dark-val-input {
  background: #1E293B;
  color: #F8FAFC;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 13px;
  font-weight: 700;
  width: 110px;
  text-align: right;
  outline: none;
}

.dark-val-input.small {
  width: 90px;
  font-size: 11.5px;
  padding: 4px 8px;
}

.dark-val-input:focus {
  border-color: #38BDF8;
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
}

.goal-progress-track {
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
  position: relative;
  margin-bottom: 8px;
}

.goal-progress-track.large {
  height: 22px;
  border-radius: 8px;
}

.goal-progress-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 0.4s ease;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
}

.progress-pct-label {
  color: #FFFFFF;
  font-size: 10.5px;
  font-weight: 700;
}

.goal-metrics-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 10px;
}

.metric-sold {
  color: #34D399;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.metric-pending {
  color: #94A3B8;
}

/* Strip de sugerencias */
.suggestions-strip {
  padding-top: 10px;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
}

.sug-hint {
  color: #94A3B8;
}

.sug-pills-wrap {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
}

.sug-pill-btn {
  background: #1E293B;
  color: #CBD5E1;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  padding: 3px 10px;
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.sug-pill-btn:hover {
  background: #334155;
  color: #F8FAFC;
  border-color: rgba(255, 255, 255, 0.2);
}

.sug-pill-btn.active {
  background: rgba(37, 99, 235, 0.2);
  color: #38BDF8;
  border-color: rgba(56, 189, 248, 0.4);
}

/* Metas por trabajador */
.team-goals-card {
  background: #0B1220;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
}

.team-goals-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.btn-mini-add {
  background: rgba(255, 255, 255, 0.06);
  color: #38BDF8;
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.btn-mini-add:hover {
  background: rgba(56, 189, 248, 0.15);
}

.team-workers-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.worker-goal-row {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 10px 12px;
}

.worker-row-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  gap: 8px;
}

.worker-identity {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.worker-avatar-mini {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(37, 99, 235, 0.2);
  color: #38BDF8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.worker-name {
  font-size: 12.5px;
  font-weight: 600;
  color: #F8FAFC;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.worker-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.micro-lbl {
  font-size: 10.5px;
  color: #94A3B8;
}

.worker-row-bottom {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #CBD5E1;
  margin-top: 4px;
}

.team-sum-alert {
  margin-top: 14px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 11.5px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.alert-corta {
  background: rgba(245, 158, 11, 0.1);
  color: #FBBF24;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.alert-cushion {
  background: rgba(56, 189, 248, 0.1);
  color: #38BDF8;
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.btn-dark-secondary {
  background: transparent;
  color: #94A3B8;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 11.5px;
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

.empty-state {
  padding: 20px;
  text-align: center;
  color: #64748B;
  font-size: 12px;
}

/* Utilitarios */
.text-white { color: #F8FAFC; }
.text-green { color: #34D399; }
.text-gold { color: #FBBF24; }
.text-muted { color: #64748B; }

.kpi-pill {
  font-size: 10px;
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

.pill-gold {
  background: rgba(245, 158, 11, 0.15);
  color: #FBBF24;
  border: 1px solid rgba(245, 158, 11, 0.25);
}
</style>
