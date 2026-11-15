<template>
  <!-- Emisión: primero la regla de la factura fiscal, después la confirmación -->
  <div v-if="store.modalEmitirActivo" class="modal show" id="modal-emitir">
    <!-- No se puede emitir -->
    <div v-if="paso === 'bloqueo'" class="modal-content me-caja me-angosta">
      <header class="me-cab">
        <span class="me-icono rojo"><i class="ti ti-alert-triangle"></i></span>
        <div class="me-titulo"><h2>No se puede emitir</h2></div>
        <button type="button" class="me-cerrar" title="Cerrar" aria-label="Cerrar" @click="cerrar"><i class="ti ti-x"></i></button>
      </header>
      <div class="me-cuerpo"><div class="me-aviso rojo"><i class="ti ti-alert-circle"></i><div>{{ store.emitirBloqueo }}</div></div></div>
      <footer class="me-pie"><button type="button" class="btn btn-primary" @click="cerrar">Entendido</button></footer>
    </div>

    <!-- Regla: siempre se responde, nunca viene marcado -->
    <div v-else-if="paso === 'fiscal'" class="modal-content me-caja me-angosta">
      <header class="me-cab">
        <span class="me-icono azul"><i class="ti ti-receipt-tax"></i></span>
        <div class="me-titulo">
          <h2>Factura fiscal</h2>
          <p>{{ store.carrito.cliente_nombre }}</p>
        </div>
        <button type="button" class="me-cerrar" title="Cerrar" aria-label="Cerrar" @click="cerrar"><i class="ti ti-x"></i></button>
      </header>
      <div class="me-cuerpo">
        <p class="me-pregunta">¿El cliente pidió factura fiscal?</p>
        <div class="me-si-no">
          <button type="button" class="me-respuesta si" @click="responderFiscal(true)"><i class="ti ti-check"></i> SÍ</button>
          <button type="button" class="me-respuesta no" @click="responderFiscal(false)"><i class="ti ti-x"></i> NO</button>
        </div>
        <p class="me-nota" style="text-align:center;margin-bottom:18px">Si respondes SÍ, te recordará registrarla en el sistema fiscal homologado.</p>
      </div>
    </div>

    <!-- Confirmación -->
    <div v-else class="modal-content me-caja me-media">
      <header class="me-cab">
        <span class="me-icono verde"><i class="ti ti-file-invoice"></i></span>
        <div class="me-titulo">
          <h2>Confirmar factura</h2>
          <p>Revisa los datos antes de emitir</p>
        </div>
        <button type="button" class="me-cerrar" title="Cerrar" aria-label="Cerrar" :disabled="store.procesando" @click="cerrar"><i class="ti ti-x"></i></button>
      </header>

      <div class="me-cuerpo">
        <div v-if="store.emitirNegativos.length" class="me-aviso oro">
          <i class="ti ti-alert-triangle"></i>
          <div>
            <strong>Préstamo inter-empresa:</strong> {{ store.emitirNegativos.length }} producto(s) superan el stock en {{ store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora' }}.
            <div v-for="n in store.emitirNegativos" :key="n.cod_alt">{{ n.cod_alt }}: solicitado {{ n.cant }}, disponible {{ n.stock }}</div>
          </div>
        </div>
        <div v-if="errorEnvio" class="me-aviso rojo"><i class="ti ti-alert-circle"></i><div><strong>La factura NO se emitió.</strong> {{ errorEnvio }}</div></div>

        <div class="me-cols">
          <section class="me-panel">
            <div class="me-etq">Cliente</div>
            <div class="me-cliente">{{ store.carrito.cliente_nombre }}</div>
            <div class="me-fila" style="margin-top:8px"><span>Productos</span><strong>{{ store.carrito.items.length }} ({{ store.totalItemsCarrito }} und.)</strong></div>
            <div class="me-fila"><span>Condición</span><strong>{{ condicion }}</strong></div>
            <div class="me-fila"><span>Factura fiscal</span>
              <strong>{{ store.carrito.pidio_fiscal ? 'SÍ' : 'NO' }} <button type="button" class="me-enlace" :disabled="store.procesando" @click="paso = 'fiscal'">Cambiar</button></strong>
            </div>
            <template v-if="store.carrito.pagos.length">
              <div class="me-etq" style="margin-top:10px">Pagos</div>
              <div v-for="(p, i) in store.carrito.pagos" :key="i" class="me-fila"><span>{{ p.metodo }}</span><strong>{{ p.moneda === 'USD' ? fmtDolar(p.monto) : fmtBsMonto(p.monto) }}</strong></div>
            </template>
          </section>

          <section class="me-panel">
            <div class="me-etq">Total de la factura</div>
            <div class="me-grande">{{ fmtBCV(t.subtotal) }}</div>
            <div v-if="descuento" class="me-nota">Incluye descuento de {{ fmtBCV(descuento.bcv) }}</div>
            <div class="me-fila" style="margin-top:10px"><span>En efectivo</span><strong>{{ fmtDolar(t.totalUsd) }}</strong></div>
            <div class="me-fila"><span>En bolívares</span><strong>{{ fmtBsMonto(t.totalBs) }}</strong></div>
            <div v-if="debe" class="me-fila total"><span>Queda debiendo</span><strong>{{ fmtBCV(store.faltaPorPagarUSD) }}</strong></div>
          </section>
        </div>
      </div>

      <footer class="me-pie">
        <button type="button" class="btn btn-secondary" :disabled="store.procesando" @click="cerrar">Cancelar</button>
        <button type="button" class="btn btn-green" :disabled="store.procesando" @click="emitir"><i class="ti ti-printer"></i> {{ store.procesando ? 'Emitiendo...' : 'Emitir e imprimir' }}</button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtBCV, fmtDolar, fmtBsMonto } from '../../services/pricing.js';
import { descuentoCarrito } from '../../services/cobros.js';

const store = useArjStore();
const paso = ref('fiscal');
const errorEnvio = ref('');

const t = computed(() => store.totales);
const descuento = computed(() => descuentoCarrito(store.subtotalCarrito, t.value, store.estadoTasas));
const debe = computed(() => store.carrito.tipo_pago === 'credito' && store.faltaPorPagarUSD > 0.01);
const condicion = computed(() => {
  if (store.carrito.tipo_pago !== 'credito') return 'Contado';
  return debe.value ? `Crédito ${store.carrito.dias_credito} días` : 'Contado (crédito ya pagado completo)';
});

watch(() => store.modalEmitirActivo, abierto => {
  if (!abierto) return;
  errorEnvio.value = '';
  paso.value = store.emitirBloqueo ? 'bloqueo' : 'fiscal';
}, { immediate: true });

function responderFiscal(si) {
  store.carrito.pidio_fiscal = si;
  paso.value = 'confirmar';
}

function cerrar() {
  store.modalEmitirActivo = false;
}

async function emitir() {
  errorEnvio.value = '';
  const r = await store.emitirFactura();
  if (r && r.ok) cerrar();
  else errorEnvio.value = (r && r.error) || 'No se pudo emitir. Intenta de nuevo.';
}
</script>
