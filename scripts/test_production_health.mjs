import { createClient } from '@supabase/supabase-js';

const prodUrl = "https://ahnzbmzzjvwyddiwdpss.supabase.co";
const prodKey = "sb_publishable_0xpS9KJi3LVwHySmkphvBA_KxNpY7Ep";

const supabase = createClient(prodUrl, prodKey);

async function inspectProduction() {
  console.log('====================================================');
  console.log('🔍 PRE-FLIGHT AUDITORÍA: BASE DE DATOS DE PRODUCCIÓN');
  console.log(`URL: ${prodUrl}`);
  console.log('====================================================\n');

  // 1. Verificar Tablas Existentes y Cantidad de Registros
  const tables = [
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

  console.log('--- 1. ESTADO DE TABLAS CORE ---');
  for (const t of tables) {
    try {
      const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`❌ [${t}]: Error (${error.message})`);
      } else {
        console.log(`✅ [${t}]: OK (${count} registros existentes)`);
      }
    } catch (e) {
      console.log(`💥 [${t}]: Excepción (${e.message})`);
    }
  }

  // 2. Verificar Tasas de Cambio en Producción
  console.log('\n--- 2. CONFIGURACIÓN Y TASAS CAMBIARIAS REALES ---');
  const { data: cfg, error: eCfg } = await supabase.from('configuracion').select('*').limit(5);
  if (eCfg) {
    console.error('❌ Error leyendo configuracion:', eCfg.message);
  } else {
    console.log('✅ Configuracion cargada:', JSON.stringify(cfg, null, 2));
  }

  // 3. Inspeccionar Muestra de Productos Reales
  console.log('\n--- 3. MUESTRA DE PRODUCTOS (Verificación de Columnas y FOB) ---');
  const { data: prods, error: eP } = await supabase.from('productos').select('*').limit(3);
  if (eP) {
    console.error('❌ Error leyendo productos:', eP.message);
  } else if (prods?.length > 0) {
    console.log(`✅ ${prods.length} productos analizados:`);
    prods.forEach(p => {
      console.log(`  - [${p.cod_alt}] ${p.descripcion?.slice(0, 40)}... | FOB: $${p.fob} | Stock VD: ${p.stock_vd} | Stock Dist: ${p.stock_dist}`);
    });
  } else {
    console.log('ℹ️ No hay productos en la tabla productos');
  }

  // 4. Inspeccionar Muestra de Clientes Reales
  console.log('\n--- 4. MUESTRA DE CLIENTES (Verificación de Tiers y Saldos) ---');
  const { data: clis, error: eC } = await supabase.from('clientes').select('*').limit(3);
  if (eC) {
    console.error('❌ Error leyendo clientes:', eC.message);
  } else if (clis?.length > 0) {
    console.log(`✅ ${clis.length} clientes analizados:`);
    clis.forEach(c => {
      console.log(`  - ${c.nombre} (RIF: ${c.rif}) | Tier/Nivel: ${c.nivel} | Tipo: ${c.tipo_pago} | Saldo VD: $${c.saldo_vd} | Saldo Dist: $${c.saldo_dist}`);
    });
  } else {
    console.log('ℹ️ No hay clientes en la tabla clientes');
  }

  // 5. Inspeccionar Muestra de Facturas e Items
  console.log('\n--- 5. ESTRUCTURA DE FACTURAS E ITEMS REALES ---');
  const { data: facs, error: eF } = await supabase.from('facturas').select('*').order('id', { ascending: false }).limit(2);
  if (eF) {
    console.error('❌ Error leyendo facturas:', eF.message);
  } else if (facs?.length > 0) {
    console.log(`✅ Últimas facturas en producción:`);
    for (const f of facs) {
      console.log(`  - Factura ${f.numero} | Empresa: ${f.empresa} | Cliente: ${f.cliente_nombre} | Total: $${f.subtotal_usd} | Estado: ${f.estado}`);
      const { data: items } = await supabase.from('factura_items').select('*').eq('factura_id', f.id);
      console.log(`    └─ Items asociados: ${items?.length ?? 0} renglones`);
    }
  } else {
    console.log('ℹ️ Sin facturas previas en producción');
  }

  console.log('\n====================================================');
  console.log('AUDITORÍA PRE-FLIGHT DE PRODUCCIÓN COMPLETADA');
  console.log('====================================================\n');
}

inspectProduction();
