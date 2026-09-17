// =====================================================================
// ARJ - Persistencia Local (Vue 3 / ES Module)
// =====================================================================

const ARJ_STORAGE_KEY = 'ARJ_DATOS_v1';
const ARJ_SCHEMA_VERSION = 1;

let _guardadoPendiente = null;

// Serializa solo los campos importantes del store para no guardar modales o UI state temporal
function serializarEstado(state) {
  return {
    schema_version: ARJ_SCHEMA_VERSION,
    fecha_guardado: new Date().toISOString(),
    
    // Tasas
    tasa_bcv: state.tasa_bcv,
    tasa_par: state.tasa_par,
    dto_divisa: state.dto_divisa,
    tasasConfirmadasHoy: state.tasasConfirmadasHoy,
    
    // Datos maestros
    productos: state.productos,
    clientes: state.clientes,
    facturasCobrar: state.facturasCobrar,
    todasFacturas: state.todasFacturas,
    presupuestos: state.presupuestos,
    apartados: state.apartados,
    notasCredito: state.notasCredito,
    movimientos: state.movimientos,
    embarques: state.embarques,
    turnos: state.turnos,
    turnoActual: state.turnoActual,
    bitacora: state.bitacora,
    favoritos: state.favoritos,
    
    // Carrito actual (para no perder una factura a medias)
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
    
    // Aplicar los datos al store usando $patch para reactividad
    store.$patch((state) => {
      
      if (datos.tasa_bcv) state.tasa_bcv = datos.tasa_bcv;
      if (datos.tasa_par) state.tasa_par = datos.tasa_par;
      if (datos.dto_divisa) state.dto_divisa = datos.dto_divisa;
      if (datos.tasasConfirmadasHoy !== undefined) state.tasasConfirmadasHoy = datos.tasasConfirmadasHoy;
      
      if (datos.productos) state.productos = datos.productos;
      if (datos.clientes) state.clientes = datos.clientes;
      if (datos.facturasCobrar) state.facturasCobrar = datos.facturasCobrar;
      if (datos.todasFacturas) state.todasFacturas = datos.todasFacturas;
      if (datos.presupuestos) state.presupuestos = datos.presupuestos;
      if (datos.apartados) state.apartados = datos.apartados;
      if (datos.notasCredito) state.notasCredito = datos.notasCredito;
      if (datos.movimientos) state.movimientos = datos.movimientos;
      if (datos.embarques) state.embarques = datos.embarques;
      if (datos.turnos) state.turnos = datos.turnos;
      if (datos.turnoActual !== undefined) state.turnoActual = datos.turnoActual;
      if (datos.bitacora) state.bitacora = datos.bitacora;
      if (datos.favoritos) state.favoritos = datos.favoritos;
      
      if (datos.carrito) state.carrito = datos.carrito;
    });
    
    return true;
  } catch (e) {
    console.error('[ARJ] Error cargando datos guardados:', e);
    return false;
  }
}
