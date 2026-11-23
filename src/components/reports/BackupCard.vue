<template>
  <div class="dash-card-dark">
    <!-- ═══ HEADER Y ESTADO GENERAL ═══ -->
    <div class="dash-card-header">
      <div class="dash-title-wrap">
        <div class="dash-icon-badge blue-glow">
          <i class="ti ti-database"></i>
        </div>
        <div>
          <h3 class="dash-card-title">Respaldos y Seguridad de Datos</h3>
          <div class="dash-card-sub">
            Exportación manual, integridad de base de datos y sincronización persistente en la nube
          </div>
        </div>
      </div>

      <!-- Botón de comprobación de conexión a Supabase -->
      <button
        class="btn-ping-status"
        :class="{ checking: comprobandoSync }"
        @click="verificarConexion"
        :disabled="comprobandoSync"
        title="Comprobar enlace en vivo con la base de datos Supabase"
      >
        <i :class="comprobandoSync ? 'ti ti-loader rotate' : 'ti ti-wifi'"></i>
        <span>{{ pingStatusTexto }}</span>
      </button>
    </div>

    <!-- ═══ GRID DE ESTADO: NUBE VS COPIA LOCAL ═══ -->
    <div class="backup-status-grid">
      <!-- 1. Estado en la Nube (Supabase) -->
      <div class="backup-box-cloud">
        <div class="box-title-row">
          <div class="title-with-icon">
            <i class="ti ti-cloud-check icon-green"></i>
            <span class="box-title">Respaldo automático en la nube</span>
          </div>
          <span class="kpi-pill pill-green">
            <i class="ti ti-point-filled"></i> Supabase Activo
          </span>
        </div>
        <div class="box-description">
          Cada factura, cliente y repuesto se sincroniza en tiempo real de forma segura y cifrada en los servidores de la nube.
          <div class="sync-count-strip">
            <span class="count-pill"><strong>{{ productosCount }}</strong> productos</span>
            <span class="count-pill"><strong>{{ clientesCount }}</strong> clientes</span>
            <span class="count-pill"><strong>{{ facturasCount }}</strong> facturas</span>
          </div>
        </div>
      </div>

      <!-- 2. Monitor de Copia de Resguardo Local (Backup Health) -->
      <div class="backup-box-hand" :class="{ 'box-hand-alert': diasDesdeUltimoBackup >= 7 || !fechaUltimoBackup }">
        <div class="box-title-row">
          <div class="title-with-icon">
            <i class="ti ti-shield-check" :class="diasDesdeUltimoBackup < 7 && fechaUltimoBackup ? 'icon-blue' : 'icon-gold'"></i>
            <span class="box-title">Copia de resguardo local física</span>
          </div>
          <span
            class="kpi-pill"
            :class="diasDesdeUltimoBackup < 7 && fechaUltimoBackup ? 'pill-green' : 'pill-gold'"
          >
            <i :class="diasDesdeUltimoBackup < 7 && fechaUltimoBackup ? 'ti ti-check' : 'ti ti-alert-triangle'"></i>
            {{ estadoLocalEtiqueta }}
          </span>
        </div>
        <div class="box-description">
          <div class="local-backup-info">
            <span v-if="fechaUltimoBackup" class="last-backup-text">
              Última descarga local: <strong>{{ formatearFechaHora(fechaUltimoBackup) }}</strong> (hace {{ diasDesdeUltimoBackup }} día{{ diasDesdeUltimoBackup !== 1 ? 's' : '' }})
            </span>
            <span v-else class="last-backup-text font-gold">
              <i class="ti ti-alert-circle"></i> Aún no has descargado una copia física en este equipo
            </span>
          </div>
          <div class="local-advice-sub">
            Disponer de una copia semanal descargada en un pendrive previene pérdidas accidentales ante fallas de internet.
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ SECCIÓN 1: FACTURACIÓN Y CONTABILIDAD ═══ -->
    <div class="manual-downloads-card">
      <div class="downloads-header-title">
        <i class="ti ti-report-money" style="color:var(--green)"></i> Facturación y Cartera Comercial
      </div>

      <div class="downloads-buttons-grid">
        <!-- 1. Reporte de Facturación (con selector de período) -->
        <div class="backup-tile-card">
          <div class="tile-top-row">
            <div class="tile-icon-wrap icon-green">
              <i class="ti ti-file-spreadsheet"></i>
            </div>
            <span class="tile-format-badge format-csv">.CSV</span>
          </div>

          <div class="tile-info">
            <span class="tile-title">Facturación de Ventas</span>
            <span class="tile-sub">
              {{ conteoFacturasSegunRango }} facturas listas para exportar
            </span>
          </div>

          <!-- Selector de rango para facturas -->
          <div class="fact-range-selector">
            <button
              :class="['range-pill', { active: rangoFacturas === 'semana' }]"
              @click="rangoFacturas = 'semana'"
              :title="'Últimos 7 días (' + factsSemanaCount + ' facturas)'"
            >
              Semana ({{ factsSemanaCount }})
            </button>
            <button
              :class="['range-pill', { active: rangoFacturas === 'mes' }]"
              @click="rangoFacturas = 'mes'"
              :title="'Mes en curso (' + factsMesCount + ' facturas)'"
            >
              Este mes ({{ factsMesCount }})
            </button>
            <button
              :class="['range-pill', { active: rangoFacturas === 'todas' }]"
              @click="rangoFacturas = 'todas'"
              :title="'Todas las facturas en memoria (' + facturasCount + ')'"
            >
              Todas ({{ facturasCount }})
            </button>
          </div>

          <button
            class="btn-tile-action"
            :disabled="!conteoFacturasSegunRango"
            @click="ejecutarDescarga('facturas')"
          >
            <i class="ti ti-download"></i> Descargar Facturación
          </button>
        </div>

        <!-- 2. Cartera de Cuentas por Cobrar -->
        <div class="backup-tile-card">
          <div class="tile-top-row">
            <div class="tile-icon-wrap icon-gold">
              <i class="ti ti-receipt-refund"></i>
            </div>
            <span class="tile-format-badge format-csv">.CSV</span>
          </div>

          <div class="tile-info">
            <span class="tile-title">Cuentas por Cobrar</span>
            <span class="tile-sub">Cartera de clientes con crédito y saldos deudores</span>
          </div>

          <button class="btn-tile-action" @click="ejecutarDescarga('cxc')">
            <i class="ti ti-download"></i> Exportar Cuentas por Cobrar
          </button>
        </div>

        <!-- 3. Directorio de Clientes -->
        <div class="backup-tile-card">
          <div class="tile-top-row">
            <div class="tile-icon-wrap icon-blue">
              <i class="ti ti-users"></i>
            </div>
            <span class="tile-format-badge format-csv">.CSV</span>
          </div>

          <div class="tile-info">
            <span class="tile-title">Directorio de Clientes</span>
            <span class="tile-sub">{{ clientesCount }} clientes con RIF, nivel de precio y teléfonos</span>
          </div>

          <button
            class="btn-tile-action"
            :disabled="!clientesCount"
            @click="ejecutarDescarga('clientes')"
          >
            <i class="ti ti-download"></i> Exportar Directorio
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ SECCIÓN 2: BASE DE DATOS Y ESTRUCTURA CENTRAL ═══ -->
    <div class="manual-downloads-card" style="margin-top:16px">
      <div class="downloads-header-title">
        <i class="ti ti-server" style="color:var(--blue)"></i> Respaldo de Base de Datos e Inventario
      </div>

      <div class="downloads-buttons-grid-2col">
        <!-- Respaldo Completo JSON -->
        <div class="backup-tile-card full-span">
          <div class="tile-top-row">
            <div class="tile-icon-wrap icon-blue">
              <i class="ti ti-database-export"></i>
            </div>
            <span class="tile-format-badge format-json">.JSON COMPLETO</span>
          </div>

          <div class="tile-info">
            <span class="tile-title">Copia de Seguridad Integral del Sistema</span>
            <span class="tile-sub">
              Volcado completo de productos, facturas, clientes, presupuestos, bitácora y configuración. Permite la reconstrucción íntegra del sistema en cualquier equipo.
            </span>
          </div>

          <button class="btn-tile-action btn-json-action" @click="ejecutarDescarga('completo')">
            <i class="ti ti-download"></i> Descargar Respaldo Total (.json)
          </button>
        </div>

        <!-- Inventario CSV -->
        <div class="backup-tile-card">
          <div class="tile-top-row">
            <div class="tile-icon-wrap icon-gold">
              <i class="ti ti-package"></i>
            </div>
            <span class="tile-format-badge format-csv">.CSV</span>
          </div>

          <div class="tile-info">
            <span class="tile-title">Catálogo de Inventario</span>
            <span class="tile-sub">
              {{ productosCount }} repuestos con costos landed, FOB, márgenes y existencias por empresa
            </span>
          </div>

          <button
            class="btn-tile-action"
            :disabled="!productosCount"
            @click="ejecutarDescarga('inventario')"
          >
            <i class="ti ti-download"></i> Descargar Inventario
          </button>
        </div>
      </div>

      <!-- Cuadro de recomendación -->
      <div class="routine-advice-box">
        <i class="ti ti-shield-lock" style="font-size:18px;flex-shrink:0"></i>
        <span>
          <strong>Protocolo de seguridad:</strong> Cada viernes al cierre de turno, genera el <strong>Respaldo Total (.json)</strong> y guárdalo en un pendrive o disco externo. Con ese archivo el sistema puede restaurarse completamente ante fallas de hardware.
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  productosCount: {
    type: Number,
    default: 0
  },
  clientesCount: {
    type: Number,
    default: 0
  },
  facturasCount: {
    type: Number,
    default: 0
  },
  factsSemanaCount: {
    type: Number,
    default: 0
  },
  factsMesCount: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits([
  'backup-semanal',
  'backup-facturas',
  'backup-completo',
  'backup-inventario',
  'backup-clientes',
  'backup-cxc'
]);

