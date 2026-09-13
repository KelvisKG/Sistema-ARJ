<template>
  <div v-if="store.modalListaPreciosActivo" class="modal show" id="modal-lista-precios" style="display:flex">
    <div class="modal-content" style="max-width:580px;text-align:left">
      <div class="modal-icon" style="background:#E8F5E9;color:var(--green)">
        <i class="ti ti-download"></i>
      </div>
      <h2>Exportar Lista de Precios de Repuestos</h2>
      <p class="modal-sub">
        Genera y descarga un archivo CSV con los precios vigentes según el nivel de cliente y la tasa oficial del día.
      </p>

      <div class="field-col" style="margin-bottom:14px">
        <label>Nivel de Precio a Exportar:</label>
        <select v-model="tierSel" class="val-input">
          <option value="Publico">PVP Público General (Mostrador)</option>
          <option value="T1">Aliado Comercial T1 (–5%)</option>
          <option value="T2">Aliado Comercial T2 (–10%)</option>
          <option value="T3">Mayorista / Distribuidor T3 (–20%)</option>
        </select>
      </div>

      <div class="field-col" style="margin-bottom:16px">
        <label>Filtrar por Sistema Mecánico:</label>
        <select v-model="sistemaSel" class="val-input">
          <option value="">Todos los repuestos (Catálogo completo)</option>
          <option value="Motor">Motor</option>
          <option value="Sistema de enfriamiento">Sistema de enfriamiento</option>
          <option value="Embrague">Embrague</option>
          <option value="Filtros">Filtros</option>
          <option value="Eléctrico">Eléctrico</option>
          <option value="Inyección Diésel">Inyección Diésel</option>
          <option value="Hidráulico">Hidráulico</option>
          <option value="Frenos">Frenos</option>
        </select>
      </div>

      <div style="background:var(--bg);border:1px solid var(--border);padding:12px 14px;border-radius:8px;font-size:12.5px;margin-bottom:16px;color:var(--text)">
        Total de repuestos a exportar: <strong style="color:var(--primary)">{{ prodsAExportar.length }}</strong>
        <br>Calculados a tasa BCV oficial: <strong>Bs. {{ store.tasa_bcv }}</strong>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" @click="store.modalListaPreciosActivo = false">Cancelar</button>
        <button class="btn btn-primary" @click="descargarExcel">
          <i class="ti ti-file-spreadsheet"></i> Descargar Excel (.xlsx)
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { precioConTier } from '../../services/pricing.js';
import { exportarListaPreciosExcel } from '../../services/exportService.js';

const store = useArjStore();
const tierSel = ref('Publico');
const sistemaSel = ref('');

const prodsAExportar = computed(() => {
  if (!sistemaSel.value) return store.productos;
  return store.productos.filter(p => p.sistema === sistemaSel.value);
});

function descargarExcel() {
  exportarListaPreciosExcel(prodsAExportar.value, tierSel.value, store.tasa_bcv, sistemaSel.value);
  store.modalListaPreciosActivo = false;
  store.notif('Lista de precios generada en Excel (.xlsx)', 'success');
}
</script>
