<template>
  <div class="reorder-report-card">
    <div class="reorder-header">
      <div class="header-left">
        <div class="icon-wrap-gold">
          <i class="ti ti-package-import"></i>
        </div>
        <div>
          <h3 class="reorder-title">Asistente de Reorden e Inventario Crítico</h3>
          <p class="reorder-sub">Sugerencia inteligente de reposición para {{ empresaNombre }} basada en stock mínimo y rotación</p>
        </div>
      </div>
      <button class="btn btn-primary" :disabled="!itemsFiltrados.length" @click="exportarCSV">
        <i class="ti ti-download"></i> Descargar Orden de Compra (CSV)
      </button>
    </div>

    <!-- Mini KPIs resumen de compras -->
    <div class="reorder-kpis">
      <div class="reorder-kpi-card">
        <span class="rkpi-label">Ítems a Reordenar</span>
        <div class="rkpi-val">{{ itemsReorden.length }}</div>
        <span class="rkpi-sub">≤ {{ umbral }} unidades en almacén</span>
      </div>
      <div class="reorder-kpi-card">
        <span class="rkpi-label">Agotados (Urgentes)</span>
        <div class="rkpi-val font-red">{{ totalAgotados }}</div>
        <span class="rkpi-sub">En cero — ventas detenidas</span>
      </div>
      <div class="reorder-kpi-card">
        <span class="rkpi-label">Unidades Sugeridas</span>
        <div class="rkpi-val font-blue">{{ totalUnidadesSugeridas.toLocaleString('es-VE') }}</div>
        <span class="rkpi-sub">Para cubrir stock de seguridad</span>
      </div>
      <div class="reorder-kpi-card">
        <span class="rkpi-label">Presupuesto Estimado</span>
        <div class="rkpi-val font-green">{{ fmtUSD(presupuestoEstimado) }}</div>
        <span class="rkpi-sub">Costo de reposición estimado</span>
      </div>
    </div>

    <!-- Barra de herramientas: Filtro y Búsqueda -->
    <div class="reorder-toolbar">
      <div class="pills-filter">
        <button
          :class="['filter-pill', { active: filtro === 'todos' }]"
          @click="filtro = 'todos'"
        >
          Todos los críticos ({{ itemsReorden.length }})
        </button>
        <button
          :class="['filter-pill', { active: filtro === 'agotados' }]"
          @click="filtro = 'agotados'"
        >
          Solo Agotados ({{ totalAgotados }})
        </button>
        <button
          :class="['filter-pill', { active: filtro === 'bajos' }]"
          @click="filtro = 'bajos'"
        >
          Bajo Stock ({{ itemsReorden.length - totalAgotados }})
        </button>
      </div>

      <div class="search-input-wrap">
        <i class="ti ti-search search-icon"></i>
        <input
          v-model="busqueda"
          type="text"
          class="val-input reorder-search"
          placeholder="Buscar por código, OEM o descripción..."
        >
      </div>
    </div>

    <!-- Tabla de sugerencias -->
    <div v-if="!itemsFiltrados.length" class="empty-state">
      <i class="ti ti-circle-check" style="font-size:32px;color:var(--green);margin-bottom:8px"></i>
      <div style="font-weight:600;font-size:14px;color:var(--text)">
        {{ itemsReorden.length === 0 ? '¡Excelente! No hay productos con stock crítico en esta empresa' : 'No hay productos que coincidan con la búsqueda' }}
      </div>
      <div style="color:var(--dgray);font-size:12px;margin-top:2px">
        Todos los productos superan el umbral mínimo de {{ umbral }} unidades
      </div>
    </div>

    <div v-else class="table-responsive">
      <table class="tbl">
        <thead>
          <tr>
            <th style="text-align:left">Código</th>
            <th style="text-align:left">Descripción</th>
            <th style="text-align:left">Marca / Origen</th>
            <th style="text-align:center">Stock Actual</th>
            <th style="text-align:center">Vendido Mes</th>
            <th style="text-align:center">Sugerencia Pedido</th>
            <th style="text-align:right">Costo Estimado</th>
            <th style="text-align:center">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in itemsFiltrados.slice(0, 80)" :key="item.id || item.cod_alt">
            <td style="font-weight:700;font-family:monospace;color:var(--blue)">
              {{ item.cod_alt }}
              <div v-if="item.cod_orig" style="font-size:10px;color:var(--dgray);font-family:sans-serif">OEM: {{ item.cod_orig }}</div>
            </td>
            <td>
              <div style="font-weight:600;color:var(--text)">{{ item.desc }}</div>
              <div v-if="item.marca_modelo" style="font-size:11px;color:var(--dgray)">{{ item.marca_modelo }}</div>
            </td>
            <td>
              <span class="badge-origen" :class="item.origen === 'local' ? 'origen-local' : 'origen-importado'">
                {{ item.marca || (item.origen === 'local' ? 'Nacional' : 'Importado') }}
              </span>
            </td>
            <td style="text-align:center">
              <span class="stock-pill" :class="item.stock <= 0 ? 'stock-cero' : 'stock-bajo'">
                {{ item.stock }} ud{{ item.stock !== 1 ? 's' : '' }}
              </span>
            </td>
            <td style="text-align:center;font-weight:600;color:var(--text)">
              {{ item.ventasMes > 0 ? item.ventasMes + ' uds' : '—' }}
            </td>
            <td style="text-align:center">
              <span class="sug-pill">
                +{{ item.sugerencia }} uds
              </span>
            </td>
            <td style="text-align:right;font-weight:700;color:var(--navy)">
              {{ fmtUSD(item.costoTotal) }}
              <div style="font-size:10px;color:var(--dgray);font-weight:normal">@ {{ fmtUSD(item.costoUnit) }}/ud</div>
            </td>
            <td style="text-align:center">
              <span v-if="item.stock <= 0" class="badge-estado agotado">Agotado</span>
              <span v-else-if="item.stock <= umbral / 2" class="badge-estado critico">Muy bajo</span>
              <span v-else class="badge-estado bajo">Bajo</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="itemsFiltrados.length > 80" class="table-more-note">
        Mostrando los 80 productos de mayor urgencia. La descarga en CSV contiene los {{ itemsFiltrados.length }} productos completos.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
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

