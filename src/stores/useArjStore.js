// =====================================================================
// ARJ - Store Central Pinia (Vue 3)
// 100% fiel a toda la arquitectura y funcionalidades del Sistema ARJ
// =====================================================================
import { defineStore } from 'pinia';
import { cargarDatosCompletos, guardarFacturaEnSupabase, guardarBitacoraEnSupabase } from '../services/supabase.js';
import { cargarDatosLocal } from '../services/persistence.js';
import {
  precioConTier,
  precioBaseItem,
  costoLanded,
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

    inactividadExpulsado: false, // Flag to show modal in login screen

    // Empresa Activa: 'directa' (Venta Directa) | 'distribuidora' (Distribuidora)
    empresa: 'directa',
    empresaDestino: '',
    mostrandoTransicionEmpresa: false,

    // Navegación
    vistaActiva: 'facturacion',

    // Divisas, Tasas y Brecha
    tasa_bcv: 500.80,
    tasa_par: 580.50,
    dto_divisa: 18.29,
    tasasConfirmadasHoy: true,

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
    facturaParaAbono: null
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
      return state.carrito.items.reduce((acc, it) => acc + (it.cant * it.precio), 0);
    },

    descuentoMontoCarrito: (state) => {
      if (state.carrito.descuento_manual <= 0) return 0;
      return state.subtotalCarrito * (state.carrito.descuento_manual / 100);
    },

    totalCarritoUSD: (state) => {
      return Math.max(0, state.subtotalCarrito - state.descuentoMontoCarrito);
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

          // Priorizar SIEMPRE las tasas de la base de datos (Supabase) sobre las locales
          if (datos.tasas) {
             this.tasa_bcv = datos.tasas.tasa_bcv || this.tasa_bcv;
             this.tasa_par = datos.tasas.tasa_par || this.tasa_par;
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
            this.facturasCobrar = datos.facturasCobrar || [];
            this.todasFacturas = datos.todasFacturas || [];
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
        dto: this.dto_divisa
      }));
    },

    async confirmarTasas() {
      this.tasasConfirmadasHoy = true;
      this.logBitacora('sistema', `Tasas actualizadas: BCV Bs.${this.tasa_bcv} / Paralelo Bs.${this.tasa_par}`);

      if (this.supabaseConectado) {
        import('../services/supabase.js').then(async ({ supabase }) => {
          try {
            await supabase.from('configuracion').update({
              tasa_bcv: this.tasa_bcv,
              tasa_par: this.tasa_par,
              dto_divisa: this.dto_divisa
            }).eq('id', 1);
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

    logout(porInactividad = false) {
      if (this.autenticado) {
        this.logBitacora('sesion', `Usuario ${this.usuarioNombre} cerró sesión${porInactividad ? ' por inactividad' : ''}`);
      }
      this.autenticado = false;

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

      this.limpiarCarrito();

      // 3. Forzar una recarga total de la página para destruir cualquier estado residual en memoria
      setTimeout(() => {
        window.location.reload();
      }, 100);
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
      const stockDisponible = this.empresa === 'directa' ? prod.stock_vd : prod.stock_dist;
      const idx = this.carrito.items.findIndex(it => it.id === prod.id);

      if (idx !== -1) {
        const item = this.carrito.items[idx];
        if (item.cant + cant > stockDisponible) {
          this.notif(`Stock insuficiente en ${this.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora'} (${stockDisponible} disp.)`, 'warning');
          return;
        }
        item.cant += cant;
        this.notif(`Incrementado '${prod.desc}' a ${item.cant} unidades`, 'info');
      } else {
        if (cant > stockDisponible) {
          this.notif(`Stock insuficiente (${stockDisponible} disp.)`, 'warning');
          return;
        }
        const tierKey = this.carrito.tier || 'Publico';
        const precio = precioConTier(prod.fob, tierKey, prod);
        this.carrito.items.push({
          id: prod.id,
          cod_alt: prod.cod_alt,
          cod_orig: prod.cod_orig,
          desc: prod.desc,
          marca: prod.marca,
          fob: prod.fob,
          cant: cant,
          precio: precio,
          precio_base: precio,
          precio_fijo: false,
          modo_verde: false,
          precio_verde: bcvAVerde(precio, this),
          factor_landed: prod.factor_landed,
          origen: prod.origen
        });
        this.notif(`Agregado '${prod.desc}' al carrito`, 'success');
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
        const prod = this.productos.find(p => p.id === item.id);
        const stockDisponible = prod ? (this.empresa === 'directa' ? prod.stock_vd : prod.stock_dist) : 999;
        const nuevaCant = Math.max(1, parseInt(cant) || 1);

        if (nuevaCant > stockDisponible) {
          this.notif(`Stock máximo disponible: ${stockDisponible}`, 'warning');
          item.cant = stockDisponible;
        } else {
          item.cant = nuevaCant;
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

    // Pagos Múltiples en Carrito
    agregarPagoCarrito(metodo, montoUSD, ref = '') {
      const vUSD = parseFloat(montoUSD) || 0;
      if (vUSD <= 0) return;
      const vBs = Math.round(vUSD * this.tasa_bcv * 100) / 100;
      this.carrito.pagos.push({
        metodo,
        monto_usd: vUSD,
        monto_bs: vBs,
        ref: ref || ''
      });
      this.notif(`Pago de ${fmtUSD(vUSD)} agregado`, 'info');
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
      if (this.carrito.items.length === 0) {
        this.notif('El carrito está vacío', 'warning');
        return { ok: false, error: 'Carrito vacío' };
      }

      const prefijo = this.empresa === 'directa' ? 'VD' : 'DIST';
      const correlativo = String(this.todasFacturas.length + 1).padStart(5, '0');
      const numFactura = `${prefijo}-2026-${correlativo}`;
      const totalUSD = this.totalCarritoUSD;
      const totalBs = this.totalCarritoBs;

      const nuevaFactura = {
        id: `FAC-${numFactura}`,
        num: numFactura,
        empresa: this.empresa,
        cliente: this.carrito.cliente_nombre || 'CLIENTE MOSTRADOR',
        cliente_id: this.carrito.cliente_id,
        vendedor: this.usuarioNombre,
        fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
        fecha_raw: new Date().toISOString(),
        vence: new Date(Date.now() + (this.carrito.dias_credito * 86400000)).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
        total: totalUSD,
        abonado: this.carrito.tipo_pago === 'contado' ? totalUSD : parseFloat(this.carrito.anticipo) || 0,
        saldo_pendiente: this.carrito.tipo_pago === 'contado' ? 0 : Math.max(0, totalUSD - (parseFloat(this.carrito.anticipo) || 0)),
        estado: this.carrito.tipo_pago === 'contado' ? 'pagada' : ((parseFloat(this.carrito.anticipo) || 0) > 0 ? 'parcial' : 'pendiente'),
        dias: this.carrito.dias_credito,
        tipo_pago: this.carrito.tipo_pago,
        tasa_par: this.tasa_par,
        tasa_bcv: this.tasa_bcv,
        factor_bs: 1.00,
        descuento_manual: this.carrito.descuento_manual,
        pidio_fiscal: this.carrito.pidio_fiscal,
        pagos: JSON.parse(JSON.stringify(this.carrito.pagos)),
        items: JSON.parse(JSON.stringify(this.carrito.items))
      };

      // Descontar inventario local
      this.carrito.items.forEach(it => {
        const prod = this.productos.find(p => p.id === it.id);
        if (prod) {
          if (this.empresa === 'directa') {
            prod.stock_vd = Math.max(0, prod.stock_vd - it.cant);
          } else {
            prod.stock_dist = Math.max(0, prod.stock_dist - it.cant);
          }
          // Kardex
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

      this.todasFacturas.unshift(nuevaFactura);
      if (nuevaFactura.estado !== 'pagada') {
        this.facturasCobrar.unshift(nuevaFactura);
      }

      this.logBitacora('venta', `Factura ${numFactura} emitida a ${nuevaFactura.cliente} por ${fmtUSD(totalUSD)}`);

      if (this.supabaseConectado) {
        guardarFacturaEnSupabase({
          num: nuevaFactura.num,
          empresa: nuevaFactura.empresa,
          cliente: nuevaFactura.cliente,
          cliente_id: nuevaFactura.cliente_id,
          vendedor: nuevaFactura.vendedor,
          total: nuevaFactura.total,
          abonado: nuevaFactura.abonado,
          saldo_pendiente: nuevaFactura.saldo_pendiente,
          estado: nuevaFactura.estado,
          tipo_pago: nuevaFactura.tipo_pago,
          tasa_par: nuevaFactura.tasa_par,
          tasa_bcv: nuevaFactura.tasa_bcv
        });
      }

      this.facturaReciente = nuevaFactura;
      this.modalFacturaActivo = true;
      this.limpiarCarrito();
      this.notif(`Factura ${numFactura} emitida con éxito`, 'success');
      return { ok: true, factura: nuevaFactura };
    },

    // Anulación de Factura con reversión de inventario
    anularFactura(facturaId, motivo) {
      if (this.rol !== 'gerente') {
        this.notif('Solo el gerente puede anular facturas', 'error');
        return false;
      }
      const fac = this.todasFacturas.find(f => f.id === facturaId || f.num === facturaId);
      if (!fac) {
        this.notif('Factura no encontrada', 'error');
        return false;
      }
      fac.estado = 'anulada';
      fac.anulada_por = this.usuarioNombre;
      fac.anulada_fecha = new Date().toLocaleTimeString('es-VE') + ' ' + new Date().toLocaleDateString('es-VE');
      fac.anulada_motivo = motivo || 'Anulación por gerencia';

      // Revertir inventario
      if (fac.items && fac.items.length > 0) {
        fac.items.forEach(it => {
          const prod = this.productos.find(p => p.id === it.id || p.cod_alt === it.cod_alt);
          if (prod) {
            if (fac.empresa === 'directa') {
              prod.stock_vd += it.cant;
            } else {
              prod.stock_dist += it.cant;
            }
          }
        });
      }

      // Remover de facturas por cobrar
      this.facturasCobrar = this.facturasCobrar.filter(f => f.id !== fac.id && f.num !== fac.num);
      this.logBitacora('anulacion', `Factura ${fac.num} anulada. Motivo: "${fac.anulada_motivo}"`, true);
      this.notif(`Factura ${fac.num} anulada y existencias devueltas al inventario`, 'warning');
      return true;
    },

    // Presupuestos
    guardarPresupuesto(datos) {
      const correlativo = String(this.presupuestos.length + 1).padStart(5, '0');
      const num = `PRE-2026-${correlativo}`;
      const nuevo = {
        id: Date.now(),
        num,
        empresa: this.empresa,
        cliente: datos.cliente || 'CLIENTE MOSTRADOR',
        cliente_id: datos.cliente_id,
        vendedor: this.usuarioNombre,
        fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
        fecha_raw: new Date().toISOString(),
        vence: new Date(Date.now() + (45 * 86400000)).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
        total: datos.total || this.totalCarritoUSD,
        estado: 'activo',
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
      pre.estado = 'convertido';
      this.cambiarVista('facturacion');
      this.notif(`Cotización ${pre.num} cargada al carrito para emitir factura`, 'success');
    },

    // Cobros y Abonos
    registrarCobro(facturaId, montoUSD, metodo = 'dolar_efectivo') {
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
      fac.abonado = Math.min(fac.total, (fac.abonado || 0) + abono);
      fac.saldo_pendiente = Math.max(0, fac.total - fac.abonado);
      if (fac.saldo_pendiente <= 0.01) {
        fac.estado = 'pagada';
        this.facturasCobrar = this.facturasCobrar.filter(f => f.id !== fac.id);
        this.notif(`Factura ${fac.num} cancelada en su totalidad`, 'success');
      } else {
        fac.estado = 'parcial';
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
