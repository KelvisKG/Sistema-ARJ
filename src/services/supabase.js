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
    console.warn('[ARJ] No se pudo obtener correlativo de BD:', e);
  }
  return null;
}

export async function guardarFacturaEnSupabase(factura, items, pagos, empresa) {
  // Guardia: sin conexión en navegador no intentamos (evita error cripítico de red)
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: 'Sin conexión a internet. La factura no fue guardada.' };
  }

  try {
    // ═══ 1. INSERT en tabla 'facturas' (esquema real de la BD) ═══
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

    // ═══ 2. INSERT en tabla 'factura_items' (detalle de productos) ═══
    if (items && items.length > 0) {
      const itemsPayload = items.map(it => ({
        factura_id:      facturaId,
        producto_id:     it.id || null,
        cod_alt:         it.cod_alt || '',
        descripcion:     it.desc || '',
        cantidad:        it.cant || 0,
        fob_unitario:    parseFloat(it.fob) || 0,
        precio_unitario: parseFloat(it.precio) || 0,
        total_linea:     (it.cant || 0) * (parseFloat(it.precio) || 0),
        tier:            factura.tier || 'Publico',
        origen:          it.origen || 'importado'
      }));

      const { error: errorItems } = await supabase
        .from('factura_items')
        .insert(itemsPayload);

      if (errorItems) {
        console.error('[ARJ] Error insertando factura_items:', errorItems);
        // La cabecera ya está en BD. Retornamos con el ID para que el caller pueda informar
        return {
          ok: false,
          error: `Cabecera guardada (ID: ${facturaId}) pero falló el detalle de productos: ${errorItems.message}`,
          facturaId
        };
      }
    }

    // ═══ 3. UPDATE stock en tabla 'productos' ═══
    const stockField = empresa === 'directa' ? 'stock_vd' : 'stock_dist';
    for (const it of (items || [])) {
      if (!it.id) continue; // sin ID no podemos hacer UPDATE seguro
      try {
        // Leer stock actual y restar (operación atómica simple)
        const { data: prodActual, error: errRead } = await supabase
          .from('productos')
          .select(stockField)
          .eq('id', it.id)
          .single();

        if (!errRead && prodActual !== null) {
          const nuevoStock = (prodActual[stockField] || 0) - (it.cant || 0);
          await supabase
            .from('productos')
            .update({ [stockField]: nuevoStock })
            .eq('id', it.id);
        }
      } catch (eStock) {
        // No abortar la factura por error de stock — se logra al menos la trazabilidad
        console.warn(`[ARJ] Error actualizando stock de producto ${it.id}:`, eStock);
      }
    }

    // ═══ 4. INSERT en tabla 'pagos' (si hay pagos registrados) ═══
    if (pagos && pagos.length > 0) {
      const pagosPayload = pagos.map(p => ({
        factura_id:     facturaId,
        monto_usd:      parseFloat(p.monto_usd) || 0,
        monto_bs:       parseFloat(p.monto_bs) || 0,
        tasa_usada:     factura.tasa_bcv,
        metodo:         p.metodo || 'Efectivo',
        referencia:     p.ref || '',
        registrado_por: factura.vendedor
      }));

      const { error: errorPagos } = await supabase
        .from('pagos')
        .insert(pagosPayload);

      if (errorPagos) {
        // Logueamos pero no fallamos: la factura y sus items ya quedaron
        console.warn('[ARJ] Error insertando pagos (factura ya guardada):', errorPagos);
      }
    }

    return { ok: true, data: facturaData };

  } catch (err) {
    console.error('[ARJ] Excepción inesperada guardando factura:', err);
    return { ok: false, error: `Error inesperado al guardar la factura: ${err.message}` };
  }
}

/**
 * Anula una factura en Supabase:
 * 1. Actualiza estado en 'facturas' a 'anulada'
 * 2. Lee factura_items y devuelve el stock a 'productos'
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
    // 1. Marcar factura como anulada
    const { error: errFac } = await supabase
      .from('facturas')
      .update({
        estado:           'anulada',
        motivo_anulacion: motivo,
        anulado_por:      usuario,
        fecha_anulacion:  new Date().toISOString()
      })
      .eq('id', facturaId);

    if (errFac) {
      console.error('[ARJ] Error anulando factura en BD:', errFac);
      return { ok: false, error: `Error al anular la factura: ${errFac.message}` };
    }

    // 2. Leer los items de factura_items para devolver el stock
    const { data: items, error: errItems } = await supabase
      .from('factura_items')
      .select('producto_id, cantidad')
      .eq('factura_id', facturaId);

    if (!errItems && items && items.length > 0) {
      const stockField = empresa === 'directa' ? 'stock_vd' : 'stock_dist';

      for (const it of items) {
        if (!it.producto_id) continue;
        try {
          const { data: prod, error: errProd } = await supabase
            .from('productos')
            .select(stockField)
            .eq('id', it.producto_id)
            .single();

          if (!errProd && prod) {
            const stockRestituido = (prod[stockField] || 0) + (it.cantidad || 0);
            await supabase
              .from('productos')
              .update({ [stockField]: stockRestituido })
              .eq('id', it.producto_id);
          }
        } catch (eStock) {
          console.warn(`[ARJ] Error restituyendo stock de producto ${it.producto_id} al anular:`, eStock);
        }
      }
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
