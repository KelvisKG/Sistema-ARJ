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

// Importar Estilos Base y Sistema de Diseño ARJ
import '../css/variables.css';
import '../css/base.css';
import '../css/layout.css';

// Componentes CSS
import '../css/components/badges.css';
import '../css/components/buttons.css';
import '../css/components/cards.css';
import '../css/components/forms.css';
import '../css/components/modals.css';
import '../css/components/notifications.css';
import '../css/components/search.css';
import '../css/components/tables.css';

// Páginas CSS
import '../css/pages/login.css';
import '../css/pages/facturacion.css';
import '../css/pages/inventario.css';
import '../css/pages/cuentas-cobrar.css';
import '../css/pages/config-precios.css';
import '../css/pages/print.css';
import '../css/pages/listas-precios.css';
import '../css/pages/reportes.css';

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
