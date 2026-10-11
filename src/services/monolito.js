// =====================================================================
// ARJ - Utilidades portadas tal cual del monolito v13
//
// Lo que aquí vive lo usan Inventario, Cuentas por Cobrar y Reportes, y
// tiene que dar exactamente lo mismo que en el monolito: mismo parser de
// listas pegadas, mismo CSV (';' y coma decimal) y mismas fotos.
// =====================================================================

// ─── Listas pegadas "código cantidad" (Recepción y Despacho, v13.4) ───
// Separadores probados de MENOS a MAS ambiguo. La coma va de última porque en
// Venezuela también es el separador decimal: si se prueba primero, "1,5" se
// parte en dos y leeríamos 5 en vez de avisar.
export function parsearLineas(texto) {
  const filas = [];
  String(texto || '').split(/\r?\n/).forEach((linea, i) => {
    const t = linea.trim();
    if (!t) return;
    let partes = null;
    for (const sep of [/\t+/, /;+/, /\s{2,}/, /\s+/, /,+/]) {
      const p = t.split(sep).map(x => x.trim()).filter(x => x);
      if (p.length >= 2) { partes = p; break; }
    }
    if (!partes) { filas.push({ linea: i + 1, crudo: t, error: 'Falta la cantidad' }); return; }
    const cod = partes[0].toUpperCase();
    const cantTxt = partes[partes.length - 1];
    // El stock son unidades enteras. Un decimal casi siempre es un separador de
    // miles mal interpretado ("1.234" son 1234 piezas, no 1). Se rechaza.
    if (!/^\d+$/.test(cantTxt)) {
      filas.push({ linea: i + 1, crudo: t, cod, error: 'La cantidad debe ser entero, sin comas ni puntos' });
      return;
    }
    filas.push({ linea: i + 1, crudo: t, cod, cant: parseInt(cantTxt, 10) });
  });
  return filas;
}

// Busca por código alterno o por código original (en mayúsculas)
export function buscarPorCodigo(productos, cod) {
  return productos.find(x => String(x.cod_alt).toUpperCase() === cod
    || (x.cod_orig && String(x.cod_orig).toUpperCase() === cod));
}

// ─── CSV (v13.2 / v13.12) ───
// Separador ';' porque Excel en es-VE usa la coma como decimal. Los números
// puros salen con coma decimal; códigos y fechas no se tocan.
export function csvEsc(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/^-?\d+\.\d+$/.test(s)) return s.replace('.', ',');
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function descargarArchivo(nombre, contenido, tipo) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function descargarCSV(nombre, filas) {
  const cuerpo = filas.map(f => f.map(csvEsc).join(';')).join('\r\n');
  // BOM para que Excel respete los acentos
  descargarArchivo(nombre, '﻿' + cuerpo, 'text/csv;charset=utf-8;');
}

export function hoyArchivo() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Abre un documento HTML en otra ventana y lanza la impresión (listas e informes)
export function imprimirHTML(html) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.print(); }, 400);
  return true;
}

// ─── Fotos de producto: hasta 3 URLs separadas por "|" en imagen_url ───
export const MAX_FOTOS = 3;
export function fotosDe(p) { return String((p && p.imagen_url) || '').split('|').filter(Boolean); }

// Reduce a 1280 px de lado y JPEG 85 % antes de subir (igual que el monolito)
export function comprimirImagen(file, maxLado = 1280, calidad = 0.85) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxLado || h > maxLado) { const f = maxLado / Math.max(w, h); w = Math.round(w * f); h = Math.round(h * f); }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      cv.toBlob(b => (b ? res(b) : rej(new Error('No se pudo procesar la imagen'))), 'image/jpeg', calidad);
    };
    img.onerror = () => rej(new Error('Archivo de imagen inválido'));
    img.src = URL.createObjectURL(file);
  });
}

export function nombreFoto(prod) {
  const base = prod.id || String(prod.cod_alt || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return 'prod_' + base + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.jpg';
}

// ─── Lista de precios: elegibilidad (v13.12, decisión de JJ 22-ago-2026) ───
// 1. Embarque sellado (sin él el costo es un estimado). 2. Existencia en alguna
// de las dos empresas. 3. Precio calculable: FOB válido o precio manual.
export function lpElegible(p) {
  if (!p || p.activo === false) return false;
  if (!p.embarque_id) return false;
  const sv = parseInt(p.stock_vd) || 0;
  const sd = parseInt(p.stock_dist) || 0;
  if (sv + sd <= 0) return false;
  return (p.fob > 0) || (p.precio_manual != null && p.precio_manual > 0);
}

export const marcaDe = p => (p.marca || '(sin marca)').trim() || '(sin marca)';
