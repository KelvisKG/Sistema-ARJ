<template>
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- 1. VISTA LISTADO DE PRESUPUESTOS (CUANDO modoNuevo === false)          -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <div v-if="!modoNuevo" class="page active" id="page-cotizaciones">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="page-title"><i class="ti ti-file-text"></i> Presupuestos</h1>
        <p class="page-sub">Propuestas comerciales al cliente · Vigencia 45 días · No descuentan stock · Nada se borra: los rechazados y vencidos quedan archivados</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:12px;color:var(--dgray);cursor:pointer;user-select:none">
          <input type="checkbox" v-model="verRechazados" style="vertical-align:middle"> Ver rechazados
        </label>
        <button class="btn btn-primary" @click="iniciarNuevoPresupuesto">
          <i class="ti ti-plus"></i> Nuevo presupuesto
        </button>
      </div>
    </div>

    <div class="help-toggle" @click="verAyuda = !verAyuda" style="cursor:pointer;background:#FFF8E1;border-left:3px solid var(--gold);border-radius:6px;padding:8px 14px;margin-bottom:14px;font-size:12.5px;color:#5D4037">
      <i class="ti ti-info-circle"></i> Ayuda — click para ver
    </div>
    <div v-if="verAyuda" style="background:#FFFBF0;border:1px solid #F0E6C8;border-radius:6px;padding:12px 14px;margin-bottom:14px;font-size:12px;color:#5D4037">
      <strong>¿Para qué sirven?</strong> Cuando un cliente pregunta precio antes de comprar. Generas una cotización con validez de 45 días. Si decide comprar, se convierte en venta (Facturación) en un clic.
    </div>

    <!-- KPIs -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <div :class="['kpi-card', filtroEstado === 'activa' ? 'blue' : '']" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = filtroEstado === 'activa' ? '' : 'activa'">
        <div class="kpi-label">Activas</div>
        <div class="kpi-val" style="font-size:18px">{{ kpiActivas }}</div>
      </div>
      <div :class="['kpi-card', filtroEstado === 'por_vencer' ? 'gold' : '']" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = filtroEstado === 'por_vencer' ? '' : 'por_vencer'">
        <div class="kpi-label">Por vencer</div>
        <div class="kpi-val" style="font-size:18px;color:var(--gold)">{{ kpiPorVencer }}</div>
      </div>
      <div :class="['kpi-card', filtroEstado === 'vencida' ? 'red' : '']" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = filtroEstado === 'vencida' ? '' : 'vencida'">
        <div class="kpi-label">Vencidas</div>
        <div class="kpi-val" style="font-size:18px;color:var(--red)">{{ kpiVencidas }}</div>
      </div>
      <div :class="['kpi-card', filtroEstado === 'convertida' ? '' : '']" style="margin:0;padding:10px 14px;cursor:pointer" @click="filtroEstado = filtroEstado === 'convertida' ? '' : 'convertida'">
        <div class="kpi-label">Convertidas</div>
        <div class="kpi-val" style="font-size:18px;color:var(--green)">{{ kpiConvertidas }}</div>
        <div style="font-size:10px;color:var(--dgray)">{{ kpiTasaCierre }}</div>
      </div>
      <div v-if="filtroEstado" class="kpi-card" style="margin:0;padding:10px 14px;cursor:pointer;background:#F5F5F5" @click="filtroEstado = ''">
        <div class="kpi-label" style="color:var(--dgray)">Limpiar Filtros</div>
        <div class="kpi-val" style="font-size:18px;color:var(--navy)"><i class="ti ti-filter-off"></i></div>
      </div>
    </div>

    <!-- LISTADO DE PRESUPUESTOS -->
    <div class="card" style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th>N° Presupuesto</th>
            <th>Cliente</th>
            <th>Fecha</th>
            <th>Vence</th>
            <th class="num">Total USD</th>
            <th>Estado</th>
            <th class="center" style="width:130px">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="presupuestosFiltrados.length === 0">
            <td colspan="7" style="text-align:center;padding:30px;color:var(--dgray)">
              Sin presupuestos{{ store.empresa === 'directa' ? ' en Venta Directa' : ' en Distribuidora' }}
            </td>
          </tr>
          <tr v-for="pre in presupuestosFiltrados" :key="pre.id" class="fila-abre" title="Clic para ver el presupuesto"
            :style="pre.estado === 'rechazada' ? 'opacity:0.55' : ''" @click="abrirPreview(pre)">
            <td>
              <strong>{{ pre.num }}</strong>
              <div style="font-size:10.5px;color:var(--dgray)">{{ pre.items_count || 0 }} ítems · {{ pre.vendedor || '—' }}</div>
            </td>
            <td><strong>{{ pre.cliente }}</strong></td>
            <td style="font-size:12px;color:var(--dgray)">{{ pre.fecha }}</td>
            <td style="font-size:12px">
              {{ pre.vence }}
              <div style="font-size:10.5px;color:var(--dgray)">{{ diasRestantesTxt(pre) }}</div>
            </td>
            <td class="num" style="font-weight:700">{{ fmtUSD(pre.total) }}</td>
            <td>
              <span :style="badgeStyle(pre)">
                <i :class="badgeIcon(pre)"></i> {{ badgeText(pre) }}
              </span>
            </td>
            <td class="center" style="white-space:nowrap" @click.stop>
              <button
                v-if="pre.estado === 'activa' || pre.estado === 'por_vencer'"
                class="btn btn-primary btn-sm btn-accion"
                title="Convertir a factura"
                @click="convertirAFactura(pre)"
              ><i class="ti ti-file-invoice"></i> Facturar</button>
              {{ ' ' }}
              <button
                v-if="pre.estado !== 'convertida' && pre.estado !== 'rechazada'"
                class="btn btn-secondary btn-sm btn-accion" style="color:var(--red)"
                title="Marcar como rechazado (se archiva, no se borra)"
                @click="marcarRechazado(pre)"
              ><i class="ti ti-archive"></i> Rechazar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- 2. NUEVO PRESUPUESTO (PANTALLA COMPLETA ESTILO FACTURACIÓN - MONOLITO) -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <div v-else class="page active" id="page-nuevo-presupuesto">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="page-title"><i class="ti ti-file-text"></i> Nuevo Presupuesto</h1>
        <p class="page-sub" style="margin-bottom:0">
          Empresa: <strong>{{ store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora ARJ' }}</strong>
          · Vigencia: <strong>45 días</strong>
          · No descuenta stock hasta convertirse en venta
        </p>
      </div>
      <button class="btn btn-secondary" @click="cancelarNuevo">
        <i class="ti ti-arrow-left"></i> Volver a presupuestos
      </button>
    </div>

    <div class="help-box">
      <i class="ti ti-info-circle"></i>
      <div>
        <strong>Cómo funciona:</strong> Elige el cliente, agrega productos igual que en una factura. Al final puedes
        <strong>imprimir el presupuesto</strong> para el cliente o <strong>convertirlo en venta</strong>
        directamente (eso sí descuenta stock).
      </div>
    </div>

    <div class="factura-layout">
      <!-- COLUMNA PRINCIPAL -->
      <div>
        <!-- DATOS DEL CLIENTE -->
        <div class="card">
          <div class="card-tit"><i class="ti ti-user"></i> Datos del cliente</div>
          <div class="field-row">
            <label>Cliente:</label>
            <div ref="clienteBoxRef" style="display:flex;gap:8px;flex:1;position:relative">
              <input
                type="text"
                v-model="busquedaCliente"
                class="val-input"
                style="flex:1"
                placeholder="Buscar cliente por nombre o RIF..."
                autocomplete="off"
                @input="mostrarClientes = true"
                @focus="mostrarClientes = true"
              >
              <div
                v-if="mostrarClientes && clientesFiltrados.length > 0"
                class="search-results show"
                style="display:block;max-height:250px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;margin-top:40px;background:var(--card-bg);box-shadow:var(--shadow-lg);z-index:100;position:absolute;width:calc(100% - 46px)"
              >
                <div
                  class="search-result-item"
                  style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer"
                  @click="seleccionarConsumidorFinal"
                >
                  <strong style="color:var(--text)">-- Consumidor final (mostrador) --</strong>
                </div>
                <div
                  v-for="c in clientesFiltrados"
                  :key="c.id"
                  class="search-result-item"
                  style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between"
                  @click="seleccionarCliente(c)"
                >
                  <div>
                    <strong style="color:var(--navy)">{{ c.nombre }}</strong>
                    <div style="font-size:11px;color:var(--dgray);margin-top:2px">RIF: {{ c.rif || 'Sin RIF' }}</div>
                  </div>
                  <div v-if="store.empresa === 'distribuidora' && c.nivel" style="font-size:11px;color:var(--blue);font-weight:600">
                    Nivel: {{ c.nivel }}
                  </div>
                </div>
              </div>
              <button
                class="btn btn-primary btn-sm"
                title="Nuevo cliente rápido"
                style="white-space:nowrap;padding:6px 12px"
                @click="store.modalNuevoClienteActivo = true"
              >
                <i class="ti ti-user-plus"></i>
              </button>
            </div>
          </div>

          <!-- NIVEL DE PRECIO EN DISTRIBUIDORA -->
          <div v-if="store.empresa === 'distribuidora'" class="field-row" id="pre-fila-nivel-precio">
            <label>Nivel precio:</label>
            <div class="tier-selector" id="pre-tier-selector">
              <div
                :class="['tier-btn', { active: tierSel === 'Publico' }]"
                @click="cambiarTier('Publico')"
              >Público</div>
              <div
                :class="['tier-btn', { active: tierSel === 'T1' }]"
                @click="cambiarTier('T1')"
              >Aliado –5%</div>
              <div
                :class="['tier-btn', { active: tierSel === 'T2' }]"
                @click="cambiarTier('T2')"
              >Aliado –10%</div>
              <div
                :class="['tier-btn', { active: tierSel === 'T3' }]"
                @click="cambiarTier('T3')"
              >Mayorista –20%</div>
            </div>
          </div>

          <!-- NIVEL DE PRECIO EN VENTA DIRECTA -->
          <div v-else class="field-row" id="pre-fila-precio-publico-vd">
            <label>Nivel precio:</label>
            <div style="flex:1">
              <span style="background:var(--lblue);color:var(--navy);padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600">
                <i class="ti ti-tag"></i> Precio público
              </span>
            </div>
          </div>

          <!-- CLIENTE SELECCIONADO DETALLES -->
          <div v-if="clienteSel" style="display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--dgray);margin-top:5px;background:var(--lblue);padding:8px 12px;border-radius:6px">
            <div style="flex:1">
              <strong>Seleccionado:</strong> {{ clienteSel.nombre }}
              · <i class="ti ti-id"></i> {{ clienteSel.rif || 'Sin RIF' }}
              · <i class="ti ti-phone"></i> {{ clienteSel.tel || 'Sin teléfono' }}
              · <i class="ti ti-map-pin"></i> {{ clienteSel.direccion || 'Sin dirección' }}
            </div>
            <div v-if="clienteSel.id">
              Saldo pendiente: <strong style="color:var(--red)">{{ fmtUSD(store.empresa === 'directa' ? clienteSel.saldo_vd : clienteSel.saldo_dist) }}</strong>
            </div>
            <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px" @click="limpiarCliente" title="Quitar cliente"><i class="ti ti-x"></i></button>
          </div>

          <!-- NOTAS PARA EL CLIENTE -->
          <div class="field-row" style="flex-direction:column;align-items:flex-start;gap:6px;margin-top:10px">
            <label>Notas para el cliente (opcional):</label>
            <textarea
              v-model="preNotas"
              placeholder="Ej: Entrega inmediata. Precios sujetos a disponibilidad."
              style="width:100%;min-height:50px;background:#FFF;border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:13px;font-family:inherit;resize:vertical"
            ></textarea>
          </div>
        </div>

        <!-- AGREGAR PRODUCTOS -->
        <div class="card">
          <div class="card-tit"><i class="ti ti-search"></i> Agregar productos</div>
          <div ref="productoBoxRef" style="position:relative">
            <div class="search-box">
              <i class="ti ti-search"></i>
              <input
                type="text"
                v-model="busquedaProd"
                id="pre-busqueda-prod"
                placeholder="Busca por código, descripción o marca..."
                autocomplete="off"
                @input="mostrarResultadosProd = true"
                @focus="mostrarResultadosProd = true"
              >
            </div>

            <!-- RESULTADOS AUTOCOMPLETE PRODUCTOS -->
            <div
              v-if="mostrarResultadosProd && productosFiltrados.length > 0"
              class="search-results show"
              style="display:block;max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-top:6px;background:var(--card-bg);box-shadow:var(--shadow-lg);z-index:100;position:absolute;width:100%"
            >
              <div
                v-for="p in productosFiltrados"
                :key="p.id"
                class="search-item"
                style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;cursor:pointer"
                @click="agregarProducto(p)"
              >
                <div style="flex:1">
                  <div class="codigo" style="font-weight:700;color:var(--primary)">{{ p.cod_alt }} · {{ p.marca }}</div>
                  <div class="desc" style="font-size:12px;color:var(--text);margin-top:2px">{{ p.desc }}</div>
                  <div v-if="p.sistema" style="font-size:10.5px;color:var(--blue);margin-top:2px">
                    <i class="ti ti-settings" style="font-size:10px"></i> {{ p.sistema }}{{ p.marca_modelo ? ' · ' + p.marca_modelo.substring(0, 30) : '' }}
                  </div>
                </div>
                <div style="text-align:right">
                  <div class="precio" style="font-weight:800;color:var(--green);font-size:14px">
                    {{ fmtUSD(precioConTier(p.fob, tierSel, p)) }}
                  </div>
                  <div class="stock" style="font-size:11px;color:var(--dgray);margin-top:2px">
                    Stock: {{ stockDe(p) }}
                  </div>
                </div>
              </div>
            </div>
            <div
              v-else-if="mostrarResultadosProd && busquedaProd.trim().length > 0 && productosFiltrados.length === 0"
              class="search-results show"
              style="display:block;border:1px solid var(--border);border-radius:8px;margin-top:6px;background:var(--card-bg);box-shadow:var(--shadow-lg);z-index:100;position:absolute;width:100%"
            >
              <div style="padding:14px;color:var(--dgray);text-align:center;font-size:12px">
                Sin resultados para "{{ busquedaProd }}"
              </div>
            </div>
          </div>

          <!-- FILTRAR POR SISTEMA -->
          <div style="display:flex;gap:8px;align-items:center;margin-top:10px;margin-bottom:12px">
            <label style="font-size:11.5px;color:var(--dgray);font-weight:600;white-space:nowrap">Filtrar por sistema:</label>
            <select
              v-model="filtroSistema"
              class="val-input"
              style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:inherit"
            >
              <option value="">Todos los sistemas</option>
              <option v-for="sis in sistemasDisponibles" :key="sis" :value="sis">{{ sis }}</option>
            </select>
          </div>

          <!-- TABLA DE ITEMS -->
          <table class="tbl" id="pre-tbl-items">
            <thead>
              <tr>
                <th style="width:14%">Código</th>
                <th style="width:34%">Descripción</th>
                <th class="num" style="width:13%">Cantidad</th>
                <th class="num" style="width:16%">Precio USD</th>
                <th class="num" style="width:16%">Total USD</th>
                <th style="width:5%"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="items.length === 0">
                <td colspan="6" style="text-align:center;padding:24px;color:var(--dgray)">
                  No has agregado productos. Usa el buscador de arriba ↑
                </td>
              </tr>
              <template v-for="(it, i) in items" :key="i">
                <tr>
                  <td><strong>{{ it.cod_alt }}</strong></td>
                  <td>
                    {{ it.desc }}
                    <div style="font-size:11px;color:var(--dgray)">{{ it.marca }}</div>
                  </td>
                  <td class="num">
                    <input
                      type="number"
                      class="qty-cell"
                      v-model.number="it.cant"
                      min="1"
                      @change="validarCantidad(it)"
                    >
                  </td>
                  <td class="num">
                    <input
                      v-if="store.rol === 'gerente'"
                      type="number"
                      step="0.5"
                      min="0"
                      v-model.number="it.precio"
                      class="qty-cell"
                      style="width:80px;text-align:right;font-size:12px"
                      title="Ajuste de precio unitario (gerente)"
                    >
                    <span v-else>{{ fmtUSD(it.precio) }}</span>
                  </td>
                  <td class="num"><strong>{{ fmtUSD(it.cant * it.precio) }}</strong></td>
                  <td>
                    <button class="del-btn" @click="quitarItem(i)" title="Quitar producto">
                      <i class="ti ti-x"></i>
                    </button>
                  </td>
                </tr>
                <tr v-if="sinFob(it)">
                  <td colspan="6" style="padding:0">
                    <div style="margin:0;background:#FDECEA;border-left:3px solid var(--red);padding:8px 12px;font-size:11.5px;color:#8B1A10;display:flex;gap:8px;align-items:flex-start">
                      <i class="ti ti-alert-octagon" style="font-size:15px;margin-top:1px"></i>
                      <div>
                        <strong>{{ it.cod_alt }} no tiene costo cargado (FOB en 0).</strong>
                        {{ it.precio > 0 ? 'El precio no está respaldado por un costo.' : 'Saldría en el presupuesto a $0,00.' }}
                        No se podrá guardar ni imprimir hasta corregir el FOB en Inventario.
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- COLUMNA DERECHA: TOTALES Y ACCIONES -->
      <div>
        <div class="total-box">
          <div class="total-row"><span>Subtotal</span><span>{{ fmtUSD(subtotalUSD) }}</span></div>
          <div class="total-row iva-zero"><span><i class="ti ti-info-circle"></i> IVA (exento)</span><span>$ 0,00</span></div>
          <div class="total-row big"><span>TOTAL</span><span>{{ fmtUSD(totalUSD) }}</span></div>
          <div class="total-row small"><span>Equiv. Bs. (BCV)</span><span>Bs. {{ totalBs }}</span></div>
        </div>

        <div style="background:#FFF8E1;border:1px solid #FFC107;border-radius:8px;padding:12px 14px;margin-bottom:12px;font-size:12px;color:#5D4037">
          <i class="ti ti-clock"></i> Este presupuesto será válido por <strong>45 días</strong>. No afecta el inventario hasta que lo conviertas en venta.
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-primary" :disabled="guardando" @click="guardarEImprimir" style="width:100%">
            <i class="ti ti-printer"></i> Guardar e imprimir presupuesto
          </button>
          <button class="btn btn-green" :disabled="guardando" @click="convertirAVentaAhora" style="width:100%">
            <i class="ti ti-businessplan"></i> Convertir en venta ahora
          </button>
          <button class="btn btn-secondary" @click="cancelarNuevo" style="width:100%">
            <i class="ti ti-x"></i> Cancelar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD, precioConTier, sinFob } from '../services/pricing.js';

const store = useArjStore();

// Vista activa interna: lista o pantalla completa nuevo presupuesto
const modoNuevo = ref(false);

// Filtros y KPIs del listado
const verRechazados = ref(false);
const verAyuda = ref(false);
const filtroEstado = ref('');

// ═══════════════════════════════════════════════════════════════
// ESTADO NUEVO PRESUPUESTO (PANTALLA ESTILO FACTURACIÓN)
// ═══════════════════════════════════════════════════════════════
const clienteSel = ref(null);
const busquedaCliente = ref('');
const mostrarClientes = ref(false);
const tierSel = ref('Publico');
const preNotas = ref('');
const items = ref([]);
const busquedaProd = ref('');
const mostrarResultadosProd = ref(false);
const filtroSistema = ref('');
const guardando = ref(false);

const clienteBoxRef = ref(null);
const productoBoxRef = ref(null);

function onClickOutside(e) {
  if (clienteBoxRef.value && !clienteBoxRef.value.contains(e.target)) {
    mostrarClientes.value = false;
  }
  if (productoBoxRef.value && !productoBoxRef.value.contains(e.target)) {
    mostrarResultadosProd.value = false;
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    mostrarClientes.value = false;
    mostrarResultadosProd.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside);
  document.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside);
  document.removeEventListener('keydown', onKeyDown);
});

