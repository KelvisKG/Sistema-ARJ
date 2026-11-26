// =====================================================================
// ARJ - Servicio de Exportación PDF & Excel
// jsPDF para documentos formales, SheetJS para datos tabulares
// =====================================================================
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fmtUSD, fmtBCV, precioConTier } from './pricing.js';

// ═══════════════════════════════════════════════════════════════════
// HELPERS DE DESCARGA
// ═══════════════════════════════════════════════════════════════════
function forceDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename.replace(/[:\/\\?*|"<>\s]/g, '_');
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES DE DISEÑO PDF
// ═══════════════════════════════════════════════════════════════════
const NAVY = [21, 37, 63];
const BLUE = [37, 99, 235];
const GREEN = [16, 185, 129];
const GRAY = [107, 114, 128];
const LIGHT_BG = [248, 250, 252];
const WHITE = [255, 255, 255];
const TABLE_HEADER_BG = [21, 37, 63];
const TABLE_ALT_ROW = [245, 247, 250];
const GOLD = [217, 119, 6];

// Membrete de los documentos impresos: igual que el monolito v13, que usaba un
// solo encabezado para ambas empresas (A-06: se eliminó el RIF de relleno).
const MEMBRETE_ARJ = {
  nombre: 'AGRO REPUESTOS Y SERVICIOS JIMENEZ, FP',
  razon: 'Repuestos Agrícolas y Maquinaria Pesada',
  rif: 'RIF V-162930024',
  direccion: 'Carretera Nacional Vía La Misión, Barrio Altamira, Local 31',
  telefono: '0255-6642208 · 0414-5750174'
};
const DATOS_EMPRESAS = { directa: MEMBRETE_ARJ, distribuidora: MEMBRETE_ARJ };

// Emisor del libro de ventas (igual que el monolito v13)
import { EMISOR_FISCAL } from './exportLazy.js';

// ═══════════════════════════════════════════════════════════════════
// HELPERS PDF
// ═══════════════════════════════════════════════════════════════════

function cabeceraEmpresa(doc, empresa, startY = 15) {
  const emp = DATOS_EMPRESAS[empresa] || DATOS_EMPRESAS.directa;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Barra decorativa superior
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Nombre empresa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text(emp.nombre, 14, startY + 4);

  // Razón social
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(emp.razon, 14, startY + 11);
  doc.text(`RIF: ${emp.rif}  ·  ${emp.direccion}`, 14, startY + 16);
  doc.text(`Tel: ${emp.telefono}`, 14, startY + 21);

  return startY + 28;
}

function piePagina(doc, nota) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, pageHeight - 22, pageWidth - 14, pageHeight - 22);

  // Nota legal
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(nota || 'Repuestos agrícolas exentos de IVA según Ley de Impuesto al Valor Agregado (Sector agropecuario primario).', 14, pageHeight - 16);

  // Marca y fecha
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Generado por Sistema ARJ  ·  ${new Date().toLocaleString('es-VE')}`, 14, pageHeight - 10);
}

function separador(doc, y) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.4);
  doc.line(14, y, pageWidth - 14, y);
  return y + 2;
}

function etiquetaValor(doc, label, valor, x, y, labelColor = GRAY, valorColor = NAVY) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...labelColor);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...valorColor);
  doc.text(valor, x, y + 5);
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS PARA FACTURA FORMATO FISCAL SENIAT / FORMA LIBRE
// ═══════════════════════════════════════════════════════════════════
function fmtBsSENIAT(n) {
  const val = Number(n) || 0;
  return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTasaSENIAT(n) {
  const val = Number(n) || 0;
  return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatearFechaSENIAT(str) {
  if (!str) return '—';
  const s = String(str).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${d.getFullYear()}`;
  }
  return s;
}

function formatearItemDescSENIAT(it) {
  let desc = (it.desc || it.descripcion || '').trim();
  const cod = (it.cod_alt || it.codigo || '').trim();
  const orig = (it.cod_orig || it.marca || '').trim();

  let res = desc;
  if (cod && !res.toUpperCase().includes(cod.toUpperCase())) {
    res = `[${cod}] ${res}`;
  }
  if (orig && !res.toUpperCase().includes(orig.toUpperCase())) {
    res = `${res} (${orig})`;
  }
  return res || 'Producto';
}

/**
 * Renderiza un documento comercial (Factura, Presupuesto o Nota de Entrega)
 * con el formato estándar Forma Libre / SENIAT (tipografía serif en blanco y negro).
 */
