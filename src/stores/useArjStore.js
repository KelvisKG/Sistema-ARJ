// =====================================================================
// ARJ - Store Central Pinia (Vue 3)
// 100% fiel a toda la arquitectura y funcionalidades del Sistema ARJ
// =====================================================================
import { defineStore } from 'pinia';
import { cargarDatosCompletos, guardarFacturaEnSupabase, anularFacturaEnSupabase, guardarBitacoraEnSupabase } from '../services/supabase.js';
import { cargarDatosLocal } from '../services/persistence.js';
import {
  precioConTier,
  precioBaseItem,
  costoLanded,
  sinFob,
  totalEnDivisas,
  bcvAVerde,
  verdeABcv,
  fmtUSD,
  fmtBs,
  PRECIOS_TIER
} from '../services/pricing.js';

export const useArjStore = defineStore('arj', {
  state: () => ({
    // Sesión y Usuario
    autenticado: false,
    rol: 'gerente', // 'gerente' | 'vendedor'
    usuarioNombre: 'JJ (Gerente General)',
    usuarioEmail: 'josehjimenezcas@gmail.com',

    // Empresa Activa: 'directa' (Venta Directa) | 'distribuidora' (Distribuidora)
    empresa: 'directa',
    empresaDestino: '',
    mostrandoTransicionEmpresa: false,

    // Navegación
    vistaActiva: 'facturacion',

    // Divisas, Tasas y Brecha (M1: arrancan en 0 y sin confirmar hasta leer BD)
    tasa_bcv: 0,
    tasa_par: 0,
    dto_divisa: 0,
    tasasConfirmadasHoy: false,
    fechaConfirmacionTasas: null,

    // Conectividad
    supabaseConectado: false,
    cargando: false,

    // Catálogo y Datos Maestros
    productos: [],
    clientes: [],
    facturasCobrar: [],
    todasFacturas: [],
    presupuestos: [],
    apartados: [],
    notasCredito: [],
    movimientos: [], // Kardex
    movimientosDinero: [], // Flujo de caja
    embarques: [],
    turnos: [],
    turnoActual: null,
    bitacora: [],
    ventasRecientes: [],
    favoritos: [],
    
    // Metas de Venta y Equipo (guardado local)
    metas_hist: {},
    equipo_ventas: [],

    // Carrito de Facturación
    carrito: {
      cliente_id: null,
      cliente_nombre: '',
      tier: 'Publico',
      tipo_pago: 'contado',
      dias_credito: 15,
      anticipo: 0,
      notas: '',
      descuento_manual: 0,
      descuento_motivo: '',
      pidio_fiscal: false,
      items: [],
      pagos: [] // [{ metodo, monto_usd, monto_bs, ref }]
    },

    // Notificaciones Toast
    toast: {
      visible: false,
      mensaje: '',
      tipo: 'info'
    },

    // Filtros de búsqueda
    busquedaFacturacion: '',
    busquedaInventario: '',
    filtroSistema: '',
    filtroMarca: '',

    // Modales y Estados UI
    modoCajaActivo: false,
    modalFacturaActivo: false,
    facturaReciente: null,
    modalTraspasoActivo: false,
    modalNotasActivo: false,
    modalRecepcionActivo: false,
    modalEmbarquesActivo: false,
    modalEditProdActivo: false,
    productoSeleccionado: null,
    modalDtoDivisaActivo: false,
    modalDtoManualActivo: false,
    modalAnularActivo: false,
    facturaAAnular: null,
    modalNuevoClienteActivo: false,
    modalFavoritosActivo: false,
    modalListaPreciosActivo: false,
    modalAbonoActivo: false,
    facturaParaAbono: null,
    modalPresupuestoActivo: false,
    presupuestoSeleccionado: null
  }),

  getters: {
    // Brecha cambiario y factor
    brechaParaleloBCV: (state) => {
      if (state.tasa_bcv <= 0) return 1;
      return state.tasa_par / state.tasa_bcv;
    },

    dtoDivisaNeutro: (state) => {
      const b = state.tasa_bcv > 0 ? state.tasa_par / state.tasa_bcv : 1;
      return b > 0 ? (1 - 1 / b) * 100 : 0;
    },

    dtoDivisaPct: (state) => {
      const d = parseFloat(state.dto_divisa);
      return (Number.isFinite(d) && d >= 0) ? d : state.dtoDivisaNeutro;
    },

    dtoDivisaExcedente: (state) => {
      const d = state.dto_divisa;
      const n = state.dtoDivisaNeutro;
      return (d - n) > 0.001 ? (d - n) : 0;
    },

    // Totales del Carrito
    totalItemsCarrito: (state) => {
      return state.carrito.items.reduce((acc, it) => acc + (parseInt(it.cant) || 0), 0);
    },

    subtotalCarrito: (state) => {
      return state.carrito.items.reduce((acc, it) => acc + (it.cant * (it.precio_base || it.precio)), 0);
    },

    descuentoMontoCarrito: (state) => {
      const dto = state.carrito.descuento_manual || 0;
      if (dto <= 0) return 0;
      return state.subtotalCarrito * (dto / 100);
    },

    totalCarritoUSD: (state) => {
      return Math.max(0, state.carrito.items.reduce((acc, it) => acc + (it.cant * it.precio), 0));
    },

    totalCarritoBs: (state) => {
      return state.totalCarritoUSD * state.tasa_bcv;
    },

    totalCarritoEfectivoVerde: (state) => {
      return totalEnDivisas(state.totalCarritoUSD, state);
    },

    totalPagadoCarritoUSD: (state) => {
      return state.carrito.pagos.reduce((acc, p) => acc + (parseFloat(p.monto_usd) || 0), 0);
    },

    faltaPorPagarUSD: (state) => {
      return Math.max(0, state.totalCarritoUSD - state.totalPagadoCarritoUSD);
    },

    // Margen estimado del carrito
    margenCarritoPct: (state) => {
      const venta = state.totalCarritoUSD;
      if (venta <= 0) return 0;
      const costoTotal = state.carrito.items.reduce((acc, it) => {
        return acc + (it.cant * costoLanded(it, state.productos));
      }, 0);
      if (costoTotal <= 0) return 0;
      return Math.round(((venta - costoTotal) / venta) * 100);
    },

    // Total de deuda activa
    totalDeudaActiva: (state) => {
      const empKey = state.empresa === 'directa' ? 'directa' : 'distribuidora';
      return state.facturasCobrar
        .filter(f => f.empresa === empKey)
        .reduce((acc, f) => acc + (parseFloat(f.saldo_pendiente) || 0), 0);
    }
  },

  actions: {
    // Restauración síncrona de sesión para evitar parpadeos
    restaurarSesion() {
      const sesionGuardada = localStorage.getItem('arj_sesion');
      if (sesionGuardada) {
        try {
          const dataSesion = JSON.parse(sesionGuardada);
          if (dataSesion && dataSesion.autenticado) {
            this.autenticado = true;
            this.rol = dataSesion.rol;
            this.usuarioNombre = dataSesion.usuarioNombre;
          }
        } catch (e) { }
      }
    },

    // Inicialización del sistema
    async initApp() {
      this.cargando = true;
      try {
        // Carga offline-first instantánea de datos y carrito
        cargarDatosLocal(this);

        // Intento de refresco en background desde Supabase
        const datos = await cargarDatosCompletos();
        if (datos.conectado) {
          this.productos = datos.productos;
          this.clientes = datos.clientes;
          
          // Merge local items to preserve them for PDF generation since Supabase doesn't return items
          if (datos.todasFacturas) {
            datos.todasFacturas.forEach(fSup => {
              const fLoc = this.todasFacturas.find(f => f.id === fSup.id || f.num === fSup.num);
              if (fLoc && fLoc.items && Array.isArray(fLoc.items) && fLoc.items.length > 0) fSup.items = fLoc.items;
            });
            this.todasFacturas = datos.todasFacturas;
          }
          if (datos.facturasCobrar) {
            datos.facturasCobrar.forEach(fSup => {
              const fLoc = this.facturasCobrar.find(f => f.id === fSup.id || f.num === fSup.num);
              if (fLoc && fLoc.items && Array.isArray(fLoc.items) && fLoc.items.length > 0) fSup.items = fLoc.items;
            });
            this.facturasCobrar = datos.facturasCobrar;
          }
          if (datos.presupuestos) {
            datos.presupuestos.forEach(pSup => {
              const pLoc = this.presupuestos.find(p => p.id === pSup.id || p.num === pSup.num);
              if (pLoc && pLoc.items && Array.isArray(pLoc.items) && pLoc.items.length > 0) pSup.items = pLoc.items;
            });
            this.presupuestos = datos.presupuestos;
          }

          this.ventasRecientes = datos.ventasRecientes || [];
          
          this.supabaseConectado = true;
          
          if (datos.bitacora && datos.bitacora.length > 0) {
            this.bitacora = datos.bitacora;
          }

          if (datos.embarques && datos.embarques.length > 0) {
            this.embarques = datos.embarques;
          }

          // Priorizar SIEMPRE las tasas de la base de datos (Supabase) sobre las locales
          // datos.tasas puede ser null si la tabla configuracion falló — en ese caso no sobreescribir
          if (datos.tasas && datos.tasas.tasa_bcv > 0 && datos.tasas.tasa_par > 0) {
             this.tasa_bcv = datos.tasas.tasa_bcv;
             this.tasa_par = datos.tasas.tasa_par;
             this.dto_divisa = datos.tasas.dto_divisa || this.dto_divisa;
             this.guardarTasasLocales();
          }

          this.logBitacora('sistema', 'Sistema ARJ inicializado y sincronizado');
        } else {
          // Si no conectó pero hay tasas locales, las cargamos
          const tasasGuardadas = localStorage.getItem('ARJ_TASAS');
          if (tasasGuardadas) {
            try {
               const p = JSON.parse(tasasGuardadas);
               this.tasa_bcv = p.bcv || this.tasa_bcv;
               this.tasa_par = p.par || this.tasa_par;
               this.dto_divisa = p.dto || this.dto_divisa;
            } catch(e) {}
          }
          this.logBitacora('sistema', 'Sistema ARJ en modo Offline');
        }

        this.iniciarSincronizacionOnline();
      } catch (e) {
        console.error('[ARJ Store] Error inicializando:', e);
      } finally {
        this.cargando = false;
      }
    },

    iniciarSincronizacionOnline() {
      if (this._escuchandoRed) return;
      this._escuchandoRed = true;
      window.addEventListener('online', async () => {
        if (!this.autenticado) return;
        this.notif('Conexión recuperada. Extrayendo datos actualizados...', 'info');
        try {
          const { cargarDatosCompletos } = await import('../services/supabase.js');
          const datos = await cargarDatosCompletos();
          if (datos.conectado) {
            this.productos = datos.productos || [];
            this.clientes = datos.clientes || [];
            
            // Merge local items to preserve them
            if (datos.todasFacturas) {
              datos.todasFacturas.forEach(fSup => {
                const fLoc = this.todasFacturas.find(f => f.id === fSup.id || f.num === fSup.num);
                if (fLoc && fLoc.items && Array.isArray(fLoc.items) && fLoc.items.length > 0) {
                  fSup.items = fLoc.items;
                }
              });
              this.todasFacturas = datos.todasFacturas;
            }
            if (datos.facturasCobrar) {
              datos.facturasCobrar.forEach(fSup => {
                const fLoc = this.facturasCobrar.find(f => f.id === fSup.id || f.num === fSup.num);
                if (fLoc && fLoc.items && Array.isArray(fLoc.items) && fLoc.items.length > 0) {
                  fSup.items = fLoc.items;
                }
              });
              this.facturasCobrar = datos.facturasCobrar;
            }
            if (datos.presupuestos) {
              datos.presupuestos.forEach(pSup => {
                const pLoc = this.presupuestos.find(p => p.id === pSup.id || p.num === pSup.num);
                if (pLoc && pLoc.items && Array.isArray(pLoc.items) && pLoc.items.length > 0) {
                  pSup.items = pLoc.items;
                }
              });
              this.presupuestos = datos.presupuestos;
            }
            this.ventasRecientes = datos.ventasRecientes || [];
            this.presupuestos = datos.presupuestos || [];
            this.supabaseConectado = true;
            this.notif('Sistema actualizado con los últimos datos de la nube.', 'success');
          }
        } catch(e) {
          console.error('[ARJ] Error en sincronización online:', e);
        }
      });
    },

    // Gestión de Tasas
    calcularBrecha() {
      const b = this.tasa_bcv > 0 ? this.tasa_par / this.tasa_bcv : 1;
      const neutro = b > 0 ? (1 - 1 / b) * 100 : 0;
      // Actualizamos el descuento divisa igual al neutro por defecto
      this.dto_divisa = Math.round(neutro * 100) / 100;
      this.guardarTasasLocales();
    },

    guardarTasasLocales() {
      localStorage.setItem('ARJ_TASAS', JSON.stringify({
        bcv: this.tasa_bcv,
        par: this.tasa_par,
        dto: this.dto_divisa,
        confirmadasHoy: this.tasasConfirmadasHoy,
        fecha: this.fechaConfirmacionTasas
      }));
    },

    async confirmarTasas() {
      const hoy = new Date().toISOString().slice(0, 10);
      this.tasasConfirmadasHoy = true;
      this.fechaConfirmacionTasas = hoy;
      this.guardarTasasLocales();
      this.logBitacora('sistema', `Tasas confirmadas formalmente: BCV Bs.${this.tasa_bcv} / Paralelo Bs.${this.tasa_par}`);

      if (this.supabaseConectado) {
        import('../services/supabase.js').then(async ({ supabase }) => {
          try {
            await supabase.from('configuracion').update({
              tasa_bcv: this.tasa_bcv,
              tasa_par: this.tasa_par,
              tasas_actualizadas: new Date().toISOString()
            }).neq('id', 0);
          } catch (e) {
            console.warn('[ARJ] Error actualizando tasas en BD:', e);
          }
        });
      }
    },

    // Notificaciones Toast
    notif(mensaje, tipo = 'info') {
      this.toast.mensaje = mensaje;
      this.toast.tipo = tipo;
      this.toast.visible = true;
      setTimeout(() => {
        if (this.toast.mensaje === mensaje) {
          this.toast.visible = false;
        }
      }, 4000);
    },

    // Bitácora de Auditoría
    logBitacora(tipo, mensaje, esAlerta = false) {
      const reg = {
        id: Date.now(),
        fecha: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        fecha_completa: new Date().toLocaleDateString('es-VE') + ' ' + new Date().toLocaleTimeString('es-VE'),
        tipo,
        usuario: this.usuarioNombre,
        empresa: this.empresa,
        mensaje,
        esAlerta
      };
      this.bitacora.unshift(reg);
      if (this.supabaseConectado && tipo !== 'sistema') {
        guardarBitacoraEnSupabase(reg);
      }
    },

    // Control de sesión
    login(rol, nombre) {
      this.rol = rol;
      this.usuarioNombre = nombre || (rol === 'gerente' ? 'JJ (Gerente General)' : 'HUMBERTO ARJ (Ventas)');
      this.autenticado = true;

      // Persistir sesión
      localStorage.setItem('arj_sesion', JSON.stringify({
        autenticado: true,
        rol: this.rol,
        usuarioNombre: this.usuarioNombre
      }));

      this.logBitacora('sesion', `Usuario ${this.usuarioNombre} ingresó como ${rol.toUpperCase()}`);
      this.notif(`Bienvenido ${this.usuarioNombre}`, 'success');
    },

    logout() {
      if (this.autenticado) {
        this.logBitacora('sesion', `Usuario ${this.usuarioNombre} cerró sesión`);
      }

      // 1. Limpiar sesión en Supabase para evitar autologin fantasma
      import('../services/supabase.js').then(({ supabase }) => {
        supabase.auth.signOut().catch(() => {});
      });

      // 2. Destruir TODA la caché de raíz (excepto tema y tasas locales fijadas)
      const theme = localStorage.getItem('arj_tema');
      const tasasLocales = localStorage.getItem('ARJ_TASAS');
      localStorage.clear();
      if (theme) localStorage.setItem('arj_tema', theme);
      if (tasasLocales) localStorage.setItem('ARJ_TASAS', tasasLocales);

      // 3. Reset completo del estado en memoria (sin recargar la página)
      this.autenticado = false;
      this.rol = 'gerente';
      this.usuarioNombre = '';
      this.vistaActiva = 'facturacion';
      this.productos = [];
      this.clientes = [];
      this.facturasCobrar = [];
      this.todasFacturas = [];
      this.presupuestos = [];
      this.apartados = [];
      this.notasCredito = [];
      this.movimientos = [];
      this.movimientosDinero = [];
      this.embarques = [];
      this.turnos = [];
      this.turnoActual = null;
      this.bitacora = [];
      this.ventasRecientes = [];
      this.favoritos = [];
      this.supabaseConectado = false;
      this.cargando = false;
      this.limpiarCarrito();

      // Cerrar todos los modales abiertos
      this.modalFacturaActivo = false;
      this.modalTraspasoActivo = false;
      this.modalRecepcionActivo = false;
      this.modalEmbarquesActivo = false;
      this.modalEditProdActivo = false;
      this.modalDtoDivisaActivo = false;
      this.modalDtoManualActivo = false;
      this.modalAnularActivo = false;
      this.modalNuevoClienteActivo = false;
      this.modalFavoritosActivo = false;
      this.modalListaPreciosActivo = false;
      this.modalAbonoActivo = false;
      this.modalPresupuestoActivo = false;
      this.presupuestoSeleccionado = null;
      this.modoCajaActivo = false;
    },

    async registrarUsuario(email, password, nombre, empresa) {
      this.cargando = true;
      try {
        const { supabase } = await import('../services/supabase.js');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nombre: nombre,
              empresa: empresa || 'ambas'
            }
          }
        });
        
        if (error) {
          throw error;
        }
        
        return { ok: true, data };
      } catch (err) {
        console.error('[ARJ Store] Error registrando usuario:', err);
        return { ok: false, error: err.message };
      } finally {
        this.cargando = false;
      }
    },

    // Cambio de Empresa (Directa vs Distribuidora) con Transición
    cambiarEmpresa(emp) {
      if (emp !== 'directa' && emp !== 'distribuidora') return;
      if (emp === this.empresa) return; // Ya estamos en esta empresa

      // Iniciar la transición
      this.empresaDestino = emp;
      this.mostrandoTransicionEmpresa = true;

      // Esperar 400ms para hacer el cambio lógico por detrás mientras la pantalla está tapada
      setTimeout(() => {
        this.empresa = emp;
        document.body.classList.remove('empresa-directa', 'empresa-distribuidora');
        document.body.classList.add(`empresa-${emp}`);

        // En Venta Directa siempre aplica Precio Público por defecto; en Distribuidora el tier del cliente
        if (emp === 'directa') {
          this.carrito.tier = 'Publico';
        } else if (this.carrito.cliente_id) {
          const cli = this.clientes.find(c => c.id === this.carrito.cliente_id);
          if (cli && cli.nivel) this.carrito.tier = cli.nivel;
        }
        this.actualizarPreciosCarrito();
        this.logBitacora('empresa', `Cambio de contexto operativo a ${emp === 'directa' ? 'ARJ Venta Directa' : 'Distribuidora ARJ'}`);
        this.notif(
          emp === 'directa' ? 'Operando en ARJ Venta Directa (Mostrador)' : 'Operando en Distribuidora ARJ (Mayorista)',
          'info'
        );
      }, 400);

      // Ocultar la transición después de la animación (1.5s total = 1500ms)
      setTimeout(() => {
        this.mostrandoTransicionEmpresa = false;
      }, 1450);
    },

    cambiarVista(vista) {
      this.vistaActiva = vista;
    },

    // Manejo de Carrito
    agregarAlCarrito(prod, cant = 1) {
      const stockDisponible = this.empresa === 'directa' ? (prod.stock_vd || 0) : (prod.stock_dist || 0);
      const stockOtra = this.empresa === 'directa' ? (prod.stock_dist || 0) : (prod.stock_vd || 0);
      const otraEmp = this.empresa === 'directa' ? 'Distribuidora' : 'Venta Directa';
      const idx = this.carrito.items.findIndex(it => it.id === prod.id || it.cod_alt === prod.cod_alt);

      if (idx !== -1) {
        const item = this.carrito.items[idx];
        item.cant += cant;
        if (item.cant > stockDisponible) {
          this.notif(`Aviso: '${prod.desc}' supera stock disponible (${stockDisponible}). Se registrará como préstamo inter-empresarial.`, 'warning');
        } else {
          this.notif(`Incrementado '${prod.desc}' a ${item.cant} unidades`, 'info');
        }
      } else {
        const tierKey = this.carrito.tier || 'Publico';
        const dto = (this.empresa === 'directa' && this.carrito.descuento_manual > 0) ? this.carrito.descuento_manual : 0;
        const base = precioConTier(prod.fob, tierKey, prod);
        const precio = dto > 0 ? Math.round(base * (1 - dto / 100) * 100) / 100 : base;

        this.carrito.items.push({
          id: prod.id,
          cod_alt: prod.cod_alt,
          cod_orig: prod.cod_orig,
          desc: prod.desc,
          marca: prod.marca,
          fob: prod.fob,
          stock_vd: prod.stock_vd,
          stock_dist: prod.stock_dist,
          cant: cant,
          precio: precio,
          precio_base: base,
          precio_fijo: false,
          modo_verde: false,
          precio_verde: bcvAVerde(precio, this),
          factor_landed: prod.factor_landed,
          origen: prod.origen
        });

        if (cant > stockDisponible) {
          this.notif(`Aviso: '${prod.desc}' supera stock local (${stockDisponible} disp., ${otraEmp} tiene ${stockOtra}). Préstamo inter-empresarial.`, 'warning');
        } else {
          this.notif(`Agregado '${prod.desc}' al carrito`, 'success');
        }
      }
    },

    removerDelCarrito(index) {
      if (index >= 0 && index < this.carrito.items.length) {
        this.carrito.items.splice(index, 1);
        this.notif('Producto eliminado de la lista', 'info');
      }
    },

    actualizarCantCarrito(index, cant) {
      if (index >= 0 && index < this.carrito.items.length) {
        const item = this.carrito.items[index];
        const prod = this.productos.find(p => p.id === item.id || p.cod_alt === item.cod_alt);
        const stockDisponible = prod ? (this.empresa === 'directa' ? (prod.stock_vd || 0) : (prod.stock_dist || 0)) : 0;
        const nuevaCant = Math.max(1, parseInt(cant) || 1);

        item.cant = nuevaCant;
        if (nuevaCant > stockDisponible) {
          this.notif(`Aviso: cantidad (${nuevaCant}) supera stock local (${stockDisponible}). Se registrará como préstamo inter-empresarial.`, 'warning');
        }
      }
    },

    toggleModoVerdeItem(index) {
      if (this.rol !== 'gerente') {
        this.notif('Solo el gerente puede modificar precios directamente', 'error');
        return;
      }
      const it = this.carrito.items[index];
      if (it) {
        it.modo_verde = !it.modo_verde;
        if (it.modo_verde) {
          it.precio_verde = bcvAVerde(it.precio, this);
        }
      }
    },

    cambiarPrecioVerdeItem(index, valorVerde) {
      if (this.rol !== 'gerente') {
        this.notif('Solo el gerente puede modificar precios', 'error');
        return;
      }
      const it = this.carrito.items[index];
      if (it) {
        const v = parseFloat(valorVerde) || 0;
        const ant = it.precio;
        it.precio_verde = v;
        it.precio = verdeABcv(v, this);
        it.precio_fijo = true;
        it.precio_base = it.precio;
        this.logBitacora('precio', `Precio de '${it.desc}' fijado en ${fmtUSD(v)} efectivo (${fmtUSD(ant)} -> ${fmtUSD(it.precio)} BCV)`, true);
      }
    },

    cambiarTier(nuevoTier) {
      if (this.rol !== 'gerente' && this.empresa === 'directa') {
        this.notif('Solo el gerente puede cambiar tiers en Venta Directa', 'error');
        return;
      }
      this.carrito.tier = nuevoTier;
      this.actualizarPreciosCarrito();
      this.notif(`Nivel de precio cambiado a: ${nuevoTier}`, 'info');
    },

    actualizarPreciosCarrito() {
      const dto = (this.empresa === 'directa' && this.carrito.descuento_manual > 0) ? this.carrito.descuento_manual : 0;
      this.carrito.items.forEach(it => {
        if (!it.precio_fijo) {
          const prod = this.productos.find(p => p.id === it.id);
          const base = precioConTier(it.fob, this.carrito.tier || 'Publico', prod);
          if (dto > 0) {
            it.precio = Math.round(base * (1 - dto / 100) * 100) / 100;
          } else {
            it.precio = base;
          }
          it.precio_base = base;
          it.precio_verde = bcvAVerde(it.precio, this);
        }
      });
    },

    aplicarDescuentoManual(pct, motivo) {
      if (this.rol !== 'gerente') {
        this.notif('Solo el gerente puede aplicar descuentos manuales', 'error');
        return;
      }
      this.carrito.descuento_manual = pct;
      this.carrito.descuento_motivo = motivo;
      this.actualizarPreciosCarrito();
      this.logBitacora('precio', `Descuento manual de ${pct}% aplicado por ${this.usuarioNombre}. Motivo: "${motivo}"`, true);
      this.notif(pct > 0 ? `Descuento de ${pct}% aplicado correctamente` : 'Descuento manual retirado', 'success');
    },

    seleccionarCliente(cli) {
      if (!cli) {
        this.carrito.cliente_id = null;
        this.carrito.cliente_nombre = '';
        return;
      }
      this.carrito.cliente_id = cli.id;
      this.carrito.cliente_nombre = cli.nombre;
      if (this.empresa === 'distribuidora' && cli.nivel) {
        this.carrito.tier = cli.nivel;
      } else {
        this.carrito.tier = 'Publico';
      }
      if (cli.tipo === 'credito') {
        this.carrito.tipo_pago = 'credito';
      }
      this.actualizarPreciosCarrito();
      this.notif(`Cliente seleccionado: ${cli.nombre}`, 'info');
    },

    // Pagos Múltiples en Carrito (M2)
    agregarPagoCarrito(pagoData, montoSecundario = null, ref = '', montoOpcionalBs = null) {
      let metodo = 'Divisas Efectivo';
      let montoIngresado = 0;
      let moneda = 'USD';
      let refPago = ref;
      let montoUSD = 0;
      let montoBs = 0;
      let montoVerde = null;
      let tasaUsada = this.tasa_bcv;

      if (typeof pagoData === 'object' && pagoData !== null) {
        metodo = pagoData.metodo || metodo;
        montoIngresado = parseFloat(pagoData.monto ?? pagoData.monto_usd ?? pagoData.monto_bs ?? 0) || 0;
        moneda = pagoData.moneda || (metodo.toLowerCase().includes('bs') ? 'Bs' : 'USD');
        refPago = pagoData.ref || pagoData.referencia || ref;
        montoUSD = parseFloat(pagoData.monto_usd) || 0;
        montoBs = parseFloat(pagoData.monto_bs) || 0;
        montoVerde = pagoData.monto_verde != null ? parseFloat(pagoData.monto_verde) : null;
        tasaUsada = parseFloat(pagoData.tasa_usada) || (moneda === 'Bs' ? this.tasa_par : this.tasa_bcv);
      } else {
        metodo = pagoData || metodo;
        montoUSD = parseFloat(montoSecundario) || 0;
        montoIngresado = montoUSD;
        refPago = ref || '';
        if (montoOpcionalBs != null && parseFloat(montoOpcionalBs) > 0) {
          montoBs = parseFloat(montoOpcionalBs);
        }
      }

      const mLower = metodo.toLowerCase();
      const esBs = moneda === 'Bs' || mLower.includes('bs') || mLower.includes('móvil') || mLower.includes('movil') || mLower.includes('transferencia') || mLower.includes('punto');
      const esVerde = mLower.includes('divisa') || mLower.includes('verde') || (mLower.includes('efectivo') && !esBs);

      if (esBs) {
        moneda = 'Bs';
        tasaUsada = this.tasa_par;
        const valBs = montoBs > 0 ? montoBs : (montoIngresado > 0 ? montoIngresado : montoUSD * this.tasa_par);
        montoBs = Math.round(valBs * 100) / 100;
        // M2: Los pagos en Bs. se convierten con tasa_par
        montoUSD = this.tasa_par > 0 ? Math.round((montoBs / this.tasa_par) * 100) / 100 : 0;
      } else if (esVerde) {
        moneda = 'USD_VERDE';
        tasaUsada = this.tasa_bcv;
        const valVerde = montoVerde != null && montoVerde > 0 ? montoVerde : (montoIngresado > 0 ? montoIngresado : montoUSD);
        montoVerde = Math.round(valVerde * 100) / 100;
        // M2: Un cobro en $Verde se acredita como $BCV (se divide entre factor de descuento divisa)
        montoUSD = verdeABcv(montoVerde, this);
        montoBs = Math.round(montoUSD * this.tasa_bcv * 100) / 100;
      } else {
        moneda = 'USD';
        tasaUsada = this.tasa_bcv;
        montoUSD = montoUSD > 0 ? montoUSD : montoIngresado;
        montoBs = Math.round(montoUSD * this.tasa_bcv * 100) / 100;
      }

      if (montoUSD <= 0 && montoBs <= 0) return;

      this.carrito.pagos.push({
        metodo,
        moneda,
        monto: montoIngresado,
        monto_usd: montoUSD,
        monto_bs: montoBs,
        monto_verde: montoVerde,
        tasa_usada: tasaUsada,
        ref: refPago
      });

      const txtMonto = moneda === 'Bs' ? `Bs. ${montoBs.toLocaleString('es-VE')}` : fmtUSD(montoVerde || montoUSD);
      this.notif(`Pago de ${txtMonto} (${metodo}) agregado`, 'info');
    },

    removerPagoCarrito(idx) {
      if (idx >= 0 && idx < this.carrito.pagos.length) {
        this.carrito.pagos.splice(idx, 1);
      }
    },

    limpiarCarrito() {
      this.carrito.items = [];
      this.carrito.pagos = [];
      this.carrito.cliente_id = null;
      this.carrito.cliente_nombre = '';
      this.carrito.notas = '';
      this.carrito.anticipo = 0;
      this.carrito.descuento_manual = 0;
      this.carrito.descuento_motivo = '';
      this.carrito.pidio_fiscal = false;
    },

    // Emisión de Factura Formal
    async emitirFactura() {
      // 0. Bloqueo estricto sin conexión a la base de datos (C7)
      if (!this.supabaseConectado || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        this.notif('❌ Emisión bloqueada: Sin conexión a la base de datos central. No se permite facturar offline.', 'error');
        return {
          ok: false,
          error: 'Sin conexión a la base de datos central. La emisión fue bloqueada para garantizar la sincronización de inventario y correlativos.'
        };
      }

      // 1. Validar que el carrito no esté vacío
      if (this.carrito.items.length === 0) {
        this.notif('El carrito está vacío. Agrega productos antes de facturar.', 'warning');
        return { ok: false, error: 'Carrito vacío' };
      }

      // 2. Validación de facturas de contado (Prioritaria)
      if (this.carrito.tipo_pago === 'contado' && this.faltaPorPagarUSD > 0.05) {
        this.notif(`Emisión bloqueada: Los pagos no cubren el total. Faltan ${fmtUSD(this.faltaPorPagarUSD)}`, 'error');
        return { ok: false, error: 'Pago incompleto', faltaPorPagar: this.faltaPorPagarUSD };
      }

      // 3. Validar cliente
      if (!this.carrito.cliente_id && (!this.carrito.cliente_nombre || !this.carrito.cliente_nombre.trim())) {
        this.notif('Selecciona un cliente antes de emitir la factura', 'error');
        return { ok: false, error: 'Sin cliente seleccionado' };
      }

      // 4. Validar tasas cambiarias
      if (!this.tasa_bcv || this.tasa_bcv <= 0 || !this.tasa_par || this.tasa_par <= 0) {
        this.notif('Las tasas de cambio (BCV y Paralelo) deben estar configuradas para emitir la factura', 'error');
        return { ok: false, error: 'Tasas no configuradas' };
      }

      // 4b. Tasas deben haber sido confirmadas hoy (no usar valores en memoria sin verificar)
      if (!this.tasasConfirmadasHoy) {
        this.notif('Debe confirmar las tasas de cambio hoy antes de emitir facturas', 'error');
        return { ok: false, error: 'Tasas no confirmadas hoy' };
      }

      // 5. Bloqueo estricto v13.17: Producto sin costo FOB no se factura
      const sinCosto = this.carrito.items.filter(sinFob);
      if (sinCosto.length > 0) {
        this.notif(`Emisión bloqueada: ${sinCosto.length} producto(s) no tienen costo FOB cargado`, 'error');
        return { ok: false, error: 'Productos sin FOB', sinCosto };
      }

      // 6. Red de seguridad v13.3: Ningún renglón sin descripción
      const sinDesc = this.carrito.items.filter(it => !it.desc || !String(it.desc).trim());
      if (sinDesc.length > 0) {
        this.notif(`Hay ${sinDesc.length} renglón(es) sin descripción. Corrige el producto antes de facturar.`, 'error');
        return { ok: false, error: 'Productos sin descripción' };
      }

      // 7. Descuento manual solo permitido a gerente
      if (this.carrito.descuento_manual > 0 && this.rol !== 'gerente') {
        this.notif('Solo el gerente puede aplicar descuentos manuales', 'error');
        return { ok: false, error: 'Descuento no autorizado' };
      }

      // 8. Obtener correlativo oficial desde la base de datos (C6)
      let numFactura = null;
      try {
        const { obtenerSiguienteCorrelativoBD } = await import('../services/supabase.js');
        numFactura = await obtenerSiguienteCorrelativoBD(this.empresa);
      } catch (errCorr) {
        console.error('[ARJ] Error obteniendo correlativo de BD:', errCorr);
      }

      // Si falla la consulta a BD, BLOQUEAR emisión para evitar colisión de números (C6)
      if (!numFactura) {
        this.notif('❌ Emisión bloqueada: No se pudo obtener el correlativo oficial desde la base de datos.', 'error');
        return {
          ok: false,
          error: 'No se pudo obtener el correlativo oficial desde la base de datos. Se bloquea la emisión para evitar duplicidad de correlativos.'
        };
      }

      const totalUSD = this.totalCarritoUSD;
      const totalBs = this.totalCarritoBs;

      const esContado = this.carrito.tipo_pago === 'contado';
      const abonoCalculado = esContado ? totalUSD : Math.min(totalUSD, Math.round(this.totalPagadoCarritoUSD * 100) / 100);
      const saldoPendiente = esContado ? 0 : Math.max(0, Math.round((totalUSD - abonoCalculado) * 100) / 100);
      const estadoFactura = (esContado || saldoPendiente <= 0.01) ? 'pagada' : (abonoCalculado > 0 ? 'parcial' : 'pendiente');

      // Calcular cobrar_verde (efectivo en divisas para el cobrador)
      const cobrarVerde = totalEnDivisas(totalUSD, this);

      const nuevaFactura = {
        id: `FAC-${numFactura}`, // ID local temporal, se reemplaza con el UUID de BD tras el insert
        num: numFactura,
        empresa: this.empresa,
        tier: this.carrito.tier || 'Publico',
        cliente: this.carrito.cliente_nombre || 'CLIENTE MOSTRADOR',
        cliente_id: this.carrito.cliente_id,
        vendedor: this.usuarioNombre,
        fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
        fecha_raw: new Date().toISOString(),
        vence: new Date(Date.now() + (this.carrito.dias_credito * 86400000)).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
        total: totalUSD,
        abonado: abonoCalculado,
        saldo_pendiente: saldoPendiente,
        estado: estadoFactura,
        dias: this.carrito.dias_credito,
        tipo_pago: this.carrito.tipo_pago,
        tasa_par: this.tasa_par,
        tasa_bcv: this.tasa_bcv,
        factor_bs: 1.00,
        descuento_manual: this.carrito.descuento_manual,
        descuento_motivo: this.carrito.descuento_motivo || '',
        pidio_fiscal: this.carrito.pidio_fiscal,
        cobrar_verde: cobrarVerde,
        pagos: JSON.parse(JSON.stringify(this.carrito.pagos)),
        items: JSON.parse(JSON.stringify(this.carrito.items))
      };

      // Descontar inventario local (reflejo inmediato en UI mientras la BD confirma)
      this.carrito.items.forEach(it => {
        const prod = this.productos.find(p => p.id === it.id || p.cod_alt === it.cod_alt);
        if (prod) {
          if (this.empresa === 'directa') {
            prod.stock_vd = (prod.stock_vd || 0) - it.cant;
          } else {
            prod.stock_dist = (prod.stock_dist || 0) - it.cant;
          }
          // Kardex local
          this.movimientos.unshift({
            id: Date.now() + Math.random(),
            fecha: new Date().toLocaleTimeString('es-VE') + ' ' + new Date().toLocaleDateString('es-VE'),
            tipo: 'salida',
            producto: it.desc,
            cod_alt: it.cod_alt,
            cant: it.cant,
            empresa: this.empresa,
            motivo: `Venta Factura ${numFactura}`,
            usuario: this.usuarioNombre
          });
        }
      });

      // Actualizar saldo del cliente si es crédito (local)
      if (!esContado && this.carrito.cliente_id && saldoPendiente > 0) {
        const cli = this.clientes.find(c => c.id === this.carrito.cliente_id);
        if (cli) {
          if (this.empresa === 'directa') {
            cli.saldo_vd = Math.round(((cli.saldo_vd || 0) + saldoPendiente) * 100) / 100;
          } else {
            cli.saldo_dist = Math.round(((cli.saldo_dist || 0) + saldoPendiente) * 100) / 100;
          }
        }
      }

      // Agregar a los arrays locales (antes del await para que la UI responda)
      this.todasFacturas.unshift(nuevaFactura);
      if (nuevaFactura.estado !== 'pagada') {
        this.facturasCobrar.unshift(nuevaFactura);
      }

      this.logBitacora('venta', `Factura ${numFactura} emitida a ${nuevaFactura.cliente} por ${fmtUSD(totalUSD)}`);

      // Persistir en Supabase (4 tablas en orden)
      if (this.supabaseConectado) {
        const resultado = await guardarFacturaEnSupabase(
          nuevaFactura,
          nuevaFactura.items,
          nuevaFactura.pagos,
          this.empresa
        );

        if (!resultado.ok) {
          // REVERTIR todo lo aplicado localmente
          this._revertirFacturaLocal(nuevaFactura);
          this.notif(`❌ Error al guardar factura en la base de datos: ${resultado.error}`, 'error');
          this.logBitacora('error', `Factura ${numFactura} falló al persistir: ${resultado.error}`, true);
          return { ok: false, error: resultado.error };
        }

        // Actualizar el ID local con el UUID real de la BD
        if (resultado.data && resultado.data.id) {
          const fLocal = this.todasFacturas.find(f => f.num === numFactura);
          if (fLocal) fLocal.id = resultado.data.id;
          const fCobrar = this.facturasCobrar.find(f => f.num === numFactura);
          if (fCobrar) fCobrar.id = resultado.data.id;
          nuevaFactura.id = resultado.data.id;
        }

        // Persistir saldo actualizado del cliente en Supabase si fue a crédito
        if (!esContado && this.carrito.cliente_id && saldoPendiente > 0) {
          const cli = this.clientes.find(c => c.id === this.carrito.cliente_id);
          if (cli) {
            const campoSaldo = this.empresa === 'directa' ? 'saldo_vd' : 'saldo_dist';
            const { supabase } = await import('../services/supabase.js');
            await supabase.from('clientes').update({ [campoSaldo]: cli[campoSaldo] }).eq('id', this.carrito.cliente_id);
          }
        }
      }

      this.facturaReciente = nuevaFactura;
      this.modalFacturaActivo = true;
      this.limpiarCarrito();
      this.notif(`Factura ${numFactura} emitida con éxito`, 'success');
      return { ok: true, factura: nuevaFactura };
    },

    // Método auxiliar: revierte cambios locales si la persistencia en BD falló
    _revertirFacturaLocal(factura) {
      // Revertir stock local
      if (factura.items) {
        factura.items.forEach(it => {
          const prod = this.productos.find(p => p.id === it.id || p.cod_alt === it.cod_alt);
          if (prod) {
            if (factura.empresa === 'directa') {
              prod.stock_vd = (prod.stock_vd || 0) + it.cant;
            } else {
              prod.stock_dist = (prod.stock_dist || 0) + it.cant;
            }
          }
        });
      }
      // Revertir saldo del cliente (si era crédito)
      if (factura.tipo_pago !== 'contado' && factura.cliente_id && factura.saldo_pendiente > 0) {
        const cli = this.clientes.find(c => c.id === factura.cliente_id);
        if (cli) {
          if (factura.empresa === 'directa') {
            cli.saldo_vd = Math.max(0, Math.round(((cli.saldo_vd || 0) - factura.saldo_pendiente) * 100) / 100);
          } else {
            cli.saldo_dist = Math.max(0, Math.round(((cli.saldo_dist || 0) - factura.saldo_pendiente) * 100) / 100);
          }
        }
      }
      // Quitar de los arrays locales
      this.todasFacturas = this.todasFacturas.filter(f => f.num !== factura.num);
      this.facturasCobrar = this.facturasCobrar.filter(f => f.num !== factura.num);
      // Quitar del kardex local
      this.movimientos = this.movimientos.filter(m => !m.motivo?.includes(factura.num));
    },
    // Anulación de Factura con reversión de inventario y persistencia en BD
    async anularFactura(facturaId, motivo) {
      if (this.rol !== 'gerente') {
        this.notif('Solo el gerente puede anular facturas', 'error');
        return false;
      }

      // C7 / Seguridad: Bloquear anulación sin conexión con la base de datos central
      if (!this.supabaseConectado || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        this.notif('❌ Anulación bloqueada: Sin conexión a la base de datos central.', 'error');
        return false;
      }

      const fac = this.todasFacturas.find(f => f.id === facturaId || f.num === facturaId);
      if (!fac) {
        this.notif('Factura no encontrada', 'error');
        return false;
      }

      // Persistir en BD PRIMERO
      // Solo enviamos a BD si el ID no es el temporal local (que empieza con 'FAC-')
      if (fac.id && !String(fac.id).startsWith('FAC-')) {
        const res = await anularFacturaEnSupabase(fac.id, motivo, this.usuarioNombre, fac.empresa);
        if (!res.ok) {
          this.notif(`❌ Error al anular en la base de datos: ${res.error}`, 'error');
          return false;
        }
      }

      // Aplicar localmente
      fac.estado = 'anulada';
      fac.anulada_por = this.usuarioNombre;
      fac.anulada_fecha = new Date().toLocaleTimeString('es-VE') + ' ' + new Date().toLocaleDateString('es-VE');
      fac.anulada_motivo = motivo || 'Anulación por gerencia';

      // Revertir inventario local
      if (fac.items && fac.items.length > 0) {
        fac.items.forEach(it => {
          const prod = this.productos.find(p => p.id === it.id || p.cod_alt === it.cod_alt);
          if (prod) {
            if (fac.empresa === 'directa') {
              prod.stock_vd = (prod.stock_vd || 0) + it.cant;
            } else {
              prod.stock_dist = (prod.stock_dist || 0) + it.cant;
            }
          }
        });
      }

      // Revertir saldo del cliente si tenía saldo pendiente
      if (fac.tipo_pago === 'credito' && fac.cliente_id && fac.saldo_pendiente > 0) {
        const cli = this.clientes.find(c => c.id === fac.cliente_id);
        if (cli) {
          const campoSaldo = fac.empresa === 'directa' ? 'saldo_vd' : 'saldo_dist';
          if (fac.empresa === 'directa') {
            cli.saldo_vd = Math.max(0, Math.round(((cli.saldo_vd || 0) - fac.saldo_pendiente) * 100) / 100);
          } else {
            cli.saldo_dist = Math.max(0, Math.round(((cli.saldo_dist || 0) - fac.saldo_pendiente) * 100) / 100);
          }
          if (this.supabaseConectado) {
            const { supabase } = await import('../services/supabase.js');
            await supabase.from('clientes').update({ [campoSaldo]: cli[campoSaldo] }).eq('id', fac.cliente_id);
          }
        }
      }

      // Remover de facturas por cobrar
      this.facturasCobrar = this.facturasCobrar.filter(f => f.id !== fac.id && f.num !== fac.num);
      this.logBitacora('anulacion', `Factura ${fac.num} anulada. Motivo: "${fac.anulada_motivo}"`, true);
      this.notif(`Factura ${fac.num} anulada y existencias devueltas al inventario`, 'warning');
      return true;
    },


    // Presupuestos
    guardarPresupuesto(datos) {
      const prefijo = this.empresa === 'directa' ? 'PRE-VD' : 'PRE-DIST';
      const anio = new Date().getFullYear();
      const correlativo = String(this.presupuestos.filter(p => p.empresa === this.empresa).length + 1).padStart(4, '0');
      const num = `${prefijo}-${anio}-${correlativo}`;
      const vence = new Date(Date.now() + (45 * 86400000));
      const diasRest = 45;
      const nuevo = {
        id: Date.now(),
        num,
        empresa: this.empresa,
        cliente: datos.cliente || 'CLIENTE MOSTRADOR',
        cliente_id: datos.cliente_id,
        vendedor: this.usuarioNombre,
        fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
        fecha_raw: new Date().toISOString(),
        vence: vence.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
        total: datos.total || this.totalCarritoUSD,
        estado: 'activa',
        dias_restantes: diasRest,
        items_count: (datos.items || this.carrito.items || []).length,
        items: JSON.parse(JSON.stringify(datos.items || this.carrito.items))
      };
      this.presupuestos.unshift(nuevo);
      this.logBitacora('presupuesto', `Cotización ${num} generada para ${nuevo.cliente} por ${fmtUSD(nuevo.total)}`);
      this.notif(`Presupuesto ${num} guardado (vigencia 45 días)`, 'success');
      return nuevo;
    },

    convertirPresupuestoEnVenta(preId) {
      const pre = this.presupuestos.find(p => p.id === preId || p.num === preId);
      if (!pre) return;
      this.limpiarCarrito();
      this.carrito.cliente_id = pre.cliente_id;
      this.carrito.cliente_nombre = pre.cliente;
      pre.items.forEach(it => {
        const prod = this.productos.find(p => p.id === it.id || p.cod_alt === it.cod_alt);
        if (prod) {
          this.agregarAlCarrito(prod, it.cant);
        }
      });
      pre.estado = 'convertida';
      this.cambiarVista('facturacion');
      this.notif(`Cotización ${pre.num} cargada al carrito para emitir factura`, 'success');
    },

    // Cobros y Abonos con persistencia en Supabase (tabla pagos + facturas + clientes)
    async registrarCobro(facturaId, montoUSD, metodo = 'dolar_efectivo', ref = '') {
      const fac = this.facturasCobrar.find(f => f.id === facturaId || f.num === facturaId);
      if (!fac) {
        this.notif('Factura no encontrada', 'error');
        return false;
      }
      const abono = parseFloat(montoUSD) || 0;
      if (abono <= 0) {
        this.notif('Monto de abono inválido', 'warning');
        return false;
      }

      const nuevoAbonado = Math.min(fac.total, (fac.abonado || 0) + abono);
      const nuevoSaldoPendiente = Math.max(0, Math.round((fac.total - nuevoAbonado) * 100) / 100);
      const nuevoEstado = nuevoSaldoPendiente <= 0.01 ? 'pagada' : 'parcial';

      // Persistir en Supabase si está conectado
      if (this.supabaseConectado && fac.id && !String(fac.id).startsWith('FAC-')) {
        try {
          const { supabase } = await import('../services/supabase.js');

          // 1. Insertar fila en tabla 'pagos' con la tasa correspondiente al método (M2)
          const mLower = (metodo || '').toLowerCase();
          const esBs = mLower.includes('bs') || mLower.includes('móvil') || mLower.includes('movil') || mLower.includes('transferencia') || mLower.includes('punto');
          const tasaCobro = esBs ? (this.tasa_par || this.tasa_bcv) : (this.tasa_bcv || this.tasa_par);
          const pagoPayload = {
            factura_id: fac.id,
            monto_usd: abono,
            monto_bs: Math.round(abono * tasaCobro * 100) / 100,
            tasa_usada: tasaCobro,
            metodo: metodo,
            referencia: ref || '',
            registrado_por: this.usuarioNombre
          };
          const { error: errPago } = await supabase.from('pagos').insert([pagoPayload]);
          if (errPago) {
            console.warn('[ARJ] Advertencia insertando pago:', errPago);
          }

          // 2. Actualizar saldo en tabla 'facturas'
          const { error: errFac } = await supabase.from('facturas').update({
            saldo_pendiente: nuevoSaldoPendiente,
            estado: nuevoEstado
          }).eq('id', fac.id);
          if (errFac) {
            this.notif(`Error actualizando saldo en BD: ${errFac.message}`, 'error');
            return false;
          }

          // 3. Actualizar saldo deudor en tabla 'clientes'
          if (fac.cliente_id) {
            const cli = this.clientes.find(c => c.id === fac.cliente_id);
            if (cli) {
              const campoSaldo = fac.empresa === 'directa' ? 'saldo_vd' : 'saldo_dist';
              const nuevoSaldoCli = Math.max(0, Math.round(((cli[campoSaldo] || 0) - abono) * 100) / 100);
              await supabase.from('clientes').update({ [campoSaldo]: nuevoSaldoCli }).eq('id', fac.cliente_id);
            }
          }
        } catch (err) {
          console.error('[ARJ] Error persistiendo cobro en Supabase:', err);
          this.notif(`Error al registrar cobro: ${err.message}`, 'error');
          return false;
        }
      }

      // Aplicar cambios en el estado local
      fac.abonado = nuevoAbonado;
      fac.saldo_pendiente = nuevoSaldoPendiente;
      fac.estado = nuevoEstado;

      // Descontar del saldo local del cliente
      if (fac.cliente_id) {
        const cli = this.clientes.find(c => c.id === fac.cliente_id);
        if (cli) {
          if (fac.empresa === 'directa') {
            cli.saldo_vd = Math.max(0, Math.round(((cli.saldo_vd || 0) - abono) * 100) / 100);
          } else {
            cli.saldo_dist = Math.max(0, Math.round(((cli.saldo_dist || 0) - abono) * 100) / 100);
          }
        }
      }

      if (nuevoEstado === 'pagada') {
        this.facturasCobrar = this.facturasCobrar.filter(f => f.id !== fac.id);
        this.notif(`Factura ${fac.num} cancelada en su totalidad`, 'success');
      } else {
        this.notif(`Abono de ${fmtUSD(abono)} registrado para factura ${fac.num}`, 'success');
      }
      this.logBitacora('cobro', `Abono de ${fmtUSD(abono)} a factura ${fac.num} (${metodo})`);
      return true;
    },

    // Traspaso entre Distribuidora y Venta Directa
    ejecutarTraspaso(prodId, cantidad, motivo) {
      const prod = this.productos.find(p => p.id === prodId || p.cod_alt === prodId);
      if (!prod) {
        this.notif('Producto no encontrado', 'error');
        return false;
      }
      const cant = parseInt(cantidad) || 0;
      if (cant <= 0 || cant > prod.stock_dist) {
        this.notif(`Cantidad inválida. Stock disponible en Distribuidora: ${prod.stock_dist}`, 'warning');
        return false;
      }
      prod.stock_dist -= cant;
      prod.stock_vd += cant;

      const mov = {
        id: Date.now(),
        fecha: new Date().toLocaleTimeString('es-VE') + ' ' + new Date().toLocaleDateString('es-VE'),
        tipo: 'traspaso',
        producto: prod.desc,
        cod_alt: prod.cod_alt,
        cant: cant,
        empresa: 'distribuidora -> directa',
        motivo: motivo || 'Traspaso para mostrador',
        usuario: this.usuarioNombre
      };
      this.movimientos.unshift(mov);
      this.logBitacora('traspaso', `Traspaso de ${cant} un. de '${prod.cod_alt}' desde Distribuidora a Venta Directa`);
      this.notif(`Traspaso de ${cant} un. de '${prod.cod_alt}' realizado con éxito`, 'success');
      return true;
    },

    // Turnos de Caja
    abrirTurno(inicialUSD, inicialBs) {
      const nuevo = {
        id: Date.now(),
        cajero: this.usuarioNombre,
        fecha_apertura: new Date().toLocaleTimeString('es-VE') + ' ' + new Date().toLocaleDateString('es-VE'),
        fecha_cierre: null,
        inicial_usd: parseFloat(inicialUSD) || 0,
        inicial_bs: parseFloat(inicialBs) || 0,
        ventas_usd: 0,
        ventas_bs: 0,
        estado: 'abierto'
      };
      this.turnos.unshift(nuevo);
      this.turnoActual = nuevo;
      this.logBitacora('caja', `Turno abierto por ${this.usuarioNombre} con $${nuevo.inicial_usd} y Bs.${nuevo.inicial_bs}`);
      this.notif('Turno de caja abierto correctamente', 'success');
    },

    cerrarTurno(arqueoUSD, arqueoBs, notas) {
      if (!this.turnoActual) return;
      this.turnoActual.fecha_cierre = new Date().toLocaleTimeString('es-VE') + ' ' + new Date().toLocaleDateString('es-VE');
      this.turnoActual.arqueo_usd = parseFloat(arqueoUSD) || 0;
      this.turnoActual.arqueo_bs = parseFloat(arqueoBs) || 0;
      this.turnoActual.notas_cierre = notas || '';
      this.turnoActual.estado = 'cerrado';
      this.logBitacora('caja', `Turno cerrado por ${this.usuarioNombre}. Arqueo: $${arqueoUSD} / Bs.${arqueoBs}`);
      this.turnoActual = null;
      this.notif('Turno de caja cerrado con reporte de arqueo', 'info');
    },

    // Edición y Alta de Productos
    guardarEdicionProducto(id, datos) {
      const prod = this.productos.find(p => p.id === id);
      if (!prod) return false;
      Object.assign(prod, datos);
      this.logBitacora('producto', `Producto '${prod.cod_alt}' editado por ${this.usuarioNombre}`);
      this.notif(`Producto '${prod.cod_alt}' actualizado`, 'success');
      return true;
    }
  }
});
