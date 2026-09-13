<template>
  <div v-if="store.modalTraspasoActivo" class="modal show" id="modal-traspaso" style="display:flex">
    <div class="modal-content" style="max-width:550px;text-align:left">
      <div class="modal-icon" style="background:#E3F2FD;color:var(--blue)">
        <i class="ti ti-arrows-exchange"></i>
      </div>
      <h2>Despachar Mercancía a Venta Directa</h2>
      <p class="modal-sub">
        Transfiere existencias desde el almacén mayorista de <strong>Distribuidora ARJ</strong> hacia el mostrador de <strong>Venta Directa</strong>.
      </p>

      <div class="field-col">
        <label>Repuesto a Despachar *</label>
        <select v-model="productoId" class="val-input"
          :class="{ 'is-invalid': errors.producto }" @change="errors.producto = null">
          <option value="">-- Selecciona un repuesto con existencia --</option>
          <option v-for="p in productosConStockDist" :key="p.id" :value="p.id">
            {{ p.cod_alt }} - {{ p.desc }} (Disponible en Dist: {{ p.stock_dist }} un.)
          </option>
        </select>
        <span v-if="errors.producto" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.producto }}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="field-col" style="margin-bottom:0">
          <label>Cantidad a Traspasar *</label>
          <input
            v-model.number="cantidad"
            type="number"
            min="1"
            :max="maxStockDist"
            placeholder="1"
            class="val-input"
            style="font-weight:700"
            :class="{ 'is-invalid': errors.cantidad }"
            @input="errors.cantidad = null"
          >
          <span v-if="errors.cantidad" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.cantidad }}</span>
        </div>
        <div class="field-col" style="margin-bottom:0">
          <label>Stock Actual en Directa</label>
          <div style="padding:9px 12px;background:var(--gray);border:1.5px solid var(--border);border-radius:var(--radius-sm);font-weight:700">
            {{ stockActualVD }} unidades
          </div>
        </div>
      </div>

      <div class="field-col" style="margin-bottom:18px">
        <label>Motivo del Despacho / Nota de Entrega</label>
        <input
          v-model="motivo"
          type="text"
          placeholder="Reposición mostrador semanal, pedido de cliente..."
          class="val-input"
        >
      </div>

      <div class="actions" style="display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-secondary" @click="store.modalTraspasoActivo = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="!productoId || cantidad <= 0" @click="confirmarTraspaso">
          <i class="ti ti-check"></i> Ejecutar Despacho
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';

const store = useArjStore();
const productoId = ref('');
const cantidad = ref(1);
const motivo = ref('');

const productosConStockDist = computed(() => {
  return store.productos.filter(p => p.stock_dist > 0);
});

const productoSeleccionado = computed(() => {
  return store.productos.find(p => p.id === productoId.value);
});

const maxStockDist = computed(() => {
  return productoSeleccionado.value ? productoSeleccionado.value.stock_dist : 999;
});

const stockActualVD = computed(() => {
  return productoSeleccionado.value ? productoSeleccionado.value.stock_vd : 0;
});

const errors = ref({});

function confirmarTraspaso() {
  errors.value = {};

  if (!productoId.value) {
    errors.value.producto = 'Selecciona un repuesto';
  }
  if (!cantidad.value || cantidad.value <= 0) {
    errors.value.cantidad = 'La cantidad debe ser mayor a 0';
  } else if (productoSeleccionado.value && cantidad.value > productoSeleccionado.value.stock_dist) {
    errors.value.cantidad = `Máximo disponible: ${productoSeleccionado.value.stock_dist} ud`;
  }

  if (Object.keys(errors.value).length > 0) {
    store.notif('Corrige los campos marcados en rojo', 'warning');
    return;
  }

  const ok = store.ejecutarTraspaso(productoId.value, cantidad.value, motivo.value);
  if (ok) {
    store.modalTraspasoActivo = false;
    productoId.value = '';
    cantidad.value = 1;
    motivo.value = '';
    errors.value = {};
  }
}
</script>