function renderDocumentoFormaLibre({
  titulo,
  tituloSize = 19,
  etiquetaNumero,
  numero,
  fechaStr,
  bloqueIzqTitulo = 'NOMBRE O RAZON SOCIAL',
  bloqueIzqNombre,
  bloqueIzqDir = '',
  bloqueIzqCiudad = '',
  bloqueIzqTel = '',
  bloqueIzqRif = '',
  metadatos = [],
  columnas = ['PRODUCTO', 'CANT', 'PRECIO U.', 'TOTAL'],
  filas = [],
  clausulas = [],
  totalIzq = '',
  totalCentro = '',
  totalDer = '',
  pieNotas = [],
  firmas = false,
  anulada = false,
  filename = 'Documento.pdf',
  action = 'download'
}) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginL = 15;
  const marginR = 15;

  // ── BLOQUE IZQUIERDO ──
  let yLeft = 18;
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text(bloqueIzqTitulo, marginL, yLeft);

  yLeft += 5;
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.text(String(bloqueIzqNombre || 'CLIENTE GENERAL').toUpperCase(), marginL, yLeft);

  yLeft += 4.2;
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  if (bloqueIzqDir) {
    const dirLines = doc.splitTextToSize(String(bloqueIzqDir), 90);
    doc.text(dirLines, marginL, yLeft);
    yLeft += (dirLines.length * 3.8);
  }
  if (bloqueIzqCiudad) {
    doc.text(String(bloqueIzqCiudad), marginL, yLeft);
    yLeft += 3.8;
  }
  if (bloqueIzqTel) {
    doc.text(`Tel: ${bloqueIzqTel}`, marginL, yLeft);
    yLeft += 4.5;
  }
  if (bloqueIzqRif) {
    doc.setFont('times', 'bold');
    doc.text('RIF N°: ', marginL, yLeft);
    const rifW = doc.getTextWidth('RIF N°: ');
    doc.setFont('times', 'normal');
    doc.text(String(bloqueIzqRif).replace(/^RIF:?\s*/i, ''), marginL + rifW, yLeft);
  }

  // ── BLOQUE DERECHO: TÍTULO Y METADATOS ──
  const colRightX = 118;
  const rightCenterX = 156;

  doc.setFont('times', 'bold');
  doc.setFontSize(tituloSize);
  doc.text(titulo, rightCenterX, 18, { align: 'center' });

  const fCol1 = 136;
  const fCol2 = 175;
  doc.setFontSize(9);
  doc.text('FECHA', fCol1, 24, { align: 'center' });
  doc.text(etiquetaNumero, fCol2, 24, { align: 'center' });

  doc.setFontSize(11);
  doc.text(fechaStr, fCol1, 29, { align: 'center' });
  doc.text(String(numero || 'SN'), fCol2, 29, { align: 'center' });

  let yMeta = 35;
  const metaLeading = 4.2;
  doc.setFontSize(8.5);
  for (const [lbl, val] of metadatos) {
    doc.setFont('times', 'normal');
    doc.text(lbl, colRightX, yMeta);
    const lblW = doc.getTextWidth(lbl);
    doc.setFont('times', 'bold');
    doc.text(String(val || '—'), colRightX + lblW, yMeta);
    yMeta += metaLeading;
  }

  // ── TABLA DE PRODUCTOS ──
  const startTableY = Math.max(yLeft, yMeta) + 6;
  autoTable(doc, {
    startY: startTableY,
    head: [columnas],
    body: filas.length > 0 ? filas : [['Sin productos registrados', '0', '0,00', '0,00']],
    theme: 'plain',
    margin: { left: marginL, right: marginR },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      font: 'times',
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 }
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      font: 'times',
      fontSize: 7.8,
      cellPadding: { top: 1.6, bottom: 1.6, left: 1, right: 1 }
    },
    columnStyles: {
      0: { cellWidth: 105, halign: 'left' },
      1: { cellWidth: 15, halign: 'right' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' }
    },
    didDrawCell: (data) => {
      if (data.section === 'head' && data.row.index === 0) {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });

  // ── SECCIÓN INFERIOR: CLÁUSULAS, TOTALES Y PIE ──
  const espacioNecesario = 35 + (clausulas.length * 5) + (pieNotas.length * 4) + (firmas ? 24 : 0);
  let y = doc.lastAutoTable.finalY + 10;
  if (y + espacioNecesario > pageHeight - 15) {
    doc.addPage();
    y = 25;
  }

  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  for (const linea of clausulas) {
    if (linea.espacioAntes) y += linea.espacioAntes;
    let currX = marginL;
    for (const p of linea.partes) {
      doc.setFont('times', p.bold ? 'bold' : (p.italic ? 'italic' : 'normal'));
      doc.text(p.text, currX, y);
      currX += doc.getTextWidth(p.text);
    }
    y += 4.5;
  }

  if (clausulas.length > 0) y += 4;

  // Barra de totales con bordes horizontales gruesos
  const barTop = y;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(marginL, barTop, pageWidth - marginR, barTop);

  const textY = barTop + 4.5;
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  if (totalIzq) doc.text(totalIzq, marginL, textY);
  if (totalCentro) doc.text(totalCentro, marginL + 55, textY);
  if (totalDer) doc.text(totalDer, pageWidth - marginR, textY, { align: 'right' });

  const barBottom = barTop + 7;
  doc.line(marginL, barBottom, pageWidth - marginR, barBottom);

  y = barBottom + 5;

  // Pie de página (datos bancarios o notas legales)
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  for (const nota of pieNotas) {
    doc.text(nota, marginL, y);
    y += 3.8;
  }

  // Firmas (para Notas de Entrega)
  if (firmas) {
    y += 16;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(marginL + 15, y, marginL + 70, y);
    doc.line(pageWidth - marginR - 70, y, pageWidth - marginR - 15, y);
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.text('Firma Autorizada / Despacha', marginL + 42.5, y + 4.5, { align: 'center' });
    doc.text('Firma Recibe Conforme', pageWidth - marginR - 42.5, y + 4.5, { align: 'center' });
  }

  if (anulada) {
    doc.setFont('times', 'bold');
    doc.setFontSize(55);
    doc.setTextColor(220, 60, 60);
    doc.text('ANULADA', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 30 });
  }

  if (action === 'print') {
    doc.autoPrint();
    if (typeof window !== 'undefined' && typeof URL !== 'undefined') {
      const url = URL.createObjectURL(doc.output('blob'));
      window.open(url, '_blank');
    }
  } else if (typeof window !== 'undefined') {
    forceDownload(doc.output('blob'), filename);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 1. PDF DE FACTURA (Formato estándar SENIAT / Forma Libre ARJ)
// ═══════════════════════════════════════════════════════════════════
export function generarFacturaPDF(factura, action = 'download') {
  if (!factura) return;

  const empKey = factura.empresa || 'directa';
  const emp = DATOS_EMPRESAS[empKey] || DATOS_EMPRESAS.directa;

  const facturaFecha = formatearFechaSENIAT(factura.fecha);
  const facturaNum = String(factura.num || '70797').trim();

  let fechaVence = factura.vence ? formatearFechaSENIAT(factura.vence) : null;
  if (!fechaVence && factura.tipo_pago === 'credito' && Number(factura.dias_credito) > 0) {
    const fDate = new Date(factura.fecha);
    if (!isNaN(fDate.getTime())) {
      fDate.setDate(fDate.getDate() + Number(factura.dias_credito));
      const dia = String(fDate.getDate()).padStart(2, '0');
      const mes = String(fDate.getMonth() + 1).padStart(2, '0');
      fechaVence = `${dia}/${mes}/${fDate.getFullYear()}`;
    }
  }
  if (!fechaVence) fechaVence = facturaFecha;

  const tasaBCV = Number(factura.tasa_bcv) > 0 ? Number(factura.tasa_bcv) : 1;
  const totalUSD = Number(factura.total != null ? factura.total : (factura.subtotal_usd != null ? factura.subtotal_usd : 0)) || 0;
  const subtotalBs = totalUSD * tasaBCV;

  const filas = (factura.items || []).map(it => {
    const cant = Number(it.cant != null ? it.cant : (it.cantidad != null ? it.cantidad : 1)) || 1;
    const precioUSD = Number(it.precio != null ? it.precio : (it.precio_unitario != null ? it.precio_unitario : 0)) || 0;
    const precioBs = precioUSD * tasaBCV;
    const totalLineaBs = (it.total_linea != null && Number(it.total_linea) > 0)
      ? Number(it.total_linea) * tasaBCV
      : cant * precioBs;
    return [formatearItemDescSENIAT(it), String(cant), fmtBsSENIAT(precioBs), fmtBsSENIAT(totalLineaBs)];
  });

  renderDocumentoFormaLibre({
    titulo: 'FACTURA',
    etiquetaNumero: 'FACTURA N°',
    numero: facturaNum,
    fechaStr: facturaFecha,
    bloqueIzqNombre: factura.cliente_nombre_snap || factura.cliente || emp.nombre || 'AGRO-REPUESTOS Y SERVICIOS JIMENEZ',
    bloqueIzqDir: factura.cliente_dir_snap || factura.cliente_dir || emp.direccion || 'Cr Principal Casa Nro 31 Barrio Altamira, ZP 3301',
    bloqueIzqCiudad: factura.cliente_ciudad_snap || (factura.cliente_dir_snap ? '' : 'Acarigua , Portuguesa'),
    bloqueIzqTel: factura.cliente_tel_snap || factura.cliente_tel || emp.telefono || '+58 412-5574541',
    bloqueIzqRif: factura.cliente_rif_snap || factura.cliente_rif || emp.rif || 'V- 162930024',
    metadatos: [
      ['CONDICION DE PAGO: ', (factura.tipo_pago === 'credito') ? 'Crédito' : 'Contado'],
      ['VENCE: ', fechaVence],
      ['VIA DESPACHO: ', factura.via_despacho || '000'],
      ['ORDEN DE COMPRA N°: ', factura.orden_compra || factura.orden || (facturaNum ? 'S' + facturaNum.replace(/\D/g, '').padStart(5, '0') : 'S07812')],
      ['VENDEDOR: ', (factura.vendedor || 'MGB').toUpperCase()]
    ],
    columnas: ['PRODUCTO', 'CANT', 'PRECIO U.', 'TOTAL'],
    filas,
    clausulas: [
      { partes: [{ text: 'El monto de esta factura equivale a US$ ' }, { text: fmtBsSENIAT(totalUSD), bold: true }, { text: ' calculados en bolívares' }] },
      { partes: [{ text: 'a la tasa BCV del día de hoy de ' }, { text: fmtTasaSENIAT(tasaBCV), bold: true }, { text: ' Bs por dólar' }] },
      { espacioAntes: 2.5, partes: [{ text: 'IGTF 3% por pago en divisas por un monto en bolívares de _____________' }] }
    ],
    totalIzq: `Subtotal  VEF ${fmtBsSENIAT(subtotalBs)}`,
    totalCentro: 'I.V.A. ( 0% EXEMPT ) VEF 0,00',
    totalDer: `TOTAL VEF  ${fmtBsSENIAT(subtotalBs)}`,
    pieNotas: [
      'Favor depositar a nombre de MAQUINARIAS AGROINDUSTRIALES BARPEL CA',
      'Bancaribe Cta. Corriente N° 0114 0195 35 1955000036',
      'Banco Mercantil Cta. Corriente N° 0105 0091 59 1091222762'
    ],
    anulada: factura.estado === 'anulada',
    filename: `Factura_${facturaNum}_${facturaFecha.replace(/[\s\/:]/g, '_')}.pdf`,
    action
  });
}

// ═══════════════════════════════════════════════════════════════════
// 2. PDF DE PRESUPUESTO / COTIZACIÓN (Mismo formato Forma Libre SENIAT)
// ═══════════════════════════════════════════════════════════════════
export function generarPresupuestoPDF(presupuesto, tasa_bcv, clienteData, action = 'print') {
  if (!presupuesto) return;

  const emp = DATOS_EMPRESAS[presupuesto.empresa] || DATOS_EMPRESAS.directa;
  const fechaStr = formatearFechaSENIAT(presupuesto.fecha);
  const numStr = String(presupuesto.num || 'SN').trim();
  const tasa = Number(tasa_bcv || presupuesto.tasa_bcv) || 0;
  const usaBs = tasa > 0;
  const totalUSD = Number(presupuesto.total) || 0;
  const totalBs = totalUSD * tasa;
  const monedaEtq = usaBs ? 'VEF' : 'USD';
  const totalMostrar = usaBs ? totalBs : totalUSD;

  const filas = (presupuesto.items || []).map(it => {
    const cant = Number(it.cant != null ? it.cant : (it.cantidad != null ? it.cantidad : 1)) || 1;
    const precioUSD = Number(it.precio) || 0;
    const precioUnit = usaBs ? precioUSD * tasa : precioUSD;
    const totalLinea = cant * precioUnit;
    return [formatearItemDescSENIAT(it), String(cant), fmtBsSENIAT(precioUnit), fmtBsSENIAT(totalLinea)];
  });

  const clausulas = [];
  if (usaBs) {
    clausulas.push(
      { partes: [{ text: 'El monto de este presupuesto equivale a US$ ' }, { text: fmtBsSENIAT(totalUSD), bold: true }, { text: ' calculados en bolívares' }] },
      { partes: [{ text: 'a la tasa BCV del día de hoy de ' }, { text: fmtTasaSENIAT(tasa), bold: true }, { text: ' Bs por dólar' }] }
    );
  }
  clausulas.push({
    espacioAntes: usaBs ? 2 : 0,
    partes: [{ text: 'Cotización comercial sin valor fiscal. Validez: 45 días calendario.', italic: true }]
  });

  renderDocumentoFormaLibre({
    titulo: 'PRESUPUESTO',
    tituloSize: 16,
    etiquetaNumero: 'PRESUPUESTO N°',
    numero: numStr,
    fechaStr,
    bloqueIzqNombre: (clienteData && clienteData.nombre) || presupuesto.cliente || 'CLIENTE GENERAL',
    bloqueIzqDir: (clienteData && clienteData.direccion) || '',
    bloqueIzqTel: (clienteData && clienteData.telefono) || '',
    bloqueIzqRif: (clienteData && clienteData.rif) || '—',
    metadatos: [
      ['CONDICION: ', 'Cotización'],
      ['VALIDO HASTA: ', presupuesto.vence ? formatearFechaSENIAT(presupuesto.vence) : '45 días'],
      ['EMPRESA: ', presupuesto.empresa === 'distribuidora' ? 'Distribuidora ARJ' : 'Venta Directa'],
      ['VENDEDOR: ', (presupuesto.vendedor || 'ARJ').toUpperCase()]
    ],
    columnas: ['PRODUCTO', 'CANT', usaBs ? 'PRECIO U.' : 'PRECIO U. $', usaBs ? 'TOTAL' : 'TOTAL $'],
    filas,
    clausulas,
    totalIzq: `Subtotal  ${monedaEtq} ${fmtBsSENIAT(totalMostrar)}`,
    totalCentro: `I.V.A. ( 0% EXEMPT ) ${monedaEtq} 0,00`,
    totalDer: `TOTAL ${monedaEtq}  ${fmtBsSENIAT(totalMostrar)}`,
    pieNotas: [
      `${emp.nombre} · ${emp.rif} · Tel: ${emp.telefono}`,
      'Exento de IVA según Decreto 126, Artículo 63, Numeral 02 (Sector agropecuario primario).'
    ],
    filename: `Presupuesto_${numStr}_${fechaStr.replace(/[\s\/:]/g, '_')}.pdf`,
    action
  });
}

// ═══════════════════════════════════════════════════════════════════
// 3. PDF DE ACTA DE CIERRE DE CAJA
// ═══════════════════════════════════════════════════════════════════
export function generarActaCierrePDF(turno, empresa) {
  if (!turno) return;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginL = 14;
  const marginR = 14;
  const contentW = pageWidth - marginL - marginR;

  const empKey = empresa || 'directa';
  const emp = DATOS_EMPRESAS[empKey] || DATOS_EMPRESAS.directa;

  // ── CABECERA EMPRESA (fondo navy) ──
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Nombre de la empresa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...WHITE);
  doc.text(emp.nombre, marginL, 16);

  // Datos de contacto
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(200, 210, 225);
  doc.text(emp.direccion || 'Carretera Nacional Vía La Misión, Barrio Altamira, Local 31', marginL, 23);
  doc.text(`Acarigua — Portuguesa · Teléfonos: ${emp.telefono} · ${emp.rif}`, marginL, 28);

  // ── BADGE ACTA (rojo/navy, esquina derecha) ──
  const badgeW = 60;
  const badgeH = 28;
  const badgeX = pageWidth - marginR - badgeW;
  const badgeY = 7;
  doc.setFillColor(220, 38, 38); // Red
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text('ACTA DE CIERRE', badgeX + badgeW / 2, badgeY + 9, { align: 'center' });

  doc.setFontSize(10);
  doc.text('CAJA Y ARQUEO', badgeX + badgeW / 2, badgeY + 17, { align: 'center' });

  doc.setFontSize(7.5);
  doc.text(new Date().toLocaleDateString('es-VE'), badgeX + badgeW / 2, badgeY + 23, { align: 'center' });

  let y = 50;

  // ── BLOQUE CAJERO + INFORMACIÓN ──
  const blockH = 34;
  const halfW = contentW / 2 - 3;

  // Bloque CAJERO (izquierda)
  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.4);
  doc.rect(marginL, y, halfW, blockH, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...BLUE);
  doc.text('DATOS DEL CAJERO', marginL + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(turno.cajero || 'CAJERO DE TURNO', marginL + 4, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`Apertura: ${turno.fecha_apertura || '—'}`, marginL + 4, y + 20);
  doc.text(`Cierre: ${turno.fecha_cierre || new Date().toLocaleString('es-VE')}`, marginL + 4, y + 26);

  // Bloque INFORMACIÓN (derecha)
  const infoX = marginL + halfW + 6;
  doc.setDrawColor(200, 210, 225);
  doc.rect(infoX, y, halfW, blockH, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...BLUE);
  doc.text('ESTADO DEL TURNO', infoX + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Estado: ', infoX + 4, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38);
  doc.text('CERRADO', infoX + 20, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  const empresaTxt = empKey === 'distribuidora' ? 'Distribuidora ARJ' : 'Venta Directa';
  doc.text(`Empresa: ${empresaTxt}`, infoX + 4, y + 20);
  doc.text(`Fecha acta: ${new Date().toLocaleString('es-VE')}`, infoX + 4, y + 26);

  y += blockH + 8;

  // Tabla resumen caja
  const fondoUSD = turno.inicial_usd || 0;
  const fondoBs = turno.inicial_bs || 0;
  const arqueoUSD = turno.arqueo_usd || 0;
  const arqueoBs = turno.arqueo_bs || 0;
  const ventasUSD = turno.ventas_usd || 0;
  const ventasBs = turno.ventas_bs || 0;
  const difUSD = arqueoUSD - fondoUSD - ventasUSD;
  const difBs = arqueoBs - fondoBs - ventasBs;

  const datosTabla = [
    ['Fondo Inicial', fmtUSD(fondoUSD), `Bs. ${fondoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`],
    ['Ventas del Turno', fmtUSD(ventasUSD), `Bs. ${ventasBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`],
    ['Esperado en Caja', fmtUSD(fondoUSD + ventasUSD), `Bs. ${(fondoBs + ventasBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`],
    ['Arqueo Físico', fmtUSD(arqueoUSD), `Bs. ${arqueoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`],
    ['Diferencia', `${difUSD >= 0 ? '+' : ''}${fmtUSD(difUSD)}`, `${difBs >= 0 ? '+' : ''}Bs. ${difBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`]
  ];

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Monto USD', 'Monto Bs']],
    body: datosTabla,
    theme: 'plain',
    margin: { left: 14, right: 14 },
    headStyles: {
      fillColor: TABLE_HEADER_BG,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 5
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: [51, 51, 51]
    },
    alternateRowStyles: { fillColor: TABLE_ALT_ROW },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: NAVY },
      1: { halign: 'right' },
      2: { halign: 'right' }
    },
    didParseCell: (data) => {
      // Colorear la fila de diferencia
      if (data.row.index === 4 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = difUSD === 0 && difBs === 0 ? GREEN : [220, 38, 38];
        data.cell.styles.fillColor = difUSD === 0 && difBs === 0 ? [236, 253, 245] : [254, 242, 242];
      }
    }
  });

  y = doc.lastAutoTable.finalY + 10;

  // Observaciones
  if (turno.notas_cierre) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text('Observaciones del Cajero:', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 51, 51);
    const lineas = doc.splitTextToSize(turno.notas_cierre, pageWidth - 28);
    doc.text(lineas, 14, y);
    y += lineas.length * 4.5 + 8;
  }

  // Líneas de firma
  y += 10;
  const firmaW = 70;
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.4);
  doc.line(30, y, 30 + firmaW, y);
  doc.line(pageWidth - 30 - firmaW, y, pageWidth - 30, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Firma del Cajero', 30 + firmaW / 2, y + 5, { align: 'center' });
  doc.text('Firma del Supervisor', pageWidth - 30 - firmaW / 2, y + 5, { align: 'center' });

  piePagina(doc, 'Acta de cierre y arqueo de caja. Documento interno de control administrativo.');

  const filename = `Acta_Cierre_Caja_${turno.cajero || 'SN'}_${new Date().toISOString().slice(0, 10)}.pdf`;
  forceDownload(doc.output('blob'), filename);
}

