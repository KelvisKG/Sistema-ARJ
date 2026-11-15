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
  guardarBitacoraEnSupabase: async () => {},
  cargarPreciosManuales: async () => ([
    { id: 1, cod: 'HF6510', desc: 'Filtro', cant: 2, cobrado: 44.94, lista: 50, dif: -10.12, tipo: 'dolar', monto: 40, quien: 'JJ', facturaId: 37, numero: 'VD-2026-00040', fecha: '15 nov 2026', fechaRaw: '2026-11-15', empresa: 'directa', cliente: 'CONSUMIDOR FINAL', anulada: false },
    { id: 3, cod: 'HF7000', desc: 'Correa', cant: 1, cobrado: 18, lista: 20, dif: -2, tipo: 'bcv', monto: 18, quien: 'JJ', facturaId: 37, numero: 'VD-2026-00040', fecha: '15 nov 2026', fechaRaw: '2026-11-15', empresa: 'directa', cliente: 'CONSUMIDOR FINAL', anulada: false },
    { id: 2, cod: 'HF6510', desc: 'Filtro', cant: 1, cobrado: 60, lista: 50, dif: 10, tipo: 'bcv', monto: 60, quien: 'Ana', facturaId: 38, numero: 'VD-2026-00041', fecha: '15 nov 2026', fechaRaw: '2026-11-15', empresa: 'directa', cliente: 'X', anulada: true }
  ]),
  refrescarTasaBcvBD: vi.fn(async () => ({ ok: true, cambio: true, tasa_bcv: 900.5, bcv_actualizada: '2026-11-15T12:00:00Z', bcv_fecha_valor: '2026-11-13' }))
}));

import { useArjStore } from '../src/stores/useArjStore.js';
import { mapFactura } from '../src/services/supabase.js';
import { fmtBCV, fmtDolar, fmtBsMonto, totalEnDivisas } from '../src/services/pricing.js';

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
  'DialogoModal.vue': s => { s.dialogo = { tipo: 'confirmar', titulo: 'T', mensaje: 'M', resolver() {} }; },
  'FacturaModal.vue': s => { s.facturaReciente = s.todasFacturas[0]; s.modalFacturaActivo = true; },
  'AnularFacturaModal.vue': s => { s.facturaAAnular = s.todasFacturas[0]; s.modalAnularActivo = true; },
  'TraspasoModal.vue': s => { s.modalTraspasoActivo = true; },
  'RecepcionModal.vue': s => { s.modalRecepcionActivo = true; },
  'EmbarquesModal.vue': s => { s.modalEmbarquesActivo = true; },
  'ComprasNacionalesModal.vue': s => { s.modalComprasActivo = true; },
  'EditProdModal.vue': s => { s.productoSeleccionado = s.productos[0]; s.modalEditProdActivo = true; },
  'DtoDivisaModal.vue': s => { s.modalDtoDivisaActivo = true; },
  'DtoManualModal.vue': s => { s.modalDtoManualActivo = true; },
  'NuevoClienteRapidoModal.vue': s => { s.modalNuevoClienteActivo = true; },
  'ListaPreciosModal.vue': s => { s.modalListaPreciosActivo = true; },
  'EmitirFacturaModal.vue': s => { s.modalEmitirActivo = true; },
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

