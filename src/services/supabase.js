// =====================================================================
// ARJ - Supabase Integration Service (Vue 3 / ES Module)
// =====================================================================
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_PRODUCTOS, DEFAULT_CLIENTES, DEFAULT_FACTURAS_COBRAR } from './seedData.js';
import { FACTOR_LANDED_FALLBACK } from './pricing.js';
import { encolarAccion } from './syncQueue.js';

export const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || process?.env?.VITE_SUPABASE_URL || "https://wbxrkygtakdmckfzlzjk.supabase.co";
export const SUPABASE_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_KEY) || process?.env?.VITE_SUPABASE_KEY || "sb_publishable_TSa5RRqbyCfeJomEoWI14g_EI6akCFh";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

// Carga completa de datos tolerante a RLS y fallos de red
export async function cargarDatosCompletos() {
  const resultado = {
    productos: [],
    clientes: [],
    facturasCobrar: [],
    todasFacturas: [],
    embarques: [],
    bitacora: [],
    // null = las tasas no pudieron cargarse desde la BD (no usar fallback hardcodeado)
    tasas: null,
    conectado: false
  };

  try {
    // 1. Configuracion y Tasas
    try {
      const { data: cfg, error: eCfg } = await supabase.from('configuracion').select('*').single();
      if (!eCfg && cfg) {
        resultado.conectado = true;
        // Tasas: solo asignar si venienen de la BD, nunca usar hardcoded
        resultado.tasas = {
          tasa_par: parseFloat(cfg.tasa_par) || 0,
          tasa_bcv: parseFloat(cfg.tasa_bcv) || 0,
          dto_divisa: parseFloat(cfg.dto_divisa || 0)
        };

        resultado.configuracion = {
          factor_default: parseFloat(cfg.factor_landed_default) || 1.471,
          costos_fijos_mes: parseFloat(cfg.costos_fijos_mes) || 0,
          equipo: cfg.equipo || []
        };
      }
    } catch (_) { }

    // 2. Productos
    try {
      const { data: prods, error: eP } = await supabase.from('productos').select('*').eq('activo', true).order('cod_alt');
      if (eP) throw eP;
      
      resultado.productos = (prods || []).map(p => ({
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
        precio_manual: p.precio_manual ? parseFloat(p.precio_manual) : null,
        imagen_url: p.imagen_url || '',
        origen: p.origen || 'importado',
        factor_landed: p.factor_landed != null ? parseFloat(p.factor_landed) : 1.471,
        proveedor: p.proveedor || '',
        embarque_id: p.embarque_id || null
      }));
    } catch (errP) { console.warn('[ARJ] Error cargando productos:', errP); }

    // 3. Clientes y Contactos
    try {
      const { data: clis, error: eC } = await supabase.from('clientes').select('*').eq('activo', true).order('nombre');
      if (eC) throw eC;
      
      resultado.conectado = true;
      const { data: contactos } = await supabase.from('contactos_cliente').select('*');
      const contactosPorCliente = {};
      if (contactos) {
        contactos.forEach(c => {
          if (!contactosPorCliente[c.cliente_id]) contactosPorCliente[c.cliente_id] = [];
          contactosPorCliente[c.cliente_id].push(c);
        });
      }
      
      resultado.clientes = (clis || []).map(c => {
        const cts = contactosPorCliente[c.id] || [];
        const principal = cts.find(x => x.es_principal) || cts[0] || null;
        const adicionales = cts.filter(x => !x.es_principal || (principal && x.id !== principal.id));
        return {
          id: c.id,
          nombre: c.nombre,
          rif: c.rif || '',
          nivel: c.nivel || 'T1',
          tipo: c.tipo_pago || c.tipo || 'contado',
          saldo_vd: parseFloat(c.saldo_vd) || 0,
          saldo_dist: parseFloat(c.saldo_dist) || 0,
          tel: c.telefono || '',
          empresa: c.empresa || 'ambas',
          origen: c.origen || '',
          como_consiguio: c.origen || '',
          origen_detalle: c.origen_detalle || '',
          direccion: c.direccion || '',
          notas: c.notas || '',
          contacto_principal: principal ? { nombre: principal.nombre, cargo: principal.cargo || '', tel: principal.telefono || '' } : { nombre: '—', cargo: '—', tel: '' },
          contactos_adicionales: adicionales.map(a => ({ nombre: a.nombre, cargo: a.cargo || '', tel: a.telefono || '' }))
        };
      });
    } catch (errC) { console.warn('[ARJ] Error cargando clientes:', errC); }

    // 4. Facturas (TODAS, COBRAR, RECIENTES)
    resultado.todasFacturas = [];
    resultado.facturasCobrar = [];
    resultado.ventasRecientes = [];
    try {
      const { data: facts, error: eF } = await supabase.from('facturas').select('*').order('fecha', { ascending: false }).limit(500);
      if (!eF && facts) {
        resultado.conectado = true;
        facts.forEach(f => {
          const ahora = new Date();
          const fechaVence = f.fecha_vence ? new Date(f.fecha_vence) : null;
          const diasVence = fechaVence ? Math.ceil((fechaVence - ahora) / (1000 * 60 * 60 * 24)) : 0;

          let est = f.estado;
          if (est === 'pendiente' && fechaVence && fechaVence < ahora) est = 'vencida';

          const obj = {
            id: f.id, num: f.numero, empresa: f.empresa, cliente: f.cliente_nombre,
            cliente_id: f.cliente_id, vendedor: f.vendedor,
            fecha: new Date(f.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
            fecha_raw: f.fecha,
            vence: fechaVence ? fechaVence.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
            total: parseFloat(f.subtotal_usd) || 0,
            abonado: parseFloat(f.subtotal_usd || 0) - parseFloat(f.saldo_pendiente || 0),
            saldo_pendiente: parseFloat(f.saldo_pendiente) || 0,
            estado: est, dias: diasVence,
            tipo_pago: f.tipo_pago, tasa_par: parseFloat(f.tasa_par),
            tasa_bcv: parseFloat(f.tasa_bcv),
            factor_bs: f.factor_bs != null ? parseFloat(f.factor_bs) : null,
            cliente_nombre_snap: f.cliente_nombre_snap || null,
            cliente_rif_snap: f.cliente_rif_snap || null,
            cliente_tel_snap: f.cliente_tel_snap || null,
            cliente_dir_snap: f.cliente_dir_snap || null,
            descuento_manual: parseFloat(f.descuento_manual) || 0,
            cobrar_verde: f.cobrar_verde != null ? parseFloat(f.cobrar_verde) : null,
            motivo_descuento: f.motivo_descuento || '',
            pidio_fiscal: f.pidio_fiscal
          };

          resultado.todasFacturas.push(obj);

          if (est !== 'pagada' && est !== 'anulada') {
            resultado.facturasCobrar.push(obj);
          }

          if (resultado.ventasRecientes.length < 20) {
            const fechaCorta = new Date(f.fecha);
            resultado.ventasRecientes.push({
              id: f.id, num: f.numero, cliente: f.cliente_nombre,
              fecha: fechaCorta.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) + ' ' + fechaCorta.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
              total: parseFloat(f.subtotal_usd) || 0, vendedor: f.vendedor, estado: est
            });
          }
        });
      }
    } catch (errF) { console.warn('[ARJ] Error cargando facturas:', errF); }

    // 5. Cotizaciones (Presupuestos)
    try {
      const { data: cots, error: eCot } = await supabase.from('cotizaciones').select('*').order('fecha', { ascending: false }).limit(50);
      if (!eCot && cots) {
        const cotIds = cots.map(c => c.id).filter(Boolean);
        const itemsPorCot = {};
        if (cotIds.length > 0) {
          const { data: cits } = await supabase.from('cotizacion_items').select('*').in('cotizacion_id', cotIds);
          if (cits) {
            cits.forEach(ci => {
              if (!itemsPorCot[ci.cotizacion_id]) itemsPorCot[ci.cotizacion_id] = [];
              itemsPorCot[ci.cotizacion_id].push({
                id: ci.producto_id || ci.id,
                cod_alt: ci.cod_alt || '',
                desc: ci.descripcion || '',
                cant: ci.cantidad || 0,
                precio: parseFloat(ci.precio_unitario) || 0,
                fob: parseFloat(ci.fob) || 0
              });
            });
          }
        }

        resultado.presupuestos = cots.map(c => {
          const vence = new Date(c.fecha_vence);
          const ahora = new Date();
          const diasRest = Math.ceil((vence - ahora) / (1000 * 60 * 60 * 24));
          let est = c.estado;
          if (est === 'activa' && diasRest <= 5) est = 'por_vencer';
          if (est === 'activa' && diasRest < 0) est = 'vencida';

          const items = itemsPorCot[c.id] || [];
          return {
            id: c.id, num: c.numero, empresa: c.empresa, cliente: c.cliente_nombre,
            cliente_id: c.cliente_id || null,
            fecha: new Date(c.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
            vence: vence.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
            total: parseFloat(c.subtotal_usd) || 0, estado: est, dias_restantes: diasRest,
            items_count: items.length, items: items, vendedor: c.vendedor
          };
        });
      }
    } catch (errCot) { console.warn('[ARJ] Error cargando cotizaciones:', errCot); }

    // 6. Sistemas
    resultado.sistemas = [];
    try {
      const { data: sists, error: eSis } = await supabase.from('sistemas').select('*').order('orden');
      if (!eSis && sists) {
        resultado.sistemas = sists.map(s => s.nombre);
      }
    } catch (errSis) { }

    // 7. Bitácora
    try {
      const { data: logs, error: eB } = await supabase.from('bitacora').select('*').order('fecha', { ascending: false }).limit(50);
      if (!eB && logs) {
        resultado.bitacora = logs.map(l => ({
          id: l.id || Date.now() + Math.random(),
          fecha: new Date(l.fecha).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          fecha_completa: new Date(l.fecha).toLocaleDateString('es-VE') + ' ' + new Date(l.fecha).toLocaleTimeString('es-VE'),
          tipo: l.accion || 'sistema',
          usuario: l.usuario || 'Sistema',
          empresa: l.empresa || 'directa',
          mensaje: l.descripcion || '',
          esAlerta: l.critico || false
        }));
      }
    } catch (errB) { console.warn('[ARJ] Aviso cargando bitacora de Supabase:', errB); }

    // 8. Embarques
    resultado.embarques = [];
    try {
      const { data: embs, error: eEmb } = await supabase.from('embarques').select('*').order('id', { ascending: false });
      if (!eEmb && embs) {
        resultado.embarques = embs;
      }
    } catch (_) { }

  } catch (err) {
    console.error('[ARJ] Error global cargando Supabase:', err);
  }

  return resultado;
}

/**
 * Guarda una factura COMPLETA en Supabase con persistencia atómica en 4 tablas:
 * 1. facturas (cabecera) → 2. factura_items (detalle) → 3. productos (UPDATE stock) → 4. pagos
 *
 * NO usa la cola offline (sync queue). Si falla, retorna { ok: false, error } para
 * que el caller pueda revertir los cambios locales y mostrar el error real al usuario.
 *
 * @param {Object} factura - Objeto factura completo del store
 * @param {Array}  items   - Array de items del carrito al momento de emitir
 * @param {Array}  pagos   - Array de pagos registrados en el carrito
 * @param {string} empresa - 'directa' | 'distribuidora'
 * @returns {{ ok: boolean, data?: Object, error?: string, facturaId?: string|number }}
 */
/**
 * Obtiene el siguiente número correlativo consultando directamente la base de datos (C6)
 * @param {string} empresa - 'directa' | 'distribuidora'
 * @returns {Promise<string|null>}
 */
export async function obtenerSiguienteCorrelativoBD(empresa) {
  const prefijo = empresa === 'directa' ? 'VD' : 'DIST';
  const anio = new Date().getFullYear();

  // 1. Intentar RPC con secuencia atómica y bloqueo FOR UPDATE en Postgres (C6)
  try {
    const { data: seqData, error: seqErr } = await supabase.rpc('obtener_siguiente_correlativo_seq', {
      p_empresa: empresa
    });
    if (!seqErr && seqData && typeof seqData === 'string' && seqData.startsWith(prefijo)) {
      return seqData;
    }
  } catch (_) {}

  // 2. Fallback consultando el último número registrado en la base de datos
  const patron = `${prefijo}-${anio}-%`;
  try {
    const { data, error } = await supabase
      .from('facturas')
      .select('numero')
      .eq('empresa', empresa)
      .ilike('numero', patron)
      .order('numero', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0 && data[0].numero) {
      const partes = data[0].numero.split('-');
      if (partes.length >= 3) {
        const ultimoNum = parseInt(partes[2], 10);
        if (!isNaN(ultimoNum)) {
          return `${prefijo}-${anio}-${String(ultimoNum + 1).padStart(5, '0')}`;
        }
      }
    }
    if (!error && data && data.length === 0) {
      return `${prefijo}-${anio}-00001`;
    }
  } catch (e) {
    console.error('[ARJ] Error al obtener correlativo de la base de datos:', e);
  }
  return null;
}

/**
 * Deduce la tasa correspondiente según el método de pago (C3 / M2).
 * Métodos en Bolívares usan tasa Paralelo, métodos en USD usan tasa BCV.
 */
function deducirTasaPago(pago, factura) {
  if (pago.tasa_usada && parseFloat(pago.tasa_usada) > 0) {
    return parseFloat(pago.tasa_usada);
  }
  const m = (pago.metodo || '').toString().toLowerCase();
  const esBs = m.includes('bs') || m.includes('móvil') || m.includes('movil') ||
               m.includes('transferencia') || m.includes('punto') || m.includes('debito') ||
               m.includes('deposito') || pago.moneda === 'Bs';
  if (esBs) {
    return parseFloat(factura.tasa_par || factura.tasa_bcv || 1);
  }
  return parseFloat(factura.tasa_bcv || factura.tasa_par || 1);
}

/**
 * Auxiliar: Revierte stock previamente descontado si ocurre un error durante el proceso de guardado (C4)
 */
async function _revertirStockDescontado(itemsDescontados, stockField) {
  for (const item of itemsDescontados) {
    try {
      const { data: prod } = await supabase
        .from('productos')
        .select(`id, ${stockField}`)
        .eq('id', item.id)
        .maybeSingle();
      if (prod) {
        const stockRestaurado = (prod[stockField] || 0) + item.cant;
        await supabase.from('productos').update({ [stockField]: stockRestaurado }).eq('id', item.id);
      }
    } catch (e) {
      console.error(`[ARJ] Error en reversión compensatoria de producto ${item.id}:`, e);
    }
  }
}

/**
 * Guarda una factura COMPLETA en Supabase con persistencia atómica en 4 tablas:
 * 1. facturas (cabecera) → 2. factura_items (detalle) → 3. productos (UPDATE stock) → 4. pagos
 *
 * Utiliza la función RPC 'emitir_factura_atomica' en Postgres si está disponible (C4).
 * Si no está disponible, ejecuta un pipeline compensatorio estricto con rollback automático.
 *
 * @param {Object} factura - Objeto factura completo del store
 * @param {Array}  items   - Array de items del carrito al momento de emitir
 * @param {Array}  pagos   - Array de pagos registrados en el carrito
 * @param {string} empresa - 'directa' | 'distribuidora'
 * @returns {{ ok: boolean, data?: Object, error?: string, facturaId?: string|number }}
 */
export async function guardarFacturaEnSupabase(factura, items, pagos, empresa) {
  // Guardia: sin conexión en navegador no intentamos
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: 'Sin conexión a internet. La factura no fue guardada.' };
  }

  try {
    const ahora = new Date();
    const facturaPayload = {
      numero:            factura.num,
      empresa:           factura.empresa,
      cliente_nombre:    factura.cliente,
      cliente_id:        factura.cliente_id || null,
      vendedor:          factura.vendedor,
      subtotal_usd:      factura.total,
      saldo_pendiente:   factura.saldo_pendiente,
      estado:            factura.estado,
      tipo_pago:         factura.tipo_pago,
      dias_credito:      factura.dias || 0,
      fecha:             ahora.toISOString(),
      fecha_vence:       factura.tipo_pago === 'credito'
                           ? new Date(ahora.getTime() + ((factura.dias || 0) * 86400000)).toISOString()
                           : null,
      tasa_par:          factura.tasa_par,
      tasa_bcv:          factura.tasa_bcv,
      factor_bs:         factura.factor_bs || 1.00,
      descuento_manual:  factura.descuento_manual || 0,
      motivo_descuento:  factura.descuento_motivo || '',
      pidio_fiscal:      factura.pidio_fiscal || false,
      cobrar_verde:      factura.cobrar_verde || null
    };

    // Preparar renglones con deducción de origen (C2)
    const itemsPayload = (items || []).map(it => {
      const factorLanded = parseFloat(it.factor_landed || it.factor || 0);
      let origenFinal = (it.origen || '').toString().trim().toLowerCase();
      // Si no trae origen explícito 'local' o 'importado', se deduce por factor_landed (<= 1.001 -> local)
      if (origenFinal !== 'local' && origenFinal !== 'importado') {
        origenFinal = (Number.isFinite(factorLanded) && factorLanded > 0 && factorLanded <= 1.001) ? 'local' : 'importado';
      }
      const cant = parseInt(it.cant, 10) || 0;
      const fob = parseFloat(it.fob) || 0;
      const precio = parseFloat(it.precio) || 0;
      return {
        producto_id:     it.id || null,
        cod_alt:         it.cod_alt || '',
        descripcion:     it.desc || '',
        cantidad:        cant,
        fob_unitario:    fob,
        precio_unitario: precio,
        total_linea:     cant * precio,
        tier:            factura.tier || 'Publico',
        factor_landed:   (Number.isFinite(factorLanded) && factorLanded > 0) ? factorLanded : null,
        origen:          origenFinal
      };
    });

    // Preparar pagos con deducción de tasa por método (C3 / M2)
    const pagosPayload = (pagos || []).map(p => {
      const tasaUsada = deducirTasaPago(p, factura);
      const montoUSD = parseFloat(p.monto_usd) || 0;
      const montoBs = (parseFloat(p.monto_bs) > 0)
        ? parseFloat(p.monto_bs)
        : Math.round(montoUSD * tasaUsada * 100) / 100;
      return {
        monto_usd:      montoUSD,
        monto_bs:       montoBs,
        tasa_usada:     tasaUsada,
        metodo:         p.metodo || 'Efectivo',
        referencia:     p.ref || p.referencia || '',
        registrado_por: factura.vendedor || 'Sistema'
      };
    });

    // ═══ INTENTO 1: FUNCIÓN RPC TRANSACCIONAL ATÓMICA EN POSTGRES (C4) ═══
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('emitir_factura_atomica', {
        p_factura: facturaPayload,
        p_items: itemsPayload,
        p_pagos: pagosPayload,
        p_empresa: empresa
      });

      if (!rpcErr && rpcRes) {
        if (rpcRes.ok) {
          return { ok: true, data: rpcRes.data };
        } else {
          return { ok: false, error: rpcRes.error || 'Error en transacción atómica de Postgres' };
        }
      }
    } catch (_) {
      // Si la función RPC no existe en la BD, continúa al flujo con rollback compensatorio
    }

    // ═══ INTENTO 2: PIPELINE CON TRANSACCIONALIDAD COMPENSATORIA ESTRICTA (FALLBACK) ═══
    // 1. INSERT en tabla 'facturas'
    const { data: facturaData, error: errorFactura } = await supabase
      .from('facturas')
      .insert([facturaPayload])
      .select()
      .single();

    if (errorFactura) {
      console.error('[ARJ] Error insertando en facturas:', errorFactura);
      return { ok: false, error: `Error al guardar la factura: ${errorFactura.message}` };
    }

    const facturaId = facturaData.id;

    // 2. INSERT en tabla 'factura_items'
    if (itemsPayload.length > 0) {
      const itemsConId = itemsPayload.map(it => ({
        ...it,
        factura_id: facturaId
      }));

      let { error: errorItems } = await supabase
        .from('factura_items')
        .insert(itemsConId);

      // Si la BD no tiene la columna factor_landed (ej. staging), reintentar sin ella preservando origen
      if (errorItems && (errorItems.message?.includes('factor_landed') || errorItems.code === 'PGRST204')) {
        const itemsSinFactor = itemsConId.map(({ factor_landed, ...resto }) => resto);
        const reintento = await supabase
          .from('factura_items')
          .insert(itemsSinFactor);
        errorItems = reintento.error;
      }

      if (errorItems) {
        console.error('[ARJ] Error insertando factura_items:', errorItems);
        // Rollback compensatorio: eliminar cabecera para no dejar registros huérfanos (C4)
        await supabase.from('facturas').delete().eq('id', facturaId);
        return {
          ok: false,
          error: `Error al registrar productos (${errorItems.message}). La factura fue revertida.`
        };
      }
    }

    // 3. UPDATE stock en tabla 'productos' (con seguimiento de cambios para rollback)
    const stockField = empresa === 'directa' ? 'stock_vd' : 'stock_dist';
    const itemsDescontados = [];

    for (const it of (items || [])) {
      if (!it.id) {
        // C4: No ignorar en silencio. Producto sin ID no puede garantizar stock
        await _revertirStockDescontado(itemsDescontados, stockField);
        await supabase.from('factura_items').delete().eq('factura_id', facturaId);
        await supabase.from('facturas').delete().eq('id', facturaId);
        return {
          ok: false,
          error: `El producto "${it.desc || it.cod_alt}" no tiene identificador válido para descontar inventario.`
        };
      }

      try {
        const { data: prodActual, error: errRead } = await supabase
          .from('productos')
          .select(`id, ${stockField}`)
          .eq('id', it.id)
          .single();

        if (errRead || !prodActual) {
          throw new Error(errRead?.message || 'Producto no encontrado en BD');
        }

        const nuevoStock = (prodActual[stockField] || 0) - (it.cant || 0);
        const { error: errUpdate } = await supabase
          .from('productos')
          .update({ [stockField]: nuevoStock })
          .eq('id', it.id);

        if (errUpdate) {
          throw new Error(errUpdate.message);
        }

        itemsDescontados.push({ id: it.id, cant: it.cant });
      } catch (eStock) {
        console.error(`[ARJ] Error crítico descontando stock de ${it.cod_alt || it.id}:`, eStock);
        // Rollback completo de lo aplicado hasta ahora
        await _revertirStockDescontado(itemsDescontados, stockField);
        await supabase.from('factura_items').delete().eq('factura_id', facturaId);
        await supabase.from('facturas').delete().eq('id', facturaId);
        return {
          ok: false,
          error: `Fallo al descontar stock del producto ${it.cod_alt || it.desc}: ${eStock.message}. Emisión abortada.`
        };
      }
    }

    // 4. INSERT en tabla 'pagos' (C3: fallar en voz alta y revertir si hay error)
    if (pagosPayload.length > 0) {
      const pagosConId = pagosPayload.map(p => ({
        ...p,
        factura_id: facturaId
      }));

      const { error: errorPagos } = await supabase
        .from('pagos')
        .insert(pagosConId);

      if (errorPagos) {
        console.error('[ARJ] Error insertando pagos:', errorPagos);
        // C3: Debe fallar en voz alta y revertir todo lo aplicado previamente
        await _revertirStockDescontado(itemsDescontados, stockField);
        await supabase.from('factura_items').delete().eq('factura_id', facturaId);
        await supabase.from('facturas').delete().eq('id', facturaId);
        return {
          ok: false,
          error: `Error registrando los pagos (${errorPagos.message}). Emisión abortada y revertida por seguridad.`
        };
      }
    }

    return { ok: true, data: facturaData };

  } catch (err) {
    console.error('[ARJ] Excepción inesperada guardando factura:', err);
    return { ok: false, error: `Error inesperado al guardar la factura: ${err.message}` };
  }
}

