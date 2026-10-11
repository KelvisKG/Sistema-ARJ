<template>
  <!-- Modal Embarques del monolito v13.10 -->
  <div v-if="store.modalEmbarquesActivo" class="modal show" id="modal-embarques">
    <div class="modal-content" style="max-width:720px;text-align:left;max-height:92vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:12px">
        <h3 style="margin:0;font-size:18px;color:var(--navy);font-weight:600"><i class="ti ti-ship"></i> Embarques</h3>
        <button class="btn btn-secondary btn-sm" @click="cerrar"><i class="ti ti-x"></i></button>
      </div>
      <div style="background:#FFF8E1;border-left:3px solid var(--gold);border-radius:6px;padding:9px 12px;margin-bottom:14px;font-size:11.5px;color:#5D4037">
        <i class="ti ti-info-circle"></i> El <strong>factor</strong> se calcula solo. Editar un embarque <strong>no cambia</strong> el costo de la mercancía ya recibida: ese queda sellado al momento de recibirla.
      </div>

      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px">
        <div v-if="!store.embarques.length" style="padding:18px;text-align:center;color:var(--dgray);font-size:12.5px">Todavía no hay embarques cargados.</div>
        <table v-else style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--navy);color:#fff">
            <th style="padding:7px 9px;text-align:left">Código</th>
            <th style="padding:7px 9px;text-align:left">Proveedor</th>
            <th style="padding:7px 9px;text-align:right">Llegada</th>
            <th style="padding:7px 9px;text-align:right">Factor</th>
            <th style="padding:7px 9px;text-align:right">Piezas</th>
            <th style="padding:7px 9px"></th>
          </tr></thead>
          <tbody>
            <tr v-for="e in store.embarques" :key="e.id" style="border-bottom:1px solid var(--gray)">
              <td style="padding:7px 9px;font-weight:600">{{ e.codigo }}</td>
              <td style="padding:7px 9px">{{ e.proveedor || '' }}</td>
              <td style="padding:7px 9px;text-align:right">{{ e.fecha_llegada || '—' }}</td>
              <td style="padding:7px 9px;text-align:right;font-weight:600">{{ (parseFloat(e.factor) || 0).toFixed(4) }}</td>
              <td style="padding:7px 9px;text-align:right">{{ store.productos.filter(p => p.embarque_id === e.id).length }}</td>
              <td style="padding:7px 9px;text-align:right;white-space:nowrap">
                <button class="btn btn-secondary btn-sm" @click="editar(e)"><i class="ti ti-pencil"></i></button>
                {{ ' ' }}
                <button class="btn btn-secondary btn-sm" title="Recalcular costos de este embarque" @click="recalcular(e)"><i class="ti ti-refresh"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:#FAFAFA">
        <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:10px">{{ form.id ? 'Editando: ' + form.codigoOriginal : 'Nuevo embarque' }}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label class="emb-lbl">Código</label>
            <input v-model="form.codigo" type="text" class="val-input" placeholder="PANEGOSSI-2026-01" style="width:100%;text-transform:uppercase">
          </div>
          <div>
            <label class="emb-lbl">Proveedor</label>
            <input v-model="form.proveedor" type="text" class="val-input" placeholder="PANEGOSSI" style="width:100%;text-transform:uppercase">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label class="emb-lbl">Fecha llegada</label>
            <input v-model="form.fecha" type="date" class="val-input" style="width:100%">
          </div>
          <div>
            <label class="emb-lbl">FOB total USD</label>
            <input v-model="form.fob" type="number" step="0.01" class="val-input" placeholder="10181.00" style="width:100%" @input="recalcDesdeMontos">
          </div>
          <div>
            <label class="emb-lbl">Monto flete+aduana USD</label>
            <input v-model="form.flete" type="number" step="0.01" class="val-input" placeholder="3686.28" style="width:100%" @input="recalcDesdeMontos">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
          <div>
            <label class="emb-lbl">% sobre FOB (se calcula solo)</label>
            <input v-model="form.pf" type="number" step="0.0001" class="val-input" style="width:100%">
          </div>
          <div>
            <label class="emb-lbl">% comisión banco</label>
            <input v-model="form.pc" type="number" step="0.0001" class="val-input" style="width:100%">
          </div>
          <div>
            <label class="emb-lbl">% compra divisas</label>
            <input v-model="form.pd" type="number" step="0.0001" class="val-input" style="width:100%">
          </div>
        </div>
        <div style="background:var(--navy);color:#fff;border-radius:6px;padding:10px 12px;font-size:12.5px;margin-bottom:10px">
          <div v-if="pf <= 0" style="font-size:12px;opacity:.7">Escribe el monto o el % de flete para ver el factor.</div>
          <template v-else>
            <div style="font-size:15px;font-weight:600">Factor landed: {{ factor.toFixed(4) }}</div>
            <div style="font-size:11px;opacity:.75;margin-top:2px">Una pieza de FOB $10 te cuesta {{ fmtUSD(10 * factor) }}</div>
            <div style="display:flex;gap:10px;margin-top:7px;font-size:11px;flex-wrap:wrap">
              <span v-for="t in tramos" :key="t.lab">FOB {{ t.lab }}: <strong :style="{ color: t.mg < 30 ? 'var(--gold)' : '#8BC34A' }">{{ t.mg.toFixed(1) }}%</strong></span>
            </div>
          </template>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary btn-sm" @click="limpiar">Limpiar</button>
          <button class="btn btn-primary btn-sm" :disabled="guardando" @click="guardar">
            <template v-if="guardando">Guardando...</template>
            <template v-else><i class="ti ti-check"></i> {{ form.id ? 'Guardar cambios' : 'Guardar embarque' }}</template>
          </button>
        </div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;border-top:1px solid var(--gray);padding-top:12px">
        <button class="btn btn-secondary" @click="cerrar">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD } from '../../services/pricing.js';

