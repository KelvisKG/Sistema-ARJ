<template>
  <div class="dash-card-dark">
    <div class="dash-card-header">
      <div class="dash-title-wrap">
        <div class="dash-icon-badge blue-glow">
          <i class="ti ti-database"></i>
        </div>
        <div>
          <h3 class="dash-card-title">Respaldos y seguridad de datos</h3>
          <div class="dash-card-sub">Exportación manual y sincronización persistente en la nube</div>
        </div>
      </div>
    </div>

    <div class="backup-status-grid">
      <!-- Estado en la nube -->
      <div class="backup-box-cloud">
        <div class="box-title-row">
          <i class="ti ti-cloud-check icon-green"></i>
          <span class="box-title">Respaldo automático en la nube</span>
          <span class="kpi-pill pill-green">
            <i class="ti ti-point-filled"></i> Activo
          </span>
        </div>
        <div class="box-description">
          Cada factura, cliente y producto se sincroniza y respalda en tiempo real en Supabase.<br>
          <div class="sync-count-strip">
            <span class="count-pill"><strong>{{ productosCount }}</strong> productos</span>
            <span class="count-pill"><strong>{{ clientesCount }}</strong> clientes</span>
            <span class="count-pill"><strong>{{ facturasCount }}</strong> facturas</span>
          </div>
        </div>
      </div>

      <!-- Respaldo en mano -->
      <div class="backup-box-hand">
        <div class="box-title-row">
          <i class="ti ti-shield-check icon-blue"></i>
          <span class="box-title">Copia de resguardo local</span>
        </div>
        <div class="box-description">
          El respaldo en la nube protege de fallas de hardware. Disponer de una copia local descargada previene pérdidas accidentales y garantiza soberanía de tus datos.
        </div>
      </div>
    </div>

    <!-- Acciones de descarga -->
    <div class="manual-downloads-card">
      <div class="downloads-header-title">Generar copias de seguridad inmediatas</div>
      <div class="downloads-buttons-grid">
        <button
          class="btn-backup-item"
          :disabled="!factsSemanaCount"
          :title="factsSemanaCount ? '' : 'No hay facturas en los últimos 7 días'"
          @click="$emit('backup-semanal')"
        >
          <div class="btn-backup-icon icon-green">
            <i class="ti ti-file-spreadsheet"></i>
          </div>
          <div class="btn-backup-text">
            <span class="backup-main-lbl">Resumen semanal</span>
            <span class="backup-sub-lbl">{{ factsSemanaCount }} facturas en Excel/CSV</span>
          </div>
        </button>

        <button class="btn-backup-item" @click="$emit('backup-completo')">
          <div class="btn-backup-icon icon-blue">
            <i class="ti ti-database-export"></i>
          </div>
          <div class="btn-backup-text">
            <span class="backup-main-lbl">Respaldo completo</span>
            <span class="backup-sub-lbl">Volcado total (.json)</span>
          </div>
        </button>

        <button
          class="btn-backup-item"
          :disabled="!productosCount"
          @click="$emit('backup-inventario')"
        >
          <div class="btn-backup-icon icon-gold">
            <i class="ti ti-package"></i>
          </div>
          <div class="btn-backup-text">
            <span class="backup-main-lbl">Solo inventario</span>
            <span class="backup-sub-lbl">{{ productosCount }} productos en CSV</span>
          </div>
        </button>
      </div>

      <div class="routine-advice-box">
        <i class="ti ti-info-circle"></i>
        <span><strong>Recomendación operativa:</strong> Cada viernes descarga el "Resumen semanal" y almacénalo en una unidad externa. El archivo <strong>.json</strong> contiene la estructura completa del sistema para restauraciones.</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
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
  }
});

defineEmits(['backup-semanal', 'backup-completo', 'backup-inventario']);
</script>

<style scoped>
.dash-card-dark {
  background: #0E1726;
  background: linear-gradient(145deg, #101B2E 0%, #0A111E 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 4px 14px 0 rgba(0, 0, 0, 0.25);
  margin-bottom: 18px;
}

.dash-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.dash-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dash-icon-badge {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.blue-glow {
  background: rgba(37, 99, 235, 0.16);
  color: #38BDF8;
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.dash-card-title {
  font-size: 15px;
  font-weight: 700;
  color: #F8FAFC;
  margin: 0;
  letter-spacing: -0.01em;
}

.dash-card-sub {
  font-size: 11.5px;
  color: #94A3B8;
  margin-top: 2px;
}

.backup-status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 16px;
}

@media (max-width: 760px) {
  .backup-status-grid {
    grid-template-columns: 1fr;
  }
}

.backup-box-cloud {
  background: rgba(16, 185, 129, 0.06);
  border: 1px solid rgba(16, 185, 129, 0.18);
  border-radius: 12px;
  padding: 14px 16px;
}

.backup-box-hand {
  background: rgba(37, 99, 235, 0.06);
  border: 1px solid rgba(56, 189, 248, 0.18);
  border-radius: 12px;
  padding: 14px 16px;
}

.box-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.box-title {
  font-size: 13px;
  font-weight: 700;
  color: #F8FAFC;
}

.icon-green {
  color: #34D399;
}

.icon-blue {
  color: #38BDF8;
}

.icon-gold {
  color: #FBBF24;
}

.box-description {
  font-size: 11.5px;
  color: #94A3B8;
  line-height: 1.5;
}

.sync-count-strip {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.count-pill {
  font-size: 10.5px;
  padding: 2px 7px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  color: #CBD5E1;
}

.count-pill strong {
  color: #34D399;
}

/* Sección de descargas manuales */
.manual-downloads-card {
  background: #0B1220;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
}

.downloads-header-title {
  font-size: 12px;
  font-weight: 700;
  color: #F8FAFC;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 12px;
}

.downloads-buttons-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

@media (max-width: 760px) {
  .downloads-buttons-grid {
    grid-template-columns: 1fr;
  }
}

.btn-backup-item {
  background: #101B2E;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.btn-backup-item:hover:not(:disabled) {
  background: #17263F;
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.btn-backup-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-backup-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.btn-backup-text {
  display: flex;
  flex-direction: column;
}

.backup-main-lbl {
  font-size: 12.5px;
  font-weight: 700;
  color: #F8FAFC;
}

.backup-sub-lbl {
  font-size: 10.5px;
  color: #94A3B8;
  margin-top: 1px;
}

.routine-advice-box {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 8px;
  padding: 10px 14px;
  margin-top: 14px;
  font-size: 11.5px;
  color: #FBBF24;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.5;
}

.routine-advice-box strong {
  color: #FDE68A;
}

/* Píldoras reutilizables */
.kpi-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.pill-green {
  background: rgba(16, 185, 129, 0.15);
  color: #34D399;
  border: 1px solid rgba(16, 185, 129, 0.25);
}
</style>
