<template>
  <!-- Despachar Distribuidora → Venta Directa (monolito v13.5 / v13.14) -->
  <div v-if="store.modalTraspasoActivo" class="modal show" id="modal-traspaso">
    <div class="modal-content" style="max-width:760px;text-align:left;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:12px">
        <h3 style="margin:0;font-size:18px;color:var(--navy);font-weight:600"><i class="ti ti-arrows-exchange"></i> Despachar a Venta Directa</h3>
        <button class="btn btn-secondary btn-sm" @click="cerrar"><i class="ti ti-x"></i></button>
      </div>

      <!-- PASO 1 -->
      <div v-if="paso === 1">
        <div style="display:flex;gap:6px;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:8px">
          <button :class="modo === 'sel' ? 'btn btn-sm' : 'btn btn-secondary btn-sm'" @click="modo = 'sel'"><i class="ti ti-list-check"></i> Seleccionar</button>
          <button :class="modo === 'txt' ? 'btn btn-sm' : 'btn btn-secondary btn-sm'" @click="modo = 'txt'"><i class="ti ti-clipboard"></i> Pegar lista</button>
        </div>
        <div style="margin-bottom:10px">
          <label class="tr-lbl">Referencia / motivo (opcional)</label>
          <input v-model="referencia" type="text" class="val-input" placeholder="Ej: Reposición mostrador semana 33" style="width:100%">
        </div>

        <div v-if="modo === 'sel'">
          <div style="background:var(--lblue);border-radius:6px;padding:9px 12px;margin-bottom:10px;font-size:11.5px;color:var(--navy)">
            <i class="ti ti-ship"></i> Solo aparecen productos <strong>sellados con embarque</strong> y con stock en Distribuidora. Lo que no se ha sellado todavía no ha llegado al galpón.
          </div>
          <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label class="tr-lbl">Embarque</label>
              <select v-model="embSel" class="val-input" style="width:100%">
                <option v-if="!opcionesEmb.length" value="">— Nada sellado con stock —</option>
                <option v-for="o in opcionesEmb" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
            <div>
              <label class="tr-lbl">Buscar</label>
              <input v-model="buscar" type="text" class="val-input" placeholder="Código o descripción" style="width:100%">
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" @click="mitad"><i class="ti ti-divide"></i> La mitad de todo</button>
            <button class="btn btn-secondary btn-sm" @click="cant = {}"><i class="ti ti-eraser"></i> Limpiar</button>
            <span style="font-size:10.5px;color:var(--dgray)">La mitad del stock actual en Distribuidora, redondeando hacia abajo</span>
          </div>
          <div style="max-height:290px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
            <div v-if="!filtrados.length" style="padding:22px;text-align:center;color:var(--dgray);font-size:12px">
              <i class="ti ti-package-off" style="font-size:26px;display:block;margin-bottom:6px"></i>
              No hay productos con stock en Distribuidora para este filtro.
            </div>
            <table v-else style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="background:var(--gray);position:sticky;top:0;z-index:1">
                <th style="text-align:left;padding:7px 10px">Producto</th>
                <th style="text-align:right;padding:7px 8px">Distrib.</th>
                <th style="text-align:right;padding:7px 8px">Directa</th>
                <th style="text-align:right;padding:7px 10px;width:96px">Mover</th>
              </tr></thead>
              <tbody>
                <tr v-for="p in filtrados" :key="p.id" style="border-top:1px solid var(--border)">
                  <td style="padding:6px 10px"><span style="font-family:ui-monospace,monospace;font-weight:600">{{ p.cod_alt }}</span>
                    <div style="font-size:11px;color:var(--dgray)">{{ (p.desc || '').slice(0, 40) }}{{ p.marca ? ' · ' + p.marca : '' }}</div></td>
                  <td style="padding:6px 8px;text-align:right;font-weight:600">{{ p.stock_dist || 0 }}</td>
                  <td style="padding:6px 8px;text-align:right;color:var(--dgray)">{{ p.stock_vd || 0 }}</td>
                  <td style="padding:6px 10px;text-align:right">
                    <input type="text" inputmode="numeric" :value="cant[p.cod_alt] || ''"
                      :style="{ width: '74px', textAlign: 'right', padding: '5px 7px', border: '1px solid ' + (cant[p.cod_alt] ? 'var(--green)' : 'var(--border)'), borderRadius: '6px', fontSize: '12.5px', fontFamily: 'inherit' }"
                      @input="setCant(p, $event)">
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:8px 11px;background:var(--gray);border-radius:6px;font-size:12px">
            <span style="color:var(--dgray)">{{ contador.prods }} producto(s) · {{ contador.unids.toLocaleString('es-VE') }} unidades</span>
            <span style="font-weight:600;color:var(--navy)">Valor a costo: {{ fmtUSD(contador.valor) }}</span>
          </div>
        </div>

        <div v-else>
          <div style="background:var(--lblue);border-radius:6px;padding:9px 12px;margin-bottom:12px;font-size:11.5px;color:var(--navy)">
            <i class="ti ti-info-circle"></i> Mueve stock de <strong>Distribuidora</strong> a <strong>Venta Directa</strong>. Pega <strong>código</strong> y <strong>cantidad</strong>, una línea por producto.
          </div>
          <textarea v-model="texto" placeholder="5198060	5&#10;82025254	2"
            style="width:100%;min-height:170px;background:#FFF;border:1px solid var(--border);border-radius:6px;padding:10px;font-size:13px;font-family:ui-monospace,Menlo,Consolas,monospace;resize:vertical"></textarea>
        </div>
      </div>

      <!-- PASO 2: revisión -->
      <div v-else-if="paso === 2 && A">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          <div class="rec-kpi" style="background:var(--lgreen)"><div class="rec-kpi-l">Se despachan</div><div class="rec-kpi-v" style="color:var(--green)">{{ A.ok.length }}</div></div>
          <div class="rec-kpi" style="background:var(--lblue)"><div class="rec-kpi-l">Unidades</div><div class="rec-kpi-v" style="color:var(--navy)">{{ resumen.unid.toLocaleString('es-VE') }}</div></div>
          <div class="rec-kpi" style="background:var(--lgold)"><div class="rec-kpi-l">Valor a costo</div><div class="rec-kpi-v" style="color:#854F0B">{{ fmtUSD(resumen.valor) }}</div></div>
        </div>
        <div v-if="A.sinStock.length" class="tr-aviso-rojo">
          <i class="ti ti-alert-triangle"></i> <strong>{{ A.sinStock.length }} producto(s) no tienen suficiente stock en Distribuidora</strong> y no se van a mover. Distribuidora no puede quedar en negativo.</div>
        <div v-if="A.malas.length" class="tr-aviso-rojo"><i class="ti ti-x"></i> {{ A.malas.length }} línea(s) con problema.</div>
        <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-top:10px">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:var(--gray);position:sticky;top:0">
              <th style="text-align:left;padding:7px 10px">Código</th><th style="text-align:left;padding:7px 10px">Descripción</th>
              <th style="text-align:right;padding:7px 10px">Mueve</th>
              <th style="text-align:right;padding:7px 10px">Distrib.</th><th style="text-align:right;padding:7px 10px">Directa</th>
            </tr></thead>
            <tbody>
              <tr v-for="r in A.ok" :key="r.cod" style="border-top:1px solid var(--border)">
                <td style="padding:6px 10px;font-family:ui-monospace,monospace">{{ r.cod }}</td>
                <td style="padding:6px 10px;color:var(--dgray)">{{ (r.prod.desc || '').slice(0, 34) }}</td>
                <td style="padding:6px 10px;text-align:right;font-weight:600">{{ r.cant }}</td>
                <td style="padding:6px 10px;text-align:right;color:var(--dgray)">{{ r.distAntes }} → <strong style="color:var(--navy)">{{ r.distDespues }}</strong></td>
                <td style="padding:6px 10px;text-align:right;color:var(--dgray)">{{ r.vdAntes }} → <strong style="color:var(--green)">{{ r.vdDespues }}</strong></td>
              </tr>
              <tr v-for="r in A.sinStock" :key="'s' + r.cod" style="border-top:1px solid var(--border);background:#FEF5F5">
                <td style="padding:6px 10px;font-family:ui-monospace,monospace;color:var(--red)">{{ r.cod }}</td>
                <td colspan="4" style="padding:6px 10px;color:var(--red)">Pides {{ r.cant }} y solo hay {{ r.distAntes }} en Distribuidora (faltan {{ r.falta }})</td>
              </tr>
              <tr v-for="m in A.malas" :key="'m' + m.linea" style="border-top:1px solid var(--border);background:#FEF5F5">
                <td style="padding:6px 10px;font-family:ui-monospace,monospace;color:var(--red)">{{ m.cod || '—' }}</td>
                <td colspan="4" style="padding:6px 10px;color:var(--red)">Línea {{ m.linea }}: {{ m.error }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- PASO 3: resultado -->
      <div v-else-if="paso === 3 && nota">
        <div style="text-align:center;padding:22px 10px">
          <i class="ti ti-circle-check" style="font-size:44px;color:var(--green)"></i>
          <div style="font-size:17px;font-weight:600;color:var(--navy);margin-top:10px">{{ nota.renglones }} producto(s) despachados a Venta Directa</div>
          <div v-if="nota.ref" style="font-size:12.5px;color:var(--dgray);margin-top:4px">{{ nota.ref }}</div>
          <div style="margin-top:14px">
            <div style="font-size:12.5px;color:var(--dgray);margin-bottom:8px">Nota de entrega <strong style="color:var(--navy)">{{ nota.numero }}</strong></div>
            <button class="btn btn-primary" @click="imprimirNota"><i class="ti ti-printer"></i> Ver / imprimir nota de entrega</button>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;border-top:1px solid var(--gray);padding-top:12px">
        <button v-if="paso !== 2" class="btn btn-secondary" @click="cerrar">{{ paso === 3 ? 'Cerrar' : 'Cancelar' }}</button>
        <button v-if="paso === 2" class="btn btn-secondary" :disabled="aplicando" @click="paso = 1">← Corregir</button>
        <button v-if="paso === 1" class="btn btn-primary" @click="revisar"><i class="ti ti-eye"></i> Revisar</button>
        <button v-if="paso === 2 && A && A.ok.length" class="btn btn-primary" :disabled="aplicando" @click="aplicar">
          <template v-if="aplicando">Moviendo...</template>
          <template v-else><i class="ti ti-check"></i> Despachar</template>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD, costoLanded } from '../../services/pricing.js';