describe('Referencia de moneda y modal de abono (CxC)', () => {
  const Cxc = () => vistas['../src/views/CuentasCobrarView.vue'].default;
  async function abrirAbono() {
    const r = await montar(Cxc());
    await r.w.find('.deuda-row .btn-primary').trigger('click');
    return r;
  }

  test('la lista y la vista de la factura rotulan cada monto', async () => {
    const { w, store } = await montar(Cxc());
    expect(w.find('.deuda-monto').text()).toBe('$40.00 BCV');
    const Factura = modales['../src/components/modals/FacturaModal.vue'].default;
    const f = store.todasFacturas[0];
    f.items = [{ id: 1, cod_alt: 'HF6510', desc: 'Filtro', cant: 1, precio: 100 }];
    f.pagos = [{ fecha: new Date().toISOString(), metodo: 'Efectivo USD', monto_usd: 50, monto_bs: 0 }];
    store.facturaReciente = f;
    store.modalFacturaActivo = true;
    const m = mount(Factura, { global: { plugins: [store.$pinia] } });
    await flushPromises();
    expect(m.text()).toContain('$100.00 BCV');
    expect(m.text()).toContain('$50.00 Dólar');
  });

  test('el pago en dólares muestra lo que se acredita y el saldo', async () => {
    const { w } = await abrirAbono();
    await w.find('.ab-monto input').setValue('10');
    const t = w.find('.ab-resumen').text();
    expect(t).toContain('$10.00 Dólar');
    expect(t).toContain('BCV');
  });

  test('el método en bolívares cambia la moneda y pide referencia', async () => {
    const { w } = await abrirAbono();
    await w.findAll('.ab-metodo').find(b => b.text().includes('Pago móvil')).trigger('click');
    expect(w.find('.ab-monto span').text()).toBe('Bs.');
    expect(w.find('.ab-oblig').exists()).toBe(true);
    expect(w.find('#modal-abono .me-opcion').exists()).toBe(false);
  });

  test('saldar con monto insuficiente avisa y no deja registrar', async () => {
    const { w } = await abrirAbono();
    await w.find('.ab-monto input').setValue('5');
    await w.find('input[value="saldar"]').setValue();
    expect(w.find('.ab-aviso').text()).toContain('para saldar');
    expect(w.findAll('#modal-abono .me-pie button').at(-1).attributes('disabled')).toBeDefined();
  });
});

describe('Descuento en Facturación', () => {
  const Fact = () => vistas['../src/views/FacturacionView.vue'].default;

  test('muestra el monto neto en dólar BCV, Dólar y bolívares', async () => {
    const { w, store } = await montar(Fact());
    expect(w.find('#t-descuento').exists()).toBe(false);
    store.aplicarDescuentoManual(10, 'Cliente frecuente');
    await flushPromises();
    const lista = store.subtotalCarrito;
    const neto = lista - store.totales.subtotal;
    const texto = w.find('#t-descuento').text();
    expect(neto).toBeGreaterThan(0);
    expect(texto).toContain('10.0%');
    expect(texto).toContain('−' + fmtBCV(neto));
    expect(texto).toContain('−' + fmtDolar(totalEnDivisas(lista, store.estadoTasas) - store.totales.totalUsdBase));
    expect(texto).toContain('−' + fmtBsMonto(neto * store.totales.factorBs * store.tasa_bcv));
  });
});

describe('Descuentos comunes', () => {
  async function abrir() {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useArjStore();
    poblar(store);
    const w = mount(modales['../src/components/modals/DtoManualModal.vue'].default, { global: { plugins: [pinia] } });
    store.modalDtoManualActivo = true;
    await flushPromises();
    return { w, store };
  }
  const chip = (w, t) => w.findAll('.me-chip').find(b => b.text() === t);

  test('un botón común aplica ese porcentaje con su motivo', async () => {
    const { w, store } = await abrir();
    await chip(w, '20%').trigger('click');
    expect(w.find('.me-monedas').text()).toContain('Descuento (20%)');
    await w.find('#dto-manual-motivo').setValue('Compra por volumen');
    await w.find('.me-pie .btn-primary').trigger('click');
    expect(store.carrito.descuento_manual).toBe(20);
  });

  test('"Otro" abre el campo libre', async () => {
    const { w } = await abrir();
    expect(w.find('#dto-manual-pct').exists()).toBe(false);
    await chip(w, 'Otro').trigger('click');
    await w.find('#dto-manual-pct').setValue(12);
    expect(w.find('.me-monedas').text()).toContain('Descuento (12%)');
  });

  test('sin elegir nada avisa y no aplica', async () => {
    const { w, store } = await abrir();
    await w.find('.me-pie .btn-primary').trigger('click');
    expect(w.find('.field-error').text()).toContain('Elige');
    expect(store.modalDtoManualActivo).toBe(true);
  });
});

