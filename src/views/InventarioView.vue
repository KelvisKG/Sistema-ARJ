<template>
  <div class="page active" id="page-inventario">
    <h1 class="page-title"><i class="ti ti-package"></i> Inventario</h1>
    <p class="page-sub">Empresa: <strong>{{ store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora' }}</strong> · Total productos: <strong>{{ filtrados.length }}</strong></p>

    <div class="help-box">
      <i class="ti ti-info-circle"></i>
      <div><strong>Nuevo:</strong> Puedes buscar productos por marca de tractor y sistema. Si un cliente pregunta
        "¿qué tienen para el motor del John Deere 6420?", usa la pestaña <strong>Por aplicación</strong>.</div>
    </div>

    <!-- v13.4: despacho, notas, recepciones y conteo (solo gerente) -->
    <div v-if="esGerente" style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <button class="btn btn-secondary" @click="abrirTraspaso"><i class="ti ti-arrows-exchange"></i> Despachar a Directa</button>
      <button class="btn btn-secondary" @click="abrirNotas"><i class="ti ti-file-text"></i> Notas de entrega</button>
      <button class="btn btn-secondary" @click="abrirRecepciones"><i class="ti ti-truck-delivery"></i> Recepciones</button>
      <button class="btn btn-primary" @click="abrirRecepcion"><i class="ti ti-clipboard-check"></i> Conteo / Recepción</button>
    </div>

    <!-- Tabs búsqueda inventario -->
    <div style="display:flex;gap:4px;margin-bottom:10px;border-bottom:1px solid var(--gray)">
      <button :class="['search-tab', { active: tab === 'normal' }]" @click="tab = 'normal'"><i class="ti ti-search"></i> Búsqueda general</button>
      <button :class="['search-tab', { active: tab === 'aplicacion' }]" @click="tab = 'aplicacion'"><i class="ti ti-tractor"></i> Por aplicación</button>
    </div>

    <!-- Tab búsqueda normal -->
    <div v-if="tab === 'normal'" class="search-tab-content active">
      <div class="inv-controls" style="flex-wrap:wrap">
        <div class="inv-search">
          <i class="ti ti-search"></i>
          <input v-model="busqueda" type="text" placeholder="Buscar por código, descripción, marca...">
        </div>
        <template v-if="esGerente">
          <button class="btn btn-secondary" @click="importarExcel"><i class="ti ti-upload"></i> Importar Excel</button>
          <button class="btn btn-secondary" @click="abrirEmbarques"><i class="ti ti-ship"></i> Embarques</button>
          <button class="btn btn-primary" @click="abrirNuevoProducto"><i class="ti ti-plus"></i> Nuevo producto</button>
          <button class="btn btn-secondary" @click="store.modalListaPreciosActivo = true"><i class="ti ti-download"></i> Lista de precios</button>
        </template>
      </div>
    </div>

    <!-- Tab búsqueda por aplicación -->
    <div v-else class="search-tab-content">
      <div style="background:#FFF8E1;border:1px solid #FFC107;border-radius:6px;padding:8px 12px;font-size:11.5px;color:#5D4037;margin-bottom:10px">
        <i class="ti ti-bulb"></i> Combina <strong>marca/modelo</strong> con <strong>sistema</strong> para filtrar.
        Por ejemplo: "Ford 6610" en marca/modelo + "Motor" en sistema = solo repuestos del motor del Ford 6610.
      </div>
      <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:10px;margin-bottom:10px">
        <div class="inv-search">
          <i class="ti ti-tractor"></i>
          <input v-model="marcaModelo" type="text" placeholder="Marca y modelo del tractor (ej: John Deere 6420)">
        </div>
        <select v-model="sistema" style="background:#FFF;border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-size:13px;font-family:inherit">
          <option value="">Todos los sistemas</option>
          <option v-for="s in store.sistemas" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
    </div>

    <div class="inv-table" style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th class="center" style="width:3%">#</th>
            <th style="width:11%">Código alt.</th>
            <th style="width:10%">Código orig.</th>
            <th style="width:20%">Descripción</th>
            <th style="width:9%">Marca</th>
            <th style="width:12%">Aplicación</th>
            <th v-if="esGerente" class="num" style="width:8%">FOB</th>
            <th class="num" style="width:9%">P. Público</th>
            <th class="center" style="width:7%">Stock</th>
            <th class="center" style="width:9%">Otra emp.</th>
            <th v-if="esGerente" class="center" style="width:13%">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, idx) in visibles" :key="p.id">
            <td class="center" style="color:var(--dgray);font-size:11px;font-weight:600">{{ idx + 1 }}</td>
            <td><strong>{{ p.cod_alt }}</strong></td>
            <td><span style="color:var(--dgray)">{{ p.cod_orig }}</span></td>
            <td>
              <div style="display:flex;align-items:center;gap:8px">
                <div v-if="fotosDe(p).length" style="position:relative">
                  <img :src="fotosDe(p)[0]" loading="lazy" style="width:34px;height:34px;object-fit:cover;border-radius:5px;cursor:zoom-in;border:1px solid #e0e0e0" @click="fotoAbierta = p">
                  <span v-if="fotosDe(p).length > 1" style="position:absolute;bottom:-4px;right:-4px;background:var(--gold);color:#fff;border-radius:50%;width:14px;height:14px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700">{{ fotosDe(p).length }}</span>
                </div>
                <span>{{ p.desc }}</span>
              </div>
            </td>
            <td>{{ p.marca }}</td>
            <td>
              <div v-if="p.sistema || p.marca_modelo" style="font-size:10.5px">
                <strong style="color:var(--blue)">{{ p.sistema || '—' }}</strong>
                <div style="color:var(--dgray);font-size:10px">{{ (p.marca_modelo || '').substring(0, 32) }}{{ (p.marca_modelo || '').length > 32 ? '...' : '' }}</div>
              </div>
              <span v-else style="color:var(--dgray);font-size:10.5px">—</span>
            </td>
            <td v-if="esGerente" class="num">{{ fmtUSD(p.fob) }}</td>
            <td class="num"><strong>{{ fmtUSD(p.precio_manual || precioPublico(p.fob)) }}</strong>
              <div v-if="p.precio_manual" style="font-size:9px;color:var(--gold)">manual</div>
            </td>
            <td class="center"><span :class="['inv-stock-badge', claseStock(stockAca(p))]">{{ stockAca(p) }}</span></td>
            <td class="center"><span class="inv-stock-other disponible" :title="`${otraEmp} tiene ${stockOtra(p)}`">{{ otraEmp }}: {{ stockOtra(p) }}</span></td>
            <td v-if="esGerente" class="center" style="white-space:nowrap">
              <button class="btn btn-secondary btn-sm btn-accion" title="Editar este producto" @click="abrirEditProducto(p)"><i class="ti ti-edit"></i> Editar</button>
              {{ ' ' }}
              <button class="btn btn-secondary btn-sm btn-accion" style="color:var(--red)" title="Eliminar o desactivar este producto" @click="store.eliminarProducto(p)"><i class="ti ti-trash"></i> Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="filtrados.length > visibles.length" style="padding:10px;text-align:center">
        <button class="btn btn-secondary btn-sm" @click="limite += 200">Mostrar más ({{ filtrados.length - visibles.length }} restantes)</button>
      </div>
    </div>

    <!-- Fotos del producto a pantalla completa (verFotoProducto) -->
    <div v-if="fotoAbierta" style="position:fixed;inset:0;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:zoom-out;flex-direction:column;gap:12px"
      @click="fotoAbierta = null">
      <div style="display:flex;gap:14px;max-width:92vw;overflow-x:auto;align-items:center;padding:10px">
        <img v-for="u in fotosDe(fotoAbierta)" :key="u" :src="u" style="max-height:76vh;max-width:80vw;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.5)">
      </div>
      <div style="color:#fff;font-weight:600">{{ fotoAbierta.cod_alt }} — {{ fotoAbierta.desc }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD, precioPublico, FACTOR_LANDED_FALLBACK } from '../services/pricing.js';
import { fotosDe } from '../services/monolito.js';

const store = useArjStore();
const esGerente = computed(() => store.rol === 'gerente');
const tab = ref('normal');
const busqueda = ref('');
const marcaModelo = ref('');
const sistema = ref('');
const fotoAbierta = ref(null);
// Se pinta por tandas para no trabar la pantalla con cientos de filas con foto
const limite = ref(300);
watch([tab, busqueda, marcaModelo, sistema], () => { limite.value = 300; });

// Igual que el monolito: sin acentos, sin signos, en minúsculas
const normalize = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '');

