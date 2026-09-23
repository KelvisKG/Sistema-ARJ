<template>
  <div class="page active" id="page-cotizaciones">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="page-title"><i class="ti ti-file-text"></i> Presupuestos</h1>
        <p class="page-sub">Propuestas comerciales al cliente · Vigencia 45 días · No descuentan stock · Nada se borra: los rechazados y vencidos quedan archivados</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:12px;color:var(--dgray);cursor:pointer;user-select:none">
          <input type="checkbox" v-model="verRechazados" style="vertical-align:middle"> Ver rechazados
        </label>
        <button class="btn btn-primary" @click="mostrarModalNuevo = true">
          <i class="ti ti-plus"></i> Nuevo presupuesto
        </button>
      </div>
    </div>

    <div class="help-toggle" @click="verAyuda = !verAyuda" style="cursor:pointer;background:#FFF8E1;border-left:3px solid var(--gold);border-radius:6px;padding:8px 14px;margin-bottom:14px;font-size:12.5px;color:#5D4037">
      <i class="ti ti-info-circle"></i> Ayuda — click para ver
    </div>
    <div v-if="verAyuda" style="background:#FFFBF0;border:1px solid #F0E6C8;border-radius:6px;padding:12px 14px;margin-bottom:14px;font-size:12px;color:#5D4037">
      <strong>¿Para qué sirven?</strong> Cuando un cliente pregunta precio antes de comprar. Generas una cotización con validez de 45 días. Si decide comprar, se convierte en venta (Facturación) en un clic.
    </div>

    <!-- KPIs -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <div :class="['kpi-card', filtroEstado === 'activa' ? 'blue' : '']" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = filtroEstado === 'activa' ? '' : 'activa'">
        <div class="kpi-label">Activas</div>
        <div class="kpi-val" style="font-size:18px">{{ kpiActivas }}</div>
      </div>
      <div :class="['kpi-card', filtroEstado === 'por_vencer' ? 'gold' : '']" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = filtroEstado === 'por_vencer' ? '' : 'por_vencer'">
        <div class="kpi-label">Por vencer</div>
        <div class="kpi-val" style="font-size:18px;color:var(--gold)">{{ kpiPorVencer }}</div>
      </div>
      <div :class="['kpi-card', filtroEstado === 'vencida' ? 'red' : '']" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = filtroEstado === 'vencida' ? '' : 'vencida'">
        <div class="kpi-label">Vencidas</div>
        <div class="kpi-val" style="font-size:18px;color:var(--red)">{{ kpiVencidas }}</div>
      </div>
      <div :class="['kpi-card', filtroEstado === 'convertida' ? '' : '']" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = filtroEstado === 'convertida' ? '' : 'convertida'">
        <div class="kpi-label">Convertidas</div>
        <div class="kpi-val" style="font-size:18px;color:var(--green)">{{ kpiConvertidas }}</div>
        <div style="font-size:10px;color:var(--dgray)">{{ kpiTasaCierre }}</div>
      </div>
      <div v-if="filtroEstado" class="kpi-card" style="margin:0;padding:10px 14px;cursor:pointer;background:#F5F5F5" @click="filtroEstado = ''">
        <div class="kpi-label" style="color:var(--dgray)">Limpiar Filtros</div>
        <div class="kpi-val" style="font-size:18px;color:var(--navy)"><i class="ti ti-filter-off"></i></div>
      </div>
    </div>

    <!-- LISTADO DE PRESUPUESTOS -->
    <div class="card" style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th>N° Presupuesto</th>
            <th>Cliente</th>
            <th>Fecha</th>
            <th>Vence</th>
            <th class="num">Total USD</th>
            <th>Estado</th>
            <th class="center" style="width:130px">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="presupuestosFiltrados.length === 0">
            <td colspan="7" style="text-align:center;padding:30px;color:var(--dgray)">
              Sin presupuestos{{ store.empresa === 'directa' ? ' en Venta Directa' : ' en Distribuidora' }}
            </td>
          </tr>
          <tr v-for="pre in presupuestosFiltrados" :key="pre.id" :style="pre.estado === 'rechazada' ? 'opacity:0.55' : ''">
            <td>
              <strong>{{ pre.num }}</strong>
              <div style="font-size:10.5px;color:var(--dgray)">{{ pre.items_count || 0 }} ítems · {{ pre.vendedor || '—' }}</div>
            </td>
            <td><strong>{{ pre.cliente }}</strong></td>
            <td style="font-size:12px;color:var(--dgray)">{{ pre.fecha }}</td>
            <td style="font-size:12px">
              {{ pre.vence }}
              <div style="font-size:10.5px;color:var(--dgray)">{{ diasRestantesTxt(pre) }}</div>
            </td>
            <td class="num" style="font-weight:700">{{ fmtUSD(pre.total) }}</td>
            <td>
              <span :style="badgeStyle(pre)">
                <i :class="badgeIcon(pre)"></i> {{ badgeText(pre) }}
              </span>
            </td>
            <td class="center" style="white-space:nowrap">
              <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:11px" title="Ver presupuesto" @click="abrirPreview(pre)"><i class="ti ti-eye"></i></button>
              <button
                v-if="pre.estado === 'activa' || pre.estado === 'por_vencer'"
                class="btn btn-sm" style="padding:2px 6px;font-size:11px;background:var(--green);color:#FFF;border:none"
                title="Convertir a factura"
                @click="convertirAFactura(pre)"
              ><i class="ti ti-file-invoice"></i></button>
              <button
                v-if="pre.estado !== 'convertida' && pre.estado !== 'rechazada'"
                class="btn btn-sm" style="padding:2px 6px;font-size:11px;background:var(--red);color:#FFF;border:none"
                title="Marcar como rechazado (se archiva, no se borra)"
                @click="marcarRechazado(pre)"
              ><i class="ti ti-archive"></i></button>
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

