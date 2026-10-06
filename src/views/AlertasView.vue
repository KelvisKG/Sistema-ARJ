<template>
  <div class="page active" id="page-alertas">
    <h1 class="page-title"><i class="ti ti-bell-ringing"></i> Alertas inteligentes</h1>
    <p class="page-sub">El sistema detecta patrones anormales y te avisa antes de que sea tarde</p>

    <div class="help-box">
      <i class="ti ti-info-circle"></i>
      <div>
        <strong>¿Qué detecta?</strong> Existencias críticas de repuestos agrícolas, facturas en mora de clientes, brecha cambiaria desactualizada, turnos pendientes de arqueo y márgenes comerciales reducidos. No reemplaza tu criterio — te ayuda a no perder de vista lo importante.
      </div>
    </div>

    <!-- 4 KPI CARDS -->
    <div class="kpi-grid">
      <div class="kpi-card red">
        <div class="kpi-icon"><i class="ti ti-alert-octagon"></i></div>
        <div class="kpi-label">Alertas críticas</div>
        <div class="kpi-val" style="color:var(--red)">{{ alertasCriticas.length }}</div>
        <div class="kpi-sub">requieren acción inmediata</div>
      </div>

      <div class="kpi-card gold">
        <div class="kpi-icon"><i class="ti ti-alert-triangle"></i></div>
        <div class="kpi-label">Advertencias</div>
        <div class="kpi-val" style="color:var(--gold)">{{ alertasWarning.length }}</div>
        <div class="kpi-sub">revisar pronto</div>
      </div>

      <div class="kpi-card blue">
        <div class="kpi-icon"><i class="ti ti-info-circle"></i></div>
        <div class="kpi-label">Informativas</div>
        <div class="kpi-val">{{ alertasInfo.length }}</div>
        <div class="kpi-sub">solo aviso del sistema</div>
      </div>

      <div class="kpi-card green">
        <div class="kpi-icon"><i class="ti ti-check"></i></div>
        <div class="kpi-label">Resueltas hoy</div>
        <div class="kpi-val" style="color:var(--green)">{{ resueltasHoyCount }}</div>
        <div class="kpi-sub">ya atendidas por gerencia</div>
      </div>
    </div>

    <!-- FILTROS DE ALERTAS -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <button
        :class="['filtro-alerta', { active: filtroActivo === 'todas' }]"
        @click="filtroActivo = 'todas'"
      >
        <i class="ti ti-list"></i> Todas ({{ listaFiltrada.length }})
      </button>

      <button
        :class="['filtro-alerta', { active: filtroActivo === 'critica' }]"
        @click="filtroActivo = 'critica'"
      >
        <i class="ti ti-alert-octagon"></i> Críticas ({{ alertasCriticas.length }})
      </button>

      <button
        :class="['filtro-alerta', { active: filtroActivo === 'warning' }]"
        @click="filtroActivo = 'warning'"
      >
        <i class="ti ti-alert-triangle"></i> Advertencias ({{ alertasWarning.length }})
      </button>

      <button
        :class="['filtro-alerta', { active: filtroActivo === 'info' }]"
        @click="filtroActivo = 'info'"
      >
        <i class="ti ti-info-circle"></i> Informativas ({{ alertasInfo.length }})
      </button>
    </div>

    <!-- LISTA DE TARJETAS DE ALERTA -->
    <div id="alertas-list" style="display:flex;flex-direction:column;gap:10px">
      <div
        v-for="alerta in listaFiltrada"
        :key="alerta.id"
        :class="['card', `alerta-card-${alerta.tipo}`]"
        style="margin-bottom:0;display:flex;justify-content:space-between;align-items:center;padding:14px 18px"
      >
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div
            :style="{
              fontSize: '24px',
              color: alerta.tipo === 'critica' ? 'var(--red)' : alerta.tipo === 'warning' ? 'var(--gold)' : 'var(--blue)'
            }"
          >
            <i :class="alerta.icono"></i>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <strong style="font-size:14px">{{ alerta.titulo }}</strong>
              <span
                :class="[
                  'badge',
                  alerta.tipo === 'critica' ? 'badge-danger' : alerta.tipo === 'warning' ? 'badge-warning' : 'badge-primary'
                ]"
              >
                {{ alerta.modulo }}
              </span>
            </div>
            <p style="font-size:12.5px;color:var(--dgray);margin:0;line-height:1.4">
              {{ alerta.descripcion }}
            </p>
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-shrink:0">
          <button
            class="btn btn-secondary btn-sm"
            @click="irAAccion(alerta.ruta)"
          >
            {{ alerta.textoAccion }}
          </button>
          <button
            class="btn btn-primary btn-sm"
            @click="marcarResuelta(alerta.id)"
          >
            <i class="ti ti-check"></i> Atender
          </button>
        </div>
      </div>

      <div
        v-if="listaFiltrada.length === 0"
        style="padding:40px 20px;text-align:center;color:var(--dgray);background:var(--card-bg);border:1px solid var(--border);border-radius:8px"
      >
        <i class="ti ti-circle-check" style="font-size:32px;color:var(--green);display:block;margin-bottom:8px"></i>
        <strong>¡Sin alertas pendientes en esta categoría!</strong>
        <p style="font-size:12px;margin:4px 0 0">Todo el inventario, cuentas y tasas se encuentran bajo parámetros normales.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';