/**
 * Anula una factura en Supabase con integridad transaccional (C5):
 * 1. Restituye el stock de todos los items en 'productos'
 * 2. Actualiza estado en 'facturas' a 'anulada'
 * Si la restitución de stock falla, NO se anula la factura y se preserva el inventario.
 *
 * @param {string|number} facturaId  - ID real de Supabase (UUID o int)
 * @param {string}        motivo     - Motivo de anulación (obligatorio)
 * @param {string}        usuario    - Nombre del usuario que anula
 * @param {string}        empresa    - 'directa' | 'distribuidora'
 * @returns {{ ok: boolean, error?: string }}
 */
export async function anularFacturaEnSupabase(facturaId, motivo, usuario, empresa) {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: 'Sin conexión a internet. La anulación no fue persistida.' };
  }
  try {
    const motivoCompleto = usuario ? `${motivo} (Por: ${usuario})` : motivo;

    // ═══ INTENTO 1: RPC TRANSACCIONAL ATÓMICA (C5) ═══
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('anular_factura_atomica', {
        p_factura_id: String(facturaId),
        p_motivo: motivoCompleto,
        p_usuario: usuario || 'Sistema',
        p_empresa: empresa
      });

      if (!rpcErr && rpcRes) {
        if (rpcRes.ok) {
          return { ok: true };
        } else {
          return { ok: false, error: rpcRes.error };
        }
      }
    } catch (_) {}

    // ═══ INTENTO 2: FALLBACK ESTRICTO CLIENTE ═══
    const esUUIDoNumero = typeof facturaId === 'number' || (typeof facturaId === 'string' && !facturaId.startsWith('FAC-') && !facturaId.startsWith('VD-') && !facturaId.startsWith('DIST-'));
    const columnaFiltro = esUUIDoNumero ? 'id' : 'numero';

    // Obtener ID real y verificar estado previo
    let idReal = facturaId;
    const { data: facCheck, error: errFacCheck } = await supabase
      .from('facturas')
      .select('id, estado')
      .eq(columnaFiltro, facturaId)
      .maybeSingle();

    if (errFacCheck || !facCheck) {
      return { ok: false, error: 'Factura no encontrada en la base de datos' };
    }
    if (facCheck.estado === 'anulada') {
      return { ok: false, error: 'La factura ya se encuentra anulada previamente' };
    }
    idReal = facCheck.id;

    // Leer items vinculados a la factura
    const { data: items, error: errItems } = await supabase
      .from('factura_items')
      .select('producto_id, cod_alt, cantidad')
      .eq('factura_id', idReal);

    if (errItems) {
      return { ok: false, error: `No se pudieron leer los renglones de la factura: ${errItems.message}` };
    }

    // 1. Restituir inventario PRIMERO comprobando cada producto (C5)
    const stockField = empresa === 'directa' ? 'stock_vd' : 'stock_dist';
    const itemsRestituidos = [];

    if (items && items.length > 0) {
      for (const it of items) {
        try {
          let prodId = it.producto_id;
          let stockActual = null;

          if (prodId) {
            const { data: prod } = await supabase
              .from('productos')
              .select(`id, ${stockField}`)
              .eq('id', prodId)
              .maybeSingle();
            if (prod) stockActual = prod[stockField] || 0;
          }

          if (stockActual === null && it.cod_alt) {
            const { data: prod } = await supabase
              .from('productos')
              .select(`id, ${stockField}`)
              .eq('cod_alt', it.cod_alt)
              .maybeSingle();
            if (prod) {
              prodId = prod.id;
              stockActual = prod[stockField] || 0;
            }
          }

          if (!prodId || stockActual === null) {
            throw new Error(`Producto ${it.cod_alt || it.producto_id} no encontrado en catálogo`);
          }

          const stockRestituido = stockActual + (it.cantidad || 0);
          const { error: errUpdateStock } = await supabase
            .from('productos')
            .update({ [stockField]: stockRestituido })
            .eq('id', prodId);

          if (errUpdateStock) {
            throw new Error(errUpdateStock.message);
          }

          itemsRestituidos.push({ id: prodId, cant: it.cantidad });
        } catch (eStock) {
          // Deshacer las restituciones parciales realizadas hasta el momento
          for (const r of itemsRestituidos) {
            try {
              const { data: pCur } = await supabase.from('productos').select(stockField).eq('id', r.id).single();
              if (pCur) {
                await supabase.from('productos').update({ [stockField]: (pCur[stockField] || 0) - r.cant }).eq('id', r.id);
              }
            } catch (_) {}
          }
          return {
            ok: false,
            error: `Error restituyendo inventario del producto ${it.cod_alt || it.producto_id}: ${eStock.message}. La anulación fue cancelada para preservar el stock.`
          };
        }
      }
    }

    // 2. Marcar factura como anulada una vez garantizada la restitución del inventario
    const payloadBase = {
      estado:           'anulada',
      motivo_anulacion: motivoCompleto,
      fecha_anulacion:  new Date().toISOString()
    };

    let { error: errFac } = await supabase
      .from('facturas')
      .update({
        ...payloadBase,
        anulado_por: usuario
      })
      .eq('id', idReal);

    if (errFac && (errFac.message?.includes('anulado_por') || errFac.code === 'PGRST204')) {
      const reintento = await supabase
        .from('facturas')
        .update(payloadBase)
        .eq('id', idReal);
      errFac = reintento.error;
    }

    if (errFac) {
      console.error('[ARJ] Error marcando factura como anulada:', errFac);
      // Revertir restitución de stock si falló la actualización del estado de factura
      for (const r of itemsRestituidos) {
        try {
          const { data: pCur } = await supabase.from('productos').select(stockField).eq('id', r.id).single();
          if (pCur) {
            await supabase.from('productos').update({ [stockField]: (pCur[stockField] || 0) - r.cant }).eq('id', r.id);
          }
        } catch (_) {}
      }
      return { ok: false, error: `Error al anular la factura: ${errFac.message}` };
    }

    return { ok: true };
  } catch (err) {
    console.error('[ARJ] Excepción inesperada al anular factura:', err);
    return { ok: false, error: `Error inesperado al anular: ${err.message}` };
  }
}

