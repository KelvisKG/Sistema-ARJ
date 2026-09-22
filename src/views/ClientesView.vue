<template>
  <div class="page active" id="page-clientes">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="page-title"><i class="ti ti-users"></i> Clientes Agrícolas</h1>
        <p class="page-sub">Listado de clientes registrados · Nivel de precio asignado · Saldos deudores</p>
      </div>
      <button class="btn btn-primary" @click="mostrarModalNuevo = true">
        <i class="ti ti-user-plus"></i> Nuevo cliente
      </button>
    </div>

    <div class="help-box">
      <i class="ti ti-info-circle"></i>
      <div>
        <strong>Cartera Comercial:</strong> Consulta teléfonos, contactos de taller/compras y estado crediticio de cada cliente. Puedes iniciar facturación directa seleccionando cualquiera de ellos.
      </div>
    </div>

    <div style="margin-bottom:16px;display:flex;gap:12px;align-items:center">
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por nombre de empresa, RIF o teléfono..."
        class="val-input"
        style="width:360px"
      >
      <!-- Gráfica Analítica: CÓMO NOS CONSIGUIERON -->
      <div style="flex:1;background:#F8FAFC;padding:8px 12px;border-radius:6px;border:1px solid #E2E8F0;font-size:11px">
        <div style="margin-bottom:6px;font-weight:700;color:var(--navy);display:flex;justify-content:space-between">
          <span>¿Cómo nos consiguieron? (Analítica de Captación)</span>
          <span>{{ store.clientes.length }} Clientes</span>
        </div>
        <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;gap:2px">
          <div v-for="st in statsCaptacion" :key="st.label" :style="{ width: st.pct + '%', background: st.color }" :title="st.label + ': ' + st.count"></div>
        </div>
        <div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap">
          <span v-for="st in statsCaptacion" :key="st.label" style="display:flex;align-items:center;gap:4px">
            <span :style="{ background: st.color, width:'8px', height:'8px', borderRadius:'50%' }"></span>
            {{ st.label }} ({{ st.pct }}%)
          </span>
        </div>
      </div>
    </div>

    <div class="card" style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:28%">Nombre / Razón Social</th>
            <th style="width:14%">RIF</th>
            <th style="width:15%">Teléfono</th>
            <th style="width:18%">Contacto Principal</th>
            <th class="center" style="width:9%">Nivel</th>
            <th class="num" style="width:16%">Saldo Pendiente</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="clientesFiltrados.length === 0">
            <td colspan="6" style="text-align:center;padding:24px;color:var(--dgray)">
              No se encontraron clientes registrados.
            </td>
          </tr>
          <tr v-for="c in clientesFiltrados" :key="c.id" style="cursor:pointer" @click="facturarA(c)">
            <td>
              <strong style="color:var(--navy)">{{ c.nombre }}</strong>
              <div v-if="c.direccion" style="font-size:11px;color:var(--dgray)">{{ c.direccion }}</div>
            </td>
            <td style="font-family:monospace;font-size:12px">{{ c.rif || '—' }}</td>
            <td style="font-size:12px">{{ c.tel || '—' }}</td>
            <td style="font-size:12px">
              <div>{{ c.contacto_principal?.nombre || '—' }}</div>
              <small style="color:var(--dgray)">{{ c.contacto_principal?.cargo || '' }}</small>
            </td>
            <td class="center">
              <span class="badge badge-info">{{ c.nivel || 'T1' }}</span>
            </td>
            <td class="num" style="font-weight:700" :style="{ color: saldoDe(c) > 0 ? 'var(--red)' : 'var(--green)' }">
              {{ fmtUSD(saldoDe(c)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL NUEVO CLIENTE -->
    <div v-if="mostrarModalNuevo" class="modal show">
      <div class="modal-content" style="max-width:500px;text-align:left">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:10px">
          <h3 style="margin:0"><i class="ti ti-user-plus"></i> Registrar Nuevo Cliente</h3>
          <button class="btn btn-secondary btn-sm" @click="mostrarModalNuevo = false"><i class="ti ti-x"></i></button>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Nombre / Razón Social *</label>
          <input v-model="nuevoCli.nombre" type="text" placeholder="Ej: Agropecuaria El Trébol C.A." class="val-input">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col" style="margin-bottom:0">
            <label>RIF / Documento</label>
            <input v-model="nuevoCli.rif" type="text" placeholder="J-12345678-0" class="val-input">
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Teléfono Principal</label>
            <input v-model="nuevoCli.tel" type="text" placeholder="0414-1234567" class="val-input">
          </div>
        </div>

        <div class="field-col">
          <label>Dirección o Ubicación</label>
          <input v-model="nuevoCli.direccion" type="text" placeholder="Ej: Zona Industrial..." class="val-input">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col" style="margin-bottom:0">
            <label>Nivel de Precio</label>
            <select v-model="nuevoCli.nivel" class="val-input">
              <option value="Publico">Público / Mostrador</option>
              <option value="T1">T1 (Público / –5%)</option>
              <option value="T2">T2 (Aliado / –10%)</option>
              <option value="T3">T3 (Mayorista / –20%)</option>
            </select>
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Condición Habitual</label>
            <select v-model="nuevoCli.tipo" class="val-input">
              <option value="contado">Contado</option>
              <option value="credito">A Crédito</option>
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col" style="margin-bottom:0">
            <label>Persona de Contacto</label>
            <input v-model="nuevoCli.contacto_nombre" type="text" placeholder="Ing. Carlos Pérez" class="val-input">
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Cargo del Contacto</label>
            <input v-model="nuevoCli.contacto_cargo" type="text" placeholder="Jefe de Compras" class="val-input">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div class="field-col" style="margin-bottom:0">
            <label>¿Cómo nos consiguió?</label>
            <select v-model="nuevoCli.como_consiguio" class="val-input">
              <option value="Boca a boca">Boca a boca / Recomendación</option>
              <option value="Redes Sociales">Redes Sociales</option>
              <option value="Valla Publicitaria">Valla Publicitaria</option>
              <option value="Radio">Radio</option>
              <option value="Sin clasificar">Sin clasificar</option>
            </select>
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Canal de Venta</label>
            <select v-model="nuevoCli.canal_venta" class="val-input">
              <option value="Mostrador">Mostrador</option>
              <option value="Instagram">Instagram</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Vendedor de Zona">Vendedor de Zona</option>
            </select>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="mostrarModalNuevo = false">Cancelar</button>
          <button class="btn btn-primary" :disabled="!nuevoCli.nombre" @click="guardarNuevoCliente">
            <i class="ti ti-check"></i> Guardar Cliente
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD } from '../services/pricing.js';

const store = useArjStore();
const busqueda = ref('');
const mostrarModalNuevo = ref(false);

const nuevoCli = ref({
  nombre: '',
  rif: '',
  tel: '',
  nivel: 'T1',
  tipo: 'contado',
  direccion: '',
  contacto_nombre: '',
  contacto_cargo: '',
  como_consiguio: 'Sin clasificar',
  canal_venta: 'Mostrador'
});

const statsCaptacion = computed(() => {
  const total = store.clientes.length;
  if (total === 0) return [];
  const map = {
    'Boca a boca': { count: 0, color: '#3B82F6' },
    'Redes Sociales': { count: 0, color: '#10B981' },
    'Valla Publicitaria': { count: 0, color: '#F59E0B' },
    'Radio': { count: 0, color: '#8B5CF6' },
    'Sin clasificar': { count: 0, color: '#94A3B8' }
  };
  store.clientes.forEach(c => {
    const k = map[c.como_consiguio] ? c.como_consiguio : 'Sin clasificar';
    map[k].count++;
  });
  const arr = [];
  for (const k in map) {
    if (map[k].count > 0) {
      arr.push({ label: k, count: map[k].count, pct: Math.round((map[k].count / total) * 100), color: map[k].color });
    }
  }
  return arr.sort((a,b) => b.count - a.count);
});

const clientesFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase();
  if (!q) return store.clientes;
  return store.clientes.filter(c =>
    (c.nombre || '').toLowerCase().includes(q) ||
    (c.rif || '').toLowerCase().includes(q) ||
    (c.tel || '').toLowerCase().includes(q)
  );
});

