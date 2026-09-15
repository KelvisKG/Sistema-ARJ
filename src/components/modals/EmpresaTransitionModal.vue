<template>
  <div v-if="store.mostrandoTransicionEmpresa" class="empresa-transition show">
    <div :class="['transition-card', store.empresaDestino]">
      <div class="icon">
        <i :class="store.empresaDestino === 'directa' ? 'ti ti-building-store' : 'ti ti-truck-delivery'"></i>
      </div>
      <h2>{{ store.empresaDestino === 'directa' ? 'Venta Directa' : 'Distribuidora' }}</h2>
      <p>{{ store.empresaDestino === 'directa' ? 'Cambiando a empresa de venta al público...' : 'Cambiando a empresa distribuidora...' }}</p>
    </div>
  </div>
</template>

<script setup>
import { useArjStore } from '../../stores/useArjStore.js';

const store = useArjStore();
</script>

<style scoped>
/* ═══ TRANSICIÓN ANIMADA AL CAMBIAR EMPRESA ═══ */
.empresa-transition {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.85); /* rgba(0, 0, 0, 0.85) in legacy */
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeInOut 1.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.transition-card {
  background: var(--card-bg, #FFF);
  border-radius: 16px;
  padding: 40px 60px;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
  animation: scaleUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--border, #E2E8F0);
}

.transition-card .icon {
  font-size: 64px;
  margin-bottom: 15px;
}

.transition-card.directa .icon {
  color: var(--gold, #EAB308);
}

.transition-card.distribuidora .icon {
  color: var(--blue, #3B82F6);
}

.transition-card h2 {
  font-size: 26px;
  color: var(--navy, #1E3A5F);
  margin-bottom: 8px;
  font-weight: 800;
}

.transition-card p {
  color: var(--dgray, #64748B);
  font-size: 14px;
  margin: 0;
}

@keyframes fadeInOut {
  0% { opacity: 0; }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes scaleUp {
  0% { transform: scale(0.8) translateY(20px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
</style>
