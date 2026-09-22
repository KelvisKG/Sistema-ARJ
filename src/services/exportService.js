// =====================================================================
// ARJ - Servicio de Exportación PDF & Excel
// jsPDF para documentos formales, SheetJS para datos tabulares
// =====================================================================
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fmtUSD, precioConTier } from './pricing.js';

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

const DATOS_EMPRESAS = {
  directa: {
    nombre: 'ARJ VENTA DIRECTA',
    razon: 'Repuestos Agrícolas y Maquinaria Pesada',
    rif: 'J-12345678-9',
    direccion: 'Acarigua, Estado Portuguesa, Venezuela',
    telefono: '+58 255-000-0000'
  },
  distribuidora: {
    nombre: 'DISTRIBUIDORA ARJ C.A.',
    razon: 'Repuestos Agrícolas y Maquinaria Pesada',
    rif: 'J-98765432-1',
    direccion: 'Acarigua, Estado Portuguesa, Venezuela',
    telefono: '+58 255-000-0001'
  }
};

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
// 1. PDF DE FACTURA
// ═══════════════════════════════════════════════════════════════════
export function generarFacturaPDF(factura, empresa) {
  if (!factura) return;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Cabecera empresa
  let y = cabeceraEmpresa(doc, empresa || factura.empresa || 'directa');

  // Recuadro de factura (esquina superior derecha)
  const numWidth = 68;
  doc.setFillColor(...NAVY);
  doc.roundedRect(pageWidth - numWidth - 14, 10, numWidth, 22, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text('FACTURA', pageWidth - numWidth - 14 + numWidth / 2, 19, { align: 'center' });
  doc.setFontSize(13);
  doc.text(`N° ${factura.num}`, pageWidth - numWidth - 14 + numWidth / 2, 28, { align: 'center' });

  y = separador(doc, y);
  y += 3;

  // Datos del cliente y condiciones (en recuadro gris)
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(14, y, pageWidth - 28, 24, 2, 2, 'F');

  const colIzq = 18;
  const colDer = pageWidth / 2 + 5;

  etiquetaValor(doc, 'Cliente:', factura.cliente || 'MOSTRADOR GENERAL', colIzq, y + 5);
  etiquetaValor(doc, 'Vendedor:', factura.vendedor || '—', colIzq, y + 16);
  etiquetaValor(doc, 'Fecha:', factura.fecha || new Date().toLocaleDateString('es-VE'), colDer, y + 5);
  etiquetaValor(doc, 'Condición:', (factura.tipo_pago || 'contado').toUpperCase(), colDer, y + 16);

  y += 30;

  // Tabla de productos
  const listaItems = (factura.items && factura.items.length > 0) 
    ? factura.items 
    : [{
        cod_alt: 'GEN-000',
        desc: 'Repuestos Agrícolas (Detalle de sistema heredado)',
        cant: 1,
        precio: factura.total || 0
      }];

  const items = listaItems.map((it, idx) => [
    idx + 1,
    it.cod_alt || '—',
    it.desc || 'Producto',
    it.cant || 1,
    fmtUSD(it.precio || 0),
    fmtUSD((it.cant || 1) * (it.precio || 0))
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Código', 'Descripción', 'Cant', 'P. Unit.', 'Total']],
    body: items,
    theme: 'plain',
    margin: { left: 14, right: 14 },
    headStyles: {
      fillColor: TABLE_HEADER_BG,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 4,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3.5,
      textColor: [51, 51, 51]
    },
    alternateRowStyles: {
      fillColor: TABLE_ALT_ROW
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: GRAY },
      1: { cellWidth: 30, fontStyle: 'bold', textColor: NAVY },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
    },
    didDrawPage: () => {
      // Barra superior en cada página
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pageWidth, 4, 'F');
    }
  });

  y = doc.lastAutoTable.finalY + 8;

  // Bloque de totales (alineado a la derecha)
  const totalBoxW = 85;
  const totalBoxX = pageWidth - totalBoxW - 14;

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text('Subtotal:', totalBoxX, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 51, 51);
  doc.text(fmtUSD(factura.total || 0), pageWidth - 14, y, { align: 'right' });

  y += 6;

  // IVA
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('IVA (Exento Ley Agrícola):', totalBoxX, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 51, 51);
  doc.text('$0.00', pageWidth - 14, y, { align: 'right' });

  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(totalBoxX, y, pageWidth - 14, y);
  y += 6;

  // TOTAL USD (grande)
  doc.setFillColor(...NAVY);
  doc.roundedRect(totalBoxX - 2, y - 5, totalBoxW + 4, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text('TOTAL USD:', totalBoxX + 3, y + 4);
  doc.text(fmtUSD(factura.total || 0), pageWidth - 16, y + 4, { align: 'right' });

  y += 14;

  // Total en Bs
  const tasa = factura.tasa_bcv || 47.80;
  const totalBs = ((factura.total || 0) * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(`Total en Bs (Tasa BCV ${tasa}):  Bs. ${totalBs}`, totalBoxX, y);

  // Pie de página
  piePagina(doc);

  // Descargar
  const filename = `Factura_${factura.num || 'SN'}_${(factura.fecha || '').replace(/\s/g, '_')}.pdf`;
  forceDownload(doc.output('blob'), filename);
}

// ═══════════════════════════════════════════════════════════════════
// 2. PDF DE PRESUPUESTO / COTIZACIÓN
// ═══════════════════════════════════════════════════════════════════
export function generarPresupuestoPDF(presupuesto, tasa_bcv) {
  if (!presupuesto) return;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = cabeceraEmpresa(doc, presupuesto.empresa || 'directa');

  // Recuadro de presupuesto
  const numWidth = 72;
  doc.setFillColor(...BLUE);
  doc.roundedRect(pageWidth - numWidth - 14, 10, numWidth, 22, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text('PRESUPUESTO', pageWidth - numWidth - 14 + numWidth / 2, 19, { align: 'center' });
  doc.setFontSize(11);
  doc.text(presupuesto.num || 'SN', pageWidth - numWidth - 14 + numWidth / 2, 28, { align: 'center' });

  y = separador(doc, y);
  y += 3;

  // Datos del cliente
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(14, y, pageWidth - 28, 24, 2, 2, 'F');

  etiquetaValor(doc, 'Cliente:', presupuesto.cliente || 'MOSTRADOR GENERAL', 18, y + 5);
  etiquetaValor(doc, 'Vendedor:', presupuesto.vendedor || '—', 18, y + 16);
  etiquetaValor(doc, 'Fecha emisión:', presupuesto.fecha || '—', pageWidth / 2 + 5, y + 5);
  etiquetaValor(doc, 'Vigencia hasta:', presupuesto.vence || '45 días', pageWidth / 2 + 5, y + 16);

  y += 30;

  // Aviso de vigencia
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(14, y, pageWidth - 28, 10, 2, 2, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, pageWidth - 28, 10, 2, 2, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text('⚠  Esta cotización tiene una validez comercial de 45 días a partir de su fecha de emisión. Precios sujetos a disponibilidad.', 19, y + 6.5);

  y += 16;

  // Tabla de items
  const listaItemsPres = (presupuesto.items && Array.isArray(presupuesto.items) && presupuesto.items.length > 0) 
    ? presupuesto.items 
    : [{
        cod_alt: 'GEN-000',
        desc: 'Repuestos Agrícolas (Cotización heredada)',
        cant: 1,
        precio: presupuesto.total || 0
      }];

  const items = listaItemsPres.map((it, idx) => [
    idx + 1,
    it.cod_alt || '—',
    it.desc || 'Producto',
    it.cant || 1,
    fmtUSD(it.precio || 0),
    fmtUSD((it.cant || 1) * (it.precio || 0))
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Código', 'Descripción', 'Cant', 'P. Unit.', 'Total']],
    body: items,
    theme: 'plain',
    margin: { left: 14, right: 14 },
    headStyles: {
      fillColor: BLUE,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 4
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3.5,
      textColor: [51, 51, 51]
    },
    alternateRowStyles: { fillColor: TABLE_ALT_ROW },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: GRAY },
      1: { cellWidth: 30, fontStyle: 'bold', textColor: NAVY },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
    }
  });

  y = doc.lastAutoTable.finalY + 8;

  // Totales
  const totalBoxW = 85;
  const totalBoxX = pageWidth - totalBoxW - 14;

  doc.setFillColor(...BLUE);
  doc.roundedRect(totalBoxX - 2, y - 2, totalBoxW + 4, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text('TOTAL COTIZACIÓN:', totalBoxX + 3, y + 7);
  doc.text(fmtUSD(presupuesto.total || 0), pageWidth - 16, y + 7, { align: 'right' });

  y += 18;
  const tasa = tasa_bcv || 47.80;
  const totalBs = ((presupuesto.total || 0) * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(`Equivalente en Bs (Tasa BCV ${tasa}):  Bs. ${totalBs}`, totalBoxX, y);

  piePagina(doc, 'Cotización comercial sin valor fiscal. Precios exentos de IVA (sector agropecuario). Validez: 45 días calendario.');

  const filename = `Presupuesto_${presupuesto.num || 'SN'}_${(presupuesto.fecha || '').replace(/\s/g, '_')}.pdf`;
  forceDownload(doc.output('blob'), filename);
}

// ═══════════════════════════════════════════════════════════════════
// 3. PDF DE ACTA DE CIERRE DE CAJA
// ═══════════════════════════════════════════════════════════════════
export function generarActaCierrePDF(turno, empresa) {
  if (!turno) return;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = cabeceraEmpresa(doc, empresa || 'directa');

  // Título
  const numWidth = 72;
  doc.setFillColor(220, 38, 38);
  doc.roundedRect(pageWidth - numWidth - 14, 10, numWidth, 22, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text('ACTA DE CIERRE', pageWidth - numWidth - 14 + numWidth / 2, 19, { align: 'center' });
  doc.setFontSize(11);
  doc.text('CAJA Y ARQUEO', pageWidth - numWidth - 14 + numWidth / 2, 28, { align: 'center' });

  y = separador(doc, y);
  y += 3;

  // Datos del turno
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(14, y, pageWidth - 28, 24, 2, 2, 'F');

  etiquetaValor(doc, 'Cajero:', turno.cajero || '—', 18, y + 5);
  etiquetaValor(doc, 'Apertura:', turno.fecha_apertura || '—', 18, y + 16);
  etiquetaValor(doc, 'Cierre:', turno.fecha_cierre || new Date().toLocaleString('es-VE'), pageWidth / 2 + 5, y + 5);
  etiquetaValor(doc, 'Estado:', 'CERRADO', pageWidth / 2 + 5, y + 16, GRAY, [220, 38, 38]);

  y += 32;

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
export function exportarLibroVentasExcel(facturas, empresaSel, mesSel, anoSel) {
  if (!facturas || facturas.length === 0) return;

  const datos = facturas.map(f => ({
    'FECHA': f.fecha || '',
    'N° FACTURA': f.num || '',
    'CLIENTE / RAZÓN SOCIAL': f.cliente || '',
    'RIF': f.rif || 'J-V-EXENTO',
    'MONTO EXENTO USD': parseFloat((f.total || 0).toFixed(2)),
    'TASA BCV': parseFloat(f.tasa_bcv || 0),
    'MONTO EXENTO Bs': parseFloat(((f.total || 0) * (f.tasa_bcv || 0)).toFixed(2)),
    'BASE IMPONIBLE': 0.00,
    'IVA RETENIDO': 0.00
  }));

  const ws = XLSX.utils.json_to_sheet(datos);

  ws['!cols'] = [
    { wch: 14 },   // FECHA
    { wch: 16 },   // N° FACTURA
    { wch: 35 },   // CLIENTE
    { wch: 16 },   // RIF
    { wch: 18 },   // MONTO USD
    { wch: 12 },   // TASA BCV
    { wch: 18 },   // MONTO Bs
    { wch: 16 },   // BASE IMPONIBLE
    { wch: 14 }    // IVA
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Libro de Ventas');

  // Hoja de resumen
  const totalUSD = facturas.reduce((a, f) => a + (parseFloat(f.total) || 0), 0);
  const resumen = XLSX.utils.aoa_to_sheet([
    ['LIBRO DE VENTAS FISCAL - SISTEMA ARJ'],
    [''],
    ['Empresa:', empresaSel === 'directa' ? 'ARJ Venta Directa' : (empresaSel === 'distribuidora' ? 'Distribuidora ARJ C.A.' : 'Ambas empresas')],
    ['Período:', `${mesSel}/${anoSel}`],
    ['Fecha generación:', new Date().toLocaleString('es-VE')],
    [''],
    ['Total facturas:', facturas.length],
    ['Total exento USD:', totalUSD.toFixed(2)],
    ['Base imponible:', '0.00'],
    ['IVA retenido:', '0.00'],
    [''],
    ['Nota: Repuestos agrícolas exentos de IVA según normativa tributaria venezolana para el sector primario y agropecuario.']
  ]);
  resumen['!cols'] = [{ wch: 22 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, resumen, 'Resumen');

  const filename = `Libro_Ventas_${empresaSel}_${anoSel}_${mesSel}.xlsx`;
  XLSX.writeFile(wb, filename);
}
