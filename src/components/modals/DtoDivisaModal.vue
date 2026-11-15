<template>
  <div v-if="store.modalDtoDivisaActivo" class="modal show" id="modal-dto-divisa" style="display:flex">
    <div class="modal-content me-caja me-media">
      <header class="me-cab">
        <span class="me-icono verde"><i class="ti ti-currency-dollar"></i></span>
        <div class="me-titulo">
          <h2>Descuento por pago en divisas</h2>
          <p>Cuánto cobrar si el cliente paga en dólares físicos</p>
        </div>
        <button type="button" class="me-cerrar" title="Cerrar" aria-label="Cerrar" @click="store.modalDtoDivisaActivo = false"><i class="ti ti-x"></i></button>
      </header>

      <div class="me-cuerpo me-cols">
        <section class="me-panel">
          <div class="me-etq">¿Por qué hay descuento?</div>
          <div class="me-nota" style="font-size:14px">Los precios están en dólar BCV. Un dólar físico vale más que uno oficial, así que para saldar la factura hace falta menos efectivo.</div>
          <div class="me-fila" style="margin-top:10px"><span>Tasa BCV</span><strong>Bs. {{ fmtTasa(store.tasa_bcv) }}</strong></div>
          <div class="me-fila"><span>Tasa paralelo</span><strong>Bs. {{ fmtTasa(store.tasa_par) }}</strong></div>
          <div class="me-fila total"><span>Descuento neutro</span><strong>{{ store.dtoDivisaNeutro.toFixed(2) }}%</strong></div>
          <div class="me-nota">Con el neutro la empresa no regala utilidad.</div>
        </section>

        <div>
          <section class="me-paso">
            <label class="me-lbl" for="dto-divisa-pct">Porcentaje de descuento</label>
            <div style="display:flex;gap:10px;align-items:center">
              <input
                id="dto-divisa-pct"
                v-model.number="dtoInput"
                type="number"
                step="0.5"
                min="0"
                max="60"
                class="val-input"
                style="width:120px;font-size:18px;font-weight:700;text-align:right"
                :class="{ 'is-invalid': errors.dto }"
                @input="errors.dto = null"
              >
              <button type="button" class="btn btn-secondary btn-sm" @click="aplicarNeutro">Usar neutro ({{ store.dtoDivisaNeutro.toFixed(1) }}%)</button>
            </div>
            <span v-if="errors.dto" class="field-error" style="margin-top:4px;display:block"><i class="ti ti-alert-circle"></i> {{ errors.dto }}</span>
          </section>

          <!-- SIMULACIÓN EN VIVO -->
          <section class="me-panel">
            <div class="me-fila"><span>Factura</span><strong>{{ fmtBCV(store.totalCarritoUSD) }}</strong></div>
            <div class="me-fila total"><span>Cobras en efectivo</span><strong>{{ fmtDolar(montoACobrarVerde) }}</strong></div>
          </section>
          <div v-if="puntosRegalados > 0.001" class="me-aviso rojo"><i class="ti ti-alert-triangle"></i><div>Regalas <strong>{{ puntosRegalados.toFixed(1) }} puntos</strong> por encima de la brecha. Se registra como descuento de margen.</div></div>
          <div v-else-if="puntosRegalados < -0.001" class="me-aviso oro"><i class="ti ti-info-circle"></i><div>Cobras <strong>{{ Math.abs(puntosRegalados).toFixed(1) }} puntos</strong> por debajo de la brecha neutral.</div></div>
          <div v-else class="me-aviso verde"><i class="ti ti-check"></i><div>Conversión neutral. La empresa no regala utilidad.</div></div>
        </div>
      </div>

      <footer class="me-pie">
        <button type="button" class="btn btn-secondary" @click="store.modalDtoDivisaActivo = false">Cerrar</button>
        <button type="button" class="btn btn-success" @click="guardarDescuento"><i class="ti ti-check"></i> Aplicar descuento</button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtBCV, fmtDolar, fmtTasa } from '../../services/pricing.js';

const store = useArjStore();
const dtoInput = ref(0);
const errors = ref({});

// Cada vez que se abre, parte del % vigente (el del gerente o la brecha del día)
watch(() => store.modalDtoDivisaActivo, (abierto) => {
  if (abierto) {
    dtoInput.value = Math.round(store.dtoDivisaPct * 10) / 10;
    errors.value = {};
  }
}, { immediate: true });

const montoACobrarVerde = computed(() => {
  const v = parseFloat(dtoInput.value) || 0;
  return Math.round(store.totales.subtotal * (1 - v / 100) * 100) / 100;
});

const puntosRegalados = computed(() => (parseFloat(dtoInput.value) || 0) - store.dtoDivisaNeutro);

function aplicarNeutro() {
  dtoInput.value = parseFloat(store.dtoDivisaNeutro.toFixed(1));
  errors.value.dto = null;
}

function guardarDescuento() {
  errors.value = {};
  const v = parseFloat(dtoInput.value);
  if (!Number.isFinite(v) || v < 0 || v > 60) {
    errors.value.dto = 'El porcentaje debe estar entre 0% y 60%';
    return;
  }
  // Si coincide con la brecha, se deja en null: la próxima vez sigue a la brecha del día
  store.fijarDtoDivisa(Math.abs(v - store.dtoDivisaNeutro) < 0.05 ? null : v);
  store.modalDtoDivisaActivo = false;
  store.notif(`Descuento por divisas: ${v.toFixed(1)}%`, 'success');
}
</script>
