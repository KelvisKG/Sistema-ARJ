// =====================================================================
// ARJ - Cálculos del módulo de Reportes, portados tal cual del monolito
// (v13.1 KPIs y metas · v13.28 importado vs local · v13.35 período ·
//  v13.37 $BCV → $verde · v13.38 verde real cobrado / por cobrar)
// =====================================================================
import { FACTOR_LANDED_FALLBACK, origenDe } from './pricing.js';

// ─── $BCV → $VERDE con la brecha CONGELADA de cada factura (v13.37) ───
// Es un equivalente, no una cobranza.
export function factorVerde(f) {
  if (!f) return null;
  const tp = parseFloat(f.tasa_par), tb = parseFloat(f.tasa_bcv);
  if (!Number.isFinite(tp) || !Number.isFinite(tb) || tp <= 0 || tb <= 0 || tb > tp) return null;
  return tb / tp;
}

const factorItem = i => {
  const fac = parseFloat(i.factor_landed);
  return (Number.isFinite(fac) && fac > 0) ? fac : FACTOR_LANDED_FALLBACK;
};

// ═══════════════════════════════════════════════════════════════
// VERDE REAL (v13.38) — auditado contra las facturas de septiembre 2026
//  1. Distingue cobrado de pendiente (saldo_pendiente).
//  2. Resta el descuento_manual de la factura.
//  3. Si se pactó un cobro redondo en efectivo (cobrar_verde), manda ese.
// Descuento, saldo y cobro son de la factura completa: se prorratean
// según el peso bruto de cada origen.
// ═══════════════════════════════════════════════════════════════
export function calcVerdeReal(its, fmap, productos = []) {
  const porFact = {};
  its.forEach(i => {
    const fid = i.factura_id;
    if (!porFact[fid]) porFact[fid] = { total: 0, k: { importado: 0, local: 0 } };
    const v = parseFloat(i.total_linea) || 0;
    porFact[fid].total += v;
    porFact[fid].k[origenDe(i, productos)] += v;
  });

  const Z = () => ({ efectivo: 0, usdt: 0, enMano: 0, porCobrar: 0 });
  const res = { importado: Z(), local: Z(), sinTasa: 0, nPend: 0 };

  Object.keys(porFact).forEach(fid => {
    const pf = porFact[fid];
    const f = fmap[fid];
    const fv = factorVerde(f);
    if (!f || fv == null || pf.total <= 0) { res.sinTasa++; return; }

    const dto = parseFloat(f.descuento_manual) || 0;
    const saldo = parseFloat(f.saldo_pendiente) || 0;
    const cv = parseFloat(f.cobrar_verde) || 0;

    const netoFact = pf.total - dto;
    // Proporción cobrada: una factura a medio pagar aporta la mitad
    const pctCob = netoFact > 0 ? Math.max(0, Math.min(1, (netoFact - saldo) / netoFact)) : 0;
    if (saldo > 0) res.nPend++;

    ['importado', 'local'].forEach(k => {
      const bruto = pf.k[k];
      if (bruto <= 0) return;
      const share = bruto / pf.total;
      const neto = bruto - dto * share;
      let enMano, porCobrar, esEfectivo;
      if (cv > 0) {
        // Pactado en efectivo: manda el monto acordado, no el teórico
        esEfectivo = true;
        enMano = cv * share * pctCob;
        porCobrar = cv * share * (1 - pctCob);
      } else {
        // Entra en bolívares: hay que convertirlos a USDT
        esEfectivo = false;
        enMano = neto * pctCob * fv;
        porCobrar = neto * (1 - pctCob) * fv;
      }
      res[k].enMano += enMano;
      res[k].porCobrar += porCobrar;
      if (esEfectivo) res[k].efectivo += enMano; else res[k].usdt += enMano;
    });
  });
  return res;
}

