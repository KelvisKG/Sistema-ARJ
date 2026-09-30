import { createClient } from '@supabase/supabase-js';

const url = "https://wbxrkygtakdmckfzlzjk.supabase.co";
const key = "sb_publishable_TSa5RRqbyCfeJomEoWI14g_EI6akCFh";
const supabase = createClient(url, key);

async function inspectColumns() {
  const { data, error } = await supabase.from('factura_items').select('*').limit(1);
  console.log('Factura items error:', error);
  console.log('Factura items row example / fields:', data);
}

inspectColumns();
