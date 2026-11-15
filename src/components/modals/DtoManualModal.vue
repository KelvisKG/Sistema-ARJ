<template>
  <div v-if="store.modalDtoManualActivo" class="modal show" id="modal-dto-manual" style="display:flex">
    <div class="modal-content me-caja me-media">
      <header class="me-cab">
        <span class="me-icono oro"><i class="ti ti-discount"></i></span>
        <div class="me-titulo">
          <h2>Descuento manual</h2>
          <p>Descuento comercial para esta venta en Venta Directa</p>
        </div>
        <button type="button" class="me-cerrar" title="Cerrar" aria-label="Cerrar" @click="store.modalDtoManualActivo = false"><i class="ti ti-x"></i></button>
      </header>

      <div class="me-cuerpo me-cols">
        <div>
          <section class="me-paso">
            <h3><b>1</b> ¿Cuánto descuento?</h3>
            <div class="me-chips">
              <button v-for="p in COMUNES" :key="p" type="button" :class="['me-chip', { activo: !otro && pctInput === p }]" :aria-pressed="!otro && pctInput === p" @click="elegir(p)">{{ p }}%</button>
              <button type="button" :class="['me-chip', { activo: otro }]" :aria-pressed="otro" @click="elegirOtro"><i class="ti ti-pencil"></i> Otro</button>
              <button v-if="store.carrito.descuento_manual > 0" type="button" :class="['me-chip', { activo: !otro && !pctInput }]" @click="elegir(0)">Sin descuento</button>
            </div>
            <div v-if="otro" style="margin-top:10px">
              <label class="me-lbl" for="dto-manual-pct">Escribe el porcentaje (0% a 50%)</label>
              <input
                id="dto-manual-pct"
                ref="inpPct"
                v-model.number="pctInput"
                type="number"
                min="0"
                max="50"
                step="1"
                placeholder="Ej: 12"
                class="val-input"
                style="font-size:18px;font-weight:700"
                :class="{ 'is-invalid': errors.pct }"
                @input="errors.pct = null"
              >
            </div>
            <span v-if="errors.pct" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.pct }}</span>
          </section>
          <section class="me-paso">
            <h3><b>2</b> ¿Por qué se hace?</h3>
            <label class="me-lbl" for="dto-manual-motivo">Motivo (obligatorio)</label>
            <input
              id="dto-manual-motivo"
              v-model="motivoInput"
              type="text"
              placeholder="Ej: Cliente VIP, compra por volumen..."
              class="val-input"
              :class="{ 'is-invalid': errors.motivo }"
              @input="errors.motivo = null"
            >
            <span v-if="errors.motivo" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.motivo }}</span>
          </section>
        </div>

        <!-- PREVIEW -->
        <section class="me-panel">
          <div class="me-etq">Así queda la venta</div>
          <div class="me-fila" style="margin:6px 0 10px"><span>Sin descuento</span><strong>{{ fmtBCV(store.subtotalCarrito) }}</strong></div>
          <table class="me-monedas">
            <thead><tr><th>Si paga en</th><th>Descuento ({{ pctInput || 0 }}%)</th><th>A cobrar</th></tr></thead>
            <tbody>
              <tr v-for="m in porMoneda" :key="m.nombre">
                <td>{{ m.nombre }}</td>
                <td class="menos">−{{ m.dto }}</td>
                <td class="cobra">{{ m.cobra }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <footer class="me-pie">
        <button type="button" class="btn btn-secondary" @click="store.modalDtoManualActivo = false">Cancelar</button>
        <button type="button" class="btn btn-primary" @click="confirmarDescuento"><i class="ti ti-check"></i> Aplicar descuento</button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtBCV, fmtDolar, fmtBsMonto, precioBaseItem } from '../../services/pricing.js';
import { totalesCarrito, descuentoCarrito } from '../../services/cobros.js';

const store = useArjStore();
const pctInput = ref(store.carrito.descuento_manual || 0);
const motivoInput = ref(store.carrito.descuento_motivo || '');
const errors = ref({});
const COMUNES = [5, 10, 15, 20, 25, 30];
const otro = ref(false);
const inpPct = ref(null);

function elegir(p) {
  otro.value = false;
  pctInput.value = p;
  errors.value.pct = null;
}
function elegirOtro() {
  otro.value = true;
  errors.value.pct = null;
  nextTick(() => { if (inpPct.value) inpPct.value.focus(); });
}

watch(() => store.modalDtoManualActivo, (abierto) => {
  if (abierto) {
    pctInput.value = store.carrito.descuento_manual || 0;
    motivoInput.value = store.carrito.descuento_motivo || '';
    errors.value = {};
    // Un descuento vigente que no sea de los comunes se muestra en el campo libre
    otro.value = pctInput.value > 0 && !COMUNES.includes(pctInput.value);
  }
});

// El carrito con el % elegido, redondeado por renglón igual que al aplicarlo (_preciarItem)
const porMoneda = computed(() => {
  const p = Number(pctInput.value) || 0;
  const items = store.carrito.items.map(it => ({ cant: it.cant, precio: Math.round(precioBaseItem(it) * (1 - p / 100) * 100) / 100 }));
  const t = totalesCarrito(items, store.estadoTasas);
  const d = descuentoCarrito(store.subtotalCarrito, t, store.estadoTasas) || { bcv: 0, dolar: 0, bs: 0 };
  return [
    { nombre: 'Dólar BCV', dto: fmtBCV(d.bcv), cobra: fmtBCV(t.subtotal) },
    { nombre: 'Dólar ($)', dto: fmtDolar(d.dolar), cobra: fmtDolar(t.totalUsdBase) },
    { nombre: 'Bolívares', dto: fmtBsMonto(d.bs), cobra: fmtBsMonto(t.totalBs) }
  ];
});

function confirmarDescuento() {
  errors.value = {};

  if (pctInput.value < 0 || pctInput.value > 50) {
    errors.value.pct = 'El porcentaje debe estar entre 0% y 50%';
  } else if (!pctInput.value && !(store.carrito.descuento_manual > 0)) {
    errors.value.pct = 'Elige o escribe un descuento';
  }
  if (pctInput.value > 0 && !motivoInput.value.trim()) {
    errors.value.motivo = 'Indica el motivo del descuento';
  }

  if (Object.keys(errors.value).length > 0) {
    store.notif('Corrige los campos marcados en rojo', 'warning');
    return;
  }

  store.aplicarDescuentoManual(pctInput.value, motivoInput.value);
  store.modalDtoManualActivo = false;
}
</script>
