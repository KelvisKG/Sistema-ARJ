<template>
  <!-- Reemplaza a confirm/alert/prompt del navegador. Se usa con store.confirmar/avisar/pedirTexto -->
  <div v-if="d" class="modal show" id="modal-dialogo" @keydown.esc="store.responderDialogo(null)">
    <div class="modal-content me-caja me-angosta" role="dialog" aria-modal="true">
      <header class="me-cab">
        <span :class="['me-icono', tono]"><i :class="['ti', icono]"></i></span>
        <div class="me-titulo"><h2>{{ d.titulo }}</h2></div>
        <button v-if="d.tipo !== 'avisar'" type="button" class="me-cerrar" title="Cerrar" aria-label="Cerrar" @click="store.responderDialogo(null)"><i class="ti ti-x"></i></button>
      </header>
      <div class="me-cuerpo">
        <p class="me-mensaje">{{ d.mensaje }}</p>
        <div v-if="d.tipo === 'pedir'" style="margin-bottom:16px">
          <label class="me-lbl" for="dialogo-texto">{{ d.etiqueta }}</label>
          <input id="dialogo-texto" ref="campo" v-model="texto" type="text" class="val-input" :placeholder="d.placeholder || ''" @keydown.enter.prevent="aceptar">
        </div>
      </div>
      <footer class="me-pie">
        <button v-if="d.tipo !== 'avisar'" type="button" class="btn btn-secondary" @click="store.responderDialogo(null)">{{ d.cancelar || 'Cancelar' }}</button>
        <button ref="principal" type="button" :class="['btn', claseOk]" :disabled="d.tipo === 'pedir' && !texto.trim()" @click="aceptar">{{ d.ok || 'Aceptar' }}</button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';

const store = useArjStore();
const d = computed(() => store.dialogo);
const texto = ref('');
const campo = ref(null);
const principal = ref(null);

const ICONOS = { rojo: 'ti-alert-triangle', oro: 'ti-alert-circle', verde: 'ti-check', azul: 'ti-help-circle' };
const tono = computed(() => (d.value && d.value.tono) || 'azul');
const icono = computed(() => ICONOS[tono.value] || ICONOS.azul);
const claseOk = computed(() => ({ rojo: 'btn-red', oro: 'btn-gold', verde: 'btn-green' }[tono.value] || 'btn-primary'));

// El foco entra al diálogo: Enter acepta y Esc cancela también con el teclado
watch(d, abierto => {
  if (!abierto) return;
  texto.value = '';
  nextTick(() => {
    const el = campo.value || principal.value;
    if (el) el.focus();
  });
}, { immediate: true });

function aceptar() {
  if (d.value.tipo === 'pedir') {
    if (texto.value.trim()) store.responderDialogo(texto.value.trim());
    return;
  }
  store.responderDialogo(true);
}
</script>
