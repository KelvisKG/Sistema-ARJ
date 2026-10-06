<template>
  <div v-if="store.modalFacturaActivo && store.facturaReciente" class="modal show" id="modal-factura" style="display:flex">
    <div class="modal-content" style="max-width:850px;text-align:left;padding:24px">
      <!-- CABECERA FACTURA -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:20px">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <i class="ti ti-file-invoice" style="font-size:24px;color:var(--navy)"></i>
          <div>
            <h2 style="font-size:18px;color:var(--navy);margin:0;font-weight:600">
              Factura {{ store.facturaReciente.num }}
            </h2>
            <p style="font-size:12px;color:var(--dgray);margin:4px 0 0">
              {{ store.facturaReciente.fecha }} · {{ store.facturaReciente.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora ARJ' }} - Vendedor: {{ store.facturaReciente.vendedor }}
            </p>
          </div>
        </div>
        <button class="btn-close" style="background:none;border:1px solid var(--navy);color:var(--navy);border-radius:6px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px" @click="cerrarModal">
          <i class="ti ti-x"></i>
        </button>
      </div>

      <!-- DATOS CLIENTE Y CONDICIONES -->
      <div style="display:grid;grid-template-columns:3fr 1fr;gap:16px;margin-bottom:24px">
        <div style="background:#F2F5FA;padding:16px;border-radius:8px;border:1px solid #EAF0F8">
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:600;margin-bottom:6px">Cliente</div>
          <div style="font-size:14px;font-weight:700;color:var(--navy)">{{ store.facturaReciente.cliente_nombre_snap || store.facturaReciente.cliente }}</div>
          <div style="font-size:11.5px;color:var(--dgray);margin-top:4px">RIF: {{ store.facturaReciente.cliente_rif_snap || '—' }} · {{ store.facturaReciente.cliente_dir_snap || '' }}</div>
          <div v-if="store.facturaReciente.estado === 'anulada'" style="margin-top:8px;color:var(--red);font-size:12px"><strong>Anulada:</strong> {{ store.facturaReciente.motivo_anulacion }}</div>
        </div>
        <div style="background:#FBF3E0;padding:16px;border-radius:8px;border:1px solid #F5E6C8;text-align:right;display:flex;flex-direction:column;justify-content:center;align-items:flex-end">
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;font-weight:600;margin-bottom:6px">Estado</div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span :style="`background:${store.facturaReciente.estado === 'anulada' ? 'var(--lred)' : ((store.facturaReciente.estado === 'pagada' || saldoPendiente <= 0) ? '#E8F5E9' : 'var(--lgold)')};color:${store.facturaReciente.estado === 'anulada' ? 'var(--red)' : ((store.facturaReciente.estado === 'pagada' || saldoPendiente <= 0) ? '#1E7B34' : 'var(--gold)')};padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase`">
              {{ store.facturaReciente.estado === 'anulada' ? 'Anulada' : ((store.facturaReciente.estado === 'pagada' || saldoPendiente <= 0) ? 'Pagada' : 'Pendiente') }}
            </span>
            <span style="font-size:12px;color:var(--navy)">{{ (store.facturaReciente.tipo_pago || 'contado').charAt(0).toUpperCase() + (store.facturaReciente.tipo_pago || 'contado').slice(1) }}</span>
          </div>
        </div>
      </div>

      <!-- TABLA DE PRODUCTOS FACTURADOS -->
      <div style="margin-bottom:24px">
        <h3 style="font-size:14px;color:var(--navy);margin-bottom:12px;display:flex;align-items:center;gap:6px"><i class="ti ti-list"></i> Productos</h3>
        <table class="tbl" style="width:100%;font-size:12px">
          <thead>
            <tr style="background:#F2F5FA;color:var(--navy)">
              <th style="width:5%" class="center">#</th>
              <th style="width:15%;text-align:left">CÓDIGO</th>
              <th style="width:40%;text-align:left">DESCRIPCIÓN</th>
              <th class="center" style="width:10%">CANT.</th>
              <th class="num" style="width:15%">P.UNIT</th>
              <th class="num" style="width:15%">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(it, idx) in store.facturaReciente.items" :key="it.id" style="border-bottom:1px solid #EEE">
              <td class="center" style="color:var(--dgray)">{{ idx + 1 }}</td>
              <td style="font-weight:700;font-family:monospace;font-size:11px">{{ it.cod_alt }}</td>
              <td>{{ it.desc }}</td>
              <td class="center">{{ it.cant }}</td>
              <td class="num">{{ fmtUSD(it.precio) }}</td>
              <td class="num" style="font-weight:700">{{ fmtUSD(it.cant * it.precio) }}</td>
            </tr>
            <tr v-if="cargandoDetalles">
              <td colspan="6" class="center" style="padding:20px;color:var(--navy)"><i class="ti ti-loader"></i> Cargando productos...</td>
            </tr>
            <tr v-else-if="!store.facturaReciente.items || store.facturaReciente.items.length === 0">
              <td colspan="6" class="center" style="padding:20px;color:var(--dgray)">No hay productos registrados en esta factura.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:24px">
        <!-- IZQUIERDA: HISTORIAL DE PAGOS -->
        <div>
          <h3 style="font-size:14px;color:var(--navy);margin-bottom:12px;display:flex;align-items:center;gap:6px"><i class="ti ti-cash"></i> Historial de pagos</h3>
          <table class="tbl" style="width:100%;font-size:11.5px">
            <thead>
              <tr style="background:#F2F5FA;color:var(--navy)">
                <th style="text-align:left;padding:8px">FECHA</th>
                <th style="text-align:left;padding:8px">MÉTODO</th>
                <th style="text-align:left;padding:8px">REF.</th>
                <th style="text-align:right;padding:8px">RECIBIDO</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(pago, idx) in store.facturaReciente.pagos" :key="idx" style="border-bottom:1px solid #EEE">
                <td style="padding:8px">{{ pago.fecha ? new Date(pago.fecha).toLocaleDateString('es-VE') : store.facturaReciente.fecha }}</td>
                <td style="padding:8px">{{ pago.metodo }}</td>
                <td style="padding:8px">{{ pago.referencia || pago.ref || '—' }}</td>
                <td style="text-align:right;padding:8px;font-weight:600">
                  {{ /USD|Zelle/i.test(pago.metodo || '') ? fmtUSD(pago.monto_usd) : fmtBsMonto(pago.monto_bs) }}
                  <div v-if="pago.notas" style="font-size:9px;color:var(--dgray);font-weight:400;margin-top:2px">{{ pago.notas }}</div>
                </td>
              </tr>
              <tr v-if="cargandoDetalles">
                <td colspan="4" class="center" style="padding:16px;color:var(--navy)"><i class="ti ti-loader"></i> Cargando pagos...</td>
              </tr>
              <tr v-else-if="!store.facturaReciente.pagos || store.facturaReciente.pagos.length === 0">
                <td colspan="4" class="center" style="padding:16px;color:var(--dgray)">No se han registrado pagos.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- DERECHA: TOTALES Y TASAS -->
        <div>
          <!-- CAJA AZUL OSCURO: TOTALES -->
          <div style="background:var(--navy);color:#FFF;border-radius:8px;padding:16px;margin-bottom:12px;font-size:13px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span>Subtotal:</span>
              <span style="font-weight:600">{{ fmtUSD(store.facturaReciente.total) }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.2)">
              <span>IVA (exento):</span>
              <span style="font-weight:600">$0.00</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="font-size:20px;font-weight:800">TOTAL:</span>
              <span style="font-size:20px;font-weight:800">{{ fmtUSD(store.facturaReciente.total) }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="color:rgba(255,255,255,0.7)">Abonado:</span>
              <span style="font-weight:600">{{ fmtUSD(totalAbonado) }}</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:rgba(255,255,255,0.7)">Saldo pendiente:</span>
              <span style="font-weight:600">{{ fmtUSD(saldoPendiente) }}</span>
            </div>
          </div>

          <!-- CAJA AMARILLA: FORMA DE PAGO -->
          <div style="background:#FBF3E0;border:1px solid #F5E6C8;border-radius:8px;padding:12px;margin-bottom:12px;font-size:12px">
            <div style="font-size:10px;color:var(--dgray);font-weight:700;margin-bottom:8px">FORMA DE PAGO Y DESCUENTOS</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="display:flex;align-items:center;gap:6px"><i class="ti ti-cash" style="color:var(--gold)"></i> Abonado ():</span>
              <span style="font-weight:700">{{ fmtUSD(totalAbonado) }}</span>
            </div>
            <div v-if="store.facturaReciente.descuento_manual > 0" style="margin-top:6px;color:var(--red)">
              Descuentos: <strong>{{ fmtUSD(store.facturaReciente.descuento_manual) }}</strong>
              <div style="font-size:10.5px;color:var(--dgray)">{{ store.facturaReciente.motivo_descuento }}</div>
            </div>
          </div>

          <!-- CAJA GRIS: TASAS CONGELADAS -->
          <div style="background:#F8FAFC;border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px;font-size:11.5px;color:var(--dgray)">
            <div style="font-size:10px;font-weight:700;margin-bottom:8px">TASAS CONGELADAS · INTERNO</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span>BCV al emitir</span>
              <span style="font-weight:600;color:var(--navy)">Bs. {{ (store.facturaReciente.tasa_bcv || 0).toFixed(2) }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span>Paralelo al emitir</span>
              <span style="font-weight:600;color:var(--navy)">Bs. {{ (store.facturaReciente.tasa_par || 0).toFixed(2) }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)">
              <span>Brecha de ese día</span>
              <span style="font-weight:600;color:var(--navy)">{{ brecha }}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:12px">
              <span>Total en Bs (a BCV congelado)</span>
              <span style="font-weight:700;color:var(--navy)">{{ fmtBsMonto((store.facturaReciente.total || 0) * (store.facturaReciente.factor_bs || 1) * (store.facturaReciente.tasa_bcv || 0)) }}</span>
            </div>
            <div style="font-size:9.5px;line-height:1.4">
              El total está en $BCV. En efectivo valía <strong>{{ fmtUSD(valorEfectivo) }}</strong> ese día — por eso un pago menor puede dejar la factura en cero.
            </div>
          </div>

          <!-- BOTONES DE ACCION -->
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-secondary" style="width:100%;justify-content:center;background:#FFF;border:1px solid var(--navy);color:var(--navy)" @click="imprimirPDF">
              <i class="ti ti-printer"></i> Reimprimir
            </button>
            <button class="btn btn-secondary" style="width:100%;justify-content:center;background:#FFF;border:1px solid var(--red);color:var(--red)" @click="anularFactura" v-if="store.facturaReciente.estado !== 'anulada' && store.rol === 'gerente'">
              <i class="ti ti-ban"></i> Anular factura
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD } from '../../services/pricing.js';
import { generarFacturaPDF } from '../../services/exportService.js';
import { cargarDetallesFactura } from '../../services/supabase.js';

const store = useArjStore();
const cargandoDetalles = ref(false);

function fmtBsMonto(n) {
  return 'Bs. ' + (Number(n) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Renglones y pagos se traen de la BD cuando la factura viene del historial
watch(() => store.facturaReciente, async (f) => {
  if (!f || !store.modalFacturaActivo) return;
  const tieneItems = Array.isArray(f.items) && f.items.length > 0;
  const tienePagos = Array.isArray(f.pagos) && f.pagos.length > 0 && f.pagos[0].fecha;
  if (!tieneItems || !tienePagos) {
    cargandoDetalles.value = true;
    const det = await cargarDetallesFactura(f.id);
    if (det.items && det.items.length) f.items = det.items;
    if (det.pagos) f.pagos = det.pagos;
    cargandoDetalles.value = false;
  }
}, { immediate: true });

// Saldo y abonado salen de la factura (en $BCV), no de sumar pagos: un pago en
// efectivo entrega menos dólares de los que acredita (v13.33)
const totalAbonado = computed(() => store.facturaReciente ? (store.facturaReciente.abonado || 0) : 0);
const saldoPendiente = computed(() => store.facturaReciente ? (store.facturaReciente.saldo_pendiente || 0) : 0);

const brecha = computed(() => {
  const f = store.facturaReciente;
  if (!f || !(f.tasa_bcv > 0)) return '0.00';
  return (((f.tasa_par - f.tasa_bcv) / f.tasa_bcv) * 100).toFixed(2);
});

const valorEfectivo = computed(() => {
  const f = store.facturaReciente;
  if (!f) return 0;
  if (f.cobrar_verde > 0) return f.cobrar_verde;
  return f.tasa_par > 0 ? (f.total * f.tasa_bcv) / f.tasa_par : f.total;
});

function cerrarModal() {
  store.modalFacturaActivo = false;
  store.facturaReciente = null;
}

async function imprimirPDF() {
  const f = store.facturaReciente;
  if (!f.items || !f.items.length) {
    const det = await cargarDetallesFactura(f.id);
    if (det.items) f.items = det.items;
  }
  // A-04: el PDF usa la empresa, la tasa y los datos del cliente CONGELADOS en la factura
  generarFacturaPDF(f, 'print');
}

function anularFactura() {
  store.facturaAAnular = store.facturaReciente;
  store.modalAnularActivo = true;
}
</script>
