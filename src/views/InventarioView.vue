<template>
  <div class="page active" id="page-inventario">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="page-title"><i class="ti ti-package"></i> Inventario de Repuestos Agrícolas</h1>
        <p class="page-sub">
          Empresa activa: <strong>{{ store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora ARJ' }}</strong>
          · Total productos registrados: <strong>{{ store.productos.length }}</strong>
        </p>
      </div>

      <!-- BOTONES SUPERIORES DEL MONOLITO -->
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button
          v-if="store.rol === 'gerente'"
          class="btn btn-secondary"
          @click="store.modalTraspasoActivo = true"
        >
          <i class="ti ti-arrows-exchange"></i> Despachar a Directa
        </button>
        <button
          v-if="store.rol === 'gerente'"
          class="btn btn-secondary"
          @click="store.modalNotasActivo = true"
        >
          <i class="ti ti-file-description"></i> Notas de Entrega
        </button>
        <button
          v-if="store.rol === 'gerente'"
          class="btn btn-secondary"
          @click="store.modalRecepcionActivo = true"
        >
          <i class="ti ti-truck-delivery"></i> Recepciones / Conteo
        </button>
        <button
          v-if="store.rol === 'gerente'"
          class="btn btn-secondary"
          @click="store.modalEmbarquesActivo = true"
        >
          <i class="ti ti-ship"></i> Embarques y Costeo
        </button>
        <button
          v-if="store.rol === 'gerente'"
          class="btn btn-secondary"
          @click="store.modalListaPreciosActivo = true"
        >
          <i class="ti ti-download"></i> Lista de Precios
        </button>
        <button
          v-if="store.rol === 'gerente'"
          class="btn btn-primary"
          @click="abrirModalNuevo"
        >
          <i class="ti ti-plus"></i> Nuevo Producto
        </button>
      </div>
    </div>

    <div class="help-box">
      <i class="ti ti-info-circle"></i>
      <div>
        <strong>Catálogo agrícola multi-depósito:</strong> Muestra el stock disponible en la sede activa y en el depósito alterno. Puedes buscar por código alterno, OEM, aplicación o sistema mecánico.
      </div>
    </div>

    <!-- TABS BÚSQUEDA -->
    <div style="display:flex;gap:4px;margin-bottom:10px;border-bottom:1px solid var(--gray)">
      <button
        :class="['search-tab', { active: tabInv === 'general' }]"
        @click="tabInv = 'general'"
      >
        <i class="ti ti-search"></i> Búsqueda general
      </button>
      <button
        :class="['search-tab', { active: tabInv === 'aplicacion' }]"
        @click="tabInv = 'aplicacion'"
      >
        <i class="ti ti-tractor"></i> Por aplicación y sistema
      </button>
    </div>

    <!-- CONTROLES GENERAL -->
    <div v-if="tabInv === 'general'" class="inv-controls" style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <div class="inv-search" style="flex:1;min-width:280px">
        <i class="ti ti-search"></i>
        <input
          v-model="busquedaTexto"
          type="text"
          placeholder="Buscar por código alternativo, original OEM, descripción o marca..."
        >
      </div>
      <select v-model="filtroMarca" class="val-input" style="width:200px">
        <option value="">Todas las marcas</option>
        <option v-for="m in marcasDisponibles" :key="m" :value="m">{{ m }}</option>
      </select>
    </div>

    <!-- CONTROLES POR APLICACIÓN -->
    <div v-if="tabInv === 'aplicacion'" style="margin-bottom:16px">
      <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:12px;margin-bottom:10px">
        <div class="inv-search">
          <i class="ti ti-tractor"></i>
          <input
            v-model="busquedaModelo"
            type="text"
            placeholder="Marca o modelo del tractor (ej: John Deere 5075, Perkins 1004, Ford 6600, Massey 290...)"
          >
        </div>
        <select
          v-model="filtroSistema"
          class="val-input"
        >
          <option value="">Todos los sistemas mecánicos</option>
          <option value="Sistema de enfriamiento">Sistema de enfriamiento</option>
          <option value="Embrague">Embrague</option>
          <option value="Filtros">Filtros</option>
          <option value="Inyección Diésel">Inyección Diésel</option>
          <option value="Hidráulico">Hidráulico</option>
          <option value="Eléctrico">Eléctrico</option>
          <option value="Frenos">Frenos</option>
          <option value="Motor">Motor</option>
        </select>
      </div>
    </div>

    <!-- TABLA DE INVENTARIO -->
    <div class="inv-table" style="overflow-x:auto;background:#FFF;border-radius:8px;border:1px solid var(--border)">
      <table class="tbl">
        <thead>
          <tr>
            <th class="center" style="width:3%">#</th>
            <th style="width:12%">Cód. Alt</th>
            <th style="width:11%">Cód. OEM</th>
            <th style="width:23%">Descripción</th>
            <th style="width:9%">Marca</th>
            <th style="width:12%">Aplicación</th>
            <th v-if="store.rol === 'gerente'" class="num" style="width:7%">FOB</th>
            <th class="num" style="width:8%">P. Público</th>
            <th class="center" style="width:8%">Stock Activo</th>
            <th class="center" style="width:8%">Otra Sede</th>
            <th class="center" style="width:8%">Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="productosFiltrados.length === 0">
            <td :colspan="store.rol === 'gerente' ? 11 : 10" style="text-align:center;padding:24px;color:var(--dgray)">
              No se encontraron repuestos con los criterios de búsqueda.
            </td>
          </tr>
          <tr v-for="(p, idx) in productosFiltrados" :key="p.id">
            <td class="center" style="color:var(--dgray);font-size:11px">{{ idx + 1 }}</td>
            <td>
              <strong style="color:var(--navy)">{{ p.cod_alt }}</strong>
            </td>
            <td style="color:#555;font-family:monospace;font-size:12px">{{ p.cod_orig || '—' }}</td>
            <td>
              <div>{{ p.desc }}</div>
              <span v-if="p.sistema" style="font-size:10px;color:var(--blue);background:var(--sky);padding:1px 5px;border-radius:3px">
                {{ p.sistema }}
              </span>
            </td>
            <td>
              <span class="badge badge-secondary" style="font-size:10px">{{ p.marca }}</span>
            </td>
            <td style="font-size:11px;color:var(--dgray)">{{ p.marca_modelo || 'Universal' }}</td>
            <td v-if="store.rol === 'gerente'" class="num" style="color:var(--dgray)">
              {{ fmtUSD(p.fob) }}
            </td>
            <td class="num" style="font-weight:700;color:var(--green)">
              {{ fmtUSD(precioPublico(p.fob)) }}
            </td>
            <td class="center">
              <span :class="['badge', stockActivo(p) > 5 ? 'badge-success' : (stockActivo(p) > 0 ? 'badge-warning' : 'badge-danger')]">
                {{ stockActivo(p) }}
              </span>
            </td>
            <td class="center" style="color:var(--dgray);font-size:12px">
              {{ stockOtro(p) }}
            </td>
            <td class="center">
              <div style="display:flex;gap:4px;justify-content:center">
                <button
                  class="btn btn-secondary btn-sm"
                  style="padding:2px 6px"
                  title="Agregar a Factura"
                  :disabled="stockActivo(p) <= 0"
                  @click="agregarAFactura(p)"
                >
                  <i class="ti ti-plus"></i>
                </button>
                <button
                  v-if="store.rol === 'gerente'"
                  class="btn btn-secondary btn-sm"
                  style="padding:2px 6px"
                  title="Editar Producto"
                  @click="editarProducto(p)"
                >
                  <i class="ti ti-edit"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL NUEVO PRODUCTO -->
    <div v-if="mostrarModalNuevo" class="modal show">
      <div class="modal-content" style="max-width:550px;text-align:left">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:10px">
          <h3 style="margin:0"><i class="ti ti-plus"></i> Registrar Nuevo Repuesto Agrícola</h3>
          <button class="btn btn-secondary btn-sm" @click="mostrarModalNuevo = false"><i class="ti ti-x"></i></button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col" style="margin-bottom:0">
            <label>Código Alterno *</label>
            <input
              v-model="nuevoProd.cod_alt"
              type="text"
              placeholder="BOM-JD-5075"
              class="val-input"
              :class="{ 'is-invalid': errors.cod_alt }"
              @input="errors.cod_alt = null"
            >
            <span v-if="errors.cod_alt" class="field-error">
              <i class="ti ti-alert-circle"></i> {{ errors.cod_alt }}
            </span>
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Código OEM / Original</label>
            <input v-model="nuevoProd.cod_orig" type="text" placeholder="RE505980" class="val-input">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col" style="margin-bottom:0">
            <label>Origen del Repuesto</label>
            <select v-model="nuevoProd.origen" class="val-input">
              <option value="importado">Importado</option>
              <option value="local">Nacional / Compras Locales</option>
            </select>
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Proveedor (Opcional)</label>
            <input v-model="nuevoProd.proveedor" type="text" placeholder="Ej: John Deere Miami..." class="val-input">
          </div>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Descripción Completa del Repuesto *</label>
          <input
            v-model="nuevoProd.desc"
            type="text"
            placeholder="Bomba de agua completa con polea..."
            class="val-input"
            :class="{ 'is-invalid': errors.desc }"
            @input="errors.desc = null"
          >
          <span v-if="errors.desc" class="field-error">
            <i class="ti ti-alert-circle"></i> {{ errors.desc }}
          </span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col" style="margin-bottom:0">
            <label>Marca / Fabricante</label>
            <input v-model="nuevoProd.marca" type="text" placeholder="JOHN DEERE" class="val-input">
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Costo FOB (USD) *</label>
            <input
              v-model.number="nuevoProd.fob"
              type="number"
              step="0.5"
              placeholder="48.50"
              class="val-input"
              :class="{ 'is-invalid': errors.fob }"
              @input="errors.fob = null"
            >
            <span v-if="errors.fob" class="field-error">
              <i class="ti ti-alert-circle"></i> {{ errors.fob }}
            </span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px" v-if="nuevoProd.origen === 'importado'">
          <div class="field-col" style="margin-bottom:0">
            <label>Factor Landed (Costos de imp. y flete)</label>
            <input
              v-model.number="nuevoProd.factor_landed"
              type="number"
              step="0.001"
              class="val-input"
            >
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Costo Real (Landed)</label>
            <div style="padding:8px 12px;background:#F1F5F9;border-radius:6px;border:1px solid #E2E8F0;font-weight:700;color:var(--navy)">
              ${{ ((nuevoProd.fob || 0) * (nuevoProd.factor_landed || 1)).toFixed(2) }}
            </div>
          </div>
        </div>

        <div class="field-col" style="margin-bottom:16px">
          <label>Simulador de Margen de Ganancia Rápido</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            <button class="btn btn-secondary btn-sm" @click.prevent="simuladorMargen = 1.30">x1.30 (+30%)</button>
            <button class="btn btn-secondary btn-sm" @click.prevent="simuladorMargen = 1.50">x1.50 (+50%)</button>
            <button class="btn btn-secondary btn-sm" @click.prevent="simuladorMargen = 1.70">x1.70 (+70%)</button>
            <button class="btn btn-secondary btn-sm" @click.prevent="simuladorMargen = 2.00">x2.00 (+100%)</button>
            <button class="btn btn-secondary btn-sm" @click.prevent="simuladorMargen = 2.50">x2.50 (+150%)</button>
          </div>
          <div style="font-size:11.5px;color:var(--dgray)">
            Precio Público Sugerido: <strong style="color:var(--green);font-size:14px">${{ (((nuevoProd.fob || 0) * (nuevoProd.origen === 'importado' ? (nuevoProd.factor_landed || 1) : 1)) * simuladorMargen).toFixed(2) }}</strong>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div class="field-col" style="margin-bottom:0">
            <label>Stock Venta Directa</label>
            <input
              v-model.number="nuevoProd.stock_vd"
              type="number"
              min="0"
              placeholder="10"
              class="val-input"
              :class="{ 'is-invalid': errors.stock_vd }"
              @input="errors.stock_vd = null"
            >
            <span v-if="errors.stock_vd" class="field-error">
              <i class="ti ti-alert-circle"></i> {{ errors.stock_vd }}
            </span>
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Stock Distribuidora</label>
            <input
              v-model.number="nuevoProd.stock_dist"
              type="number"
              min="0"
              placeholder="25"
              class="val-input"
              :class="{ 'is-invalid': errors.stock_dist }"
              @input="errors.stock_dist = null"
            >
            <span v-if="errors.stock_dist" class="field-error">
              <i class="ti ti-alert-circle"></i> {{ errors.stock_dist }}
            </span>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="mostrarModalNuevo = false">Cancelar</button>
          <button class="btn btn-primary" @click="guardarNuevoProducto">
            <i class="ti ti-check"></i> Guardar en Catálogo
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD, precioPublico } from '../services/pricing.js';
import { isNonEmpty, isPositiveNumber } from '../services/validators.js';

const store = useArjStore();
const tabInv = ref('general');
const busquedaTexto = ref('');
const filtroMarca = ref('');
const busquedaModelo = ref('');
const filtroSistema = ref('');
const mostrarModalNuevo = ref(false);
const errors = ref({});

const marcasDisponibles = computed(() => {
  const marcas = new Set();
  store.productos.forEach(p => {
    if (p.marca) marcas.add(p.marca.trim().toUpperCase());
  });
  return Array.from(marcas).sort();
});

const nuevoProd = ref({
  cod_alt: '',
  cod_orig: '',
  desc: '',
  marca: '',
  fob: 0,
  stock_vd: 0,
  stock_dist: 0,
  sistema: 'Motor',
  marca_modelo: '',
  origen: 'importado',
  factor_landed: 1.471,
  proveedor: ''
});

const simuladorMargen = ref(1.5);

function stockActivo(p) {
  return store.empresa === 'directa' ? (p.stock_vd || 0) : (p.stock_dist || 0);
}

function stockOtro(p) {
  return store.empresa === 'directa' ? (p.stock_dist || 0) : (p.stock_vd || 0);
}

const productosFiltrados = computed(() => {
  let list = store.productos;

  if (tabInv.value === 'general') {
    const q = busquedaTexto.value.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        (p.cod_alt || '').toLowerCase().includes(q) ||
        (p.cod_orig || '').toLowerCase().includes(q) ||
        (p.desc || '').toLowerCase().includes(q) ||
        (p.marca || '').toLowerCase().includes(q)
      );
    }
    if (filtroMarca.value) {
      list = list.filter(p => (p.marca || '').toUpperCase() === filtroMarca.value);
    }
  } else {
    const m = busquedaModelo.value.trim().toLowerCase();
    if (m) {
      list = list.filter(p =>
        (p.marca_modelo || '').toLowerCase().includes(m) ||
        (p.marca || '').toLowerCase().includes(m)
      );
    }
    if (filtroSistema.value) {
      list = list.filter(p => p.sistema === filtroSistema.value);
    }
  }

  return list;
});

