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
    // 1. Probar conexion cargando tasas / config si existe
    try {
      const { data: cfg, error: eCfg } = await supabase.from('configuracion').select('*').limit(1);
      if (!eCfg) {
        resultado.conectado = true;
        if (cfg && cfg.length > 0) {
          const c = cfg[0];
          if (c.tasa_par) resultado.tasas.tasa_par = parseFloat(c.tasa_par);
          if (c.tasa_bcv) resultado.tasas.tasa_bcv = parseFloat(c.tasa_bcv);
          if (c.dto_divisa) resultado.tasas.dto_divisa = parseFloat(c.dto_divisa);
        }
      }
    } catch (_) {}

    // 2. Productos
    try {
      const { data: prods, error: eP } = await supabase
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('cod_alt');

      if (!eP) {
        resultado.conectado = true;
        if (prods && prods.length > 0) {
          resultado.productos = prods.map(p => ({
            id: p.id,
            cod_alt: p.cod_alt,
            cod_orig: p.cod_orig || '',
            cod_barras: p.cod_barras || '',
            desc: p.descripcion,
            marca: p.marca || '',
            fob: parseFloat(p.fob) || 0,
            stock_vd: parseInt(p.stock_vd) || 0,
            stock_dist: parseInt(p.stock_dist) || 0,
            marca_modelo: p.marca_modelo || '',
            sistema: p.sistema || '',
            precio_manual: p.precio_manual ? parseFloat(p.precio_manual) : null,
            imagen_url: p.imagen_url || '',
            origen: p.origen || 'importado',
            factor_landed: p.factor_landed != null ? parseFloat(p.factor_landed) : FACTOR_LANDED_FALLBACK,
            proveedor: p.proveedor || '',
            embarque_id: p.embarque_id || null
          }));
        }
      }
    } catch (errP) {
      console.warn('[ARJ] Aviso cargando productos de Supabase:', errP);
    }

    // 3. Clientes
    try {
      const { data: clis, error: eC } = await supabase
        .from('clientes')
        .select('*')
        .eq('activo', true)
        .order('nombre');

      if (!eC) {
        resultado.conectado = true;
        if (clis && clis.length > 0) {
          resultado.clientes = clis.map(c => ({
            id: c.id,
            nombre: c.nombre,
            rif: c.rif || '',
            nivel: c.nivel || 'T1',
            tipo: c.tipo || 'contado',
            saldo_vd: parseFloat(c.saldo_vd) || 0,
            saldo_dist: parseFloat(c.saldo_dist) || 0,
            tel: c.telefono || '',
            empresa: c.empresa || 'ambas',
            origen: c.origen || 'mostrador',
            origen_detalle: c.origen_detalle || '',
            direccion: c.direccion || '',
            notas: c.notas || '',
            contacto_principal: {
              nombre: c.contacto_nombre || '',
              cargo: c.contacto_cargo || '',
              tel: c.contacto_tel || ''
            },
            contactos_adicionales: []
          }));
        }
      }
    } catch (errC) {
      console.warn('[ARJ] Aviso cargando clientes de Supabase:', errC);
    }

    // 4. Facturas
    try {
      const { data: facs, error: eF } = await supabase
        .from('facturas')
        .select('*')
        .order('fecha', { ascending: false });

      if (!eF) {
        resultado.conectado = true;
        if (facs && facs.length > 0) {
          resultado.todasFacturas = facs;
          resultado.facturasCobrar = facs.filter(f => f.estado !== 'pagada' && f.estado !== 'anulada');
        }
      }
    } catch (errF) {
      console.warn('[ARJ] Aviso cargando facturas de Supabase:', errF);
    }

    // 5. Bitácora
    try {
      const { data: logs, error: eB } = await supabase
        .from('bitacora')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(50);
        
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
    } catch (errB) {
      console.warn('[ARJ] Aviso cargando bitacora de Supabase:', errB);
    }

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
