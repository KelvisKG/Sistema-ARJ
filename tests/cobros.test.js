import { describe, test, expect } from 'vitest';
import {
  totalesCarrito, faltaPorPagar, montoParaCompletar, resumenEmision, pagosParaBD,
  parseMontoVE, calcularAbono, objetivoEfectivo, monedaDeMetodo
} from '../src/services/cobros.js';
import { precioPublico, dtoDivisaPct, dtoDivisaNeutro, redondeoBonito } from '../src/services/pricing.js';
import { fechaLocalISO, esHoyVE } from '../src/services/fechas.js';

// Tasas reales del volcado de configuracion (29-sep-2026)
const est = (extra = {}) => ({ tasa_bcv: 857.89, tasa_par: 980, dto_divisa: null, cobrar_verde: null, ...extra });
const items500 = [{ cant: 1, precio: 500 }];

describe('precio público (redondeo $0,50 hacia arriba)', () => {
  test('FOB 3,13 → $13,00 como el monolito', () => expect(precioPublico(3.13)).toBe(13));
  test('redondeo exacto no sube', () => expect(redondeoBonito(12.5)).toBe(12.5));
  test('FOB 0 → 0', () => expect(precioPublico(0)).toBe(0));
});

describe('descuento por divisas', () => {
  test('null usa la brecha del día (C-10)', () => {
    expect(dtoDivisaPct(est())).toBeCloseTo(dtoDivisaNeutro(est()), 6);
    expect(dtoDivisaPct(est())).toBeGreaterThan(12);
  });
  test('0 explícito se respeta', () => expect(dtoDivisaPct(est({ dto_divisa: 0 }))).toBe(0));
});

describe('emisión: fracciones por moneda (regresión v13.12 / C-03)', () => {
  test('pagar en Bs exactamente lo anunciado (USD × BCV) cubre la factura', () => {
    const t = totalesCarrito(items500, est());
    expect(t.totalBs).toBeCloseTo(500 * 857.89, 2);
    const pagos = [{ moneda: 'Bs', monto: t.totalBs }];
    expect(faltaPorPagar(pagos, t)).toBeLessThan(0.01);
  });
  test('pagar en $ efectivo el total en divisas cubre la factura', () => {
    const t = totalesCarrito(items500, est());
    expect(t.totalUsd).toBeCloseTo(500 * 857.89 / 980, 1);
    expect(faltaPorPagar([{ moneda: 'USD', monto: t.totalUsd }], t)).toBeLessThan(0.01);
  });
  test('pago mixto mitad y mitad', () => {
    const t = totalesCarrito(items500, est());
    const pagos = [{ moneda: 'USD', monto: t.totalUsd / 2 }, { moneda: 'Bs', monto: t.totalBs / 2 }];
    expect(faltaPorPagar(pagos, t)).toBeLessThan(0.01);
  });
  test('Completar llena exactamente lo que falta en su moneda', () => {
    const t = totalesCarrito(items500, est());
    const pagos = [{ moneda: 'USD', monto: 100 }, { moneda: 'Bs', monto: 0 }];
    pagos[1].monto = montoParaCompletar(pagos, 1, t);
    expect(faltaPorPagar(pagos, t)).toBeLessThan(0.02);
  });
  test('crédito con abono inicial: saldo = total − parte cubierta', () => {
    const t = totalesCarrito(items500, est());
    const r = resumenEmision({ items: items500, pagos: [{ moneda: 'Bs', monto: t.totalBs * 0.4 }], tipoPago: 'credito', estado: est() });
    expect(r.abonoIni).toBeCloseTo(200, 1);
    expect(r.saldoIni).toBeCloseTo(300, 1);
    expect(r.estadoFactura).toBe('parcial');
  });
  test('contado siempre queda pagada y sin saldo', () => {
    const r = resumenEmision({ items: items500, pagos: [], tipoPago: 'contado', estado: est() });
    expect(r.saldoIni).toBe(0);
    expect(r.estadoFactura).toBe('pagada');
  });
  test('cobro redondo por debajo se registra como descuento', () => {
    const base = totalesCarrito(items500, est()).totalUsdBase;
    const objetivo = Math.floor(base);
    const r = resumenEmision({ items: items500, pagos: [{ moneda: 'USD', monto: objetivo }], tipoPago: 'contado', estado: est({ cobrar_verde: objetivo }) });
    expect(r.falta).toBeLessThan(0.01);
    expect(r.descuentoTotal).toBeCloseTo(base - objetivo, 2);
    expect(r.cobrarVerde).toBe(objetivo);
    expect(r.motivo).toMatch(/Cobro redondo/);
  });
  test('descuento por divisas por encima de la brecha se registra', () => {
    const neutro = dtoDivisaNeutro(est());
    const e = est({ dto_divisa: neutro + 5 });
    const t = totalesCarrito(items500, e);
    const r = resumenEmision({ items: items500, pagos: [{ moneda: 'USD', monto: t.totalUsd }], tipoPago: 'contado', estado: e });
    expect(r.descuentoTotal).toBeCloseTo(25, 1);
    expect(r.motivo).toMatch(/sobre la brecha/);
  });
  test('pagos a BD guardan lo entregado (v13.33)', () => {
    const [usd, bs] = pagosParaBD([{ moneda: 'USD', monto: 100, metodo: 'Efectivo USD' }, { moneda: 'Bs', monto: 9800, metodo: 'Pago móvil Bs.' }], est(), 'JJ');
    expect(usd.monto_usd).toBe(100);
    expect(usd.tasa_usada).toBe(857.89);
    expect(bs.monto_bs).toBe(9800);
    expect(bs.monto_usd).toBe(10);
  });
  test('moneda por método', () => {
    expect(monedaDeMetodo('Zelle USD')).toBe('USD');
    expect(monedaDeMetodo('Punto de venta')).toBe('Bs');
    expect(monedaDeMetodo('Efectivo Bs.')).toBe('Bs');
  });
});

