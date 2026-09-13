/**
 * Sistema ARJ - Validaciones Esenciales de Formularios
 */

export function isNonEmpty(val, minLen = 1) {
  if (val === null || val === undefined) return false;
  return String(val).trim().length >= minLen;
}

export function isPositiveNumber(val, allowZero = false) {
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (isNaN(num)) return false;
  return allowZero ? num >= 0 : num > 0;
}

export function isNumberInRange(val, min, max) {
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (isNaN(num)) return false;
  return num >= min && num <= max;
}

export function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

export function isValidRifOrCedula(rif) {
  if (!rif) return false;
  const clean = String(rif).trim().toUpperCase();
  // Valid Venezuelan RIF/Cedula format or basic tax ID (V-12345678, J-12345678-0, etc.)
  return /^[VJEGP]?[- ]?[0-9]{6,10}([- ]?[0-9])?$/i.test(clean) || clean.length >= 6;
}

export function isValidPhone(phone) {
  if (!phone) return true; // Optional field
  const clean = String(phone).replace(/[\s\-()]/g, '');
  return clean.length >= 7 && /^\+?[0-9]+$/.test(clean);
}
