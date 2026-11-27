<template>
  <!-- Modal ordenado para editar y crear productos (modal-edit-prod) -->
  <div v-if="store.modalEditProdActivo && store.productoSeleccionado" class="modal show" id="modal-edit-prod">
    <div class="modal-content ep-modal">
      <div class="ep-header">
        <div>
          <h2 class="ep-title">{{ esNuevo ? 'Nuevo producto' : 'Editar producto' }}</h2>
          <p v-if="!esNuevo && (f.cod_alt || f.desc)" class="ep-sub">{{ f.cod_alt }} {{ f.desc ? '· ' + f.desc : '' }}</p>
        </div>
        <button class="btn btn-secondary btn-sm" @click="cerrar" title="Cerrar"><i class="ti ti-x"></i></button>
      </div>

      <div id="edit-prod-fields" class="ep-body">
        <!-- 1. PRECIO DE VENTA PRINCIPAL (Lo primero que se ve) -->
        <div class="ep-price-hero">
          <div class="ep-price-hero-top">
            <div>
              <label class="ep-price-lbl" for="ep-inp-precio">
                <i class="ti ti-tag"></i> Precio de venta ($ BCV)
              </label>
              <div class="ep-price-hint">
                <span v-if="Number(f.precio_manual) > 0">Precio fijado por los encargados</span>
                <span v-else-if="precioLista > 0">Automático sugerido: <strong>{{ fmtUSD(precioLista) }}</strong> (vacío = automático)</span>
                <span v-else>Ingresa el precio de venta al público</span>
              </div>
            </div>
            <div class="ep-price-input-wrap">
              <span class="ep-currency">$</span>
              <input id="ep-inp-precio" ref="inpPrecio" v-model="f.precio_manual" type="number" step="0.01"
                placeholder="0.00" class="ep-price-input">
            </div>
          </div>
          <div v-if="precioLista > 0" class="ep-price-summary">
            Equivalente en efectivo (reposición): <strong>{{ equivalente === null ? 'Pendiente de tasas' : fmtUSD(equivalente) }}</strong>
          </div>
        </div>

        <!-- 2. IDENTIFICACIÓN Y STOCK -->
        <div class="ep-card">
          <div class="ep-card-title"><i class="ti ti-package"></i> Datos del producto y stock</div>
          <div class="ep-grid-2">
            <div class="ep-field">
              <label>Código alternativo</label>
              <input v-model="f.cod_alt" type="text" :readonly="!puedeEditarCodAlt"
                :class="{ 'ep-readonly': !puedeEditarCodAlt }"
                :title="puedeEditarCodAlt ? 'Código alternativo editable' : 'Solo el gerente puede modificar el código alternativo'">
            </div>
            <div class="ep-field">
              <label>Código original</label>
              <input v-model="f.cod_orig" type="text" placeholder="Ej: 787MY099016">
            </div>
          </div>

          <div class="ep-field" style="margin-top:10px">
            <label>Descripción</label>
            <input v-model="f.desc" type="text" placeholder="Descripción completa del repuesto">
          </div>

          <div class="ep-grid-3" style="margin-top:10px">
            <div class="ep-field">
              <label>Marca</label>
              <input v-model="f.marca" type="text" placeholder="Ej: Ford NH, Lonmar...">
            </div>
            <div class="ep-field">
              <label>Proveedor</label>
              <input v-model="f.proveedor" type="text" list="lista-proveedores" placeholder="Ej: PANEGOSSI">
              <datalist id="lista-proveedores"><option v-for="v in proveedores" :key="v" :value="v" /></datalist>
            </div>
            <div class="ep-field">
              <label>Código de barras</label>
              <input v-model="f.cod_barras" type="text" placeholder="EAN / UPC"
                style="font-family:'Courier New',monospace;letter-spacing:1px">
            </div>
          </div>

          <div class="ep-grid-2" style="margin-top:10px">
            <div class="ep-field">
              <label>Stock Venta Directa</label>
              <input v-model="f.stock_vd" type="number">
            </div>
            <div class="ep-field">
              <label>Stock Distribuidora</label>
              <input v-model="f.stock_dist" type="number">
            </div>
          </div>
        </div>

        <!-- 3. APLICACIÓN Y FOTOS -->
        <div class="ep-grid-2 ep-sections-row">
          <div class="ep-card" style="margin:0">
            <div class="ep-card-title"><i class="ti ti-tractor"></i> Aplicación</div>
            <div class="ep-field">
              <label>Marca y modelo</label>
              <input v-model="f.marca_modelo" type="text" placeholder="Ej: John Deere 6420, Ford 5000...">
            </div>
            <div class="ep-field" style="margin-top:10px">
              <label>Sistema</label>
              <div style="display:flex;gap:6px">
                <select v-model="f.sistema" style="flex:1">
                  <option value="">-- Selecciona --</option>
                  <option v-for="s in opcionesSistema" :key="s" :value="s">{{ s }}</option>
                </select>
                <button type="button" class="btn btn-secondary btn-sm" title="Agregar nuevo sistema" @click="agregarSistemaNuevo"><i class="ti ti-plus"></i></button>
              </div>
            </div>
          </div>

          <div class="ep-card" style="margin:0">
            <div class="ep-card-title"><i class="ti ti-photo"></i> Fotos (máx 3)</div>
            <div class="ep-photos">
              <div v-for="(u, i) in fotos" :key="u" class="ep-photo-item">
                <img :src="u">
                <button type="button" title="Quitar foto" class="ep-photo-del" @click="fotos.splice(i, 1)">×</button>
              </div>
              <span v-if="!fotos.length" class="ep-photo-empty">Sin fotos cargadas</span>
            </div>
            <input ref="inpFoto" type="file" accept="image/*" multiple style="width:100%;font-size:12px">
          </div>
        </div>

        <!-- 4. COSTOS, FOB Y PROVEEDOR (Sección secundaria separada) -->
        <details class="ep-costs-details">
          <summary class="ep-costs-summary">
            <span><i class="ti ti-calculator"></i> Costos internos y FOB</span>
            <span class="ep-costs-badge">
              {{ f.origen === 'local' ? 'Local' : 'Importado' }}
              <template v-if="Number(f.fob) > 0"> · FOB {{ fmtUSD(f.fob) }}</template>
            </span>
          </summary>

          <div class="ep-costs-body">
            <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
              <span style="font-size:11.5px;color:var(--dgray);margin-right:4px">Origen:</span>
              <button type="button" class="btn-multi" :style="{ background: f.origen === 'local' ? '#FFF' : '#FFE082' }"
                @click="setOrigen('importado')">Importado<small>flete + aduana</small></button>
              <button type="button" class="btn-multi" :style="{ background: f.origen === 'local' ? '#FFE082' : '#FFF' }"
                @click="setOrigen('local')">Compra local<small>ya está aquí</small></button>
            </div>

            <div class="ep-grid-3">
              <div class="ep-field">
                <label>{{ f.origen === 'local' ? 'Costo compra USD' : 'Costo FOB USD' }}</label>
                <input v-model="f.fob" type="number" step="0.01">
              </div>
              <div class="ep-field">
                <label>Factor landed</label>
                <input v-model="f.factor_landed" type="number" step="0.001" min="1" max="5">
              </div>
              <div class="ep-field">
                <label>Precio real (FOB × Landed)</label>
                <input :value="fmtUSD(costoReal)" type="text" readonly class="ep-readonly"
                  style="font-weight:700;color:var(--navy)" title="Costo real puesto aquí (FOB × Factor landed)">
              </div>
            </div>

            <div style="font-size:11px;color:var(--dgray);margin:10px 0 4px">
              Simulador de ganancia sobre el <strong>costo real</strong> ({{ fmtUSD(costoReal) }}) — no modifica el precio de venta:
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button v-for="a in ATAJOS" :key="a.m" type="button" class="btn-multi"
                :style="atajoSel === a.m ? { background: '#FFE082', borderColor: 'var(--gold)' } : {}"
                @click="simularAtajo(a.m)">
                {{ a.lbl }}<small>{{ a.txt }}</small>
              </button>
            </div>

            <div class="ep-costs-preview" :style="resumenCostos.simulado ? { display: 'block', borderColor: 'var(--gold)', background: '#FFFDF5' } : { display: 'block' }">
              <div v-if="resumenCostos.simulado" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:11px;color:#8A6200;font-weight:700">
                <span><i class="ti ti-sparkles"></i> Simulación {{ resumenCostos.pct }}% ganancia (precio arriba sin cambios)</span>
                <button type="button" @click="atajoSel = null" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:11px;font-weight:600;padding:0">Ver actual</button>
              </div>
              <template v-if="resumenCostos.tipo === 'completo'">
                <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline">
                  <span>{{ resumenCostos.simulado ? 'Precio simulado:' : 'Precio de venta:' }} <strong style="color:var(--navy);font-size:15px">${{ resumenCostos.manual.toFixed(2) }}</strong></span>
                  <span style="color:var(--dgray)">Te cuesta puesto aquí: <strong style="color:var(--navy)">${{ resumenCostos.costo.toFixed(2) }}</strong>
                    <span style="font-size:10.5px"> {{ resumenCostos.factor === 1 ? '(compra local, sin flete de importación)' : `(costo $${resumenCostos.fob.toFixed(2)} × ${resumenCostos.factor.toFixed(3).replace('.', ',')})` }}</span>
                  </span>
                </div>
                <div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline">
                  <span>Ganas <strong :style="{ color: resumenCostos.col, fontSize: '15px' }">${{ resumenCostos.ganancia.toFixed(2) }}</strong> por unidad</span>
                  <span style="color:var(--dgray)">Vendes a <strong style="color:var(--navy)">×{{ resumenCostos.mult.toFixed(1) }}</strong> el costo · Margen <strong :style="{ color: resumenCostos.col }">{{ resumenCostos.margen.toFixed(1) }}%</strong></span>
                </div>
              </template>
              <template v-else-if="resumenCostos.tipo === 'pendiente'">Margen pendiente de tasas vigentes y precio equivalente positivo.</template>
              <template v-else-if="resumenCostos.tipo === 'manual'">
                Precio manual: <strong style="color:var(--navy)">${{ resumenCostos.manual.toFixed(2) }} BCV</strong> (falta el costo FOB para calcular la ganancia)
              </template>
              <template v-else-if="resumenCostos.tipo === 'local'">
                <span style="color:var(--red);font-weight:600">Compra local: ingresa el precio de venta manualmente arriba.</span>
              </template>
              <template v-else-if="resumenCostos.tipo === 'auto'">
                Precio sugerido automático (×2.5 escalonado): <strong style="color:var(--navy)">${{ resumenCostos.sugerido.toFixed(2) }} BCV</strong>
              </template>
              <template v-else>Sin costo FOB ni precio configurado.</template>
            </div>
          </div>
        </details>
      </div>

      <div class="ep-footer-note">
        <i class="ti ti-info-circle"></i> Los cambios se reflejarán inmediatamente en la cuenta de los vendedores.
      </div>
      <div class="ep-actions">
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
const atajoSel = ref(null);