const filtrados = computed(() => {
  if (tab.value === 'aplicacion') {
    const qMM = marcaModelo.value.trim();
    const words = normalize(qMM).split(/\s+/).filter(w => w.length >= 1);
    return store.productos.filter(p => {
      if (sistema.value && p.sistema !== sistema.value) return false;
      if (qMM) {
        const hay = normalize(p.marca_modelo || '');
        return words.every(w => hay.includes(w));
      }
      return true;
    });
  }
  const q = busqueda.value.trim();
  const palabras = normalize(q).split(/\s+/);
  return store.productos.filter(p => {
    if (!q) return true;
    const hay = normalize(p.cod_alt + ' ' + p.cod_orig + ' ' + (p.cod_barras || '') + ' ' + p.desc + ' ' + p.marca);
    return palabras.every(w => hay.includes(w));
  });
});
const visibles = computed(() => filtrados.value.slice(0, limite.value));

const otraEmp = computed(() => (store.empresa === 'directa' ? 'Distribuidora' : 'Venta Directa'));
const stockAca = p => (store.empresa === 'directa' ? p.stock_vd : p.stock_dist);
const stockOtra = p => (store.empresa === 'directa' ? p.stock_dist : p.stock_vd);
function claseStock(s) {
  const critico = store.empresa === 'directa' ? 10 : 20;
  const medio = store.empresa === 'directa' ? 20 : 40;
  if (s < 0) return 'neg';
  if (s <= critico) return 'bajo';
  if (s <= medio) return 'medio';
  return 'alto';
}

