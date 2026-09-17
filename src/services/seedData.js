// === ARJ Seed Data (Catálogo base agrícola y clientes) ===
// Proporciona datos de inicio para pruebas, modo demostración o cuando Supabase devuelve 0 filas por RLS.

export const DEFAULT_PRODUCTOS = [];

export const DEFAULT_CLIENTES = [];

export const DEFAULT_FACTURAS_COBRAR = [];

function cargarProductosSemilla() {
  PRODUCTOS.length = 0;
  DEFAULT_PRODUCTOS.forEach(p => PRODUCTOS.push(Object.assign({}, p)));
  console.log('[ARJ] Catálogo semilla cargado: ' + PRODUCTOS.length + ' productos agrícolas.');
}

function cargarClientesSemilla() {
  CLIENTES.length = 0;
  DEFAULT_CLIENTES.forEach(c => CLIENTES.push(JSON.parse(JSON.stringify(c))));
  console.log('[ARJ] Clientes semilla cargados: ' + CLIENTES.length + ' clientes.');
}

function cargarFacturasSemilla() {
  if (FACTURAS_COBRAR.length === 0) {
    DEFAULT_FACTURAS_COBRAR.forEach(f => {
      FACTURAS_COBRAR.push(Object.assign({}, f));
      TODAS_FACTURAS.push(Object.assign({}, f));
      VENTAS_RECIENTES.push({
        id: f.id,
        num: f.num,
        cliente: f.cliente,
        fecha: f.fecha,
        total: f.total,
        vendedor: f.vendedor,
        estado: f.estado
      });
    });
    console.log('[ARJ] Facturas semilla cargadas: ' + FACTURAS_COBRAR.length + ' cuentas por cobrar.');
  }
}
