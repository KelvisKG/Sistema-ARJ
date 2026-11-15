<template>
  <!-- Compras nacionales (sql/12): todo en esta ventana, paso a paso -->
  <div v-if="store.modalComprasActivo" class="modal show" id="modal-compras">
    <div class="modal-content me-caja cn-caja">
      <header class="me-cab">
        <span class="me-icono verde"><i class="ti ti-building-store"></i></span>
        <div class="me-titulo">
          <h2>Compras nacionales</h2>
          <p>Mercancía comprada en el país, sin aduana ni compra de divisas</p>
        </div>
        <button type="button" class="me-cerrar" title="Cerrar" aria-label="Cerrar" :disabled="trabajando" @click="cerrar"><i class="ti ti-x"></i></button>
      </header>

      <ol class="cn-pasos" aria-label="Pasos">
        <li v-for="(p, i) in PASOS" :key="p.id" :class="{ actual: paso === p.id, hecho: i < indicePaso }">
          <b>{{ i < indicePaso ? '✓' : i + 1 }}</b> {{ p.t }}
        </li>
      </ol>

      <!-- ═══ PASO 1: la compra ═══ -->
      <div v-if="paso === 'compra'" class="me-cuerpo me-cols cn-cols-compra">
        <section>
          <div class="cn-subtit">
            <span>Elige una compra</span>
            <button type="button" class="btn btn-secondary btn-sm" @click="nuevaCompra"><i class="ti ti-plus"></i> Nueva compra</button>
          </div>
          <div v-if="!compras.length" class="me-panel cn-vacio">Todavía no hay compras nacionales. Crea la primera con el formulario.</div>
          <div v-else class="cn-lista">
            <div v-for="c in compras" :key="c.id" :class="['cn-compra', { activa: c.id === compraId }]" role="button" tabindex="0"
              :aria-pressed="c.id === compraId" @click="elegir(c)" @keydown.enter.prevent="elegir(c)">
              <div class="cn-compra-info">
                <strong>{{ c.codigo }}</strong>
                <span>{{ c.proveedor }}<template v-if="c.num_factura"> · Factura {{ c.num_factura }}</template></span>
                <span>{{ c.fecha_llegada || 'Sin fecha' }} · {{ fmtUSD(c.fob_total) }} · factor {{ fmtFactor(c) }} · {{ piezasPorCompra.get(c.id) || 0 }} producto(s)</span>
              </div>
              <div class="cn-compra-acc" @click.stop>
                <button type="button" class="btn btn-secondary btn-sm" title="Editar esta compra" aria-label="Editar esta compra" @click="editar(c)"><i class="ti ti-pencil"></i></button>
                <button type="button" class="btn btn-secondary btn-sm" title="Recalcular costos de esta compra" aria-label="Recalcular costos de esta compra" @click="store.recalcularEmbarque(c)"><i class="ti ti-refresh"></i></button>
              </div>
            </div>
          </div>
        </section>

        <section class="me-panel">
          <div class="me-etq" style="margin-bottom:10px">{{ form.id ? 'Editando ' + form.codigoOriginal : 'Nueva compra' }}</div>
          <div class="cn-dos">
            <div>
              <label class="me-lbl" for="cn-codigo">Código</label>
              <input id="cn-codigo" v-model="form.codigo" type="text" class="val-input cn-mayus" placeholder="NAC-2026-01">
            </div>
            <div>
              <label class="me-lbl" for="cn-factura">N° de factura</label>
              <input id="cn-factura" v-model="form.num_factura" type="text" class="val-input cn-mayus" placeholder="Del proveedor">
            </div>
          </div>
          <label class="me-lbl" for="cn-proveedor">Proveedor</label>
          <input id="cn-proveedor" v-model="form.proveedor" type="text" class="val-input cn-mayus" placeholder="Nombre del proveedor" style="margin-bottom:9px">
          <label class="me-lbl" for="cn-fecha">Fecha de compra</label>
          <input id="cn-fecha" v-model="form.fecha" type="date" class="val-input" style="margin-bottom:9px">
          <div class="cn-dos">
            <div>
              <label class="me-lbl" for="cn-monto">Monto USD</label>
              <input id="cn-monto" v-model="form.monto" type="number" step="0.01" min="0" class="val-input" placeholder="2500.00">
            </div>
            <div>
              <label class="me-lbl" for="cn-gastos">Flete y gastos USD</label>
              <input id="cn-gastos" v-model="form.gastos" type="number" step="0.01" min="0" class="val-input" placeholder="0.00">
            </div>
          </div>
          <div v-if="factor > 0" class="me-aviso verde" style="display:block;margin-top:4px">
            <strong style="font-size:16px">Factor: {{ factor.toFixed(4) }}</strong>
            <div>Una pieza de $10 te cuesta {{ fmtUSD(10 * factor) }}</div>
          </div>
          <div v-else class="me-nota" style="margin-bottom:14px">Escribe el monto para ver el factor.</div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button v-if="form.id" type="button" class="btn btn-secondary btn-sm" @click="nuevaCompra">Cancelar edición</button>
            <button id="cn-guardar" type="button" class="btn btn-primary btn-sm" :disabled="trabajando" @click="guardarCompra"><i class="ti ti-check"></i> {{ trabajando ? 'Guardando...' : (form.id ? 'Guardar cambios' : 'Crear compra') }}</button>
          </div>
        </section>
      </div>

      <!-- ═══ PASO 2: los productos ═══ -->
      <div v-else-if="paso === 'productos'" class="me-cuerpo">
        <div class="cn-chip">
          <i class="ti ti-building-store"></i>
          <span><strong>{{ compra.codigo }}</strong> · {{ compra.proveedor }}<template v-if="compra.num_factura"> · Factura {{ compra.num_factura }}</template> · factor {{ fmtFactor(compra) }}</span>
          <button type="button" class="me-enlace" @click="paso = 'compra'">Cambiar compra</button>
        </div>

        <div class="me-cols cn-cols-prod">
          <section>
            <label class="me-lbl">¿A qué empresa entra la mercancía?</label>
            <div class="cn-destino">
              <button v-for="d in DESTINOS" :key="d.v" type="button" :class="['me-chip', { activo: destino === d.v }]" :aria-pressed="destino === d.v" @click="destino = d.v">{{ d.t }}</button>
            </div>

            <label class="me-lbl" for="cn-buscar" style="margin-top:14px">Buscar producto por código o descripción</label>
            <input id="cn-buscar" ref="inpBuscar" v-model="busqueda" type="text" class="val-input" placeholder="Ej: FIL-DON-P55 o filtro" autocomplete="off" @keydown.enter.prevent="agregarPrimero">
            <div v-if="busqueda.trim()" class="cn-resultados">
              <button v-for="p in resultados" :key="p.id" type="button" class="cn-resultado" @click="agregar(p)">
                <strong>{{ p.cod_alt }}</strong> <span>{{ p.desc }}</span> <i class="ti ti-plus"></i>
              </button>
              <div v-if="!exacto" class="cn-no-existe">
                <span><i class="ti ti-alert-circle"></i> <strong>{{ codigoBuscado }}</strong> no existe en el inventario.</span>
                <button type="button" class="btn btn-gold btn-sm" @click="crearProducto"><i class="ti ti-plus"></i> Crear producto nuevo</button>
              </div>
            </div>
          </section>

          <section>
            <div class="cn-subtit"><span>Productos de esta compra</span><span class="me-nota" style="margin:0">{{ lineas.length }} producto(s) · {{ unidades }} und.</span></div>
            <div v-if="!lineas.length" class="me-panel cn-vacio">Busca y agrega los productos que llegaron.</div>
            <table v-else class="simple-tbl cn-tabla">
              <thead><tr><th>Producto</th><th class="num">Stock</th><th class="num">Llegan</th><th></th></tr></thead>
              <tbody>
                <tr v-for="(l, i) in lineas" :key="l.producto_id">
                  <td>
                    <strong>{{ l.cod_alt }}</strong>
                    <div class="cn-desc">{{ l.desc }}</div>
                    <div v-if="avisos.get(l.producto_id)" class="cn-aviso-linea">{{ avisos.get(l.producto_id) }}</div>
                  </td>
                  <td class="num">{{ stockDe(l.producto_id) }}</td>
                  <td class="num"><input v-model.number="l.cant" type="number" min="1" step="1" class="val-input cn-cant" :aria-label="'Cantidad de ' + l.cod_alt"></td>
                  <td class="num"><button type="button" class="btn btn-secondary btn-sm" title="Quitar" :aria-label="'Quitar ' + l.cod_alt" @click="lineas.splice(i, 1)"><i class="ti ti-trash"></i></button></td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>

      <!-- ═══ PASO 3: resumen ═══ -->
      <div v-else class="me-cuerpo">
        <div class="me-aviso verde"><i class="ti ti-circle-check"></i><div><strong>Entrada registrada: {{ resumen.numero }}.</strong> El stock ya está actualizado.</div></div>
        <div class="me-cols">
          <section class="me-panel">
            <div class="me-fila"><span>Compra</span><strong>{{ resumen.codigo }}</strong></div>
            <div class="me-fila"><span>Proveedor</span><strong>{{ resumen.proveedor }}</strong></div>
            <div class="me-fila"><span>Factura</span><strong>{{ resumen.factura || '—' }}</strong></div>
            <div class="me-fila"><span>Entró a</span><strong>{{ resumen.destino }}</strong></div>
            <div class="me-fila total"><span>Recibido</span><strong>{{ resumen.renglones }} producto(s) · {{ resumen.unidades }} und.</strong></div>
          </section>
          <section class="me-panel">
            <div class="me-fila"><span>Costo sellado (factor {{ resumen.factor }})</span><strong>{{ resumen.sellados }} producto(s)</strong></div>
            <div v-if="resumen.nuevos.length" class="me-fila"><span>Productos creados</span><strong>{{ resumen.nuevos.join(', ') }}</strong></div>
            <div v-if="resumen.aLocal" class="me-fila"><span>Pasaron a compra local</span><strong>{{ resumen.aLocal }}</strong></div>
            <template v-if="resumen.conflictos.length">
              <div class="me-etq" style="margin-top:8px">Sumaron stock pero conservan su costo (ya venían de otra compra):</div>
              <div v-for="c in resumen.conflictos" :key="c.cod_alt" class="me-nota">{{ c.cod_alt }} — {{ c.otro || 'otra compra' }}</div>
            </template>
            <div v-else class="me-nota">Ningún producto quedó en conflicto.</div>
          </section>
        </div>
      </div>

      <footer class="me-pie">
        <template v-if="paso === 'compra'">
          <button type="button" class="btn btn-secondary" @click="cerrar">Cerrar</button>
          <button id="cn-siguiente" type="button" class="btn btn-primary" :disabled="!compra" @click="irAProductos">Siguiente: agregar productos <i class="ti ti-arrow-right"></i></button>
        </template>
        <template v-else-if="paso === 'productos'">
          <button type="button" class="btn btn-secondary" :disabled="trabajando" @click="paso = 'compra'"><i class="ti ti-arrow-left"></i> Atrás</button>
          <button id="cn-registrar" type="button" class="btn btn-green" :disabled="trabajando || !lineasValidas.length" @click="registrar"><i class="ti ti-check"></i> {{ trabajando ? 'Registrando...' : 'Registrar entrada' }}</button>
        </template>
        <template v-else>
          <button type="button" class="btn btn-secondary" @click="masProductos"><i class="ti ti-plus"></i> Registrar más productos</button>
          <button type="button" class="btn btn-primary" @click="cerrar">Listo</button>
        </template>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD, origenDe, FACTOR_LANDED_FALLBACK } from '../../services/pricing.js';
