<template>
  <div class="page active" id="page-bitacora">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="page-title"><i class="ti ti-history"></i> Bitácora de Auditoría y Seguridad</h1>
        <p class="page-sub">Registro inmutable de acciones, modificaciones de precios, emisiones y accesos</p>
      </div>
      <button class="btn btn-secondary" @click="exportarBitacora">
        <i class="ti ti-download"></i> Exportar Registro (JSON)
      </button>
    </div>

    <!-- FILTROS -->
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <input
        v-model="busqueda"
        type="text"
        placeholder="Filtrar por mensaje, usuario o acción..."
        class="val-input"
        style="flex:1;min-width:240px"
      >
      <select v-model="filtroTipo" class="val-input" style="min-width:200px">
        <option value="">Todos los eventos</option>
        <option value="precio">Modificaciones de Precio</option>
        <option value="venta">Emisión de Facturas</option>
        <option value="anulacion">Anulaciones</option>
        <option value="sesion">Accesos y Sesiones</option>
        <option value="inventario">Ajustes de Inventario</option>
      </select>
    </div>

    <!-- LISTADO AUDITORÍA -->
    <div class="card" style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:12%">Hora</th>
            <th style="width:14%">Tipo de Evento</th>
            <th style="width:16%">Usuario Responsable</th>
            <th style="width:12%">Empresa</th>
            <th style="width:46%">Detalle de la Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="bitacoraFiltrada.length === 0">
            <td colspan="5" style="text-align:center;padding:24px;color:var(--dgray)">
              No hay registros de auditoría que coincidan con la búsqueda.
            </td>
          </tr>
          <tr v-for="b in bitacoraFiltrada" :key="b.id">
            <td style="font-family:monospace;font-size:12px;color:var(--dgray)">{{ b.fecha }}</td>
            <td>
              <span :class="['badge', b.esAlerta ? 'badge-danger' : 'badge-info']">
                {{ b.tipo.toUpperCase() }}
              </span>
            </td>
            <td><strong>{{ b.usuario }}</strong></td>
            <td style="font-size:11px">{{ b.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora' }}</td>
            <td :style="{ color: b.esAlerta ? 'var(--red)' : '#333', fontWeight: b.esAlerta ? '600' : 'normal' }">
              {{ b.mensaje }}
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

const store = useArjStore();
const busqueda = ref('');
const filtroTipo = ref('');

const bitacoraFiltrada = computed(() => {
  let list = store.bitacora;
  const q = busqueda.value.trim().toLowerCase();
  if (q) {
    list = list.filter(b =>
      (b.mensaje || '').toLowerCase().includes(q) ||
      (b.usuario || '').toLowerCase().includes(q)
    );
  }
  if (filtroTipo.value) {
    list = list.filter(b => b.tipo === filtroTipo.value);
  }
  return list;
});

function exportarBitacora() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(store.bitacora, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `bitacora_arj_${new Date().toISOString().slice(0,10)}.json`);
  dlAnchor.click();
  store.notif('Bitácora exportada correctamente', 'success');
}
</script>