// Atajos de ganancia sobre el costo real (FOB × Landed): 100% (×2), 200% (×3), 300% (×4)
const ATAJOS = [
  { m: 2.0, lbl: '100% ganancia', txt: 'Costo real × 2' },
  { m: 3.0, lbl: '200% ganancia', txt: 'Costo real × 3' },
  { m: 4.0, lbl: '300% ganancia', txt: 'Costo real × 4' }
];

const esNuevo = computed(() => !!(store.productoSeleccionado && store.productoSeleccionado._nuevo));
const puedeEditarCodAlt = computed(() => esNuevo.value || store.rol === 'gerente');
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
  atajoSel.value = null;
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

// v13.12: los atajos multiplican el COSTO REAL (FOB × factor landed)
const tasasDisponibles = computed(() => [store.tasa_bcv, store.tasa_par].every(t => Number.isFinite(Number(t)) && Number(t) > 0));
const costoReal = computed(() => (parseFloat(f.value.fob) || 0) * factorActual());
const precioLista = computed(() => Number(f.value.precio_manual) > 0 ? Number(f.value.precio_manual) : (f.value.origen === 'local' ? 0 : precioPublico(Number(f.value.fob) || 0)));
const equivalente = computed(() => tasasDisponibles.value ? Math.round(precioLista.value * store.tasa_bcv / store.tasa_par * 100) / 100 : null);

