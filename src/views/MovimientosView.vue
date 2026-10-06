<template>
  <div class="page active" id="page-movimientos">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="page-title"><i class="ti ti-arrows-exchange"></i> Movimientos y Flujo</h1>
        <p class="page-sub">
          Empresa activa: <strong>{{ store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora ARJ' }}</strong>
          · Control integral de caja, gastos y kardex
        </p>
      </div>

      <div style="display:flex;gap:6px;align-items:center">
        <input v-model="periodo" type="month" class="val-input" title="Período" style="width:150px">
        <button class="btn btn-secondary" @click="abrirModalMovDinero('entrada')">
          <i class="ti ti-arrow-down-left"></i> Entrada de Dinero
        </button>
        <button class="btn btn-red" @click="abrirModalMovDinero('salida')">
          <i class="ti ti-arrow-up-right"></i> Registrar Salida / Gasto
        </button>
        <button class="btn btn-primary" @click="mostrarModalAjusteStock = true">
          <i class="ti ti-package"></i> Ajuste Kardex Repuesto
        </button>
      </div>
    </div>

    <!-- TABS DE MOVIMIENTOS: FLUJO DE CAJA VS KARDEX DE INVENTARIO -->
    <div style="display:flex;gap:4px;margin-bottom:14px;border-bottom:1px solid var(--border)">
      <button
        :class="['search-tab', { active: tabActivo === 'dinero' }]"
        @click="tabActivo = 'dinero'"
      >
        <i class="ti ti-cash"></i> Flujo de Caja y Gastos (Dinero)
      </button>
      <button
        :class="['search-tab', { active: tabActivo === 'kardex' }]"
        @click="tabActivo = 'kardex'"
      >
        <i class="ti ti-clipboard-list"></i> Kardex de Almacén (Existencias)
      </button>
    </div>

    <!-- ══════ TAB 1: FLUJO DE CAJA Y GASTOS (MONOLITO) ══════ -->
    <div v-if="tabActivo === 'dinero'">
      <div class="help-box">
        <i class="ti ti-info-circle"></i>
        <div>
          <strong>Esto es plata, no ventas.</strong> Las entradas por venta aparecen cuando el cliente <em>paga</em> en caja. Una factura a crédito no mueve la caja hasta que se cobra. Las salidas y gastos operativos se registran con su respectiva justificación.
        </div>
      </div>

      <!-- 3 KPI CARDS DEL MONOLITO -->
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="kpi-card green">
          <div class="kpi-icon"><i class="ti ti-arrow-down-left"></i></div>
          <div class="kpi-label">Entró al período</div>
          <div class="kpi-val" style="color:var(--green)">${{ totalEntradasDinero.toFixed(2) }}</div>
          <div class="kpi-sub">{{ movimientosDinero.filter(m => m.tipo === 'entrada').length }} movimientos</div>
        </div>

        <div class="kpi-card red">
          <div class="kpi-icon"><i class="ti ti-arrow-up-right"></i></div>
          <div class="kpi-label">Salió en gastos</div>
          <div class="kpi-val" style="color:var(--red)">${{ totalSalidasDinero.toFixed(2) }}</div>
          <div class="kpi-sub">{{ movimientosDinero.filter(m => m.tipo === 'salida').length }} movimientos</div>
        </div>

        <div class="kpi-card blue">
          <div class="kpi-icon"><i class="ti ti-scale"></i></div>
          <div class="kpi-label">Saldo del período</div>
          <div class="kpi-val" :style="{ color: saldoPeriodo >= 0 ? 'var(--navy)' : 'var(--red)' }">
            ${{ saldoPeriodo.toFixed(2) }}
          </div>
          <div class="kpi-sub">entradas − salidas operativas</div>
        </div>
      </div>

      <!-- DESGLOSE EN QUÉ SE FUE EL DINERO (MONOLITO v13.7) -->
      <div class="card" style="margin-bottom:14px">
        <div class="card-tit"><i class="ti ti-chart-pie"></i> En qué se fue el dinero que salió</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px">
          <div style="background:#FEF5F5;border-radius:8px;padding:12px;border:1px solid #F0D0D0">
            <div style="font-size:10.5px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:600">Gasto del mes (OPEX)</div>
            <div style="font-size:20px;font-weight:700;color:var(--red);margin:4px 0">${{ totalOpex.toFixed(2) }}</div>
            <div style="font-size:10.5px;color:var(--dgray);margin-top:2px">Sueldos, servicios, contador. <strong>Sí baja la utilidad.</strong></div>
          </div>

          <div style="background:var(--lblue);border-radius:8px;padding:12px;border:1px solid #BBD2EA">
            <div style="font-size:10.5px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:600">Mercancía</div>
            <div style="font-size:20px;font-weight:700;color:var(--navy);margin:4px 0">${{ totalMercancia.toFixed(2) }}</div>
            <div style="font-size:10.5px;color:var(--dgray);margin-top:2px">Se volvió inventario. <strong>No es gasto</strong> hasta que se venda.</div>
          </div>

          <div style="background:var(--lgold);border-radius:8px;padding:12px;border:1px solid #E8D090">
            <div style="font-size:10.5px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:600">Inversión (CAPEX)</div>
            <div style="font-size:20px;font-weight:700;color:#854F0B;margin:4px 0">${{ totalCapex.toFixed(2) }}</div>
            <div style="font-size:10.5px;color:var(--dgray);margin-top:2px">Galpón, herramientas, equipos. <strong>Se deprecia</strong> con los años.</div>
          </div>

          <div style="background:var(--gray);border-radius:8px;padding:12px;border:1px solid #D0D4DC">
            <div style="font-size:10.5px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:600">Capital</div>
            <div style="font-size:20px;font-weight:700;color:var(--dgray);margin:4px 0">${{ totalCapital.toFixed(2) }}</div>
            <div style="font-size:10.5px;color:var(--dgray);margin-top:2px">Retiros y transferencias. <strong>No es gasto</strong>, es reparto.</div>
          </div>
        </div>
      </div>

      <!-- TABLA DE MOVIMIENTOS MONETARIOS -->
      <div class="card" style="overflow-x:auto">
        <table class="tbl">
          <thead>
            <tr>
              <th style="width:14%">Fecha</th>
              <th style="width:10%">Tipo</th>
              <th style="width:14%">Categoría</th>
              <th style="width:28%">Concepto / Beneficiario</th>
              <th class="num" style="width:12%">Monto</th>
              <th style="width:12%">Método</th>
              <th style="width:10%">Empresa</th>
              <th style="width:4%"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="cargandoMovimientos">
              <td colspan="7" style="text-align:center;padding:24px;color:var(--navy)">
                <i class="ti ti-loader"></i> Cargando movimientos...
              </td>
            </tr>
            <tr v-else-if="movimientosDinero.length === 0">
              <td colspan="8" style="text-align:center;padding:24px;color:var(--dgray)">
                Sin movimientos de dinero registrados en el período.
              </td>
            </tr>
            <tr v-for="m in movimientosDinero" :key="m.id" :style="m.estado === 'anulado' ? 'opacity:.45;text-decoration:line-through' : ''" :title="m.estado === 'anulado' ? 'Anulado: ' + (m.anulado_motivo || '') : ''">
              <td style="font-size:11.5px;color:var(--dgray)">{{ m.fecha }}</td>
              <td>
                <span :class="['badge', m.tipo === 'entrada' ? 'badge-success' : 'badge-danger']">
                  {{ m.tipo.toUpperCase() }}
                </span>
              </td>
              <td><strong style="color:var(--navy)">{{ m.categoria }}</strong></td>
              <td>{{ m.concepto }}</td>
              <td class="num" style="font-weight:700" :style="{ color: m.tipo === 'salida' ? 'var(--red)' : 'var(--green)' }">
                {{ m.tipo === 'salida' ? '−' : '+' }}${{ m.montoUSD.toFixed(2) }}
                <div v-if="m.montoBs" style="font-size:10.5px;color:var(--dgray)">Bs. {{ m.montoBs.toFixed(2) }}</div>
              </td>
              <td style="font-size:11.5px">{{ m.metodo }}</td>
              <td>
                <span class="badge badge-secondary">{{ m.empresa }}</span>
              </td>
              <td>
                <button v-if="m.manual && m.estado !== 'anulado'" class="btn btn-danger btn-sm" style="padding:2px 6px" title="Anular movimiento" @click="anularMovimiento(m)"><i class="ti ti-ban"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ══════ TAB 2: KARDEX DE EXISTENCIAS ══════ -->
    <div v-else>
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
        <input
          v-model="busquedaKardex"
          type="text"
          placeholder="Buscar por código de repuesto, descripción o motivo..."
          class="val-input"
          style="flex:1;min-width:260px"
        >
        <select
          v-model="filtroTipoKardex"
          class="val-input"
          style="min-width:200px"
        >
          <option value="">Todos los tipos</option>
          <option value="entrada">Entradas (Recepción / Compra)</option>
          <option value="salida">Salidas (Venta)</option>
          <option value="traspaso">Traspasos entre sedes</option>
          <option value="ajuste">Ajustes manuales</option>
        </select>
      </div>

      <div class="card" style="overflow-x:auto">
        <table class="tbl">
          <thead>
            <tr>
              <th style="width:14%">Fecha y Hora</th>
              <th style="width:12%">Tipo</th>
              <th style="width:14%">Código</th>
              <th style="width:26%">Descripción del Repuesto</th>
              <th class="num" style="width:8%">Cantidad</th>
              <th style="width:12%">Sede / Empresa</th>
              <th style="width:14%">Motivo / Justificación</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="kardexFiltrado.length === 0">
              <td colspan="7" style="text-align:center;padding:24px;color:var(--dgray)">
                No hay movimientos de almacén que coincidan con el filtro.
              </td>
            </tr>
            <tr v-for="m in kardexFiltrado" :key="m.id">
              <td style="font-size:11.5px;color:var(--dgray)">{{ m.fecha }}</td>
              <td>
                <span :class="['badge', badgeColor(m.tipo)]">
                  {{ m.tipo.toUpperCase() }}
                </span>
              </td>
              <td><strong style="color:var(--navy)">{{ m.cod_alt }}</strong></td>
              <td>{{ m.producto }}</td>
              <td class="num" style="font-weight:700" :style="{ color: m.tipo === 'salida' ? 'var(--red)' : 'var(--green)' }">
                {{ m.tipo === 'salida' ? '−' : '+' }}{{ m.cant }} ud
              </td>
              <td style="font-size:11.5px">{{ m.empresa }}</td>
              <td style="font-size:11.5px;color:var(--dgray)">
                {{ m.motivo }}
                <div v-if="m.usuario" style="font-size:10px;opacity:0.8">Por: {{ m.usuario }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ═══ MODAL REGISTRAR MOVIMIENTO DE DINERO (MONOLITO modal-movimiento) ═══ -->
    <div v-if="mostrarModalDinero" class="modal show" id="modal-movimiento">
      <div class="modal-content" style="max-width:540px;text-align:left">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div
              class="modal-icon"
              :style="{ background: tipoDineroModal === 'salida' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: tipoDineroModal === 'salida' ? 'var(--red)' : 'var(--green)', margin: 0, width: '38px', height: '38px', fontSize: '18px' }"
            >
              <i :class="tipoDineroModal === 'salida' ? 'ti ti-arrow-up-right' : 'ti ti-arrow-down-left'"></i>
            </div>
            <div>
              <h3 style="margin:0;font-size:17px;color:var(--text);font-weight:700">
                {{ tipoDineroModal === 'salida' ? 'Registrar Salida o Gasto de Caja' : 'Registrar Ingreso de Dinero' }}
              </h3>
              <span style="font-size:12px;color:var(--text-muted)">Operación de flujo de caja en {{ empresaDinero === 'directa' ? 'Venta Directa' : 'Distribuidora' }}</span>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" @click="mostrarModalDinero = false"><i class="ti ti-x"></i></button>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Monto del movimiento:</label>
          <div style="display:flex;gap:8px">
            <div style="flex:1;display:flex;align-items:center;border:1px solid var(--border);border-radius:8px;padding:0 12px;background:var(--input-bg)">
              <span style="font-size:16px;color:var(--text-muted);margin-right:8px;font-weight:700">{{ monedaDinero === 'Bs' ? 'Bs' : '$' }}</span>
              <input
                v-model.number="montoDinero"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                style="flex:1;border:none;outline:none;background:transparent;font-size:22px;font-weight:800;padding:10px 0;color:var(--text);font-family:inherit"
              >
            </div>
            <div style="display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">
              <button
                type="button"
                :style="{ background: monedaDinero === 'Bs' ? 'var(--primary)' : 'transparent', color: monedaDinero === 'Bs' ? '#FFF' : 'var(--text-muted)' }"
                style="border:none;padding:0 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit"
                @click="monedaDinero = 'Bs'"
              >
                Bs
              </button>
              <button
                type="button"
                :style="{ background: monedaDinero === 'USD' ? 'var(--primary)' : 'transparent', color: monedaDinero === 'USD' ? '#FFF' : 'var(--text-muted)' }"
                style="border:none;padding:0 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit"
                @click="monedaDinero = 'USD'"
              >
                $
              </button>
            </div>
          </div>
          <span v-if="errorsDinero.monto" class="field-error"><i class="ti ti-alert-circle"></i> {{ errorsDinero.monto }}</span>
          <div style="font-size:12px;color:var(--text-muted);margin-top:6px">
            Conversión a tasa BCV ({{ store.tasa_bcv }} Bs/$):
            <strong style="color:var(--text)">
              {{ monedaDinero === 'Bs' ? `$ ${(montoDinero / store.tasa_bcv || 0).toFixed(2)} USD` : `Bs. ${(montoDinero * store.tasa_bcv || 0).toFixed(2)}` }}
            </strong>
          </div>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Categoría del concepto:</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
            <button
              v-for="cat in categoriasDinero"
              :key="cat.nombre"
              type="button"
              :class="['mov-chip', { active: categoriaDinero === cat.nombre }]"
              :style="categoriaDinero === cat.nombre ? { background: 'var(--primary)', color: '#FFF', borderColor: 'var(--primary)' } : {}"
              @click="categoriaDinero = cat.nombre"
            >
              {{ cat.nombre }}
            </button>
          </div>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Beneficiario / Justificación:</label>
          <input
            v-model="conceptoDinero"
            type="text"
            placeholder="Ej: Pago de flete repuestos de Carabobo o sueldos"
            class="val-input"
            :class="{ 'is-invalid': errorsDinero.concepto }"
            @input="errorsDinero.concepto = null"
          >
          <span v-if="errorsDinero.concepto" class="field-error"><i class="ti ti-alert-circle"></i> {{ errorsDinero.concepto }}</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div class="field-col">
            <label>Forma de pago:</label>
            <select v-model="metodoDinero" class="val-input">
              <option>Efectivo USD</option>
              <option>Efectivo Bs.</option>
              <option>Pago móvil Bs.</option>
              <option>Transferencia Bs.</option>
              <option>Zelle USD</option>
              <option>Punto de venta</option>
              <option>Otro</option>
            </select>
          </div>
          <div class="field-col">
            <label>Empresa:</label>
            <select v-model="empresaDinero" class="val-input">
              <option value="directa">Venta Directa</option>
              <option value="distribuidora">Distribuidora</option>
              <option value="ambas">Ambas</option>
            </select>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="mostrarModalDinero = false">Cancelar</button>
          <button :class="['btn', tipoDineroModal === 'salida' ? 'btn-danger' : 'btn-success']" :disabled="guardandoMov" @click="guardarMovimientoDinero">
            <i class="ti ti-device-floppy"></i> Guardar Movimiento
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ MODAL AJUSTE DE EXISTENCIAS (KARDEX) ═══ -->
    <div v-if="mostrarModalAjusteStock" class="modal show">
      <div class="modal-content" style="max-width:500px;text-align:left">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="modal-icon" style="background:rgba(217,119,6,0.12);color:var(--gold);margin:0;width:38px;height:38px;font-size:18px">
              <i class="ti ti-adjustments"></i>
            </div>
            <h3 style="margin:0;font-size:17px;color:var(--text);font-weight:700">Ajuste Manual de Inventario</h3>
          </div>
          <button class="btn btn-secondary btn-sm" @click="mostrarModalAjusteStock = false"><i class="ti ti-x"></i></button>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Selecciona el Repuesto:</label>
        <select v-model="ajusteProdId" class="val-input"
          :class="{ 'is-invalid': errorsAjuste.producto }" @change="errorsAjuste.producto = null">
            <option value="">-- Elige un repuesto --</option>
            <option v-for="p in store.productos" :key="p.id" :value="p.id">
              {{ p.cod_alt }} - {{ p.desc }} (Stock VD: {{ p.stock_vd }} | Dist: {{ p.stock_dist }})
            </option>
          </select>
          <span v-if="errorsAjuste.producto" class="field-error"><i class="ti ti-alert-circle"></i> {{ errorsAjuste.producto }}</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col">
            <label>Tipo de Ajuste:</label>
            <select v-model="ajusteTipo" class="val-input">
              <option value="entrada">Entrada (+)</option>
              <option value="salida">Salida / Merma (-)</option>
            </select>
          </div>
          <div class="field-col">
            <label>Cantidad (uds):</label>
            <input v-model.number="ajusteCant" type="number" min="1" class="val-input" style="font-weight:700"
              :class="{ 'is-invalid': errorsAjuste.cant }" @input="errorsAjuste.cant = null">
            <span v-if="errorsAjuste.cant" class="field-error"><i class="ti ti-alert-circle"></i> {{ errorsAjuste.cant }}</span>
          </div>
        </div>

        <div class="field-col" style="margin-bottom:16px">
          <label>Motivo / Justificación:</label>
          <input v-model="ajusteMotivo" type="text" placeholder="Ej: Merma por daño en flete o conteo" class="val-input"
            :class="{ 'is-invalid': errorsAjuste.motivo }" @input="errorsAjuste.motivo = null">
          <span v-if="errorsAjuste.motivo" class="field-error"><i class="ti ti-alert-circle"></i> {{ errorsAjuste.motivo }}</span>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="mostrarModalAjusteStock = false">Cancelar</button>
          <button class="btn btn-primary" @click="aplicarAjusteStock">
            <i class="ti ti-check"></i> Guardar Ajuste
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { periodoDe } from '../services/fechas.js';
import { useArjStore } from '../stores/useArjStore.js';
import { cargarFlujoCajaBD } from '../services/supabase.js';

const store = useArjStore();
const tabActivo = ref('dinero');
const cargandoMovimientos = ref(false);

// Período visible: el mes actual (hora de Venezuela) por defecto
const periodo = ref(periodoDe(new Date()));
async function cargarMovimientos() {
  cargandoMovimientos.value = true;
  try {
    const [y, m] = periodo.value.split('-').map(Number);
    const desde = new Date(`${periodo.value}-01T00:00:00-04:00`);
    const hasta = new Date(Date.UTC(y, m, 1, 4)); // 1ro del mes siguiente, 00:00 VET
    store.movimientosDinero = await cargarFlujoCajaBD(desde.toISOString(), hasta.toISOString());
  } finally {
    cargandoMovimientos.value = false;
  }
}
onMounted(cargarMovimientos);
watch(periodo, cargarMovimientos);

// Movimientos de dinero (Flujo de caja) - Vinculado al Store
const movimientosDinero = computed(() => store.movimientosDinero);
// Los anulados se muestran tachados pero no suman
const activos = computed(() => movimientosDinero.value.filter(m => m.estado !== 'anulado'));

const mostrarModalDinero = ref(false);
const tipoDineroModal = ref('salida');
const montoDinero = ref(0);
const monedaDinero = ref('USD');
const categoriaDinero = ref('Gasto operativo');
const conceptoDinero = ref('');
const metodoDinero = ref('Efectivo USD');
const empresaDinero = ref('directa');

const categoriasDinero = [
  { nombre: 'Sueldos', clase: 'opex' },
  { nombre: 'Alquiler', clase: 'opex' },
  { nombre: 'Servicios', clase: 'opex' },
  { nombre: 'Flete', clase: 'inventario' },
  { nombre: 'Mercancía', clase: 'inventario' },
  { nombre: 'Equipos', clase: 'capex' },
  { nombre: 'Retiros', clase: 'capital' },
  { nombre: 'Varios', clase: 'opex' }
];

// Kardex existencias
const busquedaKardex = ref('');
const filtroTipoKardex = ref('');
const mostrarModalAjusteStock = ref(false);
const ajusteProdId = ref('');
const ajusteTipo = ref('entrada');
const ajusteCant = ref(1);
const ajusteMotivo = ref('');
const errorsDinero = ref({});
const errorsAjuste = ref({});

// Computed Dinero
const totalEntradasDinero = computed(() => {
  return activos.value.filter(m => m.tipo === 'entrada').reduce((a, b) => a + b.montoUSD, 0);
});

const totalSalidasDinero = computed(() => {
  return activos.value.filter(m => m.tipo === 'salida').reduce((a, b) => a + b.montoUSD, 0);
});

const saldoPeriodo = computed(() => totalEntradasDinero.value - totalSalidasDinero.value);

const totalOpex = computed(() => {
  return activos.value.filter(m => m.clase === 'opex').reduce((a, b) => a + b.montoUSD, 0);
});

const totalMercancia = computed(() => {
  return activos.value.filter(m => m.clase === 'inventario').reduce((a, b) => a + b.montoUSD, 0);
});

const totalCapex = computed(() => {
  return activos.value.filter(m => m.clase === 'capex').reduce((a, b) => a + b.montoUSD, 0);
});

const totalCapital = computed(() => {
  return activos.value.filter(m => m.clase === 'capital').reduce((a, b) => a + b.montoUSD, 0);
});

// Computed Kardex
const kardexFiltrado = computed(() => {
  return store.movimientos.filter(m => {
    const q = busquedaKardex.value.toLowerCase();
    const coincideTexto = !q || (m.cod_alt && m.cod_alt.toLowerCase().includes(q)) || (m.producto && m.producto.toLowerCase().includes(q)) || (m.motivo && m.motivo.toLowerCase().includes(q));
    const coincideTipo = !filtroTipoKardex.value || m.tipo === filtroTipoKardex.value;
    return coincideTexto && coincideTipo;
  });
});

function badgeColor(tipo) {
  if (tipo === 'entrada') return 'badge-success';
  if (tipo === 'salida') return 'badge-danger';
  if (tipo === 'traspaso') return 'badge-warning';
  return 'badge-primary';
}

function abrirModalMovDinero(tipo) {
  tipoDineroModal.value = tipo;
  montoDinero.value = 0;
  conceptoDinero.value = '';
  categoriaDinero.value = tipo === 'salida' ? 'Sueldos' : 'Cobranza';
  mostrarModalDinero.value = true;
}

const guardandoMov = ref(false);
async function guardarMovimientoDinero() {
  errorsDinero.value = {};
  const monto = parseFloat(montoDinero.value) || 0;
  if (monto <= 0) errorsDinero.value.monto = 'Indica un monto mayor a 0';
  if (!conceptoDinero.value.trim()) errorsDinero.value.concepto = 'Indica el concepto o destinatario';
  if (monedaDinero.value === 'Bs' && !(store.tasa_bcv > 0)) errorsDinero.value.monto = 'Falta la tasa BCV para convertir';
  if (Object.keys(errorsDinero.value).length > 0) {
    store.notif('Corrige los campos marcados en rojo', 'warning');
    return;
  }
  if (!store._exigirConexion('Registrar movimiento')) return;

  const usd = monedaDinero.value === 'USD' ? monto : monto / store.tasa_bcv;
  const bs = monedaDinero.value === 'Bs' ? monto : monto * store.tasa_bcv;
  const catObj = categoriasDinero.find(c => c.nombre === categoriaDinero.value);
  const clase = catObj ? catObj.clase : (tipoDineroModal.value === 'entrada' ? 'ingreso' : 'opex');

  guardandoMov.value = true;
  try {
    // C-01: el movimiento se guarda en movimientos_caja
    const { registrarMovimientoCajaBD } = await import('../services/supabase.js');
    const r = await registrarMovimientoCajaBD({
      tipo: tipoDineroModal.value,
      empresa: empresaDinero.value,
      categoria: categoriaDinero.value,
      clasificacion: clase,
      concepto: conceptoDinero.value.trim(),
      monto_usd: Math.round(usd * 100) / 100,
      monto_bs: Math.round(bs * 100) / 100,
      tasa_usada: store.tasa_bcv,
      moneda_origen: monedaDinero.value,
      metodo: metodoDinero.value,
      tasa_bcv_ref: store.tasa_bcv
    });
    if (!r.ok) { store.notif('❌ No se guardó el movimiento: ' + r.error, 'error'); return; }
    store.logBitacora('caja', `Registró ${tipoDineroModal.value} de $${usd.toFixed(2)} — ${categoriaDinero.value}: ${conceptoDinero.value}`, true);
    store.notif(`Movimiento de ${tipoDineroModal.value} guardado por $${usd.toFixed(2)}`, 'success');
    mostrarModalDinero.value = false;
    await cargarMovimientos();
  } finally {
    guardandoMov.value = false;
  }
}

async function anularMovimiento(m) {
  const motivo = prompt(`Motivo para anular "${m.concepto}" ($${m.montoUSD.toFixed(2)}):`);
  if (!motivo || !motivo.trim()) return;
  const { anularMovimientoCajaBD } = await import('../services/supabase.js');
  const r = await anularMovimientoCajaBD(m.idBD, motivo.trim());
  if (!r.ok) { store.notif('No se anuló: ' + r.error, 'error'); return; }
  store.logBitacora('caja', `Anuló movimiento "${m.concepto}" ($${m.montoUSD.toFixed(2)}). Motivo: ${motivo}`, true);
  store.notif('Movimiento anulado', 'success');
  await cargarMovimientos();
}

async function aplicarAjusteStock() {
  errorsAjuste.value = {};
  if (!ajusteProdId.value) errorsAjuste.value.producto = 'Selecciona un repuesto';
  if (!ajusteCant.value || ajusteCant.value <= 0) errorsAjuste.value.cant = 'La cantidad debe ser mayor a 0';
  if (!ajusteMotivo.value.trim()) errorsAjuste.value.motivo = 'Indica el motivo del ajuste';
  if (Object.keys(errorsAjuste.value).length > 0) {
    store.notif('Corrige los campos marcados en rojo', 'warning');
    return;
  }
  const p = store.productos.find(x => x.id === parseInt(ajusteProdId.value));
  if (!p) return;
  // C-01: queda registrado como conteo (REC-...) con stock antes/después
  const r = await store.ajustarStock(p, ajusteTipo.value, parseInt(ajusteCant.value), ajusteMotivo.value.trim());
  if (r) {
    store.notif(`Ajuste ${r.numero} aplicado a ${p.cod_alt}`, 'success');
    mostrarModalAjusteStock.value = false;
  }
}
</script>

<style scoped>
.mov-chip {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--dgray);
  border-radius: 6px;
  padding: 6px 11px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all .12s;
}

.mov-chip:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text);
}
</style>
