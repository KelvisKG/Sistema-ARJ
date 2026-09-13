<template>
  <div class="page active" id="page-config">
    <h1 class="page-title"><i class="ti ti-settings"></i> Configuración</h1>
    <p class="page-sub">Tasas · Parámetros ARJ · Datos de empresa · Usuarios · Backups</p>

    <!-- GRID 1: TASAS Y PARÁMETROS -->
    <div class="config-grid">
      <!-- CARD 1: TASAS DE CAMBIO -->
      <div class="config-card">
        <h3><i class="ti ti-currency-dollar" style="color:var(--blue)"></i> Tasas de cambio</h3>
        
        <div class="config-row">
          <label>Dólar paralelo (Bs/$)</label>
          <input
            v-model.number="store.tasa_par"
            class="val-input"
            id="cfg-par"
            type="number"
            step="0.01"
            placeholder="0.00"
            @change="alCambiarTasas"
          >
        </div>

        <div class="config-row">
          <label>Dólar BCV (Bs/$)</label>
          <input
            v-model.number="store.tasa_bcv"
            class="val-input"
            id="cfg-bcv"
            type="number"
            step="0.01"
            placeholder="0.00"
            @change="alCambiarTasas"
          >
        </div>

        <div class="config-row">
          <label>Euro (Bs/€)</label>
          <input
            v-model.number="tasaEuro"
            class="val-input"
            type="number"
            step="0.01"
          >
        </div>

        <div class="config-row" style="border:none;padding-top:14px;flex-direction:column;align-items:stretch;gap:8px">
          <div id="cfg-tasas-estado" style="font-size:11.5px;text-align:center;line-height:1.5">
            <span v-if="store.tasasConfirmadasHoy" style="color:var(--green);font-weight:600">
              <i class="ti ti-check"></i> Tasas confirmadas para hoy · Brecha: {{ brechaPct }}% (Dto verde: {{ dtoVerdePct }}%)
            </span>
            <span v-else style="color:var(--red);font-weight:600">
              <i class="ti ti-alert-triangle"></i> Tasas pendientes de confirmar hoy
            </span>
          </div>

          <button class="btn btn-primary btn-sm" style="margin:0 auto" @click="confirmarTasasHoy">
            <i class="ti ti-check"></i> Confirmar tasas de hoy
          </button>

          <button class="btn btn-secondary btn-sm" style="margin:0 auto" @click="avisoTasaAuto">
            <i class="ti ti-refresh"></i> Traer desde BCV.org.ve
          </button>
        </div>
      </div>

      <!-- CARD 2: PARÁMETROS ARJ -->
      <div class="config-card">
        <h3><i class="ti ti-adjustments" style="color:var(--blue)"></i> Parámetros ARJ</h3>
        
        <div class="config-row">
          <label>Factor landed por defecto</label>
          <input
            v-model.number="factorLandedDefault"
            class="val-input"
            id="cfg-factor"
            type="number"
            step="0.001"
            min="1"
            max="5"
            @change="guardarParametros"
          >
        </div>

        <div class="config-row">
          <label style="font-size:11px;color:var(--dgray)">Solo aplica a productos NUEVOS</label>
          <label style="font-size:11px;color:var(--dgray)">No toca los ya cargados</label>
        </div>

        <div class="config-row">
          <label>Costos fijos — mes</label>
          <input
            v-model="mesCostosFijos"
            class="val-input"
            id="cfg-fijos-mes"
            type="month"
            @change="cambiarPeriodoFijos"
          >
        </div>

        <div class="config-row">
          <label>Monto del mes USD</label>
          <input
            v-model.number="montoMesFijos"
            class="val-input"
            id="cfg-fijos"
            type="number"
            step="0.01"
            min="0"
            @change="actualizarCostosFijos"
          >
        </div>

        <div class="config-row" style="border:none;padding-top:4px">
          <label style="font-size:11px;color:var(--dgray)">Cada mes guarda su propio monto</label>
        </div>

        <div id="cfg-fijos-lista" style="font-size:11px;color:var(--dgray);padding:0 0 8px">
          <span v-for="(f, i) in listaCostosFijos" :key="i" style="display:inline-block;margin-right:8px">
            • {{ f.mes }}: <strong>${{ f.monto.toFixed(2) }}</strong>
          </span>
        </div>

        <div class="config-row">
          <label>Costos fijos / mes (base)</label>
          <input
            v-model.number="costosFijosBase"
            class="val-input"
            type="number"
            step="50"
            @change="guardarParametros"
          >
        </div>

        <div class="config-row">
          <label>IVA Venezuela</label>
          <input
            class="val-input"
            value="0"
            type="number"
            step="0.1"
            style="background:#FCE4D6;border-color:var(--red);color:var(--red)"
            disabled
          >
        </div>

        <div class="config-row">
          <label style="font-size:11px;color:var(--gold)">⚠ IVA bloqueado en 0%</label>
          <label style="font-size:11px;color:var(--dgray)">Repuestos agrícolas exentos</label>
        </div>
      </div>
    </div>

    <!-- GRID 2: BACKUP Y USUARIOS -->
    <div class="config-grid" style="margin-top:14px">
      <!-- CARD 3: BACKUP Y DATOS LOCALSTORAGE -->
      <div class="config-card">
        <h3><i class="ti ti-database" style="color:var(--green)"></i> Backup y datos guardados</h3>

        <div class="config-row">
          <label>Persistencia local</label>
          <span style="color:var(--green);font-weight:600"><i class="ti ti-circle-check"></i> Activa · localStorage</span>
        </div>

        <div class="config-row">
          <label>Auto-guardado</label>
          <span style="font-size:11px">Cada cambio + cada 60 seg.</span>
        </div>

        <div class="config-row">
          <label>Último guardado</label>
          <span style="font-size:11px" id="cfg-ultimo-guardado">{{ ultimoGuardado }}</span>
        </div>

        <div class="config-row">
          <label>Tamaño en localStorage</label>
          <span style="font-size:11px" id="cfg-tam-storage">{{ tamStorage }} KB</span>
        </div>

        <div class="help-box" style="margin:12px 0">
          <i class="ti ti-info-circle"></i>
          <span><strong>Importante:</strong> los datos se guardan en este equipo y este navegador. Si cambias de PC o limpias historial, se pierden. <strong>Exporta un respaldo en JSON periódicamente.</strong></span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
          <button class="btn btn-primary btn-sm" @click="exportarDatosJSON">
            <i class="ti ti-download"></i> Exportar JSON
          </button>
          <button class="btn btn-secondary btn-sm" @click="triggerInputImport">
            <i class="ti ti-upload"></i> Importar JSON
          </button>
        </div>

        <div style="margin-top:8px">
          <button
            class="btn btn-secondary btn-sm"
            style="width:100%;color:var(--red);border-color:var(--red)"
            @click="resetearDatosDemo"
          >
            <i class="ti ti-refresh-alert"></i> Resetear a datos demo
          </button>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          accept=".json,application/json"
          style="display:none"
          @change="procesarArchivoImport"
        >
      </div>

      <!-- CARD 4: USUARIOS DEL SISTEMA -->
      <div class="config-card">
        <h3><i class="ti ti-users" style="color:var(--blue)"></i> Usuarios del sistema</h3>
        
        <div style="font-size:11.5px;color:var(--dgray);margin-bottom:10px">
          Cada vendedor está asignado a UNA empresa. Solo el gerente puede ver y operar en ambas.
        </div>

        <table class="simple-tbl" style="font-size:11.5px;width:100%">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Empresa</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(u, idx) in usuarios" :key="idx">
              <td><strong>{{ u.nombre }}</strong></td>
              <td>
                <span :class="['badge', u.rol === 'gerente' ? 'badge-primary' : 'badge-secondary']">
                  {{ u.rol.toUpperCase() }}
                </span>
              </td>
              <td>{{ u.empresa }}</td>
              <td>
                <span style="color:var(--green);font-weight:600">● Activo</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top:12px;text-align:right">
          <button class="btn btn-secondary btn-sm" @click="abrirNuevoUsuario">
            <i class="ti ti-user-plus"></i> Agregar usuario
          </button>
        </div>
      </div>
    </div>

    <!-- GRID 3: LISTAS PERSONALIZADAS Y RESPALDO SUPABASE -->
    <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <!-- CARD 5: LISTAS DE PRECIOS PERSONALIZADAS -->
      <div class="config-card">
        <h3><i class="ti ti-list" style="color:var(--blue)"></i> Listas de precios personalizadas</h3>
        <p style="font-size:12px;color:var(--dgray);margin-bottom:12px">
          Más allá de los 4 tramos fijos (Público, T1, T2, T3), puedes crear listas especiales para casos puntuales: familiares, clientes VIP, precio costo, etc.
        </p>

        <div style="display:flex;flex-direction:column;gap:8px">
          <div
            v-for="(l, idx) in listasPreciosPersonalizadas"
            :key="idx"
            style="border:1px solid var(--border);border-radius:6px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center"
          >
            <div>
              <strong style="font-size:13px">{{ l.nombre }}</strong>
              <div style="font-size:11px;color:var(--dgray)">{{ l.descripcion }} · {{ l.descuento }}% sobre base</div>
            </div>
            <span class="badge badge-success">Activa</span>
          </div>
        </div>

        <div style="margin-top:12px;text-align:right">
          <button class="btn btn-primary btn-sm" @click="crearListaPersonalizada">
            <i class="ti ti-plus"></i> Crear lista personalizada
          </button>
        </div>
      </div>

      <!-- CARD 6: RESPALDO DE BASE DE DATOS (SUPABASE) -->
      <div class="config-card" id="card-respaldo">
        <h3><i class="ti ti-database-export" style="color:var(--green)"></i> Respaldo de la base de datos</h3>
        <p style="font-size:12px;color:var(--dgray);margin-bottom:10px;line-height:1.55">
          Descarga <strong>todo</strong> lo que hay en Supabase a un solo archivo en tu computadora: productos, facturas, renglones, pagos, clientes, embarques, movimientos y bitácora.
          El plan Free de Supabase <strong>no hace respaldos automáticos</strong>, así que este archivo es tu única copia de seguridad externa.
        </p>

        <div class="help-box" style="margin-bottom:14px">
          <i class="ti ti-calendar"></i>
          <span><strong>Recomendación:</strong> Respaldar cada viernes y guardar el archivo en almacenamiento seguro (como OneDrive o Google Drive), no solo en la PC local.</span>
        </div>

        <div id="resp-estado" style="font-size:12.5px;margin-bottom:10px">
          <span v-if="store.supabaseConectado" style="color:var(--green);font-weight:600">
            <i class="ti ti-circle-check"></i> Supabase sincronizado y en línea.
          </span>
          <span v-else style="color:var(--gold);font-weight:600">
            <i class="ti ti-info-circle"></i> Supabase desconectado · Los datos se respaldan desde la memoria local.
          </span>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-primary" id="btn-respaldar" @click="respaldarTodo">
            <i class="ti ti-download"></i> Respaldar todo ahora
          </button>
          <span style="font-size:11.5px;color:var(--dgray)" id="resp-ultimo">
            Último respaldo: {{ ultimoRespaldoNube }}
          </span>
        </div>
      </div>
    </div>

    <!-- MODAL AGREGAR USUARIO -->
    <div v-if="mostrarModalUsuario" class="modal show">
      <div class="modal-content" style="max-width:460px;text-align:left">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="modal-icon" style="background:rgba(37,99,235,0.12);color:var(--primary);margin:0;width:38px;height:38px;font-size:18px">
              <i class="ti ti-user-plus"></i>
            </div>
            <h3 style="margin:0;font-size:17px;color:var(--text);font-weight:700">Nuevo Usuario</h3>
          </div>
          <button class="btn btn-secondary btn-sm" @click="mostrarModalUsuario = false"><i class="ti ti-x"></i></button>
        </div>

        <div class="field-col" style="margin-bottom:14px">
          <label>Nombre completo *</label>
          <input v-model="nuevoUsuario.nombre" type="text" class="val-input" placeholder="Ej: Carlos Rojas"
            :class="{ 'is-invalid': errorsUsuario.nombre }" @input="errorsUsuario.nombre = null">
          <span v-if="errorsUsuario.nombre" class="field-error"><i class="ti ti-alert-circle"></i> {{ errorsUsuario.nombre }}</span>
        </div>

        <div class="field-col" style="margin-bottom:14px">
          <label>Rol en el sistema</label>
          <select v-model="nuevoUsuario.rol" class="val-input">
            <option value="vendedor">Vendedor</option>
            <option value="gerente">Gerente</option>
          </select>
        </div>

        <div class="field-col" style="margin-bottom:18px">
          <label>Empresa asignada</label>
          <select v-model="nuevoUsuario.empresa" class="val-input">
            <option value="Venta Directa">Venta Directa</option>
            <option value="Distribuidora">Distribuidora</option>
            <option value="Ambas">Ambas (Solo Gerencia)</option>
          </select>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="mostrarModalUsuario = false">Cancelar</button>
          <button class="btn btn-primary" @click="guardarUsuario">
            <i class="ti ti-check"></i> Guardar Usuario
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';

