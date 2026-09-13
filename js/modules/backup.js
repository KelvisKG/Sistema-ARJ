// === Backup Local ===
    function backupInventario() {
      if (!PRODUCTOS.length) { notif('No hay productos cargados', 'error'); return; }
      // 'Costo sin recargo divisas' es VISTA DE GESTIÓN, no cifra contable.
      const filas = [['Codigo', 'Cod. original', 'Descripcion', 'Marca', 'Sistema', 'Origen', 'Proveedor',
        'Embarque', 'FOB USD', 'Factor landed', 'Costo landed USD', 'Costo sin recargo divisas USD',
        'Precio publico USD', 'Margen %', 'Stock VD', 'Stock Dist', 'Aplicacion']];
      PRODUCTOS.forEach(p => {
        const emb = EMBARQUES.find(x => x.id === p.embarque_id);
        const sd = costoSinDivisas(p);
        const pv = precioLista(p);
        const mg = pv > 0 ? (100 * (pv - costoLanded(p)) / pv) : 0;
        filas.push([
          p.cod_alt, p.cod_orig || '', p.desc, p.marca || '', p.sistema || '',
          p.origen || 'importado', p.proveedor || '', emb ? emb.codigo : '',
          (p.fob || 0).toFixed(2), (p.factor_landed || FACTOR_LANDED_FALLBACK).toFixed(4),
          costoLanded(p).toFixed(2), sd == null ? '' : sd.toFixed(2),
          pv.toFixed(2), mg.toFixed(1),
          p.stock_vd || 0, p.stock_dist || 0, p.marca_modelo || ''
        ]);
      });
      _descargarCSV('ARJ_inventario_' + _hoyArchivo() + '.csv', filas);
      logBitacora('inventario', 'Descargó respaldo de inventario (' + PRODUCTOS.length + ' productos)', false);
      notif(PRODUCTOS.length + ' productos descargados', 'success');
    }

    function backupSemanal() {
      const hoy = new Date();
      const desde = new Date(hoy.getTime() - 7 * 86400000);
      const facts = (TODAS_FACTURAS || []).filter(f => f.fecha_raw && new Date(f.fecha_raw) >= desde);
      if (!facts.length) { notif('No hay facturas en los últimos 7 días', 'error'); return; }
      // ═══════════════════════════════════════════════════════════
      // v13.36 — UNIDADES SEPARADAS.
      // `subtotal_usd` es el BRUTO en $BCV, antes del descuento. El descuento
      // (manual + divisas + redondeo) vive en `descuento_manual`. Y lo que de
      // verdad entra a la caja cuando se paga en efectivo es `cobrar_verde`,
      // que son $verdes y NO se suman con $BCV.
      // Antes este export mostraba solo el bruto en $BCV bajo el rotulo
      // ambiguo "Total USD": el descuento no aparecia y el verde tampoco.
      // ═══════════════════════════════════════════════════════════
      const filas = [['RESUMEN SEMANAL ARJ — ' + desde.toLocaleDateString('es-VE') + ' al ' + hoy.toLocaleDateString('es-VE')],
      ['Los montos $BCV y los $verdes son unidades distintas. NO se suman entre si.'], [],
      ['Factura', 'Fecha', 'Empresa', 'Cliente', 'Vendedor', 'Tipo', 'Estado',
        'Bruto $BCV', 'Descuento $BCV', 'Neto $BCV', 'Cobrado en $verde',
        'Abonado $BCV', 'Saldo $BCV', 'Motivo del descuento']];
      let totBruto = 0, totDto = 0, totNeto = 0, totVerde = 0, totSaldo = 0, totAbon = 0, nVerde = 0;
      facts.forEach(f => {
        const bruto = f.total || 0;                       // subtotal_usd, $BCV
        const dto = f.descuento_manual || 0;              // $BCV
        const neto = Math.round((bruto - dto) * 100) / 100;
        const saldo = f.saldo_pendiente || 0;             // $BCV
        // Abonado real = lo saldado del NETO. El calculo viejo partia del
        // bruto, asi que contaba el descuento como si fuera un pago.
        const abon = Math.round((neto - saldo) * 100) / 100;
        const cv = (f.cobrar_verde != null && f.cobrar_verde > 0) ? f.cobrar_verde : null;
        if (f.estado !== 'anulada') {
          totBruto += bruto; totDto += dto; totNeto += neto;
          totSaldo += saldo; totAbon += abon;
          if (cv != null) { totVerde += cv; nVerde++; }
        }
        filas.push([f.num, f.fecha, f.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora',
          f.cliente_nombre_snap || f.cliente, f.vendedor || '', f.tipo_pago || '', (f.estado || '').toUpperCase(),
          bruto.toFixed(2), dto.toFixed(2), neto.toFixed(2),
          cv != null ? cv.toFixed(2) : '',
          abon.toFixed(2), saldo.toFixed(2), f.motivo_descuento || '']);
      });
      filas.push([]);
      filas.push(['TOTAL BRUTO $BCV (sin anuladas)', '', '', '', '', '', '', totBruto.toFixed(2)]);
      filas.push(['TOTAL DESCUENTOS $BCV', '', '', '', '', '', '', totDto.toFixed(2)]);
      filas.push(['TOTAL NETO FACTURADO $BCV', '', '', '', '', '', '', totNeto.toFixed(2)]);
      filas.push(['TOTAL COBRADO $BCV', '', '', '', '', '', '', totAbon.toFixed(2)]);
      filas.push(['TOTAL POR COBRAR $BCV', '', '', '', '', '', '', totSaldo.toFixed(2)]);
      filas.push([]);
      filas.push(['TOTAL ACORDADO EN $VERDE (' + nVerde + ' factura(s))', '', '', '', '', '', '', '', '', '', totVerde.toFixed(2)]);
      filas.push(['Esta cifra NO se suma con las de arriba: son dolares distintos.']);
      _descargarCSV('ARJ_semana_' + _hoyArchivo() + '.csv', filas);
      logBitacora('inventario', 'Descargó resumen semanal (' + facts.length + ' facturas)', false);
      notif(facts.length + ' facturas de la semana descargadas', 'success');
    }

    // Respaldo completo: JSON con TODO lo que hay en memoria. No es un .zip
    // porque comprimir requiere libreria externa; el JSON es lo que de verdad
    // sirve para reconstruir, y pesa poco.
    function backupCompleto() {
      const dump = {
        generado: new Date().toISOString(),
        version: 'v13.2',
        tasas: { par: estado.tasa_par, bcv: estado.tasa_bcv },
        equipo: EQUIPO,
        metas_hist: METAS_HIST,
        costos_fijos_hist: estado.costos_fijos_hist,
        productos: PRODUCTOS,
        clientes: CLIENTES,
        facturas: TODAS_FACTURAS,
        cotizaciones: COTIZACIONES,
        bitacora: BITACORA
      };
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'ARJ_respaldo_completo_' + _hoyArchivo() + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      logBitacora('inventario', 'Descargó respaldo completo del sistema', true);
      notif('Respaldo completo descargado', 'success');
    }

    function renderBackup() {
      const cont = document.getElementById('backup-content');
      if (!cont) return;
      const nFact = (TODAS_FACTURAS || []).length;
      const hoy = new Date();
      const desde = new Date(hoy.getTime() - 7 * 86400000);
      const nSem = (TODAS_FACTURAS || []).filter(f => f.fecha_raw && new Date(f.fecha_raw) >= desde).length;

      cont.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div style="background:var(--lgreen);border-radius:8px;padding:16px">
        <div style="font-size:13px;font-weight:600;color:var(--green);margin-bottom:6px"><i class="ti ti-cloud-check"></i> Respaldo automático en la nube</div>
        <div style="font-size:12px;color:var(--dgray);line-height:1.6">
          Estado: <strong style="color:var(--green)">● Activo</strong> — cada factura, cliente y producto se guarda en Supabase al instante.<br>
          Cargado ahora: <strong>${PRODUCTOS.length}</strong> productos · <strong>${CLIENTES.length}</strong> clientes · <strong>${nFact}</strong> facturas
        </div>
      </div>
      <div style="background:var(--lblue);border-radius:8px;padding:16px">
        <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:6px"><i class="ti ti-shield-check"></i> Por qué descargar igual</div>
        <div style="font-size:12px;color:var(--dgray);line-height:1.6">
          El respaldo en la nube te protege de que se dañe la computadora.<br>
          El respaldo <strong>en tu mano</strong> te protege de un borrado por error o de perder el acceso a la cuenta.
        </div>
      </div>
    </div>
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:16px;margin-top:14px">
      <div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:12px">Descargar respaldo manual</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        <button class="btn btn-secondary" onclick="backupSemanal()" ${nSem ? '' : 'disabled title="No hay facturas esta semana"'}><i class="ti ti-file-spreadsheet"></i> Resumen semanal (${nSem})</button>
        <button class="btn btn-secondary" onclick="backupCompleto()"><i class="ti ti-database-export"></i> Respaldo completo (.json)</button>
        <button class="btn btn-secondary" onclick="backupInventario()" ${PRODUCTOS.length ? '' : 'disabled'}><i class="ti ti-package"></i> Solo inventario (${PRODUCTOS.length})</button>
      </div>
      <div style="background:#FFF8E1;border-left:3px solid var(--gold);border-radius:6px;padding:10px 14px;margin-top:14px;font-size:12px;color:#5D4037">
        <i class="ti ti-info-circle"></i> <strong>Rutina sugerida:</strong> cada viernes descarga el "Resumen semanal" y guárdalo en una carpeta o pendrive. Los dos primeros abren con doble clic en Excel; el <strong>.json</strong> no se lee a simple vista, pero es el que sirve para reconstruir todo si hace falta.
      </div>
    </div>`;
    }



    // v11: muestra info del último guardado y tamaño en localStorage
    function renderInfoBackup() {
      const elUlt = document.getElementById('cfg-ultimo-guardado');
      const elTam = document.getElementById('cfg-tam-storage');
      try {
        const raw = localStorage.getItem(ARJ_STORAGE_KEY);
        if (!raw) {
          if (elUlt) elUlt.textContent = 'Sin datos guardados aún';
          if (elTam) elTam.textContent = '0 KB';
          return;
        }
        const datos = JSON.parse(raw);
        if (elUlt && datos.fecha_guardado) {
          const f = new Date(datos.fecha_guardado);
          elUlt.textContent = f.toLocaleString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        if (elTam) {
          const bytes = new Blob([raw]).size;
          const kb = bytes / 1024;
          elTam.textContent = kb > 1024 ? (kb / 1024).toFixed(2) + ' MB' : kb.toFixed(1) + ' KB';
        }
      } catch (e) {
        if (elUlt) elUlt.textContent = '—';
        if (elTam) elTam.textContent = '—';
      }
    }