// ═══════════════════════════════════════════════════════════════
// LISTADO Y KPIS
// ═══════════════════════════════════════════════════════════════
const presupuestosEmpresa = computed(() => {
  return store.presupuestos.filter(p => p.empresa === store.empresa);
});

const kpiActivas = computed(() => presupuestosEmpresa.value.filter(c => c.estado === 'activa').length);
const kpiPorVencer = computed(() => presupuestosEmpresa.value.filter(c => c.estado === 'por_vencer').length);
const kpiVencidas = computed(() => presupuestosEmpresa.value.filter(c => c.estado === 'vencida').length);
const kpiConvertidas = computed(() => presupuestosEmpresa.value.filter(c => c.estado === 'convertida').length);
const kpiRechazadas = computed(() => presupuestosEmpresa.value.filter(c => c.estado === 'rechazada').length);
const kpiTasaCierre = computed(() => {
  const cerrados = kpiConvertidas.value + kpiRechazadas.value;
  return cerrados > 0 ? Math.round(kpiConvertidas.value / cerrados * 100) + '% de cierre' : '—';
});

const presupuestosFiltrados = computed(() => {
  let list = presupuestosEmpresa.value;
  if (!verRechazados.value) {
    list = list.filter(p => p.estado !== 'rechazada');
  }
  if (filtroEstado.value) {
    list = list.filter(p => p.estado === filtroEstado.value);
  }
  return list;
});

