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

      <!-- ═══ PASO 2: pegar la lista (igual que Conteo / Recepción) ═══ -->
      <div v-else-if="paso === 'productos'" class="me-cuerpo">
        <div class="cn-chip">
          <i class="ti ti-building-store"></i>
          <span><strong>{{ compra.codigo }}</strong> · {{ compra.proveedor }}<template v-if="compra.num_factura"> · Factura {{ compra.num_factura }}</template> · factor {{ fmtFactor(compra) }}</span>
          <button type="button" class="me-enlace" @click="paso = 'compra'">Cambiar compra</button>
        </div>
        <div class="me-aviso azul-claro">
          <i class="ti ti-info-circle"></i>
          <div>Pega una línea por producto: <strong>código</strong> y <strong>cantidad</strong>, separados por tabulador, coma, punto y coma o espacios. Copiar y pegar desde Excel funciona directo. Las cantidades se <strong>suman</strong> al stock.
            También puedes traer los productos de una marca y escribir cuánto llegó de cada uno; los que queden en 0 no se tocan.</div>
        </div>
        <label class="me-lbl">¿A qué empresa entra la mercancía?</label>
        <div class="cn-destino">
          <button v-for="d in DESTINOS" :key="d.v" type="button" :class="['me-chip', { activo: destino === d.v }]" :aria-pressed="destino === d.v" @click="destino = d.v">{{ d.t }}</button>
        </div>
        <div class="cn-marca">
          <div>
            <label class="me-lbl" for="cn-marca">Traer productos por marca</label>
            <select id="cn-marca" v-model="marcaTraer" class="val-input" @change="traerMarca">
              <option value="">— Elegir marca —</option>
              <option v-for="m in store.marcasCatalogo" :key="m.marca" :value="m.marca">{{ m.marca }} ({{ m.n }})</option>
            </select>
          </div>
          <button id="cn-nuevo-producto" type="button" class="btn btn-gold" @click="crearProducto()"><i class="ti ti-plus"></i> Nuevo producto</button>
        </div>
        <label class="me-lbl" for="cn-lista" style="margin-top:12px">Productos que llegaron</label>
        <textarea id="cn-lista" ref="inpLista" v-model="texto" class="cn-texto" placeholder="FIL-DON-P55	12&#10;COR-B52	4&#10;5191547-2	30"></textarea>
      </div>

      <!-- ═══ PASO 3: revisar antes de aplicar ═══ -->
      <div v-else-if="paso === 'revisar'" class="me-cuerpo">
        <div class="cn-kpis">
          <div class="cn-kpi verde"><span>Se actualizan</span><strong>{{ A.ok.length }}</strong></div>
          <div class="cn-kpi azul"><span>Unidades</span><strong>{{ unidades.toLocaleString('es-VE') }}</strong></div>
          <div class="cn-kpi oro"><span>Toman el costo de la compra</span><strong>{{ A.ok.filter(r => !r.conflicto).length }}</strong></div>
        </div>

        <div v-if="A.desconocidos.length" class="cn-no-existe">
          <div><i class="ti ti-alert-circle"></i> <strong>{{ A.desconocidos.length }} código(s) no existen en el inventario.</strong> Créalos para incluirlos en esta entrada:</div>
          <div class="cn-crear">
            <button v-for="d in A.desconocidos" :key="d.cod" type="button" class="btn btn-gold btn-sm" @click="crearProducto(d.cod)"><i class="ti ti-plus"></i> Crear {{ d.cod }} ({{ d.cant }})</button>
          </div>
        </div>
        <div v-if="A.sinCantidad" class="me-aviso azul-claro"><i class="ti ti-info-circle"></i><div>{{ A.sinCantidad }} producto(s) quedaron en 0: no se tocan.</div></div>
        <div v-if="A.malas.length" class="me-aviso rojo">
          <i class="ti ti-x"></i>
          <div><strong>{{ A.malas.length }} línea(s) mal escritas no se van a tocar:</strong>
            <div v-for="m in A.malas" :key="m.linea">Línea {{ m.linea }}: {{ m.error }}</div></div>
        </div>

        <div class="cn-tabla-caja">
          <table class="simple-tbl cn-tabla">
            <thead><tr><th>Código</th><th>Descripción</th><th class="num">Tiene</th><th class="num">Entra</th><th class="num">Queda</th></tr></thead>
            <tbody>
              <tr v-if="!A.ok.length"><td colspan="5" class="cn-vacio">Ningún código de la lista existe todavía.</td></tr>
              <tr v-for="r in A.ok" :key="r.cod">
                <td class="cn-cod">{{ r.cod }}<span v-if="r.lineas > 1" class="cn-desc"> ×{{ r.lineas }}</span></td>
                <td>
                  <span class="cn-desc">{{ r.prod.desc }}</span>
                  <div v-if="r.aviso" class="cn-aviso-linea">{{ r.aviso }}</div>
                </td>
                <td class="num cn-desc">{{ r.actual }}</td>
                <td class="num"><strong>+{{ r.cant }}</strong></td>
                <td class="num"><strong class="cn-queda">{{ r.actual + r.cant }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ═══ PASO 4: resumen ═══ -->
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
          <button type="button" class="btn btn-secondary" @click="paso = 'compra'"><i class="ti ti-arrow-left"></i> Atrás</button>
          <button id="cn-revisar" type="button" class="btn btn-primary" @click="analizar"><i class="ti ti-eye"></i> Revisar antes de aplicar</button>
        </template>
        <template v-else-if="paso === 'revisar'">
          <button type="button" class="btn btn-secondary" :disabled="trabajando" @click="paso = 'productos'"><i class="ti ti-arrow-left"></i> Corregir</button>
          <button id="cn-registrar" type="button" class="btn btn-green" :disabled="trabajando || !A.ok.length" @click="registrar"><i class="ti ti-check"></i> {{ trabajando ? 'Registrando...' : 'Sumar al stock' }}</button>
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
import { parsearLineas, buscarPorCodigo } from '../../services/monolito.js';

const store = useArjStore();
const PASOS = [{ id: 'compra', t: 'Compra' }, { id: 'productos', t: 'Productos' }, { id: 'revisar', t: 'Revisar' }, { id: 'resumen', t: 'Resumen' }];
const DESTINOS = [{ v: 'directa', t: 'Venta Directa' }, { v: 'dist', t: 'Distribuidora' }];

const vacio = () => ({ id: null, codigoOriginal: '', codigo: '', proveedor: '', num_factura: '', fecha: '', monto: '', gastos: '' });
const paso = ref('compra');
const form = ref(vacio());
const compraId = ref(null);
const trabajando = ref(false);
const destino = ref('directa');
const texto = ref('');
const marcaTraer = ref('');
const inpLista = ref(null);
const A = ref(null);             // análisis de la lista pegada
const nuevos = ref([]);          // códigos creados en esta sesión
const pendiente = ref(null);     // ids que existían al abrir la ficha de un producto nuevo
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
  texto.value = '';
  marcaTraer.value = '';
  A.value = null;
  nuevos.value = [];
  pendiente.value = null;
  resumen.value = null;
}
function enfocarLista() {
  nextTick(() => { if (inpLista.value) inpLista.value.focus(); });
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
  enfocarLista();
}

