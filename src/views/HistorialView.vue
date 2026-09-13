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
      </select>
    </div>

    <!-- KPIs Historial -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <div class="kpi-card blue" style="margin:0;padding:10px 14px">
        <div class="kpi-label">Total facturas</div>
        <div class="kpi-val" style="font-size:18px">{{ store.todasFacturas.length }}</div>
      </div>
      <div class="kpi-card green" style="margin:0;padding:10px 14px">
        <div class="kpi-label">Pagadas</div>
        <div class="kpi-val" style="font-size:18px;color:var(--green)">{{ totalPagadas }}</div>
      </div>
      <div class="kpi-card gold" style="margin:0;padding:10px 14px">
        <div class="kpi-label">Pendientes / Parciales</div>
        <div class="kpi-val" style="font-size:18px;color:var(--gold)">{{ totalPendientes }}</div>
      </div>
      <div class="kpi-card" style="margin:0;padding:10px 14px;background:#E8F5E9">
        <div class="kpi-label">Total Facturado</div>
        <div class="kpi-val" style="font-size:18px;color:var(--green)">{{ fmtUSD(totalFacturado) }}</div>
      </div>
    </div>

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
          <tr v-if="facturasFiltradas.length === 0">
            <td colspan="8" style="text-align:center;padding:24px;color:var(--dgray)">
              No hay facturas registradas que coincidan con la búsqueda.
            </td>
          </tr>
          <tr v-for="f in facturasFiltradas" :key="f.id">
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
                  title="Ver / Reimprimir Factura"
                  @click="verFactura(f)"
                >
                  <i class="ti ti-printer"></i>
                </button>
                <button
                  v-if="store.rol === 'gerente' && f.estado !== 'anulada'"
                  class="btn btn-danger btn-sm"
                  style="padding:2px 5px;font-size:10px"
                  title="Anular Factura"
                  @click="iniciarAnulacion(f)"
                >
                  <i class="ti ti-trash"></i>
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

const facturasFiltradas = computed(() => {
  let list = store.todasFacturas;
  const q = busqueda.value.trim().toLowerCase();
  if (q) {
    list = list.filter(f =>
      (f.num || '').toLowerCase().includes(q) ||
      (f.cliente || '').toLowerCase().includes(q) ||
      (f.vendedor || '').toLowerCase().includes(q)
    );
  }
  if (filtroEstado.value) {
    list = list.filter(f => f.estado === filtroEstado.value);
  }
  return list;
});

const totalPagadas = computed(() => {
  return store.todasFacturas.filter(f => f.estado === 'pagada').length;
});

const totalPendientes = computed(() => {
  return store.todasFacturas.filter(f => f.estado !== 'pagada').length;
});

const totalFacturado = computed(() => {
  return store.todasFacturas.reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
});
</script>