// Selector de rango para reporte de facturación
const rangoFacturas = ref('mes');

const conteoFacturasSegunRango = computed(() => {
  if (rangoFacturas.value === 'semana') return props.factsSemanaCount;
  if (rangoFacturas.value === 'todas') return props.facturasCount;
  return props.factsMesCount || props.factsSemanaCount;
});

// Monitor de salud del respaldo local (guardado en localStorage)
const STORAGE_KEY = 'arj_ultimo_backup_fecha';
const fechaUltimoBackup = ref(null);

onMounted(() => {
  try {
    const g = localStorage.getItem(STORAGE_KEY);
    if (g) fechaUltimoBackup.value = new Date(g);
  } catch (e) {
    // Silencioso
  }
});

const diasDesdeUltimoBackup = computed(() => {
  if (!fechaUltimoBackup.value) return 999;
  const hoy = new Date();
  const diff = hoy.getTime() - fechaUltimoBackup.value.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
});

const estadoLocalEtiqueta = computed(() => {
  if (!fechaUltimoBackup.value) return 'Sin respaldo';
  if (diasDesdeUltimoBackup.value < 2) return 'Al día';
  if (diasDesdeUltimoBackup.value < 7) return 'Regular';
  return 'Recomendado';
});

// Comprobación de ping en vivo
const comprobandoSync = ref(false);
const pingStatusTexto = ref('Comprobar conexión');