import { buscarPorCodigo } from '../../services/monolito.js';

const store = useArjStore();
const PASOS = [{ id: 'compra', t: 'Compra' }, { id: 'productos', t: 'Productos' }, { id: 'resumen', t: 'Resumen' }];
const DESTINOS = [{ v: 'directa', t: 'Venta Directa' }, { v: 'dist', t: 'Distribuidora' }];

const vacio = () => ({ id: null, codigoOriginal: '', codigo: '', proveedor: '', num_factura: '', fecha: '', monto: '', gastos: '' });
const paso = ref('compra');
const form = ref(vacio());
const compraId = ref(null);
const trabajando = ref(false);
const destino = ref('directa');
const busqueda = ref('');
const inpBuscar = ref(null);
const lineas = ref([]);
const nuevos = ref([]);          // códigos creados en esta sesión
const pendiente = ref('');       // código que se está creando en la ficha de producto
const resumen = ref(null);

const indicePaso = computed(() => PASOS.findIndex(p => p.id === paso.value));
const compras = computed(() => store.comprasNacionales);
const compra = computed(() => compras.value.find(c => c.id === compraId.value) || null);
// Productos con el costo de cada compra, contados en una sola pasada por el catálogo
const piezasPorCompra = computed(() => {
  const m = new Map();
  store.productos.forEach(p => { if (p.embarque_id) m.set(p.embarque_id, (m.get(p.embarque_id) || 0) + 1); });
  return m;
});
const fmtFactor = c => (parseFloat(c.factor) || 0).toFixed(4);
function enfocarBuscar() {
  nextTick(() => { if (inpBuscar.value) inpBuscar.value.focus(); });
}
// Misma fórmula que el servidor: la columna generada con gastos / monto
const factor = computed(() => {
  const m = parseFloat(form.value.monto) || 0;
  return m > 0 ? 1 + (parseFloat(form.value.gastos) || 0) / m : 0;
});

