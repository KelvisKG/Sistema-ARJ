<template>
  <!-- Historial → Precios manuales (sql/14): facturas con uno o más precios cambiados a mano -->
  <div id="precios-manuales">
    <div class="pm-filtros">
      <div>
        <label class="me-lbl" for="pm-periodo">Período</label>
        <select id="pm-periodo" v-model="periodo" class="val-input">
          <option v-for="p in PERIODOS" :key="p.v" :value="p.v">{{ p.t }}</option>
        </select>
      </div>
      <div>
        <label class="me-lbl" for="pm-quien">Quién lo cambió</label>
        <select id="pm-quien" v-model="quien" class="val-input">
          <option value="">Todos</option>
          <option v-for="q in quienes" :key="q" :value="q">{{ q }}</option>
        </select>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card blue">
        <div class="kpi-label">Facturas con precio manual</div>
        <div class="kpi-val">{{ facturas.length }}</div>
        <div class="kpi-sub">{{ resumen.productos }} producto(s) cambiado(s)</div>
      </div>
      <div class="kpi-card red">
        <div class="kpi-label">Se dejó de cobrar</div>
        <div class="kpi-val" style="color:var(--red)">{{ fmtBCV(resumen.menos) }}</div>
        <div class="kpi-sub">frente al precio de lista</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-label">Se cobró de más</div>
        <div class="kpi-val" style="color:var(--green)">{{ fmtBCV(resumen.mas) }}</div>
        <div class="kpi-sub">precios subidos a mano</div>
      </div>
    </div>

    <div class="card" style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Factura</th>
            <th>Productos con precio manual</th>
            <th class="num">Diferencia</th>
            <th>Quién</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando"><td colspan="5" class="pm-vacio"><i class="ti ti-loader"></i> Cargando...</td></tr>
          <tr v-else-if="error"><td colspan="5" class="pm-vacio" style="color:var(--red)">{{ error }}</td></tr>
          <tr v-else-if="!facturas.length"><td colspan="5" class="pm-vacio">No hay facturas con precios cambiados a mano en este período.</td></tr>
          <tr v-for="f in facturas" v-else :key="f.numero" :class="['fila-abre', { 'pm-anulada': f.anulada }]" title="Clic para ver la factura" @click="abrir(f)">
            <td style="white-space:nowrap">{{ f.fecha }}</td>
            <td>
              <strong>{{ f.numero }}</strong>
              <span v-if="f.anulada" class="badge badge-secondary" style="margin-left:4px">Anulada</span>
              <div class="pm-sub">{{ f.cliente }}</div>
            </td>
            <td>
              <strong>{{ f.renglones.length }} producto(s)</strong>
              <div class="pm-sub">{{ f.renglones.map(r => r.cod).join(', ') }}</div>
              <div class="pm-sub">{{ f.como }}<template v-if="f.recuperado"> · recuperado</template></div>
            </td>
            <td class="num" style="white-space:nowrap">
              <strong v-if="f.dif != null" :class="f.dif < 0 ? 'pm-menos' : 'pm-mas'">{{ f.dif < 0 ? '−' : '+' }}{{ fmtBCV(Math.abs(f.dif)) }}</strong>
              <span v-else>—</span>
            </td>
            <td>{{ f.quien || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="me-nota">Clic en una factura para ver el detalle de cada producto. Diferencia = (cobrado − lista) × cantidad de los productos cambiados, en dólar BCV. Las facturas anuladas se muestran pero no suman. Las facturas anteriores a esta función se recuperaron de la bitácora (marcadas "recuperado"); en ellas el precio de lista es aproximado si el precio se cambió más de una vez.</p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtBCV } from '../../services/pricing.js';
import { cargarPreciosManuales, cargarFactura } from '../../services/supabase.js';

const props = defineProps({ busqueda: { type: String, default: '' } });
const store = useArjStore();
const PERIODOS = [
  { v: 'mes', t: 'Este mes' },
  { v: 'anterior', t: 'Mes anterior' },
  { v: '90', t: 'Últimos 90 días' }
];
const COMO = { dolar: 'escritos en $', bcv: 'escritos en dólar BCV', descuento: 'descuento manual' };
const periodo = ref('mes');
const quien = ref('');
const filas = ref([]);
const cargando = ref(false);
const error = ref('');

function rango(p) {
  const hoy = new Date();
  if (p === 'anterior') return [new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), new Date(hoy.getFullYear(), hoy.getMonth(), 1)];
  if (p === '90') return [new Date(Date.now() - 90 * 86400000), new Date(Date.now() + 86400000)];
  return [new Date(hoy.getFullYear(), hoy.getMonth(), 1), new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)];
}