import { cargarItemsNotaEntrega } from '../../services/supabase.js';
import { generarNotaEntregaPDF } from '../../services/exportLazy.js';
import { parsearLineas, buscarPorCodigo } from '../../services/monolito.js';

const store = useArjStore();
const paso = ref(1);
const modo = ref('sel');
const referencia = ref('');
const texto = ref('');
const embSel = ref('');
const buscar = ref('');
const cant = ref({});      // { cod_alt: cantidad } — sobrevive a los filtros
const A = ref(null);
const aplicando = ref(false);
const nota = ref(null);

const activos = computed(() => store.productos.filter(p => p.activo !== false));

// Regla de JJ: sellado = llegó al galpón. Solo embarques con algo que despachar.
const opcionesEmb = computed(() => {
  const ops = store.embarques
    .map(e => ({ e, n: activos.value.filter(p => p.embarque_id === e.id && (p.stock_dist || 0) > 0).length }))
    .filter(x => x.n > 0)
    .map(x => ({ value: x.e.id, label: `${x.e.codigo} · ${x.n} con stock` }));
  // Stock sin sellar es una señal: algo entró sin pasar por Recepción. Se muestra aparte.
  const huerfanos = activos.value.filter(p => !p.embarque_id && (p.stock_dist || 0) > 0).length;
  if (huerfanos) ops.push({ value: '__sin__', label: `⚠ Sin embarque · ${huerfanos} con stock` });
  return ops;
});

