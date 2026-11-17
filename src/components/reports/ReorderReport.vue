<template>
  <div class="reorder-report-card">
    <!-- ═══ HEADER Y CONTROLES PRINCIPALES ═══ -->
    <div class="reorder-header">
      <div class="header-left">
        <div class="icon-wrap-gold">
          <i class="ti ti-package-import"></i>
        </div>
        <div>
          <h3 class="reorder-title">Asistente de Reorden e Inventario Crítico</h3>
          <p class="reorder-sub">
            Sugerencia inteligente de reposición para <strong>{{ empresaNombre }}</strong> · Basado en stock mínimo, ritmo de ventas y runway
          </p>
        </div>
      </div>

      <!-- Acciones de Cabecera: Selector de Empresa y Exportación -->
      <div class="header-right-actions">
        <!-- Selector de Empresa -->
        <div class="control-pill-select">
          <i class="ti ti-building" style="color:var(--dgray);font-size:13px"></i>
          <select v-model="empresaSel" class="dash-select">
            <option value="directa">Venta Directa</option>
            <option value="dist">Distribuidora</option>
          </select>
        </div>

        <button
          class="btn btn-primary"
          :disabled="!itemsFiltrados.length"
          @click="exportarCSV"
          :title="'Exportar orden de compra con ' + (itemsSeleccionados.size > 0 ? itemsSeleccionados.size + ' productos seleccionados' : itemsFiltrados.length + ' productos')"
        >
          <i class="ti ti-download"></i>
          Descargar Orden (CSV)
          <span v-if="itemsSeleccionados.size > 0" class="btn-count-badge">
            {{ itemsSeleccionados.size }}
          </span>
        </button>
      </div>
    </div>

    <!-- ═══ MINI KPIS RESUMEN DE COMPRAS (DINÁMICOS) ═══ -->
    <div class="reorder-kpis">
      <div class="reorder-kpi-card">
        <span class="rkpi-label">Ítems Críticos</span>
        <div class="rkpi-val">{{ itemsReorden.length }}</div>
        <span class="rkpi-sub">≤ {{ umbral }} unidades en almacén</span>
      </div>

      <div class="reorder-kpi-card">
        <span class="rkpi-label">Agotados (Urgentes)</span>
        <div class="rkpi-val font-red">{{ totalAgotados }}</div>
        <span class="rkpi-sub">En cero — ventas detenidas</span>
      </div>

      <div class="reorder-kpi-card">
        <span class="rkpi-label">
          Unidades Sugeridas
          <span v-if="itemsSeleccionados.size > 0" class="kpi-tag-sel">({{ itemsSeleccionados.size }} sel.)</span>
        </span>
        <div class="rkpi-val font-blue">{{ statsPresupuesto.unidades.toLocaleString('es-VE') }}</div>
        <span class="rkpi-sub">Para cubrir stock de seguridad</span>
      </div>

      <div class="reorder-kpi-card">
        <span class="rkpi-label">
          Presupuesto Estimado
          <span v-if="itemsSeleccionados.size > 0" class="kpi-tag-sel">({{ itemsSeleccionados.size }} sel.)</span>
        </span>
        <div class="rkpi-val font-green">{{ fmtUSD(statsPresupuesto.totalUSD) }}</div>
        <span class="rkpi-sub">Costo de reposición estimado</span>
      </div>
    </div>

    <!-- ═══ BARRA DE HERRAMIENTAS Y FILTROS AVANZADOS ═══ -->
    <div class="reorder-toolbar-adv">
      <div class="toolbar-left-group">
        <!-- Píldoras de Estado de Urgencia -->
        <div class="pills-filter">
          <button
            :class="['filter-pill', { active: filtro === 'todos' }]"
            @click="filtro = 'todos'"
          >
            Todos ({{ itemsReorden.length }})
          </button>
          <button
            :class="['filter-pill', { active: filtro === 'agotados' }]"
            @click="filtro = 'agotados'"
          >
            Solo Agotados ({{ totalAgotados }})
          </button>
          <button
            :class="['filter-pill', { active: filtro === 'criticos' }]"
            @click="filtro = 'criticos'"
          >
            Urgentes &le; 15d ({{ totalRunwayCritico }})
          </button>
          <button
            :class="['filter-pill', { active: filtro === 'bajos' }]"
            @click="filtro = 'bajos'"
          >
            Bajo Stock ({{ itemsReorden.length - totalAgotados }})
          </button>
        </div>

        <!-- Selector de Origen (Nacional vs Importado) -->
        <div class="control-pill-select sm">
          <i class="ti ti-world" style="color:var(--dgray);font-size:12px"></i>
          <select v-model="filtroOrigen" class="dash-select sm">
            <option value="todos">Todos los orígenes</option>
            <option value="importado">Solo Importados</option>
            <option value="local">Solo Nacionales</option>
          </select>
        </div>

        <!-- Selector de Marca (si hay marcas disponibles) -->
        <div v-if="marcasDisponibles.length > 1" class="control-pill-select sm">
          <i class="ti ti-tag" style="color:var(--dgray);font-size:12px"></i>
          <select v-model="filtroMarca" class="dash-select sm">
            <option value="todas">Todas las marcas</option>
            <option v-for="m in marcasDisponibles" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>

      <div class="toolbar-right-group">
        <!-- Selector de Umbral de Alerta -->
        <div class="umbral-select-wrap">
          <span class="umbral-label">Umbral:</span>
          <div class="umbral-buttons">
            <button
              v-for="u in [5, 10, 15, 20]"
              :key="u"
              :class="['umbral-btn', { active: umbralPersonalizado === u }]"
              @click="umbralPersonalizado = u"
              :title="'Alerta para productos con stock menor o igual a ' + u + ' unidades'"
            >
              &le;{{ u }}
            </button>
          </div>
        </div>

        <!-- Buscador de texto -->
        <div class="search-input-wrap">
          <i class="ti ti-search search-icon"></i>
          <input
            v-model="busqueda"
            type="text"
            class="val-input reorder-search"
            placeholder="Buscar código, OEM, descripción..."
          >
        </div>
      </div>
    </div>

    <!-- ═══ BARRA DE GESTIÓN DE SELECCIÓN (BULK ACTIONS) ═══ -->
    <div v-if="itemsFiltrados.length" class="selection-status-bar">
      <label class="select-all-label">
        <input
          type="checkbox"
          :checked="todosSeleccionados"
          @change="toggleSeleccionarTodos"
          class="custom-check"
        >
        <span>
          {{ itemsSeleccionados.size > 0 ? `${itemsSeleccionados.size} de ${itemsFiltrados.length} seleccionados para compra` : `Seleccionar todos (${itemsFiltrados.length})` }}
        </span>
      </label>

      <div v-if="itemsSeleccionados.size > 0" class="selection-meta">
        <span class="sel-amt font-green">
          Subtotal marcado: <strong>{{ fmtUSD(statsPresupuesto.totalUSD) }}</strong> ({{ statsPresupuesto.unidades }} uds)
        </span>
        <button class="btn-clear-sel" @click="itemsSeleccionados.clear()">
          <i class="ti ti-x"></i> Desmarcar todos
        </button>
      </div>
      <div v-else class="selection-hint">
        Marca los productos que desees incluir en tu orden de compra
      </div>
    </div>

    <!-- ═══ TABLA DE SUGERENCIAS DE COMPRA ═══ -->
    <div v-if="!itemsFiltrados.length" class="empty-state">
      <i class="ti ti-circle-check" style="font-size:36px;color:var(--green);margin-bottom:8px"></i>
      <div style="font-weight:700;font-size:15px;color:var(--text)">
        {{ itemsReorden.length === 0 ? `¡Excelente! No hay productos con stock crítico en ${empresaNombre}` : 'No hay productos que coincidan con los filtros seleccionados' }}
      </div>
      <div style="color:var(--dgray);font-size:12px;margin-top:4px">
        Todos los productos superan el umbral mínimo de {{ umbral }} unidades en este almacén.
      </div>
    </div>

    <div v-else class="table-responsive">
      <table class="tbl tbl-reorder">
        <thead>
          <tr>
            <th style="width:36px;text-align:center">
              <input
                type="checkbox"
                :checked="todosSeleccionados"
                @change="toggleSeleccionarTodos"
                class="custom-check"
                title="Seleccionar o deseleccionar todos los visibles"
              >
            </th>
            <th style="text-align:left">Código / OEM</th>
            <th style="text-align:left">Descripción y Marca</th>
            <th style="text-align:center">Stock Actual</th>
            <th style="text-align:center">Vendido Mes</th>
            <th style="text-align:center">Runway (Cobertura)</th>
            <th style="text-align:center">Sugerencia Pedido</th>
            <th style="text-align:right">Costo Estimado</th>
            <th style="text-align:center">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in itemsFiltrados.slice(0, 80)"
            :key="item.id || item.cod_alt"
            :class="{ 'row-selected': isSeleccionado(item) }"
          >
            <!-- Checkbox de selección -->
            <td style="text-align:center">
              <input
                type="checkbox"
                :checked="isSeleccionado(item)"
                @change="toggleSeleccion(item)"
                class="custom-check"
              >
            </td>

            <!-- Código y OEM -->
            <td style="font-weight:700;font-family:monospace;color:var(--blue)">
              {{ item.cod_alt }}
              <div v-if="item.cod_orig" class="oem-sub">
                OEM: {{ item.cod_orig }}
              </div>
            </td>

            <!-- Descripción y Marca -->
            <td>
              <div class="desc-line">{{ item.desc }}</div>
              <div class="prod-meta-tags">
                <span class="badge-origen" :class="item.origen === 'local' ? 'origen-local' : 'origen-importado'">
                  {{ item.origen === 'local' ? 'Nacional' : 'Importado' }}
                </span>
                <span v-if="item.marca" class="meta-tag-sub">
                  {{ item.marca }}
                </span>
                <span v-if="item.sistema" class="meta-tag-sub">
                  {{ item.sistema }}
                </span>
              </div>
            </td>

            <!-- Stock Actual -->
            <td style="text-align:center">
              <span class="stock-pill" :class="item.stock <= 0 ? 'stock-cero' : 'stock-bajo'">
                {{ item.stock }} ud{{ item.stock !== 1 ? 's' : '' }}
              </span>
            </td>

            <!-- Vendido en el Mes -->
            <td style="text-align:center;font-weight:700;color:var(--text)">
              {{ item.ventasMes > 0 ? item.ventasMes + ' uds' : '—' }}
            </td>

            <!-- Días de Inventario Restante (Runway) -->
            <td style="text-align:center">
              <span class="runway-pill" :class="item.runwayClase" :title="item.runwayTooltip">
                <i :class="item.runwayIcon"></i> {{ item.runwayTexto }}
              </span>
            </td>

            <!-- Sugerencia Pedido -->
            <td style="text-align:center">
              <span class="sug-pill">
                +{{ item.sugerencia }} uds
              </span>
            </td>

            <!-- Costo Estimado -->
            <td style="text-align:right">
              <div class="cost-total-val font-text">
                {{ fmtUSD(item.costoTotal) }}
              </div>
              <div class="cost-unit-sub">
                @ {{ fmtUSD(item.costoUnit) }}/ud
              </div>
            </td>

            <!-- Estado / Badge de Urgencia -->
            <td style="text-align:center">
              <span v-if="item.stock <= 0" class="badge-estado agotado">Agotado</span>
              <span v-else-if="item.stock <= umbral / 2" class="badge-estado critico">Muy bajo</span>
              <span v-else class="badge-estado bajo">Bajo</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="itemsFiltrados.length > 80" class="table-more-note">
        Mostrando los 80 productos de mayor urgencia. La descarga en CSV incluye todos los {{ itemsFiltrados.length }} productos.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { fmtUSD, costoLanded } from '../../services/pricing.js';
