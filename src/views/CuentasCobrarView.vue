<template>
  <div class="page active" id="page-cobrar">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="page-title"><i class="ti ti-cash"></i> Cuentas por Cobrar</h1>
        <p class="page-sub">
          Empresa: <strong>{{ store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora ARJ' }}</strong>
          · Total Deuda: <strong>{{ fmtUSD(totalCobrar) }}</strong>
        </p>
      </div>
    </div>

    <div class="help-box">
      <i class="ti ti-info-circle"></i>
      <div>
        <strong>Control de Cartera:</strong> <span style="color:var(--red);font-weight:600">Rojo</span> vencida ·
        <span style="color:#EF9F27;font-weight:600">Amarillo</span> por vencer · <span style="color:var(--green);font-weight:600">Verde</span> al día.
        Registra abonos en dólares físicos o en bolívares a la tasa oficial del día.
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card blue">
        <div class="kpi-icon"><i class="ti ti-coin"></i></div>
        <div class="kpi-label">Por cobrar total</div>
        <div class="kpi-val">{{ fmtUSD(totalCobrar) }}</div>
        <div class="kpi-sub">{{ facturasEmpresa.length }} facturas pendientes</div>
      </div>

      <div class="kpi-card red">
        <div class="kpi-icon"><i class="ti ti-alert-triangle"></i></div>
        <div class="kpi-label">Vencidas</div>
        <div class="kpi-val" style="color:var(--red)">{{ fmtUSD(totalVencidas) }}</div>
        <div class="kpi-sub">{{ facturasVencidas.length }} facturas</div>
      </div>

      <div class="kpi-card gold">
        <div class="kpi-icon"><i class="ti ti-clock"></i></div>
        <div class="kpi-label">Por vencer ≤7d</div>
        <div class="kpi-val" style="color:var(--gold)">{{ fmtUSD(totalPorVencer) }}</div>
        <div class="kpi-sub">{{ facturasPorVencer.length }} facturas</div>
      </div>

      <div class="kpi-card green">
        <div class="kpi-icon"><i class="ti ti-circle-check"></i></div>
        <div class="kpi-label">Cobrado registrado</div>
        <div class="kpi-val" style="color:var(--green)">{{ fmtUSD(totalCobrado) }}</div>
        <div class="kpi-sub">Total abonos acumulados</div>
      </div>
    </div>

    <!-- LISTADO DE DEUDAS -->
    <div style="margin-top:16px;background:#FFF;border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:14%">N° Factura</th>
            <th style="width:26%">Cliente</th>
            <th style="width:12%">Emisión</th>
            <th style="width:12%">Vencimiento</th>
            <th class="num" style="width:11%">Total</th>
            <th class="num" style="width:11%">Abonado</th>
            <th class="num" style="width:11%">Saldo Pendiente</th>
            <th class="center" style="width:13%">Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="facturasEmpresa.length === 0">
            <td colspan="8" style="text-align:center;padding:24px;color:var(--dgray)">
              No hay cuentas pendientes por cobrar en esta empresa.
            </td>
          </tr>
          <tr v-for="f in facturasEmpresa" :key="f.id">
            <td>
              <strong style="color:var(--navy)">{{ f.num }}</strong>
            </td>
            <td>
              <strong>{{ f.cliente }}</strong>
            </td>
            <td style="color:var(--dgray);font-size:12px">{{ f.fecha }}</td>
            <td>
              <span :class="['badge', estadoVencimiento(f).color]">
                {{ f.vence }} ({{ estadoVencimiento(f).texto }})
              </span>
            </td>
            <td class="num">{{ fmtUSD(f.total) }}</td>
            <td class="num" style="color:var(--green)">{{ fmtUSD(f.abonado || 0) }}</td>
            <td class="num" style="font-weight:700;color:var(--red)">
              {{ fmtUSD(f.saldo_pendiente) }}
            </td>
            <td class="center">
              <button
                class="btn btn-primary btn-sm"
                style="padding:4px 8px;font-size:11px"
                @click="abrirModalAbono(f)"
              >
                <i class="ti ti-cash"></i> Abonar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL ABONO / COBRO -->
    <div v-if="modalAbonoVisible" class="modal show">
      <div class="modal-content" style="max-width:460px;text-align:left">
        <div class="modal-icon" style="background:rgba(16,185,129,0.12);color:var(--green)">
          <i class="ti ti-cash"></i>
        </div>
        <h2>Registrar Abono a Factura</h2>
        <p class="modal-sub">
          Factura <strong>{{ facturaSeleccionada?.num }}</strong> · Cliente: <strong>{{ facturaSeleccionada?.cliente }}</strong>
          <br>Saldo pendiente: <strong style="color:var(--red)">{{ fmtUSD(facturaSeleccionada?.saldo_pendiente) }}</strong>
        </p>

        <div class="field-col" style="margin-bottom:14px">
          <label>Monto a abonar en USD:</label>
          <input
            v-model="montoAbono"
            type="number"
            step="1"
            min="1"
            :max="facturaSeleccionada?.saldo_pendiente"
            placeholder="0.00"
            class="val-input"
            style="font-size:16px;font-weight:700"
            :class="{ 'is-invalid': errors.monto }"
            @input="errors.monto = null"
          >
          <span v-if="errors.monto" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.monto }}</span>
          <div v-if="montoAbono > 0" style="font-size:12px;color:var(--text-muted);margin-top:6px">
            Equivalente a tasa BCV ({{ store.tasa_bcv }}): <strong style="color:var(--text)">{{ fmtBs(montoAbono, store.tasa_bcv) }}</strong>
          </div>
        </div>

        <div class="field-col" style="margin-bottom:16px">
          <label>Forma de recepción:</label>
          <select v-model="metodoAbono" class="val-input">
            <option value="dolar_efectivo">Dólares efectivo ($ verde)</option>
            <option value="pago_movil">Pago Móvil (Bs)</option>
            <option value="transferencia">Transferencia bancaria</option>
            <option value="zelle">Zelle / Transferencia USD</option>
          </select>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="modalAbonoVisible = false">Cancelar</button>
          <button class="btn btn-success" @click="confirmarAbono">
            <i class="ti ti-check"></i> Guardar Abono
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD, fmtBs } from '../services/pricing.js';

