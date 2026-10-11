<template>
  <div class="page active" id="page-cobrar">
    <h1 class="page-title"><i class="ti ti-cash"></i> Cuentas por Cobrar</h1>
    <p class="page-sub">Empresa: <strong>{{ store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora' }}</strong></p>

    <div class="help-box">
      <i class="ti ti-info-circle"></i>
      <div><strong>Código de colores:</strong> <span style="color:var(--red);font-weight:600">Rojo</span> vencida ·
        <span style="color:#EF9F27;font-weight:600">Amarillo</span> por vencer · <span style="color:var(--green);font-weight:600">Verde</span> al día.</div>
    </div>

    <!-- Los abonos exigen las tasas confirmadas hoy (el servidor lo valida, sql/08) -->
    <div v-if="!store.tasasConfirmadasHoy" style="background:#FDECEA;border-left:4px solid var(--red);color:#842029;padding:9px 12px;border-radius:6px;font-size:12.5px;margin-bottom:12px">
      <i class="ti ti-lock"></i> <strong>No se pueden registrar abonos:</strong> las tasas de hoy no están confirmadas. El gerente debe confirmarlas primero.
    </div>

    <div class="kpi-grid">
      <div class="kpi-card blue">
        <div class="kpi-icon"><i class="ti ti-coin"></i></div>
        <div class="kpi-label">Por cobrar total</div>
        <div class="kpi-val">{{ fmtUSD(kpis.total) }}</div>
        <div class="kpi-sub">{{ facturas.length }} factura(s)</div>
      </div>
      <div class="kpi-card red">
        <div class="kpi-icon"><i class="ti ti-alert-triangle"></i></div>
        <div class="kpi-label">Vencidas</div>
        <div class="kpi-val" style="color:var(--red)">{{ fmtUSD(kpis.vencidas) }}</div>
        <div class="kpi-sub">{{ kpis.nVencidas }} factura(s)</div>
      </div>
      <div class="kpi-card gold">
        <div class="kpi-icon"><i class="ti ti-clock"></i></div>
        <div class="kpi-label">Por vencer ≤7d</div>
        <div class="kpi-val" style="color:var(--gold)">{{ fmtUSD(kpis.porVencer) }}</div>
        <div class="kpi-sub">{{ kpis.nPorVencer }} factura(s)</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-icon"><i class="ti ti-circle-check"></i></div>
        <div class="kpi-label" title="Valor en dólares físicos: los pagos en Bs se registran a su poder de recompra (tasa paralelo), no a tasa BCV. No es comparable con el monto facturado, que está en $BCV.">Cobrado mes ($ verde)</div>
        <div class="kpi-val" style="color:var(--green)">{{ cobradoMes.val }}</div>
        <div class="kpi-sub">{{ cobradoMes.sub }}</div>
      </div>
    </div>

    <div v-if="!facturas.length" style="background:#FFF;border:1px solid var(--border);border-radius:8px;padding:40px;text-align:center;color:var(--dgray)">
      <i class="ti ti-check" style="font-size:36px;display:block;margin-bottom:8px;color:var(--green)"></i>Sin cuentas por cobrar en {{ store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora' }}.
    </div>
    <div v-else>
      <div v-for="f in facturas" :key="f.id" :class="['deuda-row', claseFila(f)]" style="cursor:pointer" @click="verDetalle(f)">
        <div class="deuda-info-block">
          <span class="deuda-cliente">{{ f.cliente }}</span>
          <span :class="['deuda-fecha', { vencida: f.estado === 'vencida' }]">{{ f.num }} ·
            <template v-if="!f.vence"><i class="ti ti-calendar"></i> Sin fecha de vencimiento</template>
            <template v-else-if="f.estado === 'vencida'"><i class="ti ti-alert-circle"></i> Venció {{ f.vence }} ({{ Math.abs(f.dias) }} días)</template>
            <template v-else-if="claseFila(f) === 'por_vencer'"><i class="ti ti-clock"></i> Vence {{ f.vence }} (en {{ f.dias }} días)</template>
            <template v-else><i class="ti ti-calendar"></i> Vence {{ f.vence }} (en {{ f.dias }} días)</template>
          </span>
        </div>
        <div class="deuda-monto-block">
          <div class="deuda-monto">{{ fmtUSD(f.saldo_pendiente) }}</div>
          <div style="font-size:11px;color:var(--gold);font-weight:600">con resguardo {{ fmtUSD(f.saldo_pendiente * factorBsDe(f, store.estadoTasas)) }} · {{ fmtBsMonto(saldoBsHoy(f, store.estadoTasas)) }}</div>
          <div v-if="f.abonado > 0" class="deuda-abono">Abonado: {{ fmtUSD(f.abonado) }} de {{ fmtUSD(f.total) }}</div>
        </div>
        <div style="display:flex;gap:4px" @click.stop>
          <button class="btn btn-primary btn-sm" title="Registrar abono" @click="abrirAbono(f)"><i class="ti ti-cash-banknote"></i></button>
          <button class="btn btn-gold btn-sm" title="Nota de crédito" @click="abrirNotaCredito(f)"><i class="ti ti-receipt-refund"></i></button>
          <button class="btn btn-red btn-sm" title="Anular factura" @click="abrirAnular(f)"><i class="ti ti-trash"></i></button>
        </div>
      </div>
    </div>

    <!-- REGISTRAR ABONO (monolito v13.32 / v13.33) -->
    <div v-if="ab" class="modal show" id="modal-abono">
      <div class="modal-content" style="max-width:460px;text-align:left">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:10px">
          <h2 style="margin:0;font-size:16px"><i class="ti ti-cash-banknote" style="color:var(--green)"></i> Registrar abono</h2>
          <button class="btn btn-secondary btn-sm" @click="ab = null"><i class="ti ti-x"></i></button>
        </div>
        <div style="background:var(--sky);border-radius:6px;padding:10px 12px;margin-bottom:12px;font-size:12px">
          <div style="font-weight:600">{{ ab.f.num }} <span style="color:var(--dgray);font-weight:400">·</span> {{ ab.f.cliente }}</div>
          <div v-if="(parseFloat(ab.f.abonado) || 0) > 0.009" style="margin-top:4px;color:var(--dgray);font-size:11px">Total {{ fmtUSD(ab.f.total) }} · abonado {{ fmtUSD(ab.f.abonado || 0) }}</div>
          <div style="margin-top:8px;padding:8px;background:#FFF;border:1px solid var(--border);border-radius:6px">
            <div style="display:grid;grid-template-columns:auto auto;gap:5px 12px;font-size:11.5px">
              <span style="color:var(--dgray)">Saldo</span>
              <strong style="text-align:right;color:var(--red)">{{ fmtUSD(ab.f.saldo_pendiente) }}</strong>
              <template v-if="Math.abs(factorBsDe(ab.f, store.estadoTasas) - 1) > 0.0001">
                <span style="color:var(--dgray)" title="Resguardo cambiario congelado al emitir esta factura. Es la cifra que se convierte a bolívares.">Con resguardo ({{ ((factorBsDe(ab.f, store.estadoTasas) - 1) * 100).toFixed(1) }}%)</span>
                <strong style="text-align:right;color:var(--gold)">{{ fmtUSD(ab.f.saldo_pendiente * factorBsDe(ab.f, store.estadoTasas)) }}</strong>
              </template>
              <span style="color:var(--dgray)">Efectivo hoy</span>
              <strong style="text-align:right;color:var(--green)" :title="ab.acordado ? 'Objetivo de efectivo acordado al emitir esta factura.' : 'Equivalente del saldo en dólares físicos, a la brecha de hoy.'">{{ fmtUSD(ab.objetivo) }}<span v-if="ab.acordado" style="font-size:9px;color:var(--gold);font-weight:600"> ACORDADO</span></strong>
              <span style="color:var(--dgray);border-top:1px solid var(--border);padding-top:5px">Bolívares hoy</span>
              <strong style="text-align:right;color:var(--navy);font-size:13px;border-top:1px solid var(--border);padding-top:5px">{{ fmtBsMonto(saldoBsHoy(ab.f, store.estadoTasas)) }}</strong>
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div>
            <label class="ab-lbl">Monto del abono *</label>
            <div style="display:flex;gap:4px">
              <input ref="inpMonto" v-model="ab.monto" type="text" placeholder="Pega o escribe el monto" class="ab-inp" style="flex:1;font-size:14px">
              <select v-model="ab.moneda" class="ab-inp" style="width:auto;flex:none">
                <option value="USD">USD</option>
                <option value="Bs">Bs</option>
              </select>
            </div>
            <div style="font-size:10.5px;color:var(--dgray);margin-top:3px"><i class="ti ti-info-circle"></i> Acepta cualquier formato: 59.818,55 · 59818.55 · 59818,55</div>
          </div>
          <!-- Solo para pagos en $: el usuario decide cómo se acredita -->
          <div v-if="ab.moneda === 'USD' && montoNum > 0" style="background:#F2F5FA;border-radius:6px;padding:9px 11px">
            <div style="font-size:11.5px;font-weight:600;margin-bottom:6px">¿Cómo acredito este pago en efectivo?</div>
            <label class="ab-modo"><input v-model="ab.modo" type="radio" value="saldar" style="width:auto;margin:0"><span style="flex:1">Saldar la factura completa</span><strong>{{ fmtUSD(ab.f.saldo_pendiente) }}</strong></label>
            <label class="ab-modo"><input v-model="ab.modo" type="radio" value="convertir" style="width:auto;margin:0"><span style="flex:1">Convertir a $BCV</span><strong>{{ fmtUSD(abonoAcredita(montoNum, 'convertir', ab.f, store.estadoTasas)) }}</strong></label>
            <label class="ab-modo"><input v-model="ab.modo" type="radio" value="cara" style="width:auto;margin:0"><span style="flex:1">Al valor de la cara</span><strong>{{ fmtUSD(montoNum) }}</strong></label>
            <div style="margin-top:7px;padding-top:6px;border-top:1px solid var(--border);font-size:12px;line-height:1.45">
              <span v-if="modoEf === 'saldar' && cubre" style="color:#1E7B34">Cubre el objetivo de {{ fmtUSD(ab.objetivo) }}.</span>
              <span v-else-if="modoEf === 'saldar'" style="color:#B00020">Faltan {{ fmtUSD(ab.objetivo - montoNum) }} para el objetivo de {{ fmtUSD(ab.objetivo) }}.</span>
              <span v-else-if="modoEf === 'convertir'">El efectivo vale más en $BCV (brecha de hoy −{{ store.dtoDivisaPct.toFixed(1) }}%).</span>
              <span v-else>Sin convertir. Úsalo solo si el precio ya estaba en $BCV.</span>
              <br>Acredita <strong>{{ fmtUSD(previa.acred) }}</strong> · saldo queda en
              <strong :style="{ color: previa.resto <= 0.01 ? '#1E7B34' : '#B00020' }">{{ fmtUSD(Math.max(0, previa.resto)) }}</strong>
            </div>
          </div>
          <div>
            <label class="ab-lbl">Método de pago *</label>
            <select v-model="ab.metodo" class="ab-inp" style="width:100%" @change="cambioMetodo">
              <option>Efectivo USD</option><option>Zelle USD</option><option>Pago móvil Bs.</option><option>Transferencia Bs.</option><option>Efectivo Bs.</option><option>Punto de venta</option>
            </select>
          </div>
          <div>
            <label class="ab-lbl">Referencia / N° confirmación <span v-if="requiereReferencia(ab.metodo)" style="color:var(--red)">*</span></label>
            <input v-model="ab.ref" type="text" class="ab-inp" placeholder="N° de referencia bancaria, transferencia, voucher..." style="width:100%">
            <div v-if="requiereReferencia(ab.metodo)" style="font-size:10.5px;margin-top:3px"><span style="color:var(--red)"><i class="ti ti-alert-circle"></i> Obligatorio para {{ ab.metodo }} — para trazabilidad y disputas futuras</span></div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;border-top:1px solid var(--border);padding-top:10px">
            <button class="btn btn-secondary" @click="ab = null">Cancelar</button>
            <button class="btn btn-primary" :disabled="store.procesando" @click="confirmarAbono"><i class="ti ti-check"></i> {{ store.procesando ? 'Registrando...' : 'Registrar' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD, fmtBsMonto, factorBsDe } from '../services/pricing.js';
import { requiereReferencia, parseMontoVE, saldoBsHoy, objetivoEfectivo, abonoAcredita } from '../services/cobros.js';
import { cargarCobradoMes } from '../services/supabase.js';

const store = useArjStore();

// Solo las facturas de la empresa activa, más recientes primero (como el monolito)
const facturas = computed(() => store.facturasCobrar.filter(f => f.empresa === store.empresa));

// Amarillo = vence en 7 días o menos (lo que anuncian la leyenda y el KPI "Por vencer ≤7d")
function claseFila(f) {
  if (f.estado === 'vencida') return 'vencida';
  if (f.dias != null && f.dias >= 0 && f.dias <= 7) return 'por_vencer';
  return '';
}

const kpis = computed(() => {
  const r = { total: 0, vencidas: 0, nVencidas: 0, porVencer: 0, nPorVencer: 0 };
  facturas.value.forEach(f => {
    const s = f.total - f.abonado;
    r.total += s;
    if (f.estado === 'vencida') { r.vencidas += s; r.nVencidas++; }
    else if (claseFila(f) === 'por_vencer') { r.porVencer += s; r.nPorVencer++; }
  });
  return r;
});

// KPI "Cobrado mes": consulta a Supabase, se resuelve aparte
const cobradoMes = ref({ val: '…', sub: 'calculando' });
async function cargarCobrado() {
  if (!store.supabaseConectado) { cobradoMes.value = { val: '—', sub: 'sin conexión' }; return; }
  const empresaConsultada = store.empresa;
  cobradoMes.value = { val: '…', sub: 'calculando' };
  try {
    const r = await cargarCobradoMes(empresaConsultada);
    // Si se cambió de empresa mientras viajaba la consulta, no se pisa el valor nuevo
    if (store.empresa !== empresaConsultada) return;
    cobradoMes.value = { val: fmtUSD(r.total), sub: r.cuenta + (r.cuenta === 1 ? ' pago' : ' pagos') };
  } catch (e) {
    console.error('[ARJ] Error calculando Cobrado mes:', e);
    cobradoMes.value = { val: '—', sub: 'error al calcular' };
  }
}
onMounted(cargarCobrado);
watch(() => [store.empresa, store.todasFacturas.length], cargarCobrado);

function verDetalle(f) {
  store.facturaReciente = f;
  store.modalFacturaActivo = true;
}

function abrirNotaCredito(f) {
  if (store.rol !== 'gerente') { store.notif('Solo el gerente puede emitir notas de crédito', 'error'); return; }
  if (!store.supabaseConectado) { store.notif('Sin conexión a la base de datos', 'error'); return; }
  if (f.estado === 'anulada') { store.notif('No se puede acreditar una factura anulada', 'error'); return; }
  store.facturaNC = f;
  store.modalNotaCreditoActivo = true;
}

function abrirAnular(f) {
  store.facturaAAnular = f;
  store.modalAnularActivo = true;
}

// ── Abono ──
const ab = ref(null);
const inpMonto = ref(null);

function abrirAbono(f) {
  const cv = parseFloat(f.cobrar_verde) || 0;
  ab.value = {
    f, objetivo: objetivoEfectivo(f, store.estadoTasas), acordado: cv > 0 && f.total > 0,
    monto: '', moneda: 'USD', modo: null, metodo: 'Efectivo USD', ref: ''
  };
  nextTick(() => { if (inpMonto.value) inpMonto.value.focus(); });
}

// La moneda se cambia sola según el método
function cambioMetodo() {
  const m = ab.value.metodo;
  if (/Bs\.|m[oó]vil|punto de venta/i.test(m)) ab.value.moneda = 'Bs';
  else if (/USD|Zelle/i.test(m)) ab.value.moneda = 'USD';
}

const montoNum = computed(() => (ab.value ? parseMontoVE(ab.value.monto) : 0));
const cubre = computed(() => ab.value && montoNum.value >= ab.value.objetivo - 1);
// Si no se eligió modo: si cubre el objetivo lo natural es saldar
const modoEf = computed(() => (ab.value ? (ab.value.modo || (cubre.value ? 'saldar' : 'convertir')) : 'convertir'));
// El monolito marca esa opción la primera vez que hay monto; después manda el usuario
watch(montoNum, n => { if (ab.value && !ab.value.modo && n > 0 && ab.value.moneda === 'USD') ab.value.modo = modoEf.value; });
const previa = computed(() => {
  if (!ab.value) return { acred: 0, resto: 0 };
  const saldo = ab.value.f.saldo_pendiente;
  const acred = Math.min(abonoAcredita(montoNum.value, modoEf.value, ab.value.f, store.estadoTasas), saldo);
  return { acred, resto: Math.round((saldo - acred) * 100) / 100 };
});

async function confirmarAbono() {
  const a = ab.value;
  if (!a) return;
  if (!(montoNum.value > 0)) { store.notif('Ingresa un monto válido', 'error'); return; }
  if (requiereReferencia(a.metodo) && !a.ref.trim()) { store.notif('La referencia es obligatoria para ' + a.metodo, 'error'); return; }
  const r = await store.registrarCobro(a.f.id, {
    montoIn: montoNum.value, moneda: a.moneda, modo: modoEf.value, metodo: a.metodo, ref: a.ref
  });
  if (!r.ok) {
    if (r.error) store.notif('Error registrando abono: ' + r.error, 'error');
    return;
  }
  store.notif('✓ Abono de ' + fmtUSD(r.acreditaUSD) + ' registrado. Saldo: ' + fmtUSD(r.saldo), 'success');
  ab.value = null;
  cargarCobrado();
}
</script>

<style scoped>
.ab-lbl { font-size: 12px; font-weight: 600; display: block; margin-bottom: 3px }
.ab-inp { padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; font-family: inherit }
.ab-modo { display: flex; gap: 7px; align-items: center; cursor: pointer; padding: 3px 0; font-size: 12px }
.ab-modo strong { font-variant-numeric: tabular-nums }
</style>
