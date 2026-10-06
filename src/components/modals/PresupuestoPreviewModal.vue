<template>
  <div v-if="store.modalPresupuestoActivo && store.presupuestoSeleccionado" class="modal show" id="modal-presupuesto-preview" style="display:flex">
    <div class="modal-content" style="max-width:850px;text-align:left;padding:0;overflow:hidden">

      <!-- BARRA SUPERIOR NAVY: Título + Acciones -->
      <div style="background:var(--navy);color:#FFF;padding:12px 20px;display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:8px">
          <i class="ti ti-file-text" style="font-size:18px"></i>
          <span style="font-weight:700;font-size:14px">Presupuesto: {{ pre.num }}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-sm" style="background:transparent;border:1px solid rgba(255,255,255,0.5);color:#FFF;padding:5px 12px;font-size:12px;cursor:pointer;border-radius:6px" @click="cerrarModal">
            <i class="ti ti-x"></i> Cerrar
          </button>
          <button class="btn btn-sm" style="background:#D97706;border:none;color:#FFF;padding:5px 12px;font-size:12px;cursor:pointer;border-radius:6px;font-weight:600" @click="imprimirPDF">
            <i class="ti ti-printer"></i> Imprimir
          </button>
        </div>
      </div>

      <!-- CONTENIDO DOCUMENTO -->
      <div style="padding:24px">

        <!-- CABECERA EMPRESA -->
        <div style="background:var(--navy);border-radius:10px;padding:18px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="color:#FFF;font-size:17px;font-weight:800;letter-spacing:-0.01em">AGRO REPUESTOS Y SERVICIOS JIMENEZ, FP</div>
            <div style="color:rgba(200,210,225,0.9);font-size:11px;margin-top:4px;line-height:1.5">
              Carretera Nacional Vía La Misión, Barrio Altamira, Local 31<br>
              Acarigua — Portuguesa · Teléfonos: 0255-6642208 · 0414-5750174 · RIF V-162930024
            </div>
          </div>
          <!-- Badge Presupuesto -->
          <div style="background:#D97706;border-radius:8px;padding:10px 18px;text-align:center;min-width:150px;flex-shrink:0">
            <div style="color:#FFF;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Presupuesto</div>
            <div style="color:#FFF;font-size:15px;font-weight:800;margin-top:2px">{{ pre.num }}</div>
            <div style="color:rgba(255,255,255,0.85);font-size:10.5px;margin-top:2px">{{ pre.fecha }}</div>
          </div>
        </div>

        <!-- BLOQUES CLIENTE + INFORMACIÓN -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
          <!-- CLIENTE -->
          <div style="border:1px solid var(--border);border-radius:8px;padding:14px 16px">
            <div style="font-size:10px;color:var(--blue);font-weight:700;text-transform:uppercase;margin-bottom:6px">Cliente</div>
            <div style="font-size:15px;font-weight:800;color:var(--navy);margin-bottom:6px">{{ pre.cliente }}</div>
            <div style="font-size:11.5px;color:var(--dgray);line-height:1.7">
              RIF: {{ clienteInfo.rif || '—' }}<br>
              Dirección: {{ clienteInfo.direccion || '—' }}<br>
              Teléfono: {{ clienteInfo.tel || '—' }}
            </div>
          </div>
          <!-- INFORMACIÓN -->
          <div style="border:1px solid var(--border);border-radius:8px;padding:14px 16px">
            <div style="font-size:10px;color:var(--blue);font-weight:700;text-transform:uppercase;margin-bottom:6px">Información</div>
            <div style="font-size:11.5px;color:var(--dgray);line-height:1.9">
              <span>Vendedor: <strong style="color:var(--navy)">{{ pre.vendedor || '—' }}</strong></span><br>
              Fecha de emisión: <strong style="color:var(--navy)">{{ pre.fecha }}</strong><br>
              Válida hasta: <strong style="color:var(--navy)">{{ pre.vence }}</strong><br>
              Empresa: <strong style="color:var(--navy)">{{ pre.empresa === 'distribuidora' ? 'Distribuidora' : 'Venta Directa' }}</strong>
            </div>
          </div>
        </div>

        <!-- TABLA DE ÍTEMS -->
        <div style="margin-bottom:16px;overflow-x:auto">
          <table class="tbl" style="width:100%;font-size:12px">
            <thead>
              <tr style="background:var(--navy);color:#FFF">
                <th style="width:5%;text-align:center;padding:8px 6px">#</th>
                <th style="width:14%;text-align:left;padding:8px 6px">Código</th>
                <th style="text-align:left;padding:8px 6px">Descripción</th>
                <th style="width:8%;text-align:center;padding:8px 6px">Cant.</th>
                <th style="width:13%;text-align:right;padding:8px 6px">P. Unit USD</th>
                <th style="width:13%;text-align:right;padding:8px 6px">Total USD</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(it, idx) in pre.items" :key="idx" :style="idx % 2 === 1 ? 'background:#F8FAFC' : ''">
                <td style="text-align:center;padding:7px 6px;color:var(--dgray);font-weight:700">{{ idx + 1 }}</td>
                <td style="font-weight:700;font-family:monospace;font-size:11px;color:var(--navy);padding:7px 6px">{{ it.cod_alt }}</td>
                <td style="padding:7px 6px">{{ it.desc }}</td>
                <td style="text-align:center;padding:7px 6px;color:var(--blue);font-weight:700">{{ it.cant }}</td>
                <td style="text-align:right;padding:7px 6px">{{ fmtUSD(it.precio) }}</td>
                <td style="text-align:right;padding:7px 6px;font-weight:700">{{ fmtUSD(it.cant * it.precio) }}</td>
              </tr>
              <tr v-if="!pre.items || pre.items.length === 0">
                <td colspan="6" style="text-align:center;padding:20px;color:var(--dgray)">No hay ítems en este presupuesto.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- NOTA FISCAL + TOTALES -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">
          <!-- Izquierda: Nota fiscal y Bs -->
          <div>
            <div style="font-size:11px;color:var(--blue);font-style:italic;margin-bottom:12px">
              Exento de IVA según Decreto 126, Artículo 63, Numeral 02
            </div>
            <div style="background:#F8FAFC;border:1px solid var(--border);border-radius:6px;padding:10px 14px;font-size:11.5px;color:var(--dgray)">
              <strong>Cobrar en Bs.:</strong> Bs. {{ totalBsFormateado }} (a tasa de hoy)
            </div>
          </div>

          <!-- Derecha: Totales -->
          <div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12.5px;color:var(--dgray)">
              <span>Subtotal</span>
              <span style="font-weight:600;color:var(--text)">{{ fmtUSD(pre.total) }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12.5px;color:var(--dgray)">
              <span>Descuento</span>
              <span style="font-weight:600;color:var(--text)">$0,00</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12.5px;color:var(--dgray);margin-bottom:10px">
              <span>IVA (exento)</span>
              <span style="font-weight:600;color:var(--text)">$0,00</span>
            </div>
            <!-- TOTAL USD -->
            <div style="background:#D97706;border-radius:8px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
              <span style="color:#FFF;font-weight:700;font-size:14px">TOTAL USD</span>
              <span style="color:#FFF;font-weight:800;font-size:20px">{{ fmtUSD(pre.total) }}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD } from '../../services/pricing.js';
