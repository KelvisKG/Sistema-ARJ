<template>
  <div class="page active" id="page-config">
    <h1 class="page-title"><i class="ti ti-settings"></i> Configuración</h1>
    <p class="page-sub">Todo lo que se guarda aquí queda en la base de datos y lo ven todas las terminales.</p>

    <div class="config-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px">
      <!-- TASAS -->
      <div class="config-card card">
        <h3><i class="ti ti-currency-dollar" style="color:var(--blue)"></i> Tasas de cambio</h3>
        <div class="field-col" style="margin-bottom:10px">
          <label>Tasa paralelo (Bs por $)</label>
          <input v-model="tasaPar" type="text" inputmode="decimal" class="val-input" style="font-weight:700">
        </div>
        <div class="field-col" style="margin-bottom:10px">
          <label>Tasa BCV oficial (Bs por $)</label>
          <input v-model="tasaBcv" type="text" inputmode="decimal" class="val-input" style="font-weight:700">
        </div>
        <div style="font-size:12px;color:var(--dgray);margin-bottom:10px">
          Brecha: <strong>{{ brechaPct }}%</strong> · Descuento neutro en efectivo: <strong>{{ store.dtoDivisaNeutro.toFixed(2) }}%</strong><br>
          <span :style="{ color: store.tasasConfirmadasHoy ? 'var(--green)' : 'var(--red)' }">
            {{ store.tasasConfirmadasHoy ? '✓ Confirmadas hoy' : '✗ Sin confirmar hoy' }}
          </span>
          <span v-if="store.tasas_actualizadas"> · última: {{ new Date(store.tasas_actualizadas).toLocaleString('es-VE') }}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" :disabled="store.procesando" @click="confirmarTasasHoy">
            <i class="ti ti-check"></i> Guardar y confirmar tasas de hoy
          </button>
          <button class="btn btn-secondary btn-sm" @click="consultarBCV">
            <i class="ti ti-world-download"></i> Consultar BCV en línea
          </button>
        </div>
        <div style="font-size:11px;color:var(--dgray);margin-top:8px">
          Confirmar sin cambiar el valor también cuenta: queda registrado que hoy se revisaron.
        </div>
      </div>

      <!-- PARÁMETROS -->
      <div class="config-card card">
        <h3><i class="ti ti-adjustments" style="color:var(--blue)"></i> Parámetros ARJ</h3>
        <div class="field-col" style="margin-bottom:10px">
          <label>Factor landed por defecto (productos nuevos importados)</label>
          <div style="display:flex;gap:8px">
            <input v-model.number="factorDefault" type="number" step="0.001" min="1" class="val-input" style="flex:1">
            <button class="btn btn-secondary btn-sm" @click="guardarFactor">Guardar</button>
          </div>
        </div>
        <div class="field-col" style="margin-bottom:6px">
          <label>Costos fijos del mes (USD)</label>
          <div style="display:flex;gap:8px">
            <input v-model="mesCostos" type="month" class="val-input" style="width:150px" @change="cargarMes">
            <input v-model.number="montoCostos" type="number" step="10" min="0" class="val-input" style="flex:1">
            <button class="btn btn-secondary btn-sm" @click="guardarCostosFijos">Guardar</button>
          </div>
        </div>
        <div style="font-size:11.5px;color:var(--dgray)">
          <span v-if="!Object.keys(historialCostos).length">Sin meses registrados. </span>
          <span v-for="(v, k) in historialCostos" :key="k" style="display:inline-block;margin-right:10px">{{ k }}: <strong>{{ fmtUSD(v) }}</strong></span>
          <div>Un mes sin valor hereda el último registrado.</div>
        </div>
      </div>

      <!-- NIVELES DE PRECIO -->
      <div class="config-card card">
        <h3><i class="ti ti-list" style="color:var(--blue)"></i> Niveles de precio</h3>
        <table class="tbl" style="font-size:12.5px">
          <tbody>
            <tr><td><strong>Público</strong></td><td>Sin descuento — todos los clientes nuevos</td></tr>
            <tr><td><strong>Aliado T1</strong></td><td>–5% — compras de $2.500 a $4.999</td></tr>
            <tr><td><strong>Aliado T2</strong></td><td>–10% — compras de $5.000 a $14.999</td></tr>
            <tr><td><strong>Aliado T3</strong></td><td>–20% — compras desde $15.000</td></tr>
          </tbody>
        </table>
        <div style="font-size:11px;color:var(--dgray);margin-top:6px">El nivel se asigna en la ficha del cliente (solo gerente) y aplica en Distribuidora.</div>
      </div>

      <!-- USUARIOS -->
      <div class="config-card card">
        <h3><i class="ti ti-users" style="color:var(--blue)"></i> Usuarios del sistema</h3>
        <table class="tbl" style="font-size:12.5px">
          <thead><tr><th>Nombre</th><th>Rol</th><th>Empresa</th><th>Estado</th></tr></thead>
          <tbody>
            <tr v-if="cargandoUsuarios"><td colspan="4" style="text-align:center;color:var(--dgray)">Cargando...</td></tr>
            <tr v-for="u in usuarios" :key="u.id">
              <td>{{ u.nombre_display }}</td>
              <td>{{ u.rol }}</td>
              <td>{{ u.empresa === 'dist' ? 'Distribuidora' : (u.empresa === 'directa' ? 'Venta Directa' : 'Ambas') }}</td>
              <td><span :class="['badge', u.activo ? 'badge-success' : 'badge-secondary']">{{ u.activo ? 'Activo' : 'Inactivo' }}</span></td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:11px;color:var(--dgray);margin-top:6px">
          Las cuentas se crean en el panel de Supabase (Authentication) y se activan en la tabla <code>perfiles</code>.
        </div>
      </div>

      <!-- RESPALDO -->
      <div class="config-card card">
        <h3><i class="ti ti-database-export" style="color:var(--green)"></i> Respaldo de la base de datos</h3>
        <p style="font-size:12.5px;color:var(--dgray)">
          Descarga un archivo JSON con todas las tablas del sistema, leídas directamente de la base de datos.
          Es un respaldo de lectura: guárdalo fuera de esta computadora.
        </p>
        <div v-if="estadoRespaldo" style="font-size:12px;margin-bottom:8px" v-html="estadoRespaldo"></div>
        <button class="btn btn-primary" :disabled="respaldando" @click="respaldarTodo">
          <i class="ti ti-download"></i> {{ respaldando ? 'Respaldando...' : 'Descargar respaldo completo' }}
        </button>
        <div style="font-size:11px;color:var(--dgray);margin-top:6px">Último respaldo en este equipo: {{ ultimoRespaldo }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD } from '../services/pricing.js';
