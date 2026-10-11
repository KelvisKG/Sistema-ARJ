<template>
  <!-- Nota de crédito / devolución parcial (monolito v13.8 / v13.33) -->
  <div v-if="store.modalNotaCreditoActivo && store.facturaNC" class="modal show" id="modal-nota-credito">
    <div class="modal-content" style="max-width:680px;text-align:left;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:12px">
        <div>
          <h2 style="margin:0;text-align:left;color:var(--gold)"><i class="ti ti-receipt-refund"></i> Nota de crédito</h2>
          <p style="margin:3px 0 0;color:var(--dgray);font-size:13px">{{ info }}</p>
        </div>
        <button class="btn btn-secondary btn-sm" @click="cerrar"><i class="ti ti-x"></i></button>
      </div>
      <div style="background:#FFF8E1;border:1px solid #FFC107;border-left:4px solid var(--gold);border-radius:6px;padding:10px 12px;font-size:12.5px;color:#5D4037;margin-bottom:14px">
        <i class="ti ti-info-circle"></i> Selecciona qué productos devuelve el cliente. El stock de esos productos se
        restaura y se descuenta del saldo del cliente.
      </div>
      <table class="simple-tbl">
        <thead>
          <tr>
            <th>Producto</th>
            <th class="num">Facturado</th>
            <th class="num">Ya devuelto</th>
            <th class="num">Precio</th>
            <th class="num">Devolver</th>
            <th class="num">Crédito $</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando"><td colspan="6" style="text-align:center;padding:16px;color:var(--dgray)">Cargando renglones…</td></tr>
          <tr v-else-if="error"><td colspan="6" style="text-align:center;padding:16px;color:var(--red)">{{ error }}</td></tr>
          <template v-else>
          <tr v-for="(it, i) in items" :key="i" :style="disp(it) <= 0 ? 'opacity:.5' : ''">
            <td><strong>{{ it.cod }}</strong><div style="font-size:11px;color:var(--dgray)">{{ it.desc || '' }}</div></td>
            <td class="num">{{ it.cantFacturada }}</td>
            <td class="num"><span v-if="it.yaDevuelto > 0" style="color:var(--gold);font-weight:600">{{ it.yaDevuelto }}</span><template v-else>—</template></td>
            <td class="num">{{ fmtUSD(it.precio) }}</td>
            <td class="num">
              <input v-if="disp(it) > 0" type="number" min="0" :max="disp(it)" :value="it.devolver"
                style="width:70px;padding:4px 8px;text-align:right;border:1px solid var(--border);border-radius:5px;font-family:inherit"
                @change="actualizar(it, $event)">
              <span v-else style="font-size:11px;color:var(--dgray)">devuelto</span>
            </td>
            <td class="num"><strong style="color:var(--gold)">{{ fmtUSD(it.devolver * it.precio) }}</strong></td>
          </tr>
          </template>
        </tbody>
      </table>
      <div style="background:var(--lgreen);border-radius:6px;padding:10px 14px;margin-top:12px;display:flex;justify-content:space-between;font-weight:600;color:var(--green)">
        <span>Total nota de crédito:</span>
        <span>{{ fmtUSD(total) }}</span>
      </div>
      <!-- Qué se hace con el crédito: solo cuando no hay saldo contra el cual descontar -->
      <div v-if="total > 0.009 && saldo < 0.01" style="margin-top:12px">
        <label style="font-size:11px;color:var(--dgray);font-weight:500;display:block;margin-bottom:4px">Esta factura ya está pagada. ¿Qué se hace con el crédito?</label>
        <select v-model="destino" class="val-input" style="width:100%">
          <option value="favor">Dejarlo a favor del cliente (baja su saldo o queda de anticipo)</option>
          <option value="efectivo">Devolver el efectivo (sale de caja hoy)</option>
        </select>
      </div>
      <div class="field-row" style="flex-direction:column;align-items:flex-start;gap:6px;margin-top:10px">
        <label>Motivo:</label>
        <textarea v-model="motivo" placeholder="Ej: Cliente devolvió 2 filtros por garantía..."
          style="width:100%;min-height:60px;background:#FFF;border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:13px;font-family:inherit;resize:vertical"></textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;padding-top:12px;border-top:1px solid var(--gray)">
        <button class="btn btn-secondary" @click="cerrar">Cancelar</button>
        <button class="btn btn-gold" :disabled="store.procesando || cargando" @click="confirmar">
          <template v-if="store.procesando">Emitiendo...</template>
          <template v-else><i class="ti ti-receipt-refund"></i> Emitir nota de crédito</template>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD } from '../../services/pricing.js';
