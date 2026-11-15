<template>
  <!-- Nota de crédito / devolución parcial (monolito v13.8 / v13.33) -->
  <div v-if="store.modalNotaCreditoActivo && store.facturaNC" class="modal show" id="modal-nota-credito">
    <div class="modal-content me-caja me-ancha">
      <header class="me-cab">
        <span class="me-icono oro"><i class="ti ti-receipt-refund"></i></span>
        <div class="me-titulo">
          <h2>Devolución (nota de crédito)</h2>
          <p>{{ info }}</p>
        </div>
        <button type="button" class="me-cerrar" title="Cerrar" aria-label="Cerrar" @click="cerrar"><i class="ti ti-x"></i></button>
      </header>

      <div class="me-cuerpo">
        <section class="me-paso">
          <h3><b>1</b> ¿Qué productos devuelve el cliente?</h3>
          <div style="overflow-x:auto">
            <table class="simple-tbl">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th class="num">Facturado</th>
                  <th class="num">Ya devuelto</th>
                  <th class="num">Precio</th>
                  <th class="num">Devolver</th>
                  <th class="num">Crédito</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="cargando"><td colspan="6" style="text-align:center;padding:16px;color:var(--dgray)">Cargando renglones…</td></tr>
                <tr v-else-if="error"><td colspan="6" style="text-align:center;padding:16px;color:var(--red)">{{ error }}</td></tr>
                <template v-else>
                <tr v-for="(it, i) in items" :key="i" :style="disp(it) <= 0 ? 'opacity:.5' : ''">
                  <td><strong>{{ it.cod }}</strong><div style="font-size:12px;color:var(--dgray)">{{ it.desc || '' }}</div></td>
                  <td class="num">{{ it.cantFacturada }}</td>
                  <td class="num"><span v-if="it.yaDevuelto > 0" style="color:var(--gold);font-weight:600">{{ it.yaDevuelto }}</span><template v-else>—</template></td>
                  <td class="num" style="white-space:nowrap">{{ fmtBCV(it.precio) }}</td>
                  <td class="num">
                    <input v-if="disp(it) > 0" type="number" min="0" :max="disp(it)" :value="it.devolver" class="val-input" aria-label="Unidades a devolver"
                      style="width:82px;text-align:right" @change="actualizar(it, $event)">
                    <span v-else style="font-size:12px;color:var(--dgray)">devuelto</span>
                  </td>
                  <td class="num" style="white-space:nowrap"><strong style="color:var(--gold)">{{ fmtBCV(it.devolver * it.precio) }}</strong></td>
                </tr>
                </template>
              </tbody>
            </table>
          </div>
        </section>

        <div class="me-cols">
          <div>
            <section class="me-paso">
              <h3><b>2</b> ¿Por qué lo devuelve?</h3>
              <textarea v-model="motivo" class="me-area" aria-label="Motivo de la devolución" placeholder="Ej: Cliente devolvió 2 filtros por garantía..."></textarea>
            </section>
            <!-- Qué se hace con el crédito: solo cuando no hay saldo contra el cual descontar -->
            <section v-if="total > 0.009 && saldo < 0.01" class="me-paso">
              <h3><b>3</b> La factura ya está pagada. ¿Qué se hace con el crédito?</h3>
              <label :class="['me-opcion', { activo: destino === 'favor' }]">
                <input v-model="destino" type="radio" value="favor">
                <span><strong>Dejarlo a favor del cliente</strong><small>Baja su saldo o queda de anticipo.</small></span>
              </label>
              <label :class="['me-opcion', { activo: destino === 'efectivo' }]">
                <input v-model="destino" type="radio" value="efectivo">
                <span><strong>Devolver el efectivo</strong><small>Sale de caja hoy.</small></span>
              </label>
            </section>
          </div>

          <section class="me-panel">
            <div class="me-etq">Total de la devolución</div>
            <div class="me-grande">{{ fmtBCV(total) }}</div>
            <template v-if="total > 0.009">
              <div class="me-fila" style="margin-top:10px"><span>Saldo actual de la factura</span><strong>{{ fmtBCV(saldo) }}</strong></div>
              <div v-if="aplicaSaldo > 0.009" class="me-fila"><span>Baja del saldo pendiente</span><strong>−{{ fmtBCV(aplicaSaldo) }}</strong></div>
              <div v-if="destinoFinal === 'efectivo'" class="me-fila"><span>Se devuelve en efectivo</span><strong>{{ fmtDolar(sobranteDolar) }}</strong></div>
              <div v-else-if="sobrante > 0.009" class="me-fila"><span>Queda a favor del cliente</span><strong>{{ fmtBCV(sobrante) }}</strong></div>
              <div class="me-nota">El stock de estos productos vuelve a {{ f.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora' }}.</div>
            </template>
            <div v-else class="me-nota">Indica las unidades que devuelve para ver cómo queda.</div>
          </section>
        </div>
      </div>

      <footer class="me-pie">
        <button type="button" class="btn btn-secondary" @click="cerrar">Cancelar</button>
        <button type="button" class="btn btn-gold" :disabled="store.procesando || cargando" @click="confirmar">
          <template v-if="store.procesando">Emitiendo...</template>
          <template v-else><i class="ti ti-receipt-refund"></i> Emitir nota de crédito</template>
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtBCV, fmtDolar, brechaHoy } from '../../services/pricing.js';
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
  : `${f.value.num} · ${f.value.cliente_nombre_snap || f.value.cliente} · ${fmtBCV(f.value.total || 0)} · abonado ${fmtBCV(f.value.abonado || 0)}`));
const disp = it => it.cantFacturada - it.yaDevuelto;
const total = computed(() => items.value.reduce((a, it) => a + it.devolver * it.precio, 0));
// El crédito primero cancela lo que el cliente aún debe; solo el sobrante va al destino
const aplicaSaldo = computed(() => Math.min(total.value, saldo.value));
const sobrante = computed(() => total.value - aplicaSaldo.value);
const destinoFinal = computed(() => (sobrante.value > 0.009 ? destino.value : 'favor'));
// El efectivo sale de caja en dólares físicos, igual que lo calcula el servidor (sql/09)
const sobranteDolar = computed(() => Math.round(sobrante.value / brechaHoy(store.estadoTasas) * 100) / 100);

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

  const dest = destinoFinal.value;
  let msg = `NOTA DE CRÉDITO sobre ${fac.num}\n\n${totDev} unidad(es) · ${fmtBCV(tot)}\n\n`;
  msg += `El stock de esos productos vuelve a ${fac.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora'}.\n\n`;
  if (aplicaSaldo.value > 0.009) msg += `Baja ${fmtBCV(aplicaSaldo.value)} del saldo pendiente.\n`;
  if (sobrante.value > 0.009) msg += dest === 'efectivo'
    ? `Se devuelven ${fmtDolar(sobranteDolar.value)} en efectivo (sale de caja).\n` : `Quedan ${fmtBCV(sobrante.value)} a favor del cliente.\n`;
  msg += '\nEsto no se puede deshacer. ¿Emitir?';
  if (!await store.confirmar({ titulo: 'Confirmar devolución', mensaje: msg, ok: 'Emitir nota de crédito', tono: 'oro' })) return;

  const r = await store.emitirNotaCredito(fac, dev.map(it => ({ cod_alt: it.cod, cantidad: it.devolver, producto_id: it.producto_id })), motivo.value.trim(), dest);
  if (r) cerrar();
}
</script>
