import { createClient } from '@supabase/supabase-js';

const url = "https://wbxrkygtakdmckfzlzjk.supabase.co";
const key = "sb_publishable_TSa5RRqbyCfeJomEoWI14g_EI6akCFh";

const supabase = createClient(url, key);

const tablesToCheck = [
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
  'perfiles'
];

async function main() {
  console.log('=== DIAGNOSTICO DE TABLAS EN SUPABASE STAGING ===');
  console.log(`URL: ${url}`);
  
  for (const table of tablesToCheck) {
    try {
      const { data, error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`❌ [${table}]: ERROR - ${error.message} (Code: ${error.code})`);
      } else {
        console.log(`✅ [${table}]: EXISTE (Filas: ${count ?? 0})`);
      }
    } catch (err) {
      console.log(`💥 [${table}]: EXCEPTION - ${err.message}`);
    }
  }
}

main();