watch(() => store.modalComprasActivo, abierto => {
  if (!abierto) return;
  paso.value = 'compra';
  form.value = vacio();
  compraId.value = null;
  destino.value = store.empresa === 'directa' ? 'directa' : 'dist';
  reiniciarProductos();
}, { immediate: true });

function reiniciarProductos() {
  lineas.value = [];
  nuevos.value = [];
  busqueda.value = '';
  pendiente.value = '';
  resumen.value = null;
}

// ── Paso 1 ──
function nuevaCompra() { form.value = vacio(); }
function elegir(c) { compraId.value = c.id; }
function editar(c) {
  compraId.value = c.id;
  form.value = {
    id: c.id, codigoOriginal: c.codigo, codigo: c.codigo || '', proveedor: c.proveedor || '', num_factura: c.num_factura || '',
    fecha: c.fecha_llegada || '', monto: c.fob_total ?? '', gastos: c.monto_flete_aduana ?? ''
  };
}

async function guardarCompra() {
  const codigo = String(form.value.codigo || '').trim().toUpperCase();
  const proveedor = String(form.value.proveedor || '').trim().toUpperCase();
  const monto = parseFloat(form.value.monto);
  const gastos = parseFloat(form.value.gastos) || 0;
  if (!codigo) { store.notif('El código es obligatorio', 'error'); return; }
  if (!proveedor) { store.notif('El proveedor es obligatorio', 'error'); return; }
  if (!(monto > 0)) { store.notif('El monto de la compra debe ser mayor que cero', 'error'); return; }
  if (gastos < 0) { store.notif('El flete y los gastos no pueden ser negativos', 'error'); return; }
  const fila = { codigo, proveedor, num_factura: String(form.value.num_factura || '').trim().toUpperCase(), fecha: form.value.fecha || null, monto, gastos };
  if (form.value.id) fila.id = form.value.id;
  trabajando.value = true;
  try {
    const guardada = await store.guardarCompraNacional(fila);
    if (guardada) {
      compraId.value = guardada.id;
      form.value = vacio();
    }
  } finally {
    trabajando.value = false;
  }
}

