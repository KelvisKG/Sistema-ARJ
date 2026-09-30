import { createClient } from '@supabase/supabase-js';

const projects = [
  {
    name: 'PRODUCCIÓN (.env - ahnzbmzzjvwyddiwdpss)',
    url: "https://ahnzbmzzjvwyddiwdpss.supabase.co",
    key: "sb_publishable_0xpS9KJi3LVwHySmkphvBA_KxNpY7Ep"
  },
  {
    name: 'STAGING / DEV (.env.development - wbxrkygtakdmckfzlzjk)',
    url: "https://wbxrkygtakdmckfzlzjk.supabase.co",
    key: "sb_publishable_TSa5RRqbyCfeJomEoWI14g_EI6akCFh"
  }
];

const tables = [
  'configuracion',
  'productos',
  'clientes',
  'facturas',
  'factura_items',
  'pagos',
  'cotizaciones',
  'bitacora',
  'notas_credito',
  'embarques',
  'usuarios',
  'inventario'
];

async function checkBoth() {
  for (const p of projects) {
    console.log(`\n======================================================`);
    console.log(`🔍 PROYECTO: ${p.name}`);
    console.log(`URL: ${p.url}`);
    console.log(`======================================================`);
    const sb = createClient(p.url, p.key);

    for (const t of tables) {
      try {
        const { data, count, error } = await sb.from(t).select('*', { count: 'exact' }).limit(3);
        if (error) {
          console.log(`❌ [${t}]: ${error.message}`);
        } else {
          console.log(`✅ [${t}]: ${count} filas`);
          if (data && data.length > 0) {
            console.log(`   └─ Primer registro: ${JSON.stringify(data[0]).slice(0, 120)}...`);
          }
        }
      } catch (e) {
        console.log(`💥 [${t}]: ${e.message}`);
      }
    }
  }
}

checkBoth();
