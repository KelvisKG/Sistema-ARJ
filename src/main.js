// =====================================================================
// ARJ Sistema - Vue 3 Entry Point
// =====================================================================
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { inject } from '@vercel/analytics';
import App from './App.vue';
import { guardarDatosLocal } from './services/persistence.js';

// Inicializar Vercel Analytics
inject();

// Estilos del sistema (base, componentes y páginas)
import './main-estilos.js';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

// Autoguardado del store en cada cambio
pinia.use(({ store }) => {
  store.$subscribe((mutation, state) => {
    guardarDatosLocal(state);
  }, { detached: true });
});

app.mount('#app');

// Registro del Service Worker para funcionamiento Offline y PWA instalable
// En desarrollo NO se usa: serviría módulos viejos y rompería la recarga en caliente.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !import.meta.env.PROD) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
} else if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[ARJ PWA] Service Worker activo y registrado con éxito. Ámbito:', reg.scope);
      })
      .catch((err) => {
        console.warn('[ARJ PWA] Error al registrar Service Worker:', err);
      });
  });
}