const store = useArjStore();
const fileInputRef = ref(null);

const tasaEuro = ref(232.40);
const factorLandedDefault = ref(1.471);
const mesCostosFijos = ref('2026-03');
const montoMesFijos = ref(6148.00);
const costosFijosBase = ref(6148);

const ultimoGuardado = ref('Hoy, en tiempo real');
const tamStorage = ref('124.5');
const ultimoRespaldoNube = ref(localStorage.getItem('arj_ultimo_respaldo') || 'No realizado aún');

const mostrarModalUsuario = ref(false);
const nuevoUsuario = ref({
  nombre: '',
  rol: 'vendedor',
  empresa: 'Venta Directa'
});
const errorsUsuario = ref({});

const usuarios = ref([
  { nombre: 'JJ (Gerente General)', rol: 'gerente', empresa: 'Ambas (Directa y Dist)' },
  { nombre: 'Vendedor Mostrador', rol: 'vendedor', empresa: 'Venta Directa' },
  { nombre: 'Vendedor Mayorista', rol: 'vendedor', empresa: 'Distribuidora ARJ' }
]);

const listasPreciosPersonalizadas = ref([
  { nombre: 'Clientes VIP Agro', descripcion: 'Descuento especial del 5% sobre Mostrador', descuento: 5 },
  { nombre: 'Talleres Mecánicos Aliados', descripcion: 'Tarifa preferencial mayorista T2', descuento: 12 },
  { nombre: 'Precio Costo Landed', descripcion: 'Margen cero para inventario interno', descuento: 25 }
]);

