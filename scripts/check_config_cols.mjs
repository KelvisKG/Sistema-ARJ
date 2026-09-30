import { createClient } from '@supabase/supabase-js';

const prodUrl = "https://ahnzbmzzjvwyddiwdpss.supabase.co";
const prodKey = "sb_publishable_0xpS9KJi3LVwHySmkphvBA_KxNpY7Ep";
const supabase = createClient(prodUrl, prodKey);

async function checkConfigCols() {
  const possibleCols = ['id', 'tasa_bcv', 'tasa_par', 'tasa_cambio', 'dto_divisa', 'descuento_divisa', 'factor_landed_default', 'costos_fijos_mes', 'equipo', 'creado_en', 'actualizado_en'];
  for (const c of possibleCols) {
    const { error } = await supabase.from('configuracion').select(c).limit(1);
    if (!error) console.log(`Configuracion tiene columna: ${c}`);
  }
}

checkConfigCols();