// Panel "Importado vs Local" sobre lo EFECTIVAMENTE vendido (v13.28)
export function resumenOrigen(its, fmap, productos = []) {
  const Z = () => ({ venta: 0, costo: 0, uds: 0, lineas: 0 });
  const g = { importado: Z(), local: Z() };
  let deducidos = 0, sinCosto = 0;
  its.forEach(i => {
    const cant = parseFloat(i.cantidad) || 0;
    const fob = parseFloat(i.fob_unitario) || 0;
    const o = (i.origen || '').toString().trim().toLowerCase();
    if (o !== 'local' && o !== 'importado') deducidos++;
    if (fob <= 0) sinCosto++;
    const k = origenDe(i, productos);
    g[k].venta += parseFloat(i.total_linea) || 0;
    g[k].costo += fob * factorItem(i) * cant;
    g[k].uds += cant;
    g[k].lineas++;
  });
  const tot = { venta: g.importado.venta + g.local.venta, costo: g.importado.costo + g.local.costo };
  tot.util = tot.venta - tot.costo;
  ['importado', 'local'].forEach(k => { g[k].util = g[k].venta - g[k].costo; g[k].mg = g[k].venta > 0 ? g[k].util / g[k].venta * 100 : 0; });
  return { g, tot, deducidos, sinCosto, VR: calcVerdeReal(its, fmap, productos) };
}

// Agrupa por PRODUCTO, no por renglón: "cuáles productos", no "cuáles líneas"
export function agruparProductos(its, fmap, productos = []) {
  const acc = {};
  its.forEach(i => {
    const k = (i.cod_alt || '—') + '|' + (i.descripcion || '');
    if (!acc[k]) acc[k] = { cod: i.cod_alt || '—', desc: i.descripcion || '', origen: origenDe(i, productos), uds: 0, venta: 0, verde: 0, costo: 0, sinTasa: 0 };
    const a = acc[k];
    const cant = parseFloat(i.cantidad) || 0;
    const vta = parseFloat(i.total_linea) || 0;
    const fob = parseFloat(i.fob_unitario) || 0;
    a.uds += cant;
    a.venta += vta;
    a.costo += fob * factorItem(i) * cant;
    const fv = factorVerde(fmap[i.factura_id]);
    if (fv == null) a.sinTasa++; else a.verde += vta * fv;
  });
  return Object.values(acc).sort((x, y) => y.venta - x.venta);
}

// CSV a nivel de RENGLÓN, para rastrear cualquier cifra hasta su factura
export function filasDetalleOrigen(data, empresaTxt, productos = []) {
  const filas = [['DETALLE DE VENTAS POR ORIGEN — ' + data.etiqueta],
    ['Empresa: ' + empresaTxt + ' · ' + data.nFacts + ' factura(s)'],
    ['Los $BCV y los $verdes son unidades distintas. NO se suman entre si.'], [],
    ['Factura', 'Fecha', 'Cliente', 'Código', 'Descripción', 'Origen', 'Cantidad',
      'Venta $BCV', '≈ $verde', 'Costo $BCV', 'Utilidad $BCV', 'Margen %', 'Cobro verde acordado']];
  let tV = 0, tW = 0, tC = 0, sinTasa = 0;
  data.its.forEach(i => {
    const f = data.fmap[i.factura_id] || {};
    const cant = parseFloat(i.cantidad) || 0;
    const vta = parseFloat(i.total_linea) || 0;
    const fob = parseFloat(i.fob_unitario) || 0;
    const costo = fob * factorItem(i) * cant;
    const util = vta - costo;
    const fv = factorVerde(data.fmap[i.factura_id]);
    if (fv == null) sinTasa++;
    const verde = fv == null ? null : vta * fv;
    tV += vta; tC += costo; if (verde != null) tW += verde;
    filas.push([
      f.numero || '', f.fecha ? new Date(f.fecha).toLocaleDateString('es-VE') : '',
      f.cliente_nombre || '', i.cod_alt || '', i.descripcion || '', origenDe(i, productos),
      cant.toFixed(2), vta.toFixed(2), verde == null ? '' : verde.toFixed(2),
      costo.toFixed(2), util.toFixed(2), vta > 0 ? (util / vta * 100).toFixed(1) : '',
      (f.cobrar_verde != null && f.cobrar_verde > 0) ? parseFloat(f.cobrar_verde).toFixed(2) : ''
    ]);
  });
  filas.push([]);
  filas.push(['TOTAL VENTA $BCV', '', '', '', '', '', '', tV.toFixed(2)]);
  filas.push(['TOTAL COSTO $BCV', '', '', '', '', '', '', tC.toFixed(2)]);
  filas.push(['TOTAL UTILIDAD $BCV', '', '', '', '', '', '', (tV - tC).toFixed(2)]);
  filas.push(['EQUIVALENTE EN $VERDE (si todo se cobra en efectivo)', '', '', '', '', '', '', '', tW.toFixed(2)]);
  if (sinTasa > 0) filas.push([sinTasa + ' renglon(es) sin tasas congeladas: no se pudo convertir a verde']);
  return filas;
}