describe('Emisión de la factura', () => {
  async function abrir(preparar) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useArjStore();
    poblar(store);
    if (preparar) preparar(store);
    store.modalEmitirActivo = true;
    const w = mount(modales['../src/components/modals/EmitirFacturaModal.vue'].default, { global: { plugins: [pinia] } });
    await flushPromises();
    return { w, store };
  }

  test('Facturación ya no tiene la casilla: la pregunta es la regla', async () => {
    const { w } = await montar(vistas['../src/views/FacturacionView.vue'].default);
    expect(w.find('#emitir-fiscal').exists()).toBe(false);
  });

  test('primero exige responder SÍ o NO; sin responder no se puede emitir', async () => {
    const { w, store } = await abrir(s => { s.carrito.pidio_fiscal = true; });
    expect(w.text()).toContain('¿El cliente pidió factura fiscal?');
    expect(w.find('.btn-green').exists()).toBe(false);
    await w.find('.me-respuesta.no').trigger('click');
    expect(store.carrito.pidio_fiscal).toBe(false);
    expect(w.text()).toContain('Confirmar factura');
  });

  test('SÍ queda en la factura y al confirmar se emite', async () => {
    const { w, store } = await abrir();
    const emitir = vi.spyOn(store, 'emitirFactura').mockResolvedValue({ ok: true });
    await w.find('.me-respuesta.si').trigger('click');
    expect(store.carrito.pidio_fiscal).toBe(true);
    expect(emitir).not.toHaveBeenCalled();
    await w.find('.btn-green').trigger('click');
    await flushPromises();
    expect(emitir).toHaveBeenCalledTimes(1);
    expect(store.modalEmitirActivo).toBe(false);
  });

  test('si el servidor rechaza, se queda abierto y muestra el motivo', async () => {
    const { w, store } = await abrir();
    vi.spyOn(store, 'emitirFactura').mockResolvedValue({ ok: false, error: 'Stock cerrado' });
    await w.find('.me-respuesta.no').trigger('click');
    await w.find('.btn-green').trigger('click');
    await flushPromises();
    expect(store.modalEmitirActivo).toBe(true);
    expect(w.find('.me-aviso.rojo').text()).toContain('Stock cerrado');
  });

  test('con motivo de bloqueo no pregunta nada', async () => {
    const { w } = await abrir(s => { s.emitirBloqueo = 'Selecciona un cliente'; });
    expect(w.text()).toContain('No se puede emitir');
    expect(w.find('.me-respuesta').exists()).toBe(false);
  });
});

