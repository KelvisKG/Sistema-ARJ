// === Precios, Margenes y Divisas Engine ===
    // ═══════════════════════════════════════════════════════════════
    // FORMATEO
    // ═══════════════════════════════════════════════════════════════
    // ═══ COLCHÓN CAMBIARIO PROPORCIONAL A LA BRECHA (v13) ═══
    // Regla de negocio: el colchón sobre la tasa paralela es el 10% de la
    // brecha paralelo/BCV, con piso de 2% y techo de 8%.
    //   brecha 20% → colchón 2% (piso) · brecha 44% → 4,4% · brecha 90% → 8% (techo)
    // Devuelve el factor que convierte precio USD-paralelo a USD-BCV:
    //   precioBCV = precioUSD × colchonFactor();  Bs = precioBCV × tasa_bcv
    function colchonFactorCon(tpar, tbcv) {
      if (!(tbcv > 0) || !(tpar > 0)) return 1;
      const base = tpar / tbcv;
      const brecha = base - 1;
      let colchon = 0.10 * brecha;
      if (colchon < 0.02) colchon = 0.02;
      if (colchon > 0.08) colchon = 0.08;
      return base * (1 + colchon);
    }
    function colchonFactor() {
      // v13.12 MODO RESGUARDO. Antes devolvia (paralelo/BCV) x (1+colchon), que
      // convertia un precio en $ PARALELO a $ BCV. Pero los precios de ARJ se
      // ponen a mano YA en $ BCV: el 25% de compra de divisas vive dentro del
      // costo, y el precio sale de multiplicar ese costo. Aplicar ademas la
      // brecha era cobrarla DOS VECES — un precio de $30 se cobraba como $36,27.
      // v13.13 RESGUARDO DESACTIVADO POR DECISION DE JJ. El precio en Bs ahora
      // es exactamente el precio de lista a tasa BCV: un solo precio anunciado,
      // sin recargo por moneda. Motivo doble: friccion comercial (no se puede
      // decir que vale $55 y cobrar otra cosa en Bs) y exposicion con SUNDDE,
      // que exige cobrar a la tasa oficial del dia. El costo asumido son ~2
      // puntos de utilidad por venta en bolivares.
      // Para reactivarlo: subir RESGUARDO_BS de nuevo a 1.02. Nada mas.
      return RESGUARDO_BS;
    }

    // v13.16 Piso de margen. Debajo de esto el sistema avisa (no bloquea: el
    // gerente manda). Se toca AQUI, en un solo lugar.
    const MARGEN_MINIMO = 30;
    // v13.17 Un producto sin FOB no tiene costo, y sin costo el margen se
    // calcula sobre cero: da 100% falso. Peor: si ademas no tiene
    // precio_manual, precioPublico(0) devuelve 0 y la factura sale en $0,00.
    // No se bloquea al agregar (el gerente arma la factura tranquilo) pero
    // SI se bloquea al emitir.
    const sinFob = it => !isFinite(parseFloat(it && it.fob)) || parseFloat(it.fob) <= 0;

    // v13.20 Sin tasas cargadas no se emite nada. No se bloquea el trabajo:
    // se manda a Configuracion a escribirlas a mano. El sistema pide el dato
    // que le falta en vez de inventarlo o de cerrar la puerta.
    function tasasListas(accion) {
      if (tasaOk(estado.tasa_par) && tasaOk(estado.tasa_bcv)) return true;
      const faltan = [];
      if (!tasaOk(estado.tasa_par)) faltan.push('paralelo');
      if (!tasaOk(estado.tasa_bcv)) faltan.push('BCV');
      alert('No se puede ' + (accion || 'continuar') + ': falta la tasa ' + faltan.join(' y la ') + '.\n\n'
        + 'No se pudieron cargar de la base de datos. Ve a Configuraci\u00f3n \u2192 Tasas de cambio '
        + 'y escribe las del d\u00eda a mano.\n\n'
        + 'Todo lo que cobres en bol\u00edvares depende de esas tasas.');
      notif('Falta cargar la tasa ' + faltan.join(' y la ') + ' en Configuraci\u00f3n', 'error');
      navTo('config');
      return false;
    }

    // El resguardo sobre las ventas en bolivares. Se toca AQUI, en un solo lugar.
    // 1.00 = sin recargo. El precio en Bs = precio de lista x tasa BCV.
    const RESGUARDO_BS = 1.00;

    // ═══════════════════════════════════════════════════════════════
    // PAGO EN DIVISAS (v13.12)
    // Los precios de ARJ estan en $ BCV. Un dolar billete vale mas que un
    // dolar BCV, asi que para saldar la misma factura hace falta MENOS
    // efectivo verde. Eso NO es un descuento: es la misma plata en otra
    // moneda. Descuento de verdad es solo lo que se da POR ENCIMA de la
    // brecha, y eso se registra aparte en descuento_manual.
    // ═══════════════════════════════════════════════════════════════
    function brechaHoy() {
      const tp = parseFloat(estado.tasa_par), tb = parseFloat(estado.tasa_bcv);
      if (!isFinite(tp) || tp <= 0 || !isFinite(tb) || tb <= 0) return 1;
      const b = tp / tb;
      return b > 0 ? b : 1;
    }

    // % que equivale exactamente a la brecha: convertir sin regalar ni cobrar de mas.
    function dtoDivisaNeutro() {
      const b = brechaHoy();
      return b > 0 ? (1 - 1 / b) * 100 : 0;
    }

    // El % vigente: el que puso el gerente, o el neutro si no ha tocado nada.
    function dtoDivisaPct() {
      const d = parseFloat(estado.dto_divisa);
      return (isFinite(d) && d >= 0) ? d : dtoDivisaNeutro();
    }

    // v13.22 Conversion entre las dos monedas del sistema.
    // $BCV es la moneda de los PRECIOS (modelo cerrado). $verde es efectivo
    // fisico. Se convierten con el mismo % que salda una factura, para que
    // escribir "20 verde" y que el cliente pague 20 billetes sea exacto.
    function bcvAVerde(p) {
      return Math.round((parseFloat(p) || 0) * (1 - dtoDivisaPct() / 100) * 100) / 100;
    }
    function verdeABcv(v) {
      const f = 1 - dtoDivisaPct() / 100;
      return f > 0 ? Math.round((parseFloat(v) || 0) / f * 100) / 100 : 0;
    }

    // El toggle NO cambia el precio, solo la moneda en que se escribe.
    // El precio guardado sigue siendo $BCV: el catalogo nunca se toca.
    function toggleModoVerde(i) {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede modificar precios', 'error'); return; }
      estado.items[i]._modoVerde = !estado.items[i]._modoVerde;
      renderItems();
    }

    function cambiarPrecioVerde(i, v) {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede modificar precios', 'error'); renderItems(); return; }
      const ant = estado.items[i].precio;
      estado.items[i].precio = verdeABcv(v);
      // v13.23 Se marca como fijo. Sin esto, cambiar de cliente o de tier
      // dispara actualizarPreciosPorTier() y el precio vuelve al de lista:
      // el renglon seguiria en modo verde pero mostrando otro numero.
      estado.items[i].precio_fijo = true;
      estado.items[i].precio_base = estado.items[i].precio;
      logBitacora('precio', `Precio de '${estado.items[i].desc}' fijado en ${fmtUSD(parseFloat(v) || 0)} efectivo (${fmtUSD(ant)} \u2192 ${fmtUSD(estado.items[i].precio)} BCV)`, true);
      renderItems(); recalcular();
    }

    // Cuanto efectivo en divisas salda una factura de `totalBcv`.
    function totalEnDivisas(totalBcv) {
      return Math.round(totalBcv * (1 - dtoDivisaPct() / 100) * 100) / 100;
    }

    // Puntos REGALADOS: lo que se da por encima de la conversion neutra.
    // Cero cuando el gerente deja el valor por defecto.
    function dtoDivisaExcedentePct() {
      const ex = dtoDivisaPct() - dtoDivisaNeutro();
      return ex > 0.001 ? ex : 0;
    }

    // ── Modal del descuento en divisas ──
    function abrirDtoDivisa() {
      if (estado.rol !== 'gerente') { notif('Solo el gerente puede ajustar el descuento por divisas', 'error'); return; }
      document.getElementById('dd-neutro').textContent = dtoDivisaNeutro().toFixed(2) + '%';
      document.getElementById('dd-pct').value = dtoDivisaPct().toFixed(1);
      _ddPreview();
      document.getElementById('modal-dto-divisa').classList.add('show');
    }
    function cerrarDtoDivisa() { document.getElementById('modal-dto-divisa').classList.remove('show'); }
    function _ddNeutro() {
      document.getElementById('dd-pct').value = dtoDivisaNeutro().toFixed(1);
      _ddPreview();
    }
    function _ddPreview() {
      const el = document.getElementById('dd-preview');
      if (!el) return;
      const v = parseFloat(document.getElementById('dd-pct').value);
      const total = estado.items.reduce((a, i) => a + i.cant * i.precio, 0);
      if (!isFinite(v) || v < 0) { el.innerHTML = '<span style="color:var(--red)">Escribe un porcentaje válido.</span>'; return; }
      const neutro = dtoDivisaNeutro();
      const ex = v - neutro;
      const cobra = Math.round(total * (1 - v / 100) * 100) / 100;
      let h = 'Factura de <strong>' + fmtUSD(total) + '</strong> BCV &rarr; cobras <strong>' + fmtUSD(cobra) + '</strong> en efectivo.';
      if (ex > 0.001) {
        h += '<br><span style="color:var(--red)"><strong>Regalas ' + ex.toFixed(1) + ' puntos = '
          + fmtUSD(Math.round(total * (ex / 100) * 100) / 100) + '.</strong> Se registra como descuento.</span>';
      } else if (ex < -0.001) {
        h += '<br><span style="color:var(--gold)">Estás ' + Math.abs(ex).toFixed(1)
          + ' puntos <strong>por debajo</strong> de la brecha: el cliente paga de más por usar efectivo.</span>';
      } else {
        h += '<br><span style="color:var(--green)">Conversión exacta. No regalas margen.</span>';
      }
      el.innerHTML = h;
    }
    function guardarDtoDivisa() {
      const v = parseFloat(document.getElementById('dd-pct').value);
      if (!isFinite(v) || v < 0 || v > 60) { notif('El descuento debe estar entre 0 y 60%.', 'error'); return; }
      estado.dto_divisa = v;
      const ex = v - dtoDivisaNeutro();
      _sbLogBitacora('precio', 'Descuento por divisas ajustado a ' + v.toFixed(1) + '%'
        + (ex > 0.001 ? ' (' + ex.toFixed(1) + ' pts por encima de la brecha)' : ' (conversión a la brecha)'), ex > 0.001);
      cerrarDtoDivisa();
      recalcular();
      notif('Descuento por divisas: ' + v.toFixed(1) + '%', 'success');
    }

    // ═══════════════════════════════════════════════════════════════
    // FACTOR DE UNA FACTURA YA EMITIDA (v13.12)
    // Una deuda no cambia de monto porque cambio una regla despues de
    // emitida. El factor se CONGELA al emitir y se lee de ahi; lo que si
    // se mueve al cobrar es la tasa BCV del dia (anti-descapitalizacion).
    // Facturas viejas sin factor_bs conservan el calculo con el que
    // nacieron: se reconstruye con SUS tasas, no con las de hoy.
    // ═══════════════════════════════════════════════════════════════
    // v13.13 Fecha en que el sistema paso al modelo de precios en $BCV. Antes de
    // esto los precios eran en $ paralelo y el factor convertia par->BCV. Despues,
    // el precio YA esta en BCV y el factor es solo resguardo.
    const CORTE_MODELO_BCV = new Date('2026-08-01T00:00:00Z').getTime();

    function factorBsDe(f) {
      if (!f) return colchonFactor();
      const fb = parseFloat(f.factor_bs);
      if (isFinite(fb) && fb > 0) return fb;
      // v13.13 SIN factor_bs: la formula vieja (paralelo/BCV x colchon) solo vale
      // para facturas nacidas ANTES del cambio de modelo. Aplicarla a una factura
      // moderna le cobraria ~21% de mas al cliente. Si no se puede determinar la
      // fecha, se asume moderna: errar hacia NO cobrar de mas.
      const tEmision = f.fecha_raw ? new Date(f.fecha_raw).getTime() : NaN;
      if (isFinite(tEmision) && tEmision < CORTE_MODELO_BCV) {
        const tp = parseFloat(f.tasa_par), tb = parseFloat(f.tasa_bcv);
        if (isFinite(tp) && tp > 0 && isFinite(tb) && tb > 0) return colchonFactorCon(tp, tb);
      }
      return colchonFactor();
    }

    function precioPublico(fob) {
      let m; if (fob < 2) m = 5; else if (fob < 5) m = 4; else if (fob < 10) m = 3; else m = 2.5;
      return redondeoBonito(fob * m);
    }
    // ═══════════════════════════════════════════════════════════════
    // COSTO LANDED — el costo REAL puesto en Acarigua
    // Antes estaba quemado en ×1.471 en tres lugares. Ahora cada producto
    // trae su propio factor: importado ≈1.471 (flete+aduana), local =1.000.
    // El fallback cubre filas guardadas antes de que existiera la columna.
    // ═══════════════════════════════════════════════════════════════
    const FACTOR_LANDED_FALLBACK = 1.471;
    function factorLandedDe(p) {
      if (!p) return FACTOR_LANDED_FALLBACK;
      let f = parseFloat(p.factor_landed);
      if (!isFinite(f) || f <= 0) {
        // Un ítem de factura puede no traer el factor (ej. convertido de presupuesto viejo).
        // Se busca en el catálogo por código antes de caer al fallback.
        const cat = (typeof PRODUCTOS !== 'undefined' && p.cod_alt)
          ? PRODUCTOS.find(x => x.cod_alt === p.cod_alt) : null;
        f = cat ? parseFloat(cat.factor_landed) : NaN;
      }
      return (isFinite(f) && f > 0) ? f : FACTOR_LANDED_FALLBACK;
    }
    function costoLanded(p) {
      return (parseFloat(p && p.fob) || 0) * factorLandedDe(p);
    }
    // ═══════════════════════════════════════════════════════════════
    // ORIGEN DE UN RENGLON (v13.28) — importado / local.
    // Jerarquia, igual que factorLandedDe():
    //   1. el que trae el renglon
    //   2. el del catalogo vivo, por cod_alt (cotizacion de producto viejo)
    //   3. inferido del factor congelado: factor 1 = compra local
    // Se congela en factura_items al emitir. NO se lee de `productos` al
    // reportar: sellar un embarque hace `origen: 'importado'` y eso
    // reclasificaria ventas ya hechas.
    // ═══════════════════════════════════════════════════════════════
    function origenDe(it) {
      if (!it) return 'importado';
      const o = (it.origen || '').toString().trim().toLowerCase();
      if (o === 'local' || o === 'importado') return o;
      const cat = (typeof PRODUCTOS !== 'undefined' && it.cod_alt)
        ? PRODUCTOS.find(x => x.cod_alt === it.cod_alt) : null;
      const oc = cat ? (cat.origen || '').toString().trim().toLowerCase() : '';
      if (oc === 'local' || oc === 'importado') return oc;
      const f = parseFloat(it.factor_landed);
      return (isFinite(f) && f > 0 && f <= 1.001) ? 'local' : 'importado';
    }
    // ═══════════════════════════════════════════════════════════════
    // COSTO SIN EL RECARGO DE DIVISAS (v13.10) — VISTA DE GESTIÓN.
    // NO es un costo contable ni fiscal: el que va a los libros es el
    // completo. Esto sirve para responder "¿estoy comprando bien afuera?"
    // separado de "¿cuánto me cuesta el régimen cambiario?".
    // Solo se puede descomponer si el producto tiene embarque: de ahí
    // sale el % de divisas con el que se selló.
    // ═══════════════════════════════════════════════════════════════
    function factorSinDivisas(p) {
      if (!p || !p.embarque_id) return null;
      const e = (typeof EMBARQUES !== 'undefined') ? EMBARQUES.find(x => x.id === p.embarque_id) : null;
      if (!e) return null;
      const pd = parseFloat(e.pct_divisas);
      if (!isFinite(pd) || pd <= 0) return factorLandedDe(p);
      return factorLandedDe(p) / (1 + pd / 100);
    }
    function costoSinDivisas(p) {
      const f = factorSinDivisas(p);
      return f == null ? null : (parseFloat(p && p.fob) || 0) * f;
    }
    function precioConTier(fob, t, producto) {
      // Si nos pasaron el producto y tiene precio_manual, usarlo
      const base = (producto && producto.precio_manual) ? producto.precio_manual : precioPublico(fob);
      return Math.round(base * PRECIOS_TIER[t] * 100) / 100;
    }
    // ═══════════════════════════════════════════════════════════════
    // PRECIO BASE de un renglón (v13.9) — la base sobre la que se
    // calcula el descuento manual. Jerarquía:
    //   1. precio cotizado congelado (precio_fijo)
    //   2. precio_manual del producto
    //   3. fórmula precioPublico(fob)
    // Antes el descuento se calculaba SIEMPRE sobre precioPublico(fob),
    // ignorando precio_manual (40 productos) y los precios cotizados.
    // ═══════════════════════════════════════════════════════════════
    function precioBaseItem(it) {
      if (it.precio_fijo) {
        const pb = parseFloat(it.precio_base);
        return (isFinite(pb) && pb > 0) ? pb : it.precio; // congelado al cotizar
      }
      if (it.precio_manual != null && it.precio_manual > 0) return it.precio_manual;
      return precioPublico(it.fob);
    }
    // ═══════════════════════════════════════════════════════════════
    // LISTA DE PRECIOS DESCARGABLE (CSV + PDF)
    // Regla de oro: precio_manual manda tal cual; si no, fórmula + redondeo bonito
    // ═══════════════════════════════════════════════════════════════
    function precioLista(p) {
      if (p.precio_manual != null && p.precio_manual > 0) return p.precio_manual; // manual: intocable
      const bruto = precioPublico(p.fob);
      return Math.ceil(bruto * 2) / 2; // redondeo bonito: hacia arriba al 0.50
    }
