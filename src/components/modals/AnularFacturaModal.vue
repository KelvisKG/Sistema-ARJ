<template>
  <!-- Anular factura (monolito v13) -->
  <div v-if="store.modalAnularActivo && store.facturaAAnular" class="modal show" id="modal-anular">
    <div class="modal-content" style="max-width:520px;text-align:left">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:12px">
        <div>
          <h2 style="margin:0;text-align:left;color:var(--red)"><i class="ti ti-file-x"></i> Anular factura</h2>
          <p style="margin:3px 0 0;color:var(--dgray);font-size:13px">{{ f.num }} · {{ f.cliente }}</p>
        </div>
        <button class="btn btn-secondary btn-sm" @click="cerrar"><i class="ti ti-x"></i></button>
      </div>
      <div style="background:#FCEBEB;border:1px solid #F09595;border-left:4px solid var(--red);border-radius:6px;padding:10px 12px;font-size:12.5px;color:var(--red);margin-bottom:14px">
        <i class="ti ti-alert-triangle"></i> <strong>Acción irreversible.</strong> El stock será devuelto al inventario,
        la factura quedará marcada como ANULADA y los pagos registrados serán reversados.
      </div>
      <!-- ¿Tiene abonos? → advertir cuánto dinero hay que devolver al cliente -->
      <div v-if="abonado > 0.009" style="background:#FFF8E1;border:1px solid #E6C860;border-left:4px solid var(--gold);border-radius:6px;padding:10px 12px;font-size:12.5px;color:#5D4037;margin-bottom:14px">
        <i class="ti ti-cash-banknote"></i> <strong>Esta factura tiene abonos por {{ fmtUSD(abonado) }}.</strong><br>
        Al anular debes devolver ese dinero al cliente: <strong>{{ fmtUSD(abonado) }}</strong> o su equivalente hoy
        <strong>{{ fmtBsMonto(abonado * colchonFactor() * store.tasa_bcv) }}</strong>. La devolución quedará registrada.
      </div>
      <div class="field-row" style="flex-direction:column;align-items:flex-start;gap:6px">
        <label>Motivo de la anulación (obligatorio):</label>
        <textarea v-model="motivo" placeholder="Ej: Cliente devolvió la mercancía sin abrir, error en facturación..."
          style="width:100%;min-height:80px;background:#FFF;border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:13px;font-family:inherit;resize:vertical"></textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;padding-top:12px;border-top:1px solid var(--gray)">
        <button class="btn btn-secondary" @click="cerrar">Cancelar</button>
        <button class="btn btn-red" :disabled="store.procesando" @click="confirmarAnulacion"><i class="ti ti-trash"></i> Anular factura</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD, fmtBsMonto, colchonFactor } from '../../services/pricing.js';

const store = useArjStore();
const motivo = ref('');
const f = computed(() => store.facturaAAnular || {});
const abonado = computed(() => parseFloat(f.value.abonado) || 0);

watch(() => store.modalAnularActivo, abierto => { if (abierto) motivo.value = ''; });

function cerrar() {
  store.modalAnularActivo = false;
  store.facturaAAnular = null;
  motivo.value = '';
}

async function confirmarAnulacion() {
  const fac = store.facturaAAnular;
  if (!fac) return;
  if (!motivo.value.trim()) { store.notif('Debes indicar el motivo de la anulación', 'error'); return; }
  if (fac.estado === 'anulada') { store.notif('Esta factura ya está anulada', 'warning'); cerrar(); return; }
  const ok = await store.anularFactura(fac.id, motivo.value.trim());
  if (ok) {
    if (store.facturaReciente && store.facturaReciente.id === fac.id) store.modalFacturaActivo = false;
    cerrar();
  }
}
</script>
