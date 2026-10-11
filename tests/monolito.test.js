// Lo portado del monolito v13 para Inventario, CxC y Reportes tiene que dar
// exactamente lo mismo que allá.
import { describe, test, expect, vi } from 'vitest';

vi.hoisted(() => { if (!globalThis.WebSocket) globalThis.WebSocket = class {}; });

import { parsearLineas, buscarPorCodigo, csvEsc, lpElegible, fotosDe } from '../src/services/monolito.js';
import { calcVerdeReal, resumenOrigen, factorVerde, rangoOrigen, normalizarEquipo, claveEmpresa } from '../src/services/reportes.js';
import { mapFactura, empresaNorm, empresasBD } from '../src/services/supabase.js';

describe('listas pegadas (recepción y despacho)', () => {
  test('acepta tabulador, punto y coma y espacios; la coma va de última', () => {
    const f = parsearLineas('5198060\t12\n82025254;4\n5191547-2   30\nabc 7');
    expect(f.map(x => [x.cod, x.cant])).toEqual([['5198060', 12], ['82025254', 4], ['5191547-2', 30], ['ABC', 7]]);
  });
  test('rechaza decimales y líneas sin cantidad en vez de redondear', () => {
    const f = parsearLineas('HF6510 1.234\nSOLO');
    expect(f[0].error).toMatch(/entero/);
    expect(f[1].error).toBe('Falta la cantidad');
  });
  test('busca por código alterno o por código original', () => {
    const prods = [{ cod_alt: 'HF6510', cod_orig: '8421456' }];
    expect(buscarPorCodigo(prods, 'HF6510')).toBe(prods[0]);
    expect(buscarPorCodigo(prods, '8421456')).toBe(prods[0]);
    expect(buscarPorCodigo(prods, 'X')).toBeUndefined();
  });
});

describe('CSV, fotos y lista de precios', () => {
  test('números con coma decimal; códigos intactos', () => {
    expect(csvEsc('1.4710')).toBe('1,4710');
    expect(csvEsc('CAR123475')).toBe('CAR123475');
    expect(csvEsc('a;b')).toBe('"a;b"');
  });
  test('hasta 3 fotos separadas por |', () => {
    expect(fotosDe({ imagen_url: 'a|b|' })).toEqual(['a', 'b']);
    expect(fotosDe({ imagen_url: null })).toEqual([]);
  });
  test('la lista del cliente exige embarque sellado, existencia y precio', () => {
    const base = { activo: true, embarque_id: 'e1', stock_vd: 0, stock_dist: 3, fob: 2, precio_manual: null };
    expect(lpElegible(base)).toBe(true);
    expect(lpElegible({ ...base, embarque_id: null })).toBe(false);
    expect(lpElegible({ ...base, stock_dist: 0 })).toBe(false);
    expect(lpElegible({ ...base, fob: 0 })).toBe(false);
    expect(lpElegible({ ...base, fob: 0, precio_manual: 9 })).toBe(true);
  });
});

describe('reportes: verde real (v13.38)', () => {
  // Caso auditado: VD-2026-00006 es 81,8% importado; de $135 en efectivo, $110,45 son de importado
  const fmap = { 42: { id: 42, tasa_par: '960', tasa_bcv: '798.33', descuento_manual: '2.21', saldo_pendiente: '0', cobrar_verde: '135' } };
  const its = [
    { factura_id: 42, total_linea: '135', cantidad: 1, fob_unitario: '20', factor_landed: '1.7366', origen: 'importado' },
    { factura_id: 42, total_linea: '30', cantidad: 1, fob_unitario: '20', factor_landed: '1', origen: 'local' }
  ];
  test('cobro pactado en efectivo: manda el monto acordado, prorrateado por origen', () => {
    const vr = calcVerdeReal(its, fmap);
    expect(vr.importado.enMano).toBeCloseTo(110.45, 2);
    expect(vr.local.enMano).toBeCloseTo(24.55, 2);
    expect(vr.importado.efectivo).toBeCloseTo(110.45, 2);
    expect(vr.nPend).toBe(0);
  });
  test('factura a crédito sin cobrar: todo es "por cobrar" en USDT', () => {
    const f2 = { 7: { tasa_par: '980', tasa_bcv: '857.89', descuento_manual: '0', saldo_pendiente: '100', cobrar_verde: null } };
    const vr = calcVerdeReal([{ factura_id: 7, total_linea: '100', origen: 'importado' }], f2);
    expect(vr.importado.enMano).toBe(0);
    expect(vr.importado.porCobrar).toBeCloseTo(100 * 857.89 / 980, 6);
    expect(vr.nPend).toBe(1);
  });
  test('sin tasas congeladas no entra en caja', () => {
    expect(factorVerde({ tasa_par: 0, tasa_bcv: 800 })).toBeNull();
    expect(calcVerdeReal([{ factura_id: 1, total_linea: '10' }], {}).sinTasa).toBe(1);
  });
  test('importado vs local usa el costo congelado del renglón', () => {
    const r = resumenOrigen(its, fmap);
    expect(r.g.importado.costo).toBeCloseTo(20 * 1.7366, 6);
    expect(r.g.local.venta).toBe(30);
    expect(r.deducidos).toBe(0);
  });
  test('rango "mes pasado" termina el día 1 del mes en curso', () => {
    const r = rangoOrigen('mes_ant', '', '', new Date(2026, 9, 10));
    expect(r.desde).toBe('2026-09-01');
    expect(r.hastaExcl).toBe('2026-10-01');
    expect(rangoOrigen('custom', '2026-10-05', '2026-10-01').error).toBeTruthy();
  });
  test('el equipo viejo (solo nombres) se lee como "ambas"', () => {
    expect(normalizarEquipo(['ANA', { nombre: 'LUIS', empresa: 'dist' }])).toEqual([
      { nombre: 'ANA', empresa: 'ambas' }, { nombre: 'LUIS', empresa: 'dist' }]);
    expect(claveEmpresa('distribuidora')).toBe('dist');
  });
});

describe('empresa: el monolito guarda "dist"', () => {
  test('las facturas de Distribuidora del monolito aparecen en la app', () => {
    expect(empresaNorm('dist')).toBe('distribuidora');
    expect(mapFactura({ id: 48, numero: 'DT-2026-00001', empresa: 'dist', subtotal_usd: '70', saldo_pendiente: '70', estado: 'pendiente', fecha: '2026-09-06' }).empresa)
      .toBe('distribuidora');
    expect(empresasBD('distribuidora')).toEqual(['dist', 'distribuidora']);
    expect(empresasBD('directa')).toEqual(['directa']);
  });
});