function irAProductos() {
  if (!compra.value) return;
  form.value = vacio();
  paso.value = 'productos';
  enfocarBuscar();
}

// ── Paso 2 ──
const normal = t => String(t || '').trim().toUpperCase();
const codigoBuscado = computed(() => normal(busqueda.value));
const resultados = computed(() => {
  const q = busqueda.value.trim().toLowerCase();
  if (!q) return [];
  return store.productos.filter(p => [p.cod_alt, p.cod_orig, p.desc].some(t => (t || '').toLowerCase().includes(q))).slice(0, 8);
});
// Código exacto: alterno u original (el mismo criterio de Conteo / Recepción)
const exacto = computed(() => (codigoBuscado.value ? buscarPorCodigo(store.productos, codigoBuscado.value) : null));
const stockDe = id => {
  const p = store.productoPorId.get(id);
  return p ? (destino.value === 'directa' ? p.stock_vd : p.stock_dist) || 0 : 0;
};
const unidades = computed(() => lineas.value.reduce((a, l) => a + (parseInt(l.cant) || 0), 0));
const lineasValidas = computed(() => lineas.value.filter(l => parseInt(l.cant) > 0));

// Sin costo asignado y marcado importado: al sellarlo con esta compra pasa a local (sql/12)
const pasaALocal = p => !!p && !p.embarque_id && origenDe(p) === 'importado';
// Qué le pasa al costo de cada producto al registrar la entrada
const avisos = computed(() => {
  const m = new Map();
  lineas.value.forEach(l => {
    const p = store.productoPorId.get(l.producto_id);
    if (!p) return;
    if (p.embarque_id && p.embarque_id !== compraId.value) {
      const otro = store.embarques.find(e => e.id === p.embarque_id);
      m.set(p.id, `Ya tiene el costo de ${otro ? otro.codigo : 'otra compra'}: solo se suma el stock.`);
    } else if (pasaALocal(p)) m.set(p.id, 'Está como importado: pasará a compra local.');
  });
  return m;
});

