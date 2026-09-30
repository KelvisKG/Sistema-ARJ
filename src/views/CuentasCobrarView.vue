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

    <!-- LISTADO DE DEUDAS POR CLIENTE (CARDS) -->
    <div v-if="clientesConDeuda.length === 0" style="text-align:center;padding:40px;color:var(--dgray);background:#FFF;border-radius:8px;border:1px solid var(--border);margin-top:16px">
      No hay cuentas pendientes por cobrar en esta empresa.
    </div>

    <div v-else style="display:grid;grid-template-columns:repeat(auto-fill, minmax(340px, 1fr));gap:16px;margin-top:16px">
      <div v-for="c in clientesConDeuda" :key="c.cliente" class="card" style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <h3 style="margin:0;color:var(--navy);font-size:16px">{{ c.cliente }}</h3>
            <div style="font-size:12px;color:var(--dgray)">{{ c.facturas.length }} documentos pendientes</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--dgray)">Deuda Total</div>
            <div style="font-size:18px;font-weight:800;color:var(--red)">{{ fmtUSD(c.totalDeuda) }}</div>
          </div>
        </div>

        <!-- FACTURAS DEL CLIENTE -->
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          <div v-for="f in c.facturas" :key="f.id" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:10px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <strong style="color:var(--navy);font-size:13px">{{ f.num }}</strong>
              <span :class="['badge', estadoVencimiento(f).color]" style="font-size:10px">
                {{ f.vence }} ({{ estadoVencimiento(f).texto }})
              </span>
            </div>
            
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:6px">
              <span style="color:var(--dgray)">Emitida: {{ f.fecha }}</span>
              <span style="font-weight:700;color:var(--red)">Saldo: {{ fmtUSD(f.saldo_pendiente) }}</span>
            </div>
            
            <!-- Resguardo de tasa visual (Simulado si no hay tasa_origen) -->
            <div style="background:#FFF3CD;color:#856404;padding:4px 8px;border-radius:4px;font-size:10.5px;display:flex;justify-content:space-between;margin-bottom:8px">
              <span>Resguardo de Tasa:</span>
              <strong v-if="f.tasa_bcv">Emisión: Bs {{ f.tasa_bcv }} <i class="ti ti-arrow-right"></i> Hoy: Bs {{ store.tasa_bcv }}</strong>
              <strong v-else>No req. cobertura</strong>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:6px">
              <button class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:11px" @click="store.notif('Módulo Nota de Crédito en desarrollo', 'info')">
                <i class="ti ti-receipt-refund"></i> N. Crédito
              </button>
              <button class="btn btn-primary btn-sm" style="padding:4px 8px;font-size:11px" @click="abrirModalAbono(f)">
                <i class="ti ti-cash"></i> Abonar
              </button>
            </div>
          </div>
        </div>

        <!-- ACCIONES DE CLIENTE -->
        <div style="border-top:1px solid var(--border);padding-top:12px;display:flex;justify-content:center">
          <button class="btn btn-secondary btn-sm" style="width:100%" @click="store.notif('Estado de cuenta enviado al correo del cliente', 'success')">
            <i class="ti ti-mail"></i> Enviar Edo. Cuenta al Cliente
          </button>
        </div>
      </div>
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

const clientesConDeuda = computed(() => {
  const map = new Map();
  facturasEmpresa.value.forEach(f => {
    if (!map.has(f.cliente)) {
      map.set(f.cliente, { cliente: f.cliente, facturas: [], totalDeuda: 0 });
    }
    const c = map.get(f.cliente);
    c.facturas.push(f);
    c.totalDeuda += (parseFloat(f.saldo_pendiente) || 0);
  });
  return Array.from(map.values()).sort((a,b) => b.totalDeuda - a.totalDeuda);
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

async function confirmarAbono() {
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

  await store.registrarCobro(facturaSeleccionada.value.id, val, metodoAbono.value);
  modalAbonoVisible.value = false;
}
</script>
