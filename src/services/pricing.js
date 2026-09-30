// =====================================================================
// ARJ - Motor de Precios, Costo Landed y Margenes (Vue 3 / ES Module)
// Logica 100% fiel al modelo comercial de ARJ Agrorepuestos
// =====================================================================

export const MARGEN_MINIMO = 30;
export const RESGUARDO_BS = 1.00;
export const FACTOR_LANDED_FALLBACK = 1.471;
export const CORTE_MODELO_BCV = new Date('2026-08-01T00:00:00Z').getTime();

// Factores de precio por tier — alineados con la tabla 'clientes.nivel' en Supabase
// Publico = precio lista completo, T1 = Aliado -5%, T2 = Aliado -10%, T3 = Mayorista -20%
export const PRECIOS_TIER = {
  Publico: 1.00,
  T1: 0.95,
  T2: 0.90,
  T3: 0.80
};

// Redondeo al centavo exacto — política confirmada por gerencia (sin redondeo hacia arriba)
export function redondeoBonito(n) {
  if (n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

export function sinFob(it) {
  return !Number.isFinite(parseFloat(it && it.fob)) || parseFloat(it.fob) <= 0;
}

export function colchonFactorCon(tpar, tbcv) {
  if (!(tbcv > 0) || !(tpar > 0)) return 1;
  const base = tpar / tbcv;
  const brecha = base - 1;
  let colchon = 0.10 * brecha;
  if (colchon < 0.02) colchon = 0.02;
  if (colchon > 0.08) colchon = 0.08;
  return base * (1 + colchon);
}

export function colchonFactor() {
  return RESGUARDO_BS;
}

export function brechaHoy(estado) {
  const tp = parseFloat(estado?.tasa_par || 0);
  const tb = parseFloat(estado?.tasa_bcv || 0);
  if (!Number.isFinite(tp) || tp <= 0 || !Number.isFinite(tb) || tb <= 0) return 1;
  const b = tp / tb;
  return b > 0 ? b : 1;
}

export function dtoDivisaNeutro(estado) {
  const b = brechaHoy(estado);
  return b > 0 ? (1 - 1 / b) * 100 : 0;
}

export function dtoDivisaPct(estado) {
  const d = parseFloat(estado?.dto_divisa);
  return (Number.isFinite(d) && d >= 0) ? d : dtoDivisaNeutro(estado);
}

export function bcvAVerde(p, estado) {
  return Math.round((parseFloat(p) || 0) * (1 - dtoDivisaPct(estado) / 100) * 100) / 100;
}

export function verdeABcv(v, estado) {
  const f = 1 - dtoDivisaPct(estado) / 100;
  return f > 0 ? Math.round((parseFloat(v) || 0) / f * 100) / 100 : 0;
}

export function totalEnDivisas(totalBcv, estado) {
  return Math.round(totalBcv * (1 - dtoDivisaPct(estado) / 100) * 100) / 100;
}

export function dtoDivisaExcedentePct(estado) {
  const ex = dtoDivisaPct(estado) - dtoDivisaNeutro(estado);
  return ex > 0.001 ? ex : 0;
}

export function factorBsDe(f, estado) {
  if (!f) return colchonFactor();
  const fb = parseFloat(f.factor_bs);
  if (Number.isFinite(fb) && fb > 0) return fb;
  const tEmision = f.fecha_raw ? new Date(f.fecha_raw).getTime() : NaN;
  if (Number.isFinite(tEmision) && tEmision < CORTE_MODELO_BCV) {
    const tp = parseFloat(f.tasa_par);
    const tb = parseFloat(f.tasa_bcv);
    if (Number.isFinite(tp) && tp > 0 && Number.isFinite(tb) && tb > 0) {
      return colchonFactorCon(tp, tb);
    }
  }
  return colchonFactor();
}

export function precioPublico(fob) {
  let m;
  if (fob < 2) m = 5;
  else if (fob < 5) m = 4;
  else if (fob < 10) m = 3;
  else m = 2.5;
  return redondeoBonito(fob * m);
}

export function factorLandedDe(p, catalogoProductos = []) {
  if (!p) return FACTOR_LANDED_FALLBACK;
  let f = parseFloat(p.factor_landed);
  if (!Number.isFinite(f) || f <= 0) {
    const cat = p.cod_alt ? catalogoProductos.find(x => x.cod_alt === p.cod_alt) : null;
    f = cat ? parseFloat(cat.factor_landed) : NaN;
  }
  return (Number.isFinite(f) && f > 0) ? f : FACTOR_LANDED_FALLBACK;
}

export function costoLanded(p, catalogoProductos = []) {
  return (parseFloat(p && p.fob) || 0) * factorLandedDe(p, catalogoProductos);
}

export function origenDe(it, catalogoProductos = []) {
  if (!it) return 'importado';
  const o = (it.origen || '').toString().trim().toLowerCase();
  if (o === 'local' || o === 'importado') return o;
  const cat = it.cod_alt ? catalogoProductos.find(x => x.cod_alt === it.cod_alt) : null;
  const oc = cat ? (cat.origen || '').toString().trim().toLowerCase() : '';
  if (oc === 'local' || oc === 'importado') return oc;
  const f = parseFloat(it.factor_landed);
  return (Number.isFinite(f) && f > 0 && f <= 1.001) ? 'local' : 'importado';
}

export function factorSinDivisas(p, embarques = [], catalogoProductos = []) {
  if (!p || !p.embarque_id) return null;
  const e = embarques.find(x => x.id === p.embarque_id);
  if (!e) return null;
  const pd = parseFloat(e.pct_divisas);
  if (!Number.isFinite(pd) || pd <= 0) return factorLandedDe(p, catalogoProductos);
  return factorLandedDe(p, catalogoProductos) / (1 + pd / 100);
}

export function costoSinDivisas(p, embarques = [], catalogoProductos = []) {
  const f = factorSinDivisas(p, embarques, catalogoProductos);
  return f == null ? null : (parseFloat(p && p.fob) || 0) * f;
}

export function precioConTier(fob, t = 'Publico', producto = null) {
  const base = (producto && producto.precio_manual) ? producto.precio_manual : precioPublico(fob);
  const factor = PRECIOS_TIER[t];
  if (factor === undefined) {
    // Tier desconocido: usar Publico como fallback seguro y loguear advertencia
    console.warn(`[ARJ Pricing] Tier desconocido: "${t}". Tiers válidos: ${Object.keys(PRECIOS_TIER).join(', ')}. Usando Publico.`);
    return Math.round(base * PRECIOS_TIER.Publico * 100) / 100;
  }
  return Math.round(base * factor * 100) / 100;
}

export function precioBaseItem(it) {
  if (it.precio_fijo) {
    const pb = parseFloat(it.precio_base);
    return (Number.isFinite(pb) && pb > 0) ? pb : it.precio;
  }
  if (it.precio_manual != null && it.precio_manual > 0) return it.precio_manual;
  return precioPublico(it.fob);
}

export function precioLista(p) {
  if (p.precio_manual != null && p.precio_manual > 0) return p.precio_manual;
  const bruto = precioPublico(p.fob);
  return Math.ceil(bruto * 2) / 2;
}

// ═══════════════════════════════════════════════════════════════
// FORMATEADORES
// ═══════════════════════════════════════════════════════════════
export function fmtUSD(val) {
  return '$' + (parseFloat(val) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function fmtBs(val, tasa) {
  const bs = (parseFloat(val) || 0) * (parseFloat(tasa) || 0);
  return 'Bs. ' + bs.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function fmtNum(n, dec = 0) {
  return (parseFloat(n) || 0).toLocaleString('es-VE', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec
  });
}
