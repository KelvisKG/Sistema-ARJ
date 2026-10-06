// =====================================================================
// ARJ - Cola de Sincronización Offline (Vue 3 / ES Module)
// =====================================================================
import { supabase } from './supabase.js';

const ARJ_SYNC_QUEUE_KEY = 'ARJ_SYNC_QUEUE';
const SYNC_SCHEMA_VERSION = 2; // Incrementar cuando cambie el esquema de payloads

// Estructura de la cola: [{ id, tipo, payload, fecha, reintentos, schema_version }]
export function obtenerColaSincronizacion() {
  try {
    const raw = localStorage.getItem(ARJ_SYNC_QUEUE_KEY);
    if (!raw) return [];
    const cola = JSON.parse(raw);
    if (!Array.isArray(cola)) return [];
    // Solo se conservan tareas de bitácora con el esquema vigente
    const colaValida = cola.filter(t => t && t.schema_version === SYNC_SCHEMA_VERSION && t.tipo === 'BITACORA');
    if (colaValida.length !== cola.length) {
      guardarColaSincronizacion(colaValida);
    }
    return colaValida;
  } catch (e) {
    return [];
  }
}

export function guardarColaSincronizacion(cola) {
  localStorage.setItem(ARJ_SYNC_QUEUE_KEY, JSON.stringify(cola));
}

// Encola una acción para ser ejecutada después
export function encolarAccion(tipo, payload) {
  // GUARDIA: solo la bitácora se encola. Todo lo demás requiere confirmación de la BD.
  if (tipo !== 'BITACORA') {
    console.error(`[ARJ Sync] ERROR: "${tipo}" no se puede encolar; debe guardarse en línea.`);
    return;
  }

  const cola = obtenerColaSincronizacion();
  cola.push({
    id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    tipo,
    payload,
    fecha: new Date().toISOString(),
    reintentos: 0,
    schema_version: SYNC_SCHEMA_VERSION
  });
  guardarColaSincronizacion(cola);
  console.log(`[ARJ Sync] Acción encolada (${tipo}). Total en cola: ${cola.length}`);
  
  // Intentar sincronizar inmediatamente por si hay red
  procesarColaSincronizacion();
}

let _procesando = false;

// Procesa todas las tareas pendientes en la cola (bitácora, clientes)
export async function procesarColaSincronizacion() {
  if (_procesando) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  
  const cola = obtenerColaSincronizacion();
  if (cola.length === 0) return;
  
  _procesando = true;
  console.log(`[ARJ Sync] Procesando cola con ${cola.length} tareas...`);
  
  const tareasPendientes = [];
  
  for (const tarea of cola) {
    try {
      let exito = false;
      
      // Solo la bitácora admite cola offline. Clientes, facturas, pagos e
      // inventario se guardan en línea o fallan en voz alta (C-02).
      if (tarea.tipo === 'BITACORA') {
        const { error } = await supabase.from('bitacora').insert([tarea.payload]);
        exito = !error;
        if (error) console.error('[ARJ Sync] Error bitácora:', error.message);
      }
      
      if (!exito) {
        tarea.reintentos++;
        if (tarea.reintentos < 5) {
          tareasPendientes.push(tarea); // Conservar si no superó reintentos
        } else {
          console.error(`[ARJ Sync] Tarea descartada tras 5 reintentos:`, tarea);
        }
      }
    } catch (e) {
      console.error(`[ARJ Sync] Excepción procesando tarea ${tarea.tipo}:`, e);
      tarea.reintentos++;
      tareasPendientes.push(tarea);
    }
  }
  
  guardarColaSincronizacion(tareasPendientes);
  _procesando = false;
  
  if (tareasPendientes.length === 0) {
    console.log('[ARJ Sync] Cola procesada con éxito. Todo al día.');
  } else {
    console.log(`[ARJ Sync] Quedan ${tareasPendientes.length} tareas pendientes.`);
  }
}

// Escuchar cambios en la red para procesar la cola automáticamente
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[ARJ Sync] Conexión recuperada. Intentando sincronizar...');
    procesarColaSincronizacion();
  });
}
