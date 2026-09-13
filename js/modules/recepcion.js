// === Recepcion y Conteo ===
    function abrirRecepcion() {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede hacer esto', 'error'); return; }
      if (!_sb || !_supabaseConectado) { notif('Sin conexión a la base de datos', 'error'); return; }
      if (!PRODUCTOS.length) { notif('No hay catálogo cargado', 'error'); return; }
      _recAnalisis = null;
      document.getElementById('rec-texto').value = '';
      _recLlenarMarcas();
      document.getElementById('rec-ref').value = '';
      _recLlenarEmbarques();
      document.getElementById('rec-modo').value = 'conteo';
      document.getElementById('rec-destino').value = 'dist';
      // v13.11: se acota por MARCA, no por proveedor. El campo proveedor está
      // vacío en casi todo el catálogo, así que el filtro no servía y el conteo
      // comparaba contra los 373 productos: salían cientos de "no contados".
      const provs = [...new Set(PRODUCTOS.filter(p => p.activo !== false)
        .map(p => (p.marca || '').trim()).filter(x => x))].sort();
      document.getElementById('rec-proveedor').innerHTML =
        '<option value="">Todas las marcas</option>'
        + provs.map(x => {
            const n = PRODUCTOS.filter(p => (p.marca || '').trim() === x && p.activo !== false).length;
            return `<option value="${x}">${x} (${n})</option>`;
          }).join('');
      recAvisoModo();
      recVolver();
      document.getElementById('modal-recepcion').classList.add('show');
    }
    function cerrarRecepcion() {
      document.getElementById('modal-recepcion').classList.remove('show');
      _recAnalisis = null;
    }

    function recAvisoModo() {
      const modo = document.getElementById('rec-modo').value;
      document.getElementById('rec-wrap-prov').style.display = modo === 'conteo' ? '' : 'none';
      document.getElementById('rec-aviso-modo').innerHTML = modo === 'conteo'
        ? `<div style="background:#FFF8E1;border-left:3px solid var(--gold);border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:11.5px;color:#5D4037">
        <i class="ti ti-info-circle"></i> Compara tu conteo contra el sistema y te muestra las diferencias. <strong>No modifica nada</strong> hasta que lo decidas al final.
      </div>`
        : `<div style="background:var(--lgreen);border-left:3px solid var(--green);border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:11.5px;color:#1B5E20">
        <i class="ti ti-plus"></i> Las cantidades se <strong>suman</strong> al stock que ya existe. Para corregir stock usa Conteo físico.
      </div>`;
    }

    function recVolver() {
      document.getElementById('rec-paso1').style.display = '';
      document.getElementById('rec-paso2').style.display = 'none';
      document.getElementById('rec-paso3').style.display = 'none';
      document.getElementById('rec-btn-analizar').style.display = '';
      document.getElementById('rec-btn-aplicar').style.display = 'none';
      document.getElementById('rec-btn-exportar').style.display = 'none';
      document.getElementById('rec-btn-volver').style.display = 'none';
      document.getElementById('rec-btn-cancelar').style.display = '';
      document.getElementById('rec-btn-cancelar').textContent = 'Cancelar';
    }

    function _recParsear(texto) {
      const filas = [];
      texto.split(/\r?\n/).forEach((linea, i) => {
        const t = linea.trim();
        if (!t) return;
        // Separadores probados de MENOS a MAS ambiguo. La coma va de ultima
        // porque en Venezuela tambien es el separador decimal: si se prueba
        // primero, "1,5" se parte en dos y leeriamos 5 en vez de avisar.
        let partes = null;
        for (const sep of [/\t+/, /;+/, /\s{2,}/, /\s+/, /,+/]) {
          const p = t.split(sep).map(x => x.trim()).filter(x => x);
          if (p.length >= 2) { partes = p; break; }
        }
        if (!partes) { filas.push({ linea: i + 1, crudo: t, error: 'Falta la cantidad' }); return; }
        const cod = partes[0].toUpperCase();
        const cantTxt = partes[partes.length - 1];
        // El stock son unidades enteras. Un decimal casi siempre es un separador
        // de miles mal interpretado ("1.234" son 1234 piezas, no 1) o una columna
        // de sobra. Se rechaza en vez de redondear en silencio.
        if (!/^\d+$/.test(cantTxt)) {
          filas.push({ linea: i + 1, crudo: t, cod, error: 'La cantidad debe ser entero, sin comas ni puntos' });
          return;
        }
        filas.push({ linea: i + 1, crudo: t, cod, cant: parseInt(cantTxt, 10) });
      });
      return filas;
    }

    function _recBuscar(cod) {
      return PRODUCTOS.find(x => String(x.cod_alt).toUpperCase() === cod
        || (x.cod_orig && String(x.cod_orig).toUpperCase() === cod));
    }

    // ═══════════════════════════════════════════════════════════════
    // SELLADO DE COSTO POR EMBARQUE (v13.10)
    // Al recibir, cada producto de la lista se queda con el factor del
    // embarque GRABADO EN SU PROPIA FILA. Editar el embarque despues no
    // reescribe nada: el costo de lo ya recibido es historia, no formula.
    // Un producto que YA tenia otro embarque NO se toca: se reporta aparte.
    // ═══════════════════════════════════════════════════════════════
    // Trae al cuadro los códigos de una marca con el stock que YA tiene el
    // sistema. Sirve cuando el conteo ya se cargó a mano y solo falta sellar
    // el costo: se pega, se revisa y se aplica sin teclear nada.
    function _recLlenarMarcas() {
      const sel = document.getElementById('rec-marca');
      if (!sel) return;
      const marcas = [...new Set(PRODUCTOS.filter(p => p.activo !== false)
        .map(p => (p.marca || '').trim()).filter(Boolean))].sort();
      sel.innerHTML = '<option value="">— Elegir marca —</option>'
        + marcas.map(m => {
            const n = PRODUCTOS.filter(p => (p.marca || '').trim() === m && p.activo !== false).length;
            return `<option value="${m}">${m} (${n})</option>`;
          }).join('');
    }

    function recTraerMarca() {
      const m = document.getElementById('rec-marca').value;
      if (!m) { notif('Elige una marca primero', 'error'); return; }
      const destino = document.getElementById('rec-destino').value;
      const campo = destino === 'vd' ? 'stock_vd' : 'stock_dist';
      const lista = PRODUCTOS.filter(p => (p.marca || '').trim() === m && p.activo !== false);
      if (!lista.length) { notif('No hay productos de ' + m, 'error'); return; }
      const ta = document.getElementById('rec-texto');
      const txt = lista.map(p => `${p.cod_alt}\t${parseInt(p[campo]) || 0}`).join('\n');
      if (ta.value.trim() && !confirm('El cuadro ya tiene texto. ¿Reemplazarlo?')) return;
      ta.value = txt;
      notif(`${lista.length} código(s) de ${m} traídos con su stock actual`, 'success');
    }

    function _recLlenarEmbarques() {
      const sel = document.getElementById('rec-embarque');
      if (!sel) return;
      const act = EMBARQUES.filter(e => e.activo !== false);
      sel.innerHTML = '<option value="">— No sellar costo —</option>'
        + act.map(e => `<option value="${e.id}">${e.codigo} · factor ${(parseFloat(e.factor)||0).toFixed(4)}</option>`).join('');
      recAvisoEmbarque();
    }

    function recAvisoEmbarque() {
      const div = document.getElementById('rec-aviso-embarque');
      const sel = document.getElementById('rec-embarque');
      if (!div || !sel) return;
      const e = EMBARQUES.find(x => x.id === sel.value);
      if (!e) {
        div.innerHTML = '<div style="background:#F5F5F5;border-left:3px solid var(--dgray);border-radius:6px;padding:8px 11px;margin-bottom:10px;font-size:11.5px;color:var(--dgray)">'
          + '<i class="ti ti-info-circle"></i> Sin embarque: solo se ajusta el stock. El costo de cada producto queda como está.</div>';
        return;
      }
      const f = parseFloat(e.factor) || 0;
      div.innerHTML = '<div style="background:#E8F5E9;border-left:3px solid var(--green);border-radius:6px;padding:8px 11px;margin-bottom:10px;font-size:11.5px;color:#1B5E20">'
        + `<i class="ti ti-ship"></i> Los productos de la lista quedarán sellados con <strong>factor ${f.toFixed(4)}</strong> `
        + `y proveedor <strong>${e.proveedor}</strong>. Una pieza de FOB $10 pasará a costar ${fmtUSD(10 * f)}.</div>`;
    }

    // Separa los productos en: se pueden sellar / ya tienen OTRO embarque.
    function _recSellado(A, embId, prods) {
      A.embId = embId || '';
      A.sellar = []; A.conflicto = [];
      if (!embId) return;
      const e = EMBARQUES.find(x => x.id === embId);
      if (!e) { A.embId = ''; return; }
      A.emb = e;
      prods.forEach(p => {
        if (p.embarque_id && p.embarque_id !== embId) {
          const otro = EMBARQUES.find(x => x.id === p.embarque_id);
          A.conflicto.push({ prod: p, cod: p.cod_alt, otro: otro ? otro.codigo : '(desconocido)' });
        } else if (p.embarque_id !== embId) {
          A.sellar.push(p);
        }
      });
    }

    function recAnalizar() {
      const texto = document.getElementById('rec-texto').value;
      if (!texto.trim()) { notif('Pega la lista primero', 'error'); return; }
      const modo = document.getElementById('rec-modo').value;
      const destino = document.getElementById('rec-destino').value;
      const prov = document.getElementById('rec-proveedor').value;
      const embId = document.getElementById('rec-embarque').value || '';
      const campo = destino === 'vd' ? 'stock_vd' : 'stock_dist';
      const nomDest = destino === 'vd' ? 'Venta Directa' : 'Distribuidora';

      const filas = _recParsear(texto);
      const contado = {}, desconocidos = [], malas = [];

      filas.forEach(f => {
        if (f.error) { malas.push(f); return; }
        const p = _recBuscar(f.cod);
        if (!p) { desconocidos.push(f); return; }
        // Un codigo repetido se ACUMULA siempre: el mismo repuesto puede venir en
        // dos cajas, o contarse en dos estanterias distintas.
        if (contado[p.cod_alt]) { contado[p.cod_alt].cant += f.cant; contado[p.cod_alt].lineas.push(f.linea); }
        else contado[p.cod_alt] = { prod: p, cant: f.cant, lineas: [f.linea] };
      });

      if (modo === 'recepcion') {
        const ok = Object.values(contado).map(c => ({
          prod: c.prod, cod: c.prod.cod_alt, cant: c.cant, lineas: c.lineas,
          actual: c.prod[campo] || 0, nuevo: (c.prod[campo] || 0) + c.cant
        }));
        _recAnalisis = { tipo: 'recepcion', ok, malas: malas.concat(desconocidos.map(d => ({ ...d, error: 'Código no existe en el catálogo' }))), campo, destino, nomDest };
        _recSellado(_recAnalisis, embId, Object.values(contado).map(c => c.prod));
        _recPintarRecepcion();
      } else {
        // ── CONCILIACIÓN ──
        const cuadran = [], faltan = [], sobran = [];
        Object.values(contado).forEach(c => {
          const sis = c.prod[campo] || 0;
          const dif = c.cant - sis;
          const fila = { prod: c.prod, cod: c.prod.cod_alt, sistema: sis, fisico: c.cant, dif, lineas: c.lineas };
          if (dif === 0) cuadran.push(fila);
          else if (dif < 0) faltan.push(fila);
          else sobran.push(fila);
        });
        // NO CONTADOS: tienen stock en el sistema y no aparecen en la lista.
        // Es el unico lugar donde se ve un renglon que nunca llego.
        const noContados = PRODUCTOS.filter(p =>
          (p[campo] || 0) > 0
          && !contado[p.cod_alt]
          && (!prov || (p.marca || '').trim() === prov)
        ).map(p => ({ prod: p, cod: p.cod_alt, sistema: p[campo] || 0, fisico: 0, dif: -(p[campo] || 0) }));

        _recAnalisis = { tipo: 'conteo', cuadran, faltan, sobran, noContados, desconocidos, malas, campo, destino, nomDest, prov };
        _recSellado(_recAnalisis, embId, Object.values(contado).map(c => c.prod));
        _recPintarConteo();
      }

      document.getElementById('rec-paso1').style.display = 'none';
      document.getElementById('rec-paso2').style.display = '';
      document.getElementById('rec-btn-analizar').style.display = 'none';
      document.getElementById('rec-btn-volver').style.display = '';
      document.getElementById('rec-btn-cancelar').style.display = 'none';
    }

    function _recPintarRecepcion() {
      const { ok, malas, nomDest } = _recAnalisis;
      const unid = ok.reduce((a, r) => a + r.cant, 0);
      const valor = ok.reduce((a, r) => a + costoLanded(r.prod) * r.cant, 0);
      document.getElementById('rec-resumen').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${_recKpi('Se actualizan', ok.length, 'var(--green)', 'var(--lgreen)')}
      ${_recKpi('Unidades', unid.toLocaleString('es-VE'), 'var(--navy)', 'var(--lblue)')}
      ${_recKpi('Valor a costo', fmtUSD(valor), '#854F0B', 'var(--lgold)')}
    </div>
    ${malas.length ? `<div style="background:#FEF5F5;border-left:3px solid var(--red);border-radius:6px;padding:8px 12px;margin-top:8px;font-size:11.5px;color:#B71C1C">
      <i class="ti ti-x"></i> ${malas.length} línea(s) con problema <strong>no se van a tocar</strong>.</div>` : ''}`;

      let t = `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--gray);position:sticky;top:0">
      <th style="text-align:left;padding:7px 10px">Código</th><th style="text-align:left;padding:7px 10px">Descripción</th>
      <th style="text-align:right;padding:7px 10px">Tiene</th><th style="text-align:right;padding:7px 10px">Entra</th>
      <th style="text-align:right;padding:7px 10px">Queda</th></tr></thead><tbody>`;
      ok.forEach(r => {
        t += `<tr style="border-top:1px solid var(--border)">
      <td style="padding:6px 10px;font-family:ui-monospace,monospace">${r.cod}${r.lineas.length > 1 ? ' <span style="color:var(--dgray);font-size:10px">×' + r.lineas.length + '</span>' : ''}</td>
      <td style="padding:6px 10px;color:var(--dgray)">${(r.prod.desc || '').slice(0, 40)}</td>
      <td style="padding:6px 10px;text-align:right;color:var(--dgray)">${r.actual}</td>
      <td style="padding:6px 10px;text-align:right;font-weight:600">+${r.cant}</td>
      <td style="padding:6px 10px;text-align:right;font-weight:700;color:var(--green)">${r.nuevo}</td></tr>`;
      });
      malas.forEach(m => {
        t += `<tr style="border-top:1px solid var(--border);background:#FEF5F5"><td style="padding:6px 10px;color:var(--red);font-family:ui-monospace,monospace">${m.cod || '—'}</td>
      <td colspan="4" style="padding:6px 10px;color:var(--red)">Línea ${m.linea}: ${m.error}</td></tr>`;
      });
      document.getElementById('rec-tabla').innerHTML = t + '</tbody></table>';
      document.getElementById('rec-btn-aplicar').style.display = ok.length ? '' : 'none';
      document.getElementById('rec-btn-aplicar').innerHTML = '<i class="ti ti-check"></i> Sumar al stock';
    }

    function _recKpi(lbl, val, color, bg) {
      return `<div style="background:${bg};border-radius:8px;padding:10px 12px">
      <div style="font-size:10.5px;color:var(--dgray);text-transform:uppercase;letter-spacing:.04em">${lbl}</div>
      <div style="font-size:19px;font-weight:600;color:${color}">${val}</div></div>`;
    }

    function _recPintarConteo() {
      const A = _recAnalisis;
      // Valor del descuadre a costo landed: es la plata que esta en juego.
      // v13.11: "Falta" y "No contados" son cosas DISTINTAS y ya no se suman.
      // Falta = lo contaste y salió menos -> SÍ se ajusta al aplicar.
      // No contados = ni siquiera está en tu lista -> NO se toca.
      // Antes se mostraban juntos y un conteo de 17 piezas anunciaba 345 faltantes.
      const vFalta = A.faltan.reduce((a, r) => a + costoLanded(r.prod) * Math.abs(r.dif), 0);
      const vNoCont = A.noContados.reduce((a, r) => a + costoLanded(r.prod) * Math.abs(r.dif), 0);
      const vSobra = A.sobran.reduce((a, r) => a + costoLanded(r.prod) * r.dif, 0);
      const nFalta = A.faltan.length;

      document.getElementById('rec-resumen').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
      ${_recKpi('Cuadran', A.cuadran.length, 'var(--green)', 'var(--lgreen)')}
      ${_recKpi('Falta', nFalta, nFalta ? 'var(--red)' : 'var(--dgray)', nFalta ? '#FEF5F5' : 'var(--gray)')}
      ${_recKpi('Sobra', A.sobran.length, A.sobran.length ? '#854F0B' : 'var(--dgray)', A.sobran.length ? 'var(--lgold)' : 'var(--gray)')}
      ${_recKpi('No contados', A.noContados.length, 'var(--dgray)', 'var(--gray)')}
      ${_recKpi('Descuadre', fmtUSD(vFalta - vSobra), (vFalta - vSobra) > 0 ? 'var(--red)' : 'var(--navy)', 'var(--lblue)')}
    </div>
    <div style="font-size:11px;color:var(--dgray);margin-top:6px">
      Almacén: <strong>${A.nomDest}</strong>${A.prov ? ' · Marca: <strong>' + A.prov + '</strong>' : ''} ·
      Faltante ${fmtUSD(vFalta)} · Sobrante ${fmtUSD(vSobra)} — valorado a costo landed
    </div>
    ${A.noContados.length ? `<div style="background:var(--gray);border-radius:6px;padding:8px 11px;margin-top:8px;font-size:11.5px;color:var(--dgray)">
      <i class="ti ti-eye-off"></i> Los <strong>${A.noContados.length} no contados</strong> (${fmtUSD(vNoCont)}) <strong>NO se van a tocar</strong> —
      no están en tu lista. Para que no aparezcan, usa el filtro <strong>"Solo marca"</strong> arriba.</div>` : ''}`;

      const secc = (titulo, filas, color, bg, icono, nota, colapsado) => {
        if (!filas.length) return '';
        const id = 'recs-' + titulo.replace(/[^a-z]/gi, '');
        return `<div style="margin-bottom:10px">
      <div onclick="document.getElementById('${id}').style.display = document.getElementById('${id}').style.display==='none'?'':'none'"
           style="cursor:pointer;background:${bg};padding:8px 12px;border-radius:6px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:600;font-size:12.5px;color:${color}"><i class="ti ti-${icono}"></i> ${titulo} (${filas.length})</span>
        <span style="font-size:10.5px;color:var(--dgray)">${nota || ''} ▾</span>
      </div>
      <div id="${id}" style="display:${colapsado ? 'none' : ''}">
        <table style="width:100%;border-collapse:collapse;font-size:12px"><tbody>
        ${filas.map(r => `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:5px 10px;font-family:ui-monospace,monospace;width:110px">${r.cod}</td>
          <td style="padding:5px 10px;color:var(--dgray)">${(r.prod.desc || '').slice(0, 38)}</td>
          <td style="padding:5px 10px;text-align:right;width:70px;color:var(--dgray)">sist. ${r.sistema}</td>
          <td style="padding:5px 10px;text-align:right;width:70px">fís. ${r.fisico}</td>
          <td style="padding:5px 10px;text-align:right;width:60px;font-weight:700;color:${r.dif < 0 ? 'var(--red)' : r.dif > 0 ? '#854F0B' : 'var(--green)'}">${r.dif > 0 ? '+' : ''}${r.dif}</td>
          <td style="padding:5px 10px;text-align:right;width:85px;color:var(--dgray)">${fmtUSD(costoLanded(r.prod) * Math.abs(r.dif))}</td>
        </tr>`).join('')}
        </tbody></table>
      </div></div>`;
      };

      let html = '';
      html += secc('Falta — el sistema dice más de lo que contaste', A.faltan, 'var(--red)', '#FEF5F5', 'alert-triangle', 'revisar');
      html += secc('No contados — tienen stock y no están en tu lista', A.noContados, 'var(--red)', '#FEF5F5', 'eye-off', '¿no llegaron?');
      html += secc('Sobra — contaste más de lo que dice el sistema', A.sobran, '#854F0B', 'var(--lgold)', 'plus', 'revisar factura');
      if (A.desconocidos.length) {
        html += `<div style="background:var(--lblue);padding:8px 12px;border-radius:6px;margin-bottom:10px;font-size:12px;color:var(--navy)">
      <strong><i class="ti ti-help"></i> ${A.desconocidos.length} código(s) que no están en el catálogo:</strong><br>
      <span style="font-family:ui-monospace,monospace;font-size:11px">${A.desconocidos.map(d => d.cod + ' (' + d.cant + ')').join(' · ')}</span></div>`;
      }
      if (A.malas.length) {
        html += `<div style="background:#FEF5F5;padding:8px 12px;border-radius:6px;margin-bottom:10px;font-size:12px;color:#B71C1C">
      <strong><i class="ti ti-x"></i> ${A.malas.length} línea(s) mal escritas:</strong><br>
      ${A.malas.map(m => 'Línea ' + m.linea + ': ' + m.error).join('<br>')}</div>`;
      }
      html += secc('Cuadran perfecto', A.cuadran, 'var(--green)', 'var(--lgreen)', 'circle-check', 'sin diferencia', true);

      if (!A.faltan.length && !A.sobran.length && !A.noContados.length) {
        const nSel = (A.sellar || []).length;
        html = `<div style="text-align:center;padding:24px;color:var(--green)">
      <i class="ti ti-circle-check" style="font-size:40px"></i>
      <div style="font-size:15px;font-weight:600;margin-top:8px">Todo cuadra</div>
      <div style="font-size:12px;color:var(--dgray)">El conteo coincide con el sistema en los ${A.cuadran.length} productos revisados</div>
      ${nSel ? `<div style="font-size:12.5px;color:var(--navy);margin-top:10px;background:var(--lblue);border-radius:6px;padding:9px 12px;display:inline-block">
        Falta sellar el costo de <strong>${nSel}</strong> producto(s) con <strong>${A.emb.codigo}</strong> — usa el botón de abajo.</div>` : ''}
      </div>` + html;
      }

      document.getElementById('rec-tabla').innerHTML = html;
      document.getElementById('rec-btn-exportar').style.display = '';
      // v13.11: el botón también debe salir cuando NO hay ajuste de stock pero
      // sí hay costos por sellar. Un conteo que cuadra perfecto es el caso normal
      // cuando el stock ya se cargó a mano y lo único que falta es el sellado.
      const hayAjuste = A.faltan.length + A.sobran.length > 0;
      const haySello = (A.sellar || []).length > 0;
      document.getElementById('rec-btn-aplicar').style.display = (hayAjuste || haySello) ? '' : 'none';
      document.getElementById('rec-btn-aplicar').innerHTML = hayAjuste
        ? '<i class="ti ti-adjustments"></i> Ajustar sistema al físico'
        : `<i class="ti ti-ship"></i> Sellar costo de ${(A.sellar || []).length} producto(s)`;
    }

    function recExportar() {
      const A = _recAnalisis;
      if (!A || A.tipo !== 'conteo') return;
      const filas = [['CONTEO FÍSICO ARJ — ' + A.nomDest + (A.prov ? ' — Proveedor: ' + A.prov : '')],
      ['Fecha', new Date().toLocaleString('es-VE')],
      ['Referencia', (document.getElementById('rec-ref').value || '').trim()], [],
      ['Grupo', 'Codigo', 'Descripcion', 'Sistema', 'Fisico', 'Diferencia', 'Costo landed unit', 'Valor diferencia']];
      const add = (grupo, arr) => arr.forEach(r => filas.push([grupo, r.cod, r.prod.desc || '',
        r.sistema, r.fisico, r.dif, costoLanded(r.prod).toFixed(2), (costoLanded(r.prod) * Math.abs(r.dif)).toFixed(2)]));
      add('FALTA', A.faltan); add('NO CONTADO', A.noContados); add('SOBRA', A.sobran); add('CUADRA', A.cuadran);
      A.desconocidos.forEach(d => filas.push(['DESCONOCIDO', d.cod, '(no está en el catálogo)', '', d.cant, '', '', '']));
      _descargarCSV('ARJ_conteo_' + _hoyArchivo() + '.csv', filas);
      notif('Reporte descargado', 'success');
    }

    function _recTextoSellado(A) {
      if (!A.embId) return '\n\nNo se va a tocar ningún costo (sin embarque seleccionado).';
      let t = `\n\nCOSTO: ${(A.sellar || []).length} producto(s) quedarán sellados con factor `
            + `${(parseFloat(A.emb.factor) || 0).toFixed(4)} (${A.emb.codigo}).`;
      if ((A.conflicto || []).length) {
        t += `\n${A.conflicto.length} NO se tocarán: ya vienen de otro embarque.`;
      }
      return t;
    }

    // ═══════════════════════════════════════════════════════════════
    // v13.21 REGISTRO DE RECEPCION
    // Hasta ahora la recepcion solo hacia `stock = stock + cant` y borraba el
    // sumando. Quedaba la foto (cuanto hay) pero se perdia la pelicula (cuanto
    // entro). De una foto no se saca la pelicula, y este dato NO es recuperable
    // despues: si no se guarda al recibir, se perdio.
    //
    // Con el registro se puede calcular rotacion (llegaron 100, quedan 20 =>
    // vendiste 80), reclamarle al proveedor con un numero citable, y hacer que
    // "la mitad de lo que llego" siga dando bien cuando ya haya ventas.
    //
    // Se guarda DESPUES de mover el stock y solo con lo que de verdad se movio.
    // El contador se sube AL FINAL: al reves, un fallo quema el correlativo.
    async function _recGuardarRegistro(A, lista, ref) {
      if (!_sb || !_supabaseConectado) return null;
      const renglones = [];
      // Entradas / ajustes que SI se aplicaron.
      lista.forEach(r => {
        const antes = A.tipo === 'recepcion'
          ? (r.nuevo - (r.cant != null ? r.cant : 0))
          : (r.prod[A.campo] != null ? r.prod[A.campo] : null);
        renglones.push({
          prod: r.prod,
          cantidad: A.tipo === 'recepcion' ? (r.cant || 0) : (r.nuevo - (r.sistema || 0)),
          antes: A.tipo === 'recepcion' ? antes : (r.sistema != null ? r.sistema : antes),
          despues: r.nuevo,
          clase: A.tipo === 'recepcion' ? 'entrada' : ((r.nuevo - (r.sistema || 0)) < 0 ? 'falta' : 'sobra')
        });
      });
      // No contados: stock en sistema que nadie vio en el galpon. NO se tocan,
      // pero se dejan anotados: si el mismo codigo sale no-contado tres veces
      // seguidas, ahi hay algo.
      (A.noContados || []).forEach(r => renglones.push({
        prod: r.prod, cantidad: 0, antes: r.sistema, despues: r.sistema, clase: 'no_contado'
      }));
      if (!renglones.length) return null;

      try {
        const anio = new Date().getFullYear();
        const { data: cont, error: ce } = await _sb.from('contadores')
          .select('*').eq('tipo', 'recepcion').eq('anio', anio).single();
        if (ce || !cont) { console.error('[ARJ] contador recepcion:', ce && ce.message); return null; }
        const nuevoNum = (cont.ultimo_numero || 0) + 1;
        const numero = (cont.prefijo || 'REC') + '-' + anio + '-' + String(nuevoNum).padStart(5, '0');

        const unidades = renglones.reduce((a, r) => a + Math.abs(r.cantidad), 0);
        const totalCosto = Math.round(renglones.reduce((a, r) => a + costoLanded(r.prod) * Math.abs(r.cantidad), 0) * 100) / 100;
        const noCont = renglones.filter(r => r.clase === 'no_contado').length;

        const { data: ins, error: ie } = await _sb.from('recepciones').insert({
          numero, tipo: A.tipo, destino: A.destino,
          embarque_id: A.embId || null,
          embarque_codigo: A.emb ? A.emb.codigo : null,
          referencia: ref || null,
          usuario: estado.usuario || 'Sistema',
          productos_count: renglones.length - noCont,
          unidades_count: unidades,
          total_costo: totalCosto,
          no_contados_count: noCont
        }).select().single();
        if (ie || !ins) { console.error('[ARJ] insert recepcion:', ie && ie.message); return null; }

        // Foto del momento: si manana cambia el nombre o el costo, este
        // renglon no cambia. Igual criterio que las notas de entrega.
        const items = renglones.map(r => {
          const cu = Math.round(costoLanded(r.prod) * 10000) / 10000;
          return {
            recepcion_id: ins.id, producto_id: String(r.prod.id),
            cod_alt: r.prod.cod_alt, descripcion: r.prod.desc || '', marca: r.prod.marca || '',
            cantidad: r.cantidad, costo_unitario: cu,
            total_linea: Math.round(cu * Math.abs(r.cantidad) * 100) / 100,
            stock_antes: r.antes, stock_despues: r.despues, clase: r.clase
          };
        });
        const { error: iie } = await _sb.from('recepcion_items').insert(items);
        if (iie) { console.error('[ARJ] insert recepcion_items:', iie.message); return null; }

        // Recien ahora el numero queda consumido.
        await _sb.from('contadores').update({ ultimo_numero: nuevoNum }).eq('id', cont.id);
        return { numero, unidades, totalCosto, renglones: items.length, noCont };
      } catch (err) {
        console.error('[ARJ] registro de recepcion:', err);
        return null;
      }
    }

    async function recAplicar() {
      const A = _recAnalisis;
      if (!A) return;
      const campo = A.campo;
      let lista, verbo;

      if (A.tipo === 'recepcion') {
        lista = A.ok.map(r => ({ prod: r.prod, cod: r.cod, nuevo: r.nuevo }));
        verbo = 'sumados';
        if (!confirm(`Se van a SUMAR las cantidades a ${lista.length} producto(s) en ${A.nomDest}.`
          + _recTextoSellado(A) + `\n\n¿Aplicar?`)) return;
      } else {
        // Solo lo contado. Los NO CONTADOS jamas se ponen en cero automaticamente:
        // que no aparezcan en la lista puede ser que no llegaron, o que no se
        // conto esa estanteria. Ponerlos en cero borraria stock bueno.
        lista = A.faltan.concat(A.sobran).map(r => ({ prod: r.prod, cod: r.cod, nuevo: r.fisico }));
        verbo = 'ajustados';
        if (!confirm(`Se va a ajustar el stock de ${lista.length} producto(s) al conteo físico en ${A.nomDest}.\n\n`
          + `Los ${A.noContados.length} "no contados" NO se tocan: podrían no haberse contado todavía.`
          + _recTextoSellado(A) + `\n\n¿Aplicar?`)) return;
      }
      // Puede no haber ajustes de stock pero sí productos por sellar (todo cuadró).
      if (!lista.length && !(A.sellar || []).length) return;

      const btn = document.getElementById('rec-btn-aplicar');
      btn.disabled = true;
      document.getElementById('rec-btn-volver').style.display = 'none';
      document.getElementById('rec-btn-exportar').style.display = 'none';

      let hechos = 0; const fallos = [];
      // Uno por uno y no en lote: si falla el renglon 40, los 39 anteriores ya
      // quedaron guardados y el reporte final dice exactamente cual fallo.
      for (let i = 0; i < lista.length; i++) {
        const r = lista[i];
        btn.textContent = `Guardando ${i + 1} de ${lista.length}...`;
        const { error } = await _sb.from('productos').update({ [campo]: r.nuevo }).eq('id', r.prod.id);
        if (error) fallos.push({ cod: r.cod, msg: error.message });
        else { r.prod[campo] = r.nuevo; hechos++; }
      }

      // ── SELLADO DEL COSTO (v13.10) ──
      let sellados = 0; const fallosSello = [];
      if (A.embId && (A.sellar || []).length) {
        const f = parseFloat(A.emb.factor) || 0;
        for (let i = 0; i < A.sellar.length; i++) {
          const p = A.sellar[i];
          btn.textContent = `Sellando costo ${i + 1} de ${A.sellar.length}...`;
          const { error } = await _sb.from('productos')
            .update({ embarque_id: A.embId, factor_landed: f, proveedor: A.emb.proveedor, origen: 'importado' })
            .eq('id', p.id);
          if (error) fallosSello.push({ cod: p.cod_alt, msg: error.message });
          else {
            p.embarque_id = A.embId; p.factor_landed = f;
            p.proveedor = A.emb.proveedor; p.origen = 'importado';
            sellados++;
          }
        }
      }

      // v13.21 El registro va DESPUES del stock y solo con lo que se aplico.
      btn.textContent = 'Guardando registro...';
      const _regRec = await _recGuardarRegistro(A, lista, (document.getElementById('rec-ref').value || '').trim());

      btn.disabled = false; btn.style.display = 'none';
      document.getElementById('rec-paso2').style.display = 'none';
      document.getElementById('rec-paso3').style.display = '';
      document.getElementById('rec-btn-cancelar').style.display = '';
      document.getElementById('rec-btn-cancelar').textContent = 'Cerrar';

      const ref = (document.getElementById('rec-ref').value || '').trim();
      document.getElementById('rec-paso3').innerHTML = `
    <div style="text-align:center;padding:22px 10px">
      <i class="ti ti-${fallos.length ? 'alert-triangle' : 'circle-check'}" style="font-size:44px;color:${fallos.length ? 'var(--gold)' : 'var(--green)'}"></i>
      <div style="font-size:17px;font-weight:600;color:var(--navy);margin-top:10px">${hechos} producto(s) ${verbo}</div>
      <div style="font-size:12.5px;color:var(--dgray);margin-top:4px">${A.nomDest}${ref ? ' · ' + ref : ''}</div>
      ${sellados ? `<div style="background:#E8F5E9;border:1px solid #A5D6A7;border-radius:8px;padding:10px;margin-top:12px;font-size:12px;color:#1B5E20">
        <strong>${sellados} producto(s) sellados</strong> con factor ${(parseFloat(A.emb.factor)||0).toFixed(4)} · ${A.emb.codigo}</div>` : ''}
      ${_regRec ? `<div style="background:#E8F0F8;border:1px solid #A9C7E8;border-radius:8px;padding:10px;margin-top:10px;font-size:12px;color:#0D3B66">
        <strong>Registro ${_regRec.numero}</strong> · ${_regRec.renglones} renglón(es) · ${_regRec.unidades} unidad(es)${_regRec.noCont ? ' · ' + _regRec.noCont + ' no contado(s)' : ''}<br>
        <span style="font-size:11px">Queda guardado cuánto entró, no solo el stock resultante.</span></div>`
        : `<div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;padding:10px;margin-top:10px;font-size:12px;color:#5D4037">
        <strong>⚠ El stock sí se aplicó, pero el registro no se guardó.</strong><br>
        <span style="font-size:11px">No va a quedar historial de esta entrada. Revísalo antes de seguir.</span></div>`}
      ${(A.conflicto || []).length ? `<div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;padding:10px;margin-top:10px;text-align:left;font-size:12px;color:#5D4037">
        <strong>${A.conflicto.length} NO se sellaron</strong> — ya venían de otro embarque y no se tocaron:<br>
        ${A.conflicto.map(c => '· ' + c.cod + ' → ' + c.otro).join('<br>')}</div>` : ''}
      ${fallosSello.length ? `<div style="background:#FEF5F5;border:1px solid #F5C0C0;border-radius:8px;padding:10px;margin-top:10px;text-align:left;font-size:12px;color:#B71C1C">
        <strong>${fallosSello.length} fallaron al sellar:</strong><br>${fallosSello.map(f => '· ' + f.cod + ' — ' + f.msg).join('<br>')}</div>` : ''}
      ${fallos.length ? `<div style="background:#FEF5F5;border:1px solid #F5C0C0;border-radius:8px;padding:12px;margin-top:14px;text-align:left;font-size:12px;color:#B71C1C">
        <strong>${fallos.length} fallaron y NO se guardaron:</strong><br>${fallos.map(f => '· ' + f.cod + ' — ' + f.msg).join('<br>')}</div>` : ''}
    </div>`;

      const detalle = `${A.tipo === 'conteo' ? 'Conteo físico' : 'Recepción'}${ref ? ' "' + ref + '"' : ''}: ${hechos} productos ${verbo} en ${A.nomDest}${fallos.length ? ' (' + fallos.length + ' fallaron)' : ''}`
        + (sellados ? ` · ${sellados} sellados con ${A.emb.codigo} factor ${(parseFloat(A.emb.factor)||0).toFixed(4)}` : '')
        + ((A.conflicto || []).length ? ` · ${A.conflicto.length} no sellados por conflicto de embarque` : '');
      logBitacora('inventario', detalle, true);
      _sbLogBitacora(estado.usuario, estado.empresa, 'inventario', detalle, true);
      renderInventario();
      notif(`${hechos} producto(s) ${verbo}`, fallos.length ? 'warning' : 'success');
    }


    // ═══════════════════════════════════════════════════════════════
    // v13.21 HISTORIAL DE RECEPCIONES
    // Aqui se lee lo que antes se perdia: cuanto entro de cada producto.
    // El detalle calcula rotacion comparando lo que llego contra el stock
    // de HOY (leido del catalogo vivo, no de la foto guardada).
    // ═══════════════════════════════════════════════════════════════
    let _RECS = [];

    async function abrirRecepciones() {
      document.getElementById('recs-buscar').value = '';
      document.getElementById('recs-detalle').style.display = 'none';
      document.getElementById('recs-lista').innerHTML =
        '<div style="padding:26px;text-align:center;color:var(--dgray);font-size:12px"><i class="ti ti-loader-2" style="font-size:24px;display:block;margin-bottom:6px"></i>Cargando…</div>';
      document.getElementById('modal-recepciones').classList.add('show');
      if (!_sb || !_supabaseConectado) {
        document.getElementById('recs-lista').innerHTML =
          '<div style="padding:26px;text-align:center;color:var(--dgray);font-size:12px">Sin conexión a Supabase. El historial vive en la base de datos.</div>';
        return;
      }
      try {
        const { data, error } = await _sb.from('recepciones').select('*').order('fecha', { ascending: false }).limit(200);
        if (error) throw error;
        _RECS = data || [];
        renderRecepciones();
      } catch (err) {
        console.error('[ARJ] cargar recepciones:', err);
        document.getElementById('recs-lista').innerHTML =
          '<div style="padding:22px;text-align:center;color:var(--red);font-size:12px">No se pudo cargar el historial: ' + (err.message || err) + '</div>';
      }
    }

    function cerrarRecepciones() { document.getElementById('modal-recepciones').classList.remove('show'); }

    function renderRecepciones() {
      const cont = document.getElementById('recs-lista');
      if (!cont) return;
      const q = (document.getElementById('recs-buscar').value || '').trim().toLowerCase();
      let lista = _RECS;
      if (q) lista = lista.filter(r => (String(r.numero) + ' ' + String(r.embarque_codigo || '') + ' ' + String(r.referencia || '')).toLowerCase().includes(q));
      if (!lista.length) {
        cont.innerHTML = '<div style="padding:26px;text-align:center;color:var(--dgray);font-size:12px">'
          + '<i class="ti ti-package-off" style="font-size:26px;display:block;margin-bottom:6px"></i>'
          + (q ? 'Ninguna recepción coincide con la búsqueda.'
               : 'Todavía no hay recepciones registradas.<br><span style="font-size:11px">Las entradas anteriores a esta versión no quedaron guardadas: el sistema solo sumaba al stock.</span>') + '</div>';
        return;
      }
      let t = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--gray)">'
        + '<th style="text-align:left;padding:8px 10px">Número</th>'
        + '<th style="text-align:left;padding:8px 10px">Fecha</th>'
        + '<th style="text-align:left;padding:8px 10px">Tipo</th>'
        + '<th style="text-align:left;padding:8px 10px">Embarque</th>'
        + '<th style="text-align:right;padding:8px 8px">Rengl.</th>'
        + '<th style="text-align:right;padding:8px 8px">Unid.</th>'
        + '<th style="text-align:right;padding:8px 10px">Costo</th>'
        + '<th style="padding:8px 10px"></th></tr></thead><tbody>';
      lista.forEach(r => {
        const f = new Date(r.fecha);
        const fTxt = f.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
          + ' ' + f.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
        const esRec = r.tipo === 'recepcion';
        t += `<tr style="border-top:1px solid var(--border);${r.anulado ? 'opacity:.5' : ''}">
        <td style="padding:7px 10px"><strong>${r.numero}</strong>${r.anulado ? ' <span style="color:var(--red);font-size:10px">ANULADA</span>' : ''}
          ${r.referencia ? `<div style="font-size:10.5px;color:var(--dgray)">${r.referencia}</div>` : ''}</td>
        <td style="padding:7px 10px;color:var(--dgray)">${fTxt}</td>
        <td style="padding:7px 10px"><span style="background:${esRec ? 'var(--lgreen)' : '#FFF8E1'};color:${esRec ? 'var(--green)' : '#8D6E63'};padding:1px 7px;border-radius:8px;font-size:10px;font-weight:600">${esRec ? 'ENTRADA' : 'CONTEO'}</span>
          ${r.no_contados_count ? `<div style="font-size:10px;color:var(--gold)">${r.no_contados_count} no contado(s)</div>` : ''}</td>
        <td style="padding:7px 10px">${r.embarque_codigo || '\u2014'}</td>
        <td style="padding:7px 8px;text-align:right">${r.productos_count || 0}</td>
        <td style="padding:7px 8px;text-align:right">${(r.unidades_count || 0).toLocaleString('es-VE')}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:600">${fmtUSD(r.total_costo || 0)}</td>
        <td style="padding:7px 10px;text-align:right"><button class="btn btn-secondary btn-sm" onclick="verRecepcion('${r.id}')"><i class="ti ti-eye"></i></button></td></tr>`;
      });
      cont.innerHTML = t + '</tbody></table>'
        + `<div style="margin-top:9px;font-size:11px;color:var(--dgray);text-align:right">${lista.length} registro(s)</div>`;
    }

    async function verRecepcion(id) {
      const r = _RECS.find(x => String(x.id) === String(id));
      if (!r) { notif('No se encontr\u00f3 el registro', 'error'); return; }
      const box = document.getElementById('recs-detalle');
      box.style.display = '';
      box.innerHTML = '<div style="padding:16px;text-align:center;color:var(--dgray);font-size:12px">Cargando rengl\u00f3nes…</div>';
      try {
        const { data, error } = await _sb.from('recepcion_items').select('*').eq('recepcion_id', r.id);
        if (error) throw error;
        if (!data || !data.length) { box.innerHTML = '<div style="padding:16px;color:var(--red);font-size:12px">El registro no tiene rengl\u00f3nes guardados.</div>'; return; }
        const esRec = r.tipo === 'recepcion';
        const soloGerente = estado.rol === 'gerente';
        let t = `<div style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:8px">${r.numero} · ${data.length} rengl\u00f3n(es)</div>`
          + '<table style="width:100%;border-collapse:collapse;font-size:11.5px"><thead><tr style="background:var(--gray)">'
          + '<th style="text-align:left;padding:6px 8px">C\u00f3digo</th>'
          + '<th style="text-align:left;padding:6px 8px">Descripci\u00f3n</th>'
          + `<th style="text-align:right;padding:6px 8px">${esRec ? 'Lleg\u00f3' : 'Dif.'}</th>`
          + '<th style="text-align:right;padding:6px 8px">Antes</th>'
          + '<th style="text-align:right;padding:6px 8px">Desp.</th>'
          + (esRec ? '<th style="text-align:right;padding:6px 8px">Hoy</th><th style="text-align:right;padding:6px 8px">Vendido</th><th style="text-align:right;padding:6px 8px">Rotaci\u00f3n</th>' : '')
          + (soloGerente ? '<th style="text-align:right;padding:6px 8px">Costo</th>' : '')
          + '</tr></thead><tbody>';
        data.forEach(it => {
          // Rotacion: se compara contra el stock de HOY del catalogo vivo, no
          // contra la foto. La foto dice como quedo ese dia; lo que interesa es
          // cuanto de aquello sigue en el galpon.
          const p = (typeof PRODUCTOS !== 'undefined') ? PRODUCTOS.find(x => x.cod_alt === it.cod_alt) : null;
          const hoy = p ? ((p.stock_dist || 0) + (p.stock_vd || 0)) : null;
          const lleg = it.cantidad || 0;
          const vend = (hoy != null && lleg > 0) ? Math.max(0, (it.stock_despues || 0) - hoy) : null;
          const rot = (vend != null && lleg > 0) ? (vend / lleg * 100) : null;
          const colorRot = rot == null ? 'var(--dgray)' : (rot >= 60 ? 'var(--green)' : rot >= 25 ? 'var(--gold)' : 'var(--red)');
          const clsTxt = { entrada: '', falta: ' <span style="color:var(--red);font-size:9px">FALTA</span>', sobra: ' <span style="color:var(--blue);font-size:9px">SOBRA</span>', no_contado: ' <span style="color:var(--gold);font-size:9px">NO CONTADO</span>' }[it.clase] || '';
          t += `<tr style="border-top:1px solid var(--border)">
          <td style="padding:5px 8px"><strong>${it.cod_alt || '\u2014'}</strong>${clsTxt}</td>
          <td style="padding:5px 8px">${(it.descripcion || '').slice(0, 40)}<div style="font-size:9.5px;color:var(--dgray)">${it.marca || ''}</div></td>
          <td style="padding:5px 8px;text-align:right;font-weight:600">${lleg > 0 ? '+' : ''}${lleg}</td>
          <td style="padding:5px 8px;text-align:right;color:var(--dgray)">${it.stock_antes != null ? it.stock_antes : '\u2014'}</td>
          <td style="padding:5px 8px;text-align:right;color:var(--dgray)">${it.stock_despues != null ? it.stock_despues : '\u2014'}</td>
          ${esRec ? `<td style="padding:5px 8px;text-align:right">${hoy != null ? hoy : '\u2014'}</td>
          <td style="padding:5px 8px;text-align:right">${vend != null ? vend : '\u2014'}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:600;color:${colorRot}">${rot != null ? rot.toFixed(0) + '%' : '\u2014'}</td>` : ''}
          ${soloGerente ? `<td style="padding:5px 8px;text-align:right">${fmtUSD(it.total_linea || 0)}</td>` : ''}</tr>`;
        });
        box.innerHTML = t + '</tbody></table>'
          + (esRec ? '<div style="margin-top:8px;font-size:10.5px;color:var(--dgray)">La rotaci\u00f3n compara lo que lleg\u00f3 contra el stock de hoy. Verde ≥ 60% · \u00e1mbar ≥ 25% · rojo por debajo. Un producto rojo despu\u00e9s de meses es plata dormida.</div>' : '')
          + '<div style="margin-top:8px;text-align:right"><button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'recs-detalle\').style.display=\'none\'">Cerrar detalle</button></div>';
      } catch (err) {
        console.error('[ARJ] detalle recepcion:', err);
        box.innerHTML = '<div style="padding:16px;color:var(--red);font-size:12px">No se pudo cargar el detalle: ' + (err.message || err) + '</div>';
      }
    }

    // Se recargan los renglones desde la base en vez de confiar en memoria:
    // una nota vieja puede haberla emitido otra persona en otra sesion.
    async function reimprimirNota(id) {
      const n = _NOTAS.find(x => String(x.id) === String(id));
      if (!n) { notif('No se encontró la nota', 'error'); return; }
      try {
        const { data, error } = await _sb.from('traspaso_items').select('*').eq('traspaso_id', n.id);
        if (error) throw error;
        if (!data || !data.length) { notif('La nota no tiene renglónes guardados', 'error'); return; }
        _trasUltimaNota = {
          numero: n.numero, fecha: new Date(n.fecha), embarque: n.embarque_codigo || '',
          ref: n.referencia || '', items: data,
          totalCosto: parseFloat(n.total_costo) || 0, unidades: n.unidades_count || 0
        };
        cerrarNotas();
        imprimirNotaEntrega();
      } catch (err) {
        console.error('[ARJ] reimprimir nota:', err);
        notif('No se pudo cargar la nota: ' + (err.message || err), 'error');
      }
    }
