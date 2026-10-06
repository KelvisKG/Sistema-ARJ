// Monta cada vista y modal con datos de ejemplo y falla si Vue avisa de
// propiedades inexistentes o si el render lanza un error. No toca la red.
// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

// supabase-js exige WebSocket al crearse; en happy-dom no existe
vi.hoisted(() => { if (!globalThis.WebSocket) globalThis.WebSocket = class {}; });

vi.mock('../src/services/supabase.js', async (original) => ({
  ...(await original()),
  cargarFlujoCajaBD: async () => [],
  cargarPerfiles: async () => [{ id: 'u1', nombre_display: 'JJ', rol: 'gerente', empresa: 'ambas', activo: true }],
  cargarItemsVentasMes: async () => [],
  cargarDetallesFactura: async () => ({ items: [], pagos: [] }),
  cargarFacturasRango: async () => [],
  guardarBitacoraEnSupabase: async () => {}
}));

import { useArjStore } from '../src/stores/useArjStore.js';
import { mapFactura } from '../src/services/supabase.js';

const vistas = import.meta.glob('../src/views/*.vue', { eager: true });
const modales = import.meta.glob('../src/components/**/*.vue', { eager: true });

function poblar(store) {
  const hoy = new Date().toISOString();
  store.$patch({
    autenticado: true,
    verificandoSesion: false,
    perfil: { id: 'u1', rol: 'gerente', empresa: 'ambas', nombre_display: 'JJ' },
    rol: 'gerente',
    usuarioNombre: 'JJ',
    empresaPermitida: 'ambas',
    supabaseConectado: true,
    tasa_bcv: 857.89,
    tasa_par: 980,
    tasas_actualizadas: hoy,
    configuracion: {
      tasa_bcv: 857.89, tasa_par: 980, tasas_actualizadas: hoy, factor_default: 1.471, costos_fijos_mes: 2500,
      costos_fijos_hist: { '2026-08': 2500 }, equipo: ['Vendedor 1'], metas_hist: {}
    },
    sistemas: ['Motor'],
    productos: [
      { id: 1, cod_alt: 'HF6510', cod_orig: '8421456', cod_barras: '', desc: 'Filtro hidráulico', marca: 'FLEETGUARD', fob: 3.13,
        stock_vd: 5, stock_dist: 20, marca_modelo: 'Case IH', sistema: 'Motor', precio_manual: null, origen: 'importado',
        factor_landed: 1.736644, proveedor: 'PANEGOSSI', embarque_id: 'e1', activo: true }
    ],
    clientes: [
      { id: 7, nombre: 'CONSUMIDOR FINAL', rif: 'V-00000000-0', nivel: 'Publico', tipo: 'contado', saldo_vd: 0, saldo_dist: 70,
        tel: '04140000000', empresa: 'ambas', origen: 'historico', como_consiguio: 'historico', origen_detalle: '', direccion: '',
        notas: '', contacto_principal: { nombre: '—', cargo: '—', tel: '' }, contactos_adicionales: [] }
    ],
    todasFacturas: [
      mapFactura({ id: 37, numero: 'VD-2026-00032', empresa: 'directa', cliente_id: 7, cliente_nombre: 'CONSUMIDOR FINAL',
        vendedor: 'JJ', fecha: hoy, subtotal_usd: '100', tasa_par: '980', tasa_bcv: '857.89', tipo_pago: 'credito',
        dias_credito: 15, fecha_vence: new Date(Date.now() + 5 * 86400000).toISOString(), estado: 'parcial', saldo_pendiente: '40',
        descuento_manual: '0', motivo_descuento: '', pidio_fiscal: false, factor_bs: '1', cliente_rif_snap: 'V-00000000-0',
        cliente_nombre_snap: 'CONSUMIDOR FINAL', cobrar_verde: null })
    ],
    presupuestos: [
      { id: 6, num: 'PRE-VD-2026-0003', empresa: 'directa', cliente: 'CONSUMIDOR FINAL', cliente_id: 7, fecha: '06 oct 2026',
        fecha_raw: hoy, vence: '20 nov 2026', total: 13, estado: 'activa', estado_bd: 'activa', dias_restantes: 45, items_count: 1,
        items: [{ id: 1, cod_alt: 'HF6510', desc: 'Filtro hidráulico', cant: 1, precio: 13, fob: 3.13 }], vendedor: 'JJ', tasa_bcv: 857.89 }
    ],
    embarques: [{ id: 'e1', codigo: 'PANEGOSSI-2026-01', proveedor: 'PANEGOSSI', fecha_llegada: '2026-08-13', fob_total: 10181,
      monto_flete_aduana: 3686.28, pct_flete_aduana: 36.2074, pct_comision: 2, pct_divisas: 25, factor: 1.736644 }],
    turnos: [{ id: 1, usuario_id: 'u1', cajero: 'JJ', empresa: 'directa', apertura_iso: hoy, fecha_apertura: 'hoy',
      fecha_cierre: null, inicial_usd: 0, inicial_bs: 0, estado: 'abierto' }],
    movimientosDinero: [{ id: 'M1', idBD: 1, fecha: 'hoy', fecha_raw: hoy, tipo: 'salida', categoria: 'Sueldos', concepto: 'x',
      montoUSD: 10, montoBs: 8578.9, metodo: 'Efectivo USD', empresa: 'Venta Directa', clase: 'opex', estado: 'activo', manual: true }]
  });
  store.agregarAlCarrito(store.productos[0], 2);
  store.seleccionarCliente(store.clientes[0]);
  store.agregarPagoCarrito({ metodo: 'Pago móvil Bs.', monto: 5000, ref: '123' });
}

