<template>
  <div v-if="store.modalAnularActivo && store.facturaAAnular" class="modal show" id="modal-anular" style="display:flex">
    <div class="modal-content" style="max-width:480px;text-align:left">
      <div class="modal-icon" style="background:#FFEBEE;color:var(--red)">
        <i class="ti ti-alert-triangle"></i>
      </div>
      <h2 style="color:var(--red)">Confirmar Anulación de Factura</h2>
      <p class="modal-sub">
        Vas a anular la factura <strong>{{ store.facturaAAnular.num }}</strong> emitida a <strong>{{ store.facturaAAnular.cliente }}</strong> por <strong>{{ fmtUSD(store.facturaAAnular.total) }}</strong>.
      </p>

      <div style="background:rgba(217,119,6,0.1);border:1px solid rgba(217,119,6,0.25);padding:12px 14px;border-radius:8px;font-size:12.5px;margin-bottom:14px;color:var(--text)">
        <i class="ti ti-info-circle" style="color:var(--gold);margin-right:4px"></i> Al anular la factura, todas las existencias vendidas se devolverán automáticamente al inventario de <strong>{{ store.facturaAAnular.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora' }}</strong>.
      </div>

      <div class="field-col" style="margin-bottom:16px">
        <label>Motivo Obligatorio de Anulación:</label>
        <input
          v-model="motivo"
          type="text"
          class="val-input"
          placeholder="Error de digitación, devolución de cliente, cambio de forma de pago..."
          :class="{ 'is-invalid': errors.motivo }"
          @input="errors.motivo = null"
        >
        <span v-if="errors.motivo" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.motivo }}</span>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" @click="cerrar">Cancelar</button>
        <button class="btn btn-danger" :disabled="!motivo.trim()" @click="confirmarAnulacion">
          <i class="ti ti-trash"></i> Proceder con Anulación
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD } from '../../services/pricing.js';

const store = useArjStore();
const motivo = ref('');
const errors = ref({});

function cerrar() {
  store.modalAnularActivo = false;
  store.facturaAAnular = null;
  motivo.value = '';
  errors.value = {};
}

function confirmarAnulacion() {
  errors.value = {};

  if (!store.facturaAAnular) return;
  if (!motivo.value.trim() || motivo.value.trim().length < 5) {
    errors.value.motivo = 'El motivo es obligatorio (mín. 5 caracteres)';
    store.notif('Indica el motivo de la anulación', 'warning');
    return;
  }

  store.anularFactura(store.facturaAAnular.num, motivo.value.trim());
  cerrar();
}
</script>