function diasRestantesTxt(pre) {
  const dias = pre.dias_restantes;
  if (dias === undefined || dias === null) return '';
  if (dias >= 0) return `${dias} días restantes`;
  return `Venció hace ${Math.abs(dias)} días`;
}

function badgeStyle(pre) {
  const colors = {
    'rechazada': 'var(--dgray)',
    'convertida': 'var(--blue)',
    'vencida': 'var(--red)',
    'por_vencer': 'var(--gold)',
    'activa': 'var(--green)'
  };
  const c = colors[pre.estado] || 'var(--dgray)';
  return `background:${c}22;color:${c};padding:3px 8px;border-radius:10px;font-size:10.5px;font-weight:600`;
}

function badgeIcon(pre) {
  const icons = {
    'rechazada': 'ti ti-archive',
    'convertida': 'ti ti-file-invoice',
    'vencida': 'ti ti-x-circle',
    'por_vencer': 'ti ti-alert-triangle',
    'activa': 'ti ti-circle-check'
  };
  return icons[pre.estado] || 'ti ti-circle';
}

function badgeText(pre) {
  const texts = {
    'rechazada': 'RECHAZADA',
    'convertida': 'CONVERTIDA',
    'vencida': 'VENCIDA',
    'por_vencer': 'POR VENCER',
    'activa': 'ACTIVA'
  };
  return texts[pre.estado] || pre.estado?.toUpperCase() || '—';
}