// Guardar nuevo cliente (Offline-first via Sync Queue)
export async function guardarClienteEnSupabase(cliente) {
  try {
    if (navigator.onLine) {
      const { data, error } = await supabase.from('clientes').insert([cliente]).select();
      if (!error) return { ok: true, data: data ? data[0] : null };
    }
    encolarAccion('CLIENTE', cliente);
    return { ok: true, data: cliente };
  } catch (err) {
    encolarAccion('CLIENTE', cliente);
    return { ok: true, data: cliente };
  }
}

// Actualizar cliente existente (Offline-first via Sync Queue)
export async function actualizarClienteEnSupabase(clienteId, datosCliente) {
  try {
    if (navigator.onLine && clienteId) {
      const payload = {
        nombre: datosCliente.nombre,
        rif: datosCliente.rif,
        telefono: datosCliente.tel,
        direccion: datosCliente.direccion,
        nivel: datosCliente.nivel,
        tipo_pago: datosCliente.tipo,
        origen: datosCliente.origen || datosCliente.como_consiguio || '',
        origen_detalle: datosCliente.origen_detalle || '',
        notas: datosCliente.notas || ''
      };
      const { data, error } = await supabase.from('clientes').update(payload).eq('id', clienteId).select();
      if (!error) {
        if (datosCliente.contacto_principal) {
          const cp = datosCliente.contacto_principal;
          await supabase.from('contactos_cliente').update({
            nombre: cp.nombre,
            cargo: cp.cargo,
            telefono: cp.tel || datosCliente.tel
          }).eq('cliente_id', clienteId).eq('es_principal', true);
        }
        return { ok: true, data: data ? data[0] : null };
      }
    }
    encolarAccion('ACTUALIZAR_CLIENTE', { id: clienteId, ...datosCliente });
    return { ok: true };
  } catch (err) {
    console.warn('[ARJ] Error actualizando cliente en Supabase:', err);
    encolarAccion('ACTUALIZAR_CLIENTE', { id: clienteId, ...datosCliente });
    return { ok: true };
  }
}