import { parseMontoVE } from '../services/cobros.js';
import { supabase, cargarPerfiles } from '../services/supabase.js';
import { periodoDe } from '../services/fechas.js';

const store = useArjStore();

// ── Tasas ──
const tasaPar = ref(String(store.tasa_par || ''));
const tasaBcv = ref(String(store.tasa_bcv || ''));
watch(() => [store.tasa_par, store.tasa_bcv], ([p, b]) => { tasaPar.value = String(p || ''); tasaBcv.value = String(b || ''); });

const brechaPct = computed(() => {
  const p = parseMontoVE(tasaPar.value), b = parseMontoVE(tasaBcv.value);
  return b > 0 ? ((p / b - 1) * 100).toFixed(1) : '0.0';
});

async function confirmarTasasHoy() {
  await store.confirmarTasas(parseMontoVE(tasaBcv.value), parseMontoVE(tasaPar.value));
}

async function consultarBCV() {
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    if (!res.ok) throw new Error('Error en la API');
    const data = await res.json();
    if (data && data.promedio) {
      tasaBcv.value = String(data.promedio);
      store.notif(`BCV consultado: ${data.promedio}. Revisa y pulsa "Guardar y confirmar".`, 'info');
    }
  } catch (e) {
    store.notif('No se pudo consultar el BCV. Escribe la tasa a mano.', 'error');
  }
}

// ── Parámetros ──
const factorDefault = ref((store.configuracion && store.configuracion.factor_default) || 1.471);
const mesCostos = ref(periodoDe(new Date()));
const montoCostos = ref(0);
const historialCostos = computed(() => (store.configuracion && store.configuracion.costos_fijos_hist) || {});