function abrirPreview(pre) {
  store.presupuestoSeleccionado = pre;
  store.modalPresupuestoActivo = true;
}

function convertirAFactura(pre) {
  if (confirm(`¿Convertir el presupuesto ${pre.num} en factura?\n\nLos datos se cargarán automáticamente en el módulo de facturación.`)) {
    store.convertirPresupuestoEnVenta(pre.id);
  }
}

async function marcarRechazado(pre) {
  if (!confirm(`¿Marcar ${pre.num} como RECHAZADA?\n\nNo se borra: se archiva y deja de aparecer en la lista.`)) return;
  if (await store.rechazarPresupuesto(pre.id)) {
    store.logBitacora('presupuesto', `Cotización ${pre.num} marcada como rechazada`);
    store.notif(`Presupuesto ${pre.num} archivado`, 'info');
  }
}

// ═══════════════════════════════════════════════════════════════
// LOGICA DE PANTALLA COMPLETA NUEVO PRESUPUESTO
// ═══════════════════════════════════════════════════════════════
function iniciarNuevoPresupuesto() {
  limpiarNuevo();
  tierSel.value = store.empresa === 'directa' ? 'Publico' : 'Publico';
  modoNuevo.value = true;
}

function limpiarNuevo() {
  clienteSel.value = null;
  busquedaCliente.value = '';
  mostrarClientes.value = false;
  tierSel.value = 'Publico';
  preNotas.value = '';
  items.value = [];
  busquedaProd.value = '';
  mostrarResultadosProd.value = false;
  filtroSistema.value = '';
}

