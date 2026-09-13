// === Backup Supabase ===
    // ═══════════════════════════════════════════════════════════════
    // RESPALDO COMPLETO (v13.30)
    // El plan Free de Supabase NO hace respaldos automaticos. Esto baja todo
    // a un JSON en la maquina del usuario.
    //
    // DOS TRAMPAS QUE ESTA FUNCION EVITA:
    // 1. Supabase corta en 1000 filas por consulta. Sin paginar, `bitacora`
    //    se respaldaria truncada Y SIN AVISAR. Se pagina de 1000 en 1000.
    // 2. Si una tabla falla (no existe, RLS la bloquea), NO se aborta: se
    //    anota el error y se sigue. Un respaldo parcial declarado vale mas
    //    que ninguno; uno parcial silencioso es una trampa.
    // ═══════════════════════════════════════════════════════════════
    const TABLAS_RESPALDO = [
      'productos', 'clientes', 'contactos_cliente', 'facturas', 'factura_items',
      'pagos', 'cotizaciones', 'cotizacion_items', 'embarques', 'recepciones',
      'recepcion_items', 'traspasos', 'traspaso_items', 'movimientos_caja',
      'contadores', 'configuracion', 'sistemas', 'perfiles', 'usuarios', 'bitacora',
      // Existen en la base pero el codigo NO las escribe (verificado v13.31).
      // Se respaldan igual: si alguien las llena por SQL o las usa el Vue,
      // el respaldo ya las cubre sin tener que acordarse de agregarlas.
      'notas_credito', 'nota_credito_items', 'inventario'
    ];
    const RESP_PAGINA = 1000;

    async function _respTabla(tabla) {
      let filas = [], desde = 0;
      for (let vuelta = 0; vuelta < 200; vuelta++) {       // tope duro anti-bucle
        const { data, error } = await _sb.from(tabla)
          .select('*').range(desde, desde + RESP_PAGINA - 1);
        if (error) return { error: error.message || String(error) };
        if (!data || data.length === 0) break;
        filas = filas.concat(data);
        if (data.length < RESP_PAGINA) break;              // ultima pagina
        desde += RESP_PAGINA;
      }
      return { filas: filas };
    }

    async function respaldarTodo() {
      const btn = document.getElementById('btn-respaldar');
      const est = document.getElementById('resp-estado');
      if (!_sb || !_supabaseConectado) {
        notif('Sin conexión a la base. No se puede respaldar.', 'error'); return;
      }
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Respaldando...'; }

      const inicio = Date.now();
      const datos = {}, conteo = {}, fallos = {};
      let totalFilas = 0;

      for (let i = 0; i < TABLAS_RESPALDO.length; i++) {
        const t = TABLAS_RESPALDO[i];
        if (est) est.innerHTML = '<i class="ti ti-loader"></i> Leyendo <strong>' + t + '</strong>… ('
          + (i + 1) + ' de ' + TABLAS_RESPALDO.length + ')';
        const r = await _respTabla(t);
        if (r.error) { fallos[t] = r.error; continue; }
        datos[t] = r.filas; conteo[t] = r.filas.length; totalFilas += r.filas.length;
      }

      const nFallos = Object.keys(fallos).length;
      const paquete = {
        _meta: {
          sistema: 'ARJ', version: 'v13.33',
          generado: new Date().toISOString(),
          generado_legible: new Date().toLocaleString('es-VE'),
          usuario: estado.usuario || '?',
          proyecto: SUPABASE_URL,
          tablas_ok: Object.keys(datos).length,
          tablas_con_error: nFallos,
          total_filas: totalFilas,
          conteo_por_tabla: conteo,
          errores: fallos,
          nota: 'Respaldo completo de lectura. Para restaurar hace falta reinsertar tabla por tabla respetando el orden de dependencias (productos y clientes primero, luego facturas, luego factura_items y pagos).'
        },
        datos: datos
      };

      const nom = 'ARJ_RESPALDO_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_'
        + String(new Date().getHours()).padStart(2, '0') + String(new Date().getMinutes()).padStart(2, '0') + '.json';
      const blob = new Blob([JSON.stringify(paquete, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = nom; a.click();
      URL.revokeObjectURL(a.href);

      const seg = ((Date.now() - inicio) / 1000).toFixed(1);
      const mb = (blob.size / 1048576).toFixed(2);
      try { localStorage.setItem('arj_ultimo_respaldo', new Date().toISOString()); } catch (e) { }

      let h = '<div style="padding:9px 11px;border-radius:6px;background:'
        + (nFallos ? '#FFF4E5;border-left:3px solid #BF8F00' : '#EAF6EC;border-left:3px solid #1E7B34') + '">'
        + '<strong>' + (nFallos ? '⚠ Respaldo parcial' : '✓ Respaldo completo') + '</strong> — '
        + totalFilas.toLocaleString('es-VE') + ' filas de ' + Object.keys(datos).length + ' tablas · '
        + mb + ' MB · ' + seg + 's<br>'
        + '<span style="font-size:11.5px;color:var(--dgray)">' + nom + '</span>';
      if (nFallos) {
        h += '<div style="margin-top:5px;font-size:11.5px"><strong>No se pudo leer:</strong> '
          + Object.keys(fallos).map(k => k + ' (' + fallos[k] + ')').join(' · ') + '</div>';
      }
      h += '</div>';
      if (est) est.innerHTML = h;
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-download"></i> Respaldar todo ahora'; }
      _respUltimo();
      logBitacora('config', 'Respaldo de base: ' + totalFilas + ' filas, ' + Object.keys(datos).length
        + ' tablas' + (nFallos ? ', ' + nFallos + ' con error' : ''), false);
      notif(nFallos ? '⚠ Respaldo descargado, pero ' + nFallos + ' tabla(s) fallaron' : '✓ Respaldo descargado — guárdalo en OneDrive', nFallos ? 'warning' : 'success');
    }

    // Aviso de antiguedad: un respaldo de hace 3 semanas da falsa tranquilidad.
    function _respUltimo() {
      const el = document.getElementById('resp-ultimo');
      if (!el) return;
      let iso = null;
      try { iso = localStorage.getItem('arj_ultimo_respaldo'); } catch (e) { }
      if (!iso) { el.innerHTML = '<span style="color:#B00020;font-weight:600">Nunca has respaldado desde esta PC</span>'; return; }
      const d = new Date(iso);
      const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
      const txt = dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : 'hace ' + dias + ' días';
      const col = dias >= 14 ? '#B00020' : dias >= 7 ? '#BF8F00' : 'var(--dgray)';
      el.innerHTML = '<span style="color:' + col + (dias >= 7 ? ';font-weight:600' : '') + '">Último respaldo: '
        + txt + ' (' + d.toLocaleDateString('es-VE') + ')' + (dias >= 7 ? ' — toca respaldar' : '') + '</span>';
    }
