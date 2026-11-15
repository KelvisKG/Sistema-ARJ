<template>
  <!-- Anular factura (monolito v13) -->
  <div v-if="store.modalAnularActivo && store.facturaAAnular" class="modal show" id="modal-anular">
    <div class="modal-content me-caja me-media">
      <header class="me-cab">
        <span class="me-icono rojo"><i class="ti ti-file-x"></i></span>
        <div class="me-titulo">
          <h2>Anular factura</h2>
          <p>{{ f.num }} · {{ f.cliente }}</p>
        </div>
        <button type="button" class="me-cerrar" title="Cerrar" aria-label="Cerrar" @click="cerrar"><i class="ti ti-x"></i></button>
      </header>

      <div class="me-cuerpo me-cols">
        <div>
          <section class="me-panel">
            <div class="me-etq">Total de la factura</div>
            <div class="me-grande">{{ fmtBCV(f.total) }}</div>
            <div class="me-etq" style="margin-top:12px">Si la anulas:</div>
            <ul class="me-lista">
              <li><i class="ti ti-package"></i> El stock vuelve al inventario.</li>
              <li><i class="ti ti-ban"></i> La factura queda marcada como ANULADA.</li>
              <li><i class="ti ti-arrow-back-up"></i> Los pagos registrados se reversan.</li>
            </ul>
          </section>
        </div>
        <div>
          <!-- ¿Tiene abonos? → advertir cuánto dinero hay que devolver al cliente -->
          <div v-if="abonado > 0.009" class="me-aviso oro">
            <i class="ti ti-cash-banknote"></i>
            <div>Esta factura tiene abonos. <strong>Debes devolverle al cliente {{ fmtBCV(abonado) }}</strong> o su equivalente hoy, <strong>{{ fmtBsMonto(abonado * colchonFactor() * store.tasa_bcv) }}</strong>. La devolución quedará registrada.</div>
          </div>
          <div class="me-aviso rojo"><i class="ti ti-alert-triangle"></i><div><strong>Esta acción no se puede deshacer.</strong></div></div>
          <section class="me-paso">
            <label class="me-lbl" for="anular-motivo">¿Por qué se anula? (obligatorio)</label>
            <textarea id="anular-motivo" v-model="motivo" class="me-area" placeholder="Ej: Cliente devolvió la mercancía sin abrir, error en facturación..."></textarea>
          </section>
        </div>
      </div>

      <footer class="me-pie">
        <button type="button" class="btn btn-secondary" @click="cerrar">Cancelar</button>
        <button type="button" class="btn btn-red" :disabled="store.procesando" @click="confirmarAnulacion"><i class="ti ti-trash"></i> Anular factura</button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtBCV, fmtBsMonto, colchonFactor } from '../../services/pricing.js';

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
