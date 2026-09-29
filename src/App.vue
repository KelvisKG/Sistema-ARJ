<template>
  <div id="arj-root">
    <!-- Pantalla de Login si no está autenticado -->
    <LoginScreen v-if="!store.autenticado" />

    <!-- Sistema Principal -->
    <div v-else :class="['app-wrapper', `empresa-${store.empresa}`]" style="transition: background-color 0.5s ease, color 0.5s ease;">
      <!-- Header y Barra de Navegación -->
      <HeaderNav />

      <!-- Vistas Principales (13 Vistas Completas del Monolito) -->
      <main class="main-content" style="padding:14px 20px 40px">
        <Transition name="view-fade" mode="out-in">
          <component :is="vistaComponenteActual" :key="store.vistaActiva" />
        </Transition>
      </main>

      <!-- Modales Globales del Sistema -->
      <EmpresaTransitionModal />
      <FacturaModal />
      <PresupuestoPreviewModal />
      <TraspasoModal />
      <NotasEntregaModal />
      <EditProdModal />
      <DtoDivisaModal />
      <DtoManualModal />
      <ModoCajaModal />
      <AnularFacturaModal />
      <NuevoClienteRapidoModal />
      <EmbarquesModal />
      <ListaPreciosModal />
      <RecepcionModal />

      <!-- BOTÓN AYUDA FLOTANTE Y HINT DE ATAJOS -->
      <button class="help-fab" @click="mostrarModalAyuda = true" title="Ayuda y atajos">
        <i class="ti ti-help"></i>
      </button>

      <!-- MODAL DE AYUDA Y ATAJOS -->
      <div v-if="mostrarModalAyuda" class="modal show">
        <div class="modal-content" style="max-width:550px;text-align:left">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--gray);padding-bottom:12px">
            <h3 style="margin:0;display:flex;align-items:center;gap:10px;font-size:20px;color:var(--navy)">
              <i class="ti ti-help" style="color:var(--blue);font-size:24px"></i> Ayuda del Sistema
            </h3>
            <button class="btn btn-secondary btn-sm" @click="mostrarModalAyuda = false"><i class="ti ti-x"></i> Cerrar</button>
          </div>

          <div style="font-size:15px;line-height:1.7;color:var(--text);margin-bottom:20px">
            <p style="margin-top:0;font-size:16px;color:var(--navy);font-weight:600">Atajos rápidos en el teclado:</p>
            <ul style="padding-left:24px;margin-bottom:20px">
              <li style="margin-bottom:8px"><kbd style="background:#f1f5f9;border:1px solid #cbd5e1;padding:4px 8px;border-radius:6px;font-family:monospace;font-weight:bold;color:var(--text)">Esc</kbd> : Sirve para cerrar cualquier ventana emergente o salir rápido.</li>
              <li style="margin-bottom:8px"><kbd style="background:#f1f5f9;border:1px solid #cbd5e1;padding:4px 8px;border-radius:6px;font-family:monospace;font-weight:bold;color:var(--text)">Enter</kbd> : Úselo para confirmar una búsqueda de repuesto o cobrar.</li>
            </ul>

            <div style="background:#EFF6FF;border-left:5px solid var(--blue);padding:14px 16px;border-radius:8px;font-size:15px;color:var(--navy)">
              <strong style="display:block;margin-bottom:6px;font-size:16px"><i class="ti ti-info-circle"></i> Sobre las Empresas:</strong>
              El sistema maneja dos empresas por separado.
              <br><br>
              En <strong>Venta Directa</strong> verá precios para público general (mostrador). En <strong>Distribuidora</strong> el sistema aplicará automáticamente los precios de mayorista según el cliente. Asegúrese de estar en la empresa correcta mirando la esquina superior izquierda.
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end">
            <button class="btn btn-primary btn-lg" @click="mostrarModalAyuda = false">Entendido</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Notificaciones Flotantes Toast -->
    <ToastNotification />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useArjStore } from './stores/useArjStore.js';
import { supabase } from './services/supabase.js';

// Vistas (13 Vistas)
import LoginScreen from './components/common/LoginScreen.vue';
import HeaderNav from './components/common/HeaderNav.vue';
import FacturacionView from './views/FacturacionView.vue';
import PresupuestosView from './views/PresupuestosView.vue';
import HistorialView from './views/HistorialView.vue';
import TurnosView from './views/TurnosView.vue';
import InventarioView from './views/InventarioView.vue';
import CuentasCobrarView from './views/CuentasCobrarView.vue';
import MovimientosView from './views/MovimientosView.vue';
import ClientesView from './views/ClientesView.vue';
import ReportesView from './views/ReportesView.vue';
import AlertasView from './views/AlertasView.vue';
import BitacoraView from './views/BitacoraView.vue';
import ExportarFiscalView from './views/ExportarFiscalView.vue';
import ConfigView from './views/ConfigView.vue';

// Modales
import EmpresaTransitionModal from './components/modals/EmpresaTransitionModal.vue';
import FacturaModal from './components/modals/FacturaModal.vue';
import TraspasoModal from './components/modals/TraspasoModal.vue';
import NotasEntregaModal from './components/modals/NotasEntregaModal.vue';
import EditProdModal from './components/modals/EditProdModal.vue';
import DtoDivisaModal from './components/modals/DtoDivisaModal.vue';
import DtoManualModal from './components/modals/DtoManualModal.vue';
import ModoCajaModal from './components/modals/ModoCajaModal.vue';
import AnularFacturaModal from './components/modals/AnularFacturaModal.vue';
import NuevoClienteRapidoModal from './components/modals/NuevoClienteRapidoModal.vue';
import EmbarquesModal from './components/modals/EmbarquesModal.vue';
import ListaPreciosModal from './components/modals/ListaPreciosModal.vue';
import RecepcionModal from './components/modals/RecepcionModal.vue';
import PresupuestoPreviewModal from './components/modals/PresupuestoPreviewModal.vue';
import ToastNotification from './components/common/ToastNotification.vue';

const store = useArjStore();
store.restaurarSesion(); // Restaurar sesión síncronamente antes del primer render

const mostrarModalAyuda = ref(false);

const vistasMap = {
  facturacion: FacturacionView,
  presupuestos: PresupuestosView,
  historial: HistorialView,
  turnos: TurnosView,
  inventario: InventarioView,
  cxc: CuentasCobrarView,
  movimientos: MovimientosView,
  clientes: ClientesView,
  reportes: ReportesView,
  alertas: AlertasView,
  bitacora: BitacoraView,
  exportar: ExportarFiscalView,
  config: ConfigView
};

const vistaComponenteActual = computed(() => {
  return vistasMap[store.vistaActiva] || FacturacionView;
});

onMounted(async () => {
  // Inicializar tema guardado en body
  const tema = localStorage.getItem('arj_tema');
  if (tema === 'dark') {
    document.body.classList.add('dark');
  }

  document.body.classList.add(`empresa-${store.empresa}`);

  if (store.autenticado) {
    await supabase.auth.getSession(); // Wait for Supabase to restore token
    await store.initApp();
  }
});
</script>

<style>
#arj-root {
  min-height: 100vh;
  max-width: 100vw;
  overflow-x: hidden;
}

/* Transiciones de Vista */
.view-fade-enter-active,
.view-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.view-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.view-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Transiciones globales de empresa */
.header, .sidebar, .btn, .card, .nav-item {
  transition: background-color 0.4s ease, color 0.4s ease, border-color 0.4s ease;
}


</style>
