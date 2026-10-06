<template>
  <div class="page active" id="page-exportar">
    <h1 class="page-title"><i class="ti ti-file-export"></i> Exportación Fiscal (Libro de Ventas)</h1>
    <p class="page-sub">Emisor: {{ EMISOR_FISCAL.nombre }} · RIF {{ EMISOR_FISCAL.rif }}</p>

    <div class="help-box">
      <i class="ti ti-info-circle"></i>
      <div>
        Repuestos agrícolas <strong>exentos</strong> de IVA (Decreto 126, Art. 63, Num. 02). Las facturas se leen
        directamente de la base de datos para el rango elegido. Las <strong>anuladas</strong> se listan con monto cero.
        El archivo trae dos hojas: libro de ventas y detalle por renglón.
      </div>
    </div>

    <div class="card" style="max-width:760px;margin-bottom:16px">
      <div class="card-tit"><i class="ti ti-filter"></i> Parámetros</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:12px">
        <div class="field-col">
          <label>Empresa:</label>
          <select v-model="empresaSel" class="val-input">
            <option value="directa">ARJ Venta Directa</option>
            <option value="distribuidora">Distribuidora</option>
            <option value="todas">Ambas empresas</option>
          </select>
        </div>
        <div class="field-col">
          <label>Desde:</label>
          <input v-model="desde" type="date" class="val-input">
        </div>
        <div class="field-col">
          <label>Hasta (incluido):</label>
          <input v-model="hasta" type="date" class="val-input">
        </div>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap">
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" @click="rangoHoy">Hoy</button>
          <button class="btn btn-secondary btn-sm" @click="rangoMes(0)">Este mes</button>
          <button class="btn btn-secondary btn-sm" @click="rangoMes(-1)">Mes anterior</button>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" :disabled="cargando" @click="cargar">
            <i class="ti ti-refresh"></i> {{ cargando ? 'Cargando...' : 'Ver facturas' }}
          </button>
          <button class="btn btn-primary" :disabled="cargando || facturasFiscales.length === 0" @click="descargarExcel">
            <i class="ti ti-file-spreadsheet"></i> Descargar (.xlsx)
          </button>
        </div>
      </div>
    </div>

    <div class="card" style="overflow-x:auto">
      <div class="card-tit">
        <i class="ti ti-table"></i> {{ facturasFiscales.length }} facturas · Total (sin anuladas): {{ fmtUSD(totalUSD) }}
      </div>
      <table class="tbl" style="margin-top:10px">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>N° Factura</th>
            <th>Cliente / Razón Social</th>
            <th>RIF</th>
            <th class="num">Total ($)</th>
            <th class="num">Tasa BCV</th>
            <th class="num">Total (Bs)</th>
            <th class="center">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="facturasFiscales.length === 0">
            <td colspan="8" style="text-align:center;padding:24px;color:var(--dgray)">
              {{ cargado ? 'No hay facturas en el rango seleccionado.' : 'Elige el rango y pulsa "Ver facturas".' }}
            </td>
          </tr>
          <tr v-for="f in facturasFiscales" :key="f.id" :style="f.estado === 'anulada' ? 'opacity:.6' : ''">
            <td style="font-size:12px">{{ f.fecha }}</td>
            <td><strong>{{ f.num }}</strong></td>
            <td>{{ f.cliente_nombre_snap || f.cliente }}</td>
            <td style="font-family:monospace;font-size:12px">{{ f.cliente_rif_snap || '—' }}</td>
            <td class="num">{{ fmtUSD(f.estado === 'anulada' ? 0 : f.total) }}</td>
            <td class="num">{{ f.tasa_bcv }}</td>
            <td class="num" style="font-weight:700">{{ fmtBs(f.estado === 'anulada' ? 0 : f.total * (f.factor_bs || 1), f.tasa_bcv) }}</td>
            <td class="center">
              <span :class="['badge', f.estado === 'anulada' ? 'badge-danger' : 'badge-success']">{{ (f.estado_bd || f.estado).toUpperCase() }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD, fmtBs } from '../services/pricing.js';
import { exportarLibroVentasExcel, EMISOR_FISCAL } from '../services/exportLazy.js';
import { cargarFacturasRango, cargarItemsVentasMes } from '../services/supabase.js';
import { fechaLocalISO } from '../services/fechas.js';

const store = useArjStore();
const empresaSel = ref(store.empresa);
const desde = ref('');
const hasta = ref('');
const facturas = ref([]);
const cargando = ref(false);
const cargado = ref(false);

// Inicio del día en Venezuela (UTC-4) expresado en ISO UTC
const inicioDiaVE = iso => new Date(iso + 'T00:00:00-04:00');

function rangoHoy() {
  desde.value = hasta.value = fechaLocalISO();
}
function rangoMes(delta) {
  const [y, m] = fechaLocalISO().split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  desde.value = d.toISOString().slice(0, 10);
  hasta.value = fin.toISOString().slice(0, 10);
}
rangoMes(0);

const facturasFiscales = computed(() =>
  facturas.value.filter(f => empresaSel.value === 'todas' || f.empresa === empresaSel.value)
);
const totalUSD = computed(() => facturasFiscales.value.filter(f => f.estado !== 'anulada').reduce((a, f) => a + f.total, 0));

async function cargar() {
  if (!desde.value || !hasta.value) { store.notif('Selecciona el rango de fechas', 'error'); return; }
  if (hasta.value < desde.value) { store.notif('El rango de fechas está al revés', 'error'); return; }
  cargando.value = true;
  try {
    const d = inicioDiaVE(desde.value);
    const h = new Date(inicioDiaVE(hasta.value).getTime() + 86400000); // "hasta" inclusivo
    facturas.value = await cargarFacturasRango(d.toISOString(), h.toISOString());
    cargado.value = true;
  } catch (e) {
    store.notif('Error cargando facturas: ' + e.message, 'error');
  } finally {
    cargando.value = false;
  }
}

async function descargarExcel() {
  const lista = facturasFiscales.value;
  if (!lista.length) return;
  cargando.value = true;
  try {
    const items = await cargarItemsVentasMes(lista.map(f => f.id));
    const etiqueta = desde.value === hasta.value ? `del ${desde.value}` : `del ${desde.value} al ${hasta.value}`;
    const r = await exportarLibroVentasExcel(lista, items, {
      empresaSel: empresaSel.value, etiqueta, sufijo: `${desde.value}_a_${hasta.value}`, usuario: store.usuarioNombre
    });
    store.logBitacora('fiscal', `Exportó libro de ventas ${etiqueta}: ${r.facturas} facturas, ${fmtUSD(r.totalUSD)}`, true);
    store.notif(`${r.facturas} facturas exportadas`, 'success');
  } catch (e) {
    store.notif('No se pudo generar el archivo: ' + e.message, 'error');
  } finally {
    cargando.value = false;
  }
}
</script>