// ── Pasos 2 y 3: misma lectura que Conteo / Recepción ──
const stockDe = p => (destino.value === 'directa' ? p.stock_vd : p.stock_dist) || 0;
// Sin costo asignado y marcado importado: al sellarlo con esta compra pasa a local (sql/12)
const pasaALocal = p => !p.embarque_id && origenDe(p) === 'importado';
const unidades = computed(() => (A.value ? A.value.ok.reduce((a, r) => a + r.cant, 0) : 0));

// Agrega al cuadro los productos de la marca que aún no están, en 0: se escribe lo que llegó
function traerMarca() {
  const m = marcaTraer.value;
  if (!m) return;
  marcaTraer.value = '';
  const ya = new Set(parsearLineas(texto.value).filter(f => f.cod).map(f => {
    const p = buscarPorCodigo(store.productos, f.cod);
    return p ? p.cod_alt : f.cod;
  }));
  const deMarca = store.productos.filter(p => p.activo !== false && (p.marca || '').trim() === m && !ya.has(p.cod_alt));
  if (!deMarca.length) { store.notif('Los productos de ' + m + ' ya están en el cuadro', 'info'); return; }
  texto.value = (texto.value.trim() ? texto.value.trimEnd() + '\n' : '') + deMarca.map(p => p.cod_alt + '\t0').join('\n');
  store.notif(`${deMarca.length} producto(s) de ${m} en el cuadro: cambia el 0 por la cantidad que llegó`, 'success');
  enfocarLista();
}

