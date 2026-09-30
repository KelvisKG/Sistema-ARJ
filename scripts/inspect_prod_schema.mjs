import { createClient } from '@supabase/supabase-js';

const prodUrl = "https://ahnzbmzzjvwyddiwdpss.supabase.co";
const prodKey = "sb_publishable_0xpS9KJi3LVwHySmkphvBA_KxNpY7Ep";
const supabase = createClient(prodUrl, prodKey);

const tables = [
  'configuracion',
  'productos',
  'clientes',
  'facturas',
  'factura_items',
  'pagos',
  'bitacora'
];

async function inspectSchema() {
  console.log('=== INSPECCIONANDO ESQUEMA DE PRODUCCIÓN ===\n');

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`❌ [${t}]: Error ${error.message}`);
    } else {
      console.log(`✅ [${t}]: Select exitoso`);
    }
  }

  // Probar qué columnas acepta configuracion
  const testColsConfig = ['tasa_bcv', 'tasa_par', 'factor_a', 'factor_b', 'factor_c', 'actualizado_en'];
  for (const c of testColsConfig) {
    const { error } = await supabase.from('configuracion').select(c).limit(1);
    console.log(`  configuracion.${c}: ${error ? '❌ ' + error.message : '✅ EXISTE'}`);
  }

  // Probar columnas de productos
  const testColsProd = ['id', 'cod_alt', 'cod_orig', 'descripcion', 'marca', 'fob', 'stock_vd', 'stock_dist', 'precio_a', 'precio_b', 'activo'];
  for (const c of testColsProd) {
    const { error } = await supabase.from('productos').select(c).limit(1);
    console.log(`  productos.${c}: ${error ? '❌ ' + error.message : '✅ EXISTE'}`);
  }

  // Probar columnas de clientes
  const testColsCli = ['id', 'nombre', 'rif', 'telefono', 'nivel', 'tipo_pago', 'saldo_vd', 'saldo_dist', 'empresa', 'activo'];
  for (const c of testColsCli) {
    const { error } = await supabase.from('clientes').select(c).limit(1);
    console.log(`  clientes.${c}: ${error ? '❌ ' + error.message : '✅ EXISTE'}`);
  }

  // Probar columnas de facturas
  const testColsFac = ['id', 'numero', 'empresa', 'cliente_nombre', 'cliente_id', 'vendedor', 'subtotal_usd', 'saldo_pendiente', 'estado', 'tipo_pago', 'dias_credito', 'tasa_bcv', 'tasa_par', 'cobrar_verde'];
  for (const c of testColsFac) {
    const { error } = await supabase.from('facturas').select(c).limit(1);
    console.log(`  facturas.${c}: ${error ? '❌ ' + error.message : '✅ EXISTE'}`);
  }
}

inspectSchema();
