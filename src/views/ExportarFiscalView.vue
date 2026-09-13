<template>
  <div class="page active" id="page-exportar">
    <h1 class="page-title"><i class="ti ti-file-export"></i> Exportación Fiscal (Libro de Ventas)</h1>
    <p class="page-sub">Generación de archivos Excel normalizados para declaración tributaria y contabilidad</p>

    <div class="help-box">
      <i class="ti ti-info-circle"></i>
      <div>
        <strong>Normativa Tributaria:</strong> Los repuestos y partes agrícolas se asientan como ventas <strong>exentas</strong> según la Ley de Impuesto al Valor Agregado venezolana para el sector primario y agropecuario.
      </div>
    </div>

    <div class="card" style="max-width:700px;margin-bottom:16px">
      <div class="card-tit"><i class="ti ti-filter"></i> Parámetros de Generación</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:12px">
        <div class="field-col">
          <label>Empresa:</label>
          <select v-model="empresaSel" class="val-input">
            <option value="directa">ARJ Venta Directa</option>
            <option value="distribuidora">Distribuidora ARJ C.A.</option>
            <option value="todas">Ambas Empresas</option>
          </select>
        </div>
        <div class="field-col">
          <label>Mes:</label>
          <select v-model="mesSel" class="val-input">
            <option value="01">Enero</option>
            <option value="02">Febrero</option>
            <option value="03">Marzo</option>
            <option value="04">Abril</option>
            <option value="05">Mayo</option>
            <option value="06">Junio</option>
            <option value="07">Julio</option>
            <option value="08">Agosto</option>
            <option value="09" selected>Septiembre</option>
            <option value="10">Octubre</option>
            <option value="11">Noviembre</option>
            <option value="12">Diciembre</option>
          </select>
        </div>
        <div class="field-col">
          <label>Año:</label>
          <select v-model="anoSel" class="val-input">
            <option value="2026" selected>2026</option>
            <option value="2025">2025</option>
          </select>
        </div>
      </div>

      <div style="margin-top:16px;display:flex;justify-content:flex-end">
        <button class="btn btn-primary" @click="descargarExcel">
          <i class="ti ti-file-spreadsheet"></i> Descargar Libro de Ventas (.xlsx)
        </button>
      </div>
    </div>

    <!-- VISTA PREVIA FISCAL -->
    <div class="card" style="overflow-x:auto">
      <div class="card-tit"><i class="ti ti-table"></i> Vista Previa de Documentos a Declarar ({{ facturasFiscales.length }})</div>
      <table class="tbl" style="margin-top:10px">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>N° Factura</th>
            <th>Cliente / Razón Social</th>
            <th>RIF</th>
            <th class="num">Ventas Exentas ($)</th>
            <th class="num">Tasa BCV</th>
            <th class="num">Ventas Exentas (Bs)</th>
            <th class="center">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="facturasFiscales.length === 0">
            <td colspan="8" style="text-align:center;padding:24px;color:var(--dgray)">
              No hay facturas emitidas para el período seleccionado.
            </td>
          </tr>
          <tr v-for="f in facturasFiscales" :key="f.id">
            <td style="font-size:12px">{{ f.fecha }}</td>
            <td><strong>{{ f.num }}</strong></td>
            <td>{{ f.cliente }}</td>
            <td style="font-family:monospace;font-size:12px">{{ f.rif || 'J-V-EXENTO' }}</td>
            <td class="num">{{ fmtUSD(f.total) }}</td>
            <td class="num">{{ f.tasa_bcv }}</td>
            <td class="num" style="font-weight:700">{{ fmtBs(f.total, f.tasa_bcv) }}</td>
            <td class="center"><span class="badge badge-success">VÁLIDA</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD, fmtBs } from '../services/pricing.js';
import { exportarLibroVentasExcel } from '../services/exportService.js';

const store = useArjStore();
const empresaSel = ref('directa');
const mesSel = ref('09');
const anoSel = ref('2026');

const facturasFiscales = computed(() => {
  return store.todasFacturas.filter(f => {
    if (f.estado === 'anulada') return false;
    if (empresaSel.value !== 'todas' && f.empresa !== empresaSel.value) return false;
    return true;
  });
});

function descargarExcel() {
  if (facturasFiscales.value.length === 0) {
    store.notif('No hay facturas para exportar en este período', 'warning');
    return;
  }
  exportarLibroVentasExcel(facturasFiscales.value, empresaSel.value, mesSel.value, anoSel.value);
  store.notif('Libro de ventas fiscal exportado en formato Excel (.xlsx)', 'success');
}
</script>