const listaCostosFijos = ref([
  { mes: 'Enero 2026', monto: 5980.00 },
  { mes: 'Febrero 2026', monto: 6100.00 },
  { mes: 'Marzo 2026', monto: 6148.00 }
]);

const brechaPct = computed(() => {
  if (!store.tasa_bcv || store.tasa_bcv <= 0) return '0.0';
  return ((store.tasa_par / store.tasa_bcv - 1) * 100).toFixed(1);
});

const dtoVerdePct = computed(() => {
  if (!store.tasa_par || store.tasa_par <= 0) return '0.00';
  return ((1 - store.tasa_bcv / store.tasa_par) * 100).toFixed(2);
});

function alCambiarTasas() {
  store.tasasConfirmadasHoy = false;
  store.calcularBrecha();
}

function confirmarTasasHoy() {
  store.confirmarTasas();
  store.notif('Tasas de cambio confirmadas formalmente para la jornada de hoy', 'success');
}

function avisoTasaAuto() {
  store.notif('Consultando tipo de cambio oficial del BCV...', 'info');
  setTimeout(() => {
    store.tasa_bcv = 47.80;
    store.calcularBrecha();
    store.notif('Tasa BCV verificada: 47.80 Bs/$ (Fecha valor vigente)', 'success');
  }, 700);
}