function cargarMes() {
  montoCostos.value = store.costosFijosDe(mesCostos.value);
}
watch(() => store.configuracion, (c) => {
  if (c) { factorDefault.value = c.factor_default; cargarMes(); }
}, { immediate: true });

async function guardarFactor() {
  const f = parseFloat(factorDefault.value);
  if (!(f >= 1)) { store.notif('El factor debe ser mayor o igual a 1', 'error'); return; }
  if (await store.actualizarConfiguracion({ factor_landed_default: f }, `Factor landed por defecto: ${f}`)) {
    store.notif('Factor por defecto guardado', 'success');
  }
}

async function guardarCostosFijos() {
  const m = parseFloat(montoCostos.value);
  if (!(m >= 0)) { store.notif('Monto inválido', 'error'); return; }
  const hist = { ...historialCostos.value, [mesCostos.value]: m };
  const campos = { costos_fijos_hist: hist };
  if (mesCostos.value === periodoDe(new Date())) campos.costos_fijos_mes = m;
  if (await store.actualizarConfiguracion(campos, `Costos fijos ${mesCostos.value}: ${fmtUSD(m)}`)) {
    store.notif(`Costos fijos de ${mesCostos.value} guardados`, 'success');
  }
}

// ── Usuarios (solo lectura) ──
const usuarios = ref([]);
const cargandoUsuarios = ref(false);
onMounted(async () => {
  cargandoUsuarios.value = true;
  try { usuarios.value = await cargarPerfiles(); } catch (e) { store.notif('No se pudieron leer los usuarios: ' + e.message, 'error'); }
  cargandoUsuarios.value = false;
});

// ── Respaldo real desde la BD ──
const TABLAS_RESPALDO = ['configuracion', 'productos', 'clientes', 'contactos_cliente', 'facturas', 'factura_items', 'pagos',
  'cotizaciones', 'cotizacion_items', 'embarques', 'traspasos', 'traspaso_items', 'recepciones', 'recepcion_items',
  'movimientos_caja', 'contadores', 'sistemas', 'bitacora'];
const respaldando = ref(false);
const estadoRespaldo = ref('');
const ultimoRespaldo = ref(localStorage.getItem('arj_ultimo_respaldo') || 'nunca');

async function leerTabla(t) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from(t).select('*').range(desde, desde + 999);
    if (error) return { error: error.message };
    filas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { filas };
}

async function respaldarTodo() {
  if (!store._exigirConexion('Respaldo')) return;
  respaldando.value = true;
  const datos = {}, conteo = {}, errores = {};
  try {
    for (let i = 0; i < TABLAS_RESPALDO.length; i++) {
      const t = TABLAS_RESPALDO[i];
      estadoRespaldo.value = `Leyendo <strong>${t}</strong> (${i + 1} de ${TABLAS_RESPALDO.length})...`;
      const r = await leerTabla(t);
      if (r.error) { errores[t] = r.error; continue; }
      datos[t] = r.filas;
      conteo[t] = r.filas.length;
    }
    const paquete = {
      _meta: {
        sistema: 'ARJ', generado: new Date().toISOString(), usuario: store.usuarioNombre,
        conteo_por_tabla: conteo, errores,
        nota: 'Respaldo de lectura. Para restaurar: productos y clientes primero, luego facturas, luego factura_items y pagos.'
      },
      datos
    };
    const blob = new Blob([JSON.stringify(paquete)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ARJ_RESPALDO_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    const n = Object.values(conteo).reduce((x, y) => x + y, 0);
    const nErr = Object.keys(errores).length;
    estadoRespaldo.value = nErr
      ? `<span style="color:var(--red)">Respaldo con ${nErr} tabla(s) sin leer: ${Object.keys(errores).join(', ')}</span>`
      : `<span style="color:var(--green)">✓ ${n} filas de ${Object.keys(conteo).length} tablas</span>`;
    ultimoRespaldo.value = new Date().toLocaleString('es-VE');
    localStorage.setItem('arj_ultimo_respaldo', ultimoRespaldo.value);
    store.logBitacora('config', `Descargó respaldo completo (${n} filas${nErr ? ', ' + nErr + ' tablas con error' : ''})`, true);
  } finally {
    respaldando.value = false;
  }
}
</script>