async function cargar() {
  const [desde, hasta] = rango(periodo.value);
  cargando.value = true;
  error.value = '';
  try {
    filas.value = await cargarPreciosManuales(desde.toISOString(), hasta.toISOString());
  } catch (e) {
    console.error('[ARJ] precios manuales:', e);
    error.value = /ajuste_tipo|precio_lista/.test(e.message || '')
      ? 'Falta correr sql/14_precios_manuales.sql en la base de datos.'
      : 'No se pudieron cargar los precios manuales: ' + (e.message || e);
    filas.value = [];
  } finally {
    cargando.value = false;
  }
}
watch(periodo, cargar, { immediate: true });

const deEmpresa = computed(() => filas.value.filter(r => r.empresa === store.empresa));
const quienes = computed(() => [...new Set(deEmpresa.value.map(r => r.quien).filter(Boolean))].sort());

// Una fila por factura con sus renglones cambiados (los renglones ya vienen ordenados por fecha)
const facturas = computed(() => {
  const q = props.busqueda.trim().toLowerCase();
  const porFactura = new Map();
  deEmpresa.value.forEach(r => {
    if (quien.value && r.quien !== quien.value) return;
    let f = porFactura.get(r.numero);
    if (!f) porFactura.set(r.numero, f = { numero: r.numero, facturaId: r.facturaId, fecha: r.fecha, cliente: r.cliente, anulada: r.anulada, renglones: [] });
    f.renglones.push(r);
  });
  return [...porFactura.values()].map(f => {
    const rs = f.renglones;
    const conDif = rs.filter(r => r.dif != null);
    return {
      ...f,
      dif: conDif.length ? Math.round(conDif.reduce((a, r) => a + r.dif, 0) * 100) / 100 : null,
      menos: conDif.filter(r => r.dif < 0).reduce((a, r) => a - r.dif, 0),
      mas: conDif.filter(r => r.dif > 0).reduce((a, r) => a + r.dif, 0),
      quien: [...new Set(rs.map(r => r.quien).filter(Boolean))].join(', '),
      como: [...new Set(rs.map(r => (r.tipo === 'descuento' ? COMO.descuento + ' ' + (r.monto || 0) + '%' : COMO[r.tipo])))].join(' · '),
      recuperado: rs.some(r => r.recuperado)
    };
  }).filter(f => !q || [f.numero, f.cliente, f.quien, ...f.renglones.flatMap(r => [r.cod, r.desc])]
    .some(x => (x || '').toLowerCase().includes(q)));
});

const resumen = computed(() => {
  const vale = facturas.value.filter(f => !f.anulada);
  return {
    productos: facturas.value.reduce((a, f) => a + f.renglones.length, 0),
    menos: vale.reduce((a, f) => a + f.menos, 0),
    mas: vale.reduce((a, f) => a + f.mas, 0)
  };
});

// La factura abre con sus renglones, donde cada precio manual lleva su nota
async function abrir(f) {
  const fac = store.todasFacturas.find(x => x.id === f.facturaId) || await cargarFactura(f.facturaId);
  if (!fac) { store.notif('No se pudo abrir la factura ' + f.numero, 'error'); return; }
  store.facturaReciente = fac;
  store.modalFacturaActivo = true;
}
</script>

<style scoped>
.pm-filtros { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px }
.pm-filtros > div { flex: 0 1 220px }
.pm-sub { color: var(--dgray); font-size: 12.5px }
.pm-vacio { padding: 22px; color: var(--dgray); text-align: center }
.pm-menos { color: var(--red) }
.pm-mas { color: var(--green) }
.pm-anulada td { opacity: .55 }
</style>
