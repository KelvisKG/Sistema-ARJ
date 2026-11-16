<template>
  <div class="card">
    <div class="card-tit"><i class="ti ti-database"></i> Respaldos y seguridad de datos</div>
    <div class="rp-2col">
      <div style="background:var(--lgreen);border-radius:8px;padding:16px">
        <div style="font-size:13px;font-weight:600;color:var(--green);margin-bottom:6px">
          <i class="ti ti-cloud-check"></i> Respaldo automático en la nube
        </div>
        <div style="font-size:12px;color:var(--dgray);line-height:1.6">
          Estado: <strong style="color:var(--green)">● Activo</strong> — cada factura, cliente y producto se guarda en Supabase al instante.<br>
          Cargado ahora: <strong>{{ productosCount }}</strong> productos · <strong>{{ clientesCount }}</strong> clientes · <strong>{{ facturasCount }}</strong> facturas
        </div>
      </div>
      <div style="background:var(--lblue);border-radius:8px;padding:16px">
        <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:6px">
          <i class="ti ti-shield-check"></i> Por qué descargar igual
        </div>
        <div style="font-size:12px;color:var(--dgray);line-height:1.6">
          El respaldo en la nube te protege de que se dañe la computadora.<br>
          El respaldo <strong>en tu mano</strong> te protege de un borrado por error o de perder el acceso a la cuenta.
        </div>
      </div>
    </div>

    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:16px;margin-top:14px">
      <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:12px">Descargar respaldo manual</div>
      <div class="rp-3col">
        <button
          class="btn btn-secondary"
          :disabled="!factsSemanaCount"
          :title="factsSemanaCount ? '' : 'No hay facturas esta semana'"
          @click="$emit('backup-semanal')"
        >
          <i class="ti ti-file-spreadsheet"></i> Resumen semanal ({{ factsSemanaCount }})
        </button>
        <button class="btn btn-secondary" @click="$emit('backup-completo')">
          <i class="ti ti-database-export"></i> Respaldo completo (.json)
        </button>
        <button
          class="btn btn-secondary"
          :disabled="!productosCount"
          @click="$emit('backup-inventario')"
        >
          <i class="ti ti-package"></i> Solo inventario ({{ productosCount }})
        </button>
      </div>
      <div style="background:#FFF8E1;border-left:3px solid var(--gold);border-radius:6px;padding:10px 14px;margin-top:14px;font-size:12px;color:#5D4037">
        <i class="ti ti-info-circle"></i> <strong>Rutina sugerida:</strong> cada viernes descarga el "Resumen semanal" y guárdalo en una carpeta o pendrive. Los dos primeros abren con doble clic en Excel; el <strong>.json</strong> no se lee a simple vista, pero es el que sirve para reconstruir todo si hace falta.
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
.rp-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.rp-3col {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
@media (max-width: 760px) {
  .rp-2col, .rp-3col {
    grid-template-columns: 1fr;
  }
}
</style>
