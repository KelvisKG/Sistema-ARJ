<template>
  <div class="page active" id="page-clientes">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="page-title"><i class="ti ti-users"></i> Clientes Agrícolas</h1>
        <p class="page-sub">Listado de clientes registrados · Nivel de precio asignado · Saldos deudores</p>
      </div>
      <button class="btn btn-primary" @click="mostrarModalNuevo = true">
        <i class="ti ti-user-plus"></i> Nuevo cliente
      </button>
    </div>

    <div class="help-box">
      <i class="ti ti-info-circle"></i>
      <div>
        <strong>Cartera Comercial:</strong> Consulta teléfonos, contactos de taller/compras y estado crediticio de cada cliente. Puedes iniciar facturación directa seleccionando cualquiera de ellos.
      </div>
    </div>

    <div style="margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por nombre de empresa, RIF o teléfono..."
        class="val-input"
        style="width:340px;min-width:260px"
      >
      <!-- Gráfica Analítica: CÓMO NOS CONSIGUIERON (Diseño prototipo) -->
      <div style="flex:1;min-width:320px;background:#F8FAFC;padding:10px 14px;border-radius:6px;border:1px solid #E2E8F0;font-size:11px">
        <div style="margin-bottom:6px;font-weight:700;color:var(--navy);display:flex;justify-content:space-between">
          <span style="text-transform:uppercase;letter-spacing:0.04em;font-size:10.5px;color:var(--dgray)">
            CÓMO NOS CONSIGUIERON · {{ store.clientes.length }} CLIENTE(S) REGISTRADOS
          </span>
        </div>
        <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;gap:2px;margin-bottom:7px">
          <div v-for="st in statsCaptacion" :key="st.label" :style="{ width: st.pct + '%', background: st.color }" :title="st.label + ': ' + st.count + ' (' + st.pct + '%)'"></div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px">
          <span v-for="st in statsCaptacion" :key="st.label" style="display:inline-flex;align-items:center;gap:5px">
            <span :style="{ background: st.color, width:'9px', height:'9px', borderRadius:'2px' }"></span>
            <strong>{{ st.label }}</strong> {{ st.count }} ({{ st.pct }}%)
          </span>
        </div>
      </div>
    </div>

    <div class="card" style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:22%">CLIENTE</th>
            <th style="width:12%">RIF</th>
            <th style="width:12%">TEL. PRINCIPAL</th>
            <th style="width:15%">CONTACTO</th>
            <th class="center" style="width:8%">NIVEL</th>
            <th class="center" style="width:8%">TIPO</th>
            <th style="width:11%">ORIGEN</th>
            <th class="num" style="width:12%">SALDO</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="clientesFiltrados.length === 0">
            <td colspan="8" style="text-align:center;padding:24px;color:var(--dgray)">
              No se encontraron clientes registrados.
            </td>
          </tr>
          <tr v-for="c in clientesFiltrados" :key="c.id" style="cursor:pointer" @click="abrirDetalleCliente(c)">
            <td>
              <strong style="color:var(--navy)">{{ c.nombre }}</strong>
              <div v-if="c.direccion" style="font-size:11px;color:var(--dgray)">{{ c.direccion }}</div>
            </td>
            <td style="font-family:monospace;font-size:12px">{{ c.rif || '—' }}</td>
            <td style="font-size:12px">{{ c.tel || '—' }}</td>
            <td style="font-size:12px">
              <div>{{ c.contacto_principal?.nombre || '—' }}</div>
              <small style="color:var(--dgray)">{{ c.contacto_principal?.cargo || '' }}</small>
            </td>
            <td class="center">
              <span class="badge" style="background:#EDE9FE;color:#6D28D9;font-size:10.5px">{{ nivelTxt(c.nivel) }}</span>
            </td>
            <td class="center">
              <span class="badge" :style="{ background: c.tipo === 'credito' ? 'var(--lgold)' : '#E8F5E9', color: c.tipo === 'credito' ? 'var(--gold)' : '#1E7B34', fontSize: '10.5px' }">
                {{ c.tipo === 'credito' ? 'Crédito' : 'Contado' }}
              </span>
            </td>
            <td style="font-size:11.5px;color:var(--dgray)">
              {{ origenTxt(c) }}
            </td>
            <td class="num" style="font-weight:700" :style="{ color: saldoDe(c) > 0 ? 'var(--red)' : '#1E7B34' }">
              {{ fmtUSD(saldoDe(c)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL NUEVO CLIENTE -->
    <div v-if="mostrarModalNuevo" class="modal show" style="display:flex">
      <div class="modal-content" style="max-width:520px;text-align:left;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:10px">
          <h3 style="margin:0"><i class="ti ti-user-plus"></i> Registrar Nuevo Cliente</h3>
          <button class="btn btn-secondary btn-sm" @click="mostrarModalNuevo = false"><i class="ti ti-x"></i></button>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Nombre / Razón Social *</label>
          <input v-model="nuevoCli.nombre" type="text" placeholder="Ej: Agropecuaria El Trébol C.A." class="val-input">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col" style="margin-bottom:0">
            <label>RIF / Documento</label>
            <input v-model="nuevoCli.rif" type="text" placeholder="J-12345678-0" class="val-input">
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Teléfono Principal</label>
            <input v-model="nuevoCli.tel" type="text" placeholder="0414-1234567" class="val-input">
          </div>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Dirección o Ubicación</label>
          <input v-model="nuevoCli.direccion" type="text" placeholder="Ej: Carretera Nacional Vía La Misión..." class="val-input">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col" style="margin-bottom:0">
            <label>Nivel de Precio</label>
            <select v-model="nuevoCli.nivel" class="val-input">
              <option value="Publico">Público / Mostrador</option>
              <option value="T1" :disabled="store.rol !== 'gerente'">T1 (Aliado / –5%)</option>
              <option value="T2" :disabled="store.rol !== 'gerente'">T2 (Taller / –10%)</option>
              <option value="T3" :disabled="store.rol !== 'gerente'">T3 (Mayorista / –20%)</option>
            </select>
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Condición Habitual</label>
            <select v-model="nuevoCli.tipo" class="val-input">
              <option value="contado">Contado</option>
              <option value="credito">A Crédito</option>
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col" style="margin-bottom:0">
            <label>Persona de Contacto</label>
            <input v-model="nuevoCli.contacto_nombre" type="text" placeholder="Ing. Carlos Pérez" class="val-input">
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Cargo del Contacto</label>
            <input v-model="nuevoCli.contacto_cargo" type="text" placeholder="Jefe de Compras" class="val-input">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div class="field-col" style="margin-bottom:0">
            <label>¿Cómo nos consiguió?</label>
            <select v-model="nuevoCli.origen" class="val-input">
              <option value="referido">Boca a boca / Referido</option>
              <option value="visita">Llegó al local / Mostrador</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="tiktok">TikTok</option>
              <option value="whatsapp">WhatsApp directo</option>
              <option value="vendedor">Prospección del vendedor</option>
              <option value="feria">Feria / Evento agrícola</option>
              <option value="valla publicitaria">Valla Publicitaria</option>
              <option value="radio">Radio</option>
              <option value="historico">Anterior al registro</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Detalle de Captación</label>
            <input v-model="nuevoCli.origen_detalle" type="text" placeholder="Ej: quién lo refirió" class="val-input">
          </div>
        </div>

        <div class="modal-actions" style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-secondary" @click="mostrarModalNuevo = false">Cancelar</button>
          <button class="btn btn-primary" :disabled="!nuevoCli.nombre" @click="guardarNuevoCliente">
            <i class="ti ti-check"></i> Guardar Cliente
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL DETALLE CLIENTE -->
    <div v-if="mostrarModalDetalle && clienteSeleccionado" class="modal show" id="modal-detalle-cliente" style="display:flex">
      <div class="modal-content" style="max-width:700px;text-align:left;padding:24px;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:1px solid #E2E8F0;padding-bottom:12px">
          <div>
            <h2 style="font-size:20px;color:var(--navy);margin:0;font-weight:700;text-transform:uppercase">
              {{ clienteSeleccionado.nombre }}
            </h2>
            <div style="font-size:12px;color:var(--dgray);margin-top:4px">
              RIF: {{ clienteSeleccionado.rif || '—' }}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-secondary btn-sm" style="display:flex;align-items:center;gap:4px;border:1px solid var(--navy);color:var(--navy);background:#FFF" @click="abrirEditarCliente(clienteSeleccionado)">
              <i class="ti ti-edit"></i> Editar
            </button>
            <button class="btn-close" style="background:none;border:1px solid var(--navy);color:var(--navy);border-radius:6px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer" @click="mostrarModalDetalle = false">
              <i class="ti ti-x"></i>
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
          <!-- Datos Generales -->
          <div style="border:1px solid #E2E8F0;border-radius:8px;padding:16px">
            <div style="font-size:11px;color:var(--dgray);font-weight:700;margin-bottom:10px">DATOS GENERALES</div>
            <div style="display:grid;grid-template-columns:120px 1fr;gap:6px;font-size:12.5px;line-height:1.5">
              <strong>Teléfono:</strong> <span>{{ clienteSeleccionado.tel || '—' }}</span>
              <strong>Tipo:</strong> <span>{{ (clienteSeleccionado.tipo || 'contado').charAt(0).toUpperCase() + (clienteSeleccionado.tipo || 'contado').slice(1) }}</span>
              <strong>Nivel precio:</strong> <span>{{ nivelTxt(clienteSeleccionado.nivel) }}</span>
              <strong>Nos consiguió por:</strong> <span>{{ origenTxt(clienteSeleccionado) }}</span>
              <strong v-if="clienteSeleccionado.direccion">Dirección:</strong> <span v-if="clienteSeleccionado.direccion">{{ clienteSeleccionado.direccion }}</span>
            </div>
          </div>

          <!-- Saldo y Crédito -->
          <div style="background:#FBF3E0;border:1px solid #F5E6C8;border-radius:8px;padding:16px">
            <div style="font-size:11px;color:var(--dgray);font-weight:700;margin-bottom:10px">SALDO Y CRÉDITO</div>
            <div style="font-weight:700;margin-bottom:4px">Saldo deudor actual:</div>
            <div style="font-size:24px;font-weight:800" :style="{ color: saldoDe(clienteSeleccionado) > 0 ? 'var(--red)' : '#1E7B34' }">
              {{ fmtUSD(saldoDe(clienteSeleccionado)) }}
            </div>
            <div style="font-size:12px;margin-top:6px;color:var(--dgray)">
              <span v-if="saldoDe(clienteSeleccionado) <= 0">
                Cliente al día
              </span>
              <span v-else>
                Tiene facturas pendientes
              </span>
            </div>
          </div>
        </div>

        <!-- Contactos -->
        <div style="background:#F2F5FA;border:1px solid #E2E8F0;border-radius:8px;padding:16px;margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="font-size:11px;color:var(--dgray);font-weight:700">CONTACTOS</div>
            <button class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 8px;background:#FFF;border:1px solid var(--navy);color:var(--navy)" @click="abrirEditarCliente(clienteSeleccionado)">
              <i class="ti ti-edit"></i> Editar contacto
            </button>
          </div>
          <div v-if="clienteSeleccionado.contacto_principal && clienteSeleccionado.contacto_principal.nombre" style="background:#FFF;border-left:4px solid var(--navy);padding:12px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
            <div style="font-weight:700;color:var(--navy);font-size:13px;display:flex;align-items:center;gap:6px">
              {{ clienteSeleccionado.contacto_principal.nombre }}
              <span style="background:var(--navy);color:#FFF;padding:2px 6px;border-radius:10px;font-size:9px">PRINCIPAL</span>
            </div>
            <div style="font-size:12px;color:var(--dgray);margin-top:4px">
              {{ clienteSeleccionado.contacto_principal.cargo || 'Contacto' }} · <i class="ti ti-phone"></i> {{ clienteSeleccionado.contacto_principal.tel || clienteSeleccionado.tel }}
            </div>
          </div>
          <div v-else style="font-size:11px;color:var(--dgray);text-align:center;margin-top:12px;font-style:italic">
            No hay contactos registrados. Haz clic en "Editar contacto" para agregarlo.
          </div>
        </div>

        <!-- Facturas Pendientes -->
        <div style="border:1px solid #E2E8F0;border-radius:8px;padding:16px;margin-bottom:20px">
          <div style="font-size:11px;color:var(--dgray);font-weight:700;margin-bottom:10px">FACTURAS PENDIENTES</div>
          
          <div v-if="facturasPendientesCli.length > 0">
            <table class="tbl" style="width:100%;font-size:12px">
              <thead>
                <tr style="background:#F8FAFC">
                  <th style="padding:6px;text-align:left">N° Factura</th>
                  <th style="padding:6px;text-align:left">Fecha</th>
                  <th style="padding:6px;text-align:right">Saldo Pend.</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="f in facturasPendientesCli" :key="f.id" style="border-bottom:1px solid #EEE">
                  <td style="padding:6px;font-weight:700">{{ f.num }}</td>
                  <td style="padding:6px;color:var(--dgray)">{{ f.fecha }}</td>
                  <td style="padding:6px;text-align:right;color:var(--red);font-weight:600">{{ fmtUSD(f.total - (f.abonado || 0)) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else style="font-size:12px;color:#1E7B34;font-style:italic">
            <i class="ti ti-check"></i> Sin facturas pendientes
          </div>
        </div>

        <!-- Botones de accion -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E2E8F0;padding-top:16px;flex-wrap:wrap;gap:8px">
          <button class="btn btn-secondary" @click="mostrarModalDetalle = false">Cerrar</button>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a :href="`https://wa.me/${(clienteSeleccionado.tel||'').replace(/\D/g,'')}`" target="_blank" class="btn btn-green" style="background:#25D366;border-color:#25D366;text-decoration:none;display:inline-flex">
              <i class="ti ti-brand-whatsapp"></i> Enviar por WhatsApp
            </a>
            <button class="btn btn-primary" style="background:var(--gold);border-color:var(--gold);color:#FFF" @click="abrirEditarCliente(clienteSeleccionado)">
              <i class="ti ti-edit"></i> Editar cliente
            </button>
            <button class="btn btn-primary" style="background:var(--navy);border-color:var(--navy)" @click="facturarA(clienteSeleccionado)">
              <i class="ti ti-file-invoice"></i> Emitir Factura
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL EDITAR CLIENTE -->
    <div v-if="mostrarModalEditar && cliEditando" class="modal show" id="modal-editar-cliente" style="display:flex">
      <div class="modal-content" style="max-width:540px;text-align:left;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:10px">
          <h3 style="margin:0;color:var(--navy);display:flex;align-items:center;gap:8px">
            <i class="ti ti-edit" style="color:var(--gold)"></i> Editar Cliente
          </h3>
          <button class="btn btn-secondary btn-sm" @click="mostrarModalEditar = false"><i class="ti ti-x"></i></button>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Nombre / Razón Social *</label>
          <input v-model="cliEditando.nombre" type="text" placeholder="Ej: Agropecuaria El Trébol C.A." class="val-input">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col" style="margin-bottom:0">
            <label>RIF / Documento</label>
            <input v-model="cliEditando.rif" type="text" placeholder="J-12345678-0" class="val-input">
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Teléfono Principal</label>
            <input v-model="cliEditando.tel" type="text" placeholder="0414-1234567" class="val-input">
          </div>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Dirección o Ubicación</label>
          <input v-model="cliEditando.direccion" type="text" placeholder="Ej: Carretera Nacional Vía La Misión..." class="val-input">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col" style="margin-bottom:0">
            <label>Nivel de Precio</label>
            <select v-model="cliEditando.nivel" class="val-input">
              <option value="Publico">Público / Mostrador</option>
              <option value="T1" :disabled="store.rol !== 'gerente'">T1 (Aliado / –5%)</option>
              <option value="T2" :disabled="store.rol !== 'gerente'">T2 (Taller / –10%)</option>
              <option value="T3" :disabled="store.rol !== 'gerente'">T3 (Mayorista / –20%)</option>
            </select>
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Condición Habitual</label>
            <select v-model="cliEditando.tipo" class="val-input">
              <option value="contado">Contado</option>
              <option value="credito">A Crédito</option>
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col" style="margin-bottom:0">
            <label>Persona de Contacto</label>
            <input v-model="cliEditando.contacto_nombre" type="text" placeholder="Ing. Carlos Pérez" class="val-input">
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Cargo del Contacto</label>
            <input v-model="cliEditando.contacto_cargo" type="text" placeholder="Jefe de Compras" class="val-input">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div class="field-col" style="margin-bottom:0">
            <label>¿Cómo nos consiguió?</label>
            <select v-model="cliEditando.origen" class="val-input">
              <option value="referido">Boca a boca / Referido</option>
              <option value="visita">Llegó al local / Mostrador</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="tiktok">TikTok</option>
              <option value="whatsapp">WhatsApp directo</option>
              <option value="vendedor">Prospección del vendedor</option>
              <option value="feria">Feria / Evento agrícola</option>
              <option value="valla publicitaria">Valla Publicitaria</option>
              <option value="radio">Radio</option>
              <option value="historico">Anterior al registro</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div class="field-col" style="margin-bottom:0">
            <label>Detalle de Captación</label>
            <input v-model="cliEditando.origen_detalle" type="text" placeholder="Ej: Nombre de quien lo refirió" class="val-input">
          </div>
        </div>

        <div class="field-col" style="margin-bottom:16px">
          <label>Notas u Observaciones</label>
          <textarea v-model="cliEditando.notas" rows="2" placeholder="Observaciones adicionales sobre el cliente..." class="val-input" style="resize:vertical"></textarea>
        </div>

        <div class="modal-actions" style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-secondary" @click="mostrarModalEditar = false">Cancelar</button>
          <button class="btn btn-primary" :disabled="!cliEditando.nombre" @click="guardarEdicionCliente">
            <i class="ti ti-device-floppy"></i> Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD } from '../services/pricing.js';

const store = useArjStore();
const busqueda = ref('');
const mostrarModalNuevo = ref(false);
const mostrarModalDetalle = ref(false);
const mostrarModalEditar = ref(false);
const clienteSeleccionado = ref(null);

const nuevoCli = ref({
  nombre: '',
  rif: '',
  tel: '',
  nivel: 'Publico',
  tipo: 'contado',
  direccion: '',
  contacto_nombre: '',
  contacto_cargo: '',
  origen: 'referido',
  origen_detalle: ''
});

const cliEditando = ref({
  id: null,
  nombre: '',
  rif: '',
  tel: '',
  direccion: '',
  nivel: 'Publico',
  tipo: 'contado',
  empresa: 'ambas',
  origen: 'historico',
  origen_detalle: '',
  notas: '',
  contacto_nombre: '',
  contacto_cargo: '',
  contacto_tel: ''
});

// Agrupación y colores idénticos al prototipo ARJ (Verde para Boca a boca, Gris para Sin clasificar)
const ORIGEN_GRUPO = {
  'referido': 'Boca a boca',
  'visita': 'Boca a boca',
  'mostrador': 'Boca a boca',
  'boca a boca': 'Boca a boca',
  'instagram': 'Digital',
  'facebook': 'Digital',
  'tiktok': 'Digital',
  'whatsapp': 'Digital',
  'redes sociales': 'Digital',
  'vendedor': 'Esfuerzo propio',
  'feria': 'Esfuerzo propio',
  'valla publicitaria': 'Esfuerzo propio',
  'radio': 'Esfuerzo propio',
  'otro': 'Sin clasificar',
  'historico': 'Sin clasificar',
  'anterior al registro': 'Sin clasificar'
};

const ORIGEN_COLOR = {
  'Boca a boca': '#2E9E5B',      // Verde prototipo
  'Digital': '#5C6BC0',          // Azul/Índigo prototipo
  'Esfuerzo propio': '#C79100',   // Dorado prototipo
  'Sin clasificar': '#9E9E9E'    // Gris prototipo
};

const statsCaptacion = computed(() => {
  const total = store.clientes.length;
  if (total === 0) return [];

  const porGrupo = {};
  store.clientes.forEach(c => {
    const raw = (c.origen || c.como_consiguio || '').toLowerCase().trim();
    const g = ORIGEN_GRUPO[raw] || 'Sin clasificar';
    porGrupo[g] = (porGrupo[g] || 0) + 1;
  });

  const orden = ['Boca a boca', 'Digital', 'Esfuerzo propio', 'Sin clasificar'].filter(g => porGrupo[g]);
  return orden.map(g => {
    const count = porGrupo[g] || 0;
    const pct = Math.round((count / total) * 100);
    return {
      label: g,
      count,
      pct,
      color: ORIGEN_COLOR[g] || '#9E9E9E'
    };
  });
});

function nivelTxt(n) {
  const map = {
    'Publico': 'Público',
    'T1': 'T1 (–5%)',
    'T2': 'T2 (–10%)',
    'T3': 'T3 (–20%)'
  };
  return map[n] || n || 'Público';
}

function origenTxt(c) {
  const o = (c?.origen || c?.como_consiguio || '').toLowerCase().trim();
  const names = {
    'historico': 'Anterior al registro',
    'anterior al registro': 'Anterior al registro',
    'referido': 'Referido',
    'visita': 'Llegó al local / Mostrador',
    'mostrador': 'Llegó al local / Mostrador',
    'boca a boca': 'Boca a boca',
    'instagram': 'Instagram',
    'facebook': 'Facebook',
    'tiktok': 'TikTok',
    'whatsapp': 'WhatsApp directo',
    'vendedor': 'Prospección vendedor',
    'feria': 'Feria / evento',
    'valla publicitaria': 'Valla Publicitaria',
    'radio': 'Radio',
    'otro': 'Otro'
  };
  return names[o] || (o ? o.charAt(0).toUpperCase() + o.slice(1) : 'Anterior al registro');
}

const clientesFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase();
  if (!q) return store.clientes;
  return store.clientes.filter(c =>
    (c.nombre || '').toLowerCase().includes(q) ||
    (c.rif || '').toLowerCase().includes(q) ||
    (c.tel || '').toLowerCase().includes(q)
  );
});

function saldoDe(c) {
  return store.empresa === 'directa' ? (c.saldo_vd || 0) : (c.saldo_dist || 0);
}

function abrirDetalleCliente(c) {
  clienteSeleccionado.value = c;
  mostrarModalDetalle.value = true;
}

function abrirEditarCliente(c) {
  if (!c) return;
  cliEditando.value = {
    id: c.id,
    nombre: c.nombre || '',
    rif: c.rif || '',
    tel: c.tel || '',
    direccion: c.direccion || '',
    nivel: c.nivel || 'Publico',
    tipo: c.tipo || 'contado',
    empresa: c.empresa || 'ambas',
    origen: c.origen || 'historico',
    origen_detalle: c.origen_detalle || '',
    notas: c.notas || '',
    contacto_nombre: c.contacto_principal?.nombre || '',
    contacto_cargo: c.contacto_principal?.cargo || '',
    contacto_tel: c.contacto_principal?.tel || c.tel || ''
  };
  mostrarModalEditar.value = true;
}

async function guardarEdicionCliente() {
  if (!cliEditando.value.nombre || cliEditando.value.nombre.trim().length < 3) {
    store.notif('El nombre del cliente es obligatorio (mín. 3 caracteres)', 'warning');
    return;
  }
  const id = cliEditando.value.id;
  const ok = await store.actualizarCliente(id, {
    nombre: cliEditando.value.nombre,
    rif: cliEditando.value.rif,
    tel: cliEditando.value.tel,
    direccion: cliEditando.value.direccion,
    nivel: cliEditando.value.nivel,
    tipo: cliEditando.value.tipo,
    origen: cliEditando.value.origen,
    origen_detalle: cliEditando.value.origen_detalle,
    notas: cliEditando.value.notas,
    contacto_principal: {
      nombre: (cliEditando.value.contacto_nombre || '').trim(),
      cargo: (cliEditando.value.contacto_cargo || '').trim(),
      tel: cliEditando.value.contacto_tel || cliEditando.value.tel || ''
    }
  });
  if (!ok) return;
  if (clienteSeleccionado.value && clienteSeleccionado.value.id === id) {
    clienteSeleccionado.value = store.clientes.find(c => c.id === id) || null;
  }
  mostrarModalEditar.value = false;
}

const facturasPendientesCli = computed(() => {
  if (!clienteSeleccionado.value) return [];
  return store.facturasCobrar.filter(f => f.cliente_id === clienteSeleccionado.value.id);
});

function facturarA(c) {
  store.seleccionarCliente(c);
  mostrarModalDetalle.value = false;
  store.cambiarVista('facturacion');
}

async function guardarNuevoCliente() {
  const n = nuevoCli.value;
  if (!n.nombre || n.nombre.trim().length < 3) {
    store.notif('Escribe el nombre del cliente (mín. 3 caracteres)', 'warning');
    return;
  }
  const cli = await store.crearCliente({
    nombre: n.nombre,
    rif: n.rif,
    tel: n.tel,
    nivel: n.nivel,
    tipo: n.tipo,
    direccion: n.direccion,
    origen: n.origen || 'referido',
    origen_detalle: n.origen_detalle || '',
    contacto_principal: { nombre: n.contacto_nombre, cargo: n.contacto_cargo, tel: n.tel }
  });
  if (!cli) return;
  mostrarModalNuevo.value = false;
  nuevoCli.value = {
    nombre: '', rif: '', tel: '', nivel: 'Publico', tipo: 'contado', direccion: '',
    contacto_nombre: '', contacto_cargo: '', origen: 'referido', origen_detalle: ''
  };
}
</script>
