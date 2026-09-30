import { createClient } from '@supabase/supabase-js';

const prodUrl = "https://ahnzbmzzjvwyddiwdpss.supabase.co";
const prodKey = "sb_publishable_0xpS9KJi3LVwHySmkphvBA_KxNpY7Ep";
const supabase = createClient(prodUrl, prodKey);

async function initProdConfig() {
  const { data, error } = await supabase.from('configuracion').insert([{
    tasa_bcv: 58.50,
    tasa_par: 68.00,
    factor_landed_default: 1.471
  }]).select();

  console.log('Result data:', data);
  console.log('Result error:', error);
}

initProdConfig();
