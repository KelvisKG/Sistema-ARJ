import { createClient } from '@supabase/supabase-js';

const url = "https://wbxrkygtakdmckfzlzjk.supabase.co";
const key = "sb_publishable_TSa5RRqbyCfeJomEoWI14g_EI6akCFh";
const supabase = createClient(url, key);

async function seed() {
  console.log('--- SEEDING STAGING DATABASE (Exact Schema) ---');

  // 1. Configuracion
  const { data: cfgData, error: cfgErr } = await supabase.from('configuracion').upsert([
    {
      tasa_bcv: 58.50,
      tasa_par: 68.00,
      dto_divisa: 18.29,
      factor_landed_default: 1.471
    }
  ]);
  if (cfgErr) console.error('Error config:', cfgErr.message);
  else console.log('✅ Configuracion inicializada con tasas (BCV: 58.50, PAR: 68.00)');

  // 2. Productos
  const testProducts = [
    {
      cod_alt: 'BOM-JD-01',
      cod_orig: 'RE505980',
      descripcion: 'BOMBA DE AGUA JOHN DEERE 6068',
      sistema: 'REFRIGERACION',
      fob: 100.00,
      stock_vd: 10,
      stock_dist: 5,
      marca: 'JOHN DEERE',
      activo: true
    },
    {
      cod_alt: 'FIL-DON-02',
      cod_orig: 'P550388',
      descripcion: 'FILTRO DE ACEITE DONALDSON',
      sistema: 'FILTRACION',
      fob: 25.00,
      stock_vd: 20,
      stock_dist: 15,
      marca: 'DONALDSON',
      activo: true
    }
  ];

  for (const prod of testProducts) {
    const { data, error } = await supabase.from('productos').upsert(prod, { onConflict: 'cod_alt' }).select();
    if (error) console.error(`Error producto ${prod.cod_alt}:`, error.message);
    else console.log(`✅ Producto creado/actualizado: ${prod.cod_alt} (${prod.descripcion})`);
  }

  // 3. Clientes
  const testClients = [
    {
      rif: 'J-12345678-0',
      nombre: 'AGROPECUARIA EL PROGRESO C.A.',
      telefono: '0414-1234567',
      direccion: 'Calabozo, Guarico',
      nivel: 'T1',
      tipo_pago: 'credito',
      saldo_vd: 0.00,
      saldo_dist: 0.00,
      empresa: 'ambas',
      activo: true
    },
    {
      rif: 'V-98765432-1',
      nombre: 'TALLER MECANICO LOS LLANOS',
      telefono: '0424-7654321',
      direccion: 'Acarigua, Portuguesa',
      nivel: 'Publico',
      tipo_pago: 'contado',
      saldo_vd: 0.00,
      saldo_dist: 0.00,
      empresa: 'ambas',
      activo: true
    }
  ];

  for (const cli of testClients) {
    const { data, error } = await supabase.from('clientes').upsert(cli, { onConflict: 'rif' }).select();
    if (error) console.error(`Error cliente ${cli.rif}:`, error.message);
    else console.log(`✅ Cliente creado/actualizado: ${cli.rif} (${cli.nombre})`);
  }

  console.log('--- SEED COMPLETADO CON EXITO ---');
}

seed();
