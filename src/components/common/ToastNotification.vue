<template>
  <div
    v-if="store.toast.visible"
    :class="['notif', store.toast.tipo, 'show']"
    id="notif"
    style="display:flex;align-items:center;position:fixed;bottom:20px;right:20px;z-index:99999;padding:12px 18px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:fadeIn 0.2s ease"
    :style="toastStyle"
  >
    <i :class="iconoToast" style="font-size:18px;margin-right:8px"></i>
    <span style="font-size:13px;font-weight:600">{{ store.toast.mensaje }}</span>
    <span
      style="margin-left:12px;cursor:pointer;opacity:0.7;font-size:16px"
      @click="store.toast.visible = false"
    >
      &times;
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';

const store = useArjStore();

const iconoToast = computed(() => {
  switch (store.toast.tipo) {
    case 'success': return 'ti ti-circle-check';
    case 'error': return 'ti ti-alert-triangle';
    case 'warning': return 'ti ti-alert-circle';
    default: return 'ti ti-info-circle';
  }
});

const toastStyle = computed(() => {
  switch (store.toast.tipo) {
    case 'success': return { background: '#2E7D32', color: '#FFF' };
    case 'error': return { background: '#C62828', color: '#FFF' };
    case 'warning': return { background: '#E65100', color: '#FFF' };
    default: return { background: '#0D47A1', color: '#FFF' };
  }
});
</script>
