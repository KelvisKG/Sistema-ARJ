// =====================================================================
// ARJ - Capa de datos Supabase (Vue 3 / ES Module)
//
// Toda escritura que toca más de una tabla pasa por una función atómica de
// Postgres (sql/02_correcciones_auditoria.sql). Esas funciones validan en el
// servidor el perfil, el rol y la empresa del usuario. Aquí no hay caminos
// alternos "no atómicos": si la función falla, se informa el error real.
// =====================================================================
import { createClient } from '@supabase/supabase-js';
import { FACTOR_LANDED_FALLBACK } from './pricing.js';
import { encolarAccion } from './syncQueue.js';

export const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || '';
export const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_KEY || '';
export const SUPABASE_CONFIGURADO = !!(SUPABASE_URL && SUPABASE_KEY);

if (!SUPABASE_CONFIGURADO) {
  // A-12: sin fallback a credenciales escritas en el código
  console.error('[ARJ] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_KEY en el .env. El sistema no puede conectarse.');
}

export const supabase = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_KEY || 'sin-clave', {
  auth: { persistSession: true, autoRefreshToken: true }
});

const fechaCorta = d => new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
const enLinea = () => typeof navigator === 'undefined' || navigator.onLine !== false;

// Llama una función atómica y normaliza la respuesta a { ok, error, ...datos }
async function rpc(nombre, args) {
  if (!enLinea()) return { ok: false, error: 'Sin conexión a internet. No se guardó nada.' };
  try {
    const { data, error } = await supabase.rpc(nombre, args);
    if (error) {
      const faltaFuncion = error.code === 'PGRST202' || /could not find the function/i.test(error.message || '');
      return {
        ok: false,
        error: faltaFuncion
          ? `La base de datos no tiene la función "${nombre}". Hay que aplicar sql/02_correcciones_auditoria.sql en Supabase.`
          : error.message
      };
    }
    if (!data || data.ok !== true) {
      return { ok: false, error: limpiarError(data && data.error) || 'La base de datos rechazó la operación' };
    }
    return data;
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

function limpiarError(msg) {
  return (msg || '').replace(/^ARJ:\s*/, '');
}

// ═══════════════════════════════════════════════════════════════
// SESIÓN Y PERFIL (C-05, C-06)
// ═══════════════════════════════════════════════════════════════

// Devuelve { ok, perfil } solo si hay sesión real de Supabase Y perfil activo.
export async function obtenerPerfilSesion() {
  if (!SUPABASE_CONFIGURADO) return { ok: false, error: 'Sistema sin configurar (.env)' };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) return { ok: false };
  return cargarPerfil(session.user.id);
}

export async function cargarPerfil(userId) {
  const { data: perfil, error } = await supabase.from('perfiles').select('*').eq('id', userId).maybeSingle();
  if (error || !perfil) {
    await supabase.auth.signOut().catch(() => {});
    return { ok: false, error: 'Tu usuario no tiene un perfil asignado. Pide al gerente que lo active.' };
  }
  if (perfil.activo === false) {
    await supabase.auth.signOut().catch(() => {});
    return { ok: false, error: 'Tu cuenta está desactivada o pendiente de aprobación.' };
  }
  return { ok: true, perfil };
}

export async function iniciarSesion(email, password) {
  if (!SUPABASE_CONFIGURADO) return { ok: false, error: 'Sistema sin configurar: falta el archivo .env' };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: 'Email o contraseña incorrectos.' };
  return cargarPerfil(data.user.id);
}

