<template>
  <div v-if="store.modalDtoDivisaActivo" class="modal show" id="modal-dto-divisa" style="display:flex">
    <div class="modal-content" style="max-width:520px;text-align:left">
      <div class="modal-icon" style="background:#E8F5E9;color:var(--green)">
        <i class="ti ti-currency-dollar"></i>
      </div>
      <h2>Descuento por Pago en Divisas</h2>
      <p class="modal-sub">
        Los precios de ARJ están fijados en <strong>$ BCV</strong>. Una divisa física vale más que un dólar oficial, por lo que saldar la factura requiere menos efectivo físico.
      </p>

      <div style="background:var(--bg);border:1px solid var(--border);padding:12px 14px;border-radius:8px;margin-bottom:14px;font-size:12.5px;color:var(--text)">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:var(--text-muted)">Tasa BCV oficial:</span>
          <strong>Bs. {{ store.tasa_bcv }}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:var(--text-muted)">Tasa Paralelo del día:</span>
          <strong>Bs. {{ store.tasa_par }}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:6px;margin-top:6px;color:var(--primary);font-weight:600">
          <span>Descuento neutro exacto (sin regalar margen):</span>
          <strong>{{ store.dtoDivisaNeutro.toFixed(2) }}%</strong>
        </div>
      </div>

      <div class="field-col" style="margin-bottom:14px">
        <label>Porcentaje de Descuento en Divisas (%):</label>
        <div style="display:flex;gap:10px;align-items:center;margin-top:4px">
          <input
            v-model.number="dtoInput"
            type="number"
            step="0.5"
            min="0"
            max="60"
            class="val-input"
            style="width:110px;font-size:15px;font-weight:700;text-align:right"
            :class="{ 'is-invalid': errors.dto }"
            @input="errors.dto = null"
          >
          <span v-if="errors.dto" class="field-error" style="margin-top:4px;display:block"><i class="ti ti-alert-circle"></i> {{ errors.dto }}</span>
          <button class="btn btn-secondary btn-sm" @click="aplicarNeutro">
            Usar Neutro ({{ store.dtoDivisaNeutro.toFixed(1) }}%)
          </button>
        </div>
      </div>

      <!-- SIMULACIÓN EN VIVO -->
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-size:12.5px;line-height:1.5;margin-bottom:16px;color:var(--text)">
        <div>
          Factura de <strong style="color:var(--primary)">{{ fmtUSD(store.totalCarritoUSD) }}</strong> BCV &rarr; cobras <strong style="color:var(--green)">{{ fmtUSD(montoACobrarVerde) }}</strong> en divisas en efectivo.
        </div>
        <div v-if="puntosRegalados > 0.001" style="color:var(--red);margin-top:6px">
          <i class="ti ti-alert-triangle"></i> Regalas <strong>{{ puntosRegalados.toFixed(1) }} puntos</strong> por encima de la brecha. Se registra como descuento de margen.
        </div>
        <div v-else-if="puntosRegalados < -0.001" style="color:var(--gold);margin-top:6px">
          <i class="ti ti-info-circle"></i> Cobras <strong>{{ Math.abs(puntosRegalados).toFixed(1) }} puntos</strong> por debajo de la brecha neutral.
        </div>
        <div v-else style="color:var(--green);margin-top:6px">
          <i class="ti ti-check"></i> Conversión neutral perfecta. La empresa no regala utilidad.
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" @click="store.modalDtoDivisaActivo = false">Cerrar</button>
        <button class="btn btn-success" @click="guardarDescuento">
          <i class="ti ti-check"></i> Aplicar Parámetro
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD } from '../../services/pricing.js';

const store = useArjStore();
const dtoInput = ref(0);
const errors = ref({});

// Cada vez que se abre, parte del % vigente (el del gerente o la brecha del día)
watch(() => store.modalDtoDivisaActivo, (abierto) => {
  if (abierto) {
    dtoInput.value = Math.round(store.dtoDivisaPct * 10) / 10;
    errors.value = {};
  }
}, { immediate: true });

const montoACobrarVerde = computed(() => {
  const v = parseFloat(dtoInput.value) || 0;
  return Math.round(store.totales.subtotal * (1 - v / 100) * 100) / 100;
});

const puntosRegalados = computed(() => (parseFloat(dtoInput.value) || 0) - store.dtoDivisaNeutro);

function aplicarNeutro() {
  dtoInput.value = parseFloat(store.dtoDivisaNeutro.toFixed(1));
  errors.value.dto = null;
}

function guardarDescuento() {
  errors.value = {};
  const v = parseFloat(dtoInput.value);
  if (!Number.isFinite(v) || v < 0 || v > 60) {
    errors.value.dto = 'El porcentaje debe estar entre 0% y 60%';
    return;
  }
  // Si coincide con la brecha, se deja en null: la próxima vez sigue a la brecha del día
  store.fijarDtoDivisa(Math.abs(v - store.dtoDivisaNeutro) < 0.05 ? null : v);
  store.modalDtoDivisaActivo = false;
  store.notif(`Descuento por divisas: ${v.toFixed(1)}%`, 'success');
}
</script>