import { generarPresupuestoPDF } from '../../services/exportLazy.js';

const store = useArjStore();

const pre = computed(() => store.presupuestoSeleccionado || {});

const clienteInfo = computed(() => {
  if (!pre.value) return {};
  // Buscar por ID primero, si no, por nombre
  let cli = null;
  if (pre.value.cliente_id) {
    cli = store.clientes.find(c => c.id === pre.value.cliente_id);
  }
  if (!cli && pre.value.cliente) {
    cli = store.clientes.find(c => c.nombre === pre.value.cliente);
  }
  return cli || {};
});

const totalBsFormateado = computed(() => {
  const total = pre.value.total || 0;
  const tasa = store.tasa_bcv || 1;
  return (total * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});

function cerrarModal() {
  store.modalPresupuestoActivo = false;
  store.presupuestoSeleccionado = null;
}

function imprimirPDF() {
  const cli = clienteInfo.value;
  // Pasar datos del cliente con campos normalizados para el PDF
  const clienteData = {
    rif: cli.rif || '',
    direccion: cli.direccion || '',
    telefono: cli.tel || ''
  };
  generarPresupuestoPDF(pre.value, store.tasa_bcv, clienteData);
  store.notif(`PDF de cotización ${pre.value.num} generado`, 'success');
}
</script>