function saldoDe(c) {
  return store.empresa === 'directa' ? (c.saldo_vd || 0) : (c.saldo_dist || 0);
}

function facturarA(c) {
  store.seleccionarCliente(c);
  store.cambiarVista('facturacion');
}

function guardarNuevoCliente() {
  if (!nuevoCli.value.nombre) {
    store.notif('Por favor escribe el nombre del cliente', 'warning');
    return;
  }
  const item = {
    id: Date.now(),
    nombre: nuevoCli.value.nombre.toUpperCase(),
    rif: nuevoCli.value.rif.toUpperCase(),
    tel: nuevoCli.value.tel,
    nivel: nuevoCli.value.nivel,
    tipo: nuevoCli.value.tipo,
    direccion: nuevoCli.value.direccion,
    como_consiguio: nuevoCli.value.como_consiguio,
    canal_venta: nuevoCli.value.canal_venta,
    saldo_vd: 0,
    saldo_dist: 0,
    contacto_principal: { 
      nombre: nuevoCli.value.contacto_nombre, 
      cargo: nuevoCli.value.contacto_cargo, 
      tel: nuevoCli.value.tel 
    }
  };
  store.clientes.unshift(item);
  mostrarModalNuevo.value = false;
  store.notif(`Cliente '${item.nombre}' guardado exitosamente`, 'success');
}
</script>
