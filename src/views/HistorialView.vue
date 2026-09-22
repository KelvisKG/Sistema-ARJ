<template>
  <div class="page active" id="page-historial">
    <h1 class="page-title"><i class="ti ti-file-text"></i> Historial de Documentos</h1>
    <p class="page-sub">Facturas y presupuestos emitidos · Buscar, reimprimir y auditar ventas</p>

    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por N° factura, cliente o vendedor..."
        class="val-input"
        style="flex:1;min-width:240px"
      >
      <select
        v-model="filtroEstado"
        class="val-input"
        style="min-width:180px"
      >
        <option value="">Todos los estados</option>
        <option value="pagada">Pagadas</option>
        <option value="pendiente">Pendientes</option>
        <option value="parcial">Parciales</option>
        <option value="anulada">Anuladas</option>
      </select>
      <div style="flex:1;text-align:right">
        <div class="toggle-switch" style="display:inline-flex;background:var(--card-bg);border:1px solid var(--border);border-radius:20px;overflow:hidden">
          <button :class="['btn-toggle', vistaActual === 'facturas' ? 'active' : '']" @click="vistaActual = 'facturas'">Facturas</button>
          <button :class="['btn-toggle', vistaActual === 'cotizaciones' ? 'active' : '']" @click="vistaActual = 'cotizaciones'">Cotizaciones</button>
        </div>
      </div>
    </div>

    <!-- KPIs Historial -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <div class="kpi-card blue" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = ''">
        <div class="kpi-label">Total facturas</div>
        <div class="kpi-val" style="font-size:18px">{{ store.todasFacturas.length }}</div>
      </div>
      <div class="kpi-card green" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = 'pagada'">
        <div class="kpi-label">Pagadas</div>
        <div class="kpi-val" style="font-size:18px;color:var(--green)">{{ totalPagadas }}</div>
      </div>
      <div class="kpi-card gold" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = 'pendiente'">
        <div class="kpi-label">Pendientes / Parciales</div>
        <div class="kpi-val" style="font-size:18px;color:var(--gold)">{{ totalPendientes }}</div>
      </div>
      <div class="kpi-card red" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = 'anulada'">
        <div class="kpi-label">Anuladas</div>
        <div class="kpi-val" style="font-size:18px;color:var(--red)">{{ totalAnuladas }}</div>
      </div>
      <div class="kpi-card" style="margin:0;padding:10px 14px;background:#E8F5E9">
        <div class="kpi-label">Ventas del Mes</div>
        <div class="kpi-val" style="font-size:18px;color:var(--green)">{{ fmtUSD(totalFacturado) }}</div>
      </div>
    </div>

    <style>
      .btn-toggle { background:transparent; border:none; padding:6px 14px; font-size:12px; cursor:pointer; color:var(--dgray); font-weight:600; transition:all 0.2s }
      .btn-toggle.active { background:var(--navy); color:#FFF; }
    </style>

    <div class="card" style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:14%">N° Factura</th>
            <th style="width:10%">Empresa</th>
            <th style="width:22%">Cliente</th>
            <th style="width:11%">Fecha</th>
            <th style="width:13%">Vendedor</th>
            <th class="num" style="width:11%">Total USD</th>
            <th class="center" style="width:10%">Estado</th>
            <th class="center" style="width:9%">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="documentosFiltrados.length === 0">
            <td colspan="8" style="text-align:center;padding:24px;color:var(--dgray)">
              No hay {{ vistaActual === 'facturas' ? 'facturas' : 'cotizaciones' }} registradas que coincidan con la búsqueda.
            </td>
          </tr>
          <tr v-for="f in documentosFiltrados" :key="f.id">
            <td>
              <strong style="color:var(--navy)">{{ f.num }}</strong>
            </td>
            <td>
              <span class="badge" :style="{ background: f.empresa === 'directa' ? 'var(--blue)' : 'var(--gold)', color: '#FFF' }">
                {{ f.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora' }}
              </span>
            </td>
            <td>{{ f.cliente }}</td>
            <td style="color:var(--dgray);font-size:12px">{{ f.fecha }}</td>
            <td style="font-size:12px;color:var(--dgray)">{{ f.vendedor }}</td>
            <td class="num" style="font-weight:700">{{ fmtUSD(f.total) }}</td>
            <td class="center">
              <span :class="['badge', f.estado === 'pagada' ? 'badge-success' : (f.estado === 'parcial' ? 'badge-warning' : (f.estado === 'anulada' ? 'badge-secondary' : 'badge-danger'))]">
                {{ f.estado.toUpperCase() }}
              </span>
            </td>
            <td class="center">
              <div style="display:flex;gap:4px;justify-content:center">
                <button
                  class="btn btn-secondary btn-sm"
                  style="padding:2px 5px;font-size:10px"
                  title="Descargar PDF"
                  @click="descargarFacturaPDF(f)"
                >
                  <i class="ti ti-download"></i>
                </button>
                <button
                  class="btn btn-secondary btn-sm"
                  style="padding:2px 5px;font-size:10px"
                  title="Ver / Reimprimir Factura"
                  @click="verFactura(f)"
                >
                  <i class="ti ti-printer"></i>
                </button>
                <button
                  v-if="store.rol === 'gerente' && f.estado !== 'anulada' && vistaActual === 'facturas'"
                  class="btn btn-danger btn-sm"
                  style="padding:2px 5px;font-size:10px"
                  title="Anular Factura"
                  @click="iniciarAnulacion(f)"
                >
                  <i class="ti ti-trash"></i>
                </button>
                <button
                  v-if="vistaActual === 'cotizaciones' && f.estado === 'activo'"
                  class="btn btn-green btn-sm"
                  style="padding:2px 5px;font-size:10px"
                  title="Convertir a Factura"
                  @click="store.convertirPresupuestoEnVenta(f.id)"
                >
                  <i class="ti ti-arrow-right"></i>
                </button>
              </div>
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
import { fmtUSD } from '../services/pricing.js';
import { generarFacturaPDF } from '../services/exportService.js';

const store = useArjStore();
const busqueda = ref('');
const filtroEstado = ref('');

function verFactura(f) {
  store.facturaReciente = f;
  store.modalFacturaActivo = true;
}

function iniciarAnulacion(f) {
  store.facturaAAnular = f;
  store.modalAnularActivo = true;
}

function descargarFacturaPDF(f) {
  if (vistaActual.value === 'cotizaciones') {
    // Need import for generarPresupuestoPDF
    import('../services/exportService.js').then(module => {
      module.generarPresupuestoPDF(f, store.tasa_bcv);
      store.notif(`PDF de la cotización ${f.num} generado`, 'success');
    });
  } else {
    generarFacturaPDF(f, store.empresa);
    store.notif(`PDF de la factura ${f.num} generado`, 'success');
  }
}

const vistaActual = ref('facturas');

const documentosFiltrados = computed(() => {
  let list = vistaActual.value === 'facturas' ? store.todasFacturas : store.presupuestos;
  const q = busqueda.value.trim().toLowerCase();
  if (q) {
    list = list.filter(f =>
      (f.num || '').toLowerCase().includes(q) ||
      (f.cliente || '').toLowerCase().includes(q) ||
      (f.vendedor || '').toLowerCase().includes(q)
    );
  }
  if (filtroEstado.value) {
    if (filtroEstado.value === 'pendiente') {
      list = list.filter(f => f.estado === 'pendiente' || f.estado === 'parcial');
    } else {
      list = list.filter(f => f.estado === filtroEstado.value);
    }
  }
  return list;
});

const totalPagadas = computed(() => {
  return store.todasFacturas.filter(f => f.estado === 'pagada').length;
});

const totalPendientes = computed(() => {
  return store.todasFacturas.filter(f => f.estado === 'pendiente' || f.estado === 'parcial').length;
});

const totalAnuladas = computed(() => {
  return store.todasFacturas.filter(f => f.estado === 'anulada').length;
});

const totalFacturado = computed(() => {
  // Ventas del mes (only pagadas/pendientes of current month)
  const today = new Date();
  return store.todasFacturas.filter(f => {
    if (f.estado === 'anulada') return false;
    // Basic month check assuming dd/mm/yyyy
    const parts = (f.fecha || '').split('/');
    if (parts.length >= 2) {
      return parseInt(parts[1]) === (today.getMonth() + 1) && parseInt(parts[2]) === today.getFullYear();
    }
    return true; // Fallback
  }).reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
});
</script>