export async function cerrarSesion() {
  try { await supabase.auth.signOut(); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
// MAPEOS
// ═══════════════════════════════════════════════════════════════
export function mapProducto(p) {
  return {
    id: p.id,
    cod_alt: p.cod_alt,
    cod_orig: p.cod_orig || '',
    cod_barras: p.cod_barras || '',
    desc: p.descripcion,
    marca: p.marca || '',
    fob: parseFloat(p.fob) || 0,
    stock_vd: p.stock_vd || 0,
    stock_dist: p.stock_dist || 0,
    marca_modelo: p.marca_modelo || '',
    sistema: p.sistema || '',
    precio_manual: p.precio_manual != null && parseFloat(p.precio_manual) > 0 ? parseFloat(p.precio_manual) : null,
    imagen_url: p.imagen_url || '',
    origen: p.origen || 'importado',
    factor_landed: p.factor_landed != null ? parseFloat(p.factor_landed) : FACTOR_LANDED_FALLBACK,
    proveedor: p.proveedor || '',
    embarque_id: p.embarque_id || null,
    activo: p.activo !== false
  };
}

export function mapCliente(c, cts = []) {
  const principal = cts.find(x => x.es_principal) || cts[0] || null;
  // M-11: el principal nunca se repite en "adicionales"
  const adicionales = cts.filter(x => !principal || x.id !== principal.id);
  return {
    id: c.id,
    nombre: c.nombre,
    rif: c.rif || '',
    nivel: c.nivel || 'Publico', // M-02: por defecto precio público, como el monolito
    tipo: c.tipo_pago || 'contado',
    saldo_vd: parseFloat(c.saldo_vd) || 0,
    saldo_dist: parseFloat(c.saldo_dist) || 0,
    tel: c.telefono || '',
    empresa: c.empresa || 'ambas',
    origen: c.origen || '',
    como_consiguio: c.origen || '',
    origen_detalle: c.origen_detalle || '',
    direccion: c.direccion || '',
    notas: c.notas || '',
    contacto_principal: principal
      ? { id: principal.id, nombre: principal.nombre, cargo: principal.cargo || '', tel: principal.telefono || '' }
      : { nombre: '—', cargo: '—', tel: '' },
    contactos_adicionales: adicionales.map(a => ({ nombre: a.nombre, cargo: a.cargo || '', tel: a.telefono || '' }))
  };
}

export function mapFactura(f) {
  const ahora = new Date();
  const fechaVence = f.fecha_vence ? new Date(f.fecha_vence) : null;
  const diasVence = fechaVence ? Math.ceil((fechaVence - ahora) / 86400000) : null;
  let est = f.estado;
  if ((est === 'pendiente' || est === 'parcial') && fechaVence && fechaVence < ahora) est = 'vencida';
  const total = parseFloat(f.subtotal_usd) || 0;
  const saldo = parseFloat(f.saldo_pendiente) || 0;
  return {
    id: f.id, num: f.numero, empresa: f.empresa, cliente: f.cliente_nombre,
    cliente_id: f.cliente_id, vendedor: f.vendedor,
    fecha: fechaCorta(f.fecha),
    fecha_raw: f.fecha,
    vence: fechaVence ? fechaCorta(fechaVence) : '',
    total,
    abonado: Math.max(0, total - saldo),
    saldo_pendiente: saldo,
    estado: est,
    estado_bd: f.estado,
    dias: diasVence,
    dias_credito: f.dias_credito || 0,
    tipo_pago: f.tipo_pago,
    tasa_par: parseFloat(f.tasa_par) || 0,
    tasa_bcv: parseFloat(f.tasa_bcv) || 0,
    factor_bs: f.factor_bs != null ? parseFloat(f.factor_bs) : null,
    cliente_nombre_snap: f.cliente_nombre_snap || null,
    cliente_rif_snap: f.cliente_rif_snap || null,
    cliente_tel_snap: f.cliente_tel_snap || null,
    cliente_dir_snap: f.cliente_dir_snap || null,
    descuento_manual: parseFloat(f.descuento_manual) || 0,
    motivo_descuento: f.motivo_descuento || '',
    cobrar_verde: f.cobrar_verde != null ? parseFloat(f.cobrar_verde) : null,
    pidio_fiscal: !!f.pidio_fiscal,
    motivo_anulacion: f.motivo_anulacion || '',
    fecha_anulacion: f.fecha_anulacion || null
  };
}

function mapCotizacion(c, items) {
  const vence = new Date(c.fecha_vence);
  const diasRest = Math.ceil((vence - new Date()) / 86400000);
  let est = c.estado;
  if (est === 'activa' && diasRest < 0) est = 'vencida';
  else if (est === 'activa' && diasRest <= 5) est = 'por_vencer';
  return {
    id: c.id, num: c.numero, empresa: c.empresa, cliente: c.cliente_nombre,
    cliente_id: c.cliente_id || null,
    fecha: fechaCorta(c.fecha),
    fecha_raw: c.fecha,
    vence: fechaCorta(vence),
    total: parseFloat(c.subtotal_usd) || 0, estado: est, estado_bd: c.estado, dias_restantes: diasRest,
    items_count: items.length, items, vendedor: c.vendedor,
    tasa_bcv: parseFloat(c.tasa_bcv) || 0
  };
}

function mapConfiguracion(cfg) {
  return {
    tasa_par: parseFloat(cfg.tasa_par) || 0,
    tasa_bcv: parseFloat(cfg.tasa_bcv) || 0,
    tasas_actualizadas: cfg.tasas_actualizadas || null,
    factor_default: parseFloat(cfg.factor_landed_default) || FACTOR_LANDED_FALLBACK,
    costos_fijos_mes: parseFloat(cfg.costos_fijos_mes) || 0,
    costos_fijos_hist: (cfg.costos_fijos_hist && typeof cfg.costos_fijos_hist === 'object') ? cfg.costos_fijos_hist : {},
    equipo: Array.isArray(cfg.equipo) ? cfg.equipo : [],
    metas_hist: (cfg.metas_hist && typeof cfg.metas_hist === 'object') ? cfg.metas_hist : {}
  };
}

// ═══════════════════════════════════════════════════════════════
// CARGA INICIAL
// ═══════════════════════════════════════════════════════════════
// `ids` opcional: solo esas filas (recarga puntual tras una operación)
export async function cargarProductos(ids) {
  let q = supabase.from('productos').select('*').eq('activo', true).order('cod_alt');
  if (ids && ids.length) q = q.in('id', ids);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapProducto);
}

export async function cargarClientes(ids) {
  let qc = supabase.from('clientes').select('*').eq('activo', true).order('nombre');
  let qk = supabase.from('contactos_cliente').select('*');
  if (ids && ids.length) { qc = qc.in('id', ids); qk = qk.in('cliente_id', ids); }
  const { data: clis, error } = await qc;
  if (error) throw error;
  const { data: contactos } = await qk;
  const porCliente = {};
  (contactos || []).forEach(c => { (porCliente[c.cliente_id] = porCliente[c.cliente_id] || []).push(c); });
  return (clis || []).map(c => mapCliente(c, porCliente[c.id] || []));
}

export async function cargarConfiguracion() {
  const { data, error } = await supabase.from('configuracion').select('*').order('id').limit(1).maybeSingle();
  if (error) throw error;
  return data ? mapConfiguracion(data) : null;
}

export async function cargarEmbarques() {
  const { data, error } = await supabase.from('embarques').select('*').eq('activo', true).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function cargarCotizaciones() {
  const { data: cots, error } = await supabase.from('cotizaciones').select('*').order('fecha', { ascending: false }).limit(100);
  if (error) throw error;
  const ids = (cots || []).map(c => c.id);
  const itemsPorCot = {};
  if (ids.length) {
    const { data: cits } = await supabase.from('cotizacion_items').select('*').in('cotizacion_id', ids);
    (cits || []).forEach(ci => {
      (itemsPorCot[ci.cotizacion_id] = itemsPorCot[ci.cotizacion_id] || []).push({
        id: ci.producto_id,
        cod_alt: ci.cod_alt || '',
        desc: ci.descripcion || '',
        cant: ci.cantidad || 0,
        precio: parseFloat(ci.precio_unitario) || 0,
        fob: parseFloat(ci.fob_unitario) || 0,
        tier: ci.tier || 'Publico'
      });
    });
  }
  return (cots || []).map(c => mapCotizacion(c, itemsPorCot[c.id] || []));
}

// Últimas N facturas + TODAS las que tienen saldo (para que CxC nunca pierda
// una deuda vieja que quedó fuera de las últimas 500)
export async function cargarFacturasRecientes(limite = 500) {
  const [rec, pend] = await Promise.all([
    supabase.from('facturas').select('*').order('fecha', { ascending: false }).limit(limite),
    supabase.from('facturas').select('*').in('estado', ['pendiente', 'parcial', 'vencida']).gt('saldo_pendiente', 0)
  ]);
  if (rec.error) throw rec.error;
  if (pend.error) throw pend.error;
  const vistos = new Set();
  const todas = [];
  [...(rec.data || []), ...(pend.data || [])].forEach(f => {
    if (vistos.has(f.id)) return;
    vistos.add(f.id);
    todas.push(f);
  });
  todas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return todas.map(mapFactura);
}

// Facturas por rango de fechas (exportación fiscal: sin el límite de 500)
export async function cargarFacturasRango(desdeISO, hastaISO) {
  const todas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from('facturas').select('*')
      .gte('fecha', desdeISO).lt('fecha', hastaISO)
      .order('fecha', { ascending: true }).range(desde, desde + 999);
    if (error) throw error;
    todas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return todas.map(mapFactura);
}

/**
 * Carga todo lo necesario para operar. M-09: si la base devuelve 0 productos
 * o 0 clientes se trata como error (no se opera con un catálogo vacío).
 */
export async function cargarDatosCompletos() {
  const r = { conectado: false, error: null };
  try {
    const [config, productos, clientes, facturas, cotizaciones, embarques] = await Promise.all([
      cargarConfiguracion(), cargarProductos(), cargarClientes(), cargarFacturasRecientes(),
      cargarCotizaciones(), cargarEmbarques()
    ]);
    if (!productos.length) throw new Error('La base de datos devolvió 0 productos activos');
    if (!clientes.length) throw new Error('La base de datos devolvió 0 clientes activos');

    r.configuracion = config;
    r.productos = productos;
    r.clientes = clientes;
    r.todasFacturas = facturas;
    r.presupuestos = cotizaciones;
    r.embarques = embarques;

    const { data: sists } = await supabase.from('sistemas').select('*').order('orden');
    r.sistemas = (sists || []).map(s => s.nombre);

    const { data: logs } = await supabase.from('bitacora').select('*').order('fecha', { ascending: false }).limit(100);
    r.bitacora = (logs || []).map(l => ({
      id: l.id,
      fecha: new Date(l.fecha).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      fecha_completa: new Date(l.fecha).toLocaleDateString('es-VE') + ' ' + new Date(l.fecha).toLocaleTimeString('es-VE'),
      tipo: l.accion || 'sistema',
      usuario: l.usuario || 'Sistema',
      empresa: l.empresa || 'directa',
      mensaje: l.descripcion || '',
      esAlerta: !!l.critico
    }));
    r.conectado = true;
  } catch (err) {
    console.error('[ARJ] Error cargando datos:', err);
    r.error = err.message || String(err);
  }
  return r;
}

// ═══════════════════════════════════════════════════════════════
// FACTURACIÓN Y COBROS (funciones atómicas)
// ═══════════════════════════════════════════════════════════════
export const emitirFacturaBD = (factura, items, pagos) =>
  rpc('emitir_factura_atomica', { p_factura: factura, p_items: items, p_pagos: pagos });

export const anularFacturaBD = (facturaId, motivo) =>
  rpc('anular_factura_atomica', { p_factura_id: facturaId, p_motivo: motivo });

export const registrarAbonoBD = (facturaId, acreditaUSD, pago) =>
  rpc('registrar_abono_atomico', { p_factura_id: facturaId, p_acredita: acreditaUSD, p_pago: pago });

export async function cargarFactura(id) {
  const { data, error } = await supabase.from('facturas').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapFactura(data);
}

// Renglones y pagos de una factura, bajo demanda
export async function cargarDetallesFactura(facturaId) {
  if (!enLinea()) return { items: null, pagos: null };
  try {
    const [iRes, pRes] = await Promise.all([
      supabase.from('factura_items').select('*').eq('factura_id', facturaId),
      supabase.from('pagos').select('*').eq('factura_id', facturaId).order('fecha')
    ]);
    const items = (iRes.data || []).map(it => ({
      id: it.producto_id,
      cod_alt: it.cod_alt || '',
      desc: it.descripcion || '',
      cant: it.cantidad || 0,
      precio: parseFloat(it.precio_unitario) || 0,
      total_linea: parseFloat(it.total_linea) || 0
    }));
    return { items, pagos: pRes.data || [] };
  } catch (e) {
    console.error('[ARJ] Error cargando detalles:', e);
    return { items: null, pagos: null };
  }
}

// Pagos en efectivo registrados por un usuario desde una fecha (cuadre de turno)
// Excluye los cobros de facturas que luego se anularon (ese efectivo se devolvió)
export async function cargarPagosDesde(desdeISO, usuario) {
  let q = supabase.from('pagos').select('monto_usd, monto_bs, metodo, fecha, registrado_por, facturas!inner(estado)')
    .gte('fecha', desdeISO).neq('facturas.estado', 'anulada');
  if (usuario) q = q.eq('registrado_por', usuario);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ═══════════════════════════════════════════════════════════════
// TASAS Y CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════
export const confirmarTasasBD = (bcv, par) => rpc('confirmar_tasas', { p_bcv: bcv, p_par: par });
export const actualizarConfiguracionBD = campos => rpc('actualizar_configuracion', { p: campos });

export async function cargarPerfiles() {
  const { data, error } = await supabase.from('perfiles').select('*').order('nombre_display');
  if (error) throw error;
  return data || [];
}

// ═══════════════════════════════════════════════════════════════
// CLIENTES (C-02)
// ═══════════════════════════════════════════════════════════════
export async function crearClienteBD(cli) {
  const res = await rpc('crear_cliente', {
    p_cliente: {
      nombre: cli.nombre, rif: cli.rif || '', nivel: cli.nivel || 'Publico', tipo_pago: cli.tipo || 'contado',
      telefono: cli.tel || '', empresa: cli.empresa || 'ambas', direccion: cli.direccion || '',
      notas: cli.notas || '', origen: cli.origen || '', origen_detalle: cli.origen_detalle || ''
    },
    p_contacto: cli.contacto_principal
      ? { nombre: cli.contacto_principal.nombre, cargo: cli.contacto_principal.cargo, telefono: cli.contacto_principal.tel || cli.tel || '' }
      : null
  });
  if (!res.ok) return res;
  const contacto = cli.contacto_principal && cli.contacto_principal.nombre && cli.contacto_principal.nombre !== '—'
    ? [{ id: 0, nombre: cli.contacto_principal.nombre, cargo: cli.contacto_principal.cargo, telefono: cli.contacto_principal.tel || cli.tel, es_principal: true }]
    : [];
  return { ok: true, cliente: mapCliente(res.data, contacto) };
}

// Edición vía función del servidor (sql/06): valida que solo el gerente cambie
// el nivel de precio y actualiza el contacto principal en la misma operación
export const actualizarClienteBD = (clienteId, d) => rpc('actualizar_cliente', {
  p_id: clienteId,
  p: {
    nombre: d.nombre, rif: d.rif || '', telefono: d.tel || '', direccion: d.direccion || '',
    nivel: d.nivel || 'Publico', tipo_pago: d.tipo || 'contado', origen: d.origen || '',
    origen_detalle: d.origen_detalle || '', notas: d.notas || '',
    contacto: d.contacto_principal
      ? { nombre: d.contacto_principal.nombre, cargo: d.contacto_principal.cargo || '', telefono: d.contacto_principal.tel || d.tel || '' }
      : null
  }
});

// ═══════════════════════════════════════════════════════════════
// INVENTARIO (C-01)
// ═══════════════════════════════════════════════════════════════
export const guardarProductoBD = p => rpc('guardar_producto', { p });
export const desactivarProductoBD = id => rpc('desactivar_producto', { p_id: id });
export const aplicarTraspasoBD = (items, referencia) => rpc('aplicar_traspaso', { p_items: items, p_referencia: referencia || null });
export const aplicarRecepcionBD = ({ tipo, destino, embarqueId, referencia, items, noContados }) =>
  rpc('aplicar_recepcion', {
    p_tipo: tipo, p_destino: destino, p_embarque_id: embarqueId || null,
    p_referencia: referencia || null, p_items: items, p_no_contados: noContados || []
  });
export const guardarEmbarqueBD = e => rpc('guardar_embarque', { p: e });
export const recalcularEmbarqueBD = id => rpc('recalcular_embarque', { p_id: id });

export async function cargarNotasEntrega(limite = 100) {
  const { data, error } = await supabase.from('traspasos').select('*').order('fecha', { ascending: false }).limit(limite);
  if (error) throw error;
  return data || [];
}
export async function cargarItemsNotaEntrega(traspasoId) {
  const { data, error } = await supabase.from('traspaso_items').select('*').eq('traspaso_id', traspasoId);
  if (error) throw error;
  return data || [];
}
export async function cargarRecepciones(limite = 50) {
  const { data, error } = await supabase.from('recepciones').select('*').order('fecha', { ascending: false }).limit(limite);
  if (error) throw error;
  return data || [];
}

// ═══════════════════════════════════════════════════════════════
// COTIZACIONES (C-01, A-10)
// ═══════════════════════════════════════════════════════════════
export const guardarCotizacionBD = (cot, items) => rpc('guardar_cotizacion', { p_cot: cot, p_items: items });
export const cambiarEstadoCotizacionBD = (id, estado) => rpc('cambiar_estado_cotizacion', { p_id: id, p_estado: estado });

// ═══════════════════════════════════════════════════════════════
// CAJA (C-01)
// ═══════════════════════════════════════════════════════════════
export const registrarMovimientoCajaBD = m => rpc('registrar_movimiento_caja', { p: m });
export const anularMovimientoCajaBD = (id, motivo) => rpc('anular_movimiento_caja', { p_id: id, p_motivo: motivo });

// Flujo de caja: movimientos manuales + cobros (pagos), en un rango de fechas
export async function cargarFlujoCajaBD(desdeISO, hastaISO) {
  if (!enLinea()) return [];
  try {
    let q1 = supabase.from('movimientos_caja').select('*').order('fecha', { ascending: false });
    let q2 = supabase.from('pagos').select('id, factura_id, monto_usd, monto_bs, tasa_usada, metodo, referencia, fecha, notas')
      .order('fecha', { ascending: false });
    if (desdeISO) { q1 = q1.gte('fecha', desdeISO); q2 = q2.gte('fecha', desdeISO); }
    if (hastaISO) { q1 = q1.lt('fecha', hastaISO); q2 = q2.lt('fecha', hastaISO); }
    const [resMovs, resPagos] = await Promise.all([q1.limit(1000), q2.limit(1000)]);
    const lista = [];
    const empTxt = e => e === 'directa' ? 'Venta Directa' : e === 'ambas' ? 'Ambas' : 'Distribuidora';

    (resMovs.data || []).forEach(m => lista.push({
      id: 'M' + m.id,
      idBD: m.id,
      fecha: fechaCorta(m.fecha),
      fecha_raw: m.fecha,
      tipo: m.tipo,
      categoria: m.categoria,
      concepto: m.concepto || '',
      montoUSD: parseFloat(m.monto_usd) || 0,
      montoBs: parseFloat(m.monto_bs) || 0,
      metodo: m.metodo,
      empresa: empTxt(m.empresa),
      clase: m.clasificacion || 'opex',
      estado: m.estado || 'activo',
      anulado_motivo: m.anulado_motivo || '',
      manual: true
    }));

    const pagos = resPagos.data || [];
    const factIds = [...new Set(pagos.map(p => p.factura_id).filter(Boolean))];
    const mapFacts = {};
    for (let i = 0; i < factIds.length; i += 150) {
      const { data: facts } = await supabase.from('facturas').select('id, numero, empresa, cliente_nombre, estado')
        .in('id', factIds.slice(i, i + 150));
      (facts || []).forEach(f => { mapFacts[f.id] = f; });
    }
    pagos.forEach(p => {
      const f = mapFacts[p.factura_id] || {};
      lista.push({
        id: 'P' + p.id,
        fecha: p.fecha ? fechaCorta(p.fecha) : '',
        fecha_raw: p.fecha,
        tipo: 'entrada',
        categoria: 'Cobranza',
        concepto: `Cobro factura ${f.numero || p.factura_id} - ${f.cliente_nombre || ''}`,
        montoUSD: parseFloat(p.monto_usd) || 0,
        montoBs: parseFloat(p.monto_bs) || 0,
        metodo: p.metodo || 'Efectivo',
        empresa: empTxt(f.empresa),
        clase: 'cobranza',
        // Cobros de facturas anuladas no cuentan como entrada real
        estado: f.estado === 'anulada' ? 'anulado' : 'activo',
        manual: false
      });
    });

    lista.sort((a, b) => new Date(b.fecha_raw) - new Date(a.fecha_raw));
    return lista;
  } catch (err) {
    console.error('[ARJ] Error cargando flujo de caja:', err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// REPORTES
// ═══════════════════════════════════════════════════════════════
export async function cargarItemsVentasMes(facturaIds) {
  if (!enLinea() || !facturaIds || facturaIds.length === 0) return [];
  const todos = [];
  for (let i = 0; i < facturaIds.length; i += 150) {
    const { data, error } = await supabase.from('factura_items').select('*').in('factura_id', facturaIds.slice(i, i + 150));
    if (error) throw error;
    if (data) todos.push(...data);
  }
  return todos;
}

// ═══════════════════════════════════════════════════════════════
// BITÁCORA (única acción que sí admite cola offline)
// ═══════════════════════════════════════════════════════════════
// La escribe el servidor (sql/04): el usuario sale del perfil, no del navegador.
// Si la función aún no existe en esa base, cae al insert directo.
export async function insertarBitacora(payload) {
  const { data, error } = await supabase.rpc('registrar_bitacora', {
    p_empresa: payload.empresa, p_accion: payload.accion, p_descripcion: payload.descripcion, p_critico: payload.critico
  });
  if (!error) return data && data.ok === false ? { message: data.error } : null;
  if (error.code === 'PGRST202') {
    const r = await supabase.from('bitacora').insert([payload]);
    return r.error;
  }
  return error;
}

export async function guardarBitacoraEnSupabase(log) {
  const payload = {
    usuario: log.usuario,
    empresa: log.empresa,
    accion: log.tipo,
    descripcion: log.mensaje,
    critico: !!log.esAlerta
  };
  try {
    if (enLinea() && !(await insertarBitacora(payload))) return;
    encolarAccion('BITACORA', payload);
  } catch (e) {
    encolarAccion('BITACORA', payload);
  }
}