// Guardar bitácora (Offline-first via Sync Queue)
export async function guardarBitacoraEnSupabase(log) {
  const payload = {
    usuario: log.usuario,
    empresa: log.empresa,
    accion: log.tipo,
    descripcion: log.mensaje,
    critico: log.esAlerta
  };
  try {
    if (navigator.onLine) {
      const { error } = await supabase.from('bitacora').insert([payload]);
      if (!error) return;
    }
    encolarAccion('BITACORA', payload);
  } catch (e) {
    encolarAccion('BITACORA', payload);
  }
}

// Cargar items y pagos reales en demanda (Lazy Load) para modal de factura
export async function cargarDetallesFactura(facturaId) {
  if (!navigator.onLine) return { items: null, pagos: null };
  try {
    const [iRes, pRes] = await Promise.all([
      supabase.from('factura_items').select('*').eq('factura_id', facturaId),
      supabase.from('pagos').select('*').eq('factura_id', facturaId).order('fecha')
    ]);
    
    // Mapeamos los campos del legacy a los que usa el nuevo sistema (desc, cant, precio)
    const itemsMap = (iRes.data || []).map(it => ({
      id: it.producto_id || Date.now() + Math.random(),
      cod_alt: it.cod_alt || '',
      desc: it.descripcion || '',
      cant: it.cantidad || 0,
      precio: parseFloat(it.precio_unitario) || 0,
      total_linea: parseFloat(it.total_linea) || 0
    }));
    
    return { items: itemsMap, pagos: pRes.data || [] };
  } catch(e) {
    console.error('[ARJ] Error cargando detalles lazy:', e);
    return { items: null, pagos: null };
  }
}