import { descargarCSV, hoyArchivo } from '../../services/monolito.js';

const props = defineProps({
  productos: {
    type: Array,
    default: () => []
  },
  empresa: {
    type: String,
    default: 'directa'
  },
  ventasItems: {
    type: Array,
    default: () => []
  }
});

// Selector de empresa interno (permite alternar sin salir al navbar)
const empresaSel = ref(props.empresa === 'dist' || props.empresa === 'distribuidora' ? 'dist' : 'directa');

watch(() => props.empresa, (nueva) => {
  if (nueva) {
    empresaSel.value = nueva === 'dist' || nueva === 'distribuidora' ? 'dist' : 'directa';
  }
});

// Umbral personalizado de alerta de stock
const umbralPersonalizado = ref(10);
const umbral = computed(() => umbralPersonalizado.value);

const empresaNombre = computed(() => (empresaSel.value === 'directa' ? 'Venta Directa' : 'Distribuidora'));
const campoStock = computed(() => (empresaSel.value === 'directa' ? 'stock_vd' : 'stock_dist'));

// Filtros y búsqueda
const filtro = ref('todos');
const filtroOrigen = ref('todos');
const filtroMarca = ref('todas');
const busqueda = ref('');

// Conjunto de productos seleccionados para la orden de compra
const itemsSeleccionados = ref(new Set());

