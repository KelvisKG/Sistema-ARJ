// === Utilities & Helpers ===
    function fmtUSD(n) { return '$ ' + (Math.round(n * 100) / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

    // v13.33 `f.dias` NO es el plazo del credito: son los dias que FALTAN para
    // vencer, recalculados contra la fecha de hoy en cada carga (~5720). En una
    // factura ya saldada el contador no significa nada, y pasada la fecha salia
    // en negativo ("Credito -3d"). Solo cuenta mientras se deba algo.
    function etiquetaCredito(f) {
      if (!f || f.tipo_pago !== 'credito') return 'Contado';
      if (f.estado === 'pagada' || f.estado === 'anulada') return 'Crédito';
      const d = parseInt(f.dias, 10);
      if (isNaN(d)) return 'Crédito';
      if (d < 0) return '<span style="color:var(--red);font-weight:600" title="Venció hace '
        + Math.abs(d) + (Math.abs(d) === 1 ? ' día' : ' días') + '">Crédito · venció</span>';
      if (d === 0) return '<span style="color:var(--gold);font-weight:600" title="Vence hoy">Crédito · vence hoy</span>';
      return '<span title="' + (d === 1 ? 'Falta 1 día' : 'Faltan ' + d + ' días') + ' para vencer">Crédito · ' + d + 'd</span>';
    }
    // v13.20 Una tasa sin cargar mostraba "Bs. 0,00", que parece un dato real.
    // Ahora muestra una raya: se ve que FALTA, no que valga cero.
    function fmtBS(n) {
      if (n === null || n === undefined || !isFinite(Number(n))) return '\u2014';
      return 'Bs. ' + (Math.round(n * 100) / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    // Declarada como function (no const) a proposito: se usa en el arranque,
    // dentro de aplicarConfig(). Una const tiene TDZ y podria reventar si el
    // orden de ejecucion cambia; una function declaration esta siempre lista.
    function tasaOk(t) { return isFinite(parseFloat(t)) && parseFloat(t) > 0; }
    function redondeoBonito(p) {
      return Math.ceil(p * 2) / 2;  // hacia arriba al $0.50 más cercano
    }

    function nombreEmpresa(e) { return e === 'directa' ? 'Venta Directa' : e === 'dist' ? 'Distribuidora' : 'Ambas'; }


    function normalize(s) {
      return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '');
    }
    function highlight(text, query) {
      if (!query || !text) return text;
      // Antes el filtro era length>=2: con una sola letra el array quedaba vacío,
      // el regex se volvía '()' y coincidía en CADA posición (pintaba letra por letra).
      const partes = query.split(/\s+/).filter(w => w.length >= 1)
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (partes.length === 0) return text;
      const re = new RegExp('(' + partes.join('|') + ')', 'gi');
      return text.replace(re, '<mark>$1</mark>');
    }


    function parseMontoVE(v) {
      if (typeof v !== 'string') return parseFloat(v) || 0;
      v = v.trim().replace(/[^\d.,-]/g, '');
      if (!v) return 0;
      const uc = v.lastIndexOf(','), up = v.lastIndexOf('.');
      if (uc > -1 && up > -1) {
        // Hay ambos: el que aparece de último es el decimal
        if (uc > up) v = v.replace(/\./g, '').replace(',', '.');
        else v = v.replace(/,/g, '');
      } else if (uc > -1) {
        // Solo comas: una sola con 1-2 dígitos después = decimal; si no, miles
        const partes = v.split(',');
        v = (partes.length === 2 && partes[1].length <= 2) ? v.replace(',', '.') : v.replace(/,/g, '');
      } else if (up > -1) {
        // Solo puntos: si el último grupo tiene 1-2 dígitos, ese punto es el decimal
        const partes = v.split('.');
        const ult = partes[partes.length - 1];
        if (ult.length <= 2 && partes.length > 1) {
          v = partes.slice(0, -1).join('') + '.' + ult;
        } else {
          v = v.replace(/\./g, '');
        }
      }
      return parseFloat(v) || 0;
    }

    // ─── RESPALDO — DESCARGAS REALES (v13.2) ───
    // Genera CSV desde los datos YA cargados en memoria. No consulta Supabase
    // de nuevo: si estas viendo el sistema, la data ya esta aqui.
    // CSV y no Excel de verdad (.xlsx) porque generar xlsx requiere una libreria
    // externa; Excel abre el CSV sin problema con doble clic.

    function _csvEsc(v) {
      if (v === null || v === undefined) return '';
      let s = String(v);
      // v13.12 DECIMAL CON COMA. El CSV escribia "1.4710" y Excel en español lee
      // el punto como separador de MILES: mostraba 14.710 y el factor landed
      // parecia diez veces mas grande. Se convierte solo si el valor es un numero
      // puro (digitos, punto, digitos). Codigos como CAR123475 o 040668R1 no
      // entran en el patron, y las fechas usan guiones, asi que no se tocan.
      // Sale sin comillas: el separador de columnas ya es ';', asi que la coma
      // decimal no rompe nada, y entrecomillarla haria que algunos importadores
      // la tomen como texto en vez de numero.
      if (/^-?\d+\.\d+$/.test(s)) return s.replace('.', ',');
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    // Separador ';' porque Excel en configuracion regional es-VE usa la coma
    // como decimal. Con ',' todo cae en una sola columna.
    function _descargarCSV(nombre, filas) {
      const cuerpo = filas.map(f => f.map(_csvEsc).join(';')).join('\r\n');
      // BOM para que Excel respete los acentos
      const blob = new Blob(['\uFEFF' + cuerpo], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function _hoyArchivo() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }


    function notif(msg, tipo) {
      const el = document.getElementById('notif');
      document.getElementById('notif-text').textContent = msg;
      el.className = 'notif show ' + (tipo || '');
      setTimeout(() => el.classList.remove('show'), 3500);
    }
