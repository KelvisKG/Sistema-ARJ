// =====================================================================
// ARJ - Cola de Sincronización Offline (Vue 3 / ES Module)
// =====================================================================
import { supabase } from './supabase.js';

const ARJ_SYNC_QUEUE_KEY = 'ARJ_SYNC_QUEUE';

// Estructura de la cola: [{ id, tipo, payload, fecha, reintentos }]
export function obtenerColaSincronizacion() {
  try {
    const raw = localStorage.getItem(ARJ_SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function guardarColaSincronizacion(cola) {
  localStorage.setItem(ARJ_SYNC_QUEUE_KEY, JSON.stringify(cola));
}

// Encola una acción para ser ejecutada después
export function encolarAccion(tipo, payload) {
  const cola = obtenerColaSincronizacion();
  cola.push({
    id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    tipo,
    payload,
    fecha: new Date().toISOString(),
    reintentos: 0
  });
  guardarColaSincronizacion(cola);
  console.log(`[ARJ Sync] Acción encolada (${tipo}). Total en cola: ${cola.length}`);
  
  // Intentar sincronizar inmediatamente por si hay red
  procesarColaSincronizacion();
}

let _procesando = false;

// Procesa todas las tareas pendientes en la cola
export async function procesarColaSincronizacion() {
  if (_procesando) return;
  if (!navigator.onLine) return; // Si sabemos que no hay internet, no intentamos
  
  const cola = obtenerColaSincronizacion();
  if (cola.length === 0) return;
  
  _procesando = true;
  console.log(`[ARJ Sync] Procesando cola con ${cola.length} tareas...`);
  
  const tareasPendientes = [];
  
  for (const tarea of cola) {
    try {
      let exito = false;
      
      if (tarea.tipo === 'FACTURA') {
        const { error } = await supabase.from('facturas').insert([tarea.payload]);
        exito = !error;
        if (error) console.error('[ARJ Sync] Error factura:', error.message);
      } 
      else if (tarea.tipo === 'CLIENTE') {
        const { error } = await supabase.from('clientes').insert([tarea.payload]);
        exito = !error;
        if (error) console.error('[ARJ Sync] Error cliente:', error.message);
      }
      else if (tarea.tipo === 'BITACORA') {
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
