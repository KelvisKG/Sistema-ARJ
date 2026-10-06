<template>
  <div v-if="store.modalListaPreciosActivo" class="modal show" id="modal-lista-precios" style="display:flex">
    <div class="modal-content" style="max-width:580px;text-align:left">
      <div class="modal-icon" style="background:#E8F5E9;color:var(--green)">
        <i class="ti ti-download"></i>
      </div>
      <h2>Exportar Lista de Precios de Repuestos</h2>
      <p class="modal-sub">
        Genera un Excel con los precios vigentes según el nivel de cliente y la tasa BCV del día.
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
          <option value="">Todos los sistemas</option>
          <option v-for="s in sistemas" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <div style="background:var(--bg);border:1px solid var(--border);padding:12px 14px;border-radius:8px;font-size:12.5px;margin-bottom:16px;color:var(--text)">
        Repuestos a exportar: <strong style="color:var(--primary)">{{ prodsAExportar.length }}</strong>
        <br>Calculados a tasa BCV: <strong>Bs. {{ store.tasa_bcv }}</strong>
        <div v-if="excluidos.total > 0" style="margin-top:8px;font-size:11.5px;color:var(--dgray)">
          No se incluyen {{ excluidos.total }} productos:
          {{ excluidos.sinEmbarque }} sin embarque sellado (costo estimado) ·
          {{ excluidos.sinStock }} sin existencia ·
          {{ excluidos.sinPrecio }} sin precio calculable.
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" @click="store.modalListaPreciosActivo = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="prodsAExportar.length === 0 || !store.tasasCargadas" @click="descargarExcel">
          <i class="ti ti-file-spreadsheet"></i> Descargar Excel (.xlsx)
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { exportarListaPreciosExcel } from '../../services/exportLazy.js';

const store = useArjStore();
const tierSel = ref('Publico');
const sistemaSel = ref('');

const sistemas = computed(() => {
  const set = new Set(store.sistemas || []);
  store.productos.forEach(p => { if (p.sistema) set.add(p.sistema); });
  return [...set].sort();
});

// A-13: elegibilidad del monolito v13.12 (decisión de JJ, 22-ago-2026):
// embarque sellado + existencia en alguna empresa + precio calculable
function motivoExclusion(p) {
  if (!p.embarque_id) return 'sinEmbarque';
  if ((parseInt(p.stock_vd) || 0) + (parseInt(p.stock_dist) || 0) <= 0) return 'sinStock';
  if (!(p.fob > 0) && !(p.precio_manual > 0)) return 'sinPrecio';
  return null;
}

const candidatos = computed(() => (sistemaSel.value ? store.productos.filter(p => p.sistema === sistemaSel.value) : store.productos));
const prodsAExportar = computed(() => candidatos.value.filter(p => !motivoExclusion(p)));
const excluidos = computed(() => {
  const r = { sinEmbarque: 0, sinStock: 0, sinPrecio: 0, total: 0 };
  candidatos.value.forEach(p => { const m = motivoExclusion(p); if (m) { r[m]++; r.total++; } });
  return r;
});

function descargarExcel() {
  exportarListaPreciosExcel(prodsAExportar.value, tierSel.value, store.tasa_bcv, sistemaSel.value);
  store.modalListaPreciosActivo = false;
  store.notif(`Lista de precios generada (${prodsAExportar.value.length} productos)`, 'success');
}
</script>
