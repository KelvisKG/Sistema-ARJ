<template>
  <div v-if="store.modalEmbarquesActivo" class="modal show" id="modal-embarques" style="display:flex">
    <div class="modal-content" style="max-width:860px;text-align:left;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h2 style="margin:0"><i class="ti ti-ship"></i> Embarques y Costeo Landed</h2>
        <button class="btn btn-secondary btn-sm" @click="cerrar"><i class="ti ti-x"></i></button>
      </div>
      <p class="modal-sub">
        Factor = (1 + % flete/aduana) × (1 + % comisión) × (1 + % divisas). Lo calcula la base de datos.
        Los productos toman el factor cuando se <strong>sellan</strong> en una recepción con este embarque.
      </p>

      <!-- FORMULARIO -->
      <div class="card" style="margin-bottom:14px">
        <div class="card-tit">{{ form.id ? 'Editando: ' + form.codigo : 'Nuevo embarque' }}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          <div class="field-col"><label>Código *</label><input v-model="form.codigo" class="val-input" placeholder="PROVEEDOR-2026-01"></div>
          <div class="field-col"><label>Proveedor *</label><input v-model="form.proveedor" class="val-input"></div>
          <div class="field-col"><label>Fecha de llegada</label><input v-model="form.fecha_llegada" type="date" class="val-input"></div>
          <div class="field-col"><label>FOB total ($)</label><input v-model.number="form.fob_total" type="number" step="0.01" class="val-input" @input="recalcPctFlete"></div>
          <div class="field-col"><label>Flete + aduana ($)</label><input v-model.number="form.monto_flete_aduana" type="number" step="0.01" class="val-input" @input="recalcPctFlete"></div>
          <div class="field-col"><label>% flete/aduana</label><input v-model.number="form.pct_flete_aduana" type="number" step="0.0001" class="val-input"></div>
          <div class="field-col"><label>% comisión</label><input v-model.number="form.pct_comision" type="number" step="0.01" class="val-input"></div>
          <div class="field-col"><label>% compra de divisas</label><input v-model.number="form.pct_divisas" type="number" step="0.01" class="val-input"></div>
          <div class="field-col" style="justify-content:flex-end">
            <div v-if="form.pct_flete_aduana > 0" style="font-size:15px;font-weight:700;color:var(--navy)">Factor: {{ factorPreview.toFixed(4) }}</div>
            <div v-if="form.pct_flete_aduana > 0" style="font-size:11px;color:var(--dgray)">FOB $10 cuesta {{ fmtUSD(10 * factorPreview) }}</div>
            <div v-else style="font-size:11px;color:var(--dgray)">Escribe el monto o el % de flete</div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
          <button v-if="form.id" class="btn btn-secondary btn-sm" @click="limpiar">Cancelar edición</button>
          <button class="btn btn-primary btn-sm" :disabled="guardando" @click="guardar">
            <i class="ti ti-check"></i> {{ guardando ? 'Guardando...' : (form.id ? 'Guardar cambios' : 'Crear embarque') }}
          </button>
        </div>
      </div>

      <!-- LISTA -->
      <table class="tbl" style="font-size:12px">
        <thead>
          <tr>
            <th>Código</th><th>Proveedor</th><th>Llegada</th>
            <th class="num">% Flete</th><th class="num">% Com.</th><th class="num">% Div.</th>
            <th class="num">Factor</th><th class="num">Sellados</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="store.embarques.length === 0"><td colspan="9" style="text-align:center;padding:16px;color:var(--dgray)">No hay embarques registrados.</td></tr>
          <tr v-for="e in store.embarques" :key="e.id">
            <td><strong>{{ e.codigo }}</strong></td>
            <td>{{ e.proveedor }}</td>
            <td>{{ e.fecha_llegada || '—' }}</td>
            <td class="num">{{ Number(e.pct_flete_aduana || 0).toFixed(2) }}</td>
            <td class="num">{{ Number(e.pct_comision || 0).toFixed(2) }}</td>
            <td class="num">{{ Number(e.pct_divisas || 0).toFixed(2) }}</td>
            <td class="num"><strong>{{ Number(e.factor || 0).toFixed(4) }}</strong></td>
            <td class="num">
              {{ sellados(e).total }}
              <span v-if="sellados(e).desfasados" style="color:var(--red)" :title="sellados(e).desfasados + ' con factor distinto al del embarque'"> ({{ sellados(e).desfasados }} ⚠)</span>
            </td>
            <td style="white-space:nowrap">
              <button class="btn btn-secondary btn-sm" style="padding:2px 6px" title="Editar" @click="editar(e)"><i class="ti ti-pencil"></i></button>
              <button class="btn btn-secondary btn-sm" style="padding:2px 6px" title="Llevar el factor a sus productos" :disabled="!sellados(e).desfasados" @click="recalcular(e)"><i class="ti ti-refresh"></i></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD } from '../../services/pricing.js';

const store = useArjStore();
const vacio = () => ({ id: null, codigo: '', proveedor: '', fecha_llegada: '', fob_total: null, monto_flete_aduana: null, pct_flete_aduana: 0, pct_comision: 2, pct_divisas: 25 });
const form = ref(vacio());
const guardando = ref(false);

// Misma fórmula que la columna generada en la BD (monolito v13.10)
const factorPreview = computed(() =>
  (1 + (parseFloat(form.value.pct_flete_aduana) || 0) / 100) *
  (1 + (parseFloat(form.value.pct_comision) || 0) / 100) *
  (1 + (parseFloat(form.value.pct_divisas) || 0) / 100)
);

function recalcPctFlete() {
  const fob = parseFloat(form.value.fob_total) || 0;
  const fle = parseFloat(form.value.monto_flete_aduana) || 0;
  if (fob > 0) form.value.pct_flete_aduana = Math.round(fle / fob * 100 * 10000) / 10000;
}

function sellados(e) {
  const prods = store.productos.filter(p => p.embarque_id === e.id);
  const f = parseFloat(e.factor) || 0;
  return { total: prods.length, desfasados: prods.filter(p => Math.abs((parseFloat(p.factor_landed) || 0) - f) > 0.000001).length };
}

function editar(e) {
  form.value = { ...vacio(), ...e };
}
function limpiar() {
  form.value = vacio();
}

async function guardar() {
  if (!form.value.codigo.trim() || !form.value.proveedor.trim()) {
    store.notif('Código y proveedor son obligatorios', 'error');
    return;
  }
  guardando.value = true;
  try {
    const { factor, created_at, updated_at, activo, ...datos } = form.value;
    if (await store.guardarEmbarque(datos)) limpiar();
  } finally {
    guardando.value = false;
  }
}

async function recalcular(e) {
  const s = sellados(e);
  if (!confirm(`Recalcular ${s.desfasados} producto(s) de ${e.codigo} al factor ${Number(e.factor).toFixed(4)}.\n\nLas facturas ya emitidas NO cambian. Los precios de venta no se tocan: solo cambia el costo (el margen).\n\n¿Aplicar?`)) return;
  await store.recalcularEmbarque(e);
}

function cerrar() {
  store.modalEmbarquesActivo = false;
  limpiar();
}
</script>
