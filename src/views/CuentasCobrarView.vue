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
        <span style="color:#EF9F27;font-weight:600">Amarillo</span> vence en 7 días o menos · <span style="color:var(--green);font-weight:600">Verde</span> al día.
        Los saldos están en <strong>$BCV</strong>. En bolívares se cobra a la tasa BCV de HOY; en efectivo $, a la brecha del día.
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
        <div class="kpi-label">Abonado en pendientes</div>
        <div class="kpi-val" style="color:var(--green)">{{ fmtUSD(totalCobrado) }}</div>
        <div class="kpi-sub">De las facturas aún abiertas</div>
      </div>
    </div>

    <div v-if="clientesConDeuda.length === 0" style="text-align:center;padding:40px;color:var(--dgray);background:#FFF;border-radius:8px;border:1px solid var(--border);margin-top:16px">
      No hay cuentas pendientes por cobrar en esta empresa.
    </div>

    <div v-else style="display:grid;grid-template-columns:repeat(auto-fill, minmax(340px, 1fr));gap:16px;margin-top:16px">
      <div v-for="c in clientesConDeuda" :key="c.clave" class="card" style="padding:16px">
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

        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          <div v-for="f in c.facturas" :key="f.id" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:10px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <strong style="color:var(--navy);font-size:13px">{{ f.num }}</strong>
              <span :class="['badge', estadoVencimiento(f).color]" style="font-size:10px">
                {{ estadoVencimiento(f).texto }}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:6px">
              <span style="color:var(--dgray)">Emitida: {{ f.fecha }}<span v-if="f.vence"> · vence {{ f.vence }}</span></span>
              <span style="font-weight:700;color:var(--red)">Saldo: {{ fmtUSD(f.saldo_pendiente) }}</span>
            </div>
            <div style="background:#FFF3CD;color:#856404;padding:4px 8px;border-radius:4px;font-size:10.5px;display:flex;justify-content:space-between;margin-bottom:8px">
              <span>Cobrar HOY en Bs (tasa {{ store.tasa_bcv }}):</span>
              <strong>{{ fmtBsMonto(saldoBsHoy(f, store.estadoTasas)) }}</strong>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:6px">
              <button class="btn btn-primary btn-sm" style="padding:4px 8px;font-size:11px" :disabled="!store.supabaseConectado" @click="abrirModalAbono(f)">
                <i class="ti ti-cash"></i> Abonar
              </button>
            </div>
          </div>
        </div>

        <div style="border-top:1px solid var(--border);padding-top:12px;display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" style="flex:1" @click="copiarEstadoCuenta(c)">
            <i class="ti ti-copy"></i> Copiar estado de cuenta
          </button>
          <button class="btn btn-secondary btn-sm" style="flex:1" :disabled="!telefonoDe(c)" @click="enviarWhatsApp(c)">
            <i class="ti ti-brand-whatsapp"></i> WhatsApp
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL ABONO (v13.32 / v13.33) -->
    <div v-if="modalAbonoVisible && facturaSeleccionada" class="modal show">
      <div class="modal-content" style="max-width:500px;text-align:left">
        <div class="modal-icon" style="background:rgba(16,185,129,0.12);color:var(--green)">
          <i class="ti ti-cash"></i>
        </div>
        <h2>Registrar Abono</h2>
        <p class="modal-sub">
          Factura <strong>{{ facturaSeleccionada.num }}</strong> · {{ facturaSeleccionada.cliente }}<br>
          Saldo: <strong style="color:var(--red)">{{ fmtUSD(facturaSeleccionada.saldo_pendiente) }}</strong> $BCV
          · En Bs hoy: <strong>{{ fmtBsMonto(saldoBsHoy(facturaSeleccionada, store.estadoTasas)) }}</strong>
          · En efectivo: <strong>{{ fmtUSD(objetivoEfectivo(facturaSeleccionada, store.estadoTasas)) }}</strong>
          <span v-if="facturaSeleccionada.cobrar_verde" style="font-size:11px">(cobro acordado al emitir)</span>
        </p>

        <div class="field-col" style="margin-bottom:10px">
          <label>Forma de pago:</label>
          <select v-model="metodo" class="val-input" @change="sugerirMonto">
            <option v-for="m in METODOS_PAGO" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>

        <div class="field-col" style="margin-bottom:10px">
          <label>Monto recibido en {{ moneda === 'USD' ? 'dólares ($)' : 'bolívares (Bs)' }}:</label>
          <input v-model="montoTexto" type="text" inputmode="decimal" placeholder="0,00" class="val-input"
            style="font-size:16px;font-weight:700" :class="{ 'is-invalid': errors.monto }" @input="errors.monto = null">
          <span v-if="errors.monto" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.monto }}</span>
        </div>

        <div v-if="moneda === 'USD'" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:12px">
          <div style="font-weight:600;margin-bottom:6px">¿Cómo se acredita este pago en $?</div>
          <label style="display:block;margin-bottom:4px"><input type="radio" value="saldar" v-model="modo"> Saldar la deuda ({{ fmtUSD(facturaSeleccionada.saldo_pendiente) }})</label>
          <label style="display:block;margin-bottom:4px"><input type="radio" value="convertir" v-model="modo"> Convertir a la brecha de hoy (−{{ store.dtoDivisaPct.toFixed(1) }}%)</label>
          <label style="display:block"><input type="radio" value="cara" v-model="modo"> Valor de cara (sin convertir)</label>
        </div>

        <div class="field-col" style="margin-bottom:10px">
          <label>Referencia <span v-if="requiereReferencia(metodo)" style="color:var(--red)">*</span>:</label>
          <input v-model="referencia" type="text" class="val-input" :placeholder="requiereReferencia(metodo) ? 'Obligatoria para ' + metodo : 'Opcional'"
            :class="{ 'is-invalid': errors.ref }" @input="errors.ref = null">
          <span v-if="errors.ref" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.ref }}</span>
        </div>

        <div v-if="vistaPrevia" :style="{ fontSize: '12.5px', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', background: vistaPrevia.ok ? '#E8F5E9' : '#FDECEA', color: vistaPrevia.ok ? '#1B5E20' : '#B00020' }">
          <template v-if="vistaPrevia.ok">
            Acredita <strong>{{ fmtUSD(vistaPrevia.acreditaUSD) }}</strong> · el saldo queda en
            <strong>{{ fmtUSD(Math.max(0, facturaSeleccionada.saldo_pendiente - vistaPrevia.acreditaUSD)) }}</strong>
          </template>
          <template v-else>{{ vistaPrevia.error }}</template>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" :disabled="store.procesando" @click="modalAbonoVisible = false">Cancelar</button>
          <button class="btn btn-success" :disabled="store.procesando || !vistaPrevia || !vistaPrevia.ok" @click="confirmarAbono">
            <i class="ti ti-check"></i> {{ store.procesando ? 'Guardando...' : 'Guardar Abono' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD, fmtBsMonto } from '../services/pricing.js';
import {
  METODOS_PAGO, monedaDeMetodo, requiereReferencia, parseMontoVE, calcularAbono, saldoBsHoy, objetivoEfectivo
} from '../services/cobros.js';

const store = useArjStore();
const modalAbonoVisible = ref(false);
const facturaSeleccionada = ref(null);
const metodo = ref('Efectivo USD');
const montoTexto = ref('');
const modo = ref('saldar');
const referencia = ref('');
const errors = ref({});

const moneda = computed(() => monedaDeMetodo(metodo.value));


const facturasEmpresa = computed(() => store.facturasCobrar.filter(f => f.empresa === store.empresa));

const clientesConDeuda = computed(() => {
  const map = new Map();
  facturasEmpresa.value.forEach(f => {
    const clave = f.cliente_id || f.cliente;
    if (!map.has(clave)) map.set(clave, { clave, cliente: f.cliente, cliente_id: f.cliente_id, facturas: [], totalDeuda: 0 });
    const c = map.get(clave);
    c.facturas.push(f);
    c.totalDeuda += f.saldo_pendiente || 0;
  });
  return Array.from(map.values()).sort((a, b) => b.totalDeuda - a.totalDeuda);
});

const totalCobrar = computed(() => facturasEmpresa.value.reduce((a, f) => a + (f.saldo_pendiente || 0), 0));
const facturasVencidas = computed(() => facturasEmpresa.value.filter(f => f.dias !== null && f.dias < 0));
const totalVencidas = computed(() => facturasVencidas.value.reduce((a, f) => a + f.saldo_pendiente, 0));
const facturasPorVencer = computed(() => facturasEmpresa.value.filter(f => f.dias !== null && f.dias >= 0 && f.dias <= 7));
const totalPorVencer = computed(() => facturasPorVencer.value.reduce((a, f) => a + f.saldo_pendiente, 0));
const totalCobrado = computed(() => facturasEmpresa.value.reduce((a, f) => a + (f.abonado || 0), 0));

// M-04: sin fecha de vencimiento (contado) no se marca "Vencida"
function estadoVencimiento(f) {
  if (f.dias === null || f.dias === undefined) return { color: 'badge-info', texto: f.tipo_pago === 'credito' ? 'Crédito' : 'Contado con saldo' };
  if (f.dias < 0) return { color: 'badge-danger', texto: `Vencida hace ${Math.abs(f.dias)}d` };
  if (f.dias === 0) return { color: 'badge-warning', texto: 'Vence hoy' };
  if (f.dias <= 7) return { color: 'badge-warning', texto: `${f.dias}d restantes` };
  return { color: 'badge-success', texto: `${f.dias}d al día` };
}

function abrirModalAbono(f) {
  facturaSeleccionada.value = f;
  metodo.value = 'Efectivo USD';
  modo.value = 'saldar';
  referencia.value = '';
  errors.value = {};
  sugerirMonto();
  modalAbonoVisible.value = true;
}

function sugerirMonto() {
  const f = facturaSeleccionada.value;
  if (!f) return;
  const m = moneda.value === 'USD' ? objetivoEfectivo(f, store.estadoTasas) : saldoBsHoy(f, store.estadoTasas);
  montoTexto.value = (Math.round(m * 100) / 100).toFixed(2).replace('.', ',');
}

const vistaPrevia = computed(() => {
  const f = facturaSeleccionada.value;
  if (!f) return null;
  const montoIn = parseMontoVE(montoTexto.value);
  if (!(montoIn > 0)) return null;
  return calcularAbono({ f, montoIn, moneda: moneda.value, modo: modo.value, estado: store.estadoTasas });
});

watch(modo, () => { errors.value = {}; });

async function confirmarAbono() {
  errors.value = {};
  const montoIn = parseMontoVE(montoTexto.value);
  if (!(montoIn > 0)) errors.value.monto = 'Ingresa un monto mayor a 0';
  if (requiereReferencia(metodo.value) && !referencia.value.trim()) errors.value.ref = 'La referencia es obligatoria para ' + metodo.value;
  if (Object.keys(errors.value).length) return;

  const r = await store.registrarCobro(facturaSeleccionada.value.id, {
    montoIn, moneda: moneda.value, modo: modo.value, metodo: metodo.value, ref: referencia.value
  });
  if (!r.ok) {
    if (r.error) store.notif('❌ Abono NO registrado: ' + r.error, 'error');
    return;
  }
  store.notif(`✓ Abono de ${fmtUSD(r.acreditaUSD)} registrado. Saldo: ${fmtUSD(r.saldo)}`, 'success');
  modalAbonoVisible.value = false;
}

// ── Estado de cuenta ──
function telefonoDe(c) {
  const cli = store.clientes.find(x => x.id === c.cliente_id);
  return cli ? (cli.tel || (cli.contacto_principal && cli.contacto_principal.tel) || '') : '';
}

function textoEstadoCuenta(c) {
  const emp = store.empresa === 'directa' ? 'ARJ Venta Directa' : 'Distribuidora ARJ';
  const lineas = c.facturas.map(f => `• ${f.num} (${f.fecha}) — saldo ${fmtUSD(f.saldo_pendiente)}` + (f.vence ? `, vence ${f.vence}` : ''));
  const bs = c.facturas.reduce((a, f) => a + saldoBsHoy(f, store.estadoTasas), 0);
  return `Estado de cuenta — ${emp}\nCliente: ${c.cliente}\n\n${lineas.join('\n')}\n\nTotal: ${fmtUSD(c.totalDeuda)}` +
    `\nEn bolívares hoy (tasa BCV ${store.tasa_bcv}): ${fmtBsMonto(bs)}`;
}

async function copiarEstadoCuenta(c) {
  try {
    await navigator.clipboard.writeText(textoEstadoCuenta(c));
    store.notif('Estado de cuenta copiado al portapapeles', 'success');
  } catch (e) {
    store.notif('No se pudo copiar: ' + e.message, 'error');
  }
}

function enviarWhatsApp(c) {
  let tel = telefonoDe(c).replace(/\D/g, '');
  if (!tel) return;
  if (tel.startsWith('0')) tel = '58' + tel.slice(1);
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(textoEstadoCuenta(c))}`, '_blank');
}
</script>