// Mapa de unidades vendidas por producto en el período
const ventasPorProd = computed(() => {
  const map = {};
  if (!props.ventasItems || !props.ventasItems.length) return map;
  props.ventasItems.forEach(it => {
    const k = it.producto_id || it.cod_alt || it.codigo || it.cod;
    if (k) map[k] = (map[k] || 0) + (parseFloat(it.cantidad) || parseFloat(it.cant) || 0);
  });
  return map;
});

// Cálculo de la lista completa de ítems para reorden
const itemsReorden = computed(() => {
  const u = umbral.value;
  const campo = campoStock.value;
  const vMap = ventasPorProd.value;
  const prods = props.productos || [];

  return prods
    .filter(p => (Number(p[campo]) || 0) <= u)
    .map(p => {
      const stock = Math.max(0, Number(p[campo]) || 0);
      const k = p.id || p.cod_alt;
      const ventasMes = vMap[k] || vMap[p.cod_alt] || 0;

      // Cálculo de reposición inteligente:
      // Repone hasta el doble del umbral o el doble de las ventas mensuales si tiene alta rotación
      const objetivo = Math.max(u * 2, Math.round(ventasMes * 2) || (u * 2));
      const sugerencia = Math.max(1, objetivo - stock);

      const cu = costoLanded(p, prods) || p.fob || 0;
      const costoTotal = sugerencia * cu;

      // Cálculo de Runway (Días de Inventario Restante)
      let runwayDias = 999;
      let runwayTexto = 'Sin ventas';
      let runwayClase = 'runway-neutral';
      let runwayIcon = 'ti ti-minus';
      let runwayTooltip = 'No registra ventas en el período actual';

      if (stock === 0) {
        runwayDias = 0;
        runwayTexto = '0 días';
        runwayClase = 'runway-cero';
        runwayIcon = 'ti ti-alert-triangle';
        runwayTooltip = 'Agotado: Ventas detenidas';
      } else if (ventasMes > 0) {
        const ventasPorDia = ventasMes / 30;
        runwayDias = Math.round(stock / ventasPorDia);
        runwayTexto = `${runwayDias} día${runwayDias !== 1 ? 's' : ''}`;

        if (runwayDias <= 15) {
          runwayClase = 'runway-urgente';
          runwayIcon = 'ti ti-flame';
          runwayTooltip = 'Crítico: Se agota en menos de 15 días';
        } else if (runwayDias <= 30) {
          runwayClase = 'runway-alerta';
          runwayIcon = 'ti ti-clock';
          runwayTooltip = 'Alerta: Cobertura de menos de 1 mes';
        } else {
          runwayClase = 'runway-ok';
          runwayIcon = 'ti ti-check';
          runwayTooltip = 'Stock suficiente para más de 30 días';
        }
      }

      return {
        ...p,
        stock,
        ventasMes,
        sugerencia,
        costoUnit: cu,
        costoTotal,
        runwayDias,
        runwayTexto,
        runwayClase,
        runwayIcon,
        runwayTooltip
      };
    })
    .sort((a, b) => {
      // 1. Agotados primero
      if (a.stock === 0 && b.stock > 0) return -1;
      if (b.stock === 0 && a.stock > 0) return 1;
      // 2. Menor runway (los que se agotan más rápido)
      if (a.runwayDias !== b.runwayDias) return a.runwayDias - b.runwayDias;
      // 3. Mayor venta mensual o mayor volumen
      return (b.ventasMes - a.ventasMes) || (b.costoTotal - a.costoTotal);
    });
});