function cancelarNuevo() {
  if (items.value.length > 0) {
    if (!confirm('¿Deseas descartar este nuevo presupuesto? Se perderán los productos agregados.')) {
      return;
    }
  }
  limpiarNuevo();
  modoNuevo.value = false;
}

const clientesFiltrados = computed(() => {
  const query = busquedaCliente.value.trim().toLowerCase();
  const base = store.clientes.filter(c => c.empresa === store.empresa || c.empresa === 'ambas' || !c.empresa);
  if (!query) return base.slice(0, 50);
  return base.filter(c =>
    (c.nombre || '').toLowerCase().includes(query) || (c.rif || '').toLowerCase().includes(query)
  ).slice(0, 50);
});

function seleccionarCliente(c) {
  clienteSel.value = c;
  busquedaCliente.value = c ? c.nombre : '';
  mostrarClientes.value = false;
  if (store.empresa === 'distribuidora') {
    cambiarTier((c && c.nivel) || 'Publico');
  } else {
    cambiarTier('Publico');
  }
}

function seleccionarConsumidorFinal() {
  clienteSel.value = { id: null, nombre: 'CLIENTE MOSTRADOR', rif: '', tel: '', direccion: '', saldo_vd: 0, saldo_dist: 0 };
  busquedaCliente.value = 'CLIENTE MOSTRADOR';
  mostrarClientes.value = false;
  cambiarTier('Publico');
}