function agregarAFactura(p) {
  store.agregarAlCarrito(p, 1);
  store.cambiarVista('facturacion');
}

function editarProducto(p) {
  store.productoSeleccionado = p;
  store.modalEditProdActivo = true;
}

function abrirModalNuevo() {
  errors.value = {};
  nuevoProd.value = {
    cod_alt: '',
    cod_orig: '',
    desc: '',
    marca: '',
    fob: null,
    stock_vd: 0,
    stock_dist: 0,
    sistema: 'Motor',
    marca_modelo: '',
    origen: 'importado',
    factor_landed: (store.configuracion && store.configuracion.factor_default) || 1.471,
    proveedor: ''
  };
  simuladorMargen.value = 1.5;
  mostrarModalNuevo.value = true;
}

async function guardarNuevoProducto() {
  errors.value = {};

  if (!isNonEmpty(nuevoProd.value.cod_alt, 2)) {
    errors.value.cod_alt = 'El código es obligatorio (mínimo 2 caracteres)';
  } else if (store.productos.some(p => (p.cod_alt || '').toUpperCase() === nuevoProd.value.cod_alt.trim().toUpperCase())) {
    errors.value.cod_alt = 'Ya existe un repuesto con este código en el inventario';
  }
  if (!isNonEmpty(nuevoProd.value.desc, 3)) errors.value.desc = 'La descripción debe tener al menos 3 caracteres';
  if (!isPositiveNumber(nuevoProd.value.fob)) errors.value.fob = 'El costo FOB debe ser mayor a 0.00 USD';
  if (nuevoProd.value.stock_vd < 0) errors.value.stock_vd = 'El stock no puede ser negativo';
  if (nuevoProd.value.stock_dist < 0) errors.value.stock_dist = 'El stock no puede ser negativo';
  if (Object.keys(errors.value).length > 0) {
    store.notif('Por favor corrige los campos obligatorios marcados en rojo', 'warning');
    return;
  }

  // C-01: el alta se guarda en la base de datos
  const ok = await store.guardarProducto({
    cod_alt: nuevoProd.value.cod_alt.trim().toUpperCase(),
    cod_orig: (nuevoProd.value.cod_orig || '').trim().toUpperCase(),
    desc: nuevoProd.value.desc.trim(),
    marca: (nuevoProd.value.marca || '').trim().toUpperCase(),
    fob: parseFloat(nuevoProd.value.fob) || 0,
    stock_vd: parseInt(nuevoProd.value.stock_vd) || 0,
    stock_dist: parseInt(nuevoProd.value.stock_dist) || 0,
    sistema: nuevoProd.value.sistema || '',
    marca_modelo: (nuevoProd.value.marca_modelo || '').trim(),
    factor_landed: nuevoProd.value.origen === 'local' ? 1 : (parseFloat(nuevoProd.value.factor_landed) || null),
    origen: nuevoProd.value.origen || 'importado',
    proveedor: (nuevoProd.value.proveedor || '').trim()
  });
  if (ok) mostrarModalNuevo.value = false;
}
</script>
