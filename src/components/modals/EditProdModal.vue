<template>
  <!-- Mismo modal del monolito para editar y para crear (modal-edit-prod) -->
  <div v-if="store.modalEditProdActivo && store.productoSeleccionado" class="modal show" id="modal-edit-prod">
    <div class="modal-content" style="max-width:600px;text-align:left;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:12px">
        <h2 style="margin:0;text-align:left">Editar producto</h2>
        <button class="btn btn-secondary btn-sm" @click="cerrar"><i class="ti ti-x"></i></button>
      </div>
      <div id="edit-prod-fields">
        <div class="field-row"><label>Código alternativo:</label>
          <input v-model="f.cod_alt" type="text" :readonly="!esNuevo"
            :style="esNuevo ? 'background:#FFF;color:#222' : 'background:#F5F5F5;color:var(--dgray)'">
        </div>
        <div class="field-row"><label>Código original:</label><input v-model="f.cod_orig" type="text"></div>
        <div class="field-row"><label>Código de barras:</label>
          <input v-model="f.cod_barras" type="text" placeholder="Pasa el lector o escribe el código EAN/UPC"
            style="font-family:'Courier New',monospace;letter-spacing:1px">
        </div>
        <div class="field-row"><label>Descripción:</label><input v-model="f.desc" type="text"></div>
        <div class="field-row"><label>Marca:</label><input v-model="f.marca" type="text"></div>

        <!-- APLICACIÓN ESTRUCTURADA -->
        <div style="background:#F5F8FC;border-radius:6px;padding:10px 12px;margin:10px 0">
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:500;margin-bottom:8px">
            <i class="ti ti-tractor"></i> Aplicación del producto</div>
          <div class="field-row"><label>Marca y modelo:</label>
            <input v-model="f.marca_modelo" type="text" placeholder="Ej: John Deere 6420, Ford 5000...">
          </div>
          <div class="field-row">
            <label>Sistema:</label>
            <select v-model="f.sistema">
              <option value="">-- Selecciona --</option>
              <option v-for="s in opcionesSistema" :key="s" :value="s">{{ s }}</option>
            </select>
            <button type="button" class="btn btn-secondary btn-sm" title="Agregar nuevo sistema" @click="agregarSistemaNuevo"><i class="ti ti-plus"></i></button>
          </div>
        </div>

        <!-- PRECIOS -->
        <div style="background:#FFF8E1;border-radius:6px;padding:10px 12px;margin:10px 0">
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:500;margin-bottom:8px">
            <i class="ti ti-currency-dollar"></i> Precios del producto</div>
          <div style="font-size:11px;color:var(--dgray);margin:0 0 5px">Origen de la mercancía:</div>
          <div style="display:flex;gap:6px;margin:0 0 9px;flex-wrap:wrap">
            <button type="button" class="btn-multi" :style="{ background: f.origen === 'local' ? '#FFF' : '#FFE082' }"
              @click="setOrigen('importado')">Importado<small>flete + aduana</small></button>
            <button type="button" class="btn-multi" :style="{ background: f.origen === 'local' ? '#FFE082' : '#FFF' }"
              @click="setOrigen('local')">Compra local<small>ya está aquí</small></button>
          </div>
          <div class="field-row"><label>{{ f.origen === 'local' ? 'Costo de compra USD:' : 'Costo FOB USD:' }}</label>
            <input v-model="f.fob" type="number" step="0.01">
          </div>
          <div class="field-row"><label>Factor landed:</label><input v-model="f.factor_landed" type="number" step="0.001" min="1" max="5"></div>
          <div class="field-row"><label>Proveedor:</label>
            <input v-model="f.proveedor" type="text" list="lista-proveedores" placeholder="Ej: PANEGOSSI">
            <datalist id="lista-proveedores"><option v-for="v in proveedores" :key="v" :value="v" /></datalist>
          </div>
          <div style="font-size:11px;color:var(--dgray);margin:6px 0 3px">Atajos — multiplican el <strong>costo puesto aquí</strong> (FOB × factor). El % es el margen que te queda:</div>
          <div style="display:flex;gap:5px;margin:0 0 10px;flex-wrap:wrap">
            <button v-for="a in ATAJOS" :key="a.m" type="button" class="btn-multi" @click="aplicarMultiplicador(a.m)">×{{ a.m.toFixed(2) }}<small>{{ a.txt }}</small></button>
          </div>
          <div class="field-row" style="background:#FFFFFF;border:2px solid var(--gold);border-radius:6px;padding:8px 10px;margin:0">
            <label style="font-weight:700;color:var(--navy)">Precio de venta USD:</label>
            <input ref="inpPrecio" v-model="f.precio_manual" type="number" step="0.01" placeholder="Vacío = usa el ×2.5 automático"
              style="font-size:16px;font-weight:700;color:var(--navy)">
          </div>
          <div style="background:#FFF;border-radius:5px;padding:8px 10px;font-size:12px;color:var(--dgray);margin-top:6px">
            <template v-if="prev.tipo === 'completo'">
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline">
                <span>Precio de venta: <strong style="color:var(--navy);font-size:15px">${{ prev.manual.toFixed(2) }}</strong></span>
                <span style="color:var(--dgray)">Te cuesta puesto aquí: <strong>${{ prev.costo.toFixed(2) }}</strong>
                  <span style="font-size:10.5px">{{ prev.factor === 1 ? '(compra local, sin flete de importación)' : '(costo $' + prev.fob.toFixed(2) + ' × ' + prev.factor.toFixed(3).replace('.', ',') + ')' }}</span></span>
              </div>
              <div style="margin-top:5px;padding-top:5px;border-top:1px dashed var(--border);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <span>Ganas <strong :style="{ color: prev.col, fontSize: '15px' }">${{ prev.ganancia.toFixed(2) }}</strong> por unidad</span>
                <span style="color:var(--dgray)">Vendes a <strong>×{{ prev.mult.toFixed(1) }}</strong> el costo · Margen <strong :style="{ color: prev.col }">{{ prev.margen.toFixed(1) }}%</strong></span>
              </div>
            </template>
            <template v-else-if="prev.tipo === 'manual'">
              Precio manual: <strong style="color:var(--navy)">${{ prev.manual.toFixed(2) }} USD</strong> <span style="color:var(--dgray)">(falta el FOB para calcular la ganancia)</span>
            </template>
            <template v-else-if="prev.tipo === 'local'">
              <span style="color:var(--red);font-weight:600">Compra local: tienes que poner el precio de venta a mano.</span>
              <span style="color:var(--dgray)"> El escalón automático asume costo de fábrica y aquí te sobrepreciaría.</span>
            </template>
            <template v-else-if="prev.tipo === 'auto'">
              Precio sugerido automático (×2.5 escalonado): <strong style="color:var(--navy)">${{ prev.sugerido.toFixed(2) }} USD</strong> <span style="color:var(--dgray)">(sin precio manual)</span>
            </template>
            <template v-else>Precio público sugerido: <strong style="color:var(--navy)">— USD</strong></template>
          </div>
        </div>

        <div class="field-row"><label>Stock Venta Directa:</label><input v-model="f.stock_vd" type="number"></div>
        <div class="field-row"><label>Stock Distribuidora:</label><input v-model="f.stock_dist" type="number"></div>
        <div class="field-row" style="margin-top:8px"><label>Fotos (máx 3):</label>
          <div style="flex:1">
            <div style="display:flex;gap:8px;margin-bottom:6px">
              <div v-for="(u, i) in fotos" :key="u" style="position:relative">
                <img :src="u" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #ddd">
                <button title="Quitar foto" style="position:absolute;top:-6px;right:-6px;background:#c0392b;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1"
                  @click="fotos.splice(i, 1)">×</button>
              </div>
              <span v-if="!fotos.length" style="font-size:11px;color:var(--dgray)">Sin fotos</span>
            </div>
            <input ref="inpFoto" type="file" accept="image/*" multiple style="width:100%">
          </div>
        </div>
      </div>
      <div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:6px;padding:8px 10px;font-size:11.5px;color:#5D4037;margin-top:12px">
        <i class="ti ti-info-circle"></i> Los cambios se reflejarán inmediatamente en la cuenta de los vendedores.
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn btn-secondary" :disabled="guardando" @click="cerrar">Cancelar</button>
        <button class="btn btn-green" :disabled="guardando" @click="guardar"><i class="ti ti-check"></i> {{ guardando ? 'Guardando...' : 'Guardar cambios' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { precioPublico, redondeoBonito, fmtUSD, FACTOR_LANDED_FALLBACK } from '../../services/pricing.js';
import { fotosDe } from '../../services/monolito.js';

const store = useArjStore();
const f = ref({});
const fotos = ref([]);
const guardando = ref(false);
const inpPrecio = ref(null);
const inpFoto = ref(null);

// El margen sobre el costo landed es fijo: (mult - 1) / mult
const ATAJOS = [
  { m: 1.0, txt: 'al costo' }, { m: 1.5, txt: '33% mg' }, { m: 1.8, txt: '44% mg' },
  { m: 2.0, txt: '50% mg' }, { m: 2.25, txt: '56% mg' }, { m: 2.5, txt: '60% mg' }
];

const esNuevo = computed(() => !!(store.productoSeleccionado && store.productoSeleccionado._nuevo));
const factorDefault = () => (store.configuracion && store.configuracion.factor_default) || FACTOR_LANDED_FALLBACK;

// Si el producto trae un sistema que ya no está en la lista, se conserva
const opcionesSistema = computed(() => {
  const l = [...(store.sistemas || [])];
  if (f.value.sistema && !l.includes(f.value.sistema)) l.push(f.value.sistema);
  return l;
});
// La lista de proveedores se arma sola con los que ya existen en el catálogo
const proveedores = computed(() => [...new Set(store.productos.map(p => (p.proveedor || '').trim()).filter(Boolean))].sort());

watch(() => [store.modalEditProdActivo, store.productoSeleccionado], ([abierto, p]) => {
  if (!abierto || !p) return;
  f.value = {
    cod_alt: p.cod_alt || '', cod_orig: p.cod_orig || '', cod_barras: p.cod_barras || '', desc: p.desc || '',
    marca: p.marca || '', marca_modelo: p.marca_modelo || '', sistema: p.sistema || '',
    fob: p._nuevo ? '0' : p.fob, factor_landed: p.factor_landed || FACTOR_LANDED_FALLBACK,
    proveedor: p.proveedor || '', origen: p.origen || 'importado',
    precio_manual: p.precio_manual || '', stock_vd: p.stock_vd || 0, stock_dist: p.stock_dist || 0
  };
  fotos.value = fotosDe(p);
  if (inpFoto.value) inpFoto.value.value = '';
}, { immediate: true });

// Cambiar el origen a mano propone el factor típico; el número sigue editable
function setOrigen(org) {
  f.value.origen = org;
  f.value.factor_landed = org === 'local' ? '1.000' : factorDefault();
}

function factorActual() {
  const r = parseFloat(f.value.factor_landed);
  return (Number.isFinite(r) && r > 0) ? r : FACTOR_LANDED_FALLBACK;
}

// v13.12: los atajos multiplican el COSTO LANDED, no el FOB
function aplicarMultiplicador(mult) {
  const fob = parseFloat(f.value.fob) || 0;
  if (fob === 0) { store.notif('Primero ingresa el costo FOB', 'warning'); return; }
  const costo = fob * factorActual();
  // ×1,00 es "vender al costo" (traspaso FINARMA → ARJ): sale exacto
  const precio = mult === 1 ? Math.round(costo * 100) / 100 : redondeoBonito(costo * mult);
  f.value.precio_manual = precio.toFixed(2);
}

const prev = computed(() => {
  const fob = parseFloat(f.value.fob) || 0;
  const manual = parseFloat(f.value.precio_manual) || 0;
  const factor = factorActual();
  if (manual > 0 && fob > 0) {
    const costo = fob * factor;
    const ganancia = manual - costo;
    const margen = (ganancia / manual) * 100;
    const mult = costo > 0 ? manual / costo : 0;
    const col = margen < 25 ? 'var(--red)' : margen < 35 ? 'var(--gold)' : 'var(--green)';
    return { tipo: 'completo', fob, manual, factor, costo, ganancia, margen, mult, col };
  }
  if (manual > 0) return { tipo: 'manual', manual };
  if (fob > 0) return f.value.origen === 'local' ? { tipo: 'local' } : { tipo: 'auto', sugerido: precioPublico(fob) };
  return { tipo: 'vacio' };
});

async function agregarSistemaNuevo() {
  if (store.rol !== 'gerente') { store.notif('Solo el gerente puede crear sistemas', 'error'); return; }
  if (!store.supabaseConectado) { store.notif('Sin conexión: no se puede crear el sistema', 'error'); return; }
  const nombre = prompt('Nombre del nuevo sistema (ej: Transmisión, Aire acondicionado...):');
  if (!nombre || !nombre.trim()) return;
  if ((store.sistemas || []).includes(nombre.trim())) { store.notif('Ese sistema ya existe', 'warning'); return; }
  const creado = await store.crearSistema(nombre.trim());
  if (creado) f.value.sistema = creado;
}

function cerrar() {
  store.modalEditProdActivo = false;
  store.productoSeleccionado = null;
}

async function guardar() {
  const orig = store.productoSeleccionado;
  if (!orig) return;
  const d = f.value;
  const barrasAnt = orig.cod_barras || '';
  const nuevoBarras = String(d.cod_barras || '').trim();
  // El código de barras no puede estar en otro producto
  if (nuevoBarras && nuevoBarras !== barrasAnt) {
    const dup = store.productos.find(p => p.id !== orig.id && p.cod_barras === nuevoBarras);
    if (dup) { store.notif(`Ese código de barras ya está asignado a ${dup.cod_alt} (${dup.desc})`, 'error'); return; }
  }
  let codAlt = orig.cod_alt;
  if (esNuevo.value) {
    codAlt = String(d.cod_alt || '').trim();
    if (!codAlt) { store.notif('El código alternativo es obligatorio', 'error'); return; }
    if (store.productos.find(p => p.cod_alt === codAlt)) { store.notif('Ya existe un producto con ese código alternativo', 'error'); return; }
  }
  // v13.3: sin descripción el renglón sale EN BLANCO en la factura del cliente
  const desc = String(d.desc || '').trim();
  if (!desc) { store.notif('La descripción del producto es obligatoria', 'error'); return; }
  if (desc.length < 4) { store.notif('La descripción es muy corta para identificar el producto', 'error'); return; }
  // El origen tiene su propio campo: escribirlo en la descripción ensucia la factura
  if (/^\s*(DISTRIBUIDOR|LOCAL|IMPORTADO)\b/i.test(desc)) {
    if (!confirm('La descripción empieza con "' + desc.split(/\s+/)[0] + '".\n\nEl origen ya tiene su propio campo — ese prefijo va a salir impreso en la factura del cliente.\n\n¿Guardar así de todos modos?')) return;
  }
  const fac = parseFloat(d.factor_landed);
  if (!Number.isFinite(fac) || fac < 1 || fac > 5) {
    store.notif('El factor landed debe estar entre 1 y 5. Importado ≈1,471 · Local =1,000', 'error');
    return;
  }
  // v13.12: "12,50" con coma deja el input vacío; no se puede perder el precio en silencio
  const pm = String(d.precio_manual ?? '').trim();
  if (!pm && inpPrecio.value && inpPrecio.value.validity && inpPrecio.value.validity.badInput) {
    store.notif('No se entendio el precio de venta. Usa punto decimal, no coma (ej: 12.50).', 'error');
    return;
  }
  const pmNum = pm ? parseFloat(pm) : null;
  if (pm && (!Number.isFinite(pmNum) || pmNum <= 0)) {
    store.notif('El precio de venta no es un numero valido. Escribelo con punto decimal (ej: 12.50), o dejalo vacio para usar el automatico.', 'error');
    return;
  }
  // Compra local: el ×2.5 automático asume costo de fábrica y sobreprecia
  if (d.origen === 'local' && !pm) {
    store.notif('Producto de compra local: el precio de venta es obligatorio. El ×2.5 automático solo sirve para mercancía importada.', 'error');
    return;
  }

  const fob = parseFloat(d.fob) || 0;
  const datos = {
    id: esNuevo.value ? null : orig.id,
    cod_alt: codAlt, cod_orig: d.cod_orig || '', cod_barras: nuevoBarras, desc,
    marca: d.marca || '', marca_modelo: d.marca_modelo || '', sistema: d.sistema || '',
    fob, origen: d.origen === 'local' ? 'local' : 'importado', factor_landed: fac,
    proveedor: String(d.proveedor || '').trim().toUpperCase(), precio_manual: pmNum,
    stock_vd: parseInt(d.stock_vd) || 0, stock_dist: parseInt(d.stock_dist) || 0,
    stock_vd_original: esNuevo.value ? null : orig.stock_vd,
    stock_dist_original: esNuevo.value ? null : orig.stock_dist
  };

  let bitacora;
  if (esNuevo.value) bitacora = { texto: `Creó nuevo producto ${codAlt} - ${desc}`, critico: true };
  else if (orig.fob !== fob) bitacora = { texto: `Editó producto ${codAlt} — FOB de ${fmtUSD(orig.fob)} a ${fmtUSD(fob)}`, critico: true };
  else if (barrasAnt !== nuevoBarras) bitacora = { texto: `Editó producto ${codAlt} — código de barras actualizado a ${nuevoBarras || '(vacío)'}`, critico: false };
  else bitacora = { texto: `Editó producto ${codAlt} (${desc})`, critico: false };

  guardando.value = true;
  try {
    const archivos = inpFoto.value ? inpFoto.value.files : null;
    const lista = await store.subirFotosProducto({ id: datos.id, cod_alt: codAlt }, fotos.value, archivos);
    datos.imagen_url = lista.join('|');
    if (await store.guardarProducto(datos, bitacora)) cerrar();
  } finally {
    guardando.value = false;
  }
}
</script>
