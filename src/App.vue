<template>
  <div id="arj-root">
    <!-- Pantalla de Login si no está autenticado -->
    <LoginScreen v-if="!store.autenticado" />

    <!-- Sistema Principal -->
    <div v-else :class="['app-wrapper', `empresa-${store.empresa}`]">
      <!-- Header y Barra de Navegación -->
      <HeaderNav />

      <!-- Vistas Principales (13 Vistas Completas del Monolito) -->
      <main class="main-content" style="padding:14px 20px 40px">
        <FacturacionView v-if="store.vistaActiva === 'facturacion'" />
        <PresupuestosView v-else-if="store.vistaActiva === 'presupuestos'" />
        <HistorialView v-else-if="store.vistaActiva === 'historial'" />
        <TurnosView v-else-if="store.vistaActiva === 'turnos'" />
        <InventarioView v-else-if="store.vistaActiva === 'inventario'" />
        <CuentasCobrarView v-else-if="store.vistaActiva === 'cxc'" />
        <MovimientosView v-else-if="store.vistaActiva === 'movimientos'" />
        <ClientesView v-else-if="store.vistaActiva === 'clientes'" />
        <ReportesView v-else-if="store.vistaActiva === 'reportes'" />
        <AlertasView v-else-if="store.vistaActiva === 'alertas'" />
        <BitacoraView v-else-if="store.vistaActiva === 'bitacora'" />
        <ExportarFiscalView v-else-if="store.vistaActiva === 'exportar'" />
        <ConfigView v-else-if="store.vistaActiva === 'config'" />
      </main>

      <!-- Modales Globales del Sistema -->
      <FacturaModal />
      <TraspasoModal />
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

      <div class="shortcut-hint" id="shortcut-hint">
        <i class="ti ti-keyboard"></i> Tip: presiona <kbd>Esc</kbd> para cerrar o salir rápido
      </div>

      <!-- MODAL DE AYUDA Y ATAJOS -->
      <div v-if="mostrarModalAyuda" class="modal show">
        <div class="modal-content" style="max-width:500px;text-align:left">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:10px">
            <h3 style="margin:0;display:flex;align-items:center;gap:8px">
              <i class="ti ti-help" style="color:var(--blue)"></i> Atajos y Ayuda del Sistema
            </h3>
            <button class="btn btn-secondary btn-sm" @click="mostrarModalAyuda = false"><i class="ti ti-x"></i></button>
          </div>

          <div style="font-size:13px;line-height:1.6;color:var(--text);margin-bottom:14px">
            <p style="margin-top:0"><strong>Atajos de Teclado Rápidos:</strong></p>
            <ul style="padding-left:20px;margin-bottom:14px">
              <li><kbd style="background:#eee;border:1px solid #ccc;padding:2px 6px;border-radius:4px;font-family:monospace">Esc</kbd> : Cerrar modal activo o salir rápido de mostrador.</li>
              <li><kbd style="background:#eee;border:1px solid #ccc;padding:2px 6px;border-radius:4px;font-family:monospace">Enter</kbd> : Confirmar selección en buscador y formularios de pago.</li>
              <li><kbd style="background:#eee;border:1px solid #ccc;padding:2px 6px;border-radius:4px;font-family:monospace">F4</kbd> : Alternar entre Venta Directa y Distribuidora.</li>
            </ul>

            <div style="background:#EBF3FB;border-left:4px solid var(--blue);padding:10px 12px;border-radius:4px;font-size:12px;color:var(--navy)">
              <strong>Punto de Venta Dual:</strong>
              En <strong>Venta Directa</strong> los precios son de mostrador en $ BCV. En <strong>Distribuidora</strong> se aplican los niveles de precio por volumen (T1, T2, T3) según el cliente.
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end">
            <button class="btn btn-primary" @click="mostrarModalAyuda = false">Entendido</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Notificaciones Flotantes Toast -->
    <ToastNotification />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useArjStore } from './stores/useArjStore.js';

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
import FacturaModal from './components/modals/FacturaModal.vue';
import TraspasoModal from './components/modals/TraspasoModal.vue';
import EditProdModal from './components/modals/EditProdModal.vue';
import DtoDivisaModal from './components/modals/DtoDivisaModal.vue';
import DtoManualModal from './components/modals/DtoManualModal.vue';
import ModoCajaModal from './components/modals/ModoCajaModal.vue';
import AnularFacturaModal from './components/modals/AnularFacturaModal.vue';
import NuevoClienteRapidoModal from './components/modals/NuevoClienteRapidoModal.vue';
import EmbarquesModal from './components/modals/EmbarquesModal.vue';
import ListaPreciosModal from './components/modals/ListaPreciosModal.vue';
import RecepcionModal from './components/modals/RecepcionModal.vue';
import ToastNotification from './components/common/ToastNotification.vue';

const store = useArjStore();
const mostrarModalAyuda = ref(false);

onMounted(async () => {
  // Inicializar tema guardado en body
  const tema = localStorage.getItem('arj_tema');
  if (tema === 'dark') {
    document.body.classList.add('dark');
  }

  await store.initApp();
  document.body.classList.add(`empresa-${store.empresa}`);
});
</script>

<style>
#arj-root {
  min-height: 100vh;
}

.shortcut-hint {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: rgba(31, 56, 100, 0.88);
  color: #FFF;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 11.5px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  z-index: 6000;
  backdrop-filter: blur(4px);
}

.shortcut-hint kbd {
  background: rgba(255, 255, 255, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: inherit;
  font-weight: 700;
}
</style>
