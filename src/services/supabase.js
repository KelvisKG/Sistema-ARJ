// =====================================================================
// ARJ - Supabase Integration Service (Vue 3 / ES Module)
// =====================================================================
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_PRODUCTOS, DEFAULT_CLIENTES, DEFAULT_FACTURAS_COBRAR } from './seedData.js';
import { FACTOR_LANDED_FALLBACK } from './pricing.js';
import { encolarAccion } from './syncQueue.js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

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
    tasas: { tasa_par: 58.50, tasa_bcv: 47.80, dto_divisa: 18.29 },
    conectado: false
  };

  try {
    // 1. Configuracion y Tasas
    try {
      const { data: cfg, error: eCfg } = await supabase.from('configuracion').select('*').single();
      if (!eCfg && cfg) {
        resultado.conectado = true;
        resultado.tasas.tasa_par = parseFloat(cfg.tasa_par);
        resultado.tasas.tasa_bcv = parseFloat(cfg.tasa_bcv);
        resultado.tasas.dto_divisa = parseFloat(cfg.dto_divisa || 0);

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

  } catch (err) {
    console.error('[ARJ] Error global cargando Supabase:', err);
  }

  return resultado;
}

// Guardar factura en Supabase con tolerancia (Offline-first via Sync Queue)
export async function guardarFacturaEnSupabase(factura) {
  try {
    // Si hay internet intentamos guardar directo primero
    if (navigator.onLine) {
      // Pasamos los items si existen para que se inserten si la BD tiene una columna JSONB 'items'
      const { data, error } = await supabase.from('facturas').insert([factura]).select();
      if (!error) return { ok: true, data: data ? data[0] : null };
    }
    // Si falla o no hay red, encolar
    encolarAccion('FACTURA', factura);
    return { ok: true, data: factura }; // Retorna éxito simulado localmente
  } catch (err) {
    encolarAccion('FACTURA', factura);
    return { ok: true, data: factura };
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
