<template>
  <div v-if="store.modalDtoManualActivo" class="modal show" id="modal-dto-manual" style="display:flex">
    <div class="modal-content" style="max-width:480px;text-align:left">
      <div class="modal-icon" style="background:#FFF3E0;color:var(--gold)">
        <i class="ti ti-discount"></i>
      </div>
      <h2>Descuento Manual por Gerencia</h2>
      <p class="modal-sub">
        Aplica un porcentaje de descuento comercial especial para la venta actual en <strong>ARJ Venta Directa</strong>.
      </p>

      <div class="field-col" style="margin-bottom:14px">
        <label>Porcentaje de Descuento (0% - 50%):</label>
        <input
          v-model.number="pctInput"
          type="number"
          min="0"
          max="50"
          step="1"
          placeholder="Ej: 10"
          class="val-input"
          style="font-size:16px;font-weight:700"
          :class="{ 'is-invalid': errors.pct }"
          @input="errors.pct = null"
        >
        <span v-if="errors.pct" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.pct }}</span>
      </div>

      <div class="field-col" style="margin-bottom:14px">
        <label>Motivo Comercial Obligatorio:</label>
        <input
          v-model="motivoInput"
          type="text"
          placeholder="Ej: Cliente VIP, compra por volumen, atención especial..."
          class="val-input"
          :class="{ 'is-invalid': errors.motivo }"
          @input="errors.motivo = null"
        >
        <span v-if="errors.motivo" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.motivo }}</span>
      </div>

      <!-- PREVIEW -->
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-size:12.5px;margin-bottom:16px;color:var(--text)">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="color:var(--text-muted)">Subtotal sin descuento:</span>
          <strong>{{ fmtUSD(store.subtotalCarrito) }}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:var(--red)">
          <span>Descuento ({{ pctInput }}%):</span>
          <strong>−{{ fmtUSD(montoDescuento) }}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:6px;margin-top:6px;color:var(--green);font-size:14px;font-weight:700">
          <span>Total final a cobrar:</span>
          <strong>{{ fmtUSD(totalConDescuento) }}</strong>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" @click="store.modalDtoManualActivo = false">Cancelar</button>
        <button class="btn btn-primary" @click="confirmarDescuento">
          <i class="ti ti-check"></i> Aplicar Descuento
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD } from '../../services/pricing.js';

const store = useArjStore();
const pctInput = ref(store.carrito.descuento_manual || 0);
const motivoInput = ref(store.carrito.descuento_motivo || '');
const errors = ref({});

const montoDescuento = computed(() => {
  if (pctInput.value <= 0) return 0;
  return store.subtotalCarrito * (pctInput.value / 100);
});

const totalConDescuento = computed(() => {
  return Math.max(0, store.subtotalCarrito - montoDescuento.value);
});

function confirmarDescuento() {
  errors.value = {};

  if (pctInput.value < 0 || pctInput.value > 50) {
    errors.value.pct = 'El porcentaje debe estar entre 0% y 50%';
  }
  if (pctInput.value > 0 && !motivoInput.value.trim()) {
    errors.value.motivo = 'Indica el motivo del descuento';
  }

  if (Object.keys(errors.value).length > 0) {
    store.notif('Corrige los campos marcados en rojo', 'warning');
    return;
  }

  store.aplicarDescuentoManual(pctInput.value, motivoInput.value);
  store.modalDtoManualActivo = false;
}
</script>
