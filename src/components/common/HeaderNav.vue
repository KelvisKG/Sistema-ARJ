<template>
  <div>
    <!-- HEADER CON COLOR SEGÚN EMPRESA (GOLD PARA DIRECTA / NAVY PARA DISTRIBUIDORA) -->
    <div :class="['header', store.empresa === 'directa' ? 'empresa-directa' : 'empresa-dist']" id="header">
      <div style="display:flex;align-items:center">
        <button class="hamburger-btn" @click="menuAbierto = !menuAbierto" title="Menú">
          <i class="ti ti-menu-2"></i>
        </button>
        <div class="brand">
          <i class="ti ti-building-store"></i> Sistema ARJ 
        </div>
        <div class="empresa-switch" id="empresa-switch" @click="pedirConfirmacionCambio">
          <i class="ti ti-arrows-exchange"></i>
          <span id="empresa-actual">{{ nombreEmpresaActual }}</span>
          <i class="ti ti-chevron-down" style="font-size:12px"></i>
        </div>
      </div>

      <div class="header-right">
        <div class="tasa-info" @click="store.cambiarVista('config')" title="Tasa de cambio paralela">
          <i class="ti ti-currency-dollar"></i>
          Paralelo: <strong id="tasa-par">{{ (store.tasa_par || 0).toFixed(2) }}</strong>
        </div>
        <div class="tasa-info" @click="store.cambiarVista('config')" title="Tasa oficial BCV">
          BCV: <strong id="tasa-bcv">{{ (store.tasa_bcv || 0).toFixed(2) }}</strong>
        </div>

        <button
          v-if="puedeInstalarPWA"
          class="bell-btn"
          @click="instalarPWA"
          title="Instalar Sistema ARJ en Windows (App de escritorio)"
          style="background:rgba(16,185,129,0.15);color:var(--green);border-color:rgba(16,185,129,0.3)"
          id="btn-install-pwa"
        >
          <i class="ti ti-download"></i>
        </button>

        <button
          class="bell-btn"
          @click="toggleModoOscuro"
          :title="modoOscuro ? 'Modo claro' : 'Modo oscuro'"
          id="btn-dark"
        >
          <i :class="modoOscuro ? 'ti ti-sun' : 'ti ti-moon'"></i>
        </button>

        <button class="bell-btn" @click="notifsAbiertas = !notifsAbiertas" title="Notificaciones">
          <i class="ti ti-bell"></i>
          <span class="bell-badge" id="bell-badge" v-if="totalNotifs > 0">{{ totalNotifs }}</span>
        </button>

        <div class="user-pill">
          <i class="ti ti-user"></i>
          <span id="user-name">{{ store.usuarioNombre }}</span>
          <span class="role" id="user-role">{{ store.rol.toUpperCase() }}</span>
        </div>

        <button class="panic-btn" @click="store.logout" title="Salir inmediatamente (Esc)">
          <i class="ti ti-power"></i> Salir
        </button>
      </div>
    </div>

    <!-- BANNER DE TASAS SIN CONFIRMAR (MONOLITO v13.12) -->
    <div v-if="!store.tasasConfirmadasHoy" id="banner-tasas" class="show">
      <i class="ti ti-alert-triangle" style="font-size:20px;flex:none"></i>
      <div class="bt-txt">
        <div id="bt-msg"><strong>Las tasas no se han confirmado hoy.</strong></div>
        <div class="bt-sub" id="bt-sub">Verifica la tasa BCV ({{ (store.tasa_bcv || 0).toFixed(2) }}) y Paralelo ({{ (store.tasa_par || 0).toFixed(2) }}) antes de continuar.</div>
      </div>
      <div style="display:flex;gap:6px">
        <button @click="store.cambiarVista('config')"><i class="ti ti-settings"></i> Ir a Tasas</button>
        <button style="background:var(--green)" @click="confirmarTasasRapido"><i class="ti ti-check"></i> Confirmar hoy</button>
      </div>
    </div>

    <!-- PANEL NOTIFICACIONES -->
    <div v-if="notifsAbiertas" class="notif-panel show" id="notif-panel">
      <div class="notif-panel-header">
        <span><i class="ti ti-bell-ringing"></i> Notificaciones ({{ totalNotifs }})</span>
        <span style="cursor:pointer;opacity:0.7" @click="notifsAbiertas = false"><i class="ti ti-x"></i></span>
      </div>
      <div style="padding:15px;font-size:13px">
        <div v-if="!store.tasasConfirmadasHoy" style="color:var(--red);margin-bottom:10px">
          <i class="ti ti-alert-triangle"></i> <strong>Tasas pendientes:</strong> Las tasas cambiarias no han sido confirmadas para hoy.
        </div>
        <div v-if="store.supabaseConectado" style="color:var(--green);margin-bottom:10px">
          <i class="ti ti-check"></i> Conexión en tiempo real con Supabase activa.
        </div>
        <div v-else style="color:var(--gold);margin-bottom:10px">
          <i class="ti ti-info-circle"></i> Operando en modo local resiliente (localStorage activo).
        </div>
        <div v-if="repuestosCriticosCount > 0" style="color:var(--red);margin-bottom:10px">
          <i class="ti ti-package"></i> <strong>Inventario:</strong> {{ repuestosCriticosCount }} repuestos tienen stock mínimo o agotado.
        </div>
        <div style="color:var(--dgray);font-size:12px;border-top:1px solid var(--border);padding-top:8px;margin-top:8px">
          Tasa BCV: <strong>{{ store.tasa_bcv }}</strong> · Paralelo: <strong>{{ store.tasa_par }}</strong> · Brecha: <strong>{{ store.tasa_bcv > 0 ? ((store.tasa_par / store.tasa_bcv - 1) * 100).toFixed(1) + '%' : '0%' }}</strong>
        </div>
      </div>
    </div>

    <!-- BARRA DE NAVEGACIÓN COMPLETA -->
    <div :class="['nav', { 'mobile-open': menuAbierto }]" id="nav">
      <div
        :class="['nav-item', { active: store.vistaActiva === 'facturacion' }]"
        @click="store.cambiarVista('facturacion')"
      >
        <i class="ti ti-file-invoice"></i> Facturación
      </div>

      <div
        :class="['nav-item', { active: store.vistaActiva === 'presupuestos' }]"
        @click="store.cambiarVista('presupuestos')"
      >
        <i class="ti ti-file-text"></i> Presupuestos
      </div>

      <div
        :class="['nav-item', { active: store.vistaActiva === 'historial' }]"
        @click="store.cambiarVista('historial')"
      >
        <i class="ti ti-file-text"></i> Historial
      </div>

      <div
        :class="['nav-item', { active: store.vistaActiva === 'turnos' }]"
        @click="store.cambiarVista('turnos')"
      >
        <i class="ti ti-clock-play"></i> Turnos / Caja
      </div>

      <div
        :class="['nav-item', { active: store.vistaActiva === 'inventario' }]"
        @click="store.cambiarVista('inventario')"
      >
        <i class="ti ti-package"></i> Inventario
      </div>

      <div
        :class="['nav-item', { active: store.vistaActiva === 'cxc' }]"
        @click="store.cambiarVista('cxc')"
      >
        <i class="ti ti-cash"></i> Cuentas por cobrar
      </div>

      <div
        v-if="store.rol === 'gerente'"
        :class="['nav-item', { active: store.vistaActiva === 'movimientos' }]"
        @click="store.cambiarVista('movimientos')"
      >
        <i class="ti ti-arrows-exchange"></i> Movimientos
      </div>

      <div
        :class="['nav-item', { active: store.vistaActiva === 'clientes' }]"
        @click="store.cambiarVista('clientes')"
      >
        <i class="ti ti-users"></i> Clientes
      </div>

      <div
        v-if="store.rol === 'gerente'"
        :class="['nav-item', { active: store.vistaActiva === 'reportes' }]"
        @click="store.cambiarVista('reportes')"
      >
        <i class="ti ti-chart-bar"></i> Reportes
      </div>

      <div
        v-if="store.rol === 'gerente'"
        :class="['nav-item', { active: store.vistaActiva === 'alertas' }]"
        @click="store.cambiarVista('alertas')"
      >
        <i class="ti ti-bell-ringing"></i> Alertas
      </div>

      <div
        v-if="store.rol === 'gerente'"
        :class="['nav-item', { active: store.vistaActiva === 'bitacora' }]"
        @click="store.cambiarVista('bitacora')"
      >
        <i class="ti ti-history"></i> Bitácora
      </div>

      <div
        v-if="store.rol === 'gerente'"
        :class="['nav-item', { active: store.vistaActiva === 'exportar' }]"
        @click="store.cambiarVista('exportar')"
      >
        <i class="ti ti-file-export"></i> Export. Fiscal
      </div>

      <div
        v-if="store.rol === 'gerente'"
        :class="['nav-item', { active: store.vistaActiva === 'config' }]"
        @click="store.cambiarVista('config')"
      >
        <i class="ti ti-settings"></i> Configuración
      </div>
    </div>

    <!-- MODAL CONFIRMACIÓN CAMBIO DE EMPRESA -->
    <div v-if="mostrarModalEmpresa" class="confirm-modal show" id="confirm-modal">
      <div class="confirm-box">
        <div style="font-size:42px;color:var(--gold);margin-bottom:8px">
          <i class="ti ti-alert-circle"></i>
        </div>
        <h3 id="confirm-title">¿Cambiar de empresa?</h3>
        <p id="confirm-text">
          Vas a cambiar de <strong>{{ nombreEmpresaActual }}</strong> a
          <strong>{{ store.empresa === 'directa' ? 'Distribuidora ARJ' : 'Venta Directa' }}</strong>.
          Toda la información y existencias serán de la otra empresa.
        </p>
        <div class="actions">
          <button class="btn btn-secondary" @click="mostrarModalEmpresa = false">Cancelar</button>
          <button class="btn btn-primary" @click="confirmarCambioEmpresa">Sí, cambiar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';