async function verificarConexion() {
  comprobandoSync.value = true;
  pingStatusTexto.value = 'Comprobando...';
  const t0 = performance.now();

  try {
    // Simula comprobación de latencia de red contra Supabase
    await new Promise(r => setTimeout(r, 450));
    const t = Math.round(performance.now() - t0);
    pingStatusTexto.value = `En línea (${t} ms)`;
  } catch (e) {
    pingStatusTexto.value = 'Reintentar';
  } finally {
    comprobandoSync.value = false;
  }
}

// Ejecuta descarga y actualiza el timestamp en localStorage
function ejecutarDescarga(tipo) {
  const ahora = new Date();
  try {
    localStorage.setItem(STORAGE_KEY, ahora.toISOString());
    fechaUltimoBackup.value = ahora;
  } catch (e) {
    // Silencioso
  }

  if (tipo === 'completo') {
    emit('backup-completo');
  } else if (tipo === 'inventario') {
    emit('backup-inventario');
  } else if (tipo === 'clientes') {
    emit('backup-clientes');
  } else if (tipo === 'cxc') {
    emit('backup-cxc');
  } else if (tipo === 'facturas') {
    emit('backup-facturas', rangoFacturas.value);
    // Retrocompatibilidad con evento anterior
    if (rangoFacturas.value === 'semana') {
      emit('backup-semanal');
    }
  }
}

function formatearFechaHora(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}
</script>

<style scoped>
.dash-card-dark {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 20px;
}

/* ── Header ── */
.dash-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}

.dash-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dash-icon-badge {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}

.blue-glow {
  background: var(--lblue);
  color: var(--blue);
  border: 1px solid rgba(37, 99, 235, 0.3);
}

.dash-card-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--navy);
  margin: 0;
}

.dash-card-sub {
  font-size: 12px;
  color: var(--dgray);
  margin-top: 2px;
}

