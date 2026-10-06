// =====================================================================
// ARJ - Fechas en hora de Venezuela (America/Caracas, UTC-4)
// toISOString() da la fecha UTC: después de las 8 p.m. en Venezuela ya es
// "mañana" y eso rompía el bloqueo de tasas diarias (C-09).
// =====================================================================
export const ZONA_ARJ = 'America/Caracas';

// 'YYYY-MM-DD' de una fecha en hora de Venezuela
export function fechaLocalISO(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  // en-CA formatea como YYYY-MM-DD
  return dt.toLocaleDateString('en-CA', { timeZone: ZONA_ARJ });
}

export function esHoyVE(fecha, ahora = new Date()) {
  if (!fecha) return false;
  const f = fechaLocalISO(fecha);
  return !!f && f === fechaLocalISO(ahora);
}

// 'YYYY-MM' del período (mes) en hora de Venezuela
export function periodoDe(d = new Date()) {
  const f = fechaLocalISO(d);
  return f ? f.slice(0, 7) : null;
}
