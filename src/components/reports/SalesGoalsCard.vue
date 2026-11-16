<template>
  <div style="margin-bottom:20px">
    <h2 style="font-size:15px;color:var(--navy);font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:8px">
      <i class="ti ti-target"></i> Metas de venta del mes
    </h2>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:11.5px;color:var(--dgray)">Período:</span>
        <select
          :value="metasPer"
          class="val-input"
          style="width:150px"
          @change="$emit('update:metasPer', $event.target.value)"
        >
          <option v-for="x in opcionesPeriodo" :key="x" :value="x">{{ etiquetaPeriodo(x) }}</option>
        </select>
        <span v-if="esMesCerrado" style="background:#FFF8E1;color:#5D4037;padding:2px 8px;border-radius:8px;font-size:10.5px;font-weight:600">
          MES CERRADO
        </span>
      </div>
      <button class="btn btn-secondary btn-sm" @click="$emit('abrir-equipo')">
        <i class="ti ti-users-plus"></i> Gestionar equipo
      </button>
    </div>

    <div v-if="esMesCerrado" style="background:#FFF8E1;border-left:3px solid var(--gold);border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:11.5px;color:#5D4037">
      <i class="ti ti-info-circle"></i> Estás viendo un mes distinto al actual. Las barras de "vendido" siempre muestran el <strong>mes en curso</strong>; solo la meta cambia de período.
    </div>

    <!-- Tarjeta Meta Empresa -->
    <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:500">Meta empresa</div>
          <div style="font-size:14px;font-weight:600;color:var(--navy)">{{ nombreEmp }}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11.5px;color:var(--dgray)">Meta:</span>
          <input
            type="number"
            class="val-input"
            :value="metaEmpresa"
            step="500"
            min="0"
            style="width:110px"
            @change="$emit('actualizar-meta-empresa', $event.target.value)"
          >
        </div>
      </div>
      <div style="background:var(--gray);border-radius:5px;height:24px;position:relative;overflow:hidden">
        <div
          :style="{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg,var(--green),#4CAF50)',
            width: pctEmp + '%',
            transition: 'width 0.4s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '8px',
            color: '#FFF',
            fontSize: '11px',
            fontWeight: 600
          }"
        >
          {{ pctEmp > 8 ? pctEmp.toFixed(1) + '%' : '' }}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11.5px">
        <span style="color:var(--green);font-weight:600">Vendido: {{ fmtUSD(ventasEmpresa) }}</span>
        <span style="color:var(--dgray)">Falta: <strong :style="{ color: faltaEmp > 0 ? 'var(--gold)' : 'var(--green)' }">{{ fmtUSD(faltaEmp) }}</strong></span>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);font-size:11px;color:var(--dgray)">
        <template v-if="baseSug > 0">
          <i class="ti ti-bulb"></i> Sugerencias sobre el mes anterior ({{ fmtUSD(baseSug) }}):
          <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;margin:2px" @click="$emit('sugerir-meta', 'conservadora')">
            Conservadora: {{ fmtUSD(Math.round(baseSug * 0.9 / 100) * 100) }}
          </button>
          <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;margin:2px" @click="$emit('sugerir-meta', 'moderada')">
            Moderada: {{ fmtUSD(Math.round(baseSug * 1.1 / 100) * 100) }}
          </button>
          <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px;margin:2px" @click="$emit('sugerir-meta', 'agresiva')">
            Agresiva: {{ fmtUSD(Math.round(baseSug * 1.3 / 100) * 100) }}
          </button>
        </template>
        <template v-else>
          <i class="ti ti-bulb"></i> Las sugerencias aparecen cuando haya ventas del mes anterior con qué compararse.
        </template>
      </div>
    </div>

    <!-- Tarjeta Metas por Trabajador -->
    <div style="background:#FFF;border:1px solid var(--border);border-radius:10px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em;font-weight:500">Metas por trabajador</div>
        <button class="btn btn-secondary btn-sm" style="font-size:10.5px" @click="$emit('abrir-equipo')">
          <i class="ti ti-plus"></i> Agregar
        </button>
      </div>
      <div v-if="!listaTrab.length" style="padding:18px;text-align:center;color:var(--dgray);font-size:12px">
        Todavía no hay trabajadores en <strong>{{ nombreEmp }}</strong>.<br>
        <button class="btn btn-primary btn-sm" style="margin-top:8px" @click="$emit('abrir-equipo')">
          <i class="ti ti-user-plus"></i> Agregar el primero
        </button>
      </div>
      <div v-for="t in filasTrab" :key="t.v" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px">
          <div style="display:flex;align-items:center;gap:6px;min-width:0">
            <i class="ti ti-user" style="color:var(--blue);flex-shrink:0"></i>
            <span style="font-weight:600;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ t.v }}</span>
            <span v-if="t.cumplido" style="background:var(--lgreen);color:var(--green);padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;flex-shrink:0">✓ CUMPLIDA</span>
            <span v-if="!t.enEquipo" style="background:#FFF8E1;color:#5D4037;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;flex-shrink:0" title="Facturó pero no está en la lista de equipo">FUERA DEL EQUIPO</span>
          </div>
          <input
            type="number"
            :value="t.meta"
            step="500"
            min="0"
            class="val-input"
            style="width:90px;flex-shrink:0"
            @change="$emit('actualizar-meta-vendedor', t.v, $event.target.value)"
          >
        </div>
        <div style="background:var(--gray);border-radius:4px;height:14px;overflow:hidden">
          <div
            :style="{
              background: t.cumplido ? 'linear-gradient(90deg,var(--green),#4CAF50)' : 'linear-gradient(90deg,var(--blue),var(--navy))',
              height: '100%',
              width: t.pct + '%',
              transition: 'width 0.4s'
            }"
          ></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:11px;color:var(--dgray)">
          <span>{{ fmtUSD(t.vendido) }}{{ t.meta > 0 ? ' (' + t.pct.toFixed(0) + '%)' : '' }}</span>
          <span>{{ t.meta > 0 ? 'Falta ' + fmtUSD(t.falta) : 'Sin meta asignada' }}</span>
        </div>
      </div>

      <!-- Aviso de suma si difiere -->
      <div
        v-if="avisoSuma"
        :style="{
          marginTop: '10px',
          fontSize: '11.5px',
          color: avisoSuma.corta ? '#5D4037' : 'var(--dgray)',
          background: avisoSuma.corta ? '#FFF8E1' : 'transparent',
          borderTop: '1px dashed var(--border)',
          borderRadius: '6px',
          padding: '8px 10px'
        }"
      >
        <i :class="'ti ti-' + (avisoSuma.corta ? 'alert-triangle' : 'info-circle')"></i>
        La suma de las metas individuales es <strong>{{ fmtUSD(avisoSuma.suma) }}</strong> contra {{ fmtUSD(metaEmpresa) }} de la empresa.
        <template v-if="avisoSuma.corta">Aunque <strong>todos cumplan</strong>, la empresa se queda {{ fmtUSD(Math.abs(avisoSuma.dif)) }} corta.</template>
        <template v-else>Hay {{ fmtUSD(avisoSuma.dif) }} de colchón.</template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { fmtUSD } from '../../services/pricing.js';
import { etiquetaPeriodo } from '../../services/reportes.js';

defineProps({
  nombreEmp: {
    type: String,
    default: 'Venta Directa'
  },
  metasPer: {
    type: String,
    default: ''
  },
  opcionesPeriodo: {
    type: Array,
    default: () => []
  },
  esMesCerrado: {
    type: Boolean,
    default: false
  },
  metaEmpresa: {
    type: Number,
    default: 0
  },
  pctEmp: {
    type: Number,
    default: 0
  },
  ventasEmpresa: {
    type: Number,
    default: 0
  },
  faltaEmp: {
    type: Number,
    default: 0
  },
  baseSug: {
    type: Number,
    default: 0
  },
  listaTrab: {
    type: Array,
    default: () => []
  },
  filasTrab: {
    type: Array,
    default: () => []
  },
  avisoSuma: {
    type: Object,
    default: null
  }
});

defineEmits([
  'update:metasPer',
  'abrir-equipo',
  'actualizar-meta-empresa',
  'actualizar-meta-vendedor',
  'sugerir-meta'
]);
</script>
