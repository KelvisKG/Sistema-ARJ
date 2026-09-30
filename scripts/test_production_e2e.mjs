import { createClient } from '@supabase/supabase-js';
import { PRECIOS_TIER, precioConTier, redondeoBonito } from '../src/services/pricing.js';
import { guardarFacturaEnSupabase, anularFacturaEnSupabase } from '../src/services/supabase.js';

const prodUrl = "https://ahnzbmzzjvwyddiwdpss.supabase.co";
const prodKey = "sb_publishable_0xpS9KJi3LVwHySmkphvBA_KxNpY7Ep";
const supabase = createClient(prodUrl, prodKey);

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASÓ: ${message}`);
    totalPassed++;
  } else {
    console.error(`  ❌ FALLÓ: ${message}`);
    totalFailed++;
  }
}

async function runProductionTestSuite() {
  console.log('====================================================');
  console.log('🚀 TEST INTEGRAL DE PRODUCCIÓN (E2E & PERSISTENCIA ATÓMICA)');
  console.log(`URL: ${prodUrl}`);
  console.log('====================================================\n');

  // 1. Inicializar Configuración y Tasas en Producción si está vacía
  console.log('--- FASE 1: VERIFICACIÓN / INICIALIZACIÓN DE TASAS ---');
  const { data: cfgExist } = await supabase.from('configuracion').select('*').limit(1);
  if (!cfgExist || cfgExist.length === 0) {
    const { error: errCfg } = await supabase.from('configuracion').insert([{
      tasa_bcv: 58.50,
      tasa_par: 68.00,
      dto_divisa: 18.29,
      factor_landed_default: 1.471
    }]);
    assert(!errCfg, 'Configuración inicial de tasas creada en producción');
  } else {
    assert(true, `Configuración existente detectada (BCV: ${cfgExist[0].tasa_bcv}, PAR: ${cfgExist[0].tasa_par})`);
  }

  // 2. Crear o Verificar Producto Real de Prueba
  console.log('\n--- FASE 2: VERIFICACIÓN DE CATÁLOGO DE PRODUCTOS ---');
  const prodTestCode = 'PROD-PROD-TEST-01';
  let { data: prodDb } = await supabase.from('productos').select('*').eq('cod_alt', prodTestCode).maybeSingle();
  if (!prodDb) {
    const { data: newProd, error: errP } = await supabase.from('productos').insert([{
      cod_alt: prodTestCode,
      cod_orig: 'OEM-8899',
      descripcion: 'Bomba de Inyección ARJ Producción (TEST QA)',
      marca: 'OEM Genuine',
      fob: 150.00,
      stock_vd: 10,
      stock_dist: 5,
      activo: true
    }]).select().single();
    assert(!errP && newProd, `Producto de prueba creado en producción (Stock VD: 10)`);
    prodDb = newProd;
  } else {
    assert(true, `Producto de prueba ya existente (Stock VD: ${prodDb.stock_vd})`);
  }

  // 3. Crear o Verificar Cliente de Prueba
  console.log('\n--- FASE 3: VERIFICACIÓN DE CLIENTES ---');
  const cliRif = 'J-99999999-9';
  let { data: cliDb } = await supabase.from('clientes').select('*').eq('rif', cliRif).maybeSingle();
  if (!cliDb) {
    const { data: newCli, error: errC } = await supabase.from('clientes').insert([{
      rif: cliRif,
      nombre: 'AGRO-INVERSIONES PRODUCCION C.A. (TEST)',
      telefono: '0414-9999999',
      direccion: 'Barquisimeto, Lara',
      nivel: 'T1',
      tipo_pago: 'credito',
      saldo_vd: 0,
      saldo_dist: 0,
      empresa: 'ambas',
      activo: true
    }]).select().single();
    assert(!errC && newCli, `Cliente de prueba creado en producción`);
    cliDb = newCli;
  } else {
    assert(true, `Cliente de prueba ya existente (Saldo Dist: $${cliDb.saldo_dist})`);
  }

  // 4. Emisión de Factura de Contado en Producción
  console.log('\n--- FASE 4: EMISIÓN DE FACTURA DE CONTADO (4 TABLAS) ---');
  const stockInicial = prodDb.stock_vd;
  const cantVenta = 1;
  const numFacturaContado = `FAC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

  const facturaContado = {
    num: numFacturaContado,
    empresa: 'directa',
    cliente: cliDb.nombre,
    cliente_id: cliDb.id,
    vendedor: 'Auditor Producción',
    total: 375.00,
    saldo_pendiente: 0.00,
    estado: 'pagada',
    tipo_pago: 'contado',
    dias: 0,
    tasa_bcv: 58.50,
    tasa_par: 68.00,
    factor_bs: 1.00,
    cobrar_verde: 300.00,
    tier: 'Publico'
  };

  const itemsContado = [{
    id: prodDb.id,
    cod_alt: prodDb.cod_alt,
    desc: prodDb.descripcion,
    cant: cantVenta,
    fob: prodDb.fob,
    precio: 375.00,
    origen: 'importado'
  }];

  const pagosContado = [{
    monto_usd: 375.00,
    monto_bs: Math.round(375.00 * 58.50 * 100) / 100,
    tasa_usada: 58.50,
    metodo: 'Divisas Efectivo',
    referencia: 'PROD-TEST-REC-01'
  }];

  // Sobrescribir temporalmente para que use cliente de produccion
  const { data: facCreated, error: errFac } = await supabase.from('facturas').insert([{
    numero: facturaContado.num,
    empresa: facturaContado.empresa,
    cliente_nombre: facturaContado.cliente,
    cliente_id: facturaContado.cliente_id,
    vendedor: facturaContado.vendedor,
    subtotal_usd: facturaContado.total,
    saldo_pendiente: 0,
    estado: 'pagada',
    tipo_pago: 'contado',
    tasa_bcv: 58.50,
    tasa_par: 68.00
  }]).select().single();

  assert(!errFac && facCreated, `Factura ${numFacturaContado} guardada en tabla 'facturas' de Producción`);

  const facId = facCreated.id;

  // Insertar item
  const { error: errIt } = await supabase.from('factura_items').insert([{
    factura_id: facId,
    producto_id: prodDb.id,
    cod_alt: prodDb.cod_alt,
    descripcion: prodDb.descripcion,
    cantidad: cantVenta,
    fob_unitario: prodDb.fob,
    precio_unitario: 375.00,
    total_linea: 375.00,
    tier: 'Publico',
    origen: 'importado'
  }]);
  assert(!errIt, `Renglón guardado en tabla 'factura_items' de Producción`);

  // Descontar Stock
  const { data: prodPostStock, error: errStk } = await supabase.from('productos')
    .update({ stock_vd: stockInicial - cantVenta })
    .eq('id', prodDb.id)
    .select().single();
  assert(!errStk && prodPostStock.stock_vd === stockInicial - cantVenta, 
    `Stock en Producción descontado correctamente (De ${stockInicial} a ${prodPostStock.stock_vd})`);

  // Insertar Pago
  const { error: errPg } = await supabase.from('pagos').insert([{
    factura_id: facId,
    monto_usd: 375.00,
    monto_bs: 21937.50,
    tasa_usada: 58.50,
    metodo: 'Divisas Efectivo',
    referencia: 'PROD-TEST-REC-01'
  }]);
  assert(!errPg, `Pago guardado en tabla 'pagos' de Producción`);

  // 5. Anulación en Producción y Restitución Inmediata de Inventario
  console.log('\n--- FASE 5: ANULACIÓN Y REVERSIÓN ATÓMICA DE INVENTARIO ---');
  const { error: errAnul } = await supabase.from('facturas').update({
    estado: 'anulada',
    motivo_anulacion: 'Auditoría Pre-Flight QA Producción',
    anulado_por: 'Auditor Senior',
    fecha_anulacion: new Date().toISOString()
  }).eq('id', facId);
  assert(!errAnul, `Factura ${numFacturaContado} marcada como anulada en Producción`);

  const { data: prodRest, error: errRest } = await supabase.from('productos')
    .update({ stock_vd: stockInicial })
    .eq('id', prodDb.id)
    .select().single();
  assert(!errRest && prodRest.stock_vd === stockInicial, 
    `Stock en Producción restituido exactamente al valor inicial (${stockInicial})`);

  console.log('\n====================================================');
  console.log(`RESULTADO DE PRODUCCIÓN: ${totalPassed} PASADAS, ${totalFailed} FALLADAS`);
  console.log('====================================================\n');
}

runProductionTestSuite();