watch(() => store.modalTraspasoActivo, abierto => {
  if (!abierto) return;
  paso.value = 1; modo.value = 'sel'; referencia.value = ''; texto.value = ''; buscar.value = '';
  cant.value = {}; A.value = null; nota.value = null;
  embSel.value = opcionesEmb.value.length ? opcionesEmb.value[0].value : '';
}, { immediate: true });

const filtrados = computed(() => {
  let lista = activos.value.filter(p => (p.stock_dist || 0) > 0);
  if (embSel.value === '__sin__') lista = lista.filter(p => !p.embarque_id);
  else if (embSel.value) lista = lista.filter(p => p.embarque_id === embSel.value);
  else return [];
  const q = buscar.value.trim().toLowerCase();
  if (q) lista = lista.filter(p => (String(p.cod_alt) + ' ' + String(p.cod_orig || '') + ' ' + String(p.desc || '') + ' ' + String(p.marca || '')).toLowerCase().includes(q));
  return lista.slice().sort((a, b) => String(a.cod_alt).localeCompare(String(b.cod_alt)));
});

// Se valida al escribir: enterarse en el paso 2 de que pediste de más es tarde
function setCant(p, ev) {
  const inp = ev.target;
  const max = p.stock_dist || 0;
  const v = String(inp.value).replace(/[^\d]/g, '');
  let n = parseInt(v, 10);
  const nuevo = { ...cant.value };
  if (!Number.isFinite(n) || n <= 0) { delete nuevo[p.cod_alt]; cant.value = nuevo; inp.value = v; return; }
  if (n > max) { n = max; store.notif('Solo hay ' + max + ' en Distribuidora', 'warning'); }
  inp.value = n;
  nuevo[p.cod_alt] = n;
  cant.value = nuevo;
}

function mitad() {
  if (!filtrados.value.length) { store.notif('No hay productos para repartir', 'error'); return; }
  const nuevo = { ...cant.value };
  let n = 0;
  filtrados.value.forEach(p => {
    const m = Math.floor((p.stock_dist || 0) / 2);
    if (m > 0) { nuevo[p.cod_alt] = m; n++; }
  });
  cant.value = nuevo;
  store.notif(n + ' producto(s) cargados con la mitad de su stock', 'success');
}

