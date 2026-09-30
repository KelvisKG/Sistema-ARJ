import { createClient } from '@supabase/supabase-js';

const prodUrl = "https://ahnzbmzzjvwyddiwdpss.supabase.co";
const prodKey = "sb_publishable_0xpS9KJi3LVwHySmkphvBA_KxNpY7Ep";
const supabase = createClient(prodUrl, prodKey);

// Lista amplia de posibles tablas en producción
const candidateTables = [
  'configuracion',
  'productos',
  'clientes',
  'contactos_cliente',
  'facturas',
  'factura_items',
  'pagos',
  'cotizaciones',
  'cotizacion_items',
  'sistemas',
  'bitacora',
  'movimientos_caja',
  'traspasos',
  'traspaso_items',
  'perfiles',
  'apartados',
  'apartado_items',
  'notas_credito',
  'nota_credito_items',
  'embarques',
  'embarque_items',
  'proveedores',
  'marcas',
  'modelos',
  'metas',
  'turnos',
  'usuarios',
  'cierres_caja',
  'kardex',
  'inventario'
];

async function deepInspect() {
  console.log('===========================================================');
  console.log('🔬 DEEP INSPECTION DE LA BASE DE DATOS REAL DE PRODUCCIÓN');
  console.log(`URL: ${prodUrl}`);
  console.log('===========================================================\n');

  const existingTables = [];

  for (const table of candidateTables) {
    try {
      const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' }).limit(2);
      if (error) {
        if (!error.message.includes('does not exist') && !error.message.includes('schema cache')) {
          console.log(`⚠️ [${table}]: Error -> ${error.message} (Code: ${error.code})`);
        }
      } else {
        existingTables.push(table);
        console.log(`\n===========================================================`);
        console.log(`📦 TABLA: "${table}" (${count ?? 0} registros)`);
        console.log(`===========================================================`);
        if (data && data.length > 0) {
          console.log(`Columnas detectadas: ${Object.keys(data[0]).join(', ')}`);
          console.log('Muestra (primer registro):');
          console.log(JSON.stringify(data[0], null, 2));
        } else {
          console.log(`(Tabla vacía, consultando estructura de columnas...)`);
        }
      }
    } catch (e) {
      console.log(`💥 [${table}]: Excepción -> ${e.message}`);
    }
  }

  console.log('\n\n===========================================================');
  console.log(`RESUMEN: ${existingTables.length} TABLAS CONFIRMADAS EN PRODUCCIÓN:`);
  console.log(existingTables.join(', '));
  console.log('===========================================================\n');
}

deepInspect();
