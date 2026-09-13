<template>
  <div class="page active" id="page-turnos">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="page-title"><i class="ti ti-clock-play"></i> Control de Turnos y Caja Chica</h1>
        <p class="page-sub">Apertura, arqueo en tiempo real, registro de efectivo y cierre de caja</p>
      </div>
      <div>
        <button
          v-if="!store.turnoActual"
          class="btn btn-green"
          @click="mostrarModalAbrir = true"
        >
          <i class="ti ti-plus"></i> Abrir Nuevo Turno
        </button>
        <button
          v-else
          class="btn btn-danger"
          @click="mostrarModalCerrar = true"
        >
          <i class="ti ti-lock"></i> Cerrar Turno Actual
        </button>
      </div>
    </div>

    <!-- ESTADO DEL TURNO VIGENTE -->
    <div v-if="store.turnoActual" class="card" style="border-left:4px solid var(--green);margin-bottom:16px">
      <div class="card-tit" style="color:var(--green)">
        <i class="ti ti-circle-check"></i> Turno en Curso · {{ store.turnoActual.cajero }}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:10px">
        <div>
          <span style="font-size:11px;color:var(--dgray)">Apertura:</span>
          <div style="font-weight:700">{{ store.turnoActual.fecha_apertura }}</div>
        </div>
        <div>
          <span style="font-size:11px;color:var(--dgray)">Fondo Inicial USD:</span>
          <div style="font-weight:700;color:var(--navy)">{{ fmtUSD(store.turnoActual.inicial_usd) }}</div>
        </div>
        <div>
          <span style="font-size:11px;color:var(--dgray)">Fondo Inicial Bs:</span>
          <div style="font-weight:700;color:var(--navy)">Bs. {{ store.turnoActual.inicial_bs.toLocaleString('es-VE') }}</div>
        </div>
        <div>
          <span style="font-size:11px;color:var(--dgray)">Estado:</span>
          <div><span class="badge badge-success">ABIERTO / FACTURANDO</span></div>
        </div>
      </div>
    </div>

    <div v-else class="card" style="background:#FFF8E1;border-left:4px solid var(--gold);margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px">
        <i class="ti ti-alert-triangle" style="font-size:24px;color:var(--gold)"></i>
        <div>
          <strong>No hay un turno de caja abierto actualmente.</strong>
          <p style="font-size:12px;color:var(--dgray);margin:2px 0 0">
            Abre un turno para asentar el fondo en caja en dólares y bolívares y controlar el arqueo.
          </p>
        </div>
      </div>
    </div>

    <!-- HISTORIAL DE TURNOS -->
    <div class="card">
      <div class="card-tit"><i class="ti ti-history"></i> Historial de Turnos de Caja</div>
      <table class="tbl" style="margin-top:10px">
        <thead>
          <tr>
            <th>Cajero</th>
            <th>Apertura</th>
            <th>Cierre</th>
            <th class="num">Fondo Inicial ($)</th>
            <th class="num">Arqueo Cierre ($)</th>
            <th class="center">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in store.turnos" :key="t.id">
            <td><strong>{{ t.cajero }}</strong></td>
            <td style="font-size:12px">{{ t.fecha_apertura }}</td>
            <td style="font-size:12px;color:var(--dgray)">{{ t.fecha_cierre || 'En curso' }}</td>
            <td class="num">{{ fmtUSD(t.inicial_usd) }}</td>
            <td class="num" style="font-weight:700">{{ t.arqueo_usd ? fmtUSD(t.arqueo_usd) : '—' }}</td>
            <td class="center">
              <span :class="['badge', t.estado === 'abierto' ? 'badge-success' : 'badge-secondary']">
                {{ t.estado.toUpperCase() }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL ABRIR TURNO -->
    <!-- MODAL ABRIR TURNO -->
    <div v-if="mostrarModalAbrir" class="modal show">
      <div class="modal-content" style="max-width:440px;text-align:left">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:10px">
          <h3 style="margin:0"><i class="ti ti-plus" style="color:var(--green)"></i> Abrir Turno de Caja</h3>
          <button class="btn btn-secondary btn-sm" @click="mostrarModalAbrir = false"><i class="ti ti-x"></i></button>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Fondo Inicial en Efectivo ($ USD) *</label>
          <input v-model.number="fondoUSD" type="number" step="5" placeholder="100.00" class="val-input" style="font-weight:700"
            :class="{ 'is-invalid': errorsAbrir.fondoUSD }" @input="errorsAbrir.fondoUSD = null">
          <span v-if="errorsAbrir.fondoUSD" class="field-error"><i class="ti ti-alert-circle"></i> {{ errorsAbrir.fondoUSD }}</span>
        </div>

        <div class="field-col" style="margin-bottom:16px">
          <label>Fondo Inicial en Efectivo (Bolívares Bs) *</label>
          <input v-model.number="fondoBs" type="number" step="100" placeholder="2000.00" class="val-input" style="font-weight:700"
            :class="{ 'is-invalid': errorsAbrir.fondoBs }" @input="errorsAbrir.fondoBs = null">
          <span v-if="errorsAbrir.fondoBs" class="field-error"><i class="ti ti-alert-circle"></i> {{ errorsAbrir.fondoBs }}</span>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="mostrarModalAbrir = false">Cancelar</button>
          <button class="btn btn-green" @click="confirmarApertura"><i class="ti ti-check"></i> Iniciar Turno</button>
        </div>
      </div>
    </div>

    <!-- MODAL CERRAR TURNO -->
    <div v-if="mostrarModalCerrar" class="modal show">
      <div class="modal-content" style="max-width:460px;text-align:left">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:10px">
          <h3 style="margin:0;color:var(--red)"><i class="ti ti-lock"></i> Arqueo y Cierre de Turno</h3>
          <button class="btn btn-secondary btn-sm" @click="mostrarModalCerrar = false"><i class="ti ti-x"></i></button>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Efectivo Físico en Caja ($ USD) *</label>
          <input v-model.number="cierreUSD" type="number" step="1" placeholder="0.00" class="val-input" style="font-weight:700"
            :class="{ 'is-invalid': errorsCerrar.usd }" @input="errorsCerrar.usd = null">
          <span v-if="errorsCerrar.usd" class="field-error"><i class="ti ti-alert-circle"></i> {{ errorsCerrar.usd }}</span>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Efectivo Físico en Caja (Bolívares Bs) *</label>
          <input v-model.number="cierreBs" type="number" step="10" placeholder="0.00" class="val-input" style="font-weight:700"
            :class="{ 'is-invalid': errorsCerrar.bs }" @input="errorsCerrar.bs = null">
          <span v-if="errorsCerrar.bs" class="field-error"><i class="ti ti-alert-circle"></i> {{ errorsCerrar.bs }}</span>
        </div>

        <div class="field-col" style="margin-bottom:16px">
          <label>Observaciones o Novedades del Arqueo</label>
          <textarea v-model="notasCierre" placeholder="Notas de diferencias, billetes deteriorados..." class="val-input" style="min-height:70px"></textarea>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="mostrarModalCerrar = false">Cancelar</button>
          <button class="btn btn-danger" @click="confirmarCierre"><i class="ti ti-lock"></i> Cerrar Caja y Generar Acta</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD } from '../services/pricing.js';