function analizar() {
  if (!texto.value.trim()) { store.notif('Pega la lista primero', 'error'); return; }
  const recibido = {}, desconocidos = {}, malas = [];
  let sinCantidad = 0;
  parsearLineas(texto.value).forEach(f => {
    if (f.error) { malas.push(f); return; }
    if (!f.cant) { sinCantidad++; return; }
    const p = buscarPorCodigo(store.productos, f.cod);
    // Un código repetido se ACUMULA: puede venir en dos cajas
    if (!p) { desconocidos[f.cod] = { cod: f.cod, cant: (desconocidos[f.cod] ? desconocidos[f.cod].cant : 0) + f.cant }; return; }
    const r = recibido[p.id] || (recibido[p.id] = { prod: p, cod: p.cod_alt, cant: 0, lineas: 0 });
    r.cant += f.cant;
    r.lineas++;
  });
  const ok = Object.values(recibido).map(r => {
    const otro = r.prod.embarque_id && r.prod.embarque_id !== compraId.value
      ? store.embarques.find(e => e.id === r.prod.embarque_id) : null;
    const conflicto = !!(r.prod.embarque_id && r.prod.embarque_id !== compraId.value);
    return {
      ...r, actual: stockDe(r.prod), conflicto,
      aLocal: !conflicto && pasaALocal(r.prod),
      aviso: conflicto ? `Ya tiene el costo de ${otro ? otro.codigo : 'otra compra'}: solo se suma el stock.`
        : (pasaALocal(r.prod) ? 'Está como importado: pasará a compra local.' : '')
    };
  });
  A.value = { ok, desconocidos: Object.values(desconocidos), malas, sinCantidad };
  paso.value = 'revisar';
}

// Producto nuevo: se crea en su ficha (encima de esta ventana), ya como compra local de este
// proveedor. Sin código (botón "Nuevo producto") o con el código que no existía (revisión).
function crearProducto(cod = '') {
  if (store.rol !== 'gerente') { store.notif('Solo el gerente puede crear productos', 'error'); return; }
  // El producto creado se reconoce por ser el único id que no estaba antes
  pendiente.value = new Set(store.productos.map(p => p.id));
  store.productoSeleccionado = {
    _nuevo: true, cod_alt: cod, cod_orig: '', cod_barras: '', desc: '', marca: '', fob: 0, stock_vd: 0, stock_dist: 0,
    marca_modelo: '', sistema: '', precio_manual: null, origen: 'local',
    factor_landed: parseFloat(compra.value.factor) || FACTOR_LANDED_FALLBACK, proveedor: compra.value.proveedor || '', imagen_url: ''
  };
  store.modalEditProdActivo = true;
}
watch(() => store.productos, lista => {
  if (!pendiente.value) return;
  const p = lista.find(x => !pendiente.value.has(x.id));
  if (!p) return;
  pendiente.value = null;
  nuevos.value.push(p.cod_alt);
  if (paso.value === 'revisar') { analizar(); return; }
  // En la lista: se agrega en 0 para que se escriba cuánto llegó
  texto.value = (texto.value.trim() ? texto.value.trimEnd() + '\n' : '') + p.cod_alt + '\t0';
  store.notif(`${p.cod_alt} agregado al cuadro: cambia el 0 por la cantidad que llegó`, 'success');
  enfocarLista();
});
watch(() => store.modalEditProdActivo, abierto => { if (!abierto) nextTick(() => { pendiente.value = null; }); });