const store = useArjStore();
const modalAbonoVisible = ref(false);
const facturaSeleccionada = ref(null);
const montoAbono = ref(0);
const metodoAbono = ref('dolar_efectivo');
const errors = ref({});

const facturasEmpresa = computed(() => {
  const emp = store.empresa === 'directa' ? 'directa' : 'distribuidora';
  return store.facturasCobrar.filter(f => f.empresa === emp);
});

const totalCobrar = computed(() => {
  return facturasEmpresa.value.reduce((acc, f) => acc + (parseFloat(f.saldo_pendiente) || 0), 0);
});

const facturasVencidas = computed(() => {
  return facturasEmpresa.value.filter(f => (f.dias != null && f.dias <= 0));
});

const totalVencidas = computed(() => {
  return facturasVencidas.value.reduce((acc, f) => acc + (parseFloat(f.saldo_pendiente) || 0), 0);
});

const facturasPorVencer = computed(() => {
  return facturasEmpresa.value.filter(f => (f.dias != null && f.dias > 0 && f.dias <= 7));
});

const totalPorVencer = computed(() => {
  return facturasPorVencer.value.reduce((acc, f) => acc + (parseFloat(f.saldo_pendiente) || 0), 0);
});

const totalCobrado = computed(() => {
  return facturasEmpresa.value.reduce((acc, f) => acc + (parseFloat(f.abonado) || 0), 0);
});

function estadoVencimiento(f) {
  if (f.dias != null && f.dias <= 0) {
    return { color: 'badge-danger', texto: 'Vencida' };
  }
  if (f.dias != null && f.dias <= 7) {
    return { color: 'badge-warning', texto: `${f.dias}d restantes` };
  }
  return { color: 'badge-success', texto: `${f.dias || 15}d al día` };
}

function abrirModalAbono(f) {
  facturaSeleccionada.value = f;
  montoAbono.value = f.saldo_pendiente;
  modalAbonoVisible.value = true;
  errors.value = {};
}

function confirmarAbono() {
  errors.value = {};
  if (!facturaSeleccionada.value) return;
  const val = parseFloat(montoAbono.value) || 0;

  if (val <= 0) {
    errors.value.monto = 'Ingresa un monto mayor a 0';
  } else if (val > facturaSeleccionada.value.saldo_pendiente) {
    errors.value.monto = `El monto no puede superar el saldo pendiente (${fmtUSD(facturaSeleccionada.value.saldo_pendiente)})`;
  }

  if (Object.keys(errors.value).length > 0) {
    store.notif('Corrige el monto del abono', 'warning');
    return;
  }

  store.registrarCobro(facturaSeleccionada.value.id, val);
  modalAbonoVisible.value = false;
}
</script>