import { generarActaCierrePDF } from '../services/exportService.js';

const store = useArjStore();
const mostrarModalAbrir = ref(false);
const mostrarModalCerrar = ref(false);

const fondoUSD = ref(100);
const fondoBs = ref(2000);
const cierreUSD = ref(0);
const cierreBs = ref(0);
const notasCierre = ref('');
const errorsAbrir = ref({});
const errorsCerrar = ref({});

function confirmarApertura() {
  errorsAbrir.value = {};

  if (fondoUSD.value < 0) {
    errorsAbrir.value.fondoUSD = 'El fondo no puede ser negativo';
  }
  if (fondoBs.value < 0) {
    errorsAbrir.value.fondoBs = 'El fondo no puede ser negativo';
  }
  if (fondoUSD.value <= 0 && fondoBs.value <= 0) {
    errorsAbrir.value.fondoUSD = 'Indica al menos un fondo inicial';
  }

  if (Object.keys(errorsAbrir.value).length > 0) {
    store.notif('Corrige los campos marcados en rojo', 'warning');
    return;
  }

  store.abrirTurno(fondoUSD.value, fondoBs.value);
  mostrarModalAbrir.value = false;
}

function confirmarCierre() {
  errorsCerrar.value = {};

  if (cierreUSD.value < 0) {
    errorsCerrar.value.usd = 'El monto no puede ser negativo';
  }
  if (cierreBs.value < 0) {
    errorsCerrar.value.bs = 'El monto no puede ser negativo';
  }

  if (Object.keys(errorsCerrar.value).length > 0) {
    store.notif('Corrige los campos marcados en rojo', 'warning');
    return;
  }

  // Capturar datos del turno antes de que el store lo limpie
  const turnoParaPDF = {
    ...store.turnoActual,
    arqueo_usd: cierreUSD.value,
    arqueo_bs: cierreBs.value,
    notas_cierre: notasCierre.value,
    fecha_cierre: new Date().toLocaleString('es-VE')
  };

  store.cerrarTurno(cierreUSD.value, cierreBs.value, notasCierre.value);
  mostrarModalCerrar.value = false;

  // Generar el acta PDF automáticamente
  generarActaCierrePDF(turnoParaPDF, store.empresa);
}
</script>