function limpiarCliente() {
  clienteSel.value = null;
  busquedaCliente.value = '';
  if (store.empresa === 'distribuidora') {
    cambiarTier('Publico');
  }
}

function cambiarTier(nuevoTier) {
  tierSel.value = nuevoTier;
  items.value.forEach(it => {
    const prod = it.prodRef || store.productos.find(p => p.id === it.id);
    if (prod) {
      it.precio = precioConTier(it.fob, nuevoTier, prod);
    }
  });
}

function stockDe(p) {
  if (!p) return 0;
  return store.empresa === 'directa' ? (p.stock_vd || 0) : (p.stock_dist || 0);
}

const sistemasDisponibles = computed(() => {
  const set = new Set();
  store.productos.forEach(p => {
    if (p.sistema && p.sistema.trim()) set.add(p.sistema.trim());
  });
  return Array.from(set).sort();
});

const productosFiltrados = computed(() => {
  const q = (busquedaProd.value || '').trim().toLowerCase();
  const sis = filtroSistema.value;
  if (!q && !sis) return [];
  const words = q.split(/\s+/).filter(w => w.length > 0);
  return store.productos.filter(p => {
    if (sis && (p.sistema || '') !== sis) return false;
    if (words.length === 0) return true;
    const text = `${p.cod_alt || ''} ${p.cod_orig || ''} ${p.cod_barras || ''} ${p.desc || ''} ${p.marca || ''}`.toLowerCase();
    return words.every(w => text.includes(w));
  }).slice(0, 12);
});

