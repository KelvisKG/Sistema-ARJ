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
        <div class="kpi-val">{{ fmtBCV(kpis.total) }}</div>
        <div class="kpi-sub">{{ facturas.length }} factura(s)</div>
      </div>
      <div class="kpi-card red">
        <div class="kpi-icon"><i class="ti ti-alert-triangle"></i></div>
        <div class="kpi-label">Vencidas</div>
        <div class="kpi-val" style="color:var(--red)">{{ fmtBCV(kpis.vencidas) }}</div>
        <div class="kpi-sub">{{ kpis.nVencidas }} factura(s)</div>
      </div>
      <div class="kpi-card gold">
        <div class="kpi-icon"><i class="ti ti-clock"></i></div>
        <div class="kpi-label">Por vencer ≤7d</div>
        <div class="kpi-val" style="color:var(--gold)">{{ fmtBCV(kpis.porVencer) }}</div>
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
          <div class="deuda-monto">{{ fmtBCV(f.saldo_pendiente) }}</div>
          <div style="font-size:11px;color:var(--gold);font-weight:600">con resguardo {{ fmtBCV(f.saldo_pendiente * factorBsDe(f, store.estadoTasas)) }} · {{ fmtBsMonto(saldoBsHoy(f, store.estadoTasas)) }}</div>
          <div v-if="f.abonado > 0" class="deuda-abono">Abonado: {{ fmtBCV(f.abonado) }} de {{ fmtBCV(f.total) }}</div>
        </div>
        <div style="display:flex;gap:4px" @click.stop>
          <button class="btn btn-primary btn-sm" title="Registrar abono" @click="abrirAbono(f)"><i class="ti ti-cash-banknote"></i> Abonar</button>
          <button class="btn btn-gold btn-sm" title="Nota de crédito" @click="abrirNotaCredito(f)"><i class="ti ti-receipt-refund"></i> Devolución</button>
          <button class="btn btn-red btn-sm" title="Anular factura" @click="abrirAnular(f)"><i class="ti ti-trash"></i> Anular</button>
        </div>
      </div>
    </div>

    <!-- REGISTRAR ABONO (monolito v13.32 / v13.33). La moneda de cada monto va siempre rotulada -->
    <div v-if="ab" class="modal show" id="modal-abono">
      <div class="modal-content me-caja me-ancha">
        <header class="me-cab">
          <span class="me-icono verde"><i class="ti ti-cash-banknote"></i></span>
          <div class="me-titulo">
            <h2>Registrar abono</h2>
            <p>{{ ab.f.num }} · {{ ab.f.cliente }}</p>
          </div>
          <button type="button" class="me-cerrar" title="Cerrar" aria-label="Cerrar" @click="ab = null"><i class="ti ti-x"></i></button>
        </header>

        <div class="ab-cols">
        <aside class="ab-lado">
        <section class="me-panel">
          <div class="me-etq">Saldo pendiente</div>
          <div class="me-grande">{{ fmtBCV(ab.f.saldo_pendiente) }}</div>
          <template v-if="(parseFloat(ab.f.abonado) || 0) > 0.009">
            <div class="ab-barra"><span :style="{ width: pctPagado + '%' }"></span></div>
            <div class="me-nota">Ya abonó {{ fmtBCV(ab.f.abonado) }} de {{ fmtBCV(ab.f.total) }}</div>
          </template>
          <div class="me-etq ab-sep">Para saldar la factura hoy, el cliente paga:</div>
          <div class="ab-opciones-saldo">
            <div class="ab-equiv">
              <span>En Dólar ($)<em v-if="ab.acordado" title="Objetivo de efectivo acordado al emitir esta factura."> · acordado</em></span>
              <strong>{{ fmtDolar(ab.objetivo) }}</strong>
            </div>
            <div class="ab-o">o</div>
            <div class="ab-equiv">
              <span>En bolívares</span>
              <strong>{{ fmtBsMonto(saldoBsHoy(ab.f, store.estadoTasas)) }}</strong>
            </div>
          </div>
          <div v-if="Math.abs(factorBsDe(ab.f, store.estadoTasas) - 1) > 0.0001" class="me-nota" title="Resguardo cambiario congelado al emitir esta factura. Es la cifra que se convierte a bolívares.">
            Los bolívares incluyen resguardo de {{ ((factorBsDe(ab.f, store.estadoTasas) - 1) * 100).toFixed(1) }}%: {{ fmtBCV(ab.f.saldo_pendiente * factorBsDe(ab.f, store.estadoTasas)) }}
          </div>
        </section>

        <section v-if="montoNum > 0" :class="['ab-resumen', { error: calculo && !calculo.ok }]">
          <template v-if="calculo && calculo.ok">
            <div><span>El cliente entrega</span><strong>{{ ab.moneda === 'USD' ? fmtDolar(montoNum) : fmtBsMonto(montoNum) }}</strong></div>
            <div><span>Se acredita a la factura</span><strong>{{ fmtBCV(calculo.acreditaUSD) }}</strong></div>
            <div class="ab-queda"><span>Saldo después del abono</span>
              <strong :class="resto <= 0.01 ? 'ok' : 'debe'">{{ resto <= 0.01 ? 'Factura saldada' : fmtBCV(resto) }}</strong></div>
          </template>
          <div v-else-if="modoEf === 'saldar' && ab.moneda === 'USD'" class="ab-aviso"><i class="ti ti-alert-circle"></i> Faltan {{ fmtDolar(ab.objetivo - montoNum) }} para saldar. Elige otra forma de acreditar este pago.</div>
          <div v-else class="ab-aviso"><i class="ti ti-alert-circle"></i> {{ calculo && calculo.error }}</div>
        </section>
        <section v-if="!(montoNum > 0)" class="ab-resumen ab-vacio"><i class="ti ti-arrow-right"></i> Escribe cuánto entrega el cliente para ver cómo queda la factura.</section>
        </aside>

        <div class="ab-form">
        <section class="me-paso">
          <h3><b>1</b> ¿Cómo paga el cliente?</h3>
          <div class="ab-grupo">Dólar ($)</div>
          <div class="ab-metodos">
            <button v-for="m in METODOS_DOLAR" :key="m.v" type="button" :class="['ab-metodo', { activo: ab.metodo === m.v }]" :aria-pressed="ab.metodo === m.v" @click="elegirMetodo(m.v, 'USD')"><i :class="['ti', m.i]"></i> {{ m.t }}</button>
          </div>
          <div class="ab-grupo">Bolívares</div>
          <div class="ab-metodos">
            <button v-for="m in METODOS_BS" :key="m.v" type="button" :class="['ab-metodo', { activo: ab.metodo === m.v }]" :aria-pressed="ab.metodo === m.v" @click="elegirMetodo(m.v, 'Bs')"><i :class="['ti', m.i]"></i> {{ m.t }}</button>
          </div>
        </section>

        <section class="me-paso">
          <h3><b>2</b> ¿Cuánto entrega?</h3>
          <div class="ab-monto">
            <span>{{ ab.moneda === 'USD' ? '$' : 'Bs.' }}</span>
            <input ref="inpMonto" v-model="ab.monto" type="text" inputmode="decimal" placeholder="0,00" aria-label="Monto del abono">
            <em>{{ ab.moneda === 'USD' ? 'Dólar' : 'Bolívares' }}</em>
          </div>
          <div class="me-nota">Acepta cualquier formato: 59.818,55 · 59818.55 · 59818,55</div>

          <label class="ab-lbl">Referencia o N° de confirmación
            <span v-if="requiereReferencia(ab.metodo)" class="ab-oblig">obligatoria</span>
            <span v-else class="ab-opc">opcional</span>
          </label>
          <input v-model="ab.ref" type="text" class="ab-inp" placeholder="N° de referencia, transferencia o voucher">
        </section>

        <!-- Solo para pagos en $: el usuario decide cómo se acredita -->
        <section v-if="ab.moneda === 'USD' && montoNum > 0" class="me-paso">
          <h3><b>3</b> ¿Cómo se acredita este pago?</h3>
          <label :class="['me-opcion', { activo: modoEf === 'saldar' }]">
            <input v-model="ab.modo" type="radio" value="saldar">
            <span class="ab-modo-txt"><strong>Saldar la factura completa</strong><small>Para cuando entrega el monto acordado en dólares.</small></span>
            <span class="ab-modo-val">{{ fmtBCV(ab.f.saldo_pendiente) }}</span>
          </label>
          <label :class="['me-opcion', { activo: modoEf === 'convertir' }]">
            <input v-model="ab.modo" type="radio" value="convertir">
            <span class="ab-modo-txt"><strong>Convertir a dólar BCV</strong><small>El efectivo vale más con la brecha de hoy (−{{ store.dtoDivisaPct.toFixed(1) }}%).</small></span>
            <span class="ab-modo-val">{{ fmtBCV(abonoAcredita(montoNum, 'convertir', ab.f, store.estadoTasas)) }}</span>
          </label>
          <label :class="['me-opcion', { activo: modoEf === 'cara' }]">
            <input v-model="ab.modo" type="radio" value="cara">
            <span class="ab-modo-txt"><strong>Al valor de la cara</strong><small>Sin convertir: solo si el precio ya estaba en dólar BCV.</small></span>
            <span class="ab-modo-val">{{ fmtBCV(montoNum) }}</span>
          </label>
        </section>

        </div>
        </div>

        <footer class="me-pie">
          <button type="button" class="btn btn-secondary" @click="ab = null">Cancelar</button>
          <button type="button" class="btn btn-primary" :disabled="store.procesando || !calculo || !calculo.ok" @click="confirmarAbono"><i class="ti ti-check"></i> {{ store.procesando ? 'Registrando...' : 'Registrar abono' }}</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtBCV, fmtDolar, fmtBsMonto, factorBsDe } from '../services/pricing.js';