describe('Diálogos propios (sin avisos del navegador)', () => {
  async function abrir() {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useArjStore();
    poblar(store);
    const w = mount(modales['../src/components/common/DialogoModal.vue'].default, { global: { plugins: [pinia] } });
    return { w, store };
  }

  test('el código ya no usa confirm, alert ni prompt del navegador', () => {
    const archivos = import.meta.glob('../src/**/*.{vue,js}', { eager: true, query: '?raw', import: 'default' });
    const usos = Object.entries(archivos).filter(([, t]) => /(^|[^.\w])(window\.)?(confirm|alert|prompt)\(/m.test(t)).map(([r]) => r);
    expect(usos).toEqual([]);
  });

  test('confirmar devuelve true al aceptar y false al cancelar', async () => {
    const { w, store } = await abrir();
    const si = store.confirmar({ titulo: 'Eliminar', mensaje: '¿Seguro?', ok: 'Eliminar', tono: 'rojo' });
    await flushPromises();
    expect(w.text()).toContain('¿Seguro?');
    await w.find('.me-pie .btn-red').trigger('click');
    expect(await si).toBe(true);
    const no = store.confirmar({ titulo: 'X', mensaje: 'Y' });
    await flushPromises();
    await w.find('.me-pie .btn-secondary').trigger('click');
    expect(await no).toBe(false);
    expect(store.dialogo).toBe(null);
  });

  test('pedirTexto exige texto y lo devuelve limpio', async () => {
    const { w, store } = await abrir();
    const r = store.pedirTexto({ titulo: 'Motivo', mensaje: 'x', etiqueta: 'Motivo' });
    await flushPromises();
    expect(w.find('.me-pie .btn-primary').attributes('disabled')).toBeDefined();
    await w.find('#dialogo-texto').setValue('  error de carga ');
    await w.find('.me-pie .btn-primary').trigger('click');
    expect(await r).toBe('error de carga');
  });

  test('Cancelar en Facturación pregunta y solo descarta si se confirma', async () => {
    const { w, store } = await montar(vistas['../src/views/FacturacionView.vue'].default);
    const antes = store.carrito.items.length;
    expect(antes).toBeGreaterThan(0);
    w.vm.$.setupState.cancelarFactura();
    await flushPromises();
    store.responderDialogo(null);
    await flushPromises();
    expect(store.carrito.items.length).toBe(antes);
    w.vm.$.setupState.cancelarFactura();
    await flushPromises();
    store.responderDialogo(true);
    await flushPromises();
    expect(store.carrito.items.length).toBe(0);
  });
});

describe('Inventario más limpio y compras nacionales', () => {
  const Inv = () => vistas['../src/views/InventarioView.vue'].default;
  const textos = w => w.findAll('#page-inventario button').map(b => b.text()).filter(Boolean);

  test('a la vista solo Nuevo producto; el resto está en el menú', async () => {
    const { w } = await montar(Inv());
    const botones = textos(w);
    expect(botones).toContain('Nuevo producto');
    for (const t of ['Embarques', 'Importar Excel', 'Lista de precios', 'Recepciones', 'Despachar a Directa']) expect(botones).not.toContain(t);
    await w.find('.inv-mas').trigger('click');
    const menu = w.findAll('.inv-menu-lista button').map(b => b.text());
    expect(menu).toEqual(expect.arrayContaining(['Embarques', 'Compras nacionales', 'Conteo / Recepción', 'Recepciones', 'Despachar a Directa', 'Notas de entrega', 'Importar Excel', 'Lista de precios']));
  });

  test('Compras nacionales se abre desde el menú y el menú se cierra', async () => {
    const { w, store } = await montar(Inv());
    await w.find('.inv-mas').trigger('click');
    await w.findAll('.inv-menu-lista button').find(b => b.text() === 'Compras nacionales').trigger('click');
    expect(store.modalComprasActivo).toBe(true);
    expect(w.find('.inv-menu-lista').exists()).toBe(false);
  });

  test('un vendedor no ve la barra', async () => {
    const { w } = await montar(Inv(), s => { s.rol = 'vendedor'; });
    expect(w.find('.inv-barra').exists()).toBe(false);
  });

  test('embarques y compras nacionales no se mezclan', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useArjStore();
    poblar(store);
    store.embarques.push({ id: 'n1', codigo: 'NAC-1', proveedor: 'LOCAL CA', factor: 1.05, fob_total: 1000, tipo: 'nacional' });
    store.modalEmbarquesActivo = true;
    store.modalComprasActivo = true;
    const opts = { global: { plugins: [pinia] } };
    const emb = mount(modales['../src/components/modals/EmbarquesModal.vue'].default, opts);
    const com = mount(modales['../src/components/modals/ComprasNacionalesModal.vue'].default, opts);
    await flushPromises();
    expect(emb.text()).not.toContain('NAC-1');
    expect(com.text()).toContain('NAC-1');
    expect(com.text()).not.toContain('PANEGOSSI-2026-01');
  });

  async function abrirCompras(preparar) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useArjStore();
    poblar(store);
    store.embarques.push({ id: 'n1', codigo: 'NAC-1', proveedor: 'FERRE CA', num_factura: 'F-77', factor: 1.05, fob_total: 1000, tipo: 'nacional' });
    if (preparar) preparar(store);
    store.modalComprasActivo = true;
    const w = mount(modales['../src/components/modals/ComprasNacionalesModal.vue'].default, { global: { plugins: [pinia] } });
    await flushPromises();
    return { w, store };
  }

  test('paso 1: valida, calcula el factor y crea la compra con su factura', async () => {
    const { w, store } = await abrirCompras();
    const guardar = vi.spyOn(store, 'guardarCompraNacional').mockResolvedValue({ id: 'n2' });
    await w.find('#cn-codigo').setValue('nac-9');
    await w.find('#cn-proveedor').setValue('ferre ca');
    await w.find('#cn-factura').setValue('a-123');
    await w.find('#cn-guardar').trigger('click');
    expect(guardar).not.toHaveBeenCalled();
    await w.find('#cn-monto').setValue('2000');
    await w.find('#cn-gastos').setValue('100');
    expect(w.text()).toContain('Factor: 1.0500');
    await w.find('#cn-guardar').trigger('click');
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'NAC-9', proveedor: 'FERRE CA', num_factura: 'A-123', monto: 2000, gastos: 100 }));
  });

  async function irALista(w) {
    await w.find('.cn-compra').trigger('click');
    await w.find('#cn-siguiente').trigger('click');
  }

  test('sin compra elegida no se avanza; al elegirla pide la lista como en Recepción', async () => {
    const { w } = await abrirCompras();
    expect(w.find('#cn-siguiente').attributes('disabled')).toBeDefined();
    await irALista(w);
    expect(w.text()).toContain('Factura F-77');
    expect(w.find('#cn-lista').exists()).toBe(true);
  });

  test('pegar, revisar y sumar: acumula códigos repetidos y avisa líneas malas', async () => {
    const { w, store } = await abrirCompras();
    const aplicar = vi.spyOn(store, 'aplicarRecepcion').mockResolvedValue({ numero: 'REC-2026-00009', renglones: 1, unidades: 5, sellados: 1, conflictos: [] });
    vi.spyOn(store, 'confirmar').mockResolvedValue(true);
    await irALista(w);
    await w.find('#cn-lista').setValue('HF6510\t4\nhf6510 1\nMALA 1,5');
    await w.find('#cn-revisar').trigger('click');
    const tabla = w.find('.cn-tabla').text();
    expect(tabla).toContain('HF6510');
    expect(tabla).toContain('+5');
    expect(w.find('.me-aviso.rojo').text()).toContain('Línea 3');
    await w.find('#cn-registrar').trigger('click');
    await flushPromises();
    expect(aplicar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'recepcion', embarqueId: 'n1', referencia: 'Factura F-77', items: [{ producto_id: 1, cantidad: 5 }] }));
    expect(w.text()).toContain('REC-2026-00009');
  });

  test('elegir una marca trae sus productos en 0; los que quedan en 0 no se tocan', async () => {
    const { w } = await abrirCompras(s => {
      s.productos.push({ id: 2, cod_alt: 'HF-200', desc: 'Filtro 2', marca: 'FLEETGUARD', fob: 2, stock_vd: 1, stock_dist: 0, activo: true });
    });
    await irALista(w);
    await w.find('#cn-marca').setValue('FLEETGUARD');
    const lista = w.find('#cn-lista').element.value;
    expect(lista).toContain('HF6510\t0');
    expect(lista).toContain('HF-200\t0');
    await w.find('#cn-marca').setValue('FLEETGUARD');
    expect(w.find('#cn-lista').element.value.split('\n')).toHaveLength(2);
    await w.find('#cn-lista').setValue(w.find('#cn-lista').element.value.replace('HF6510\t0', 'HF6510\t7'));
    await w.find('#cn-revisar').trigger('click');
    expect(w.find('.cn-tabla').text()).toContain('+7');
    expect(w.find('.cn-tabla').text()).not.toContain('HF-200');
    expect(w.text()).toContain('1 producto(s) quedaron en 0');
  });

  test('el botón Nuevo producto crea el producto y lo agrega al cuadro en 0', async () => {
    const { w, store } = await abrirCompras();
    await irALista(w);
    await w.find('#cn-nuevo-producto').trigger('click');
    expect(store.modalEditProdActivo).toBe(true);
    expect(store.productoSeleccionado).toMatchObject({ _nuevo: true, cod_alt: '', origen: 'local', factor_landed: 1.05, proveedor: 'FERRE CA' });
    store.productos = [...store.productos, { id: 77, cod_alt: 'MANG-34', desc: 'Manguera', stock_vd: 0, stock_dist: 0 }];
    await flushPromises();
    expect(w.find('#cn-lista').element.value).toContain('MANG-34	0');
  });

  test('un código que no existe se puede crear y vuelve a la revisión con su cantidad', async () => {
    const { w, store } = await abrirCompras();
    await irALista(w);
    await w.find('#cn-lista').setValue('NUEVO-1\t2');
    await w.find('#cn-revisar').trigger('click');
    expect(w.find('.cn-no-existe').text()).toContain('NUEVO-1');
    expect(w.find('#cn-registrar').attributes('disabled')).toBeDefined();
    await w.find('.cn-crear button').trigger('click');
    expect(store.modalEditProdActivo).toBe(true);
    expect(store.productoSeleccionado).toMatchObject({ _nuevo: true, cod_alt: 'NUEVO-1', origen: 'local', factor_landed: 1.05, proveedor: 'FERRE CA' });
    store.productos = [...store.productos, { id: 99, cod_alt: 'NUEVO-1', desc: 'Correa', stock_vd: 0, stock_dist: 0 }];
    await flushPromises();
    expect(w.find('.cn-tabla').text()).toContain('NUEVO-1');
    expect(w.find('.cn-tabla').text()).toContain('+2');
    expect(w.find('.cn-no-existe').exists()).toBe(false);
  });

  test('Conteo / Recepción ya no ofrece las compras nacionales', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useArjStore();
    poblar(store);
    store.embarques.push({ id: 'n1', codigo: 'NAC-1', proveedor: 'FERRE CA', factor: 1.05, tipo: 'nacional' });
    store.modalRecepcionActivo = true;
    const w = mount(modales['../src/components/modals/RecepcionModal.vue'].default, { global: { plugins: [pinia] } });
    await flushPromises();
    expect(w.findAll('option').map(o => o.text()).join(' ')).not.toContain('NAC-1');
  });
});