const store = useArjStore();
const filtroActivo = ref('todas');
const resueltasHoyCount = ref(0);
const resueltasIds = ref(new Set());

// Alertas dinámicas derivadas del estado del sistema
const todasLasAlertas = computed(() => {
  const list = [];

  // 1. Alerta de tasas sin confirmar
  if (!store.tasasConfirmadasHoy && !resueltasIds.value.has('alerta-tasas')) {
    list.push({
      id: 'alerta-tasas',
      tipo: 'warning',
      icono: 'ti ti-currency-dollar',
      modulo: 'Cambiario',
      titulo: 'Tasas de cambio no confirmadas hoy',
      descripcion: `La tasa BCV (${store.tasa_bcv}) y Paralelo (${store.tasa_par}) no han sido ratificadas formalmente para la jornada de hoy.`,
      textoAccion: 'Ir a Tasas',
      ruta: 'config'
    });
  }

  // 2. Alertas de inventario crítico
  const stockDirectaCritico = store.productos.filter(p => (p.stock_vd || 0) <= 3);
  if (stockDirectaCritico.length > 0 && !resueltasIds.value.has('alerta-stock')) {
    list.push({
      id: 'alerta-stock',
      tipo: 'critica',
      icono: 'ti ti-package',
      modulo: 'Inventario',
      titulo: `${stockDirectaCritico.length} repuestos con stock crítico en mostrador`,
      descripcion: `Productos como "${stockDirectaCritico[0]?.desc}" tienen 3 o menos unidades disponibles en Venta Directa.`,
      textoAccion: 'Ver en Almacén',
      ruta: 'inventario'
    });
  }

  // 3. Alertas de cuentas por cobrar vencidas
  // f.dias = días que FALTAN para vencer (negativo = vencida)
  const facturasVencidas = store.facturasCobrar.filter(f => f.dias !== null && f.dias < -30);
  if (facturasVencidas.length > 0 && !resueltasIds.value.has('alerta-cxc')) {
    list.push({
      id: 'alerta-cxc',
      tipo: 'critica',
      icono: 'ti ti-clock-alert',
      modulo: 'Cobranzas',
      titulo: `${facturasVencidas.length} facturas con más de 30 días de mora`,
      descripcion: `Existen documentos pendientes por cobrar que superan el límite de crédito comercial establecido.`,
      textoAccion: 'Gestionar Cobros',
      ruta: 'cxc'
    });
  }

  // 4. Alerta de turno de caja
  if (store.turnoActual && !resueltasIds.value.has('alerta-turno')) {
    list.push({
      id: 'alerta-turno',
      tipo: 'info',
      icono: 'ti ti-clock-play',
      modulo: 'Caja Chica',
      titulo: `Turno de caja abierto desde ${store.turnoActual.fecha_apertura}`,
      descripcion: `Turno de ${store.turnoActual.cajero}. Recuerda cerrarlo con el arqueo al final de la jornada.`,
      textoAccion: 'Ver Turnos',
      ruta: 'turnos'
    });
  }

  // 5. Alerta de cotizaciones por vencer
  const cotizacionesActivas = store.presupuestos.filter(p => p.empresa === store.empresa && p.estado === 'por_vencer');
  if (cotizacionesActivas.length > 0 && !resueltasIds.value.has('alerta-presupuestos')) {
    list.push({
      id: 'alerta-presupuestos',
      tipo: 'info',
      icono: 'ti ti-file-certificate',
      modulo: 'Ventas',
      titulo: `${cotizacionesActivas.length} presupuestos vencen en 5 días o menos`,
      descripcion: `Haz seguimiento para convertirlos en factura antes de que venzan (vigencia de 45 días).`,
      textoAccion: 'Ver Presupuestos',
      ruta: 'presupuestos'
    });
  }

  return list;
});

const alertasCriticas = computed(() => todasLasAlertas.value.filter(a => a.tipo === 'critica'));
const alertasWarning = computed(() => todasLasAlertas.value.filter(a => a.tipo === 'warning'));
const alertasInfo = computed(() => todasLasAlertas.value.filter(a => a.tipo === 'info'));

const listaFiltrada = computed(() => {
  if (filtroActivo.value === 'critica') return alertasCriticas.value;
  if (filtroActivo.value === 'warning') return alertasWarning.value;
  if (filtroActivo.value === 'info') return alertasInfo.value;
  return todasLasAlertas.value;
});

function marcarResuelta(id) {
  resueltasIds.value.add(id);
  resueltasHoyCount.value++;
  store.notif('Alerta marcada como atendida por el operador', 'success');
}

function irAAccion(ruta) {
  store.cambiarVista(ruta);
}
</script>

<style scoped>
.filtro-alerta {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--dgray);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12.5px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
  transition: all 0.15s;
}

.filtro-alerta:hover {
  background: rgba(0, 0, 0, 0.04);
  color: var(--text);
}

.filtro-alerta.active {
  background: var(--navy);
  color: #FFF;
  border-color: var(--navy);
}

.alerta-card-critica {
  border-left: 4px solid var(--red);
}

.alerta-card-warning {
  border-left: 4px solid var(--gold);
}

.alerta-card-info {
  border-left: 4px solid var(--blue);
}
</style>