const store = useArjStore();
const notifsAbiertas = ref(false);
const mostrarModalEmpresa = ref(false);
const modoOscuro = ref(false);
const menuAbierto = ref(false);
const deferredPrompt = ref(null);
const puedeInstalarPWA = ref(false);

const nombreEmpresaActual = computed(() => {
  return store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora ARJ';
});

const repuestosCriticosCount = computed(() => {
  return store.productos.filter(p => (store.empresa === 'directa' ? p.stock_vd : p.stock_dist) <= 3).length;
});

const totalNotifs = computed(() => {
  let count = 1; // Notificación de estado base
  if (!store.tasasConfirmadasHoy) count++;
  if (repuestosCriticosCount.value > 0) count++;
  return count;
});

onMounted(() => {
  const temaGuardado = localStorage.getItem('arj_tema');
  if (temaGuardado === 'dark') {
    modoOscuro.value = true;
    document.body.classList.add('dark');
  } else {
    modoOscuro.value = false;
    document.body.classList.remove('dark');
  }

  // Capturar evento de instalación PWA en el navegador (Chrome / Edge)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt.value = e;
    puedeInstalarPWA.value = true;
  });

  window.addEventListener('appinstalled', () => {
    puedeInstalarPWA.value = false;
    deferredPrompt.value = null;
    store.notif('¡Sistema ARJ instalado como aplicación en Windows!', 'success');
  });

  // Listener para salir rápido con Escape si no hay modales abiertos
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (store.facturaEmitidaModal) store.cerrarFacturaModal();
      else if (store.modoCajaActivo) store.modoCajaActivo = false;
      else if (store.mostrarDtoDivisaModal) store.mostrarDtoDivisaModal = false;
      else if (store.mostrarDtoManualModal) store.mostrarDtoManualModal = false;
      else if (store.mostrarNuevoClienteModal) store.mostrarNuevoClienteModal = false;
      else if (notifsAbiertas.value) notifsAbiertas.value = false;
      else if (mostrarModalEmpresa.value) mostrarModalEmpresa.value = false;
      else if (menuAbierto.value) menuAbierto.value = false;
    }
  });
});

async function instalarPWA() {
  if (deferredPrompt.value) {
    deferredPrompt.value.prompt();
    const { outcome } = await deferredPrompt.value.userChoice;
    if (outcome === 'accepted') {
      puedeInstalarPWA.value = false;
    }
    deferredPrompt.value = null;
  }
}

function pedirConfirmacionCambio() {
  mostrarModalEmpresa.value = true;
}

function confirmarCambioEmpresa() {
  const nueva = store.empresa === 'directa' ? 'distribuidora' : 'directa';
  store.cambiarEmpresa(nueva);
  mostrarModalEmpresa.value = false;
}

function toggleModoOscuro() {
  modoOscuro.value = !modoOscuro.value;
  if (modoOscuro.value) {
    document.body.classList.add('dark');
    localStorage.setItem('arj_tema', 'dark');
  } else {
    document.body.classList.remove('dark');
    localStorage.setItem('arj_tema', 'light');
  }
}

function confirmarTasasRapido() {
  store.confirmarTasas();
  store.notif('Tasas de cambio confirmadas para hoy', 'success');
}
</script>
