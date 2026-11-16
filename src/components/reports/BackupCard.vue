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
/* ── Card wrapper ───────────────────────────────────────────── */
.dash-card-dark {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 18px 20px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 18px;
}

/* ── Header ─────────────────────────────────────────────────── */
.dash-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.dash-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dash-icon-badge {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.blue-glow {
  background: var(--lblue);
  color: var(--blue);
  border: 1px solid var(--blue);
}

.dash-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--navy);
  margin: 0;
  letter-spacing: -0.01em;
}

.dash-card-sub {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* ── Status grid (cloud + local) ───────────────────────────── */
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
  background: var(--lgreen);
  border: 1px solid var(--green);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  transition: box-shadow var(--trans-fast);
}

.backup-box-cloud:hover {
  box-shadow: var(--shadow-sm);
}

.backup-box-hand {
  background: var(--lblue);
  border: 1px solid var(--blue);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  transition: box-shadow var(--trans-fast);
}

.backup-box-hand:hover {
  box-shadow: var(--shadow-sm);
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
  color: var(--text);
}

/* ── Semantic icon colors ───────────────────────────────────── */
.icon-green {
  color: var(--green);
}

.icon-blue {
  color: var(--blue);
}

.icon-gold {
  color: var(--gold);
}

.box-description {
  font-size: 11.5px;
  color: var(--dgray);
  line-height: 1.5;
}

/* ── Count pills (record badges) ────────────────────────────── */
.sync-count-strip {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.count-pill {
  font-size: 10.5px;
  padding: 2px 8px;
  background: var(--lblue);
  border: 1px solid var(--blue);
  border-radius: var(--radius-full);
  color: var(--blue);
}

.count-pill strong {
  color: var(--blue);
}

/* ── Manual downloads section ───────────────────────────────── */
.manual-downloads-card {
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px;
}

.downloads-header-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--navy);
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

/* ── Backup action tiles ────────────────────────────────────── */
.btn-backup-item {
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  text-align: left;
  transition: border-color var(--trans-fast), background var(--trans-fast), transform var(--trans-fast), box-shadow var(--trans-fast);
}

.btn-backup-item:hover:not(:disabled) {
  background: var(--lblue);
  border-color: var(--blue);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.btn-backup-item:active:not(:disabled) {
  transform: translateY(0);
}

.btn-backup-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-backup-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--card-bg);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  transition: background var(--trans-fast), border-color var(--trans-fast);
}

.btn-backup-item:hover:not(:disabled) .btn-backup-icon {
  background: var(--lblue);
  border-color: var(--blue);
}

.btn-backup-text {
  display: flex;
  flex-direction: column;
}

.backup-main-lbl {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text);
}

.backup-sub-lbl {
  font-size: 10.5px;
  color: var(--text-muted);
  margin-top: 1px;
}

/* ── Routine advice notice ──────────────────────────────────── */
.routine-advice-box {
  background: var(--lgold);
  border: 1px solid var(--gold);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  margin-top: 14px;
  font-size: 11.5px;
  color: var(--gold);
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.5;
}

.routine-advice-box strong {
  color: var(--gold);
  font-weight: 700;
}

/* ── Reusable pills ─────────────────────────────────────────── */
.kpi-pill {
  font-size: 10px;
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
  border: 1px solid var(--green);
}
</style>
