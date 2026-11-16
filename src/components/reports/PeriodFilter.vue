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
  background: #0E1726;
  background: linear-gradient(145deg, #101B2E 0%, #0A111E 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 14px 18px;
  margin-bottom: 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  box-shadow: 0 4px 14px 0 rgba(0, 0, 0, 0.25);
}

.period-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.period-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(37, 99, 235, 0.16);
  color: #38BDF8;
  border: 1px solid rgba(56, 189, 248, 0.25);
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
  color: #F8FAFC;
  font-size: 14px;
  letter-spacing: -0.01em;
}

.period-active-pill {
  font-size: 11px;
  font-weight: 700;
  text-transform: capitalize;
  letter-spacing: 0.02em;
  padding: 2px 10px;
  border-radius: 9999px;
  background: rgba(245, 158, 11, 0.14);
  color: #FBBF24;
  border: 1px solid rgba(245, 158, 11, 0.28);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.period-sub {
  font-size: 11.5px;
  color: #94A3B8;
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
  background: #1E293B;
  color: #F8FAFC;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  padding: 6px 32px 6px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  outline: none;
}

.rp-select-dark:hover, .rp-select-dark:focus {
  border-color: rgba(56, 189, 248, 0.5);
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
}

.select-chevron {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #94A3B8;
  pointer-events: none;
  font-size: 11px;
}

.period-custom-inputs {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.rp-date-dark {
  background: #1E293B;
  color: #F8FAFC;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 11.5px;
  outline: none;
  color-scheme: dark;
}

.rp-date-dark:focus {
  border-color: rgba(56, 189, 248, 0.5);
}

.period-separator {
  font-size: 11.5px;
  color: #94A3B8;
}

.btn-apply-dark {
  background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
}

.btn-apply-dark:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}

.btn-apply-dark:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