// Métricas de resumen
const totalAgotados = computed(() => itemsReorden.value.filter(i => i.stock <= 0).length);
const totalRunwayCritico = computed(() => itemsReorden.value.filter(i => i.runwayDias <= 15).length);

// Lista de marcas disponibles dentro de los productos críticos
const marcasDisponibles = computed(() => {
  const marcas = new Set();
  itemsReorden.value.forEach(i => {
    if (i.marca && i.marca.trim()) marcas.add(i.marca.trim());
  });
  return Array.from(marcas).sort();
});

// Lista filtrada según todos los controles activos
const itemsFiltrados = computed(() => {
  let list = itemsReorden.value;

  // Filtro de urgencia
  if (filtro.value === 'agotados') {
    list = list.filter(i => i.stock <= 0);
  } else if (filtro.value === 'criticos') {
    list = list.filter(i => i.runwayDias <= 15);
  } else if (filtro.value === 'bajos') {
    list = list.filter(i => i.stock > 0);
  }

  // Filtro de origen
  if (filtroOrigen.value === 'importado') {
    list = list.filter(i => (i.origen || 'importado') === 'importado');
  } else if (filtroOrigen.value === 'local') {
    list = list.filter(i => i.origen === 'local');
  }

  // Filtro de marca
  if (filtroMarca.value !== 'todas') {
    list = list.filter(i => i.marca === filtroMarca.value);
  }

  // Búsqueda de texto
  const q = busqueda.value.trim().toLowerCase();
  if (q) {
    list = list.filter(i =>
      (i.cod_alt && i.cod_alt.toLowerCase().includes(q)) ||
      (i.cod_orig && i.cod_orig.toLowerCase().includes(q)) ||
      (i.desc && i.desc.toLowerCase().includes(q)) ||
      (i.marca && i.marca.toLowerCase().includes(q)) ||
      (i.sistema && i.sistema.toLowerCase().includes(q))
    );
  }

  return list;
});