const store = useArjStore();
const verRechazados = ref(false);
const verAyuda = ref(false);
const mostrarModalNuevo = ref(false);
const filtroEstado = ref('');

const clienteSel = ref('');
const productoSel = ref('');
const cantSel = ref(1);
const itemsTemp = ref([]);

// Filtra por empresa primero (como en el legacy)
const presupuestosEmpresa = computed(() => {
  return store.presupuestos.filter(p => p.empresa === store.empresa);
});

// KPIs — exactamente como en el legacy
const kpiActivas = computed(() => presupuestosEmpresa.value.filter(c => c.estado === 'activa').length);
const kpiPorVencer = computed(() => presupuestosEmpresa.value.filter(c => c.estado === 'por_vencer').length);
const kpiVencidas = computed(() => presupuestosEmpresa.value.filter(c => c.estado === 'vencida').length);
const kpiConvertidas = computed(() => presupuestosEmpresa.value.filter(c => c.estado === 'convertida').length);
const kpiRechazadas = computed(() => presupuestosEmpresa.value.filter(c => c.estado === 'rechazada').length);
const kpiTasaCierre = computed(() => {
  const cerrados = kpiConvertidas.value + kpiRechazadas.value;
  return cerrados > 0 ? Math.round(kpiConvertidas.value / cerrados * 100) + '% de cierre' : '—';
});

const presupuestosFiltrados = computed(() => {
  let list = presupuestosEmpresa.value;
  // Ocultar rechazados salvo que el usuario los pida
  if (!verRechazados.value) {
    list = list.filter(p => p.estado !== 'rechazada');
  }
  // Filtro por estado (KPI click)
  if (filtroEstado.value) {
    list = list.filter(p => p.estado === filtroEstado.value);
  }
  return list;
});

function diasRestantesTxt(pre) {
  const dias = pre.dias_restantes;
  if (dias === undefined || dias === null) return '';
  if (dias >= 0) return `${dias} días restantes`;
  return `Venció hace ${Math.abs(dias)} días`;
}

function badgeStyle(pre) {
  const colors = {
    'rechazada': 'var(--dgray)',
    'convertida': 'var(--blue)',
    'vencida': 'var(--red)',
    'por_vencer': 'var(--gold)',
    'activa': 'var(--green)'
  };
  const c = colors[pre.estado] || 'var(--dgray)';
  return `background:${c}22;color:${c};padding:3px 8px;border-radius:10px;font-size:10.5px;font-weight:600`;
}

function badgeIcon(pre) {
  const icons = {
    'rechazada': 'ti ti-archive',
    'convertida': 'ti ti-file-invoice',
    'vencida': 'ti ti-x-circle',
    'por_vencer': 'ti ti-alert-triangle',
    'activa': 'ti ti-circle-check'
  };
  return icons[pre.estado] || 'ti ti-circle';
}

function badgeText(pre) {
  const texts = {
    'rechazada': 'RECHAZADA',
    'convertida': 'CONVERTIDA',
    'vencida': 'VENCIDA',
    'por_vencer': 'POR VENCER',
    'activa': 'ACTIVA'
  };
  return texts[pre.estado] || pre.estado?.toUpperCase() || '—';
}

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
  pre.estado = 'rechazada';
  store.logBitacora('presupuesto', `Cotización ${pre.num} marcada como rechazada/archivada`);
  store.notif(`Presupuesto ${pre.num} archivado`, 'info');
}

function abrirPreview(pre) {
  store.presupuestoSeleccionado = pre;
  store.modalPresupuestoActivo = true;
}

function convertirAFactura(pre) {
  if (confirm(`¿Convertir el presupuesto ${pre.num} en factura?\n\nLos datos se cargarán automáticamente en el módulo de facturación.`)) {
    store.convertirPresupuestoEnVenta(pre.id);
  }
}
</script>
