<template>
  <div v-if="store.modalEditProdActivo && store.productoSeleccionado" class="modal show" id="modal-edit-prod" style="display:flex">
    <div class="modal-content" style="max-width:680px;text-align:left">
      <div class="modal-icon" style="background:rgba(217,119,6,0.12);color:var(--gold)">
        <i class="ti ti-edit"></i>
      </div>
      <h2>Editar Ficha de Repuesto Agrícola</h2>
      <p class="modal-sub">
        Actualiza códigos, costo FOB, factor landed, precios manuales o datos de aplicación.
      </p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="field-col">
          <label>Código Alternativo: *</label>
          <input v-model="form.cod_alt" type="text" class="val-input" placeholder="Ej: HF6510"
            :class="{ 'is-invalid': errors.cod_alt }" @input="errors.cod_alt = null">
          <span v-if="errors.cod_alt" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.cod_alt }}</span>
        </div>
        <div class="field-col">
          <label>Código OEM / Original:</label>
          <input v-model="form.cod_orig" type="text" class="val-input" placeholder="Ej: 8421456">
        </div>
      </div>

      <div class="field-col" style="margin-bottom:12px">
        <label>Descripción del Repuesto: *</label>
        <input v-model="form.desc" type="text" class="val-input" placeholder="Nombre completo o especificación"
          :class="{ 'is-invalid': errors.desc }" @input="errors.desc = null">
        <span v-if="errors.desc" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.desc }}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="field-col">
          <label>Marca:</label>
          <input v-model="form.marca" type="text" class="val-input" placeholder="Fleetguard, CNH...">
        </div>
        <div class="field-col">
          <label>Aplicación:</label>
          <input v-model="form.marca_modelo" type="text" class="val-input" placeholder="Case IH, Ford...">
        </div>
        <div class="field-col">
          <label>Sistema Mecánico:</label>
          <select v-model="form.sistema" class="val-input">
            <option value="Motor">Motor</option>
            <option value="Sistema hidráulico">Sistema hidráulico</option>
            <option value="Embrague">Embrague</option>
            <option value="Sistema de enfriamiento">Sistema de enfriamiento</option>
            <option value="Eléctrico">Eléctrico</option>
            <option value="Filtros">Filtros</option>
            <option value="Inyección Diésel">Inyección Diésel</option>
            <option value="Frenos">Frenos</option>
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="field-col">
          <label>Costo FOB (USD): *</label>
          <input v-model.number="form.fob" type="number" step="0.5" class="val-input" style="font-weight:700;color:var(--primary)"
            :class="{ 'is-invalid': errors.fob }" @input="errors.fob = null">
          <span v-if="errors.fob" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.fob }}</span>
        </div>
        <div class="field-col">
          <label>Factor Landed:</label>
          <input v-model.number="form.factor_landed" type="number" step="0.01" class="val-input"
            :class="{ 'is-invalid': errors.factor_landed }" @input="errors.factor_landed = null">
          <span v-if="errors.factor_landed" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.factor_landed }}</span>
        </div>
        <div class="field-col">
          <label>Precio Fijo ($):</label>
          <input v-model.number="form.precio_manual" type="number" step="0.5" placeholder="Opcional" class="val-input">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div class="field-col">
          <label>Stock Venta Directa:</label>
          <input v-model.number="form.stock_vd" type="number" class="val-input"
            :class="{ 'is-invalid': errors.stock_vd }" @input="errors.stock_vd = null">
          <span v-if="errors.stock_vd" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.stock_vd }}</span>
        </div>
        <div class="field-col">
          <label>Stock Distribuidora:</label>
          <input v-model.number="form.stock_dist" type="number" class="val-input"
            :class="{ 'is-invalid': errors.stock_dist }" @input="errors.stock_dist = null">
          <span v-if="errors.stock_dist" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.stock_dist }}</span>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-danger" style="margin-right:auto" :disabled="guardando" @click="darDeBaja"><i class="ti ti-archive"></i> Dar de baja</button>
        <button class="btn btn-secondary" @click="cerrarModal">Cancelar</button>
        <button class="btn btn-primary" :disabled="guardando" @click="guardarCambios">
          <i class="ti ti-check"></i> Guardar Cambios
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { isNonEmpty, isPositiveNumber } from '../../services/validators.js';

const store = useArjStore();
const form = ref({});
const errors = ref({});
const guardando = ref(false);

watch(() => store.productoSeleccionado, (prod) => {
  if (prod) {
    form.value = { ...prod };
    errors.value = {};
  }
}, { immediate: true });

function cerrarModal() {
  store.modalEditProdActivo = false;
  store.productoSeleccionado = null;
  errors.value = {};
}

async function guardarCambios() {
  if (!store.productoSeleccionado) return;
  errors.value = {};
  if (!isNonEmpty(form.value.cod_alt, 2)) errors.value.cod_alt = 'El código es obligatorio (mín. 2 caracteres)';
  if (!isNonEmpty(form.value.desc, 3)) errors.value.desc = 'La descripción es obligatoria (mín. 3 caracteres)';
  if (!isPositiveNumber(form.value.fob)) errors.value.fob = 'El FOB debe ser mayor a 0';
  if (form.value.factor_landed != null && form.value.factor_landed !== '' && form.value.factor_landed < 1) errors.value.factor_landed = 'El factor landed debe ser ≥ 1';
  if (form.value.stock_vd < 0) errors.value.stock_vd = 'El stock no puede ser negativo';
  if (form.value.stock_dist < 0) errors.value.stock_dist = 'El stock no puede ser negativo';
  if (Object.keys(errors.value).length > 0) {
    store.notif('Corrige los campos marcados en rojo', 'warning');
    return;
  }
  guardando.value = true;
  try {
    // C-01: se guarda en la base de datos; la pantalla se refresca desde ahí
    const ok = await store.guardarProducto({ ...form.value, id: store.productoSeleccionado.id });
    if (ok) cerrarModal();
  } finally {
    guardando.value = false;
  }
}

async function darDeBaja() {
  const p = store.productoSeleccionado;
  if (!p) return;
  if (!confirm(`¿Dar de baja ${p.cod_alt} (${p.desc})?\n\nNo se borra: deja de aparecer en el catálogo. Las facturas viejas no cambian.`)) return;
  if (await store.desactivarProducto(p)) cerrarModal();
}
</script>