// Cargar movimientos de flujo de caja (Manuales + Pagos)
export async function cargarFlujoCajaBD(fechaDesde, fechaHasta) {
  if (!navigator.onLine) return [];
  try {
    const q1 = supabase.from('movimientos_caja').select('*').order('fecha', { ascending: false });
    const q2 = supabase.from('pagos').select('id, factura_id, monto_usd, monto_bs, tasa_usada, metodo, referencia, fecha');
    
    // Si quisieramos filtrar por fechas lo agregariamos aca. Por ahora cargamos todo el mes/reciente (limite 500)
    q1.limit(300);
    q2.limit(300);

    const [resMovs, resPagos] = await Promise.all([q1, q2]);
    let lista = [];

    // 1) Movimientos de la tabla movimientos_caja
    if (resMovs.data) {
      resMovs.data.forEach(m => {
        lista.push({
          id: 'M' + m.id,
          fecha: new Date(m.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
          tipo: m.tipo,
          categoria: m.categoria,
          concepto: m.concepto || '',
          montoUSD: parseFloat(m.monto_usd) || 0,
          montoBs: parseFloat(m.monto_bs) || 0,
          metodo: m.metodo,
          empresa: m.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora',
          clase: m.clasificacion || 'opex'
        });
      });
    }

    // 2) Pagos (entradas automáticas por cobranza)
    if (resPagos.data) {
      // Necesitamos el número de factura y cliente para el concepto.
      // Extraemos los IDs
      const factIds = [...new Set(resPagos.data.map(p => p.factura_id).filter(Boolean))];
      let mapFacts = {};
      if (factIds.length > 0) {
        const { data: facts } = await supabase.from('facturas').select('id, numero, empresa, cliente_nombre').in('id', factIds);
        if (facts) {
          facts.forEach(f => { mapFacts[f.id] = f; });
        }
      }

      resPagos.data.forEach(p => {
        const f = mapFacts[p.factura_id] || {};
        lista.push({
          id: 'P' + p.id,
          fecha: p.fecha ? new Date(p.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
          tipo: 'entrada',
          categoria: 'Cobranza',
          concepto: `Cobro de factura ${f.numero || p.factura_id} - ${f.cliente_nombre || ''}`,
          montoUSD: parseFloat(p.monto_usd) || 0,
          montoBs: parseFloat(p.monto_bs) || 0,
          metodo: p.metodo || 'Efectivo',
          empresa: f.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora',
          clase: 'cobranza'
        });
      });
    }

    // Ordenar por ID o fecha aproximada (reversa)
    lista.sort((a, b) => b.id.localeCompare(a.id));
    return lista;
  } catch (err) {
    console.error('[ARJ] Error cargando flujo caja:', err);
    return [];
  }
}

// Cargar items de múltiples facturas (para reportes)
export async function cargarItemsVentasMes(facturaIds) {
  if (!navigator.onLine || !facturaIds || facturaIds.length === 0) return [];
  try {
    // Dividir en chunks si son más de 150 IDs para no romper la URL de Supabase
    let todosLosItems = [];
    for (let i = 0; i < facturaIds.length; i += 150) {
      const chunk = facturaIds.slice(i, i + 150);
      const { data, error } = await supabase.from('factura_items').select('*').in('factura_id', chunk);
      if (data) todosLosItems.push(...data);
    }
    return todosLosItems;
  } catch (err) {
    console.error('[ARJ] Error cargando items de reportes:', err);
    return [];
  }
}
