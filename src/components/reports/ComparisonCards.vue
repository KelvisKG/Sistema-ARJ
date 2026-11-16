<template>
  <div class="comparison-cards-container">
    <!-- ═══ 1. IMPORTADO vs LOCAL ═══ -->
    <div class="chart-card" style="margin-bottom:16px">
      <div class="comparison-header">
        <h3 style="margin:0">
          <i class="ti ti-world" style="color:var(--blue)"></i> Importado vs Local
          <span style="font-weight:500;color:var(--dgray)">— {{ (origen.lbl || '').charAt(0).toUpperCase() + (origen.lbl || '').slice(1) }}</span>
        </h3>
      </div>

      <div v-if="origen.estado === 'cargando'" class="empty-state">
        <i class="ti ti-loader ti-spin"></i> Leyendo {{ origen.etiqueta }}…
      </div>
      <div v-else-if="origen.estado === 'error'" class="error-state">
        {{ origen.error }}
      </div>
      <div v-else-if="origen.estado === 'sinconexion'" class="empty-state">
        Sin conexión a la base de datos.
      </div>
      <div v-else-if="!origen.data || !origen.data.its || !origen.data.its.length" class="empty-state">
        Sin ventas en {{ origen.etiqueta }}.
      </div>
      <template v-else-if="R">
        <!-- Bloques comparativos de origen -->
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          <div
            v-for="b in bloquesOrigen"
            :key="b.key"
            :style="{ flex: '1 1 210px', background: b.col, borderRadius: '8px', padding: '10px 12px' }"
          >
            <div style="font-size:11px;color:var(--dgray);text-transform:uppercase;letter-spacing:.4px;font-weight:600">
              <i :class="'ti ti-' + b.icono"></i> {{ b.nom }}
            </div>
            <div style="font-size:20px;font-weight:800;color:var(--navy);line-height:1.25">
              {{ fmtUSD(b.c.venta) }}
            </div>
            <div style="font-size:11.5px;color:var(--dgray);margin-bottom:6px">
              {{ calcPc(b.c.venta, R.tot.venta) }} de la venta &middot; {{ (b.c.uds || 0).toLocaleString('es-VE') }} uds &middot; {{ b.c.lineas }} renglones
            </div>
            <div style="height:5px;background:#FFF;border-radius:3px;overflow:hidden;margin-bottom:6px">
              <div
                :style="{
                  height: '100%',
                  width: (R.tot.venta > 0 ? (b.c.venta / R.tot.venta) * 100 : 0).toFixed(1) + '%',
                  background: 'var(--gold)'
                }"
              ></div>
            </div>
            <div style="font-size:12px;line-height:1.6">
              Costo <strong>{{ fmtUSD(b.c.costo) }}</strong><br>
              Utilidad <strong :style="{ color: b.c.util >= 0 ? '#1E7B34' : '#B00020' }">{{ fmtUSD(b.c.util) }}</strong> &middot; margen <strong>{{ (b.c.mg || 0).toFixed(1) }}%</strong><br>
              <span style="color:var(--dgray)">Aporta {{ calcPc(b.c.util, R.tot.util) }} de la utilidad</span>

              <!-- Desglose de caja -->
              <div v-if="b.v && (b.v.enMano > 0 || b.v.porCobrar > 0)" style="margin-top:8px;padding-top:7px;border-top:1px solid rgba(0,0,0,.08)">
                <div style="color:#1E7B34;font-weight:700;font-size:13px">✓ Ya en caja: {{ fmtUSD(b.v.enMano) }}</div>
                <div v-if="b.v.efectivo > 0 || b.v.usdt > 0" style="font-size:11px;color:var(--dgray);margin-top:1px">
                  {{ [b.v.efectivo > 0 ? fmtUSD(b.v.efectivo) + ' efectivo' : '', b.v.usdt > 0 ? fmtUSD(b.v.usdt) + ' a convertir en USDT' : ''].filter(Boolean).join(' · ') }}
                </div>
                <template v-if="b.v.porCobrar > 0">
                  <div style="color:#BF8F00;font-weight:600;font-size:12.5px;margin-top:5px">⏳ Por cobrar: {{ fmtUSD(b.v.porCobrar) }}</div>
                  <div style="font-size:11px;color:var(--dgray);margin-top:1px">Aún no es plata. Sujeto a que la brecha se mueva.</div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Síntesis comparativa -->
        <div v-if="R.g.local.venta > 0 && R.g.importado.venta > 0" style="margin-top:9px;font-size:12px;color:var(--dgray);line-height:1.5">
          El margen de <strong>{{ R.g.importado.mg - R.g.local.mg >= 0 ? 'importado' : 'local' }}</strong> es
          {{ Math.abs(R.g.importado.mg - R.g.local.mg).toFixed(1) }} puntos mayor. Utilidad total del período: <strong>{{ fmtUSD(R.tot.util) }}</strong>.
        </div>

        <div v-if="R.deducidos > 0 || R.sinCosto > 0" class="alert-box">
          <div v-if="R.deducidos > 0">⚠ <strong>{{ R.deducidos }} renglón(es) sin origen guardado</strong> — clasificados por el factor congelado, es una deducción</div>
          <div v-if="R.sinCosto > 0">⚠ <strong>{{ R.sinCosto }} renglón(es) sin costo</strong> — su margen sale inflado</div>
        </div>

        <div v-if="R.VR && R.VR.nPend > 0" class="pending-box">
          <strong>{{ R.VR.nPend }} factura(s) sin cobrar del todo.</strong> Lo de "por cobrar" no está en tu caja:
          mientras esos bolívares no entren, la brecha sigue corriendo y el objetivo en USDT baja cada día.
        </div>

        <div v-if="R.VR && R.VR.sinTasa > 0" style="margin-top:8px;font-size:11px;color:var(--dgray)">
          {{ R.VR.sinTasa }} factura(s) sin tasas congeladas: no entran en el cálculo de caja.
        </div>

        <!-- Acciones del bloque de origen -->
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" style="background:var(--navy);color:#FFF" @click="$emit('toggle-detalle')">
            <i class="ti ti-list-search"></i> {{ detalleAbierto ? 'Ocultar detalle' : 'Ver qué productos son' }}
          </button>
          <button class="btn btn-sm btn-secondary" @click="$emit('descargar-csv')">
            <i class="ti ti-download"></i> Descargar detalle CSV
          </button>
        </div>
      </template>

      <!-- Tabla desplegable de productos por origen -->
      <div v-if="detalleAbierto" style="margin-top:12px">
        <div v-if="!origen.data || !origen.data.its.length" class="empty-state">
          Escoge un período con ventas y vuelve a abrir el detalle.
        </div>
        <template v-else>
          <div v-for="t in tablasDetalle" :key="t.key" style="margin-bottom:14px">
            <div :style="{ fontSize: '12px', fontWeight: 700, color: 'var(--navy)', background: t.col, padding: '6px 9px', borderRadius: '6px 6px 0 0' }">
              <i :class="'ti ti-' + t.icono"></i> {{ t.titulo }} — {{ t.lista.length }} producto(s) · {{ fmtUSD(t.tV) }} $BCV · ≈ {{ fmtUSD(t.tW) }} verde
            </div>
            <div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:11.5px">
                <thead>
                  <tr style="background:#F7F7F7;color:var(--dgray)">
                    <th style="text-align:left;padding:5px 7px">Código</th>
                    <th style="text-align:left;padding:5px 7px">Descripción</th>
                    <th style="text-align:right;padding:5px 7px">Uds</th>
                    <th style="text-align:right;padding:5px 7px">Venta $BCV</th>
                    <th style="text-align:right;padding:5px 7px">$verde facturado</th>
                    <th style="text-align:right;padding:5px 7px">Costo</th>
                    <th style="text-align:right;padding:5px 7px">Utilidad</th>
                    <th style="text-align:right;padding:5px 7px">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in t.lista.slice(0, 60)" :key="p.cod + p.desc" style="border-bottom:1px solid var(--border)">
                    <td style="padding:4px 7px;font-family:monospace">{{ p.cod }}</td>
                    <td style="padding:4px 7px">{{ p.desc }}</td>
                    <td style="padding:4px 7px;text-align:right">{{ (p.uds || 0).toLocaleString('es-VE') }}</td>
                    <td style="padding:4px 7px;text-align:right;font-weight:600">{{ fmtUSD(p.venta) }}</td>
                    <td style="padding:4px 7px;text-align:right;color:#1E7B34">{{ p.sinTasa ? '—' : fmtUSD(p.verde) }}</td>
                    <td style="padding:4px 7px;text-align:right;color:var(--dgray)">{{ fmtUSD(p.costo) }}</td>
                    <td :style="{ padding: '4px 7px', textAlign: 'right', color: p.venta - p.costo >= 0 ? '#1E7B34' : '#B00020' }">{{ fmtUSD(p.venta - p.costo) }}</td>
                    <td style="padding:4px 7px;text-align:right">{{ (p.venta > 0 ? ((p.venta - p.costo) / p.venta) * 100 : 0).toFixed(1) }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="t.lista.length > 60" style="font-size:11px;color:var(--dgray);padding:5px 7px">
              Mostrando los 60 de mayor venta. El CSV los trae todos.
            </div>
          </div>
          <div style="font-size:11px;color:var(--dgray);line-height:1.5;padding:6px 2px">
            La columna <strong>$verde facturado</strong> es el equivalente de lo <em>facturado</em> con la brecha congelada
            de cada factura, esté cobrado o no, y sin descontar. No es caja. La caja real, ya separada entre cobrado y
            pendiente, está en el recuadro de arriba.
          </div>
        </template>
      </div>
    </div>

    <!-- ═══ 2. COMPARATIVA MES vs MES ═══ -->
    <div class="chart-card" style="margin-bottom:16px">
      <h3><i class="ti ti-chart-line" style="color:var(--blue)"></i> Comparativa de ventas — Mes actual vs Mes anterior</h3>
      <div style="padding:4px 2px">
        <div v-for="b in compMeses.barras" :key="b.etiqueta" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px">
            <span style="color:var(--dgray);text-transform:capitalize">{{ b.etiqueta }}</span>
            <span style="font-weight:600;color:var(--navy)">{{ fmtUSD(b.val) }} · {{ b.n }} {{ b.n === 1 ? 'factura' : 'facturas' }}</span>
          </div>
          <div style="background:var(--gray);border-radius:5px;height:20px;overflow:hidden">
            <div :style="{ background: b.color, height: '100%', width: (compMeses.tope > 0 ? (b.val / compMeses.tope) * 100 : 0) + '%', transition: 'width .4s' }"></div>
          </div>
        </div>

        <div v-if="compMeses.ant === 0 && compMeses.act === 0" style="font-size:11.5px;color:var(--dgray)">
          Sin ventas en ninguno de los dos meses.
        </div>
        <div v-else-if="compMeses.ant === 0" style="font-size:11.5px;color:var(--dgray)">
          No hay mes anterior con ventas: todavía no se puede comparar.
        </div>
        <div v-else style="font-size:12px;padding-top:8px;border-top:1px dashed var(--border)">
          <span :style="{ color: compMeses.varPct >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }">
            {{ compMeses.varPct >= 0 ? '▲' : '▼' }} {{ Math.abs(compMeses.varPct).toFixed(1) }}%
          </span>
          <span style="color:var(--dgray)"> respecto al mes anterior · diferencia {{ fmtUSD(Math.abs(compMeses.act - compMeses.ant)) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { fmtUSD } from '../../services/pricing.js';

defineProps({
  origen: {
    type: Object,
    default: () => ({ estado: 'listo', lbl: 'este mes', etiqueta: 'este mes', data: null, error: '' })
  },
  R: {
    type: Object,
    default: null
  },
  bloquesOrigen: {
    type: Array,
    default: () => []
  },
  tablasDetalle: {
    type: Array,
    default: () => []
  },
  detalleAbierto: {
    type: Boolean,
    default: false
  },
  compMeses: {
    type: Object,
    default: () => ({
      act: 0,
      ant: 0,
      tope: 1,
      varPct: 0,
      barras: []
    })
  }
});

defineEmits(['toggle-detalle', 'descargar-csv']);

function calcPc(x, b) {
  return b > 0 ? ((x / b) * 100).toFixed(1) + '%' : '—';
}
</script>

<style scoped>
.comparison-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.empty-state {
  padding: 14px;
  text-align: center;
  color: var(--dgray, #64748B);
  font-size: 12.5px;
}

.error-state {
  padding: 14px;
  text-align: center;
  color: var(--red, #B00020);
  font-size: 12.5px;
}

.alert-box {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #FFF4E5;
  border-left: 3px solid #BF8F00;
  font-size: 11.5px;
  line-height: 1.5;
}

.pending-box {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #FFF9E6;
  border-left: 3px solid #BF8F00;
  font-size: 11.5px;
  line-height: 1.5;
}
</style>