function agregar(p) {
  const l = lineas.value.find(x => x.producto_id === p.id);
  if (l) l.cant = (parseInt(l.cant) || 0) + 1;
  else lineas.value.push({ producto_id: p.id, cod_alt: p.cod_alt, desc: p.desc, cant: 1 });
  busqueda.value = '';
  enfocarBuscar();
}
function agregarPrimero() {
  if (exacto.value) agregar(exacto.value);
  else if (resultados.value.length === 1) agregar(resultados.value[0]);
}

// Producto que no existe: se crea en su ficha (encima de esta ventana) y se agrega solo
function crearProducto() {
  if (store.rol !== 'gerente') { store.notif('Solo el gerente puede crear productos', 'error'); return; }
  pendiente.value = codigoBuscado.value;
  store.productoSeleccionado = {
    _nuevo: true, cod_alt: codigoBuscado.value, cod_orig: '', cod_barras: '', desc: '', marca: '', fob: 0, stock_vd: 0, stock_dist: 0,
    marca_modelo: '', sistema: '', precio_manual: null, origen: 'local',
    factor_landed: parseFloat(compra.value.factor) || FACTOR_LANDED_FALLBACK, proveedor: compra.value.proveedor || '', imagen_url: ''
  };
  store.modalEditProdActivo = true;
}
watch(() => store.productos, lista => {
  if (!pendiente.value) return;
  const p = lista.find(x => normal(x.cod_alt) === pendiente.value);
  if (!p) return;
  nuevos.value.push(p.cod_alt);
  pendiente.value = '';
  agregar(p);
});
watch(() => store.modalEditProdActivo, abierto => { if (!abierto) nextTick(() => { pendiente.value = ''; }); });

