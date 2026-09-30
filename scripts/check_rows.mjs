import { createClient } from '@supabase/supabase-js';

const url = "https://wbxrkygtakdmckfzlzjk.supabase.co";
const key = "sb_publishable_TSa5RRqbyCfeJomEoWI14g_EI6akCFh";
const supabase = createClient(url, key);

async function checkData() {
  const { data: p, error: ep } = await supabase.from('productos').select('*');
  const { data: c, error: ec } = await supabase.from('clientes').select('*');
  const { data: cfg, error: ecfg } = await supabase.from('configuracion').select('*');
  
  console.log('Productos:', p?.length ?? 0, 'Error:', ep?.message);
  console.log('Clientes:', c?.length ?? 0, 'Error:', ec?.message);
  console.log('Config:', cfg?.length ?? 0, 'Error:', ecfg?.message);
}

checkData();