import { requiereReferencia, parseMontoVE, saldoBsHoy, objetivoEfectivo, abonoAcredita, calcularAbono } from '../services/cobros.js';
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
    cobradoMes.value = { val: fmtDolar(r.total), sub: r.cuenta + (r.cuenta === 1 ? ' pago' : ' pagos') };
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

// El método decide la moneda
const METODOS_DOLAR = [
  { v: 'Efectivo USD', t: 'Efectivo', i: 'ti-cash' },
  { v: 'Zelle USD', t: 'Zelle', i: 'ti-building-bank' },
  { v: 'USDT', t: 'USDT', i: 'ti-coin' }
];
const METODOS_BS = [
  { v: 'Pago móvil Bs.', t: 'Pago móvil', i: 'ti-device-mobile' },
  { v: 'Transferencia Bs.', t: 'Transferencia', i: 'ti-arrows-exchange' },
  { v: 'Efectivo Bs.', t: 'Efectivo', i: 'ti-cash' },
  { v: 'Punto de venta', t: 'Punto de venta', i: 'ti-credit-card' }
];
function elegirMetodo(m, moneda) {
  ab.value.metodo = m;
  ab.value.moneda = moneda;
}

const montoNum = computed(() => (ab.value ? parseMontoVE(ab.value.monto) : 0));
const cubre = computed(() => ab.value && montoNum.value >= ab.value.objetivo - 1);
// Si no se eligió modo: si cubre el objetivo lo natural es saldar
const modoEf = computed(() => (ab.value ? (ab.value.modo || (cubre.value ? 'saldar' : 'convertir')) : 'convertir'));
// El monolito marca esa opción la primera vez que hay monto; después manda el usuario
watch(montoNum, n => { if (ab.value && !ab.value.modo && n > 0 && ab.value.moneda === 'USD') ab.value.modo = modoEf.value; });
// La vista previa usa el mismo cálculo que el registro: lo que se ve es lo que se guarda
const calculo = computed(() => {
  if (!ab.value || !(montoNum.value > 0)) return null;
  return calcularAbono({ f: ab.value.f, montoIn: montoNum.value, moneda: ab.value.moneda, modo: modoEf.value, estado: store.estadoTasas });
});
// Saldo que queda después del abono (el resumen solo se muestra con un cálculo válido)
const resto = computed(() => (calculo.value && calculo.value.ok
  ? Math.round((ab.value.f.saldo_pendiente - calculo.value.acreditaUSD) * 100) / 100 : 0));
