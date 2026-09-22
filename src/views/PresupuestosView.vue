<template>
  <div class="page active" id="page-cotizaciones">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="page-title"><i class="ti ti-file-text"></i> Presupuestos y Cotizaciones</h1>
        <p class="page-sub">Propuestas comerciales · Vigencia 45 días · No descuentan stock · Convertibles a venta</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:12px;color:var(--dgray);cursor:pointer;user-select:none">
          <input type="checkbox" v-model="verRechazados" style="vertical-align:middle"> Ver archivados / rechazados
        </label>
        <button class="btn btn-primary" @click="mostrarModalNuevo = true">
          <i class="ti ti-plus"></i> Nuevo Presupuesto
        </button>
      </div>
    </div>

    <div class="help-box">
      <i class="ti ti-info-circle"></i>
      <div>
        <strong>¿Para qué sirven?</strong> Cuando un cliente pregunta precio antes de comprar. Generas una cotización con validez de 45 días. Si decide comprar, se convierte en venta (Facturación) en un clic.
      </div>
    </div>

    <!-- KPIs -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <div class="kpi-card blue" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = 'activo'">
        <div class="kpi-label">Activas</div>
        <div class="kpi-val" style="font-size:18px">{{ totalActivas }}</div>
      </div>
      <div class="kpi-card gold" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = 'por_vencer'">
        <div class="kpi-label">Por vencer</div>
        <div class="kpi-val" style="font-size:18px;color:var(--gold)">{{ totalPorVencer }}</div>
      </div>
      <div class="kpi-card red" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = 'rechazado'">
        <div class="kpi-label">Vencidas / Rechazadas</div>
        <div class="kpi-val" style="font-size:18px;color:var(--red)">{{ totalRechazadas }}</div>
      </div>
      <div class="kpi-card" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = 'convertido'">
        <div class="kpi-label">Convertidas a Venta</div>
        <div class="kpi-val" style="font-size:18px;color:var(--green)">{{ totalConvertidas }}</div>
      </div>
      <div class="kpi-card" style="margin:0;padding:10px 14px;cursor:pointer;background:#F5F5F5" @click="filtroEstado = ''">
        <div class="kpi-label" style="color:var(--dgray)">Limpiar Filtros</div>
        <div class="kpi-val" style="font-size:18px;color:var(--navy)"><i class="ti ti-filter-off"></i></div>
      </div>
    </div>

    <!-- LISTADO DE PRESUPUESTOS -->
    <div class="card" style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:16%">N° Presupuesto</th>
            <th style="width:28%">Cliente</th>
            <th style="width:12%">Emisión</th>
            <th style="width:12%">Vence (45d)</th>
            <th class="num" style="width:12%">Total USD</th>
            <th class="center" style="width:10%">Estado</th>
            <th class="center" style="width:10%">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="presupuestosFiltrados.length === 0">
            <td colspan="7" style="text-align:center;padding:24px;color:var(--dgray)">
              No hay presupuestos registrados. Haz clic en "Nuevo Presupuesto" para generar una propuesta.
            </td>
          </tr>
          <tr v-for="pre in presupuestosFiltrados" :key="pre.id">
            <td><strong style="color:var(--navy)">{{ pre.num }}</strong></td>
            <td><strong>{{ pre.cliente }}</strong></td>
            <td style="font-size:12px;color:var(--dgray)">{{ pre.fecha }}</td>
            <td style="font-size:12px;color:var(--dgray)">{{ pre.vence }}</td>
            <td class="num" style="font-weight:700">{{ fmtUSD(pre.total) }}</td>
            <td class="center">
              <span :class="['badge', pre.estado === 'activo' ? 'badge-success' : (pre.estado === 'convertido' ? 'badge-info' : 'badge-danger')]">
                {{ pre.estado.toUpperCase() }}
              </span>
            </td>
            <td class="center">
              <div style="display:flex;gap:4px;justify-content:center">
                <button
                  class="btn btn-secondary btn-sm"
                  style="padding:2px 6px;font-size:11px"
                  title="Descargar PDF"
                  @click="descargarPDF(pre)"
                >
                  <i class="ti ti-file-type-pdf"></i>
                </button>
                <button
                  v-if="pre.estado === 'activo'"
                  class="btn btn-green btn-sm"
                  style="padding:2px 6px;font-size:11px"
                  title="Convertir a Factura"
                  @click="store.convertirPresupuestoEnVenta(pre.id)"
                >
                  <i class="ti ti-arrow-right"></i> Vender
                </button>
                <button
                  v-if="pre.estado === 'activo'"
                  class="btn btn-secondary btn-sm"
                  style="padding:2px 6px;font-size:11px"
                  title="Marcar Rechazado"
                  @click="marcarRechazado(pre)"
                >
                  <i class="ti ti-x"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL NUEVO PRESUPUESTO -->
    <div v-if="mostrarModalNuevo" class="modal show">
      <div class="modal-content" style="max-width:580px;text-align:left">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:10px">
          <h3 style="margin:0"><i class="ti ti-file-text" style="color:var(--blue)"></i> Elaborar Nueva Cotización Comercial</h3>
          <button class="btn btn-secondary btn-sm" @click="mostrarModalNuevo = false"><i class="ti ti-x"></i></button>
        </div>
        <p class="modal-sub">
          Selecciona el cliente y los repuestos a cotizar. El documento se emitirá formalmente con 45 días de vigencia.
        </p>

        <div class="field-col" style="margin-bottom:12px">
          <label>Cliente / Agropecuaria *</label>
          <select v-model="clienteSel" class="val-input">
            <option value="">-- Selecciona un cliente --</option>
            <option v-for="c in store.clientes" :key="c.id" :value="c.id">{{ c.nombre }}</option>
          </select>
        </div>

        <div class="field-col" style="margin-bottom:14px">
          <label>Agregar Repuesto al Presupuesto</label>
          <div style="display:flex;gap:8px">
            <select v-model="productoSel" class="val-input" style="flex:1">
              <option value="">-- Elige un repuesto --</option>
              <option v-for="p in store.productos" :key="p.id" :value="p.id">
                {{ p.cod_alt }} - {{ p.desc }} (${{ precioPublico(p.fob) }})
              </option>
            </select>
            <input v-model.number="cantSel" type="number" min="1" placeholder="Cant" class="val-input" style="width:75px;text-align:center;font-weight:700">
            <button class="btn btn-primary btn-sm" @click="agregarItemTemp"><i class="ti ti-plus"></i></button>
          </div>
        </div>

        <!-- ITEMS TEMPORALES -->
        <table v-if="itemsTemp.length > 0" class="tbl" style="margin-bottom:12px;font-size:12px">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th class="num">Cant</th>
              <th class="num">Precio</th>
              <th class="num">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(it, i) in itemsTemp" :key="i">
              <td>{{ it.cod_alt }}</td>
              <td>{{ it.desc }}</td>
              <td class="num">{{ it.cant }}</td>
              <td class="num">{{ fmtUSD(it.precio) }}</td>
              <td class="num" style="font-weight:700">{{ fmtUSD(it.cant * it.precio) }}</td>
              <td style="text-align:center">
                <button class="btn btn-danger btn-sm" style="padding:1px 4px" @click="itemsTemp.splice(i, 1)">&times;</button>
              </td>
            </tr>
          </tbody>
        </table>

        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid #EEE">
          <span style="font-weight:700">Total Cotización:</span>
          <span style="font-size:16px;font-weight:800;color:var(--navy)">{{ fmtUSD(totalTemp) }}</span>
        </div>

        <div class="actions" style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-secondary" @click="mostrarModalNuevo = false">Cancelar</button>
          <button class="btn btn-primary" :disabled="itemsTemp.length === 0" @click="guardarCotizacion">
            <i class="ti ti-check"></i> Emitir Presupuesto
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
import { generarPresupuestoPDF } from '../services/exportService.js';