// Utilidad real del mes: fob y factor CONGELADOS en factura_items (v13.1)
export function costoRenglones(its) {
  let costo = 0, sinCosto = 0;
  its.forEach(i => {
    const fob = parseFloat(i.fob_unitario) || 0;
    if (fob <= 0) sinCosto++;
    costo += fob * factorItem(i) * (parseFloat(i.cantidad) || 0);
  });
  return { costo, sinCosto };
}

// Top 5 del mes por monto vendido
export function topProductos(its) {
  const acc = {};
  its.forEach(i => {
    const k = i.cod_alt || '—';
    if (!acc[k]) acc[k] = { cod: k, desc: i.descripcion || '', cant: 0, total: 0 };
    acc[k].cant += parseFloat(i.cantidad) || 0;
    acc[k].total += parseFloat(i.total_linea) || 0;
  });
  return Object.values(acc).sort((a, b) => b.total - a.total).slice(0, 5);
}

// ─── Rango del selector de período (v13.35). hastaExcl = día siguiente al último ───
export function fISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function rangoOrigen(sel, desdeTxt, hastaTxt, h = new Date()) {
  const y = h.getFullYear(), m = h.getMonth();
  const manana = new Date(y, m, h.getDate() + 1);
  if (sel === 'mes') return { desde: fISO(new Date(y, m, 1)), hastaExcl: fISO(manana), etiqueta: 'este mes' };
  if (sel === 'mes_ant') return { desde: fISO(new Date(y, m - 1, 1)), hastaExcl: fISO(new Date(y, m, 1)), etiqueta: new Date(y, m - 1, 1).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }) };
  if (sel === '3m') return { desde: fISO(new Date(y, m - 2, 1)), hastaExcl: fISO(manana), etiqueta: 'últimos 3 meses' };
  if (sel === '12m') return { desde: fISO(new Date(y, m - 11, 1)), hastaExcl: fISO(manana), etiqueta: 'últimos 12 meses' };
  if (sel === 'anio') return { desde: fISO(new Date(y, 0, 1)), hastaExcl: fISO(manana), etiqueta: 'año ' + y };
  if (sel === 'todo') return { desde: '2000-01-01', hastaExcl: fISO(manana), etiqueta: 'todo el histórico' };
  if (!desdeTxt || !hastaTxt) return { error: 'Escoge las dos fechas.' };
  if (desdeTxt > hastaTxt) return { error: 'La fecha inicial es posterior a la final.' };
  const p = hastaTxt.split('-');
  const sig = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]) + 1);
  return { desde: desdeTxt, hastaExcl: fISO(sig), etiqueta: desdeTxt + ' a ' + hastaTxt };
}

// ─── Metas (v13.2): el equipo se guarda como [{ nombre, empresa: 'directa'|'dist'|'ambas' }] ───
export function normalizarEquipo(eq) {
  return (Array.isArray(eq) ? eq : []).map(t => (typeof t === 'string'
    ? { nombre: t, empresa: 'ambas' }
    : { nombre: String(t.nombre || ''), empresa: t.empresa || 'ambas' })).filter(t => t.nombre);
}
// Clave de la empresa en metas y equipo (formato del monolito)
export const claveEmpresa = emp => (emp === 'directa' ? 'directa' : 'dist');

export function etiquetaPeriodo(per) {
  const [a, m] = per.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return (meses[parseInt(m, 10) - 1] || m) + ' ' + a;
}