const contador = computed(() => {
  let prods = 0, unids = 0, valor = 0;
  Object.keys(cant.value).forEach(cod => {
    const c = cant.value[cod]; if (!c) return;
    const p = store.productos.find(x => String(x.cod_alt) === String(cod));
    if (!p) return;
    prods++; unids += c; valor += costoLanded(p, store.productos) * c;
  });
  return { prods, unids, valor };
});

// Puente entre las dos pestañas: la selección escribe el mismo formato que se pegaría
function revisar() {
  if (modo.value === 'sel') {
    const filas = Object.keys(cant.value).filter(c => cant.value[c] > 0).map(c => c + '\t' + cant.value[c]);
    if (!filas.length) { store.notif('No has puesto ninguna cantidad', 'error'); return; }
    texto.value = filas.join('\n');
  }
  analizar();
}

function analizar() {
  if (!texto.value.trim()) { store.notif('Pega la lista primero', 'error'); return; }
  const acum = {}, malas = [];
  parsearLineas(texto.value).forEach(f => {
    if (f.error) { malas.push(f); return; }
    const p = buscarPorCodigo(store.productos, f.cod);
    if (!p) { malas.push({ ...f, error: 'Código no existe en el catálogo' }); return; }
    if (f.cant === 0) { malas.push({ ...f, error: 'Cantidad en cero' }); return; }
    if (acum[p.cod_alt]) { acum[p.cod_alt].cant += f.cant; acum[p.cod_alt].lineas.push(f.linea); }
    else acum[p.cod_alt] = { prod: p, cant: f.cant, lineas: [f.linea] };
  });
  const ok = [], sinStock = [];
  Object.values(acum).forEach(c => {
    const disp = c.prod.stock_dist || 0;
    const fila = {
      prod: c.prod, cod: c.prod.cod_alt, cant: c.cant, lineas: c.lineas,
      distAntes: disp, distDespues: disp - c.cant, vdAntes: c.prod.stock_vd || 0, vdDespues: (c.prod.stock_vd || 0) + c.cant
    };
    // Distribuidora no puede quedar en negativo: sería stock inventado
    if (c.cant > disp) sinStock.push({ ...fila, falta: c.cant - disp });
    else ok.push(fila);
  });
  A.value = { ok, sinStock, malas };
  paso.value = 2;
}

const resumen = computed(() => ({
  unid: A.value ? A.value.ok.reduce((a, r) => a + r.cant, 0) : 0,
  valor: A.value ? A.value.ok.reduce((a, r) => a + costoLanded(r.prod, store.productos) * r.cant, 0) : 0
}));

// Todo en una sola operación del servidor: si un renglón falla, no se mueve nada
async function aplicar() {
  if (!A.value || !A.value.ok.length) return;
  if (!confirm(`Se van a mover ${A.value.ok.length} producto(s) de Distribuidora a Venta Directa.\n\n¿Despachar?`)) return;
  aplicando.value = true;
  try {
    const ref = referencia.value.trim();
    const r = await store.ejecutarTraspaso(A.value.ok.map(x => ({ producto_id: x.prod.id, cantidad: x.cant })), ref);
    if (!r) return;
    const embIds = [...new Set(A.value.ok.map(x => x.prod.embarque_id).filter(Boolean))];
    let embarque = '';
    if (embIds.length === 1) { const e = store.embarques.find(x => x.id === embIds[0]); embarque = e ? e.codigo : ''; }
    else if (embIds.length > 1) embarque = 'Varios (' + embIds.length + ')';
    nota.value = { ...r, ref, embarque };
    paso.value = 3;
  } finally {
    aplicando.value = false;
  }
}

async function imprimirNota() {
  try {
    const items = await cargarItemsNotaEntrega(nota.value.id);
    generarNotaEntregaPDF({
      numero: nota.value.numero, fecha: new Date(), embarque: nota.value.embarque, ref: nota.value.ref,
      items, totalCosto: nota.value.total_costo, unidades: nota.value.unidades
    }, store.usuarioNombre, 'print');
  } catch (e) {
    store.notif('No se pudo generar la nota: ' + e.message, 'error');
  }
}

function cerrar() { store.modalTraspasoActivo = false; }
</script>

<style scoped>
.tr-lbl { font-size: 11px; color: var(--dgray); font-weight: 500; display: block; margin-bottom: 3px }
.tr-aviso-rojo { background: #FEF5F5; border-left: 3px solid var(--red); border-radius: 6px; padding: 8px 12px; margin-top: 8px; font-size: 11.5px; color: #B71C1C }
.rec-kpi { border-radius: 8px; padding: 10px 12px }
.rec-kpi-l { font-size: 10.5px; color: var(--dgray); text-transform: uppercase; letter-spacing: .04em }
.rec-kpi-v { font-size: 19px; font-weight: 600 }
</style>