describe('Facturación adaptada', () => {
  const Fact = () => vistas['../src/views/FacturacionView.vue'].default;

  test('la fila reúne código, marca, stock y descripción', async () => {
    const { w } = await montar(Fact());
    const celda = w.find('#items-body tr td');
    expect(celda.text()).toContain('HF6510');
    expect(celda.text()).toContain('Stock 5');
    expect(celda.text()).toContain('Filtro hidráulico');
  });

  test('las columnas cuadran para gerente y vendedor', async () => {
    const g = await montar(Fact());
    expect(g.w.findAll('#tbl-items thead th')).toHaveLength(6);
    const v = await montar(Fact(), s => { s.rol = 'vendedor'; });
    expect(v.w.findAll('#tbl-items thead th')).toHaveLength(5);
  });
});

describe('Tasa BCV automática', () => {
  test('aplica la tasa que trae el servidor y recalcula el efectivo del carrito', async () => {
    const { store } = await montar(vistas['../src/views/FacturacionView.vue'].default);
    const verdeAntes = store.carrito.items[0].precio_verde;
    expect(await store.refrescarTasaBcv()).toBe(true);
    expect(store.tasa_bcv).toBe(900.5);
    expect(store.bcv_fecha_valor).toBe('2026-11-13');
    expect(store.carrito.items[0].precio_verde).not.toBe(verdeAntes);
    expect(store.toast.mensaje).toContain('Tasa BCV actualizada');
  });

  test('el paralelo sigue siendo manual: la BCV automática no confirma el día', async () => {
    const { store } = await montar(vistas['../src/views/FacturacionView.vue'].default, s => { s.tasas_actualizadas = null; });
    await store.refrescarTasaBcv();
    expect(store.tasasConfirmadasHoy).toBe(false);
  });

  test('Alertas y Turnos/Caja están desactivados', async () => {
    const { w, store } = await montar(modales['../src/components/common/HeaderNav.vue'].default);
    const nav = w.find('#nav').text();
    expect(nav).not.toContain('Alertas');
    expect(nav).not.toContain('Turnos');
    store.cambiarVista('turnos');
    store.cambiarVista('alertas');
    expect(store.vistaActiva).not.toBe('turnos');
    expect(store.vistaActiva).not.toBe('alertas');
  });
});

