// =====================================================================
// ARJ Sistema - Vue 3 Entry Point
// =====================================================================
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { guardarDatosLocal } from './services/persistence.js';

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