const pctPagado = computed(() => {
  if (!ab.value || !(ab.value.f.total > 0)) return 0;
  return Math.min(100, Math.max(0, (ab.value.f.abonado || 0) / ab.value.f.total * 100));
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
  store.notif('✓ Abono de ' + fmtBCV(r.acreditaUSD) + ' registrado. Saldo: ' + fmtBCV(r.saldo), 'success');
  ab.value = null;
  cargarCobrado();
}
</script>

<style scoped>
.ab-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 24px; align-items: start; padding: 18px 22px 0 }

.ab-sep { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border) }
.ab-barra { height: 7px; margin-top: 10px; overflow: hidden; border-radius: 99px; background: var(--border) }
.ab-barra span { display: block; height: 100%; border-radius: 99px; background: var(--green) }
.ab-opciones-saldo { display: flex; align-items: stretch; gap: 8px; margin-top: 8px }
.ab-equiv { flex: 1; min-width: 0; padding: 9px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--card-bg) }
.ab-equiv span { display: block; color: var(--dgray); font-size: 12.5px }
.ab-equiv em { color: var(--gold); font-style: normal; font-weight: 700 }
.ab-equiv strong { display: block; margin-top: 1px; color: var(--text); font-size: 16px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere }
.ab-o { align-self: center; color: var(--dgray); font-size: 13px }