function simularAtajo(mult) {
  const fob = parseFloat(f.value.fob) || 0;
  if (fob <= 0) { store.notif('Primero ingresa el costo FOB', 'warning'); return; }
  atajoSel.value = atajoSel.value === mult ? null : mult;
}

const resumenCostos = computed(() => {
  if (atajoSel.value && costoReal.value > 0) {
    const fob = parseFloat(f.value.fob) || 0;
    const factor = factorActual();
    const costo = costoReal.value;
    const multObj = atajoSel.value;
    const objetivoBCV = tasasDisponibles.value
      ? (costo * multObj * Number(store.tasa_par) / Number(store.tasa_bcv))
      : (costo * multObj);
    const precioSim = redondeoBonito(objetivoBCV);
    const equivSim = tasasDisponibles.value
      ? Math.round(precioSim * Number(store.tasa_bcv) / Number(store.tasa_par) * 100) / 100
      : precioSim;
    const ganancia = equivSim - costo;
    const margen = equivSim > 0 ? (ganancia / equivSim) * 100 : 0;
    const mult = costo > 0 ? equivSim / costo : multObj;
    const col = margen < 25 ? 'var(--red)' : margen < 35 ? 'var(--gold)' : 'var(--green)';
    return {
      tipo: 'completo',
      simulado: true,
      pct: Math.round((multObj - 1) * 100),
      fob,
      manual: precioSim,
      factor,
      costo,
      ganancia,
      margen,
      mult,
      col
    };
  }
  return prev.value;
});

