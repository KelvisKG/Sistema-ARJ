// =====================================================================
// ARJ - Motor de cobros multimoneda (portado del monolito v13.12–v13.33)
//
// Modelo: los precios están en $BCV. Cada pago se mide contra el total
// ANUNCIADO en su propia moneda:
//   · Bs   → contra  total × factorBs × tasa_bcv   ("Cobrar en Bs")
//   · USD  → contra  total en divisas (brecha del día) o el cobro redondo
// La suma de fracciones dice cuánto de la factura está cubierto. Así, un
// cliente que paga exactamente lo que dice la pantalla nunca queda corto.
// =====================================================================
import { colchonFactor, totalEnDivisas, dtoDivisaExcedentePct, dtoDivisaPct, factorBsDe, fmtUSD } from './pricing.js';

const r2 = n => Math.round((parseFloat(n) || 0) * 100) / 100;

// Métodos de pago (iguales al monolito) y su moneda
export const METODOS_PAGO = ['Pago móvil Bs.', 'Transferencia Bs.', 'Zelle USD', 'Efectivo USD', 'Efectivo Bs.', 'Punto de venta'];
export function monedaDeMetodo(m) {
  return /USD|Zelle/i.test(m || '') ? 'USD' : 'Bs';
}
export function requiereReferencia(m) {
  return /transferencia|pago m[oó]vil|punto de venta|zelle/i.test(m || '');
}

// Parser de montos en formato venezolano (1.234,56) o US (1,234.56)
export function parseMontoVE(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v !== 'string') return parseFloat(v) || 0;
  v = v.trim().replace(/[^\d.,-]/g, '');
  if (!v) return 0;
  const uc = v.lastIndexOf(','), up = v.lastIndexOf('.');
  if (uc > -1 && up > -1) {
    v = uc > up ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  } else if (uc > -1) {
    const partes = v.split(',');
    v = (partes.length === 2 && partes[1].length <= 2) ? v.replace(',', '.') : v.replace(/,/g, '');
  } else if (up > -1) {
    const partes = v.split('.');
    const ult = partes[partes.length - 1];
    v = (ult.length <= 2 && partes.length > 1) ? partes.slice(0, -1).join('') + '.' + ult : v.replace(/\./g, '');
  }
  return parseFloat(v) || 0;
}

// Ajuste por cobro redondo en efectivo (v13.22). null si no hay ajuste.
export function ajusteVerde(cobrarVerde, totalUsdBase) {
  const cv = parseFloat(cobrarVerde);
  if (!Number.isFinite(cv) || cv <= 0 || totalUsdBase <= 0) return null;
  const dif = r2(cv - totalUsdBase);
  return { objetivo: cv, base: totalUsdBase, dif, arriba: dif > 0.004 };
}

// Totales del carrito. estado = { tasa_bcv, tasa_par, dto_divisa, cobrar_verde }
export function totalesCarrito(items, estado) {
  const subtotal = (items || []).reduce((a, it) => a + (parseFloat(it.cant) || 0) * (parseFloat(it.precio) || 0), 0);
  const factorBs = colchonFactor();
  const totalBcv = subtotal * factorBs;
  const totalBs = totalBcv * (parseFloat(estado.tasa_bcv) || 0);
  const totalUsdBase = totalEnDivisas(subtotal, estado);
  const ajuste = ajusteVerde(estado.cobrar_verde, totalUsdBase);
  const totalUsd = ajuste ? ajuste.objetivo : totalUsdBase;
  return { subtotal, factorBs, totalBcv, totalBs, totalUsdBase, ajuste, totalUsd };
}

// Fracción de la factura cubierta por los pagos (cada uno en su moneda)
export function fraccionPagada(pagos, totales, excluirIdx = -1) {
  if (!(totales.subtotal > 0)) return 0;
  let f = 0;
  (pagos || []).forEach((p, i) => {
    if (i === excluirIdx) return;
    const m = parseFloat(p.monto) || 0;
    f += p.moneda === 'USD'
      ? (totales.totalUsd > 0 ? m / totales.totalUsd : 0)
      : (totales.totalBs > 0 ? m / totales.totalBs : 0);
  });
  return f;
}

// Cuánto falta, en $BCV
export function faltaPorPagar(pagos, totales) {
  if (!(totales.subtotal > 0)) return 0;
  return Math.max(0, totales.subtotal * (1 - fraccionPagada(pagos, totales)));
}

// Monto exacto que completa el pago i en su moneda ("Completar")
export function montoParaCompletar(pagos, i, totales) {
  const falta = Math.max(0, 1 - fraccionPagada(pagos, totales, i));
  const p = pagos[i];
  return p && p.moneda === 'USD' ? r2(falta * totales.totalUsd) : r2(falta * totales.totalBs);
}

