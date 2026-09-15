<template>
  <div v-if="mostrarModal" class="modal show" style="z-index: 9999;">
    <div class="modal-content" style="max-width:400px;text-align:center;">
      <i class="ti ti-clock-pause" style="font-size:48px;color:var(--orange);margin-bottom:15px;"></i>
      <h3 style="margin-top:0;color:var(--navy);">Advertencia de Inactividad</h3>
      <p style="color:var(--text);margin-bottom:20px;line-height:1.5;">
        El sistema no ha detectado actividad reciente. Por su seguridad, su sesión se cerrará automáticamente en:
      </p>
      <div style="font-size:36px;font-weight:bold;color:var(--orange);margin-bottom:20px;">
        {{ tiempoRestante }}s
      </div>
      <button class="btn btn-primary btn-lg" style="width:100%" @click="mantenerSesion">
        <i class="ti ti-hand-click"></i> Mantener Sesión Activa
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';

const store = useArjStore();
const INACTIVIDAD_LIMITE = 5 * 60 * 1000; // 5 minutos
const TIEMPO_ADVERTENCIA = 15 * 1000; // 15 segundos antes del límite
const mostrarModal = ref(false);
const tiempoRestante = ref(15);

let timerInactividad = null;
let timerAdvertencia = null;

const resetearInactividad = () => {
  if (mostrarModal.value) return; // No resetear si ya está mostrando el modal
  
  clearTimeout(timerInactividad);
  clearInterval(timerAdvertencia);
  
  // Iniciar temporizador principal (4 minutos y 45 segundos para advertencia)
  timerInactividad = setTimeout(mostrarAdvertencia, INACTIVIDAD_LIMITE - TIEMPO_ADVERTENCIA);
};

const mostrarAdvertencia = () => {
  mostrarModal.value = true;
  tiempoRestante.value = TIEMPO_ADVERTENCIA / 1000;
  
  timerAdvertencia = setInterval(() => {
    tiempoRestante.value -= 1;
    if (tiempoRestante.value <= 0) {
      clearInterval(timerAdvertencia);
      expulsarUsuario();
    }
  }, 1000);
};

const mantenerSesion = () => {
  mostrarModal.value = false;
  resetearInactividad();
};

const expulsarUsuario = () => {
  mostrarModal.value = false;
  store.logout(true); // true = por inactividad
};

onMounted(() => {
  // Eventos para detectar actividad
  window.addEventListener('mousemove', resetearInactividad);
  window.addEventListener('keydown', resetearInactividad);
  window.addEventListener('click', resetearInactividad);
  window.addEventListener('scroll', resetearInactividad);
  
  resetearInactividad();
});

onUnmounted(() => {
  window.removeEventListener('mousemove', resetearInactividad);
  window.removeEventListener('keydown', resetearInactividad);
  window.removeEventListener('click', resetearInactividad);
  window.removeEventListener('scroll', resetearInactividad);
  
  clearTimeout(timerInactividad);
  clearInterval(timerAdvertencia);
});
</script>