async function registrar() {
  const an = A.value;
  if (!an || !an.ok.length) return;
  const c = compra.value;
  const nomDest = DESTINOS.find(d => d.v === destino.value).t;
  const sellar = an.ok.filter(r => !r.conflicto).length;
  if (!await store.confirmar({ titulo: 'Sumar al stock', ok: 'Sumar', mensaje:
    `Se van a SUMAR ${unidades.value} unidad(es) de ${an.ok.length} producto(s) en ${nomDest}, de la compra ${c.codigo}.\n\n`
    + `COSTO: ${sellar} producto(s) quedan con el factor ${fmtFactor(c)} de esta compra.`
    + (an.ok.length > sellar ? `\n${an.ok.length - sellar} NO se tocan: ya vienen de otra compra.` : '')
    + (an.desconocidos.length ? `\n\n${an.desconocidos.length} código(s) que no existen quedan fuera.` : '') })) return;
  trabajando.value = true;
  try {
    const r = await store.aplicarRecepcion({
      tipo: 'recepcion', destino: destino.value, embarqueId: c.id,
      referencia: c.num_factura ? 'Factura ' + c.num_factura : c.codigo,
      items: an.ok.map(x => ({ producto_id: x.prod.id, cantidad: x.cant })), noContados: []
    });
    if (!r) return;
    resumen.value = {
      numero: r.numero, codigo: c.codigo, proveedor: c.proveedor, factura: c.num_factura, destino: nomDest,
      renglones: r.renglones, unidades: r.unidades, sellados: r.sellados || 0, factor: fmtFactor(c),
      conflictos: r.conflictos || [], nuevos: [...nuevos.value], aLocal: an.ok.filter(x => x.aLocal).length
    };
    paso.value = 'resumen';
  } finally {
    trabajando.value = false;
  }
}

// ── Paso 4 ──
function masProductos() {
  reiniciarProductos();
  paso.value = 'productos';
  enfocarLista();
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

.cn-chip { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; padding: 9px 13px; border-radius: 12px; background: var(--lgreen); color: var(--text); font-size: 14px }
.cn-chip i { color: var(--green) }
.me-aviso.azul-claro { background: var(--lblue); color: var(--navy) }
.cn-destino { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; max-width: 460px }
.cn-marca { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; margin-top: 12px; max-width: 640px }
.cn-marca > div { flex: 1 1 240px }
.cn-texto { width: 100%; box-sizing: border-box; min-height: 200px; padding: 10px 12px; border: 1.5px solid var(--border); border-radius: 10px; background: var(--input-bg); color: var(--text); font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 14px; resize: vertical }

.cn-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px }
.cn-kpi { padding: 10px 13px; border-radius: 12px }
.cn-kpi span { display: block; color: var(--dgray); font-size: 12.5px; font-weight: 600 }
.cn-kpi strong { font-size: 21px; font-variant-numeric: tabular-nums }
.cn-kpi.verde { background: var(--lgreen) } .cn-kpi.verde strong { color: var(--green) }
.cn-kpi.azul { background: var(--lblue) } .cn-kpi.azul strong { color: var(--navy) }
.cn-kpi.oro { background: var(--lgold) } .cn-kpi.oro strong { color: var(--gold) }
.cn-no-existe { margin-bottom: 12px; padding: 10px 13px; border-radius: 12px; background: var(--lgold); color: var(--gold); font-size: 14px }
.cn-crear { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px }
.cn-tabla-caja { max-height: 44vh; overflow: auto; border: 1px solid var(--border); border-radius: 10px }
.cn-tabla td { vertical-align: top }
.cn-cod { font-family: ui-monospace, Menlo, Consolas, monospace; white-space: nowrap }
.cn-desc { color: var(--dgray); font-size: 13px }
.cn-aviso-linea { margin-top: 3px; color: var(--gold); font-size: 12.5px; font-weight: 600 }
.cn-queda { color: var(--green) }

@media (max-width: 760px) {
  .cn-pasos { flex-wrap: wrap }
  .cn-cols-compra { grid-template-columns: minmax(0, 1fr) }
  .cn-kpis { grid-template-columns: minmax(0, 1fr) }
}
</style>
