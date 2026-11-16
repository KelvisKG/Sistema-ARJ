<template>
  <div class="period-filter-card">
    <div class="period-info">
      <div class="period-icon">
        <i class="ti ti-calendar-stats"></i>
      </div>
      <div>
        <div class="period-title">
          Período seleccionado: <span class="period-highlight">{{ etiqueta }}</span>
        </div>
        <div class="period-sub">
          Todos los indicadores de ventas, utilidad, margen y gráficas se actualizan según el rango seleccionado
        </div>
      </div>
    </div>

    <div class="period-controls">
      <label class="period-label">Período:</label>
      <select
        :value="rango"
        class="rp-in period-select"
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

      <span v-if="rango === 'custom'" class="period-custom-inputs">
        <input
          :value="custDesde"
          type="date"
          class="rp-in"
          @input="$emit('update:custDesde', $event.target.value)"
        >
        <span class="period-separator">a</span>
        <input
          :value="custHasta"
          type="date"
          class="rp-in"
          @input="$emit('update:custHasta', $event.target.value)"
        >
        <button
          class="btn btn-primary btn-sm"
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
.period-filter-card {
  background: var(--card-bg, #fff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.period-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.period-icon {
  font-size: 24px;
  color: var(--navy, #0D233A);
  display: flex;
  align-items: center;
}

.period-title {
  font-weight: 700;
  color: var(--navy, #0D233A);
  font-size: 14px;
}

.period-highlight {
  color: var(--gold, #BF8F00);
  text-transform: capitalize;
}

.period-sub {
  font-size: 11.5px;
  color: var(--dgray, #64748B);
}

.period-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.period-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--navy, #0D233A);
}

.period-select {
  font-weight: 600;
  color: var(--navy, #0D233A);
}

.period-custom-inputs {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.period-separator {
  font-size: 11.5px;
  color: var(--dgray, #64748B);
}

.rp-in {
  padding: 5px 8px;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 6px;
  font-size: 12px;
  font-family: inherit;
}
</style>