import { cargarRenglonesNotaCredito } from '../../services/supabase.js';

const store = useArjStore();
const items = ref([]);
const cargando = ref(false);
const error = ref('');
const motivo = ref('');
const destino = ref('favor');

const f = computed(() => store.facturaNC || {});
const saldo = computed(() => parseFloat(f.value.saldo_pendiente) || 0);
const info = computed(() => (cargando.value
  ? `${f.value.num} · ${f.value.cliente_nombre_snap || f.value.cliente} · cargando…`
  : `${f.value.num} · ${f.value.cliente_nombre_snap || f.value.cliente} · ${fmtUSD(f.value.total || 0)} · abonado ${fmtUSD(f.value.abonado || 0)}`));
const disp = it => it.cantFacturada - it.yaDevuelto;
const total = computed(() => items.value.reduce((a, it) => a + it.devolver * it.precio, 0));

watch(() => store.modalNotaCreditoActivo, async abierto => {
  if (!abierto || !store.facturaNC) return;
  items.value = []; motivo.value = ''; destino.value = 'favor'; error.value = '';
  cargando.value = true;
  try {
    // Lo devuelto en notas anteriores se resta: no se puede devolver dos veces lo mismo
    const { items: its, yaDev } = await cargarRenglonesNotaCredito(store.facturaNC.id);
    if (!its.length) { error.value = 'No se pudieron cargar los renglones de esta factura'; return; }
    items.value = its.map(it => ({
      producto_id: it.producto_id, cod: it.cod_alt, desc: it.descripcion, cantFacturada: it.cantidad,
      yaDevuelto: yaDev[it.cod_alt] || 0, precio: parseFloat(it.precio_unitario) || 0, devolver: 0
    }));
  } catch (e) {
    console.error('[ARJ] items NC:', e);
    error.value = 'No se pudieron cargar los renglones de esta factura';
  } finally {
    cargando.value = false;
  }
}, { immediate: true });

function actualizar(it, ev) {
  it.devolver = Math.max(0, Math.min(parseInt(ev.target.value) || 0, disp(it)));
  ev.target.value = it.devolver;
}

function cerrar() {
  store.modalNotaCreditoActivo = false;
  store.facturaNC = null;
  items.value = [];
}

async function confirmar() {
  const fac = store.facturaNC;
  if (!fac) return;
  const dev = items.value.filter(it => it.devolver > 0);
  const totDev = dev.reduce((a, it) => a + it.devolver, 0);
  const tot = total.value;
  if (totDev === 0) { store.notif('Indica cuántas unidades devuelve el cliente', 'error'); return; }
  if (!motivo.value.trim()) { store.notif('Indica el motivo de la devolución', 'error'); return; }
  if (!store.supabaseConectado) { store.notif('Sin conexión: no se puede emitir', 'error'); return; }

  // El crédito primero cancela lo que el cliente aún debe; solo el sobrante va al destino
  const aplicaSaldo = Math.min(tot, saldo.value);
  const sobrante = tot - aplicaSaldo;
  const dest = sobrante > 0.009 ? destino.value : 'favor';
  let msg = `NOTA DE CRÉDITO sobre ${fac.num}\n\n${totDev} unidad(es) · ${fmtUSD(tot)}\n\n`;
  msg += `El stock de esos productos vuelve a ${fac.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora'}.\n\n`;
  if (aplicaSaldo > 0.009) msg += `Baja ${fmtUSD(aplicaSaldo)} del saldo pendiente.\n`;
  if (sobrante > 0.009) msg += dest === 'efectivo'
    ? `Se devuelven ${fmtUSD(sobrante)} en efectivo (sale de caja).\n` : `Quedan ${fmtUSD(sobrante)} a favor del cliente.\n`;
  msg += '\nEsto no se puede deshacer. ¿Emitir?';
  if (!confirm(msg)) return;

  const r = await store.emitirNotaCredito(fac, dev.map(it => ({ cod_alt: it.cod, cantidad: it.devolver, producto_id: it.producto_id })), motivo.value.trim(), dest);
  if (r) cerrar();
}
</script>