.ab-grupo { margin: 8px 0 5px; color: var(--dgray); font-size: 12.5px; font-weight: 600 }
.ab-metodos { display: flex; flex-wrap: wrap; gap: 6px }
.ab-metodo { display: inline-flex; align-items: center; gap: 6px; min-height: 42px; padding: 7px 13px; border: 1.5px solid var(--border); border-radius: 10px; background: var(--card-bg); color: var(--text); font: inherit; font-size: 14px; cursor: pointer; transition: border-color .15s, background .15s }
.ab-metodo:hover { border-color: var(--blue) }
.ab-metodo.activo { border-color: var(--blue); background: var(--lblue); color: var(--blue); font-weight: 700 }

.ab-monto { display: flex; align-items: center; gap: 8px; padding: 4px 14px; border: 1.5px solid var(--border); border-radius: 12px; background: var(--input-bg) }
.ab-monto:focus-within { border-color: var(--blue); box-shadow: var(--shadow-glow-blue) }
.ab-monto span { color: var(--dgray); font-size: 20px; font-weight: 700 }
.ab-monto input { flex: 1; min-width: 0; padding: 8px 0; border: 0; outline: 0; box-shadow: none; background: transparent; color: var(--text); font: inherit; font-size: 23px; font-weight: 700; font-variant-numeric: tabular-nums }
.ab-monto input:focus, .ab-monto input:focus-visible { border: 0 !important; outline: 0 !important; box-shadow: none !important; background: transparent !important }
.ab-monto em { color: var(--dgray); font-size: 13px; font-style: normal; font-weight: 600 }
.ab-lbl { display: flex; align-items: center; gap: 7px; margin: 14px 0 5px; font-size: 13.5px; font-weight: 600 }
.ab-oblig { color: var(--red); font-size: 12.5px }
.ab-opc { color: var(--dgray); font-size: 12.5px; font-weight: 400 }
.ab-inp { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1.5px solid var(--border); border-radius: 10px; font-family: inherit; font-size: 14.5px }

.ab-modo-txt { flex: 1; min-width: 0 }
.ab-modo-val { flex: none; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums }

.ab-resumen { margin: 14px 0 0; padding: 12px 16px; border-radius: 12px; background: var(--lgreen) }
.ab-resumen.error { background: var(--lred) }
.ab-vacio { background: var(--gray); color: var(--dgray); font-size: 13.5px }
.ab-resumen > div:not(.ab-aviso) { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; font-size: 14px }
.ab-resumen strong { font-variant-numeric: tabular-nums; text-align: right }
.ab-resumen > .ab-queda { margin-top: 5px; padding-top: 8px; border-top: 1px solid var(--border); font-size: 15.5px; font-weight: 600 }
.ok { color: var(--green) }
.debe { color: var(--red) }
.ab-aviso { color: var(--red); font-size: 14px; font-weight: 600 }

@media (max-width: 760px) {
  .ab-cols { grid-template-columns: minmax(0, 1fr); gap: 18px }
}

@media (max-width: 520px) {
  .ab-opciones-saldo { flex-direction: column }
  .ab-o { align-self: flex-start; margin-left: 4px }
  .me-opcion { flex-wrap: wrap }
  .ab-modo-val { margin-left: 27px }
}
</style>
