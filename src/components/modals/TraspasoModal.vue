<template>
  <div v-if="store.modalTraspasoActivo" class="modal show" id="modal-traspaso" style="display:flex">
    <div class="modal-content" style="max-width:720px;text-align:left">
      <div class="modal-icon" style="background:var(--lblue);color:var(--blue)">
        <i class="ti ti-arrows-exchange"></i>
      </div>
      <h2>Despachar de Distribuidora a Venta Directa</h2>
      <p class="modal-sub">
        Mueve existencias de Distribuidora a Venta Directa y genera la <strong>Nota de Entrega</strong> correlativa.
        Todo se aplica en una sola operación: si un renglón falla, no se mueve nada.
      </p>

      <!-- Paso 1: armar la lista -->
      <template v-if="!resultado">
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <select v-model="productoId" class="val-input" style="flex:1">
            <option value="">Agregar repuesto con stock en Distribuidora...</option>
            <option v-for="p in productosConStockDist" :key="p.id" :value="p.id">
              {{ p.cod_alt }} — {{ p.desc }} (Dist: {{ p.stock_dist }})
            </option>
          </select>
          <button class="btn btn-secondary" :disabled="!productoId" @click="agregarRenglon(productoId, 1)">
            <i class="ti ti-plus"></i>
          </button>
        </div>

        <details style="margin-bottom:10px;font-size:12px">
          <summary style="cursor:pointer;color:var(--blue)">Pegar lista desde Excel (código y cantidad)</summary>
          <textarea v-model="textoPegado" class="val-input" rows="4" style="width:100%;margin-top:6px;font-family:monospace"
            placeholder="HF6510 10&#10;RE505980 4"></textarea>
          <button class="btn btn-secondary btn-sm" style="margin-top:6px" @click="procesarPegado">Agregar a la lista</button>
        </details>

        <table class="tbl" style="font-size:12px">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th class="num">En Dist.</th>
              <th class="num">En VD</th>
              <th class="num" style="width:90px">Despachar</th>
              <th style="width:30px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="renglones.length === 0">
              <td colspan="6" style="text-align:center;padding:16px;color:var(--dgray)">Agrega al menos un repuesto.</td>
            </tr>
            <tr v-for="(r, i) in renglones" :key="r.id">
              <td><strong>{{ r.cod_alt }}</strong></td>
              <td>{{ r.desc }}</td>
              <td class="num">{{ r.stock_dist }}</td>
              <td class="num">{{ r.stock_vd }}</td>
              <td class="num">
                <input v-model.number="r.cant" type="number" min="1" :max="r.stock_dist" class="val-input"
                  :style="{ width: '70px', textAlign: 'center', borderColor: r.cant > r.stock_dist || r.cant <= 0 ? 'var(--red)' : '' }">
              </td>
              <td><button class="btn btn-danger btn-sm" style="padding:2px 6px" @click="renglones.splice(i, 1)">&times;</button></td>
            </tr>
          </tbody>
        </table>

        <div class="field-col" style="margin-top:10px">
          <label>Referencia (opcional):</label>
          <input v-model="referencia" type="text" class="val-input" placeholder="Ej: Reposición semanal del mostrador">
        </div>

        <div v-if="errorLista" class="field-error" style="margin-top:6px"><i class="ti ti-alert-circle"></i> {{ errorLista }}</div>

        <div class="modal-actions">
          <button class="btn btn-secondary" :disabled="aplicando" @click="cerrar">Cancelar</button>
          <button class="btn btn-primary" :disabled="aplicando || renglones.length === 0" @click="confirmarTraspaso">
            <i class="ti ti-check"></i> {{ aplicando ? 'Aplicando...' : `Despachar ${totalUnidades} ud` }}
          </button>
        </div>
      </template>

      <!-- Paso 2: resultado -->
      <template v-else>
        <div style="text-align:center;padding:18px">
          <i class="ti ti-circle-check" style="font-size:44px;color:var(--green)"></i>
          <div style="font-size:17px;font-weight:600;color:var(--navy);margin-top:10px">Nota de Entrega {{ resultado.numero }}</div>
          <div style="font-size:12.5px;color:var(--dgray);margin-top:4px">
            {{ resultado.renglones }} renglón(es) · {{ resultado.unidades }} unidades · costo {{ fmtUSD(resultado.total_costo) }}
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="imprimirNota"><i class="ti ti-printer"></i> Imprimir nota</button>
          <button class="btn btn-primary" @click="cerrar">Cerrar</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD } from '../../services/pricing.js';
import { cargarItemsNotaEntrega } from '../../services/supabase.js';
import { generarNotaEntregaPDF } from '../../services/exportService.js';

const store = useArjStore();
const productoId = ref('');
const renglones = ref([]);
const referencia = ref('');
const textoPegado = ref('');
const errorLista = ref('');
const aplicando = ref(false);
const resultado = ref(null);

const productosConStockDist = computed(() => store.productos.filter(p => p.stock_dist > 0));
const totalUnidades = computed(() => renglones.value.reduce((a, r) => a + (parseInt(r.cant) || 0), 0));

function agregarRenglon(id, cant) {
  const p = store.productos.find(x => x.id === id);
  if (!p) return false;
  const ex = renglones.value.find(r => r.id === p.id);
  if (ex) ex.cant += cant;
  else renglones.value.push({ id: p.id, cod_alt: p.cod_alt, desc: p.desc, stock_dist: p.stock_dist, stock_vd: p.stock_vd, cant });
  productoId.value = '';
  errorLista.value = '';
  return true;
}

function procesarPegado() {
  const noEncontrados = [];
  textoPegado.value.split('\n').forEach(l => {
    const parts = l.trim().split(/[\t,; ]+/);
    if (!parts[0]) return;
    const p = store.productos.find(x => (x.cod_alt || '').toLowerCase() === parts[0].toLowerCase());
    if (!p) { noEncontrados.push(parts[0]); return; }
    agregarRenglon(p.id, parseInt(parts[1]) || 1);
  });
  textoPegado.value = '';
  if (noEncontrados.length) store.notif('No encontrados: ' + noEncontrados.join(', '), 'warning');
}

async function confirmarTraspaso() {
  errorLista.value = '';
  const malos = renglones.value.filter(r => !(r.cant > 0) || r.cant > r.stock_dist);
  if (malos.length) {
    errorLista.value = 'Cantidades inválidas en: ' + malos.map(r => r.cod_alt).join(', ');
    return;
  }
  if (!confirm(`Se van a mover ${totalUnidades.value} unidades (${renglones.value.length} renglones) de Distribuidora a Venta Directa.\n\n¿Aplicar?`)) return;
  aplicando.value = true;
  try {
    const r = await store.ejecutarTraspaso(
      renglones.value.map(x => ({ producto_id: x.id, cantidad: parseInt(x.cant) })),
      referencia.value.trim()
    );
    if (r) resultado.value = r;
  } finally {
    aplicando.value = false;
  }
}

async function imprimirNota() {
  try {
    const items = await cargarItemsNotaEntrega(resultado.value.id);
    generarNotaEntregaPDF({
      numero: resultado.value.numero,
      fecha: new Date(),
      embarque: '',
      ref: referencia.value,
      items,
      totalCosto: resultado.value.total_costo,
      unidades: resultado.value.unidades
    }, store.usuarioNombre, 'print');
  } catch (e) {
    store.notif('No se pudo generar la nota: ' + e.message, 'error');
  }
}

function cerrar() {
  store.modalTraspasoActivo = false;
  renglones.value = [];
  referencia.value = '';
  resultado.value = null;
  errorLista.value = '';
}
</script>
