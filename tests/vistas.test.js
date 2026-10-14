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
  cargarVentasPeriodo: async () => ({ fmap: {}, its: [], nFacts: 0 }),
  cargarCobradoMes: async () => ({ total: 0, cuenta: 0 }),
  cargarRecepciones: async () => [],
  cargarRenglonesNotaCredito: async () => ({ items: [{ producto_id: 1, cod_alt: 'HF6510', descripcion: 'Filtro', cantidad: 2, precio_unitario: '13' }], yaDev: {} }),
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
  'RecepcionesModal.vue': s => { s.modalRecepcionesActivo = true; },
  'NotaCreditoModal.vue': s => { s.facturaNC = s.todasFacturas[0]; s.modalNotaCreditoActivo = true; },
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

describe('detalle de factura (v13.39)', () => {
  test('marca cada renglón como importado o local y muestra la mezcla', async () => {
    const mod = modales['../src/components/modals/FacturaModal.vue'];
    const { w } = await montar(mod.default, s => {
      const f = s.todasFacturas[0];
      f.items = [
        { id: 1, cod_alt: 'HF6510', desc: 'Filtro', cant: 4, precio: 20, total_linea: 80, origen: 'importado' },
        { id: 2, cod_alt: 'X1', desc: 'Rótula', cant: 1, precio: 20, total_linea: 20, origen: '', factor_landed: 1 }
      ];
      f.pagos = [{ fecha: new Date().toISOString(), monto_usd: 60, metodo: 'Efectivo USD' }];
      s.facturaReciente = f;
      s.modalFacturaActivo = true;
    });
    const t = w.text();
    expect(t).toContain('IMP');
    expect(t).toContain('LOC?');
    expect(t).toContain('(80.0%)');
    expect(t).toContain('(20.0%)');
    expect(filtrarAvisos()).toEqual([]);
  });
});

describe('clic en la fila abre su ventana (como el monolito)', () => {
  test('Historial: la fila abre la factura; "Anular" no la abre', async () => {
    const { w, store } = await montar(vistas['../src/views/HistorialView.vue'].default);
    await w.find('tr.fila-abre').trigger('click');
    expect(store.modalFacturaActivo).toBe(true);
    expect(store.facturaReciente.num).toBe('VD-2026-00032');
    store.modalFacturaActivo = false;
    await w.find('tr.fila-abre button').trigger('click');
    expect(store.modalAnularActivo).toBe(true);
    expect(store.modalFacturaActivo).toBe(false);
  });
  test('Presupuestos: la fila abre la vista previa; "Facturar" no la abre', async () => {
    const { w, store } = await montar(vistas['../src/views/PresupuestosView.vue'].default);
    await w.find('tr.fila-abre').trigger('click');
    expect(store.modalPresupuestoActivo).toBe(true);
    store.modalPresupuestoActivo = false;
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await w.find('tr.fila-abre button').trigger('click');
    expect(store.modalPresupuestoActivo).toBe(false);
  });
  test('Clientes: la fila abre la ficha y su factura pendiente abre la factura', async () => {
    const { w, store } = await montar(vistas['../src/views/ClientesView.vue'].default);
    await w.find('tr.fila-abre').trigger('click');
    expect(w.find('#modal-detalle-cliente').exists()).toBe(true);
    const filas = w.findAll('#modal-detalle-cliente tr.fila-abre');
    if (filas.length) {
      await filas[0].trigger('click');
      expect(store.modalFacturaActivo).toBe(true);
    }
  });
  test('Cuentas por Cobrar: la fila abre la factura; "Abonar" abre el abono', async () => {
    const { w, store } = await montar(vistas['../src/views/CuentasCobrarView.vue'].default);
    await w.find('.deuda-row').trigger('click');
    expect(store.modalFacturaActivo).toBe(true);
    store.modalFacturaActivo = false;
    await w.find('.deuda-row .btn-primary').trigger('click');
    expect(store.modalFacturaActivo).toBe(false);
    expect(w.find('#modal-abono').exists()).toBe(true);
  });
});

