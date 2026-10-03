// =====================================================================
// ARJ - Persistencia Local (Vue 3 / ES Module)
// =====================================================================

const ARJ_STORAGE_KEY = 'ARJ_DATOS_v1';
const ARJ_SCHEMA_VERSION = 1;

let _guardadoPendiente = null;

// Serializa solo preferencias de pantalla y carrito en progreso
// La base de datos es la ÚNICA fuente de verdad para productos, clientes y facturas (M5)
function serializarEstado(state) {
  return {
    schema_version: ARJ_SCHEMA_VERSION,
    fecha_guardado: new Date().toISOString(),
    
    // Tasas locales fijadas
    tasa_bcv: state.tasa_bcv,
    tasa_par: state.tasa_par,
    dto_divisa: state.dto_divisa,
    tasasConfirmadasHoy: state.tasasConfirmadasHoy,
    fechaConfirmacionTasas: state.fechaConfirmacionTasas,
    
    // Preferencias de usuario
    favoritos: state.favoritos,
    turnoActual: state.turnoActual,
    
    // Carrito actual (para no perder una factura a medias al refrescar)
    carrito: state.carrito
  };
}

export function guardarDatosLocal(state) {
  if (_guardadoPendiente) clearTimeout(_guardadoPendiente);
  
  _guardadoPendiente = setTimeout(() => {
    try {
      const json = JSON.stringify(serializarEstado(state));
      localStorage.setItem(ARJ_STORAGE_KEY, json);
      _guardadoPendiente = null;
    } catch (e) {
      _guardadoPendiente = null;
      console.error('[ARJ] Error guardando en localStorage:', e);
    }
  }, 300); // 300ms debounce
}

export function cargarDatosLocal(store) {
  try {
    const raw = localStorage.getItem(ARJ_STORAGE_KEY);
    if (!raw) return false;
    
    const datos = JSON.parse(raw);
    if (!datos || typeof datos !== 'object') return false;
    
    // Aplicar solo tasas, preferencias y carrito en progreso
    store.$patch((state) => {
      if (datos.tasa_bcv) state.tasa_bcv = datos.tasa_bcv;
      if (datos.tasa_par) state.tasa_par = datos.tasa_par;
      if (datos.dto_divisa) state.dto_divisa = datos.dto_divisa;
      
      // M1: Debe confirmar tasas hoy formalmente (solo persiste si fue ratificada en la misma fecha calendario)
      const hoy = new Date().toISOString().slice(0, 10);
      if (datos.fechaConfirmacionTasas === hoy && datos.tasasConfirmadasHoy === true) {
        state.tasasConfirmadasHoy = true;
        state.fechaConfirmacionTasas = hoy;
      } else {
        state.tasasConfirmadasHoy = false;
        state.fechaConfirmacionTasas = null;
      }
      if (datos.favoritos) state.favoritos = datos.favoritos;
      if (datos.turnoActual !== undefined) state.turnoActual = datos.turnoActual;
      if (datos.carrito && datos.carrito.items && datos.carrito.items.length > 0) {
        state.carrito = datos.carrito;
      }
    });
    
    return true;
  } catch (e) {
    console.error('[ARJ] Error cargando datos guardados:', e);
    return false;
  }
}