function soloGerente(accion) {
  if (store.rol !== 'gerente') { store.notif('Solo el gerente puede ' + accion, 'error'); return false; }
  return true;
}

function abrirEditProducto(p) {
  if (!soloGerente('editar productos')) return;
  store.productoSeleccionado = p;
  store.modalEditProdActivo = true;
}

function abrirNuevoProducto() {
  if (!soloGerente('crear productos')) return;
  store.productoSeleccionado = {
    _nuevo: true, cod_alt: '', cod_orig: '', cod_barras: '', desc: '', marca: '', fob: 0, stock_vd: 0, stock_dist: 0,
    marca_modelo: '', sistema: '', precio_manual: null, origen: 'importado',
    factor_landed: (store.configuracion && store.configuracion.factor_default) || FACTOR_LANDED_FALLBACK, proveedor: '', imagen_url: ''
  };
  store.modalEditProdActivo = true;
}

function abrirEmbarques() {
  if (!soloGerente('gestionar embarques')) return;
  store.modalEmbarquesActivo = true;
}

function abrirTraspaso() {
  if (!soloGerente('despachar')) return;
  // La regla de verdad: el despacho sale de Distribuidora
  if (store.empresa !== 'distribuidora') { store.notif('El despacho sale de Distribuidora. Cambia de empresa primero.', 'error'); return; }
  if (!store.supabaseConectado) { store.notif('Sin conexión a la base de datos', 'error'); return; }
  if (!store.productos.length) { store.notif('No hay catálogo cargado', 'error'); return; }
  store.modalTraspasoActivo = true;
}

function abrirNotas() { store.modalNotasActivo = true; }
function abrirRecepciones() { store.modalRecepcionesActivo = true; }

function abrirRecepcion() {
  if (!soloGerente('hacer esto')) return;
  if (!store.supabaseConectado) { store.notif('Sin conexión a la base de datos', 'error'); return; }
  if (!store.productos.length) { store.notif('No hay catálogo cargado', 'error'); return; }
  store.modalRecepcionActivo = true;
}

// En el monolito este botón no tenía acción; la carga desde Excel se hace pegando
function importarExcel() {
  store.notif('Para cargar cantidades desde Excel usa "Conteo / Recepción": copia las columnas código y cantidad y pégalas.', 'info');
}
</script>
