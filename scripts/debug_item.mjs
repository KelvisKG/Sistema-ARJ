import { createClient } from '@supabase/supabase-js';

const url = "https://wbxrkygtakdmckfzlzjk.supabase.co";
const key = "sb_publishable_TSa5RRqbyCfeJomEoWI14g_EI6akCFh";
const supabase = createClient(url, key);

async function checkItemInsert() {
  const { data: facs } = await supabase.from('facturas').select('id').limit(1);
  const { data: prods } = await supabase.from('productos').select('*').limit(1);

  const itemPayload = {
    factura_id: facs[0].id,
    producto_id: prods[0].id,
    cod_alt: prods[0].cod_alt,
    descripcion: prods[0].descripcion,
    cantidad: 1,
    costo_fob: prods[0].fob,
    precio_unit_usd: 95.00,
    subtotal_usd: 95.00
  };

  const { data, error } = await supabase.from('factura_items').insert([itemPayload]).select();
  console.log('Result data:', data);
  console.log('Result error:', error);
}

checkItemInsert();
