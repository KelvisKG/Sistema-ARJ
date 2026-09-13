// === Supabase Service ===
    // Cargar TODOS los datos desde Supabase a los arrays locales
    async function cargarDatosSupabase() {
      if (!_sb) { console.warn('[ARJ] Supabase no disponible, usando datos locales'); return false; }
      try {
        // Productos
        const { data: prods, error: e1 } = await _sb.from('productos').select('*').eq('activo', true).order('cod_alt');
        if (e1) throw e1;
        // v13.2 BLINDAJE: el catalogo se vacia SIEMPRE, venga o no venga data.
        // Antes solo se vaciaba si venian filas, asi que una respuesta vacia
        // (RLS cambiada, filtro activo=true que deja todo afuera, migracion a
        // medias) dejaba vivos los productos demo del HTML y el sistema decia
        // "conectado" mientras mostraba catalogo falso.
        PRODUCTOS.length = 0;
        {
          if (!prods || prods.length === 0) throw new Error('Supabase devolvio 0 productos activos');
          prods.forEach(p => PRODUCTOS.push({
            id: p.id, cod_alt: p.cod_alt, cod_orig: p.cod_orig || '', cod_barras: p.cod_barras || '',
            desc: p.descripcion, marca: p.marca || '', fob: parseFloat(p.fob) || 0,
            stock_vd: p.stock_vd || 0, stock_dist: p.stock_dist || 0,
            marca_modelo: p.marca_modelo || '', sistema: p.sistema || '',
            precio_manual: p.precio_manual ? parseFloat(p.precio_manual) : null,
            imagen_url: p.imagen_url || '',
            origen: p.origen || 'importado',
            factor_landed: p.factor_landed != null ? parseFloat(p.factor_landed) : FACTOR_LANDED_FALLBACK,
            proveedor: p.proveedor || '',
            // v13.12 BUG DE v13.10: esta linea no existia. La columna se creo en
            // la tabla y el sellado la escribia bien, pero el catalogo en memoria
            // nunca la traia de vuelta: al refrescar, los 373 productos quedaban
            // con embarque_id undefined. Consecuencias que se veian como "normales":
            //   - Embarques decia "0 piezas selladas" en todos
            //   - Recalcular no encontraba productos que recalcular
            //   - costoSinDivisas() devolvia null siempre
            //   - y lo grave: la deteccion de conflicto al sellar (linea ~8217)
            //     evaluaba `if (p.embarque_id && ...)` sobre undefined, se iba al
            //     else y SOBRESCRIBIA productos de otro embarque sin avisar.
            embarque_id: p.embarque_id || null
          }));
        }

        // Clientes
        const { data: clis, error: e2 } = await _sb.from('clientes').select('*').eq('activo', true).order('nombre');
        if (e2) throw e2;
        // v13.2 BLINDAJE: mismo criterio que productos. Sin esto, una lista de
        // clientes vacia dejaba vivos los 7 clientes demo y se podia facturar a
        // un cliente que no existe en la base.
        CLIENTES.length = 0;
        {
          if (!clis || clis.length === 0) throw new Error('Supabase devolvio 0 clientes activos');
          // Cargar contactos de todos los clientes
          const { data: contactos } = await _sb.from('contactos_cliente').select('*');
          const contactosPorCliente = {};
          if (contactos) contactos.forEach(c => {
            if (!contactosPorCliente[c.cliente_id]) contactosPorCliente[c.cliente_id] = [];
            contactosPorCliente[c.cliente_id].push(c);
          });

          clis.forEach(c => {
            const cts = contactosPorCliente[c.id] || [];
            const principal = cts.find(x => x.es_principal) || cts[0] || null;
            const adicionales = cts.filter(x => !x.es_principal || (principal && x.id !== principal.id));
            CLIENTES.push({
              id: c.id, nombre: c.nombre, rif: c.rif || '', nivel: c.nivel || 'Publico',
              tipo: c.tipo_pago || 'contado', saldo_vd: parseFloat(c.saldo_vd) || 0,
              saldo_dist: parseFloat(c.saldo_dist) || 0, tel: c.telefono || '', empresa: c.empresa || 'ambas',
              origen: c.origen || '', origen_detalle: c.origen_detalle || '',
              direccion: c.direccion || '', notas: c.notas || '',
              contacto_principal: principal ? { nombre: principal.nombre, cargo: principal.cargo || '', tel: principal.telefono || '' } : { nombre: '—', cargo: '—', tel: '' },
              contactos_adicionales: adicionales.map(a => ({ nombre: a.nombre, cargo: a.cargo || '', tel: a.telefono || '' }))
            });
          });
        }

        // Facturas → TODAS_FACTURAS + FACTURAS_COBRAR (pendientes) + VENTAS_RECIENTES
        const { data: facts, error: e3 } = await _sb.from('facturas').select('*').order('fecha', { ascending: false }).limit(500);
        if (e3) throw e3;
        if (facts) {
          FACTURAS_COBRAR.length = 0;
          VENTAS_RECIENTES.length = 0;
          TODAS_FACTURAS.length = 0;
          facts.forEach(f => {
            const ahora = new Date();
            const fechaVence = f.fecha_vence ? new Date(f.fecha_vence) : null;
            const diasVence = fechaVence ? Math.ceil((fechaVence - ahora) / (1000 * 60 * 60 * 24)) : 0;
            // Actualizar estado si venció
            let est = f.estado;
            if (est === 'pendiente' && fechaVence && fechaVence < ahora) est = 'vencida';

            const obj = {
              id: f.id, num: f.numero, empresa: f.empresa, cliente: f.cliente_nombre,
              cliente_id: f.cliente_id, vendedor: f.vendedor,
              fecha: new Date(f.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
              fecha_raw: f.fecha,
              vence: fechaVence ? fechaVence.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
              total: parseFloat(f.subtotal_usd) || 0,
              abonado: parseFloat(f.subtotal_usd || 0) - parseFloat(f.saldo_pendiente || 0),
              saldo_pendiente: parseFloat(f.saldo_pendiente) || 0,
              estado: est, dias: diasVence,
              tipo_pago: f.tipo_pago, tasa_par: parseFloat(f.tasa_par),
              tasa_bcv: parseFloat(f.tasa_bcv),
              factor_bs: f.factor_bs != null ? parseFloat(f.factor_bs) : null,
              cliente_nombre_snap: f.cliente_nombre_snap || null,
              cliente_rif_snap: f.cliente_rif_snap || null,
              cliente_tel_snap: f.cliente_tel_snap || null,
              cliente_dir_snap: f.cliente_dir_snap || null,
              descuento_manual: parseFloat(f.descuento_manual) || 0,
              // v13.36: faltaba cargarlo. Es el objetivo de cobro en $verde
              // congelado al emitir; sin el, el historial no sabe cuanto
              // efectivo se acordo recibir y solo ve el equivalente $BCV.
              cobrar_verde: f.cobrar_verde != null ? parseFloat(f.cobrar_verde) : null,
              motivo_descuento: f.motivo_descuento || '',
              pidio_fiscal: f.pidio_fiscal
            };
            // TODAS las facturas → historial
            TODAS_FACTURAS.push(obj);
            // Facturas con saldo pendiente → cuentas por cobrar
            if (est !== 'pagada' && est !== 'anulada') {
              FACTURAS_COBRAR.push(obj);
            }
            // Recientes → dashboard (últimas 20)
            if (VENTAS_RECIENTES.length < 20) {
              const fechaCorta = new Date(f.fecha);
              VENTAS_RECIENTES.push({
                id: f.id, num: f.numero, cliente: f.cliente_nombre,
                fecha: fechaCorta.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) + ' ' + fechaCorta.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
                total: parseFloat(f.subtotal_usd) || 0, vendedor: f.vendedor, estado: est
              });
            }
          });
        }

        // Cotizaciones (presupuestos)
        const { data: cots, error: e4 } = await _sb.from('cotizaciones').select('*').order('fecha', { ascending: false }).limit(50);
        if (e4) throw e4;
        if (cots) {
          // Conteo REAL de ítems por cotización (antes estaba hardcodeado en 0)
          const _cotIds = cots.map(c => c.id).filter(Boolean);
          const _itemCount = {};
          if (_cotIds.length > 0) {
            const { data: _cits } = await _sb.from('cotizacion_items').select('cotizacion_id').in('cotizacion_id', _cotIds);
            (_cits || []).forEach(ci => { _itemCount[ci.cotizacion_id] = (_itemCount[ci.cotizacion_id] || 0) + 1; });
          }
          COTIZACIONES.length = 0;
          cots.forEach(c => {
            const vence = new Date(c.fecha_vence);
            const ahora = new Date();
            const diasRest = Math.ceil((vence - ahora) / (1000 * 60 * 60 * 24));
            let est = c.estado;
            if (est === 'activa' && diasRest <= 5) est = 'por_vencer';
            if (est === 'activa' && diasRest < 0) est = 'vencida';
            COTIZACIONES.push({
              id: c.id, num: c.numero, empresa: c.empresa, cliente: c.cliente_nombre,
              fecha: new Date(c.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
              vence: vence.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
              total: parseFloat(c.subtotal_usd) || 0, estado: est, dias_restantes: diasRest,
              items: _itemCount[c.id] || 0, vendedor: c.vendedor
            });
          });
        }

        // Configuración (tasas)
        const { data: cfg, error: e5 } = await _sb.from('configuracion').select('*').single();
        if (!e5 && cfg) {
          estado.tasa_par = parseFloat(cfg.tasa_par) || estado.tasa_par;
          estado.tasa_bcv = parseFloat(cfg.tasa_bcv) || estado.tasa_bcv;
          estado.tasas_actualizadas = cfg.tasas_actualizadas || null; // v13.12
          estado.factor_default = parseFloat(cfg.factor_landed_default) || FACTOR_LANDED_FALLBACK;
          const _inpF = document.getElementById('cfg-factor');
          if (_inpF) _inpF.value = estado.factor_default;
          estado.costos_fijos_mes = parseFloat(cfg.costos_fijos_mes) || 0;
          estado.costos_fijos_hist = (cfg.costos_fijos_hist && typeof cfg.costos_fijos_hist === 'object')
            ? cfg.costos_fijos_hist : {};
          // v13.2: equipo de trabajo y metas por periodo
          EQUIPO.length = 0;
          if (Array.isArray(cfg.equipo)) cfg.equipo.forEach(t => EQUIPO.push(t));
          METAS_HIST = (cfg.metas_hist && typeof cfg.metas_hist === 'object') ? cfg.metas_hist : {};
          const _selM = document.getElementById('cfg-fijos-mes');
          if (_selM && !_selM.value) _selM.value = periodoDe(new Date());
          cambiarPeriodoFijos();
        }

        // Sistemas
        const { data: sists, error: e6 } = await _sb.from('sistemas').select('*').order('orden');
        if (!e6 && sists && sists.length > 0) {
          SISTEMAS.length = 0;
          sists.forEach(s => SISTEMAS.push(s.nombre));
        }

        // Embarques (v13.10)
        await cargarEmbarques();

        // Bitácora (últimas 50)
        const { data: logs, error: e7 } = await _sb.from('bitacora').select('*').order('fecha', { ascending: false }).limit(50);
        if (!e7 && logs) {
          BITACORA.length = 0;
          logs.forEach(l => BITACORA.push({
            fecha: new Date(l.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) + ' ' + new Date(l.fecha).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
            usuario: l.usuario, empresa: l.empresa, accion: l.accion, desc: l.descripcion, critico: l.critico
          }));
        }

        _supabaseConectado = true;
        // v13.12: el banner se evalua DESPUES de cargar la config, no antes:
        // si se evaluara al arrancar, estado.tasas_actualizadas todavia es null
        // y saltaria siempre, incluso recien confirmadas.
        try { revisarTasasDelDia(); } catch (e) { console.error('[ARJ] banner tasas:', e); }
        console.log('[ARJ] Datos cargados desde Supabase: ' + PRODUCTOS.length + ' productos, ' + CLIENTES.length + ' clientes, ' + FACTURAS_COBRAR.length + ' CxC, ' + VENTAS_RECIENTES.length + ' ventas recientes');
        return true;
      } catch (err) {
        console.error('[ARJ] Error cargando datos de Supabase:', err);
        _supabaseConectado = false;
        return false;
      }
    }

    // ═══ GUARDAR EN SUPABASE (helpers reutilizables) ═══

    // Guardar bitácora en Supabase (no bloquea, fire-and-forget)
    function _sbLogBitacora(usuario, empresa, accion, descripcion, critico) {
      if (!_sb || !_supabaseConectado) return;
      _sb.from('bitacora').insert({ usuario, empresa, accion, descripcion, critico }).then(({ error }) => {
        if (error) console.error('[ARJ] Error log bitacora:', error);
      });
    }

    // Incrementar contador y obtener siguiente número de factura
    async function _sbSiguienteNumero(tipo) {
      if (!_sb) return null;
      // tipo: 'factura_vd', 'factura_dist', 'presupuesto_vd', 'presupuesto_dist'
      const anio = new Date().getFullYear();
      // Leer + incrementar atómicamente
      const { data, error } = await _sb.rpc('incrementar_contador', { p_tipo: tipo, p_anio: anio });
      if (error) {
        // Si la función RPC no existe, hacemos update manual
        const { data: cont, error: e2 } = await _sb.from('contadores').select('*').eq('tipo', tipo).eq('anio', anio).single();
        if (e2 || !cont) return null;
        const nuevoNum = cont.ultimo_numero + 1;
        await _sb.from('contadores').update({ ultimo_numero: nuevoNum }).eq('id', cont.id);
        return { prefijo: cont.prefijo, numero: nuevoNum };
      }
      return data;
    }


    // ═══ GUARDAR PRODUCTO EN SUPABASE (v12) ═══
    async function _sbGuardarProducto(prod) {
      if (!_sb || !_supabaseConectado) return;
      const obj = {
        cod_alt: prod.cod_alt, cod_orig: prod.cod_orig || '', cod_barras: prod.cod_barras || '',
        descripcion: prod.desc, marca: prod.marca || '', fob: prod.fob,
        stock_vd: prod.stock_vd, stock_dist: prod.stock_dist,
        marca_modelo: prod.marca_modelo || '', sistema: prod.sistema || '',
        precio_manual: prod.precio_manual, activo: true, imagen_url: prod.imagen_url || null,
        origen: prod.origen || 'importado',
        factor_landed: prod.factor_landed || FACTOR_LANDED_FALLBACK,
        proveedor: (prod.proveedor || '').trim() || null
      };
      if (prod.id) {
        // Actualizar existente
        const { error } = await _sb.from('productos').update(obj).eq('id', prod.id);
        if (error) {
          console.error('[ARJ] Error actualizando producto:', error);
          notif('⚠ No se guardó en la base de datos: ' + error.message, 'error');
          return false;
        }
      } else {
        // Insertar nuevo
        const { data, error } = await _sb.from('productos').insert(obj).select().single();
        if (error) {
          console.error('[ARJ] Error insertando producto:', error);
          notif('⚠ No se guardó en la base de datos: ' + error.message, 'error');
          return false;
        }
        if (data) prod.id = data.id; // asignar el id generado
      }
      return true;
    }

    // ═══ GUARDAR CLIENTE EN SUPABASE (v12) ═══
    async function _sbGuardarCliente(cli) {
      if (!_sb || !_supabaseConectado) return;
      const obj = {
        nombre: cli.nombre, rif: cli.rif || '', nivel: cli.nivel || 'Publico',
        tipo_pago: cli.tipo || 'contado', saldo_vd: cli.saldo_vd || 0, saldo_dist: cli.saldo_dist || 0,
        telefono: cli.tel || '', empresa: cli.empresa || 'ambas',
        direccion: cli.direccion || '', notas: cli.notas || '',
        origen: cli.origen || null, origen_detalle: cli.origen_detalle || ''
      };
      if (cli.id && typeof cli.id === 'number') {
        const { error } = await _sb.from('clientes').update(obj).eq('id', cli.id);
        if (error) console.error('[ARJ] Error actualizando cliente:', error);
      } else {
        const { data, error } = await _sb.from('clientes').insert(obj).select().single();
        if (error) console.error('[ARJ] Error insertando cliente:', error);
        else if (data) {
          cli.id = data.id;
          // Guardar contacto principal
          if (cli.contacto_principal && cli.contacto_principal.nombre && cli.contacto_principal.nombre !== '—') {
            await _sb.from('contactos_cliente').insert({
              cliente_id: data.id, nombre: cli.contacto_principal.nombre,
              cargo: cli.contacto_principal.cargo || '', telefono: cli.contacto_principal.tel || '',
              es_principal: true
            });
          }
        }
      }
    }

    // ═══ GUARDAR FACTOR LANDED POR DEFECTO (v13.1) ═══
    // Solo define con qué factor NACE un producto nuevo. Jamás toca los ya guardados:
    // cada producto lleva su propio factor_landed en su fila.
    async function _sbGuardarFactorDefault() {
      if (!_sb || !_supabaseConectado) return;
      const { error } = await _sb.from('configuracion').update({
        factor_landed_default: estado.factor_default
      }).eq('id', 1);
      if (error) console.error('[ARJ] Error guardando factor por defecto:', error);
    }


    // ═══ GUARDAR TASAS EN SUPABASE (v12) ═══
    async function _sbGuardarTasas() {
      if (!_sb || !_supabaseConectado) return;
      const { error } = await _sb.from('configuracion').update({
        tasa_par: estado.tasa_par, tasa_bcv: estado.tasa_bcv,
        tasas_actualizadas: estado.tasas_actualizadas || new Date().toISOString()
      }).eq('id', 1);
      if (error) console.error('[ARJ] Error guardando tasas:', error);
    }

    // ═══════════════════════════════════════════════════════════════
    // DATOS DEMO (se sobreescriben con datos reales de Supabase)