describe('Perfil distribuidora', () => {
  const productos = [
    { id: 1, cod_alt: 'IMP1', origen: 'importado' },
    { id: 2, cod_alt: 'LOC1', origen: 'local' }
  ];
  // propietario: NULL = de ARJ, uuid = de una distribuidora (sql/11)
  const filas = [{ id: 1, propietario: 'd1' }, { id: 2, propietario: null }, { id: 3, propietario: 'd2' }];
  const perfilDist = { id: 'd1', rol: 'vendedor', empresa: 'dist', nombre_display: 'Agro Sur', es_distribuidora: true };

  test('la distribuidora solo ve importados y lo suyo, y queda fija en Distribuidora', () => {
    setActivePinia(createPinia());
    const store = useArjStore();
    store._aplicarPerfil({ ...perfilDist, empresa: 'ambas' });
    expect(store.esPerfilDistribuidora).toBe(true);
    expect(store.empresa).toBe('distribuidora');
    expect(store.puedeCambiarEmpresa).toBe(false);
    expect(store._productosDelPerfil(productos).map(p => p.cod_alt)).toEqual(['IMP1']);
    expect(store._delPerfil(filas).map(f => f.id)).toEqual([1]);
  });

  test('un vendedor de ARJ en Distribuidora y el gerente no se filtran', () => {
    setActivePinia(createPinia());
    const store = useArjStore();
    store._aplicarPerfil({ id: 'v1', rol: 'vendedor', empresa: 'dist', nombre_display: 'Pedro' });
    expect(store.esPerfilDistribuidora).toBe(false);
    expect(store._productosDelPerfil(productos)).toHaveLength(2);
    expect(store._delPerfil(filas)).toHaveLength(3);
    store._aplicarPerfil({ ...perfilDist, rol: 'gerente' });
    expect(store.esPerfilDistribuidora).toBe(false);
  });

  test('intentar abrir una sección de gerente deja alerta en la bitácora', () => {
    setActivePinia(createPinia());
    const store = useArjStore();
    store._aplicarPerfil(perfilDist);
    store.cambiarVista('reportes');
    expect(store.vistaActiva).not.toBe('reportes');
    expect(store.bitacora[0]).toMatchObject({ tipo: 'seguridad', esAlerta: true });
  });
});

describe('Origen de productos sin origen declarado', () => {
  test('factor 1,000 = local (como el servidor): la distribuidora no lo ve', async () => {
    const { mapProducto } = await import('../src/services/supabase.js');
    const local = mapProducto({ id: 9, cod_alt: 'L9', descripcion: 'Filtro local', origen: null, factor_landed: '1.000' });
    const imp = mapProducto({ id: 8, cod_alt: 'I8', descripcion: 'Filtro importado', origen: null, factor_landed: '1.471' });
    expect(local.origen).toBe('local');
    expect(imp.origen).toBe('importado');
    setActivePinia(createPinia());
    const store = useArjStore();
    store._aplicarPerfil({ id: 'd1', rol: 'vendedor', empresa: 'dist', nombre_display: 'Agro Sur', es_distribuidora: true });
    expect(store._productosDelPerfil([local, imp]).map(p => p.cod_alt)).toEqual(['I8']);
  });
});

describe('Carrito del perfil distribuidora', () => {
  test('no deja agregar productos locales (sí importados)', () => {
    setActivePinia(createPinia());
    const store = useArjStore();
    store._aplicarPerfil({ id: 'd1', rol: 'vendedor', empresa: 'dist', nombre_display: 'Agro Sur', es_distribuidora: true });
    store.agregarAlCarrito({ id: 1, cod_alt: 'LOC1', desc: 'Local', fob: 5, origen: 'local', factor_landed: 1, stock_dist: 3 });
    expect(store.carrito.items).toHaveLength(0);
    expect(store.toast).toMatchObject({ tipo: 'error' });
    store.agregarAlCarrito({ id: 2, cod_alt: 'IMP1', desc: 'Importado', fob: 5, origen: 'importado', factor_landed: 1.471, stock_dist: 3 });
    expect(store.carrito.items.map(i => i.cod_alt)).toEqual(['IMP1']);
  });
});