let avisos;
beforeEach(() => {
  avisos = [];
  vi.spyOn(console, 'warn').mockImplementation((...a) => { avisos.push(a.join(' ')); });
  vi.spyOn(console, 'error').mockImplementation((...a) => { avisos.push(a.join(' ')); });
});
afterEach(() => vi.restoreAllMocks());

async function montar(Comp, preparar) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useArjStore();
  poblar(store);
  if (preparar) preparar(store);
  const w = mount(Comp, { global: { plugins: [pinia] } });
  await flushPromises();
  return { w, store };
}

const filtrarAvisos = () => avisos.filter(a => /Vue warn|TypeError|ReferenceError|is not defined|undefined/i.test(a));

describe('vistas', () => {
  for (const [ruta, mod] of Object.entries(vistas)) {
    test(ruta.split('/').pop(), async () => {
      const { w } = await montar(mod.default);
      expect(w.html().length).toBeGreaterThan(50);
      expect(filtrarAvisos()).toEqual([]);
    });
  }
});

const banderas = {
  'FacturaModal.vue': s => { s.facturaReciente = s.todasFacturas[0]; s.modalFacturaActivo = true; },
  'AnularFacturaModal.vue': s => { s.facturaAAnular = s.todasFacturas[0]; s.modalAnularActivo = true; },
  'TraspasoModal.vue': s => { s.modalTraspasoActivo = true; },
  'RecepcionModal.vue': s => { s.modalRecepcionActivo = true; },
  'EmbarquesModal.vue': s => { s.modalEmbarquesActivo = true; },
  'EditProdModal.vue': s => { s.productoSeleccionado = s.productos[0]; s.modalEditProdActivo = true; },
  'DtoDivisaModal.vue': s => { s.modalDtoDivisaActivo = true; },
  'DtoManualModal.vue': s => { s.modalDtoManualActivo = true; },
  'NuevoClienteRapidoModal.vue': s => { s.modalNuevoClienteActivo = true; },
  'ListaPreciosModal.vue': s => { s.modalListaPreciosActivo = true; },
  'ModoCajaModal.vue': s => { s.modoCajaActivo = true; },
  'PresupuestoPreviewModal.vue': s => { s.presupuestoSeleccionado = s.presupuestos[0]; s.modalPresupuestoActivo = true; },
  'HeaderNav.vue': s => { s.tasas_actualizadas = null; },
  'LoginScreen.vue': s => { s.autenticado = false; }
};

describe('modales y componentes', () => {
  for (const [ruta, mod] of Object.entries(modales)) {
    const nombre = ruta.split('/').pop();
    if (nombre === 'NotasEntregaModal.vue') continue; // consulta la BD al abrirse
    test(nombre, async () => {
      await montar(mod.default, banderas[nombre]);
      expect(filtrarAvisos()).toEqual([]);
    });
  }
});

describe('flujo de facturación en el store', () => {
  test('pago en Bs a tasa BCV completa una venta de contado', async () => {
    const { store } = await montar({ template: '<div/>' });
    store.carrito.pagos = [];
    const bs = store.totales.totalBs;
    store.agregarPagoCarrito({ metodo: 'Pago móvil Bs.', monto: bs, ref: '999' });
    expect(store.faltaPorPagarUSD).toBeLessThan(0.01);
    expect(store.validarEmision()).toBeNull();
  });
  test('vendedor no puede cambiar el tier ni la empresa', async () => {
    const { store } = await montar({ template: '<div/>' }, s => { s.rol = 'vendedor'; s.empresaPermitida = 'directa'; });
    store.empresa = 'distribuidora';
    store.cambiarTier('T3');
    expect(store.carrito.tier).not.toBe('T3');
    store.empresa = 'directa';
    store.carrito.items = [];
    store.carrito.pagos = [];
    store.cambiarEmpresa('distribuidora');
    expect(store.empresa).toBe('directa');
  });
  test('sin confirmar tasas hoy no se puede emitir', async () => {
    const { store } = await montar({ template: '<div/>' }, s => { s.tasas_actualizadas = '2020-01-01T12:00:00Z'; });
    expect(store.validarEmision()).toMatch(/confirmado hoy/);
  });
});