const filtro = ref('todos');
const busqueda = ref('');

const empresaNombre = computed(() => (props.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora'));
const umbral = computed(() => (props.empresa === 'directa' ? 10 : 20));
const campoStock = computed(() => (props.empresa === 'directa' ? 'stock_vd' : 'stock_dist'));

// Mapa de unidades vendidas por producto_id o código en el período
const ventasPorProd = computed(() => {
  const map = {};
  if (!props.ventasItems || !props.ventasItems.length) return map;
  props.ventasItems.forEach(it => {
    const k = it.producto_id || it.cod_alt || it.codigo || it.cod;
    if (k) map[k] = (map[k] || 0) + (parseFloat(it.cantidad) || parseFloat(it.cant) || 0);
  });
  return map;
});

// Lista completa de ítems que necesitan reorden
const itemsReorden = computed(() => {
  const u = umbral.value;
  const campo = campoStock.value;
  const vMap = ventasPorProd.value;
  const prods = props.productos || [];

  return prods
    .filter(p => (p[campo] || 0) <= u)
    .map(p => {
      const stock = Math.max(0, p[campo] || 0);
      const k = p.id || p.cod_alt;
      const ventasMes = vMap[k] || vMap[p.cod_alt] || 0;
      
      // Cálculo de reposición: reponer al menos hasta el doble del umbral
      // o el doble de lo vendido en el mes si rota rápido
      const objetivo = Math.max(u * 2, Math.round(ventasMes * 2) || (u * 2));
      const sugerencia = Math.max(1, objetivo - stock);
      
      const cu = costoLanded(p, prods) || p.fob || 0;
      const costoTotal = sugerencia * cu;

      return {
        ...p,
        stock,
        ventasMes,
        sugerencia,
        costoUnit: cu,
        costoTotal
      };
    })
    .sort((a, b) => {
      // Primero los que tienen stock 0
      if (a.stock === 0 && b.stock > 0) return -1;
      if (b.stock === 0 && a.stock > 0) return 1;
      // Luego por mayor rotación o costo
      return (b.ventasMes - a.ventasMes) || (b.costoTotal - a.costoTotal);
    });
});

const totalAgotados = computed(() => itemsReorden.value.filter(i => i.stock <= 0).length);
const totalUnidadesSugeridas = computed(() => itemsReorden.value.reduce((acc, i) => acc + i.sugerencia, 0));
const presupuestoEstimado = computed(() => itemsReorden.value.reduce((acc, i) => acc + i.costoTotal, 0));

// Lista filtrada por pestaña y texto
const itemsFiltrados = computed(() => {
  let list = itemsReorden.value;

  if (filtro.value === 'agotados') {
    list = list.filter(i => i.stock <= 0);
  } else if (filtro.value === 'bajos') {
    list = list.filter(i => i.stock > 0);
  }

  const q = busqueda.value.trim().toLowerCase();
  if (q) {
    list = list.filter(i =>
      (i.cod_alt && i.cod_alt.toLowerCase().includes(q)) ||
      (i.cod_orig && i.cod_orig.toLowerCase().includes(q)) ||
      (i.desc && i.desc.toLowerCase().includes(q)) ||
      (i.marca && i.marca.toLowerCase().includes(q))
    );
  }

  return list;
});

function exportarCSV() {
  if (!itemsFiltrados.value.length) return;
  const filas = [
    ['REPORTE DE REORDEN Y COMPRAS — SISTEMA ARJ (' + empresaNombre.value + ')'],
    ['Fecha de generación: ' + new Date().toLocaleString('es-VE')],
    [],
    ['Codigo', 'Cod. OEM', 'Descripcion', 'Marca', 'Origen', 'Stock Actual', 'Ventas Mes', 'Pedido Sugerido (Uds)', 'Costo Unit USD', 'Costo Total USD', 'Estado']
  ];

  itemsFiltrados.value.forEach(i => {
    filas.push([
      i.cod_alt,
      i.cod_orig || '',
      i.desc || '',
      i.marca || '',
      i.origen || 'importado',
      i.stock,
      i.ventasMes,
      i.sugerencia,
      i.costoUnit.toFixed(2),
      i.costoTotal.toFixed(2),
      i.stock <= 0 ? 'AGOTADO' : 'BAJO'
    ]);
  });

  filas.push([]);
  filas.push(['TOTAL UNIDADES PEDIDO', '', '', '', '', '', '', totalUnidadesSugeridas.value]);
  filas.push(['PRESUPUESTO ESTIMADO TOTAL USD', '', '', '', '', '', '', '', '', presupuestoEstimado.value.toFixed(2)]);

  descargarCSV('ARJ_orden_reorden_' + props.empresa + '_' + hoyArchivo() + '.csv', filas);
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

/* Mini KPIs */
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
}

.rkpi-val {
  font-size: 22px;
  font-weight: 800;
  color: var(--text);
  margin: 4px 0 2px 0;
}

.font-red { color: var(--red) !important; }
.font-blue { color: var(--blue) !important; }
.font-green { color: var(--green) !important; }

.rkpi-sub {
  font-size: 10.5px;
  color: var(--text-muted);
}

/* Toolbar */
.reorder-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.pills-filter {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-pill {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--dgray);
  cursor: pointer;
  transition: all var(--trans-fast);
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

.search-input-wrap {
  position: relative;
  min-width: 260px;
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
  padding-left: 30px;
  width: 100%;
  font-size: 12px;
}

/* Badges y pills en tabla */
.badge-origen {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-weight: 600;
}
.origen-importado { background: var(--lblue); color: var(--blue); }
.origen-local { background: var(--lgold); color: var(--gold); }

.stock-pill {
  padding: 3px 9px;
  border-radius: var(--radius-full);
  font-weight: 700;
  font-size: 11px;
}
.stock-cero { background: var(--lred); color: var(--red); }
.stock-bajo { background: var(--lgold); color: var(--gold); }

.sug-pill {
  background: var(--lgreen);
  color: var(--green);
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-weight: 800;
  font-size: 12px;
}

.badge-estado {
  font-size: 10.5px;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 700;
  text-transform: uppercase;
}
.badge-estado.agotado { background: var(--red); color: #FFF; }
.badge-estado.critico { background: var(--orange); color: #FFF; }
.badge-estado.bajo { background: var(--gray); color: var(--dgray); border: 1px solid var(--border); }

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