async function registrar() {
  const items = lineasValidas.value.map(l => ({ producto_id: l.producto_id, cantidad: parseInt(l.cant) }));
  if (!items.length) return;
  const c = compra.value;
  const nomDest = DESTINOS.find(d => d.v === destino.value).t;
  const aLocal = lineasValidas.value.filter(l => pasaALocal(store.productoPorId.get(l.producto_id))).length;
  if (!await store.confirmar({ titulo: 'Registrar entrada', ok: 'Registrar', mensaje:
    `Se van a SUMAR ${unidades.value} unidad(es) de ${items.length} producto(s) a ${nomDest}, de la compra ${c.codigo}.\n\n`
    + 'Los productos sin costo asignado toman el factor ' + fmtFactor(c) + ' de esta compra.' })) return;
  trabajando.value = true;
  try {
    const r = await store.aplicarRecepcion({
      tipo: 'recepcion', destino: destino.value, embarqueId: c.id,
      referencia: c.num_factura ? 'Factura ' + c.num_factura : c.codigo, items, noContados: []
    });
    if (!r) return;
    resumen.value = {
      numero: r.numero, codigo: c.codigo, proveedor: c.proveedor, factura: c.num_factura, destino: nomDest,
      renglones: r.renglones, unidades: r.unidades, sellados: r.sellados || 0, factor: fmtFactor(c),
      conflictos: r.conflictos || [], nuevos: [...nuevos.value], aLocal
    };
    paso.value = 'resumen';
  } finally {
    trabajando.value = false;
  }
}

// ── Paso 3 ──
function masProductos() {
  reiniciarProductos();
  paso.value = 'productos';
  enfocarBuscar();
}

function cerrar() {
  if (trabajando.value) return;
  store.modalComprasActivo = false;
}
</script>

<style scoped>
.cn-caja { max-width: 1040px }
.cn-pasos { display: flex; gap: 6px; margin: 0; padding: 12px 22px; list-style: none; border-bottom: 1px solid var(--border); background: var(--gray) }
.cn-pasos li { display: flex; align-items: center; gap: 7px; padding: 4px 12px 4px 4px; border-radius: 99px; color: var(--dgray); font-size: 14px; font-weight: 600 }
.cn-pasos li b { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--card-bg); border: 1.5px solid var(--border); font-size: 12.5px }
.cn-pasos li.actual { background: var(--lblue); color: var(--blue) }
.cn-pasos li.actual b { border-color: var(--blue); background: var(--blue); color: #FFF }
.cn-pasos li.hecho b { border-color: var(--green); background: var(--green); color: #FFF }

.cn-cols-compra { grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr) }
.cn-cols-prod { grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) }
.cn-subtit { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 14px; font-weight: 700 }
.cn-vacio { color: var(--dgray); text-align: center }
.cn-lista { display: flex; flex-direction: column; gap: 7px; max-height: 52vh; overflow-y: auto }
.cn-compra { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1.5px solid var(--border); border-radius: 12px; background: var(--card-bg); cursor: pointer }
.cn-compra:hover { border-color: var(--blue) }
.cn-compra.activa { border-color: var(--blue); background: var(--lblue) }
.cn-compra-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px }
.cn-compra-info span { color: var(--dgray); font-size: 13px; overflow-wrap: anywhere }
.cn-compra-acc { display: flex; gap: 5px; flex: none }
.cn-dos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 9px }
.cn-mayus { text-transform: uppercase }

.cn-chip { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; padding: 9px 13px; border-radius: 12px; background: var(--lgreen); color: var(--text); font-size: 14px }
.cn-chip i { color: var(--green) }
.cn-destino { display: grid; grid-template-columns: 1fr 1fr; gap: 7px }
.cn-resultados { margin-top: 6px; border: 1px solid var(--border); border-radius: 10px; overflow: hidden }
.cn-resultado { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 12px; border: 0; border-bottom: 1px solid var(--border); background: var(--card-bg); color: var(--text); font: inherit; font-size: 14px; text-align: left; cursor: pointer }
.cn-resultado:hover, .cn-resultado:focus-visible { background: var(--lblue) }
.cn-resultado span { flex: 1; min-width: 0; color: var(--dgray); overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.cn-no-existe { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 10px 12px; background: var(--lgold); color: var(--gold); font-size: 14px }
.cn-tabla td { vertical-align: top }
.cn-desc { color: var(--dgray); font-size: 13px }
.cn-aviso-linea { margin-top: 3px; color: var(--gold); font-size: 12.5px; font-weight: 600 }
.cn-cant { width: 80px; text-align: right }

@media (max-width: 760px) {
  .cn-pasos { flex-wrap: wrap }
  .cn-cols-compra, .cn-cols-prod { grid-template-columns: minmax(0, 1fr) }
}
</style>
