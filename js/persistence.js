// === Local Storage Persistence ===
    // ═══════════════════════════════════════════════════════════════
    // PERSISTENCIA EN LOCALSTORAGE (v11)
    // ═══════════════════════════════════════════════════════════════
    // Guarda automáticamente todos los datos del negocio en localStorage del
    // navegador. Si se cierra la pestaña o se reinicia el equipo, al volver
    // a abrir el sistema se cargan los últimos datos guardados.
    //
    // IMPORTANTE: localStorage es POR NAVEGADOR Y POR EQUIPO. No sincroniza
    // entre máquinas ni entre navegadores. Para sistema multi-sede está la
    // Entrega 2 (Node.js + PostgreSQL). Aquí solo cubrimos el prototipo.
    const ARJ_STORAGE_KEY = 'ARJ_DATOS_v1';
    const ARJ_SCHEMA_VERSION = 1;
    let _persistenciaLista = false; // se vuelve true después de cargar (evita guardar mientras cargamos)
    let _guardadoPendiente = null;  // timer para debounce

    // Arma el snapshot de TODO lo persistible. Usado por: auto-save, exportar JSON.
    function _serializarDatos() {
      return {
        schema_version: ARJ_SCHEMA_VERSION,
        fecha_guardado: new Date().toISOString(),
        PRODUCTOS: PRODUCTOS,
        SISTEMAS: SISTEMAS,
        CLIENTES: CLIENTES,
        FACTURAS_COBRAR: FACTURAS_COBRAR,
        VENTAS_RECIENTES: VENTAS_RECIENTES,
        COTIZACIONES: COTIZACIONES,
        APARTADOS: APARTADOS,
        FAVORITOS_OBLIGATORIOS: FAVORITOS_OBLIGATORIOS,
        FAVORITOS_PERSONALES: FAVORITOS_PERSONALES,
        TURNOS: TURNOS,
        ALERTAS: ALERTAS,
        LISTAS_PRECIOS: LISTAS_PRECIOS,
        BITACORA: BITACORA,
        USUARIOS: USUARIOS,
        metas: (typeof metas !== 'undefined') ? metas : null,
        ventasMesActual: (typeof ventasMesActual !== 'undefined') ? ventasMesActual : null,
        tasas: { tasa_par: estado.tasa_par, tasa_bcv: estado.tasa_bcv }
      };
    }

    // Guarda con debounce de 300ms: si se llama 10 veces seguidas, guarda solo 1.
    function guardarDatos() {
      if (!_persistenciaLista) return; // no guardar antes de haber cargado
      if (_guardadoPendiente) clearTimeout(_guardadoPendiente);
      _guardadoPendiente = setTimeout(_guardadoInmediato, 300);
    }

    function _guardadoInmediato() {
      try {
        const json = JSON.stringify(_serializarDatos());
        localStorage.setItem(ARJ_STORAGE_KEY, json);
        _guardadoPendiente = null;
      } catch (e) {
        _guardadoPendiente = null;
        const msg = (e && e.message) || '';
        if (e && (e.name === 'QuotaExceededError' || /quota|exceeded/i.test(msg))) {
          if (typeof notif === 'function') notif('⚠ Almacenamiento lleno. Exporta un respaldo y considera resetear datos antiguos.', 'error');
          console.error('[ARJ] localStorage lleno:', e);
        } else {
          console.error('[ARJ] Error guardando:', e);
        }
      }
    }

    // Aplica un objeto de datos cargados a las variables globales del sistema.
    // Usa mutación in-place para no romper las referencias (los const arrays no
    // se pueden reasignar; algunos let se reasignan internamente con .filter()).
    function _aplicarDatosCargados(datos) {
      const reemplazarArr = (arr, nuevos) => {
        arr.length = 0;
        if (Array.isArray(nuevos)) nuevos.forEach(x => arr.push(x));
      };
      const reemplazarObj = (obj, nuevos) => {
        Object.keys(obj).forEach(k => delete obj[k]);
        if (nuevos && typeof nuevos === 'object') Object.assign(obj, nuevos);
      };
      // const arrays
      if (datos.PRODUCTOS) reemplazarArr(PRODUCTOS, datos.PRODUCTOS);
      if (datos.CLIENTES) reemplazarArr(CLIENTES, datos.CLIENTES);
      if (datos.FACTURAS_COBRAR) reemplazarArr(FACTURAS_COBRAR, datos.FACTURAS_COBRAR);
      if (datos.VENTAS_RECIENTES) reemplazarArr(VENTAS_RECIENTES, datos.VENTAS_RECIENTES);
      // const objeto
      if (datos.USUARIOS) reemplazarObj(USUARIOS, datos.USUARIOS);
      // let arrays (también in-place por seguridad)
      if (datos.SISTEMAS) reemplazarArr(SISTEMAS, datos.SISTEMAS);
      if (datos.COTIZACIONES) reemplazarArr(COTIZACIONES, datos.COTIZACIONES);
      if (datos.APARTADOS) reemplazarArr(APARTADOS, datos.APARTADOS);
      if (datos.FAVORITOS_OBLIGATORIOS) reemplazarArr(FAVORITOS_OBLIGATORIOS, datos.FAVORITOS_OBLIGATORIOS);
      if (datos.TURNOS) reemplazarArr(TURNOS, datos.TURNOS);
      if (datos.ALERTAS) reemplazarArr(ALERTAS, datos.ALERTAS);
      if (datos.LISTAS_PRECIOS) reemplazarArr(LISTAS_PRECIOS, datos.LISTAS_PRECIOS);
      if (datos.BITACORA) reemplazarArr(BITACORA, datos.BITACORA);
      // let objeto (favoritos personales: {usuario: [cods]})
      if (datos.FAVORITOS_PERSONALES) reemplazarObj(FAVORITOS_PERSONALES, datos.FAVORITOS_PERSONALES);
      // objetos sueltos (metas, ventasMesActual están declarados más adelante en el script;
      // si todavía no existen al cargar, se aplicarán cuando se inicialicen porque guardamos
      // referencia al objeto, no copia. Si ya existen, sobreescribimos)
      if (datos.metas && typeof metas !== 'undefined') reemplazarObj(metas, datos.metas);
      if (datos.ventasMesActual && typeof ventasMesActual !== 'undefined') reemplazarObj(ventasMesActual, datos.ventasMesActual);
      // tasas
      if (datos.tasas) {
        if (typeof datos.tasas.tasa_par === 'number') estado.tasa_par = datos.tasas.tasa_par;
        if (typeof datos.tasas.tasa_bcv === 'number') estado.tasa_bcv = datos.tasas.tasa_bcv;
      }
    }

    // Carga al arrancar el script. Retorna true si había datos guardados.
    function cargarDatos() {
      try {
        const raw = localStorage.getItem(ARJ_STORAGE_KEY);
        if (!raw) return false;
        const datos = JSON.parse(raw);
        if (!datos || typeof datos !== 'object') return false;
        _aplicarDatosCargados(datos);
        return true;
      } catch (e) {
        console.error('[ARJ] Error cargando datos guardados:', e);
        return false;
      }
    }

    // EXPORTAR DATOS A ARCHIVO JSON (descarga manual de respaldo)
    function exportarDatosJSON() {
      try {
        const datos = _serializarDatos();
        const json = JSON.stringify(datos, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ahora = new Date();
        const fecha = ahora.getFullYear() + '-' +
          String(ahora.getMonth() + 1).padStart(2, '0') + '-' +
          String(ahora.getDate()).padStart(2, '0') + '_' +
          String(ahora.getHours()).padStart(2, '0') + '-' +
          String(ahora.getMinutes()).padStart(2, '0');
        a.href = url;
        a.download = `ARJ_backup_${fecha}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notif('Respaldo descargado: ' + a.download, 'success');
        if (typeof logBitacora === 'function') logBitacora('factura', 'Exportó respaldo de datos a JSON', false);
      } catch (e) {
        notif('Error al exportar: ' + e.message, 'error');
      }
    }

    // IMPORTAR DATOS DESDE ARCHIVO JSON
    function importarDatosJSON() {
      const inp = document.getElementById('input-import-json');
      if (inp) inp.click();
    }

    function _procesarArchivoImport(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) { return; }
      if (!confirm('⚠ Esto REEMPLAZARÁ todos los datos actuales por los del archivo "' + file.name + '".\n\n¿Estás seguro de continuar?')) {
        event.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const datos = JSON.parse(e.target.result);
          if (!datos || typeof datos !== 'object') {
            notif('El archivo no tiene formato válido', 'error'); event.target.value = ''; return;
          }
          if (datos.schema_version && datos.schema_version > ARJ_SCHEMA_VERSION) {
            if (!confirm('⚠ El archivo fue generado por una versión más nueva del sistema (schema ' + datos.schema_version + ' vs ' + ARJ_SCHEMA_VERSION + '). Puede que algunos datos no carguen bien. ¿Continuar de todos modos?')) {
              event.target.value = ''; return;
            }
          }
          _aplicarDatosCargados(datos);
          _guardadoInmediato();
          notif('Datos importados correctamente. Recargando para aplicar todo...', 'success');
          if (typeof logBitacora === 'function') logBitacora('factura', 'Importó datos desde archivo JSON: ' + file.name, true);
          setTimeout(() => location.reload(), 1200);
        } catch (err) {
          notif('Archivo inválido: ' + err.message, 'error');
        }
        event.target.value = '';
      };
      reader.onerror = function () {
        notif('Error leyendo el archivo', 'error');
        event.target.value = '';
      };
      reader.readAsText(file);
    }

    // RESETEAR A DATOS DEMO
    function resetearDatosDemo() {
      if (!confirm('⚠ ADVERTENCIA\n\nEsto va a BORRAR todos los datos guardados (clientes, productos, facturas, bitácora, etc.) y volver a los datos demo originales.\n\n¿Continuar?')) return;
      if (!confirm('Confirmación final:\n\nSe perderá todo lo que hayas agregado o modificado.\n\nSi quieres conservar una copia, exporta el JSON primero.\n\n¿Resetear ahora?')) return;
      try {
        localStorage.removeItem(ARJ_STORAGE_KEY);
        notif('Datos reseteados. Recargando con datos demo...', 'warning');
        setTimeout(() => location.reload(), 800);
      } catch (e) {
        notif('Error al resetear: ' + e.message, 'error');
      }
    }