// Cálculo dinámico de presupuesto: si hay selección específica usa la selección, sino todo lo filtrado
const statsPresupuesto = computed(() => {
  let objetivo = itemsFiltrados.value;
  if (itemsSeleccionados.value.size > 0) {
    objetivo = itemsFiltrados.value.filter(i => itemsSeleccionados.value.has(i.id || i.cod_alt));
  }

  const unidades = objetivo.reduce((acc, i) => acc + i.sugerencia, 0);
  const totalUSD = objetivo.reduce((acc, i) => acc + i.costoTotal, 0);
  return { unidades, totalUSD };
});

// Manejo de Selección para compras
function isSeleccionado(item) {
  const k = item.id || item.cod_alt;
  return itemsSeleccionados.value.has(k);
}

function toggleSeleccion(item) {
  const k = item.id || item.cod_alt;
  if (itemsSeleccionados.value.has(k)) {
    itemsSeleccionados.value.delete(k);
  } else {
    itemsSeleccionados.value.add(k);
  }
}

const todosSeleccionados = computed(() => {
  if (!itemsFiltrados.value.length) return false;
  return itemsFiltrados.value.every(i => itemsSeleccionados.value.has(i.id || i.cod_alt));
});

function toggleSeleccionarTodos() {
  if (todosSeleccionados.value) {
    itemsSeleccionados.value.clear();
  } else {
    itemsFiltrados.value.forEach(i => itemsSeleccionados.value.add(i.id || i.cod_alt));
  }
}