const store = useArjStore();
const vacio = () => ({ id: null, codigoOriginal: '', codigo: '', proveedor: '', fecha: '', fob: '', flete: '', pf: '', pc: 2, pd: 25 });
const form = ref(vacio());
const guardando = ref(false);

watch(() => store.modalEmbarquesActivo, abierto => { if (abierto) limpiar(); });

const pf = computed(() => parseFloat(form.value.pf) || 0);
// Misma fórmula que la columna generada en la BD
const factor = computed(() => (1 + pf.value / 100) * (1 + (parseFloat(form.value.pc) || 0) / 100) * (1 + (parseFloat(form.value.pd) || 0) / 100));
// Margen que deja el escalón automático de precio en cada tramo de FOB
const tramos = computed(() => [['<$2', 5], ['$2-5', 4], ['$5-10', 3], ['≥$10', 2.5]]
  .map(([lab, m]) => ({ lab, mg: 100 * (m - factor.value) / m })));

// Al escribir los montos se calcula el %; si se escribe el % a mano, no se pisa
function recalcDesdeMontos() {
  const fob = parseFloat(form.value.fob) || 0;
  const fle = parseFloat(form.value.flete) || 0;
  if (fob > 0) form.value.pf = (fle / fob * 100).toFixed(4);
}

function limpiar() { form.value = vacio(); }

function editar(e) {
  form.value = {
    id: e.id, codigoOriginal: e.codigo, codigo: e.codigo || '', proveedor: e.proveedor || '', fecha: e.fecha_llegada || '',
    fob: e.fob_total ?? '', flete: e.monto_flete_aduana ?? '', pf: e.pct_flete_aduana ?? '',
    pc: e.pct_comision ?? 2, pd: e.pct_divisas ?? 25
  };
}

async function guardar() {
  if (store.rol !== 'gerente') { store.notif('Solo el gerente puede gestionar embarques', 'error'); return; }
  const codigo = String(form.value.codigo || '').trim().toUpperCase();
  const proveedor = String(form.value.proveedor || '').trim().toUpperCase();
  if (!codigo) { store.notif('El código es obligatorio', 'error'); return; }
  if (!proveedor) { store.notif('El proveedor es obligatorio', 'error'); return; }
  const p1 = parseFloat(form.value.pf) || 0;
  const p2 = parseFloat(form.value.pc) || 0;
  const p3 = parseFloat(form.value.pd) || 0;
  if (p1 < 0 || p2 < 0 || p3 < 0) { store.notif('Los porcentajes no pueden ser negativos', 'error'); return; }
  const fob = parseFloat(form.value.fob);
  const fle = parseFloat(form.value.flete);
  // El factor NO se envía: lo calcula Postgres
  const fila = {
    codigo, proveedor,
    fecha_llegada: form.value.fecha || null,
    fob_total: Number.isFinite(fob) ? fob : null,
    monto_flete_aduana: Number.isFinite(fle) ? fle : null,
    pct_flete_aduana: p1, pct_comision: p2, pct_divisas: p3
  };
  if (form.value.id) fila.id = form.value.id;
  guardando.value = true;
  try {
    if (await store.guardarEmbarque(fila)) limpiar();
  } finally {
    guardando.value = false;
  }
}

// Costo de reposición: lleva el factor del embarque a sus productos. Lo ya
// vendido no cambia (vive congelado en factura_items). Nunca automático.
async function recalcular(e) {
  if (store.rol !== 'gerente') { store.notif('Solo el gerente puede recalcular costos', 'error'); return; }
  const fNuevo = parseFloat(e.factor) || 0;
  if (fNuevo <= 0) { store.notif('Ese embarque no tiene factor válido', 'error'); return; }
  const sellados = store.productos.filter(p => p.embarque_id === e.id);
  if (!sellados.length) { store.notif('Todavía no hay productos sellados con ' + e.codigo, 'error'); return; }
  const desfasados = sellados.filter(p => Math.abs((parseFloat(p.factor_landed) || 0) - fNuevo) > 0.000001);
  if (!desfasados.length) { store.notif('Ya están todos al día con factor ' + fNuevo.toFixed(4), 'success'); return; }
  const fViejo = parseFloat(desfasados[0].factor_landed) || 0;
  const ej = desfasados.find(p => (parseFloat(p.fob) || 0) > 0);
  const lineaEj = ej ? `\nEjemplo — ${ej.cod_alt}: costo ${fmtUSD((parseFloat(ej.fob) || 0) * fViejo)} → ${fmtUSD((parseFloat(ej.fob) || 0) * fNuevo)}` : '';
  if (!confirm(
    `Recalcular ${desfasados.length} producto(s) de ${e.codigo}.\n\n`
    + `Factor: ${fViejo.toFixed(4)} → ${fNuevo.toFixed(4)}  (${fNuevo > fViejo ? 'SUBE' : 'BAJA'} el costo)${lineaEj}\n\n`
    + 'Las facturas ya emitidas NO cambian: guardan su propio costo.\n'
    + 'Los precios de venta NO se tocan — solo el costo, o sea el margen.\n\n'
    + '¿Aplicar?')) return;
  await store.recalcularEmbarque(e);
}

function cerrar() { store.modalEmbarquesActivo = false; }
</script>

<style scoped>
.emb-lbl { font-size: 11px; color: var(--dgray); font-weight: 500; display: block; margin-bottom: 3px }
</style>