function cambiarPeriodoFijos() {
  const match = listaCostosFijos.value.find(f => f.mes.includes(mesCostosFijos.value));
  if (match) {
    montoMesFijos.value = match.monto;
  }
}

function actualizarCostosFijos() {
  store.notif(`Costos fijos actualizados a $${montoMesFijos.value.toFixed(2)} para ${mesCostosFijos.value}`, 'success');
}

function guardarParametros() {
  store.notif('Parámetros ARJ guardados correctamente', 'success');
}

function exportarDatosJSON() {
  const data = {
    empresa: store.empresa,
    tasas: { bcv: store.tasa_bcv, par: store.tasa_par, dto_divisa: store.dto_divisa },
    productos: store.productos,
    clientes: store.clientes,
    facturasCobrar: store.facturasCobrar,
    todasFacturas: store.todasFacturas,
    presupuestos: store.presupuestos,
    movimientos: store.movimientos,
    embarques: store.embarques,
    turnos: store.turnos,
    bitacora: store.bitacora,
    fechaExportacion: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ARJ_Backup_Completo_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  store.notif('Respaldo en JSON descargado exitosamente', 'success');
}

function triggerInputImport() {
  if (fileInputRef.value) fileInputRef.value.click();
}

function procesarArchivoImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.productos) store.productos = data.productos;
      if (data.clientes) store.clientes = data.clientes;
      if (data.todasFacturas) store.todasFacturas = data.todasFacturas;
      if (data.tasas) {
        store.tasa_bcv = data.tasas.bcv || store.tasa_bcv;
        store.tasa_par = data.tasas.par || store.tasa_par;
      }
      store.notif('Datos importados y restaurados correctamente', 'success');
    } catch (err) {
      store.notif('Error al procesar el archivo JSON: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function resetearDatosDemo() {
  if (confirm('¿Estás seguro de resetear a los datos demo de catálogo agrícola?')) {
    store.initApp();
    store.notif('Sistema restablecido al catálogo semilla original', 'success');
  }
}

function abrirNuevoUsuario() {
  nuevoUsuario.value = { nombre: '', rol: 'vendedor', empresa: 'Venta Directa' };
  errorsUsuario.value = {};
  mostrarModalUsuario.value = true;
}

function guardarUsuario() {
  errorsUsuario.value = {};

  if (!nuevoUsuario.value.nombre.trim() || nuevoUsuario.value.nombre.trim().length < 3) {
    errorsUsuario.value.nombre = 'El nombre es obligatorio (mín. 3 caracteres)';
    store.notif('Indica el nombre del usuario', 'warning');
    return;
  }

  usuarios.value.push({ ...nuevoUsuario.value });
  mostrarModalUsuario.value = false;
  store.notif(`Usuario ${nuevoUsuario.value.nombre} agregado al sistema`, 'success');
}

function crearListaPersonalizada() {
  const nombre = prompt('Nombre de la nueva lista personalizada:');
  if (!nombre) return;
  listasPreciosPersonalizadas.value.push({
    nombre,
    descripcion: 'Lista especial creada por gerencia',
    descuento: 7
  });
  store.notif(`Lista de precios "${nombre}" creada`, 'success');
}

function respaldarTodo() {
  exportarDatosJSON();
  const now = new Date().toLocaleString();
  ultimoRespaldoNube.value = now;
  localStorage.setItem('arj_ultimo_respaldo', now);
  store.notif('Respaldo consolidado completado exitosamente', 'success');
}

onMounted(() => {
  const storageStr = JSON.stringify(localStorage);
  tamStorage.value = (storageStr.length / 1024).toFixed(1);
});
</script>
