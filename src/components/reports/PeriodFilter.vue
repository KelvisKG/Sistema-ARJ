<template>
  <div class="period-filter-card-dark">
    <div class="period-info">
      <div class="period-icon-wrap">
        <i class="ti ti-calendar-stats"></i>
      </div>
      <div>
        <div class="period-header-line">
          <span class="period-title">Período de análisis:</span>
          <span class="period-active-pill">
            <i class="ti ti-point-filled"></i> {{ etiqueta }}
          </span>
        </div>
        <div class="period-sub">
          Métricas de ventas, utilidad, márgenes e inventario sincronizadas en tiempo real
        </div>
      </div>
    </div>

    <div class="period-controls">
      <div class="select-wrapper">
        <select
          :value="rango"
          class="rp-select-dark"
          @change="onSelectChange($event.target.value)"
        >
          <option value="mes">Este mes</option>
          <option value="mes_ant">Mes pasado</option>
          <option value="3m">Últimos 3 meses</option>
          <option value="6m">Últimos 6 meses</option>
          <option value="12m">Últimos 12 meses</option>
          <option value="anio">Este año</option>
          <option value="todo">Todo el histórico</option>
          <option value="custom">Personalizado…</option>
        </select>
        <i class="ti ti-chevron-down select-chevron"></i>
      </div>

      <span v-if="rango === 'custom'" class="period-custom-inputs">
        <input
          :value="custDesde"
          type="date"
          class="rp-date-dark"
          @input="$emit('update:custDesde', $event.target.value)"
        >
        <span class="period-separator">a</span>
        <input
          :value="custHasta"
          type="date"
          class="rp-date-dark"
          @input="$emit('update:custHasta', $event.target.value)"
        >
        <button
          class="btn-apply-dark"
          :disabled="cargando"
          @click="$emit('aplicar')"
        >
          <i v-if="cargando" class="ti ti-loader ti-spin"></i>
          <span v-else>Aplicar</span>
        </button>
      </span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  rango: {
    type: String,
    default: 'mes'
  },
  custDesde: {
    type: String,
    default: ''
  },
  custHasta: {
    type: String,
    default: ''
  },
  etiqueta: {
    type: String,
    default: 'este mes'
  },
  cargando: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:rango', 'update:custDesde', 'update:custHasta', 'cambio', 'aplicar']);

function onSelectChange(val) {
  emit('update:rango', val);
  emit('cambio', val);
}
</script>

<style scoped>
.period-filter-card-dark {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 14px 18px;
  margin-bottom: 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  box-shadow: var(--shadow-md);
}

.period-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.period-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--lblue);
  color: var(--blue);
  border: 1px solid rgba(37, 99, 235, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.period-header-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.period-title {
  font-weight: 700;
  color: var(--text);
  font-size: 14px;
  letter-spacing: -0.01em;
}

.period-active-pill {
  font-size: 11px;
  font-weight: 700;
  text-transform: capitalize;
  letter-spacing: 0.02em;
  padding: 2px 10px;
  border-radius: var(--radius-full);
  background: var(--lgold);
  color: var(--gold);
  border: 1px solid rgba(217, 119, 6, 0.28);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.period-sub {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 2px;
}

.period-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.select-wrapper {
  position: relative;
  display: inline-block;
}

.rp-select-dark {
  appearance: none;
  background: var(--input-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 6px 32px 6px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--trans-fast);
  outline: none;
}

.rp-select-dark:hover, .rp-select-dark:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.select-chevron {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--dgray);
  pointer-events: none;
  font-size: 11px;
}

.period-custom-inputs {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.rp-date-dark {
  background: var(--input-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 5px 8px;
  font-size: 11.5px;
  outline: none;
  color-scheme: light dark;
}

.rp-date-dark:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.period-separator {
  font-size: 11.5px;
  color: var(--dgray);
}

.btn-apply-dark {
  background: var(--blue);
  color: #FFFFFF;
  border: none;
  border-radius: var(--radius-sm);
  padding: 5px 12px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--trans-fast);
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
}

.btn-apply-dark:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
}

.btn-apply-dark:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
