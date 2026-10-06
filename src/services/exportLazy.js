// =====================================================================
// ARJ - Carga diferida de exportaciones (B-04)
// jsPDF y SheetJS pesan cientos de KB: se descargan recién la primera vez
// que alguien genera un PDF o un Excel, no al abrir el sistema.
// =====================================================================
const cargar = () => import('./exportService.js');

export const generarFacturaPDF = async (...a) => (await cargar()).generarFacturaPDF(...a);
export const generarPresupuestoPDF = async (...a) => (await cargar()).generarPresupuestoPDF(...a);
export const generarActaCierrePDF = async (...a) => (await cargar()).generarActaCierrePDF(...a);
export const exportarListaPreciosExcel = async (...a) => (await cargar()).exportarListaPreciosExcel(...a);
export const exportarLibroVentasExcel = async (...a) => (await cargar()).exportarLibroVentasExcel(...a);
export const generarNotaEntregaPDF = async (...a) => (await cargar()).generarNotaEntregaPDF(...a);

// Emisor del libro de ventas (igual que el monolito v13)
export const EMISOR_FISCAL = { nombre: 'ARJ / FINARMA C.A.', rif: 'J-29620983-9' };
