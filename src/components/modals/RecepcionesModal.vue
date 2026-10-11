<template>
  <!-- Historial de recepciones y conteos (monolito v13.21) -->
  <div v-if="store.modalRecepcionesActivo" class="modal show" id="modal-recepciones">
    <div class="modal-content" style="max-width:900px;text-align:left;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:12px">
        <h3 style="margin:0;font-size:18px;color:var(--navy);font-weight:600"><i class="ti ti-truck-delivery"></i> Recepciones y conteos</h3>
        <button class="btn btn-secondary btn-sm" @click="cerrar"><i class="ti ti-x"></i></button>
      </div>
      <div style="margin-bottom:10px">
        <input v-model="buscar" type="text" class="val-input" placeholder="Buscar por número, embarque o referencia…" style="width:100%">
      </div>

      <div v-if="cargando" class="rs-vacio"><i class="ti ti-loader-2" style="font-size:24px;display:block;margin-bottom:6px"></i>Cargando…</div>
      <div v-else-if="error" style="padding:22px;text-align:center;color:var(--red);font-size:12px">{{ error }}</div>
      <div v-else-if="!lista.length" class="rs-vacio">
        <i class="ti ti-package-off" style="font-size:26px;display:block;margin-bottom:6px"></i>
        <template v-if="buscar.trim()">Ninguna recepción coincide con la búsqueda.</template>
        <template v-else>Todavía no hay recepciones registradas.<br><span style="font-size:11px">Las entradas anteriores a esta versión no quedaron guardadas: el sistema solo sumaba al stock.</span></template>
      </div>
      <template v-else>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--gray)">
            <th style="text-align:left;padding:8px 10px">Número</th>
            <th style="text-align:left;padding:8px 10px">Fecha</th>
            <th style="text-align:left;padding:8px 10px">Tipo</th>
            <th style="text-align:left;padding:8px 10px">Embarque</th>
            <th style="text-align:right;padding:8px 8px">Rengl.</th>
            <th style="text-align:right;padding:8px 8px">Unid.</th>
            <th style="text-align:right;padding:8px 10px">Costo</th>
            <th style="padding:8px 10px"></th>
          </tr></thead>
          <tbody>
            <tr v-for="r in lista" :key="r.id" :style="{ borderTop: '1px solid var(--border)', opacity: r.anulado ? 0.5 : 1 }">
              <td style="padding:7px 10px"><strong>{{ r.numero }}</strong><span v-if="r.anulado" style="color:var(--red);font-size:10px"> ANULADA</span>
                <div v-if="r.referencia" style="font-size:10.5px;color:var(--dgray)">{{ r.referencia }}</div></td>
              <td style="padding:7px 10px;color:var(--dgray)">{{ fechaTxt(r.fecha) }}</td>
              <td style="padding:7px 10px">
                <span :style="{ background: r.tipo === 'recepcion' ? 'var(--lgreen)' : '#FFF8E1', color: r.tipo === 'recepcion' ? 'var(--green)' : '#8D6E63', padding: '1px 7px', borderRadius: '8px', fontSize: '10px', fontWeight: 600 }">{{ r.tipo === 'recepcion' ? 'ENTRADA' : 'CONTEO' }}</span>
                <div v-if="r.no_contados_count" style="font-size:10px;color:var(--gold)">{{ r.no_contados_count }} no contado(s)</div>
              </td>
              <td style="padding:7px 10px">{{ r.embarque_codigo || '—' }}</td>
              <td style="padding:7px 8px;text-align:right">{{ r.productos_count || 0 }}</td>
              <td style="padding:7px 8px;text-align:right">{{ (r.unidades_count || 0).toLocaleString('es-VE') }}</td>
              <td style="padding:7px 10px;text-align:right;font-weight:600">{{ fmtUSD(r.total_costo || 0) }}</td>
              <td style="padding:7px 10px;text-align:right"><button class="btn btn-secondary btn-sm" @click="ver(r)"><i class="ti ti-eye"></i></button></td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top:9px;font-size:11px;color:var(--dgray);text-align:right">{{ lista.length }} registro(s)</div>
      </template>

      <!-- Detalle: la rotación compara lo que llegó contra el stock de HOY -->
      <div v-if="det" style="margin-top:14px;border-top:2px solid var(--gray);padding-top:12px">
        <div v-if="det.cargando" style="padding:16px;text-align:center;color:var(--dgray);font-size:12px">Cargando renglones…</div>
        <div v-else-if="det.error" style="padding:16px;color:var(--red);font-size:12px">{{ det.error }}</div>
        <template v-else>
          <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:8px">{{ det.r.numero }} · {{ det.items.length }} renglón(es)</div>
          <table style="width:100%;border-collapse:collapse;font-size:11.5px">
            <thead><tr style="background:var(--gray)">
              <th style="text-align:left;padding:6px 8px">Código</th>
              <th style="text-align:left;padding:6px 8px">Descripción</th>
              <th style="text-align:right;padding:6px 8px">{{ det.esRec ? 'Llegó' : 'Dif.' }}</th>
              <th style="text-align:right;padding:6px 8px">Antes</th>
              <th style="text-align:right;padding:6px 8px">Desp.</th>
              <template v-if="det.esRec">
                <th style="text-align:right;padding:6px 8px">Hoy</th><th style="text-align:right;padding:6px 8px">Vendido</th><th style="text-align:right;padding:6px 8px">Rotación</th>
              </template>
              <th v-if="esGerente" style="text-align:right;padding:6px 8px">Costo</th>
            </tr></thead>
            <tbody>
              <tr v-for="(it, i) in det.items" :key="i" style="border-top:1px solid var(--border)">
                <td style="padding:5px 8px"><strong>{{ it.cod_alt || '—' }}</strong>
                  <span v-if="it.clase === 'falta'" style="color:var(--red);font-size:9px"> FALTA</span>
                  <span v-else-if="it.clase === 'sobra'" style="color:var(--blue);font-size:9px"> SOBRA</span>
                  <span v-else-if="it.clase === 'no_contado'" style="color:var(--gold);font-size:9px"> NO CONTADO</span></td>
                <td style="padding:5px 8px">{{ (it.descripcion || '').slice(0, 40) }}<div style="font-size:9.5px;color:var(--dgray)">{{ it.marca || '' }}</div></td>
                <td style="padding:5px 8px;text-align:right;font-weight:600">{{ (it.cantidad || 0) > 0 ? '+' : '' }}{{ it.cantidad || 0 }}</td>
                <td style="padding:5px 8px;text-align:right;color:var(--dgray)">{{ it.stock_antes != null ? it.stock_antes : '—' }}</td>
                <td style="padding:5px 8px;text-align:right;color:var(--dgray)">{{ it.stock_despues != null ? it.stock_despues : '—' }}</td>
                <template v-if="det.esRec">
                  <td style="padding:5px 8px;text-align:right">{{ rot(it).hoy != null ? rot(it).hoy : '—' }}</td>
                  <td style="padding:5px 8px;text-align:right">{{ rot(it).vend != null ? rot(it).vend : '—' }}</td>
                  <td :style="{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: rot(it).color }">{{ rot(it).rot != null ? rot(it).rot.toFixed(0) + '%' : '—' }}</td>
                </template>
                <td v-if="esGerente" style="padding:5px 8px;text-align:right">{{ fmtUSD(it.total_linea || 0) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="det.esRec" style="margin-top:8px;font-size:10.5px;color:var(--dgray)">La rotación compara lo que llegó contra el stock de hoy. Verde ≥ 60% · ámbar ≥ 25% · rojo por debajo. Un producto rojo después de meses es plata dormida.</div>
          <div style="margin-top:8px;text-align:right"><button class="btn btn-secondary btn-sm" @click="det = null">Cerrar detalle</button></div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD } from '../../services/pricing.js';
import { cargarRecepciones, cargarItemsRecepcion } from '../../services/supabase.js';

const store = useArjStore();
const esGerente = computed(() => store.rol === 'gerente');
const recs = ref([]);
const buscar = ref('');
const cargando = ref(false);
const error = ref('');
const det = ref(null);

// Se lee de la base, no de memoria: las pudo registrar otro usuario
watch(() => store.modalRecepcionesActivo, async abierto => {
  if (!abierto) return;
  buscar.value = ''; det.value = null; error.value = '';
  if (!store.supabaseConectado) { recs.value = []; error.value = 'Sin conexión a Supabase. El historial vive en la base de datos.'; return; }
  cargando.value = true;
  try {
    recs.value = await cargarRecepciones(200);
  } catch (e) {
    console.error('[ARJ] cargar recepciones:', e);
    error.value = 'No se pudo cargar el historial: ' + (e.message || e);
  } finally {
    cargando.value = false;
  }
}, { immediate: true });

const lista = computed(() => {
  const q = buscar.value.trim().toLowerCase();
  if (!q) return recs.value;
  return recs.value.filter(r => (String(r.numero) + ' ' + String(r.embarque_codigo || '') + ' ' + String(r.referencia || '')).toLowerCase().includes(q));
});

function fechaTxt(iso) {
  const f = new Date(iso);
  return f.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + f.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

async function ver(r) {
  det.value = { r, cargando: true };
  try {
    const items = await cargarItemsRecepcion(r.id);
    if (!items.length) { det.value = { r, error: 'El registro no tiene renglones guardados.' }; return; }
    det.value = { r, items, esRec: r.tipo === 'recepcion' };
  } catch (e) {
    console.error('[ARJ] detalle recepcion:', e);
    det.value = { r, error: 'No se pudo cargar el detalle: ' + (e.message || e) };
  }
}

// Rotación contra el catálogo vivo, no contra la foto guardada
function rot(it) {
  const p = store.productos.find(x => x.cod_alt === it.cod_alt);
  const hoy = p ? ((p.stock_dist || 0) + (p.stock_vd || 0)) : null;
  const lleg = it.cantidad || 0;
  const vend = (hoy != null && lleg > 0) ? Math.max(0, (it.stock_despues || 0) - hoy) : null;
  const r = (vend != null && lleg > 0) ? (vend / lleg * 100) : null;
  const color = r == null ? 'var(--dgray)' : (r >= 60 ? 'var(--green)' : r >= 25 ? 'var(--gold)' : 'var(--red)');
  return { hoy, vend, rot: r, color };
}

function cerrar() { store.modalRecepcionesActivo = false; }
</script>

<style scoped>
.rs-vacio { padding: 26px; text-align: center; color: var(--dgray); font-size: 12px }
</style>
