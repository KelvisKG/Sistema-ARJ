import { createClient } from '@supabase/supabase-js';
import { PRECIOS_TIER, precioConTier, redondeoBonito, precioPublico } from '../src/services/pricing.js';
import { guardarFacturaEnSupabase, anularFacturaEnSupabase } from '../src/services/supabase.js';

const url = "https://wbxrkygtakdmckfzlzjk.supabase.co";
const key = "sb_publishable_TSa5RRqbyCfeJomEoWI14g_EI6akCFh";
const supabase = createClient(url, key);

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

async function testPricingLogic() {
  console.log('\n========================================');
  console.log('TEST 1: MOTOR DE PRECIOS Y TIERS (v13.39 Legacy)');
  console.log('========================================');

  // 1. Tiers factors
  assert(PRECIOS_TIER.Publico === 1.00, 'Tier Publico es factor 1.00');
  assert(PRECIOS_TIER.T1 === 0.95, 'Tier T1 (repuestero) es factor 0.95 (-5%)');
  assert(PRECIOS_TIER.T2 === 0.90, 'Tier T2 es factor 0.90 (-10%)');
  assert(PRECIOS_TIER.T3 === 0.80, 'Tier T3 (distribuidor) es factor 0.80 (-20%)');

  // 2. Centavo Exacto
  assert(redondeoBonito(123.456) === 123.46, 'redondeoBonito(123.456) redondea exactamente al centavo 123.46');
  assert(redondeoBonito(10.001) === 10.00, 'redondeoBonito(10.001) redondea a 10.00 sin redondeos artísticos hacia arriba');
  assert(redondeoBonito(99.99) === 99.99, 'redondeoBonito(99.99) se preserva');

  // 3. precioConTier con precio_manual
  const prodManual = { precio_manual: 100.00 };
  assert(precioConTier(0, 'Publico', prodManual) === 100.00, 'precioConTier base $100 en Publico da $100.00');
  assert(precioConTier(0, 'T1', prodManual) === 95.00, 'precioConTier base $100 en T1 da $95.00');
  assert(precioConTier(0, 'T2', prodManual) === 90.00, 'precioConTier base $100 en T2 da $90.00');
  assert(precioConTier(0, 'T3', prodManual) === 80.00, 'precioConTier base $100 en T3 da $80.00');

  // 4. precioConTier con FOB directo (FOB = $40 -> Multiplicador 2.5 = $100)
  assert(precioPublico(40.00) === 100.00, 'FOB $40 produce precio público $100.00');
  assert(precioConTier(40.00, 'T1') === 95.00, 'precioConTier FOB $40 en T1 da $95.00');
}

