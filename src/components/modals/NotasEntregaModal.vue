<template>
  <div class="modal" :class="{ show: store.modalNotasActivo }">
    <div class="modal-bg" @click="cerrar"></div>
    <div class="modal-content" style="max-width: 900px; padding: 24px">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px">
        <h3 style="margin: 0; font-size: 18px; color: var(--navy); font-weight: 600">
          <i class="ti ti-file-text"></i> Notas de entrega
        </h3>
        <button class="btn btn-secondary btn-sm" @click="cerrar">
          <i class="ti ti-x"></i>
        </button>
      </div>

      <div class="field-row" style="margin-bottom: 16px">
        <input
          v-model="busqueda"
          type="text"
          placeholder="Buscar por número, embarque o referencia..."
          class="val-input"
          style="width: 100%"
        />
      </div>

      <div v-if="cargando" style="padding: 40px; text-align: center; color: var(--dgray)">
        <i class="ti ti-loader-2" style="font-size: 32px; display: block; margin-bottom: 10px; animation: spin 1s linear infinite"></i>
        Cargando notas de entrega...
      </div>

      <div v-else-if="errorMsg" style="padding: 20px; text-align: center; color: var(--red); background: #fee2e2; border-radius: 8px">
        {{ errorMsg }}
      </div>

      <div v-else-if="notasFiltradas.length === 0" style="padding: 40px; text-align: center; color: var(--dgray)">
        <i class="ti ti-file-off" style="font-size: 32px; display: block; margin-bottom: 10px"></i>
        No se encontraron notas de entrega.
      </div>

      <div v-else style="overflow-x: auto; max-height: 400px; border: 1px solid var(--border); border-radius: 8px">
        <table class="tbl" style="width: 100%">
          <thead style="position: sticky; top: 0; background: var(--gray); z-index: 1">
            <tr>
              <th style="text-align: left">Número</th>
              <th style="text-align: left">Fecha</th>
              <th style="text-align: left">Embarque</th>
              <th class="num">Rengl.</th>
              <th class="num">Unid.</th>
              <th class="num">Costo</th>
              <th class="center" style="width: 60px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in notasFiltradas" :key="n.id" :style="{ opacity: n.anulado ? '0.5' : '1' }">
              <td>
                <strong>{{ n.numero }}</strong>
                <span v-if="n.anulado" style="color: var(--red); font-size: 10px; margin-left: 6px">ANULADA</span>
                <div v-if="n.referencia" style="font-size: 11px; color: var(--dgray)">{{ n.referencia }}</div>
              </td>
              <td style="color: var(--dgray); font-size: 12px">{{ formatearFecha(n.fecha) }}</td>
              <td>{{ n.embarque_codigo || '—' }}</td>
              <td class="num">{{ n.productos_count || 0 }}</td>
              <td class="num">{{ n.unidades_count?.toLocaleString('es-VE') || 0 }}</td>
              <td class="num" style="font-weight: 600">{{ fmtUSD(n.total_costo || 0) }}</td>
              <td class="center">
                <button
                  class="btn btn-secondary btn-sm"
                  title="Imprimir Nota"
                  @click="reimprimir(n)"
                  :disabled="imprimiendoId === n.id"
                >
                  <i class="ti" :class="imprimiendoId === n.id ? 'ti-loader-2' : 'ti-printer'" :style="imprimiendoId === n.id ? 'animation: spin 1s linear infinite' : ''"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!cargando && notasFiltradas.length > 0" style="margin-top: 10px; font-size: 11px; color: var(--dgray); text-align: right">
        {{ notasFiltradas.length }} nota(s)
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '@/stores/useArjStore';
import { supabase } from '@/services/supabase';
import { fmtUSD } from '@/services/pricing';
import { generarNotaEntregaPDF } from '@/services/exportService';

const store = useArjStore();
const busqueda = ref('');
const notas = ref([]);
const cargando = ref(false);
const errorMsg = ref('');
const imprimiendoId = ref(null);

const notasFiltradas = computed(() => {
  const q = busqueda.value.trim().toLowerCase();
  if (!q) return notas.value;
  return notas.value.filter(n => 
    (n.numero || '').toLowerCase().includes(q) ||
    (n.embarque_codigo || '').toLowerCase().includes(q) ||
    (n.referencia || '').toLowerCase().includes(q)
  );
});

function formatearFecha(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
         d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

async function cargarNotas() {
  cargando.value = true;
  errorMsg.value = '';
  try {
    const { data, error } = await supabase
      .from('traspasos')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(200);

    if (error) throw error;
    notas.value = data || [];
  } catch (e) {
    console.error('[ARJ] Error cargando notas de entrega:', e);
    errorMsg.value = 'No se pudieron cargar las notas: ' + (e.message || e);
  } finally {
    cargando.value = false;
  }
}

watch(() => store.modalNotasActivo, (val) => {
  if (val) {
    busqueda.value = '';
    cargarNotas();
  }
});

function cerrar() {
  store.modalNotasActivo = false;
}

async function reimprimir(nota) {
  imprimiendoId.value = nota.id;
  try {
    const { data: items, error } = await supabase
      .from('traspaso_items')
      .select('*')
      .eq('traspaso_id', nota.id);

    if (error) throw error;
    if (!items || items.length === 0) {
      store.notif('La nota no tiene renglones guardados', 'error');
      return;
    }

    const notaCompleta = {
      numero: nota.numero,
      fecha: new Date(nota.fecha),
      embarque: nota.embarque_codigo || '',
      ref: nota.referencia || '',
      items: items,
      totalCosto: parseFloat(nota.total_costo) || 0,
      unidades: nota.unidades_count || 0
    };

    generarNotaEntregaPDF(notaCompleta, store.usuario || 'Sistema', 'print');
  } catch (e) {
    console.error('[ARJ] reimprimir nota:', e);
    store.notif('No se pudo cargar el detalle de la nota', 'error');
  } finally {
    imprimiendoId.value = null;
  }
}
</script>

<style scoped>
@keyframes spin { 100% { transform: rotate(360deg); } }
</style>