// Resumen de emisión: abono inicial, saldo, estado y descuentos registrables
export function resumenEmision({ items, pagos, tipoPago, estado, descManual = 0, motivoManual = '' }) {
  const t = totalesCarrito(items, estado);
  const frac = fraccionPagada(pagos, t);
  const falta = t.subtotal > 0 ? t.subtotal * (1 - frac) : 0;
  const abonoIni = tipoPago === 'credito' ? Math.min(t.subtotal, r2(t.subtotal * frac)) : 0;
  const saldoIni = tipoPago === 'contado' ? 0 : Math.max(0, r2(t.subtotal - abonoIni));
  const estadoFactura = (tipoPago === 'contado' || saldoIni <= 0.01) ? 'pagada' : (abonoIni > 0 ? 'parcial' : 'pendiente');

  // Descuento por divisas POR ENCIMA de la brecha, sobre la parte pagada en $
  let dtoDivPct = 0, dtoDivMonto = 0;
  const ex = dtoDivisaExcedentePct(estado);
  if (ex > 0 && t.totalUsd > 0) {
    let fracUsd = 0;
    (pagos || []).forEach(p => { if (p.moneda === 'USD') fracUsd += (parseFloat(p.monto) || 0) / t.totalUsd; });
    fracUsd = Math.min(1, Math.max(0, fracUsd));
    dtoDivPct = ex;
    dtoDivMonto = r2(t.subtotal * (ex / 100) * fracUsd);
  }
  const ajDif = t.ajuste ? t.ajuste.dif : 0;
  const descuentoTotal = r2(descManual + dtoDivMonto + Math.max(0, -ajDif));
  const motivo = [
    motivoManual,
    ajDif !== 0 && t.ajuste ? `Cobro redondo en efectivo: ${fmtUSD(t.ajuste.objetivo)} (${ajDif > 0 ? '+' : ''}${fmtUSD(ajDif)})` : '',
    dtoDivMonto > 0 ? `Pago en divisas: ${dtoDivPct.toFixed(1)} pts sobre la brecha (${fmtUSD(dtoDivMonto)})` : ''
  ].filter(Boolean).join(' · ');

  return {
    ...t, fraccion: frac, falta, abonoIni, saldoIni, estadoFactura,
    descuentoTotal, motivo,
    cobrarVerde: t.ajuste && t.ajuste.objetivo > 0 ? t.ajuste.objetivo : null
  };
}

// Pagos tal como se guardan: monto_usd = dólares entregados (o Bs/paralelo),
// monto_bs = bolívares entregados (o USD × BCV). v13.33
export function pagosParaBD(pagos, estado, registradoPor) {
  return (pagos || []).filter(p => (parseFloat(p.monto) || 0) > 0).map(p => {
    const m = parseFloat(p.monto) || 0;
    const esBs = p.moneda !== 'USD';
    return {
      monto_usd: r2(esBs ? m / estado.tasa_par : m),
      monto_bs: r2(esBs ? m : m * estado.tasa_bcv),
      tasa_usada: esBs ? estado.tasa_par : estado.tasa_bcv,
      metodo: p.metodo || 'Efectivo USD',
      referencia: p.ref || '',
      registrado_por: registradoPor || 'Sistema'
    };
  });
}

// ═══ ABONOS DE CxC (v13.32 / v13.33) ═══

// Bs que salda HOY la factura (tasa del día, factor congelado)
export function saldoBsHoy(f, estado) {
  return (parseFloat(f.saldo_pendiente) || 0) * factorBsDe(f, estado) * (parseFloat(estado.tasa_bcv) || 0);
}

// Efectivo en $ que salda HOY la factura (cobro redondo acordado, prorrateado)
export function objetivoEfectivo(f, estado) {
  const cv = parseFloat(f.cobrar_verde) || 0;
  const saldo = parseFloat(f.saldo_pendiente) || 0;
  if (cv > 0 && f.total > 0) return r2(cv * (saldo / f.total));
  return totalEnDivisas(saldo, estado);
}

// Cuánto $BCV acredita un pago en $ según el modo elegido
export function abonoAcredita(monto, modo, f, estado) {
  if (modo === 'saldar') return parseFloat(f.saldo_pendiente) || 0;
  if (modo === 'convertir') {
    const d = dtoDivisaPct(estado);
    return d < 100 ? r2(monto / (1 - d / 100)) : monto;
  }
  return monto; // 'cara'
}

/**
 * Calcula un abono completo.
 * @returns {{ok:boolean, error?:string, acreditaUSD?:number, entregado?:{verde,bs,tasa}}}
 */
export function calcularAbono({ f, montoIn, moneda, modo, estado }) {
  const saldo = parseFloat(f.saldo_pendiente) || 0;
  if (!(montoIn > 0)) return { ok: false, error: 'Ingresa un monto válido' };
  const entregado = {
    verde: r2(moneda === 'USD' ? montoIn : montoIn / estado.tasa_par),
    bs: r2(moneda === 'Bs' ? montoIn : montoIn * estado.tasa_bcv),
    tasa: moneda === 'Bs' ? estado.tasa_par : estado.tasa_bcv
  };
  let acredita;
  if (moneda === 'Bs') {
    const bsHoy = saldoBsHoy(f, estado);
    if (montoIn >= bsHoy - 1) acredita = saldo;            // cubre el "Cobrar HOY" → salda
    else acredita = bsHoy > 0 ? r2(saldo * (montoIn / bsHoy)) : 0;
  } else {
    if (modo === 'saldar' && montoIn < objetivoEfectivo(f, estado) - 1) {
      return { ok: false, error: `El monto no alcanza el objetivo en efectivo (${fmtUSD(objetivoEfectivo(f, estado))}) para saldar` };
    }
    acredita = abonoAcredita(montoIn, modo, f, estado);
  }
  acredita = Math.min(r2(acredita), saldo);
  if (acredita <= 0) return { ok: false, error: 'El monto acreditado da cero. Revisa el modo elegido.' };
  return { ok: true, acreditaUSD: acredita, entregado };
}