// ═══════════════════════════════════════════════════════════════════
// 4. EXCEL - LISTA DE PRECIOS
// ═══════════════════════════════════════════════════════════════════
export function exportarListaPreciosExcel(productos, tierSel, tasa_bcv, sistemaSel) {
  if (!productos || productos.length === 0) return;

  const datos = productos.map(p => {
    const pUSD = precioConTier(p.fob, tierSel, p);
    const pBs = (pUSD * tasa_bcv).toFixed(2);
    return {
      'CÓDIGO ALTERNO': p.cod_alt || '',
      'CÓDIGO OEM': p.cod_orig || '',
      'DESCRIPCIÓN': p.desc || '',
      'MARCA': p.marca || '',
      'SISTEMA': p.sistema || '',
      'PRECIO USD': parseFloat(pUSD.toFixed(2)),
      'PRECIO Bs': parseFloat(pBs)
    };
  });

  const ws = XLSX.utils.json_to_sheet(datos);

  // Ajustar anchos de columna
  ws['!cols'] = [
    { wch: 18 },  // CÓDIGO ALTERNO
    { wch: 16 },  // CÓDIGO OEM
    { wch: 45 },  // DESCRIPCIÓN
    { wch: 16 },  // MARCA
    { wch: 20 },  // SISTEMA
    { wch: 14 },  // PRECIO USD
    { wch: 14 }   // PRECIO Bs
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lista de Precios');

  // Hoja informativa
  const info = XLSX.utils.aoa_to_sheet([
    ['LISTA DE PRECIOS - SISTEMA ARJ'],
    [''],
    ['Nivel de Precio:', tierSel],
    ['Tasa BCV:', tasa_bcv],
    ['Filtro Sistema:', sistemaSel || 'Todos'],
    ['Fecha de generación:', new Date().toLocaleString('es-VE')],
    ['Total productos:', datos.length],
    [''],
    ['Nota: Repuestos agrícolas exentos de IVA']
  ]);
  info['!cols'] = [{ wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, info, 'Info');

  const filename = `Lista_Precios_${tierSel}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ═══════════════════════════════════════════════════════════════════
// 5. EXCEL - LIBRO DE VENTAS FISCAL
// ═══════════════════════════════════════════════════════════════════
// A-05: libro de ventas por rango de fechas, como el monolito v13: anuladas
// listadas en cero, RIF/nombre/dirección congelados y detalle por renglón.
export function exportarLibroVentasExcel(facturas, items, { empresaSel, etiqueta, sufijo, usuario }) {
  if (!facturas || facturas.length === 0) return;

  let tUSD = 0, tBsCob = 0, tBsBcv = 0;
  const filas = facturas.map(f => {
    const anulada = f.estado === 'anulada';
    const usd = anulada ? 0 : (f.total || 0);
    const tbcv = f.tasa_bcv || 0;
    const fac = f.factor_bs > 0 ? f.factor_bs : 1;
    const bsCob = usd * fac * tbcv;
    const bsBcv = usd * tbcv;
    tUSD += usd; tBsCob += bsCob; tBsBcv += bsBcv;
    return {
      'Fecha': f.fecha || '',
      'Número': f.num || '',
      'Empresa': f.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora',
      'RIF cliente': f.cliente_rif_snap || '',
      'Cliente': f.cliente_nombre_snap || f.cliente || '',
      'Dirección': f.cliente_dir_snap || '',
      'Vendedor': f.vendedor || '',
      'Tipo pago': f.tipo_pago || '',
      'Estado': (f.estado_bd || f.estado || '').toUpperCase(),
      'Pidió fiscal': f.pidio_fiscal ? 'SI' : 'no',
      'Total USD': Number(usd.toFixed(2)),
      'Tasa BCV': Number(tbcv.toFixed(2)),
      'Factor Bs': Number(fac.toFixed(4)),
      'Total Bs cobrado': Number(bsCob.toFixed(2)),
      'Total Bs a BCV': Number(bsBcv.toFixed(2)),
      'Diferencia Bs': Number((bsCob - bsBcv).toFixed(2)),
      'Saldo pendiente USD': Number((anulada ? 0 : (f.saldo_pendiente || 0)).toFixed(2)),
      'Motivo anulación': anulada ? (f.motivo_anulacion || '') : ''
    };
  });

  const wb = XLSX.utils.book_new();

  const cabecera = [
    [`LIBRO DE VENTAS — ${EMISOR_FISCAL.nombre}`],
    ['RIF emisor', EMISOR_FISCAL.rif],
    ['Período', etiqueta],
    ['Empresa', empresaSel === 'directa' ? 'Venta Directa' : (empresaSel === 'distribuidora' ? 'Distribuidora' : 'Ambas')],
    ['Generado', new Date().toLocaleString('es-VE'), 'por', usuario || ''],
    ['NOTA', 'IVA exento — Decreto 126, Art. 63, Num. 02'],
    ['NOTA', 'Las facturas anuladas se listan con monto 0. Totales sin anuladas.'],
    []
  ];
  const ws = XLSX.utils.aoa_to_sheet(cabecera);
  XLSX.utils.sheet_add_json(ws, filas, { origin: -1 });
  XLSX.utils.sheet_add_aoa(ws, [[], ['TOTALES (sin anuladas)', '', '', '', '', '', '', '', '', '',
    Number(tUSD.toFixed(2)), '', '', Number(tBsCob.toFixed(2)), Number(tBsBcv.toFixed(2)), Number((tBsCob - tBsBcv).toFixed(2))]], { origin: -1 });
  XLSX.utils.book_append_sheet(wb, ws, 'Libro de Ventas');

  // Detalle por renglón
  const porFactura = {};
  (items || []).forEach(it => { (porFactura[it.factura_id] = porFactura[it.factura_id] || []).push(it); });
  const detalle = [];
  facturas.forEach(f => {
    const tbcv = f.tasa_bcv || 0;
    const fac = f.factor_bs > 0 ? f.factor_bs : 1;
    (porFactura[f.id] || []).forEach(it => {
      const tot = parseFloat(it.total_linea) || 0;
      detalle.push({
        'Fecha': f.fecha, 'Número': f.num, 'Estado factura': (f.estado_bd || f.estado || '').toUpperCase(),
        'Código': it.cod_alt, 'Descripción': it.descripcion, 'Cantidad': it.cantidad,
        'Precio unit USD': Number((parseFloat(it.precio_unitario) || 0).toFixed(2)),
        'Total línea USD': Number(tot.toFixed(2)),
        'Total línea Bs cobrado': Number((tot * fac * tbcv).toFixed(2)),
        'Total línea Bs a BCV': Number((tot * tbcv).toFixed(2))
      });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle.length ? detalle : [{ 'Sin renglones': '' }]), 'Detalle');

  XLSX.writeFile(wb, `ARJ_fiscal_ventas_${sufijo}.xlsx`);
  return { facturas: facturas.length, totalUSD: tUSD };
}

// ═══════════════════════════════════════════════════════════════════
// 5. PDF DE NOTA DE ENTREGA (Mismo formato Forma Libre)
// ═══════════════════════════════════════════════════════════════════
export function generarNotaEntregaPDF(nota, usuario, action = 'download') {
  if (!nota) return;

  const fStr = nota.fecha instanceof Date ? formatearFechaSENIAT(nota.fecha.toISOString()) : formatearFechaSENIAT(nota.fecha);
  const numStr = String(nota.numero || 'SN').trim();
  const totalCosto = Number(nota.totalCosto) || 0;

  const filas = (nota.items || []).map(it => {
    const cant = Number(it.cantidad != null ? it.cantidad : (it.cant != null ? it.cant : 1)) || 1;
    const costoU = Number(it.costo_unitario) || 0;
    return [
      formatearItemDescSENIAT(it),
      String(cant),
      fmtBsSENIAT(costoU),
      fmtBsSENIAT(cant * costoU)
    ];
  });

  const dateFile = nota.fecha instanceof Date ? nota.fecha.toISOString().split('T')[0] : fStr.replace(/[\s\/:]/g, '_');

  renderDocumentoFormaLibre({
    titulo: 'NOTA DE ENTREGA',
    tituloSize: 14,
    etiquetaNumero: 'NOTA N°',
    numero: numStr,
    fechaStr: fStr,
    bloqueIzqTitulo: 'DESTINO / RECEPCIÓN',
    bloqueIzqNombre: 'VENTA DIRECTA - ARJ',
    bloqueIzqDir: 'Despacho interno desde Distribuidora ARJ C.A.',
    bloqueIzqCiudad: 'Mostrador Acarigua , Portuguesa',
    bloqueIzqTel: '0255-6642208 · 0414-5750174',
    metadatos: [
      ['ORIGEN: ', 'Distribuidora ARJ'],
      ['EMBARQUE: ', nota.embarque || '—'],
      ['REFERENCIA: ', nota.ref || '—'],
      ['AUTORIZA: ', (usuario || 'Sistema').toUpperCase()]
    ],
    columnas: ['PRODUCTO', 'CANT', 'COSTO U. $', 'TOTAL $'],
    filas,
    clausulas: [
      { partes: [{ text: 'Nota de entrega interna sin validez fiscal. Válida para control de inventario y rotación.', italic: true }] }
    ],
    totalIzq: `Items: ${filas.length}`,
    totalCentro: 'TRASPASO INTER-EMPRESA',
    totalDer: `TOTAL COSTO USD  ${fmtBsSENIAT(totalCosto)}`,
    pieNotas: [
      'DISTRIBUIDORA ARJ C.A. · Carretera Nacional Vía La Misión, Barrio Altamira, Local 31'
    ],
    firmas: true,
    anulada: !!nota.anulado,
    filename: `Nota_Entrega_${numStr}_${dateFile}.pdf`,
    action
  });
}
