// =====================================================================
// ARJ - Persistencia Local (Vue 3 / ES Module)
// Solo preferencias de este equipo: carrito en progreso, favoritos y turnos
// de caja. La base de datos es la ÚNICA fuente de verdad para productos,
// clientes, facturas, tasas y su confirmación diaria (M5, C-09).
// =====================================================================

const ARJ_STORAGE_KEY = 'ARJ_DATOS_v2';
const ARJ_SCHEMA_VERSION = 2;

let _guardadoPendiente = null;

function serializarEstado(state) {
  return {
    schema_version: ARJ_SCHEMA_VERSION,
    fecha_guardado: new Date().toISOString(),
    // Usuario dueño de este carrito: otro usuario no lo hereda
    usuario: state.perfil ? state.perfil.id : null,
    favoritos: state.favoritos,
    turnos: state.turnos,
    carrito: state.carrito
  };
}

export function guardarDatosLocal(state) {
  if (!state.autenticado) return;
  if (_guardadoPendiente) clearTimeout(_guardadoPendiente);
  _guardadoPendiente = setTimeout(() => {
    _guardadoPendiente = null;
    try {
      localStorage.setItem(ARJ_STORAGE_KEY, JSON.stringify(serializarEstado(state)));
    } catch (e) {
      console.error('[ARJ] Error guardando en localStorage:', e);
    }
  }, 300);
}

export function cargarDatosLocal(store) {
  try {
    localStorage.removeItem('ARJ_DATOS_v1'); // formato viejo: traía tasas "confirmadas" por equipo
    localStorage.removeItem('ARJ_TASAS');
    localStorage.removeItem('arj_sesion');   // C-05: el rol nunca se lee del navegador
    const raw = localStorage.getItem(ARJ_STORAGE_KEY);
    if (!raw) return false;
    const datos = JSON.parse(raw);
    if (!datos || datos.schema_version !== ARJ_SCHEMA_VERSION) return false;
    if (!store.perfil || datos.usuario !== store.perfil.id) return false;

    store.$patch(state => {
      if (Array.isArray(datos.favoritos)) state.favoritos = datos.favoritos;
      if (Array.isArray(datos.turnos)) state.turnos = datos.turnos;
      if (datos.carrito && Array.isArray(datos.carrito.items) && datos.carrito.items.length > 0) {
        state.carrito = { ...state.carrito, ...datos.carrito };
      }
    });
    return true;
  } catch (e) {
    console.error('[ARJ] Error cargando datos guardados:', e);
    return false;
  }
}