function agregarProducto(p) {
  const ex = items.value.find(i => i.id === p.id || i.cod_alt === p.cod_alt);
  if (ex) {
    ex.cant += 1;
  } else {
    items.value.push({
      id: p.id,
      cod_alt: p.cod_alt,
      desc: p.desc,
      marca: p.marca || '',
      fob: p.fob || 0,
      cant: 1,
      precio: precioConTier(p.fob, tierSel.value, p),
      prodRef: p
    });
  }
  busquedaProd.value = '';
  mostrarResultadosProd.value = false;
}

function quitarItem(i) {
  items.value.splice(i, 1);
}

function validarCantidad(it) {
  if (!it.cant || it.cant < 1) it.cant = 1;
}

const subtotalUSD = computed(() => {
  return items.value.reduce((acc, it) => acc + (it.cant * it.precio), 0);
});

const totalUSD = computed(() => subtotalUSD.value);

const totalBs = computed(() => {
  const tasa = store.tasa_bcv || 1;
  return (totalUSD.value * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});

function validarItemsFob() {
  const sinCosto = items.value.filter(sinFob);
  if (sinCosto.length > 0) {
    const lista = sinCosto.map(it => `• ${it.cod_alt} — ${it.desc || 'sin descripción'}`).join('\n');
    alert(`No se puede guardar el presupuesto: ${sinCosto.length} producto(s) no tienen costo cargado (FOB en 0).\n\n${lista}\n\nEl presupuesto se le entrega al cliente y el precio queda comprometido. Corrige el FOB en Inventario, o quita el producto del presupuesto.`);
    store.notif(`Presupuesto bloqueado: ${sinCosto.length} producto(s) sin FOB`, 'error');
    return false;
  }
  return true;
}

async function guardarEImprimir() {
  if (!clienteSel.value) {
    store.notif('Selecciona un cliente para el presupuesto', 'error');
    return;
  }
  if (items.value.length === 0) {
    store.notif('Agrega al menos un producto al presupuesto', 'error');
    return;
  }
  if (!validarItemsFob()) return;

  guardando.value = true;
  try {
    const pre = await store.guardarPresupuesto({
      cliente_id: clienteSel.value.id || null,
      cliente: clienteSel.value.nombre,
      items: items.value.map(it => ({
        id: it.id,
        cod_alt: it.cod_alt,
        desc: it.desc,
        cant: it.cant,
        fob: it.fob,
        precio: it.precio
      })),
      tier: tierSel.value
    });
    if (pre) {
      store.presupuestoSeleccionado = pre;
      store.modalPresupuestoActivo = true;
      limpiarNuevo();
      modoNuevo.value = false;
    }
  } finally {
    guardando.value = false;
  }
}

async function convertirAVentaAhora() {
  if (!clienteSel.value) {
    store.notif('Selecciona un cliente para el presupuesto', 'error');
    return;
  }
  if (items.value.length === 0) {
    store.notif('Agrega al menos un producto al presupuesto', 'error');
    return;
  }
  if (!validarItemsFob()) return;

  guardando.value = true;
  try {
    const pre = await store.guardarPresupuesto({
      cliente_id: clienteSel.value.id || null,
      cliente: clienteSel.value.nombre,
      items: items.value.map(it => ({
        id: it.id,
        cod_alt: it.cod_alt,
        desc: it.desc,
        cant: it.cant,
        fob: it.fob,
        precio: it.precio
      })),
      tier: tierSel.value
    });
    if (pre) {
      limpiarNuevo();
      modoNuevo.value = false;
      store.convertirPresupuestoEnVenta(pre.id);
    }
  } finally {
    guardando.value = false;
  }
}
</script>