async function testFacturacionContadoFlow() {
  console.log('\n========================================');
  console.log('TEST 2: EMISIÓN DE FACTURA DE CONTADO (4 TABLAS ATÓMICAS)');
  console.log('========================================');

  const { data: prods } = await supabase.from('productos').select('*').limit(1);
  const { data: clis } = await supabase.from('clientes').select('*').limit(1);
  
  if (!prods?.length || !clis?.length) {
    console.error('No hay productos o clientes para testear');
    totalFailed++;
    return;
  }

  const producto = prods[0];
  const cliente = clis[0];
  const stockInicial = producto.stock_vd;
  const cantFacturar = 2;
  const numFactura = `FAC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

  console.log(`- Producto: ${producto.cod_alt} (ID: ${producto.id}) | Stock Inicial VD: ${stockInicial}`);
  console.log(`- Cliente: ${cliente.nombre} (ID: ${cliente.id})`);
  console.log(`- Facturando ${cantFacturar} unidades con correlativo: ${numFactura}`);

  const facturaObj = {
    num: numFactura,
    empresa: 'directa',
    cliente: cliente.nombre,
    cliente_id: cliente.id,
    vendedor: 'QA Tester Senior',
    total: 190.00,
    saldo_pendiente: 0.00,
    estado: 'pagada',
    tipo_pago: 'contado',
    dias: 0,
    tasa_bcv: 58.50,
    tasa_par: 68.00,
    factor_bs: 1.00,
    cobrar_verde: 171.00,
    tier: 'Publico'
  };

  const itemsArray = [
    {
      id: producto.id,
      cod_alt: producto.cod_alt,
      desc: producto.descripcion,
      cant: cantFacturar,
      fob: producto.fob,
      precio: 95.00,
      origen: producto.origen || 'importado'
    }
  ];

  const pagosArray = [
    {
      monto_usd: 190.00,
      monto_bs: 11115.00,
      tasa_usada: 58.50,
      metodo: 'Divisas Efectivo',
      referencia: 'PAGO-E2E-01'
    }
  ];

  const resultado = await guardarFacturaEnSupabase(facturaObj, itemsArray, pagosArray, 'directa');
  assert(resultado.ok === true, `guardarFacturaEnSupabase completó con éxito (Factura ID: ${resultado.data?.id})`);

  if (!resultado.data) return;
  const facturaId = resultado.data.id;

  // 1. Verificar Factura en BD
  const { data: facCheck } = await supabase.from('facturas').select('*').eq('id', facturaId).single();
  assert(facCheck && facCheck.numero === numFactura, `Tabla 'facturas': Fila guardada con número ${numFactura}`);

  // 2. Verificar Items en BD
  const { data: itemsCheck } = await supabase.from('factura_items').select('*').eq('factura_id', facturaId);
  assert(itemsCheck && itemsCheck.length === 1 && itemsCheck[0].cantidad === cantFacturar, 
    `Tabla 'factura_items': ${itemsCheck?.length} renglón(es) guardado(s) vinculados a la factura`);

  // 3. Verificar Stock deducido en BD
  const { data: prodCheck } = await supabase.from('productos').select('*').eq('id', producto.id).single();
  const nuevoStockEsperado = stockInicial - cantFacturar;
  assert(prodCheck && prodCheck.stock_vd === nuevoStockEsperado, 
    `Tabla 'productos': Stock VD descontado de ${stockInicial} a ${prodCheck?.stock_vd}`);

  // 4. Verificar Pago en BD
  const { data: pagosCheck } = await supabase.from('pagos').select('*').eq('factura_id', facturaId);
  assert(pagosCheck && pagosCheck.length === 1 && parseFloat(pagosCheck[0].monto_usd) === 190.00, 
    `Tabla 'pagos': Pago registrado por $${pagosCheck?.[0]?.monto_usd}`);

  return { facturaId, numFactura, producto, cantFacturar, stockInicial, cliente };
}

async function testAnulacionFlow(context) {
  if (!context) return;
  console.log('\n========================================');
  console.log('TEST 3: ANULACIÓN DE FACTURA Y REVERSIÓN ATÓMICA DE STOCK');
  console.log('========================================');

  const { facturaId, numFactura, producto, stockInicial } = context;

  const resAnulacion = await anularFacturaEnSupabase(facturaId, 'Prueba de anulación automatizada QA', 'QA Tester Senior', 'directa');
  assert(resAnulacion.ok === true, `anularFacturaEnSupabase ejecutado con éxito`);

  const { data: facAnulada } = await supabase.from('facturas').select('estado, motivo_anulacion').eq('id', facturaId).single();
  assert(facAnulada && facAnulada.estado === 'anulada', `Tabla 'facturas': Estado actualizado a 'anulada'`);

  const { data: prodRestaurado } = await supabase.from('productos').select('stock_vd').eq('id', producto.id).single();
  assert(prodRestaurado && prodRestaurado.stock_vd === stockInicial, 
    `Tabla 'productos': Stock VD restituido a su valor inicial de ${stockInicial}`);
}

async function testFacturacionCreditoYAbonoFlow() {
  console.log('\n========================================');
  console.log('TEST 4: EMISIÓN A CRÉDITO, ABONO PARCIAL Y CANCELACIÓN TOTAL');
  console.log('========================================');

  const { data: clis } = await supabase.from('clientes').select('*').limit(1);
  const cliente = clis[0];
  const saldoInicial = parseFloat(cliente.saldo_dist || 0);
  const totalCredito = 400.00;
  const numFacturaCredito = `FAC-CR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

  const facturaCreditoObj = {
    num: numFacturaCredito,
    empresa: 'distribuidora',
    cliente: cliente.nombre,
    cliente_id: cliente.id,
    vendedor: 'QA Tester Senior',
    total: totalCredito,
    saldo_pendiente: totalCredito,
    estado: 'pendiente',
    tipo_pago: 'credito',
    dias: 15,
    tasa_bcv: 58.50,
    tasa_par: 68.00,
    tier: 'T1'
  };

  // 1. Emitir factura a crédito
  const resultado = await guardarFacturaEnSupabase(facturaCreditoObj, [], [], 'distribuidora');
  assert(resultado.ok === true, `Factura a crédito ${numFacturaCredito} emitida`);

  const facturaId = resultado.data.id;

  // Actualizar saldo deudor del cliente en BD
  const saldoConCredito = Math.round((saldoInicial + totalCredito) * 100) / 100;
  await supabase.from('clientes').update({ saldo_dist: saldoConCredito }).eq('id', cliente.id);

  const { data: cliAfterCred } = await supabase.from('clientes').select('saldo_dist').eq('id', cliente.id).single();
  assert(parseFloat(cliAfterCred.saldo_dist) === saldoConCredito, `Saldo del cliente incrementado a $${saldoConCredito}`);

  // 2. Registrar Abono Parcial ($150)
  const montoAbono = 150.00;
  const saldoTrasAbono = totalCredito - montoAbono; // $250.00
  
  // Insertar en 'pagos'
  const { data: pagoParcial, error: errP } = await supabase.from('pagos').insert([{
    factura_id: facturaId,
    monto_usd: montoAbono,
    monto_bs: Math.round(montoAbono * 58.50 * 100) / 100,
    tasa_usada: 58.50,
    metodo: 'pago_movil',
    referencia: 'REF-ABONO-001',
    registrado_por: 'QA Tester Senior'
  }]).select();
  assert(!errP && pagoParcial.length > 0, `Tabla 'pagos': Abono parcial de $${montoAbono} registrado`);

  // Actualizar 'facturas' a estado 'parcial'
  await supabase.from('facturas').update({
    saldo_pendiente: saldoTrasAbono,
    estado: 'parcial'
  }).eq('id', facturaId);

  const { data: facParcial } = await supabase.from('facturas').select('saldo_pendiente, estado').eq('id', facturaId).single();
  assert(parseFloat(facParcial.saldo_pendiente) === saldoTrasAbono && facParcial.estado === 'parcial', 
    `Tabla 'facturas': Saldo pendiente actualizado a $${saldoTrasAbono} y estado 'parcial'`);

  // Actualizar saldo deudor en 'clientes'
  const saldoCliTrasAbono = Math.round((saldoConCredito - montoAbono) * 100) / 100;
  await supabase.from('clientes').update({ saldo_dist: saldoCliTrasAbono }).eq('id', cliente.id);

  const { data: cliFinal } = await supabase.from('clientes').select('saldo_dist').eq('id', cliente.id).single();
  assert(parseFloat(cliFinal.saldo_dist) === saldoCliTrasAbono, `Saldo del cliente reducido a $${saldoCliTrasAbono}`);

  // 3. Registrar Pago Final del Saldo Restante ($250)
  const montoFinal = saldoTrasAbono;
  await supabase.from('pagos').insert([{
    factura_id: facturaId,
    monto_usd: montoFinal,
    monto_bs: Math.round(montoFinal * 58.50 * 100) / 100,
    tasa_usada: 58.50,
    metodo: 'dolar_efectivo',
    referencia: 'REF-FINAL-002',
    registrado_por: 'QA Tester Senior'
  }]);

  await supabase.from('facturas').update({
    saldo_pendiente: 0.00,
    estado: 'pagada'
  }).eq('id', facturaId);

  const { data: facPagada } = await supabase.from('facturas').select('saldo_pendiente, estado').eq('id', facturaId).single();
  assert(parseFloat(facPagada.saldo_pendiente) === 0 && facPagada.estado === 'pagada', 
    `Tabla 'facturas': Factura liquidada al 100% (saldo $0.00 y estado 'pagada')`);
}

async function runAll() {
  console.log('🏁 INICIANDO SUITE DE PRUEBAS AUTOMATIZADAS DE FACTURACIÓN (STAGING)...');
  await testPricingLogic();
  const context = await testFacturacionContadoFlow();
  await testAnulacionFlow(context);
  await testFacturacionCreditoYAbonoFlow();

  console.log('\n========================================');
  console.log(`RESULTADO FINAL: ${totalPassed} PASADAS, ${totalFailed} FALLADAS`);
  console.log('========================================\n');
}

runAll();