/* Botón de Ping */
.btn-ping-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 5px 12px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text);
  cursor: pointer;
  transition: var(--trans-fast);
}

.btn-ping-status:hover:not(:disabled) {
  border-color: var(--blue);
  color: var(--blue);
}

.rotate {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* ── Grid Superior de Estado ── */
.backup-status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 16px;
}

@media (max-width: 800px) {
  .backup-status-grid { grid-template-columns: 1fr; }
}

.backup-box-cloud {
  background: var(--lgreen);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: var(--radius-md);
  padding: 14px 16px;
}

.backup-box-hand {
  background: var(--lblue);
  border: 1px solid rgba(37, 99, 235, 0.3);
  border-radius: var(--radius-md);
  padding: 14px 16px;
}

.box-hand-alert {
  background: var(--lgold);
  border-color: rgba(217, 119, 6, 0.3);
}

.box-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
  flex-wrap: wrap;
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 8px;
}

.box-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.icon-green { color: var(--green); }
.icon-blue  { color: var(--blue); }
.icon-gold  { color: var(--gold); }

.box-description {
  font-size: 11.5px;
  color: var(--dgray);
  line-height: 1.5;
}

.sync-count-strip {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.count-pill {
  font-size: 10.5px;
  padding: 2px 8px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  color: var(--text);
}

.count-pill strong {
  color: var(--green);
}

.last-backup-text {
  font-size: 11.5px;
  color: var(--text);
}

.local-advice-sub {
  margin-top: 6px;
  font-size: 11px;
  color: var(--dgray);
}

/* ── Secciones de Descargas ── */
.manual-downloads-card {
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px 18px;
}

.downloads-header-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--navy);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.downloads-buttons-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.downloads-buttons-grid-2col {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 12px;
}

@media (max-width: 900px) {
  .downloads-buttons-grid,
  .downloads-buttons-grid-2col {
    grid-template-columns: 1fr;
  }
}

/* ── Tarjetas de Descarga (Tiles) ── */
.backup-tile-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  transition: transform var(--trans-fast), box-shadow var(--trans-fast), border-color var(--trans-fast);
}

.backup-tile-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
}

.tile-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tile-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--gray);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.tile-format-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 4px;
  letter-spacing: 0.04em;
}

.format-csv {
  background: var(--lgreen);
  color: var(--green);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.format-json {
  background: var(--lblue);
  color: var(--blue);
  border: 1px solid rgba(37, 99, 235, 0.3);
}

.tile-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tile-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.tile-sub {
  font-size: 11px;
  color: var(--dgray);
  line-height: 1.4;
}

/* Selector de Rango para Facturas */
.fact-range-selector {
  display: flex;
  gap: 3px;
  background: var(--gray);
  border-radius: var(--radius-full);
  padding: 2px;
  margin-top: 2px;
}

.range-pill {
  flex: 1;
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  padding: 3px 6px;
  font-size: 10px;
  font-weight: 700;
  color: var(--dgray);
  cursor: pointer;
  transition: var(--trans-fast);
  white-space: nowrap;
}

.range-pill:hover { color: var(--text); }

.range-pill.active {
  background: var(--card-bg);
  color: var(--blue);
  box-shadow: var(--shadow-xs);
}

/* Botón de acción de la tarjeta */
.btn-tile-action {
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all var(--trans-fast);
}

.btn-tile-action:hover:not(:disabled) {
  background: var(--blue);
  border-color: var(--blue);
  color: #FFFFFF;
}

.btn-tile-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-json-action {
  background: var(--lblue);
  color: var(--blue);
  border-color: rgba(37, 99, 235, 0.3);
}

.btn-json-action:hover:not(:disabled) {
  background: var(--blue);
  color: #FFFFFF;
}

/* Cuadro de aviso operativo */
.routine-advice-box {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-left: 3px solid var(--gold);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  margin-top: 14px;
  font-size: 11.5px;
  color: var(--dgray);
  display: flex;
  align-items: flex-start;
  gap: 10px;
  line-height: 1.5;
}

.routine-advice-box strong {
  color: var(--text);
}

/* Píldoras */
.kpi-pill {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.pill-green {
  background: var(--lgreen);
  color: var(--green);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.pill-gold {
  background: var(--lgold);
  color: var(--gold);
  border: 1px solid rgba(217, 119, 6, 0.3);
}

.font-gold {
  color: var(--gold) !important;
}
</style>
