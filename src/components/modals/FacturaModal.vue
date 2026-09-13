<template>
  <div v-if="store.modalFacturaActivo && store.facturaReciente" class="modal show" id="modal-factura" style="display:flex">
    <div class="modal-content" style="max-width:680px;text-align:left">
      <!-- CABECERA FACTURA -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--navy);padding-bottom:12px;margin-bottom:14px">
        <div>
          <h2 style="font-size:20px;color:var(--navy);margin:0">
            {{ store.facturaReciente.empresa === 'directa' ? 'ARJ VENTA DIRECTA' : 'DISTRIBUIDORA ARJ C.A.' }}
          </h2>
          <p style="font-size:12px;color:var(--dgray);margin:4px 0 0">
            Repuestos Agrícolas y Maquinaria Pesada · Acarigua, Portuguesa
          </p>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:800;color:var(--navy)">
            FACTURA N° {{ store.facturaReciente.num }}
          </div>
          <div style="font-size:12px;color:var(--dgray)">
            Fecha: {{ store.facturaReciente.fecha }}
          </div>
        </div>
      </div>

      <!-- DATOS CLIENTE Y CONDICIONES -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;background:#F8FAFC;padding:10px;border-radius:6px;font-size:12px">
        <div>
          <strong>Cliente:</strong> {{ store.facturaReciente.cliente }}<br>
          <strong>Vendedor:</strong> {{ store.facturaReciente.vendedor }}
        </div>
        <div>
          <strong>Condición:</strong> {{ store.facturaReciente.tipo_pago.toUpperCase() }}<br>
          <span v-if="store.facturaReciente.tipo_pago === 'credito'">
            <strong>Vencimiento:</strong> {{ store.facturaReciente.vence }}
          </span>
        </div>
      </div>

      <!-- TABLA DE PRODUCTOS FACTURADOS -->
      <table class="tbl" style="margin-bottom:14px">
        <thead>
          <tr>
            <th style="width:16%">Código</th>
            <th style="width:44%">Descripción</th>
            <th class="num" style="width:10%">Cant</th>
            <th class="num" style="width:15%">Precio</th>
            <th class="num" style="width:15%">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="it in store.facturaReciente.items" :key="it.id">
            <td><strong>{{ it.cod_alt }}</strong></td>
            <td>{{ it.desc }}</td>
            <td class="num">{{ it.cant }}</td>
            <td class="num">{{ fmtUSD(it.precio) }}</td>
            <td class="num" style="font-weight:700">{{ fmtUSD(it.cant * it.precio) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- TOTALES -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <div style="width:280px;font-size:13px">
          <div style="display:flex;justify-content:space-between;padding:4px 0">
            <span>Subtotal:</span>
            <strong>{{ fmtUSD(store.facturaReciente.total) }}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #CCC">
            <span>IVA (Exento Ley Agrícola):</span>
            <strong>$0.00</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:16px;font-weight:800;color:var(--navy)">
            <span>Total USD:</span>
            <span>{{ fmtUSD(store.facturaReciente.total) }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:var(--dgray)">
            <span>Total en Bs (Tasa BCV {{ store.facturaReciente.tasa_bcv }}):</span>
            <span>{{ fmtBs(store.facturaReciente.total, store.facturaReciente.tasa_bcv) }}</span>
          </div>
        </div>
      </div>

      <!-- ACCIONES DEL MODAL -->
      <div class="actions" style="display:flex;justify-content:flex-end;gap:10px">
        <button class="btn btn-secondary" @click="cerrarModal">
          <i class="ti ti-x"></i> Cerrar
        </button>
        <button class="btn btn-primary" @click="descargarPDF">
          <i class="ti ti-file-type-pdf"></i> Descargar PDF
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD, fmtBs } from '../../services/pricing.js';
import { generarFacturaPDF } from '../../services/exportService.js';

const store = useArjStore();

function cerrarModal() {
  store.modalFacturaActivo = false;
  store.facturaReciente = null;
}

function descargarPDF() {
  generarFacturaPDF(store.facturaReciente, store.empresa);
  store.notif('Factura PDF generada y descargada', 'success');
}
</script>
