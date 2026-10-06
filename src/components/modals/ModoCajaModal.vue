<template>
  <div v-if="store.modoCajaActivo" class="modal show" id="modal-modo-caja" style="display:flex;padding:0;background:rgba(15,23,42,0.75);backdrop-filter:blur(8px);z-index:99999">
    <div style="width:100%;height:100%;background:var(--bg);display:flex;flex-direction:column;color:var(--text)">
      <!-- HEADER MODO CAJA -->
      <div style="background:linear-gradient(135deg, var(--navy) 0%, #1e293b 100%);color:#FFF;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;box-shadow:var(--shadow-sm)">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:42px;height:42px;border-radius:10px;background:rgba(217,119,6,0.15);display:flex;align-items:center;justify-content:center;border:1px solid rgba(217,119,6,0.3)">
            <i class="ti ti-cash-register" style="font-size:24px;color:var(--gold)"></i>
          </div>
          <div>
            <h2 style="margin:0;font-size:18px;font-weight:700;color:#FFF;letter-spacing:-0.01em">Punto de Venta Rápido (Modo Caja)</h2>
            <span style="font-size:12px;color:rgba(255,255,255,0.75)">{{ store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora ARJ' }} · Cajero: <strong style="color:var(--gold)">{{ store.usuarioNombre }}</strong></span>
          </div>
        </div>
        <button class="btn btn-secondary" style="color:#FFF;background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2)" @click="store.modoCajaActivo = false">
          <i class="ti ti-x"></i> Salir de Modo Caja
        </button>
      </div>

      <!-- CUERPO PRINCIPAL MODO CAJA -->
      <div style="display:grid;grid-template-columns:1fr 420px;flex:1;overflow:hidden">
        <!-- GRILLA DE REPUESTOS FRECUENTES -->
        <div style="padding:20px;overflow-y:auto">
          <div style="margin-bottom:16px">
            <div style="position:relative">
              <i class="ti ti-search" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:18px;color:var(--text-muted)"></i>
              <input
                v-model="busquedaCaja"
                type="text"
                placeholder="Buscar rápido por código o nombre de repuesto..."
                class="val-input"
                style="width:100%;padding:12px 16px 12px 42px;font-size:15px;border-radius:10px"
              >
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px">
            <div
              v-for="p in repuestosFiltrados"
              :key="p.id"
              class="card"
              style="margin:0;padding:14px;border:1px solid var(--border);border-radius:12px;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;background:var(--card-bg);transition:all 0.15s ease;box-shadow:var(--shadow-xs)"
              @click="store.agregarAlCarrito(p, 1)"
            >
              <div>
                <strong style="color:var(--primary);font-size:13px;font-weight:700">{{ p.cod_alt }}</strong>
                <div style="font-size:12px;color:var(--text-muted);margin-top:6px;height:34px;overflow:hidden;line-height:1.4">{{ p.desc }}</div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:8px;border-top:1px solid var(--border)">
                <span style="font-size:16px;font-weight:800;color:var(--green)">{{ fmtUSD(precioConTier(p.fob, store.carrito.tier, p)) }}</span>
                <span class="badge badge-info" style="font-size:11px">Stock: {{ stockDe(p) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- TICKET Y COBRO -->
        <div style="background:var(--card-bg);border-left:1px solid var(--border);display:flex;flex-direction:column;justify-content:space-between;padding:20px;box-shadow:var(--shadow-md)">
          <div style="display:flex;flex-direction:column;flex:1;overflow:hidden">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:12px">
              <div style="display:flex;align-items:center;gap:8px">
                <i class="ti ti-receipt" style="font-size:18px;color:var(--primary)"></i>
                <strong style="font-size:15px;font-weight:700">Ticket de Venta</strong>
              </div>
              <button class="btn btn-secondary btn-sm" @click="store.limpiarCarrito">
                <i class="ti ti-trash"></i> Limpiar
              </button>
            </div>

            <!-- LISTA ÍTEMS -->
            <div style="flex:1;overflow-y:auto;margin:12px 0;padding-right:4px">
              <div v-if="store.carrito.items.length === 0" style="text-align:center;padding:40px 15px;color:var(--text-muted)">
                <i class="ti ti-shopping-cart" style="font-size:36px;opacity:0.4;display:block;margin-bottom:8px"></i>
                Toca cualquier producto del catálogo para añadir al ticket
              </div>
              <div
                v-for="(it, idx) in store.carrito.items"
                :key="idx"
                style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border);font-size:13px"
              >
                <div>
                  <span class="badge badge-info" style="margin-right:4px;font-size:10px">{{ it.cant }}x</span>
                  <strong>{{ it.cod_alt }}</strong>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <strong style="color:var(--green)">{{ fmtUSD(it.cant * it.precio) }}</strong>
                  <button class="btn btn-danger btn-sm" style="padding:2px 6px;line-height:1;border-radius:4px" @click="store.removerDelCarrito(idx)">&times;</button>
                </div>
              </div>
            </div>
          </div>

          <!-- TOTALES Y COBRO -->
          <div style="border-top:1px solid var(--border);padding-top:16px;background:var(--card-bg)">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;margin-bottom:6px">
              <span style="color:var(--text-muted)">Total a Pagar (USD):</span>
              <strong style="font-size:24px;font-weight:800;color:var(--green)">{{ fmtUSD(store.totalCarritoUSD) }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--text-muted);margin-bottom:16px;padding:8px 12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
              <span>En Bs (tasa BCV {{ store.tasa_bcv }}):</span>
              <strong style="color:var(--text);font-size:14px">{{ fmtBs(store.totalCarritoUSD, store.tasa_bcv) }}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#5D4037;margin:-8px 0 16px;padding:8px 12px;background:#FDF6E3;border-radius:8px">
              <span>En efectivo $:</span>
              <strong style="font-size:14px">{{ fmtUSD(store.totalCarritoEfectivoVerde) }}</strong>
            </div>

            <button
              class="btn btn-success btn-lg"
              style="width:100%;padding:14px;font-size:15px;font-weight:700;border-radius:10px;justify-content:center;box-shadow:var(--shadow-md)"
              :disabled="store.carrito.items.length === 0"
              @click="irACobrar"
            >
              <i class="ti ti-cash"></i> COBRAR (registrar pagos y emitir)
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD, fmtBs, precioConTier } from '../../services/pricing.js';

const store = useArjStore();
const busquedaCaja = ref('');

const repuestosFiltrados = computed(() => {
  const q = busquedaCaja.value.trim().toLowerCase();
  if (!q) return store.productos.slice(0, 24);
  return store.productos.filter(p =>
    (p.cod_alt || '').toLowerCase().includes(q) ||
    (p.desc || '').toLowerCase().includes(q)
  ).slice(0, 24);
});

function stockDe(p) {
  return store.empresa === 'directa' ? p.stock_vd : p.stock_dist;
}

// El cobro se registra en la pantalla de Facturación: allí están los pagos por
// moneda, la referencia obligatoria y todas las validaciones de emisión
function irACobrar() {
  store.modoCajaActivo = false;
  store.cambiarVista('facturacion');
}
</script>
