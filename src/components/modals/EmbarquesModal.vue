<template>
  <div v-if="store.modalEmbarquesActivo" class="modal show" id="modal-embarques" style="display:flex">
    <div class="modal-content" style="max-width:700px;text-align:left">
      <div class="modal-icon" style="background:#E1F5FE;color:var(--blue)">
        <i class="ti ti-ship"></i>
      </div>
      <h2>Embarques de Importación y Costeo Landed</h2>
      <p class="modal-sub">
        Gestión de fletes marítimos/aéreos, aranceles aduaneros y costeo real de repuestos puestos en almacén.
      </p>

      <div style="background:#F4F6F9;padding:12px;border-radius:8px;margin-bottom:14px;font-size:12px;line-height:1.5">
        <i class="ti ti-info-circle"></i> <strong>Regla del Factor Landed:</strong>
        El costo en libros de cada repuesto importado se calcula multiplicando el FOB por el factor de nacionalización y flete (por defecto <strong>1.471</strong>).
      </div>

      <!-- LISTA DE EMBARQUES -->
      <table class="tbl" style="margin-bottom:14px">
        <thead>
          <tr>
            <th>N° Embarque</th>
            <th>Proveedor</th>
            <th>Fecha</th>
            <th class="num">FOB Total</th>
            <th class="num">Factor Landed</th>
            <th class="center">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in store.embarques" :key="e.id">
            <td><strong>{{ e.id }}</strong></td>
            <td>{{ e.proveedor }}</td>
            <td style="font-size:12px">{{ e.fecha }}</td>
            <td class="num">{{ fmtUSD(e.fob_total) }}</td>
            <td class="num" style="font-weight:700;color:var(--navy)">×{{ e.factor_landed }}</td>
            <td class="center">
              <span class="badge badge-success">{{ e.estado.toUpperCase() }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- FORMULARIO NUEVO EMBARQUE -->
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <i class="ti ti-ship" style="color:var(--primary);font-size:16px"></i>
          <strong style="font-size:13px;color:var(--text)">Registrar Nuevo Embarque de Repuestos</strong>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field-col">
            <label>Proveedor: *</label>
            <input v-model="nuevoEmb.proveedor" type="text" placeholder="Ej: Donaldson Latam, CNH Parts..." class="val-input"
              :class="{ 'is-invalid': errors.proveedor }" @input="errors.proveedor = null">
            <span v-if="errors.proveedor" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.proveedor }}</span>
          </div>
          <div class="field-col">
            <label>FOB Estimado Total (USD): *</label>
            <input v-model.number="nuevoEmb.fob" type="number" placeholder="10000.00" class="val-input"
              :class="{ 'is-invalid': errors.fob }" @input="errors.fob = null">
            <span v-if="errors.fob" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.fob }}</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px">
          <div class="field-col">
            <label>Flete Internacional ($):</label>
            <input v-model.number="nuevoEmb.flete" type="number" placeholder="1500.00" class="val-input">
          </div>
          <div class="field-col">
            <label>Aduana / Aranceles ($):</label>
            <input v-model.number="nuevoEmb.aduana" type="number" placeholder="2000.00" class="val-input">
          </div>
          <div class="field-col">
            <label>% Divisas Oficial:</label>
            <input v-model.number="nuevoEmb.pct_divisas" type="number" placeholder="25%" class="val-input">
          </div>
        </div>
        <div style="margin-top:14px;text-align:right">
          <button class="btn btn-primary btn-sm" :disabled="!nuevoEmb.proveedor" @click="agregarEmbarque">
            <i class="ti ti-plus"></i> Guardar Embarque
          </button>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" @click="store.modalEmbarquesActivo = false">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD } from '../../services/pricing.js';

const store = useArjStore();
const nuevoEmb = ref({
  proveedor: '',
  fob: 0,
  flete: 0,
  aduana: 0,
  pct_divisas: 25
});

const errors = ref({});

function agregarEmbarque() {
  errors.value = {};

  if (!nuevoEmb.value.proveedor || nuevoEmb.value.proveedor.trim().length < 2) {
    errors.value.proveedor = 'El proveedor es obligatorio (mín. 2 caracteres)';
  }
  if (!nuevoEmb.value.fob || nuevoEmb.value.fob <= 0) {
    errors.value.fob = 'El FOB debe ser mayor a 0';
  }

  if (Object.keys(errors.value).length > 0) {
    store.notif('Corrige los campos marcados en rojo', 'warning');
    return;
  }

  const numId = `EMB-2026-0${store.embarques.length + 1}`;
  const factor = nuevoEmb.value.fob > 0
    ? (1 + (nuevoEmb.value.flete + nuevoEmb.value.aduana) / nuevoEmb.value.fob).toFixed(3)
    : 1.471;

  store.embarques.unshift({
    id: numId,
    proveedor: nuevoEmb.value.proveedor,
    fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
    estado: 'en tránsito',
    fob_total: nuevoEmb.value.fob,
    flete: nuevoEmb.value.flete,
    aduana: nuevoEmb.value.aduana,
    pct_divisas: nuevoEmb.value.pct_divisas,
    factor_landed: parseFloat(factor),
    items_count: 0
  });

  store.logBitacora('embarque', `Embarque ${numId} registrado (${nuevoEmb.value.proveedor})`);
  store.notif(`Embarque ${numId} creado con factor landed x${factor}`, 'success');
  nuevoEmb.value = { proveedor: '', fob: 0, flete: 0, aduana: 0, pct_divisas: 25 };
  errors.value = {};
}
</script>