describe('parseMontoVE', () => {
  test.each([
    ['1.234,56', 1234.56], ['1,234.56', 1234.56], ['59.818,55', 59818.55], ['12,5', 12.5],
    ['12.50', 12.5], ['1.234.567', 1234567], ['Bs. 2.000', 2000], ['', 0]
  ])('%s → %s', (inp, out) => expect(parseMontoVE(inp)).toBe(out));
});

describe('abonos CxC (regresión v13.32 / C-04)', () => {
  const f = { total: 100, saldo_pendiente: 100, factor_bs: 1, cobrar_verde: null, fecha_raw: '2026-09-20T12:00:00Z' };
  test('efectivo que cubre el objetivo en modo saldar salda la deuda completa', () => {
    const obj = objetivoEfectivo(f, est());
    const r = calcularAbono({ f, montoIn: obj, moneda: 'USD', modo: 'saldar', estado: est() });
    expect(r.ok).toBe(true);
    expect(r.acreditaUSD).toBe(100);
    expect(r.entregado.verde).toBeCloseTo(obj, 2);
  });
  test('modo convertir acredita el valor en $BCV, no el de cara', () => {
    const r = calcularAbono({ f, montoIn: 50, moneda: 'USD', modo: 'convertir', estado: est() });
    expect(r.acreditaUSD).toBeGreaterThan(55);
  });
  test('saldar con monto insuficiente se rechaza', () => {
    const r = calcularAbono({ f, montoIn: 10, moneda: 'USD', modo: 'saldar', estado: est() });
    expect(r.ok).toBe(false);
  });
  test('Bs que cubren el "Cobrar HOY" saldan', () => {
    const r = calcularAbono({ f, montoIn: 100 * 857.89, moneda: 'Bs', estado: est() });
    expect(r.acreditaUSD).toBe(100);
  });
  test('Bs parcial se acredita a tasa BCV', () => {
    const r = calcularAbono({ f, montoIn: 40 * 857.89, moneda: 'Bs', estado: est() });
    expect(r.acreditaUSD).toBeCloseTo(40, 1);
  });
  test('nunca acredita más que el saldo', () => {
    const r = calcularAbono({ f, montoIn: 500, moneda: 'USD', modo: 'cara', estado: est() });
    expect(r.acreditaUSD).toBe(100);
  });
});

describe('fechas en hora de Venezuela (C-09)', () => {
  test('21:00 VET del 6-oct sigue siendo 6-oct (en UTC ya es 7)', () => {
    expect(fechaLocalISO(new Date('2026-10-07T01:00:00Z'))).toBe('2026-10-06');
  });
  test('confirmación de anoche no vale hoy', () => {
    expect(esHoyVE('2026-10-07T01:00:00Z', new Date('2026-10-07T13:00:00Z'))).toBe(false);
  });
});