describe('USDT en abonos', () => {
  test('aparece como pago en dólares y pide referencia', async () => {
    const { w } = await montar(vistas['../src/views/CuentasCobrarView.vue'].default);
    await w.find('.deuda-row .btn-primary').trigger('click');
    const usdt = w.findAll('.ab-metodo').find(b => b.text().includes('USDT'));
    expect(usdt).toBeTruthy();
    await usdt.trigger('click');
    expect(w.find('.ab-monto span').text()).toBe('$');
    expect(w.find('.ab-oblig').exists()).toBe(true);
  });
});

describe('Historial → Precios manuales', () => {
  test('el carrito manda el cambio manual de cada renglón al emitir', async () => {
    const { store } = await montar(vistas['../src/views/FacturacionView.vue'].default);
    store.cambiarPrecioVerdeItem(0, 40);
    expect(store.carrito.items[0].ajuste).toEqual({ tipo: 'dolar', monto: 40 });
    store.cambiarPrecioBcvItem(0, 55);
    expect(store.carrito.items[0].ajuste).toEqual({ tipo: 'bcv', monto: 55 });
  });

  test('solo el gerente ve la pestaña; muestra lista, cobrado, diferencia y quién', async () => {
    const v = await montar(vistas['../src/views/HistorialView.vue'].default, s => { s.rol = 'vendedor'; });
    expect(v.w.text()).not.toContain('Precios manuales');
    const { w, store } = await montar(vistas['../src/views/HistorialView.vue'].default);
    await w.findAll('.btn-toggle').find(b => b.text() === 'Precios manuales').trigger('click');
    await flushPromises();
    // Una fila por factura: la 00040 junta sus dos productos cambiados
    const filas = w.findAll('#precios-manuales tbody tr');
    expect(filas).toHaveLength(2);
    const f40 = filas.find(f => f.text().includes('VD-2026-00040')).text();
    expect(f40).toContain('2 producto(s)');
    expect(f40).toContain('HF6510, HF7000');
    expect(f40).toContain('escritos en $ · escritos en dólar BCV');
    expect(f40).toContain('−$12.12 BCV');
    expect(w.find('#precios-manuales').text()).toContain('Anulada');
    // La anulada se ve pero no suma
    expect(w.find('#precios-manuales .kpi-card.blue .kpi-val').text()).toBe('2');
    expect(w.find('#precios-manuales .kpi-card.red .kpi-val').text()).toBe('$12.12 BCV');
    expect(w.find('#precios-manuales .kpi-card.green .kpi-val').text()).toBe('$0.00 BCV');
    // Clic en la fila abre la factura
    await filas.find(f => f.text().includes('VD-2026-00040')).trigger('click');
    await flushPromises();
    expect(store.modalFacturaActivo).toBe(true);
    expect(store.facturaReciente.id).toBe(37);
  });
});

describe('Vista de la factura: precio manual', () => {
  test('cada renglón cambiado a mano muestra la lista y cómo se escribió', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useArjStore();
    poblar(store);
    const f = store.todasFacturas[0];
    f.items = [
      { id: 1, cod_alt: 'HF6510', desc: 'Filtro', cant: 1, precio: 22.47, precio_lista: 25.25, ajuste: { tipo: 'dolar', monto: 20, quien: 'Kelvis' } },
      { id: 2, cod_alt: 'HF7000', desc: 'Otro', cant: 1, precio: 30 }
    ];
    f.pagos = [{ fecha: new Date().toISOString(), metodo: 'Efectivo USD', monto_usd: 1, monto_bs: 0 }];
    store.facturaReciente = f;
    store.modalFacturaActivo = true;
    const w = mount(modales['../src/components/modals/FacturaModal.vue'].default, { global: { plugins: [pinia] } });
    await flushPromises();
    const notas = w.findAll('.fm-ajuste');
    expect(notas).toHaveLength(1);
    expect(notas[0].text()).toBe('Precio manual: lista $25.25 BCV · escrito como $20.00 Dólar · Kelvis');
  });
});