const prev = computed(() => {
  const fob = parseFloat(f.value.fob) || 0;
  const manual = parseFloat(f.value.precio_manual) || 0;
  const factor = factorActual();
  if (precioLista.value > 0 && fob > 0) {
    if (!(equivalente.value > 0)) return { tipo: 'pendiente' };
    const costo = fob * factor;
    const ganancia = equivalente.value - costo;
    const margen = (ganancia / equivalente.value) * 100;
    const sobreCosto = costo > 0 ? (ganancia / costo) * 100 : 0;
    const mult = costo > 0 ? equivalente.value / costo : 0;
    const col = margen < 25 ? 'var(--red)' : margen < 35 ? 'var(--gold)' : 'var(--green)';
    return { tipo: 'completo', fob, manual: precioLista.value, factor, costo, ganancia, margen, sobreCosto, mult, col };
  }
  if (manual > 0) return { tipo: 'manual', manual };
  if (fob > 0) return f.value.origen === 'local' ? { tipo: 'local' } : { tipo: 'auto', sugerido: precioPublico(fob) };
  return { tipo: 'vacio' };
});

async function agregarSistemaNuevo() {
  if (store.rol !== 'gerente') { store.notif('Solo el gerente puede crear sistemas', 'error'); return; }
  if (!store.supabaseConectado) { store.notif('Sin conexión: no se puede crear el sistema', 'error'); return; }
  const nombre = await store.pedirTexto({ titulo: 'Nuevo sistema', mensaje: 'Se agregará a la lista de sistemas de los productos.', etiqueta: 'Nombre del sistema', placeholder: 'Ej: Transmisión, Aire acondicionado...', ok: 'Crear' });
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
  if (puedeEditarCodAlt.value) {
    codAlt = String(d.cod_alt || '').trim().toUpperCase();
    if (!codAlt) { store.notif('El código alternativo es obligatorio', 'error'); return; }
    const dup = store.productos.find(p => p.id !== orig.id && (p.cod_alt || '').toUpperCase() === codAlt);
    if (dup) { store.notif(`Ya existe un producto con el código alternativo ${codAlt} (${dup.desc})`, 'error'); return; }
  }
  // v13.3: sin descripción el renglón sale EN BLANCO en la factura del cliente
  const desc = String(d.desc || '').trim();
  if (!desc) { store.notif('La descripción del producto es obligatoria', 'error'); return; }
  if (desc.length < 4) { store.notif('La descripción es muy corta para identificar el producto', 'error'); return; }
  // El origen tiene su propio campo: escribirlo en la descripción ensucia la factura
  if (/^\s*(DISTRIBUIDOR|LOCAL|IMPORTADO)\b/i.test(desc)) {
    if (!await store.confirmar({ titulo: 'Revisa la descripción', mensaje: 'La descripción empieza con "' + desc.split(/\s+/)[0] + '".\n\nEl origen ya tiene su propio campo: ese prefijo va a salir impreso en la factura del cliente.\n\n¿Guardar así de todos modos?', ok: 'Guardar así', tono: 'oro' })) return;
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
  else if (orig.cod_alt !== codAlt) bitacora = { texto: `Editó producto: cambió código alternativo de ${orig.cod_alt} a ${codAlt}`, critico: true };
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

<style scoped>
.ep-modal {
  max-width: 720px;
  text-align: left;
  max-height: 90vh;
  overflow-y: auto;
  padding: 20px 22px;
}
.ep-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 12px;
  margin-bottom: 14px;
}
.ep-title {
  margin: 0;
  font-size: 18px;
  color: var(--navy);
}
.ep-sub {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--dgray);
}
.ep-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ep-price-hero {
  background: linear-gradient(135deg, #FFFDF5 0%, #FFF8E1 100%);
  border: 2px solid var(--gold);
  border-radius: 10px;
  padding: 12px 14px;
}
.ep-price-hero-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.ep-price-lbl {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--navy);
}
.ep-price-hint {
  font-size: 11.5px;
  color: var(--dgray);
  margin-top: 2px;
}
.ep-price-input-wrap {
  display: flex;
  align-items: center;
  background: #FFF;
  border: 1.5px solid var(--gold);
  border-radius: 8px;
  padding: 4px 10px;
  min-width: 150px;
}
.ep-currency {
  font-size: 16px;
  font-weight: 700;
  color: var(--dgray);
  margin-right: 4px;
}
.ep-price-input {
  border: none !important;
  outline: none !important;
  font-size: 20px !important;
  font-weight: 800 !important;
  color: var(--navy) !important;
  width: 110px;
  text-align: right;
  background: transparent !important;
  padding: 2px 0 !important;
}
.ep-price-summary {
  background: #FFF;
  border: 1px solid #EFE3B8;
  border-radius: 6px;
  padding: 8px 10px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--dgray);
}
.ep-card {
  background: #F8FAFC;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
}
.ep-card-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--dgray);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ep-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.ep-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.ep-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ep-field label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--navy);
}
.ep-field input,
.ep-field select {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  background: #FFF;
}
.ep-readonly {
  background: #F1F5F9 !important;
  color: var(--dgray) !important;
}
.ep-photos {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
  align-items: center;
  min-height: 40px;
}
.ep-photo-item {
  position: relative;
}
.ep-photo-item img {
  width: 52px;
  height: 52px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #DDD;
}
.ep-photo-del {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #C0392B;
  color: #FFF;
  border: none;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  font-size: 11px;
  cursor: pointer;
  line-height: 1;
}
.ep-photo-empty {
  font-size: 11.5px;
  color: var(--dgray);
}
.ep-costs-details {
  background: #F8FAFC;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.ep-costs-summary {
  padding: 10px 14px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--navy);
  user-select: none;
  background: #F1F5F9;
}
.ep-costs-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--dgray);
  background: #FFF;
  padding: 2px 8px;
  border-radius: 99px;
  border: 1px solid var(--border);
}
.ep-costs-body {
  padding: 12px 14px;
  border-top: 1px solid var(--border);
}
.ep-sim-box {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
  padding: 10px;
  background: #FFFDF5;
  border: 1px solid #FFE082;
  border-radius: 6px;
}
.ep-costs-preview {
  background: #FFF;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 11.5px;
  color: var(--dgray);
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
}
.ep-footer-note {
  background: #FFF8E1;
  border: 1px solid #FFE082;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 11.5px;
  color: #5D4037;
  margin-top: 12px;
}
.ep-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 14px;
}
@media (max-width: 600px) {
  .ep-grid-2,
  .ep-grid-3 {
    grid-template-columns: 1fr;
  }
}
</style>