// Exportación en CSV
function exportarCSV() {
  let exportList = itemsFiltrados.value;
  if (itemsSeleccionados.value.size > 0) {
    exportList = itemsFiltrados.value.filter(i => itemsSeleccionados.value.has(i.id || i.cod_alt));
  }
  if (!exportList.length) return;

  const filas = [
    ['REPORTE DE REORDEN Y ORDEN DE COMPRA — SISTEMA ARJ (' + empresaNombre.value.toUpperCase() + ')'],
    ['Fecha de generacion: ' + new Date().toLocaleString('es-VE')],
    ['Criterio de alerta: Stock <= ' + umbral.value + ' unidades'],
    [],
    ['Codigo', 'Cod. OEM', 'Descripcion', 'Marca', 'Sistema', 'Origen', 'Stock Actual', 'Ventas Mes', 'Runway (Dias)', 'Pedido Sugerido (Uds)', 'Costo Unit USD', 'Costo Total USD', 'Estado']
  ];

  exportList.forEach(i => {
    filas.push([
      i.cod_alt,
      i.cod_orig || '',
      i.desc || '',
      i.marca || '',
      i.sistema || '',
      i.origen || 'importado',
      i.stock,
      i.ventasMes,
      i.runwayDias === 999 ? 'Sin ventas' : i.runwayDias,
      i.sugerencia,
      i.costoUnit.toFixed(2),
      i.costoTotal.toFixed(2),
      i.stock <= 0 ? 'AGOTADO' : (i.stock <= umbral.value / 2 ? 'MUY BAJO' : 'BAJO')
    ]);
  });

  const totUds = exportList.reduce((acc, i) => acc + i.sugerencia, 0);
  const totUSD = exportList.reduce((acc, i) => acc + i.costoTotal, 0);

  filas.push([]);
  filas.push(['TOTAL UNIDADES PEDIDO', '', '', '', '', '', '', '', '', totUds]);
  filas.push(['PRESUPUESTO ESTIMADO TOTAL USD', '', '', '', '', '', '', '', '', '', '', totUSD.toFixed(2)]);

  descargarCSV('ARJ_orden_compra_' + empresaSel.value + '_' + hoyArchivo() + '.csv', filas);
}
</script>

<style scoped>
.reorder-report-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 20px;
}

/* ── Header ── */
.reorder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-wrap-gold {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md);
  background: var(--lgold);
  color: var(--gold);
  border: 1px solid rgba(217, 119, 6, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}

.reorder-title {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--navy);
}

.reorder-sub {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: var(--dgray);
}

.header-right-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-count-badge {
  background: rgba(255, 255, 255, 0.25);
  padding: 1px 7px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 800;
  margin-left: 4px;
}

/* ── Mini KPIs ── */
.reorder-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.reorder-kpi-card {
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
}

.rkpi-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--dgray);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kpi-tag-sel {
  font-size: 9.5px;
  color: var(--blue);
  font-weight: 700;
  text-transform: none;
}

.rkpi-val {
  font-size: 22px;
  font-weight: 800;
  color: var(--text);
  margin: 4px 0 2px 0;
}

.font-red   { color: var(--red)   !important; }
.font-blue  { color: var(--blue)  !important; }
.font-green { color: var(--green) !important; }

.rkpi-sub {
  font-size: 10.5px;
  color: var(--text-muted);
}

/* ── Toolbar Avanzada ── */
.reorder-toolbar-adv {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.toolbar-left-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-right-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pills-filter {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.filter-pill {
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 4px 10px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--dgray);
  cursor: pointer;
  transition: var(--trans-fast);
}

.filter-pill:hover {
  border-color: var(--border-hover);
  color: var(--text);
}

.filter-pill.active {
  background: var(--lblue);
  color: var(--blue);
  border-color: var(--blue);
}

/* Selectores integrados */
.control-pill-select {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 4px 12px;
}

.control-pill-select.sm {
  padding: 3px 9px;
}

.dash-select {
  background: transparent;
  border: none;
  outline: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  appearance: auto;
}

.dash-select.sm {
  font-size: 11px;
}

/* Selector de Umbral */
.umbral-select-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 2px 8px 2px 10px;
}

