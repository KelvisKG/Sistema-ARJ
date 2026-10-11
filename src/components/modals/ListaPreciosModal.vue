<template>
  <!-- Descargar lista de precios (monolito v13.12) -->
  <div :class="['confirm-modal', { show: store.modalListaPreciosActivo }]" id="modal-lista-precios">
    <div class="confirm-box lp-box">
      <h3><i class="ti ti-download"></i> Descargar lista de precios</h3>
      <p style="margin-bottom:10px">Precio público siempre. Los precios manuales se respetan tal cual.<br>
        <span style="font-size:11.5px;color:var(--dgray)">Solo salen productos con embarque sellado y con
          existencia en al menos una de las dos empresas.</span></p>
      <input v-model="buscar" type="text" class="lp-buscar" placeholder="Buscar marca…">
      <div class="lp-marcas">
        <div v-if="!disponibles.length" class="lp-vacio"><strong>No hay nada que listar.</strong><br>
          Ningun producto cumple: embarque sellado + existencia.<br>
          Sella los costos desde Inventario &rarr; Conteo fisico.</div>
        <div v-else-if="!visibles.length" class="lp-vacio">Ninguna marca coincide con "{{ buscar.trim().toLowerCase() }}"</div>
        <label v-for="[m, n] in visibles" :key="m" class="lp-marca">
          <input type="checkbox" :checked="sel.includes(m)" @change="toggle(m, $event.target.checked)">
          <span>{{ m }}</span><span class="n">{{ n }}</span>
        </label>
      </div>
      <div class="lp-acciones-marca">
        <button type="button" @click="marcarTodas(true)">Todas</button>
        <button type="button" @click="marcarTodas(false)">Ninguna</button>
      </div>
      <div :class="['lp-conteo', { cero: !filas.length }]">
        <template v-if="!sel.length">Elige al menos una marca arriba.</template>
        <template v-else><strong>{{ filas.length }}</strong> producto(s) en la lista &middot; {{ sel.length === 1 ? sel[0] : sel.length + ' marcas' }}</template>
      </div>
      <div class="actions">
        <button class="btn btn-primary" :disabled="!filas.length" :style="estiloOff" @click="listaPDF"><i class="ti ti-file-type-pdf"></i> PDF (para clientes)</button>
        <button class="btn btn-secondary" :disabled="!filas.length" :style="estiloOff" @click="listaCSV"><i class="ti ti-file-spreadsheet"></i> Excel/CSV</button>
        <button class="btn btn-secondary" :disabled="!filas.length" :style="estiloOff" @click="abrirSimulador"><i class="ti ti-chart-bar"></i> Simulador de precios</button>
        <button class="btn btn-secondary" @click="store.modalListaPreciosActivo = false">Cancelar</button>
      </div>
    </div>
  </div>

  <!-- Simulador de precios — uso interno (monolito v13.25 / v13.26) -->
  <div :class="['confirm-modal', { show: simAbierto }]" id="modal-lp-analisis">
    <div class="confirm-box lpa-box">
      <h3><i class="ti ti-chart-bar"></i> Simulador de precios &middot; uso interno</h3>
      <div class="lpa-fijo">
        <div class="lpa-tira">
          <div class="lpa-st"><b>Facturación</b><s>{{ fmtUSD(T.venta) }}</s><i>{{ T.uds.toLocaleString('es-VE') }} uds</i></div>
          <div class="lpa-st"><b>Costo landed</b><s>{{ fmtUSD(T.costo) }}</s><i>{{ pc(T.costo, T.venta) }} de la venta</i></div>
          <div class="lpa-st"><b>Utilidad bruta</b><s :style="{ color: T.util >= 0 ? '#1E7B34' : '#B00020' }">{{ fmtUSD(T.util) }}</s><i>margen {{ T.mg.toFixed(1) }}%</i></div>
          <div class="lpa-st"><b>Multiplicador</b><s>×{{ T.multCosto.toFixed(2) }}</s><i>sobre costo real</i></div>
          <div class="lpa-st"><b>En efectivo −{{ dto.toFixed(1) }}%</b><s>{{ fmtUSD(verde.util) }}</s><i>margen {{ verde.venta > 0 ? (verde.util / verde.venta * 100).toFixed(1) : '0' }}%</i></div>
        </div>
        <div class="lpa-tira" style="margin-top:5px">
          <div class="lpa-st" style="background:#EAF0F8"><b>Venta Directa</b><s style="font-size:13.5px">{{ fmtUSD(T.vd.util) }}</s>
            <i>{{ T.vd.uds.toLocaleString('es-VE') }} uds · factura {{ fmtUSD(T.vd.venta) }} · {{ T.vd.mg.toFixed(1) }}%</i></div>
          <div class="lpa-st" style="background:#FBF3E0"><b>Distribuidora{{ tier !== 'Publico' ? ' · ' + tier : '' }}</b><s style="font-size:13.5px">{{ fmtUSD(T.di.util) }}</s>
            <i>{{ T.di.uds.toLocaleString('es-VE') }} uds · factura {{ fmtUSD(T.di.venta) }} · {{ T.di.mg.toFixed(1) }}%</i></div>
        </div>
        <div v-if="T.nTocados > 0" style="margin-top:5px;padding:5px 8px;border-radius:5px;background:#EAF6EC;font-size:11.5px">
          <strong>{{ T.nTocados }}</strong> producto(s) modificado(s) · utilidad original {{ fmtUSD(T.util0) }} &rarr;
          <strong :style="{ color: T.util - T.util0 >= 0 ? '#1E7B34' : '#B00020' }">{{ T.util - T.util0 >= 0 ? '+' : '−' }}{{ fmtUSD(Math.abs(T.util - T.util0)) }}</strong>
        </div>
        <div v-if="T.nBajos || T.nSF || T.nSinEmb" style="margin-top:5px;font-size:11.5px">⚠
          <template v-if="T.nBajos"><span style="color:#B00020;font-weight:700">{{ T.nBajos }} bajo el {{ MARGEN_MINIMO }}%</span></template>
          <template v-if="T.nSF">{{ T.nBajos ? ' · ' : '' }}<span style="color:#BF8F00;font-weight:700">{{ T.nSF }} sin FOB</span> ({{ fmtUSD(T.ventaSF) }}, fuera del cálculo)</template>
          <template v-if="T.nSinEmb">{{ T.nBajos || T.nSF ? ' · ' : '' }}<span style="color:#BF8F00">{{ T.nSinEmb }} sin embarque</span></template>
        </div>
        <details class="lpa-det" :open="detAbierto" @toggle="detAbierto = $event.target.open">
          <summary>Ver desglose del costo y detalle por canal</summary>
          <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px">
            <table style="flex:1 1 260px;border-collapse:collapse"><tbody>
              <tr><th colspan="3" class="lpa-th">De qué está hecho el costo</th></tr>
              <tr><td class="lpa-c">FOB (la mercancía)</td><td class="lpa-c lpa-n">{{ fmtUSD(T.fobT) }}</td><td class="lpa-c lpa-n lpa-g">{{ pc(T.fobT, T.costo) }}</td></tr>
              <tr><td class="lpa-c">Flete + aduana + comisión</td><td class="lpa-c lpa-n">{{ fmtUSD(T.logis) }}</td><td class="lpa-c lpa-n lpa-g">{{ pc(T.logis, T.costo) }}</td></tr>
              <tr><td class="lpa-c">Prima por compra de divisas</td><td class="lpa-c lpa-n">{{ fmtUSD(T.prima) }}</td><td class="lpa-c lpa-n lpa-g">{{ pc(T.prima, T.costo) }}</td></tr>
              <tr><td class="lpa-c"><strong>Costo landed</strong></td><td class="lpa-c lpa-n"><strong>{{ fmtUSD(T.costo) }}</strong></td><td class="lpa-c lpa-n lpa-g">100%</td></tr>
              <tr><td class="lpa-c">Multiplicador sobre FOB</td><td class="lpa-c lpa-n">×{{ T.multFob.toFixed(2) }}</td><td class="lpa-c"></td></tr>
            </tbody>
            </table>
            <table style="flex:1 1 300px;border-collapse:collapse"><tbody>
              <tr><th class="lpa-th">Por canal</th><th class="lpa-th lpa-n">V. Directa</th><th class="lpa-th lpa-n">Distrib.</th></tr>
              <tr><td class="lpa-c">Unidades</td><td class="lpa-c lpa-n">{{ T.vd.uds.toLocaleString('es-VE') }}</td><td class="lpa-c lpa-n lpa-g">{{ T.di.uds.toLocaleString('es-VE') }}</td></tr>
              <tr><td class="lpa-c">Facturación</td><td class="lpa-c lpa-n">{{ fmtUSD(T.vd.venta) }}</td><td class="lpa-c lpa-n lpa-g">{{ fmtUSD(T.di.venta) }}</td></tr>
              <tr><td class="lpa-c">Costo landed</td><td class="lpa-c lpa-n">{{ fmtUSD(T.vd.costo) }}</td><td class="lpa-c lpa-n lpa-g">{{ fmtUSD(T.di.costo) }}</td></tr>
              <tr><td class="lpa-c"><strong>Utilidad</strong></td><td class="lpa-c lpa-n"><strong>{{ fmtUSD(T.vd.util) }}</strong></td><td class="lpa-c lpa-n lpa-g"><strong>{{ fmtUSD(T.di.util) }}</strong></td></tr>
              <tr><td class="lpa-c">Margen</td><td class="lpa-c lpa-n">{{ T.vd.mg.toFixed(1) }}%</td><td class="lpa-c lpa-n lpa-g">{{ T.di.mg.toFixed(1) }}%</td></tr>
              <tr><td class="lpa-c">Aporte a la utilidad</td><td class="lpa-c lpa-n">{{ pc(T.vd.util, T.util) }}</td><td class="lpa-c lpa-n lpa-g">{{ pc(T.di.util, T.util) }}</td></tr>
            </tbody>
            </table>
          </div>
          <div style="font-size:10.5px;color:var(--dgray);margin-top:3px">Venta Directa siempre a precio público. Distribuidora valorada
            {{ tier === 'Publico' ? 'a precio público' : 'con descuento ' + tier + ' (' + Math.round((1 - T.facDist) * 100) + '%)' }}.</div>
        </details>
      </div>
      <div class="lpa-fijo" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:7px;background:#F2F5FA;border-radius:6px;font-size:12px">
        <span style="color:var(--dgray)">Multiplicador a todos:</span>
        <input v-model="multGlobal" type="number" step="0.1" min="0" placeholder="2.5" class="lpa-auto"
          style="width:66px;padding:4px;border:1px solid var(--border);border-radius:4px;text-align:center;font-size:12px;font-family:inherit">
        <button type="button" class="btn btn-secondary" style="padding:4px 9px;font-size:12px" @click="aplicarGlobal">Aplicar</button>
        <button type="button" class="btn btn-secondary" style="padding:4px 9px;font-size:12px" @click="subirBajos">Subir los bajos al 30%</button>
        <button type="button" class="btn btn-secondary" style="padding:4px 9px;font-size:12px" @click="restaurar">Restaurar</button>
        <span style="color:var(--dgray);margin-left:6px">Distribuidora:</span>
        <select v-model="tier" style="width:auto;padding:4px;border:1px solid var(--border);border-radius:4px;font-size:12px;font-family:inherit">
          <option value="Publico">Precio público</option>
          <option value="T1">Aliado T1 −5%</option>
          <option value="T2">Aliado T2 −10%</option>
          <option value="T3">Aliado T3 −20%</option>
        </select>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;margin-left:auto">
          <input v-model="soloBajos" type="checkbox" style="width:auto;margin:0"> Solo margen bajo
        </label>
      </div>
      <div class="lpa-tabla-wrap">
        <table style="width:100%;border-collapse:collapse;font-size:11.5px">
          <thead><tr style="position:sticky;top:0;z-index:1">
            <th class="lpa-h" style="text-align:left">Producto</th>
            <th class="lpa-h" style="text-align:right">V. Directa</th>
            <th class="lpa-h" style="text-align:right">Distrib.</th>
            <th class="lpa-h" style="text-align:right">FOB</th>
            <th class="lpa-h" style="text-align:right">Costo</th>
            <th class="lpa-h" style="text-align:center">×FOB</th>
            <th class="lpa-h" style="text-align:center">Precio</th>
            <th class="lpa-h" style="text-align:right">Margen</th>
            <th class="lpa-h" style="text-align:right">Total</th>
          </tr></thead>
          <tbody>
            <tr v-if="!filasVisibles.length"><td colspan="9" style="padding:14px;text-align:center;color:var(--dgray)">Ningún producto bajo el {{ MARGEN_MINIMO }}%.</td></tr>
            <tr v-for="r in filasVisibles" :key="r.cod" :style="r.tocado ? 'background:#EAF6EC' : ''">
              <td class="lpa-td" style="white-space:normal;min-width:150px"><strong>{{ r.cod }}</strong>
                <span v-if="r.manual" style="font-size:9px;color:#BF8F00;font-weight:700"> MANUAL</span>
                <br><span style="color:var(--dgray);font-size:10.5px">{{ r.desc.slice(0, 42) }}</span></td>
              <td class="lpa-td" style="text-align:right"><template v-if="r.uvd">{{ r.uvd }}</template><span v-else style="color:var(--dgray)">—</span></td>
              <td class="lpa-td" style="text-align:right"><template v-if="r.udist">{{ r.udist }}</template><span v-else style="color:var(--dgray)">—</span></td>
              <td class="lpa-td" style="text-align:right"><span v-if="r.fob <= 0" style="color:#B00020">—</span><template v-else>{{ fmtUSD(r.fob) }}</template></td>
              <td class="lpa-td" style="text-align:right">{{ r.fob <= 0 ? '—' : fmtUSD(r.costo) }}</td>
              <td class="lpa-td" style="text-align:center">
                <span v-if="r.fob <= 0" style="color:var(--dgray)">—</span>
                <input v-else type="number" step="0.05" min="0" :value="valorCampo(r, 'm')" class="lpa-inp" style="width:62px;text-align:center"
                  @focus="buf[r.cod + '|m'] = $event.target.value" @blur="delete buf[r.cod + '|m']"
                  @input="buf[r.cod + '|m'] = $event.target.value; cambioMult(r, $event.target.value)">
              </td>
              <td class="lpa-td" style="text-align:center">
                <input type="number" step="0.5" min="0" :value="valorCampo(r, 'p')" class="lpa-inp" style="width:76px;text-align:right;font-weight:600"
                  @focus="buf[r.cod + '|p'] = $event.target.value" @blur="delete buf[r.cod + '|p']"
                  @input="buf[r.cod + '|p'] = $event.target.value; cambioPrecio(r, $event.target.value)">
              </td>
              <td class="lpa-td" :style="{ textAlign: 'right', fontWeight: 700, color: colorMg(margen(r)) }">{{ Number.isFinite(margen(r)) ? margen(r).toFixed(1) + '%' : '—' }}</td>
              <td class="lpa-td" style="text-align:right;font-weight:600">{{ fmtUSD(totalFila(r)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="lpa-fijo" style="font-size:10px;color:var(--dgray)">
        <strong>Simulación</strong> — no se guarda en el catálogo. No contempla costos fijos.
      </div>
      <div class="actions">
        <button class="btn btn-primary" @click="simPDF"><i class="ti ti-file-type-pdf"></i> Informe PDF</button>
        <button class="btn btn-secondary" @click="simCSV"><i class="ti ti-file-spreadsheet"></i> CSV interno</button>
        <button class="btn btn-secondary" @click="simAbierto = false">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import {
  fmtUSD, precioLista, costoLanded, costoSinDivisas, MARGEN_MINIMO, PRECIOS_TIER
} from '../../services/pricing.js';
import { lpElegible, marcaDe, descargarArchivo, imprimirHTML } from '../../services/monolito.js';

const store = useArjStore();
const buscar = ref('');
const sel = ref([]);

// Por defecto NADA marcado: obliga a elegir a conciencia
watch(() => store.modalListaPreciosActivo, abierto => {
  if (!abierto) return;
  if (store.rol !== 'gerente') { store.notif('Solo el gerente puede generar la lista de precios', 'error'); store.modalListaPreciosActivo = false; return; }
  sel.value = []; buscar.value = '';
}, { immediate: true });

// Solo marcas con al menos un producto elegible: [[marca, n], ...]
const disponibles = computed(() => {
  const m = {};
  store.productos.forEach(p => { if (lpElegible(p)) { const k = marcaDe(p); m[k] = (m[k] || 0) + 1; } });
  return Object.keys(m).sort((a, b) => a.localeCompare(b)).map(k => [k, m[k]]);
});
const visibles = computed(() => {
  const q = buscar.value.trim().toLowerCase();
  return q ? disponibles.value.filter(([m]) => m.toLowerCase().includes(q)) : disponibles.value;
});
function toggle(m, on) {
  const i = sel.value.indexOf(m);
  if (on && i < 0) sel.value = [...sel.value, m];
  if (!on && i >= 0) sel.value = sel.value.filter(x => x !== m);
}
// "Todas" marca TODAS las disponibles, no solo las visibles en el filtro
function marcarTodas(on) { sel.value = on ? disponibles.value.map(x => x[0]) : []; }

const filas = computed(() => store.productos
  .filter(p => lpElegible(p) && sel.value.includes(marcaDe(p)))
  .slice()
  .sort((a, b) => ((a.marca || '') + a.desc).localeCompare((b.marca || '') + b.desc)));
const estiloOff = computed(() => (filas.value.length ? '' : 'opacity:0.45;cursor:not-allowed'));

function nombreMarcas() {
  if (!sel.value.length) return '';
  if (sel.value.length === 1) return sel.value[0];
  if (sel.value.length === disponibles.value.length) return 'Todas las marcas';
  return sel.value.slice().sort().join(', ');
}

// Leyenda de moneda (art. 128 Ley del BCV): USD de cuenta, pago en Bs a tasa BCV
function leyendaMoneda() {
  const t = parseFloat(store.tasa_bcv);
  const base = 'Precios referenciales en USD · Pago en Bs a la tasa BCV del día de la venta';
  if (!Number.isFinite(t) || t <= 0) return base;
  return base + ' · Bs. ' + t.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '/USD';
}

function listaCSV() {
  if (!sel.value.length) { store.notif('Elige al menos una marca antes de descargar', 'error'); return; }
  if (!filas.value.length) { store.notif('No hay productos para la lista', 'error'); return; }
  let csv = 'Codigo;Descripcion;Marca;Precio USD\n';
  filas.value.forEach(p => {
    const desc = (p.desc || '').replace(/[\r\n;]+/g, ' ').trim();
    csv += p.cod_alt + ';' + desc + ';' + (p.marca || '') + ';' + precioLista(p).toFixed(2).replace('.', ',') + '\n';
  });
  const hoy = new Date().toISOString().slice(0, 10);
  // El nombre lleva la marca: evita mandar la lista equivocada por WhatsApp
  const sufijo = sel.value.length === 1 ? '_' + sel.value[0].replace(/[^A-Za-z0-9]/g, '')
    : (sel.value.length === disponibles.value.length ? '' : '_' + sel.value.length + 'marcas');
  descargarArchivo('ARJ_Lista_Precios' + sufijo + '_' + hoy + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
  store.logBitacora('precio', 'Descargó lista de precios CSV — ' + nombreMarcas() + ' (' + filas.value.length + ' productos)', false);
  store.modalListaPreciosActivo = false;
  store.notif('✓ Lista CSV descargada (' + filas.value.length + ' productos)', 'success');
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function listaPDF() {
  if (!sel.value.length) { store.notif('Elige al menos una marca antes de generar el PDF', 'error'); return; }
  if (!filas.value.length) { store.notif('No hay productos para la lista', 'error'); return; }
  const hoy = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
  let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ARJ Lista de Precios</title><style>'
    + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + 'body{font-family:Arial,sans-serif;font-size:11px;color:#222;margin:24px}'
    + 'h1{color:#1F3864;font-size:20px;text-align:center;margin-bottom:2px}'
    + '.sub{text-align:center;color:#595959;font-style:italic;font-size:10.5px;margin-bottom:4px}'
    + '.marcas{text-align:center;color:#1F3864;font-weight:bold;font-size:12px;margin-bottom:3px}'
    + '.moneda{text-align:center;color:#7A7A7A;font-size:9px;margin-bottom:12px}'
    + 'table{width:100%;border-collapse:collapse}'
    + 'th{background:#BF8F00;color:#FFF;padding:5px 8px;text-align:left;font-size:11px}'
    + 'th.num,td.num{text-align:right}'
    + 'td{padding:4px 8px;border-bottom:1px solid #E0E0E0}'
    + 'tr:nth-child(even) td{background:#F7F7F7}'
    + '.pie{margin-top:14px;text-align:center;color:#595959;font-style:italic;font-size:9.5px}'
    + '@media print{body{margin:10mm}thead{display:table-header-group}}'
    + '</style></head><body>'
    + '<h1>ARJ — AGRO REPUESTOS Y SERVICIOS JIMÉNEZ</h1>'
    + '<div class="sub">Lista de Precios · Repuestos para Maquinaria Agrícola · ' + hoy + '</div>'
    + '<div class="marcas">' + esc(nombreMarcas()) + '</div>'
    + '<div class="moneda">' + leyendaMoneda() + '</div>'
    + '<table><thead><tr><th>Código</th><th>Descripción</th><th>Marca</th><th class="num">Ref. USD</th></tr></thead><tbody>';
  filas.value.forEach(p => {
    const desc = (p.desc || '').replace(/[\r\n]+/g, ' ').trim();
    html += '<tr><td>' + esc(p.cod_alt) + '</td><td>' + esc(desc) + '</td><td>' + esc(p.marca || '') + '</td><td class="num">$ ' + precioLista(p).toFixed(2) + '</td></tr>';
  });
  html += '</tbody></table>'
    + '<div class="pie">Precios sujetos a cambio sin previo aviso · Consulte disponibilidad · IVA exento (Decreto 126) · Acarigua, Portuguesa — Venezuela</div>'
    + '</body></html>';
  if (!imprimirHTML(html)) { store.notif('El navegador bloqueó la ventana. Permite popups para este sitio.', 'error'); return; }
  store.logBitacora('precio', 'Generó lista de precios PDF — ' + nombreMarcas() + ' (' + filas.value.length + ' productos)', false);
  store.modalListaPreciosActivo = false;
}

// ═══ SIMULADOR (solo gerente). ES UNA SIMULACIÓN: no escribe en productos ═══
const simAbierto = ref(false);
const LPA = ref([]);
const soloBajos = ref(false);
const tier = ref('Publico');
const detAbierto = ref(false);
const multGlobal = ref('');

const facDist = computed(() => PRECIOS_TIER[tier.value] || 1);
const dto = computed(() => store.dtoDivisaPct);

function abrirSimulador() {
  if (store.rol !== 'gerente') { store.notif('Solo el gerente puede ver los indicadores', 'error'); return; }
  if (!sel.value.length) { store.notif('Elige al menos una marca antes de ver los indicadores', 'error'); return; }
  if (!filas.value.length) { store.notif('No hay productos para analizar', 'error'); return; }
  LPA.value = filas.value.map(p => {
    const fob = parseFloat(p.fob) || 0;
    const pr = precioLista(p);
    const c = fob > 0 ? costoLanded(p, store.productos) : 0;
    const sd = fob > 0 ? costoSinDivisas(p, store.embarques, store.productos) : null;
    return {
      cod: p.cod_alt, desc: (p.desc || '').trim(), marca: (p.marca || '').trim(),
      uvd: parseInt(p.stock_vd) || 0, udist: parseInt(p.stock_dist) || 0,
      uds: (parseInt(p.stock_vd) || 0) + (parseInt(p.stock_dist) || 0),
      fob, costo: c, sinDiv: sd == null ? c : sd, sdOk: sd != null,
      manual: p.precio_manual != null && p.precio_manual > 0,
      pr0: pr, pr, tocado: false
    };
  });
  soloBajos.value = false; detAbierto.value = false; multGlobal.value = ''; tier.value = 'Publico';
  simAbierto.value = true;
  store.logBitacora('precio', 'Abrió el simulador de precios — ' + nombreMarcas() + ' (' + filas.value.length + ' productos)', false);
}

const mult = r => (r.fob > 0 ? r.pr / r.fob : NaN);
// Mientras un campo tiene el foco se muestra lo que se está escribiendo: si se
// reformateara en cada tecla no se podría escribir "12." (el monolito tampoco lo pisaba)
const buf = ref({});
function valorCampo(r, campo) {
  const k = r.cod + '|' + campo;
  if (k in buf.value) return buf.value[k];
  return campo === 'm' ? mult(r).toFixed(2) : r.pr.toFixed(2);
}
// Las unidades de Distribuidora valen distinto si hay descuento de aliado
const totalFila = r => r.pr * r.uvd + r.pr * facDist.value * r.udist;
const margen = r => (r.pr > 0 && r.fob > 0 ? (r.pr - r.costo) / r.pr * 100 : NaN);
const colorMg = m => (!Number.isFinite(m) ? 'var(--dgray)' : (m < MARGEN_MINIMO ? '#B00020' : (m < 40 ? '#BF8F00' : '#1E7B34')));
const pc = (x, b) => (b > 0 ? (x / b * 100).toFixed(1) + '%' : '—');

const filasVisibles = computed(() => LPA.value.filter(r => !soloBajos.value || (Number.isFinite(margen(r)) && margen(r) < MARGEN_MINIMO)));

const T = computed(() => {
  const fd = facDist.value;
  const Z = () => ({ uds: 0, venta: 0, costo: 0 });
  const vd = Z(), di = Z();
  let uds = 0, venta = 0, costo = 0, fobT = 0, sinDiv = 0, venta0 = 0;
  let nSF = 0, udsSF = 0, ventaSF = 0, nSinEmb = 0, nBajos = 0, nTocados = 0;
  LPA.value.forEach(r => {
    if (r.tocado) nTocados++;
    const prD = r.pr * fd;
    if (r.fob <= 0) { nSF++; udsSF += r.uds; ventaSF += r.pr * r.uvd + prD * r.udist; return; }
    vd.uds += r.uvd; vd.venta += r.pr * r.uvd; vd.costo += r.costo * r.uvd;
    di.uds += r.udist; di.venta += prD * r.udist; di.costo += r.costo * r.udist;
    uds += r.uds; venta += r.pr * r.uvd + prD * r.udist;
    venta0 += r.pr0 * r.uvd + r.pr0 * fd * r.udist;
    costo += r.costo * r.uds; fobT += r.fob * r.uds; sinDiv += r.sinDiv * r.uds;
    if (!r.sdOk) nSinEmb++;
    const m = margen(r); if (Number.isFinite(m) && m < MARGEN_MINIMO) nBajos++;
  });
  const fin = o => { o.util = o.venta - o.costo; o.mg = o.venta > 0 ? o.util / o.venta * 100 : 0; return o; };
  const util = venta - costo;
  return {
    vd: fin(vd), di: fin(di), facDist: fd, uds, venta, venta0, costo, fobT, sinDiv,
    util, mg: venta > 0 ? util / venta * 100 : 0, util0: venta0 - costo,
    multFob: fobT > 0 ? venta / fobT : 0, multCosto: costo > 0 ? venta / costo : 0,
    prima: costo - sinDiv, logis: sinDiv - fobT,
    nSF, udsSF, ventaSF, nSinEmb, nBajos, nTocados
  };
});
const verde = computed(() => {
  const venta = T.value.venta * (1 - dto.value / 100);
  return { venta, util: venta - T.value.costo };
});

function cambioMult(r, v) {
  const m = parseFloat(v);
  if (!Number.isFinite(m) || m < 0 || r.fob <= 0) return;
  r.pr = Math.round(r.fob * m * 100) / 100;
  r.tocado = true;
}
function cambioPrecio(r, v) {
  const p = parseFloat(v);
  if (!Number.isFinite(p) || p < 0) return;
  r.pr = Math.round(p * 100) / 100;
  r.tocado = true;
}
// Los sin FOB no se pueden multiplicar: se cuentan y se avisa
function aplicarGlobal() {
  const v = parseFloat(multGlobal.value);
  if (!Number.isFinite(v) || v <= 0) { store.notif('Escribe un multiplicador válido (ej. 2.5)', 'error'); return; }
  let n = 0, saltados = 0;
  LPA.value.forEach(r => {
    if (r.fob <= 0) { saltados++; return; }
    r.pr = Math.round(r.fob * v * 100) / 100; r.tocado = true; n++;
  });
  store.notif('×' + v + ' aplicado a ' + n + ' producto(s)' + (saltados > 0 ? ' · ' + saltados + ' sin FOB quedaron igual' : ''), 'success');
}
// Lleva al MARGEN_MINIMO solo a los que están por debajo
function subirBajos() {
  let n = 0;
  LPA.value.forEach(r => {
    const m = margen(r);
    if (!Number.isFinite(m) || m >= MARGEN_MINIMO || r.fob <= 0) return;
    r.pr = Math.round(r.costo / (1 - MARGEN_MINIMO / 100) * 100) / 100; r.tocado = true; n++;
  });
  if (n === 0) { store.notif('No hay productos por debajo del ' + MARGEN_MINIMO + '%', 'success'); return; }
  store.notif('✓ ' + n + ' producto(s) llevados al ' + MARGEN_MINIMO + '% de margen', 'success');
}
function restaurar() {
  LPA.value.forEach(r => { r.pr = r.pr0; r.tocado = false; });
  store.notif('Precios restaurados a los de la lista', 'success');
}

// CSV interno: lleva costo y margen, NUNCA se le manda a un cliente
function simCSV() {
  const fd = facDist.value;
  const num = x => (Number.isFinite(x) ? x.toFixed(2).replace('.', ',') : '');
  let csv = 'Codigo;Descripcion;Marca;Uds V.Directa;Uds Distribuidora;FOB;Costo landed;'
    + 'Precio actual;Precio simulado;xFOB;Margen %;Total V.Directa;Total Distribuidora;Total linea\n';
  LPA.value.forEach(r => {
    csv += [r.cod, r.desc.replace(/[\r\n;]+/g, ' '), r.marca, r.uvd, r.udist,
      num(r.fob), num(r.costo), num(r.pr0), num(r.pr), num(mult(r)), num(margen(r)),
      num(r.pr * r.uvd), num(r.pr * fd * r.udist), num(totalFila(r))].join(';') + '\n';
  });
  const t = T.value;
  csv += ';;;;;;;;;;;;;\n';
  csv += 'TOTALES;;;' + t.vd.uds + ';' + t.di.uds + ';' + num(t.fobT) + ';' + num(t.costo)
    + ';' + num(t.venta0) + ';' + num(t.venta) + ';' + num(t.multFob) + ';' + num(t.mg)
    + ';' + num(t.vd.venta) + ';' + num(t.di.venta) + ';' + num(t.venta) + '\n';
  csv += 'UTILIDAD;;;;;;;;;;;' + num(t.vd.util) + ';' + num(t.di.util) + ';' + num(t.util) + '\n';
  csv += 'Distribuidora valorada con tier;' + tier.value + '\n';
  descargarArchivo('ARJ_INTERNO_Simulacion_Precios_' + new Date().toISOString().slice(0, 10) + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
  store.logBitacora('precio', 'Exportó simulación de precios (INTERNO) — ' + LPA.value.length + ' productos', false);
  store.notif('✓ CSV interno descargado — no se lo mandes a un cliente', 'success');
}

// Informe PDF INTERNO: rotulado en la cabecera y al pie para no confundirlo con la lista
function simPDF() {
  if (!LPA.value.length) { store.notif('No hay nada que informar', 'error'); return; }
  const t = T.value;
  const d = dto.value;
  const ventaV = t.venta * (1 - d / 100);
  const utilV = ventaV - t.costo;
  const hoy = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
  const nTier = { Publico: 'precio público', T1: 'Aliado T1 (−5%)', T2: 'Aliado T2 (−10%)', T3: 'Aliado T3 (−20%)' }[tier.value] || tier.value;

  let h = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ARJ Informe Interno de Precios</title><style>'
    + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + 'body{font-family:Arial,sans-serif;font-size:10.5px;color:#222;margin:20px}'
    + 'h1{color:#1F3864;font-size:18px;text-align:center;margin:0 0 2px}'
    + '.sub{text-align:center;color:#595959;font-size:10.5px;margin-bottom:3px}'
    + '.sello{text-align:center;background:#B00020;color:#FFF;font-weight:bold;font-size:11px;'
    + 'padding:4px;border-radius:4px;margin:8px 0 12px;letter-spacing:.5px}'
    + 'h2{color:#1F3864;font-size:12.5px;margin:14px 0 5px;border-bottom:2px solid #BF8F00;padding-bottom:2px}'
    + 'table{width:100%;border-collapse:collapse;margin-bottom:4px}'
    + 'th{background:#BF8F00;color:#FFF;padding:4px 6px;text-align:left;font-size:10px}'
    + 'th.n,td.n{text-align:right}'
    + 'td{padding:3px 6px;border-bottom:1px solid #E0E0E0}'
    + 'tr:nth-child(even) td{background:#F7F7F7}'
    + '.big{background:#F2F5FA;border-radius:6px;padding:10px;text-align:center;margin-bottom:10px}'
    + '.big .n{font-size:22px;font-weight:800;color:#1E7B34}'
    + '.tot td{font-weight:bold;background:#EDEFF4 !important;border-top:2px solid #1F3864}'
    + '.rojo{color:#B00020;font-weight:bold}.verde{color:#1E7B34}'
    + '.nota{font-size:9px;color:#595959;font-style:italic;margin-top:3px;line-height:1.4}'
    + '.pie{margin-top:12px;padding-top:6px;border-top:1px solid #D9D9D9;text-align:center;color:#B00020;font-size:9px;font-weight:bold}'
    + '@media print{body{margin:10mm}thead{display:table-header-group}tr{page-break-inside:avoid}}'
    + '</style></head><body>'
    + '<h1>ARJ — AGRO REPUESTOS Y SERVICIOS JIMÉNEZ</h1>'
    + '<div class="sub">Informe de precios y rentabilidad · ' + hoy + '</div>'
    + '<div class="sub"><strong>' + esc(nombreMarcas()) + '</strong> · ' + LPA.value.length + ' productos · '
    + (t.uds + t.udsSF).toLocaleString('es-VE') + ' unidades en existencia</div>'
    + '<div class="sello">DOCUMENTO INTERNO — CONTIENE COSTOS Y MÁRGENES — NO ENTREGAR A CLIENTES</div>';

  h += '<div class="big"><div style="font-size:10px;color:#595959;text-transform:uppercase;letter-spacing:.5px">Utilidad bruta estimada</div>'
    + '<div class="n">' + fmtUSD(t.util) + '</div>'
    + '<div style="font-size:10.5px;color:#595959">margen ' + t.mg.toFixed(1) + '% sobre una facturación de '
    + fmtUSD(t.venta) + '</div></div>';

  h += '<h2>Resultado por canal</h2><table>'
    + '<tr><th>Concepto</th><th class="n">Venta Directa</th><th class="n">Distribuidora</th><th class="n">Total</th></tr>'
    + '<tr><td>Unidades</td><td class="n">' + t.vd.uds.toLocaleString('es-VE') + '</td><td class="n">'
    + t.di.uds.toLocaleString('es-VE') + '</td><td class="n">' + t.uds.toLocaleString('es-VE') + '</td></tr>'
    + '<tr><td>Facturación</td><td class="n">' + fmtUSD(t.vd.venta) + '</td><td class="n">'
    + fmtUSD(t.di.venta) + '</td><td class="n">' + fmtUSD(t.venta) + '</td></tr>'
    + '<tr><td>Costo landed</td><td class="n">' + fmtUSD(t.vd.costo) + '</td><td class="n">'
    + fmtUSD(t.di.costo) + '</td><td class="n">' + fmtUSD(t.costo) + '</td></tr>'
    + '<tr class="tot"><td>Utilidad bruta</td><td class="n">' + fmtUSD(t.vd.util) + '</td><td class="n">'
    + fmtUSD(t.di.util) + '</td><td class="n">' + fmtUSD(t.util) + '</td></tr>'
    + '<tr><td>Margen</td><td class="n">' + t.vd.mg.toFixed(1) + '%</td><td class="n">'
    + t.di.mg.toFixed(1) + '%</td><td class="n">' + t.mg.toFixed(1) + '%</td></tr>'
    + '<tr><td>Aporte a la utilidad</td><td class="n">' + pc(t.vd.util, t.util) + '</td><td class="n">'
    + pc(t.di.util, t.util) + '</td><td class="n">100%</td></tr>'
    + '</table>'
    + '<div class="nota">Venta Directa valorada a precio público. Distribuidora valorada a ' + nTier + '.</div>';

  h += '<h2>De qué está hecho el costo</h2><table>'
    + '<tr><th>Componente</th><th class="n">Monto</th><th class="n">% del costo</th></tr>'
    + '<tr><td>FOB (la mercancía)</td><td class="n">' + fmtUSD(t.fobT) + '</td><td class="n">' + pc(t.fobT, t.costo) + '</td></tr>'
    + '<tr><td>Flete + aduana + comisión</td><td class="n">' + fmtUSD(t.logis) + '</td><td class="n">' + pc(t.logis, t.costo) + '</td></tr>'
    + '<tr><td>Prima por compra de divisas</td><td class="n">' + fmtUSD(t.prima) + '</td><td class="n">' + pc(t.prima, t.costo) + '</td></tr>'
    + '<tr class="tot"><td>Costo landed total</td><td class="n">' + fmtUSD(t.costo) + '</td><td class="n">100%</td></tr>'
    + '</table>'
    + '<div class="nota">Multiplicador promedio ponderado: ×' + t.multFob.toFixed(2) + ' sobre FOB · ×'
    + t.multCosto.toFixed(2) + ' sobre costo landed real. El segundo es el que se compara contra la competencia.</div>';

  h += '<h2>Si todo se cobrara en efectivo (−' + d.toFixed(1) + '%)</h2><table>'
    + '<tr><th>Concepto</th><th class="n">Monto</th></tr>'
    + '<tr><td>Facturación en $ verde</td><td class="n">' + fmtUSD(ventaV) + '</td></tr>'
    + '<tr class="tot"><td>Utilidad en ese escenario</td><td class="n">' + fmtUSD(utilV) + ' · '
    + (ventaV > 0 ? (utilV / ventaV * 100).toFixed(1) : '0') + '%</td></tr></table>'
    + '<div class="nota">El descuento por pago en efectivo no es un regalo: es la conversión exacta de $BCV a $ físico.</div>';

  if (t.nBajos > 0 || t.nSF > 0) {
    h += '<h2>Puntos de atención</h2><ul style="margin:4px 0 0 16px;padding:0;line-height:1.6">';
    if (t.nBajos > 0) h += '<li><span class="rojo">' + t.nBajos + ' producto(s)</span> por debajo del ' + MARGEN_MINIMO + '% de margen.</li>';
    if (t.nSF > 0) h += '<li><span class="rojo">' + t.nSF + ' producto(s) sin FOB</span> (' + t.udsSF.toLocaleString('es-VE')
      + ' unidades, ' + fmtUSD(t.ventaSF) + '): sin costo calculable, excluidos de la utilidad.</li>';
    if (t.nSinEmb > 0) h += '<li>' + t.nSinEmb + ' producto(s) sin embarque localizable: su prima de divisas quedó dentro del FOB.</li>';
    h += '</ul>';
  }

  h += '<h2>Detalle por producto</h2><table>'
    + '<thead><tr><th>Código</th><th>Descripción</th><th class="n">V.D.</th><th class="n">Dist.</th>'
    + '<th class="n">FOB</th><th class="n">Costo</th><th class="n">×FOB</th><th class="n">Precio</th>'
    + '<th class="n">Margen</th><th class="n">Total</th></tr></thead><tbody>';
  LPA.value.slice().sort((a, b) => (a.marca + a.desc).localeCompare(b.marca + b.desc)).forEach(r => {
    const m = mult(r), mg = margen(r);
    const bajo = Number.isFinite(mg) && mg < MARGEN_MINIMO;
    h += '<tr><td>' + esc(r.cod) + '</td><td>' + esc(r.desc.slice(0, 44)) + '</td>'
      + '<td class="n">' + (r.uvd || '—') + '</td><td class="n">' + (r.udist || '—') + '</td>'
      + '<td class="n">' + (r.fob > 0 ? fmtUSD(r.fob) : '—') + '</td>'
      + '<td class="n">' + (r.fob > 0 ? fmtUSD(r.costo) : '—') + '</td>'
      + '<td class="n">' + (Number.isFinite(m) ? '×' + m.toFixed(2) : '—') + '</td>'
      + '<td class="n">' + fmtUSD(r.pr) + '</td>'
      + '<td class="n' + (bajo ? '" style="color:#B00020;font-weight:bold' : '') + '">'
      + (Number.isFinite(mg) ? mg.toFixed(1) + '%' : '—') + '</td>'
      + '<td class="n">' + fmtUSD(totalFila(r)) + '</td></tr>';
  });
  h += '<tr class="tot"><td colspan="2">TOTALES</td><td class="n">' + t.vd.uds.toLocaleString('es-VE')
    + '</td><td class="n">' + t.di.uds.toLocaleString('es-VE') + '</td>'
    + '<td class="n">' + fmtUSD(t.fobT) + '</td><td class="n">' + fmtUSD(t.costo) + '</td>'
    + '<td class="n">×' + t.multFob.toFixed(2) + '</td><td class="n">—</td>'
    + '<td class="n">' + t.mg.toFixed(1) + '%</td><td class="n">' + fmtUSD(t.venta) + '</td></tr>'
    + '</tbody></table>';

  h += '<div class="nota">Estimado de gestión sobre el inventario en existencia. No contempla costos fijos '
    + 'ni gastos operativos, y supone que se vende la totalidad del stock listado.</div>'
    + '<div class="pie">DOCUMENTO INTERNO — NO ENTREGAR A CLIENTES · ARJ · Acarigua, Portuguesa</div>'
    + '</body></html>';

  if (!imprimirHTML(h)) { store.notif('El navegador bloqueó la ventana. Permite popups para este sitio.', 'error'); return; }
  store.logBitacora('precio', 'Generó informe PDF interno de precios — ' + nombreMarcas() + ' (' + LPA.value.length + ' productos)', false);
}
</script>

<style scoped>
.lpa-h { background: #BF8F00; color: #FFF; padding: 5px 6px }
.lpa-td { padding: 3px 6px; border-bottom: 1px solid var(--border); white-space: nowrap }
.lpa-inp { padding: 3px; border: 1px solid var(--border); border-radius: 4px; font-size: 12px; font-family: inherit; background: var(--card, #FFF); color: inherit }
.lpa-th { text-align: left; padding: 2px 6px; color: var(--dgray); font-size: 10px; text-transform: uppercase }
.lpa-c { padding: 2px 6px }
.lpa-n { text-align: right; white-space: nowrap }
.lpa-g { color: var(--dgray) }
</style>