const store = useArjStore();
const verRechazados = ref(false);
const mostrarModalNuevo = ref(false);
const filtroEstado = ref('');

const clienteSel = ref('');
const productoSel = ref('');
const cantSel = ref(1);
const itemsTemp = ref([]);

const presupuestosFiltrados = computed(() => {
  let list = store.presupuestos;
  if (!verRechazados.value) {
    list = list.filter(p => p.estado !== 'rechazado' && p.estado !== 'vencida');
  }
  if (filtroEstado.value) {
    list = list.filter(p => p.estado === filtroEstado.value || (filtroEstado.value === 'rechazado' && p.estado === 'vencida'));
  }
  return list;
});

const totalActivas = computed(() => store.presupuestos.filter(p => p.estado === 'activo' || p.estado === 'activa').length);
const totalPorVencer = computed(() => store.presupuestos.filter(p => p.estado === 'por_vencer').length);
const totalRechazadas = computed(() => store.presupuestos.filter(p => p.estado === 'rechazado' || p.estado === 'vencida').length);
const totalConvertidas = computed(() => store.presupuestos.filter(p => p.estado === 'convertido').length);

const totalTemp = computed(() => {
  return itemsTemp.value.reduce((acc, it) => acc + (it.cant * it.precio), 0);
});

function agregarItemTemp() {
  const prod = store.productos.find(p => p.id === productoSel.value);
  if (!prod) return;
  const precio = precioPublico(prod.fob);
  itemsTemp.value.push({
    id: prod.id,
    cod_alt: prod.cod_alt,
    desc: prod.desc,
    cant: cantSel.value || 1,
    precio: precio,
    fob: prod.fob
  });
  productoSel.value = '';
  cantSel.value = 1;
}

function guardarCotizacion() {
  const cli = store.clientes.find(c => c.id === clienteSel.value);
  store.guardarPresupuesto({
    cliente: cli ? cli.nombre : 'CLIENTE GENERAL',
    cliente_id: cli ? cli.id : null,
    total: totalTemp.value,
    items: itemsTemp.value
  });
  itemsTemp.value = [];
  clienteSel.value = '';
  mostrarModalNuevo.value = false;
}

function marcarRechazado(pre) {
  pre.estado = 'rechazado';
  store.logBitacora('presupuesto', `Cotización ${pre.num} marcada como rechazada/archivada`);
  store.notif(`Presupuesto ${pre.num} archivado`, 'info');
}

function descargarPDF(pre) {
  generarPresupuestoPDF(pre, store.tasa_bcv);
  store.notif(`PDF de cotización ${pre.num} generado`, 'success');
}
</script>