.umbral-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--dgray);
}

.umbral-buttons {
  display: flex;
  gap: 2px;
}

.umbral-btn {
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  padding: 2px 6px;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--dgray);
  cursor: pointer;
  transition: var(--trans-fast);
}

.umbral-btn.active {
  background: var(--card-bg);
  color: var(--gold);
  box-shadow: var(--shadow-xs);
}

/* Buscador */
.search-input-wrap {
  position: relative;
  min-width: 220px;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--dgray);
  font-size: 13px;
}

.reorder-search {
  padding-left: 28px;
  width: 100%;
  font-size: 11.5px;
}

/* ── Barra de Selección Masiva (Bulk Actions) ── */
.selection-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--gray);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 14px;
  margin-bottom: 12px;
  font-size: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.select-all-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  user-select: none;
}

.custom-check {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--blue);
}

.selection-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sel-amt {
  font-weight: 600;
}

.btn-clear-sel {
  background: transparent;
  border: none;
  color: var(--red);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.btn-clear-sel:hover {
  background: var(--lred);
}

.selection-hint {
  color: var(--dgray);
  font-size: 11.5px;
}

/* ── Tabla ── */
.tbl-reorder tbody tr {
  transition: background var(--trans-fast);
}

.tbl-reorder tbody tr.row-selected {
  background: rgba(37, 99, 235, 0.08) !important;
}

.oem-sub {
  font-size: 10px;
  color: var(--dgray);
  font-family: sans-serif;
  margin-top: 1px;
}

.desc-line {
  font-weight: 600;
  color: var(--text);
}

.prod-meta-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  flex-wrap: wrap;
}

.meta-tag-sub {
  font-size: 10px;
  color: var(--dgray);
  background: var(--gray);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}

.badge-origen {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  font-weight: 700;
}
.origen-importado { background: var(--lblue); color: var(--blue); }
.origen-local     { background: var(--lgold); color: var(--gold); }

.stock-pill {
  padding: 3px 9px;
  border-radius: var(--radius-full);
  font-weight: 700;
  font-size: 11px;
}
.stock-cero { background: var(--lred); color: var(--red); }
.stock-bajo { background: var(--lgold); color: var(--gold); }

/* Runway / Cobertura Pill */
.runway-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 700;
}
.runway-cero    { background: var(--lred); color: var(--red); border: 1px solid rgba(239, 68, 68, 0.3); }
.runway-urgente { background: rgba(239, 68, 68, 0.15); color: #DC2626; border: 1px solid rgba(239, 68, 68, 0.4); }
.runway-alerta  { background: var(--lgold); color: var(--gold); border: 1px solid rgba(217, 119, 6, 0.3); }
.runway-ok      { background: var(--lgreen); color: var(--green); border: 1px solid rgba(16, 185, 129, 0.3); }
.runway-neutral { background: var(--gray); color: var(--dgray); }

.sug-pill {
  background: var(--lgreen);
  color: var(--green);
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-weight: 800;
  font-size: 12px;
}

.cost-total-val {
  font-weight: 700;
  font-size: 13px;
  color: var(--text);
}

.cost-unit-sub {
  font-size: 10px;
  color: var(--dgray);
  margin-top: 1px;
}

.badge-estado {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 700;
  text-transform: uppercase;
}
.badge-estado.agotado { background: var(--red); color: #FFF; }
.badge-estado.critico { background: var(--orange); color: #FFF; }
.badge-estado.bajo    { background: var(--gray); color: var(--dgray); border: 1px solid var(--border); }

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.table-more-note {
  font-size: 11.5px;
  color: var(--dgray);
  text-align: center;
  padding: 10px;
  border-top: 1px solid var(--border);
}
</style>
