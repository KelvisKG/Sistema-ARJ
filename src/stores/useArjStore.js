// =====================================================================
// ARJ - Store Central Pinia (Vue 3)
//
// Reglas de esta capa:
//   · La sesión, el rol y la empresa salen del perfil en Supabase (C-05/C-06).
//   · Nada se marca como "guardado" hasta que la base de datos lo confirma.
//   · El dinero se calcula con services/cobros.js (modelo del monolito v13).
// =====================================================================
import { defineStore } from 'pinia';
import * as db from '../services/supabase.js';
import { cargarDatosLocal } from '../services/persistence.js';
import {
  precioConTier, precioBaseItem, costoLanded, sinFob, bcvAVerde, verdeABcv, fmtUSD, dtoDivisaNeutro as _neutro,
  dtoDivisaPct as _pct, dtoDivisaExcedentePct, factorLandedDe, origenDe
} from '../services/pricing.js';
import {
  totalesCarrito, faltaPorPagar, montoParaCompletar, resumenEmision, pagosParaBD, monedaDeMetodo,
  requiereReferencia, calcularAbono
} from '../services/cobros.js';
import { esHoyVE, periodoDe } from '../services/fechas.js';

const carritoVacio = () => ({
  cliente_id: null,
  cliente_nombre: '',
  tier: 'Publico',
  tipo_pago: 'contado',
  dias_credito: 30,
  notas: '',
  descuento_manual: 0,
  descuento_motivo: '',
  pidio_fiscal: false,
  cobrar_verde: null,        // cobro redondo en efectivo (v13.22)
  cotizacion_origen: null,   // { id, num } si viene de una cotización (A-10)
  items: [],
  pagos: []                  // [{ metodo, moneda: 'USD'|'Bs', monto, ref }]
});

const empresaDePerfil = e => (e === 'dist' || e === 'distribuidora') ? 'distribuidora' : (e === 'directa' ? 'directa' : 'ambas');

export const useArjStore = defineStore('arj', {
  state: () => ({
    // Sesión (solo desde Supabase)
    verificandoSesion: true,
    autenticado: false,
    perfil: null,              // fila de `perfiles`
    rol: 'vendedor',
    usuarioNombre: '',
    empresaPermitida: 'ambas', // 'ambas' | 'directa' | 'distribuidora'

    // Empresa activa
    empresa: 'directa',
    empresaDestino: '',
    mostrandoTransicionEmpresa: false,

    vistaActiva: 'facturacion',

    // Tasas (de configuracion). dto_divisa null = brecha del día (C-10)
    tasa_bcv: 0,
    tasa_par: 0,
    tasas_actualizadas: null,
    dto_divisa: null,
    reloj: Date.now(),         // fuerza a reevaluar "confirmadas hoy" al cambiar el día

    // Conectividad
    supabaseConectado: false,
    errorCarga: '',
    cargando: false,
    procesando: false,         // evita doble envío en operaciones de dinero

    // Datos
    configuracion: null,
    sistemas: [],
    productos: [],
    clientes: [],
    todasFacturas: [],
    presupuestos: [],
    movimientos: [],           // kardex visible de la sesión (lo histórico vive en BD)
    movimientosDinero: [],
    embarques: [],
    turnos: [],
    bitacora: [],
    favoritos: [],

    carrito: carritoVacio(),

    toast: { visible: false, mensaje: '', tipo: 'info' },

    busquedaFacturacion: '',
    busquedaInventario: '',
    filtroSistema: '',
    filtroMarca: '',

    // Modales
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
    modalListaPreciosActivo: false,
    modalPresupuestoActivo: false,
    presupuestoSeleccionado: null
  }),

  getters: {
    esGerente: s => s.rol === 'gerente',
    puedeCambiarEmpresa: s => s.empresaPermitida === 'ambas',

    // C-09: confirmación compartida por todas las terminales, en hora de Venezuela
    tasasConfirmadasHoy: s => {
      void s.reloj;
      return !!s.tasas_actualizadas && esHoyVE(s.tasas_actualizadas);
    },
    tasasCargadas: s => s.tasa_bcv > 0 && s.tasa_par > 0,

    estadoTasas: s => ({ tasa_bcv: s.tasa_bcv, tasa_par: s.tasa_par, dto_divisa: s.dto_divisa, cobrar_verde: s.carrito.cobrar_verde }),
    brechaParaleloBCV: s => (s.tasa_bcv > 0 ? s.tasa_par / s.tasa_bcv : 1),
    dtoDivisaNeutro() { return _neutro(this.estadoTasas); },
    dtoDivisaPct() { return _pct(this.estadoTasas); },
    dtoDivisaExcedente() { return dtoDivisaExcedentePct(this.estadoTasas); },

    totales() { return totalesCarrito(this.carrito.items, this.estadoTasas); },
    totalItemsCarrito: s => s.carrito.items.reduce((a, it) => a + (parseInt(it.cant) || 0), 0),
    subtotalCarrito: s => s.carrito.items.reduce((a, it) => a + it.cant * precioBaseItem(it), 0),
    totalCarritoUSD() { return this.totales.subtotal; },
    totalCarritoBs() { return this.totales.totalBs; },
    totalCarritoEfectivoVerde() { return this.totales.totalUsd; },
    faltaPorPagarUSD() { return faltaPorPagar(this.carrito.pagos, this.totales); },
    totalPagadoCarritoUSD() { return Math.max(0, this.totales.subtotal - this.faltaPorPagarUSD); },

    margenCarritoPct() {
      const venta = this.totales.subtotal;
      if (venta <= 0) return 0;
      const costo = this.carrito.items.reduce((a, it) => a + it.cant * costoLanded(it, this.productos), 0);
      return costo > 0 ? Math.round(((venta - costo) / venta) * 100) : 0;
    },

    facturasCobrar: s => s.todasFacturas.filter(f => f.estado !== 'pagada' && f.estado !== 'anulada' && f.saldo_pendiente > 0.009),

    totalDeudaActiva() {
      return this.facturasCobrar.filter(f => f.empresa === this.empresa).reduce((a, f) => a + f.saldo_pendiente, 0);
    },

    ventasRecientes: s => s.todasFacturas.slice(0, 20),
    equipo_ventas: s => (s.configuracion && s.configuracion.equipo) || [],
    metas_hist: s => (s.configuracion && s.configuracion.metas_hist) || {},
    turnoActual: s => s.turnos.find(t => t.estado === 'abierto' && t.usuario_id === (s.perfil && s.perfil.id)) || null
  },

  actions: {
    // ═══════════════ SESIÓN ═══════════════
    async restaurarSesion() {
      this.verificandoSesion = true;
      try {
        const r = await db.obtenerPerfilSesion();
        if (r.ok) {
          this._aplicarPerfil(r.perfil);
          await this.initApp();
        }
      } finally {
        this.verificandoSesion = false;
      }
    },

    async iniciarSesion(email, password) {
      this.cargando = true;
      try {
        const r = await db.iniciarSesion(email, password);
        if (!r.ok) return r;
        this._aplicarPerfil(r.perfil);
        await this.initApp();
        this.logBitacora('sesion', `${this.usuarioNombre} inició sesión como ${this.rol.toUpperCase()}`);
        this.notif(`Bienvenido ${this.usuarioNombre}`, 'success');
        return { ok: true };
      } finally {
        this.cargando = false;
      }
    },

    _aplicarPerfil(perfil) {
      this.perfil = perfil;
      this.rol = perfil.rol === 'gerente' ? 'gerente' : 'vendedor';
      this.usuarioNombre = perfil.nombre_display || 'Usuario';
      this.empresaPermitida = empresaDePerfil(perfil.empresa);
      // A-02: el vendedor entra directo a SU empresa
      this._fijarEmpresa(this.empresaPermitida === 'ambas' ? 'directa' : this.empresaPermitida);
      this.autenticado = true;
    },

    _fijarEmpresa(emp) {
      this.empresa = emp;
      if (typeof document !== 'undefined') {
        document.body.classList.remove('empresa-directa', 'empresa-distribuidora');
        document.body.classList.add(`empresa-${emp}`);
      }
    },

    async logout() {
      if (this.autenticado) this.logBitacora('sesion', `${this.usuarioNombre} cerró sesión`);
      await db.cerrarSesion();
      const tema = localStorage.getItem('arj_tema');
      localStorage.clear();
      if (tema) localStorage.setItem('arj_tema', tema);
      // Recargar la página borra toda la memoria del navegador (igual que el monolito)
      window.location.reload();
    },

    // ═══════════════ CARGA ═══════════════
    async initApp() {
      this.cargando = true;
      try {
        cargarDatosLocal(this);
        const d = await db.cargarDatosCompletos();
        if (!d.conectado) {
          this.supabaseConectado = false;
          this.errorCarga = d.error || 'No se pudo conectar con la base de datos';
          this.notif('Sin conexión con la base de datos: ' + this.errorCarga, 'error');
          return;
        }
        this.errorCarga = '';
        this.productos = d.productos;
        this.clientes = d.clientes;
        this.todasFacturas = d.todasFacturas;
        this.presupuestos = d.presupuestos;
        this.embarques = d.embarques;
        this.sistemas = d.sistemas;
        this.bitacora = d.bitacora;
        this._aplicarConfiguracion(d.configuracion);
        this.supabaseConectado = true;
        this._iniciarRelojYRed();
      } catch (e) {
        console.error('[ARJ] Error inicializando:', e);
        this.supabaseConectado = false;
      } finally {
        this.cargando = false;
      }
    },

    _aplicarConfiguracion(cfg) {
      if (!cfg) return;
      this.configuracion = cfg;
      this.tasa_bcv = cfg.tasa_bcv;
      this.tasa_par = cfg.tasa_par;
      this.tasas_actualizadas = cfg.tasas_actualizadas;
    },

    _iniciarRelojYRed() {
      if (this._escuchando) return;
      this._escuchando = true;
      setInterval(() => { this.reloj = Date.now(); }, 60000);
      window.addEventListener('online', async () => {
        if (!this.autenticado) return;
        this.notif('Conexión recuperada. Actualizando datos...', 'info');
        await this.initApp();
      });
      window.addEventListener('offline', () => {
        this.supabaseConectado = false;
        this.notif('Sin conexión: no se puede facturar, cobrar ni modificar inventario hasta que vuelva.', 'warning');
      });
    },

    // Con `ids` solo se traen esas filas y se reemplazan en la lista (más liviano
    // que bajar todo el catálogo después de cada venta)
    async recargarProductos(ids) {
      try {
        if (!ids || !ids.length) { this.productos = await db.cargarProductos(); return; }
        const nuevos = await db.cargarProductos(ids);
        const set = new Set(ids);
        const porId = new Map(nuevos.map(p => [p.id, p]));
        this.productos = this.productos.filter(p => !set.has(p.id) || porId.has(p.id)).map(p => porId.get(p.id) || p);
      } catch (e) { console.warn('[ARJ] recargar productos:', e); }
    },
    async recargarClientes(ids) {
      try {
        if (!ids || !ids.length) { this.clientes = await db.cargarClientes(); return; }
        const porId = new Map((await db.cargarClientes(ids)).map(c => [c.id, c]));
        this.clientes = this.clientes.map(c => porId.get(c.id) || c);
      } catch (e) { console.warn('[ARJ] recargar clientes:', e); }
    },
    async recargarFacturas() {
      try { this.todasFacturas = await db.cargarFacturasRecientes(); } catch (e) { console.warn('[ARJ] recargar facturas:', e); }
    },
    async recargarCotizaciones() {
      try { this.presupuestos = await db.cargarCotizaciones(); } catch (e) { console.warn('[ARJ] recargar cotizaciones:', e); }
    },
    async recargarEmbarques() {
      try { this.embarques = await db.cargarEmbarques(); } catch (e) { console.warn('[ARJ] recargar embarques:', e); }
    },
    async recargarConfiguracion() {
      try { this._aplicarConfiguracion(await db.cargarConfiguracion()); } catch (e) { console.warn('[ARJ] recargar config:', e); }
    },

    // Guardia común para operaciones que escriben en la BD
    _exigirConexion(accion) {
      if (!this.supabaseConectado || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        this.notif(`❌ ${accion} bloqueado: sin conexión a la base de datos.`, 'error');
        return false;
      }
      return true;
    },
    _exigirGerente(accion) {
      if (this.rol !== 'gerente') {
        this.notif(`Solo el gerente puede ${accion}`, 'error');
        return false;
      }
      return true;
    },

    // ═══════════════ UI ═══════════════
    notif(mensaje, tipo = 'info') {
      this.toast.mensaje = mensaje;
      this.toast.tipo = tipo;
      this.toast.visible = true;
      setTimeout(() => { if (this.toast.mensaje === mensaje) this.toast.visible = false; }, tipo === 'error' ? 7000 : 4000);
    },

    logBitacora(tipo, mensaje, esAlerta = false) {
      const ahora = new Date();
      const reg = {
        id: Date.now() + Math.random(),
        fecha: ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        fecha_completa: ahora.toLocaleDateString('es-VE') + ' ' + ahora.toLocaleTimeString('es-VE'),
        tipo,
        usuario: this.usuarioNombre,
        empresa: this.empresa,
        mensaje,
        esAlerta
      };
      this.bitacora.unshift(reg);
      if (this.autenticado && tipo !== 'sistema') db.guardarBitacoraEnSupabase(reg);
    },

    cambiarVista(vista) {
      const soloGerente = ['movimientos', 'reportes', 'alertas', 'bitacora', 'exportar', 'config'];
      if (soloGerente.includes(vista) && this.rol !== 'gerente') {
        this.notif('Esa sección es solo para el gerente', 'error');
        return;
      }
      this.vistaActiva = vista;
    },

    // ═══════════════ EMPRESA (A-02) ═══════════════
    cambiarEmpresa(emp) {
      if (emp !== 'directa' && emp !== 'distribuidora') return;
      if (emp === this.empresa) return;
      if (!this.puedeCambiarEmpresa) {
        this.notif('Tu usuario solo opera en ' + (this.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora'), 'error');
        return;
      }
      if (this.carrito.items.length > 0 || this.carrito.pagos.length > 0) {
        this.notif('Vacía la factura en curso antes de cambiar de empresa', 'warning');
        return;
      }
      this.empresaDestino = emp;
      this.mostrandoTransicionEmpresa = true;
      setTimeout(() => {
        this._fijarEmpresa(emp);
        this.carrito.tier = 'Publico';
        this.carrito.descuento_manual = 0;
        this.carrito.descuento_motivo = '';
        if (emp === 'distribuidora' && this.carrito.cliente_id) {
          const cli = this.clientes.find(c => c.id === this.carrito.cliente_id);
          if (cli && cli.nivel) this.carrito.tier = cli.nivel;
        }
        this.actualizarPreciosCarrito();
        this.logBitacora('empresa', `Cambio a ${emp === 'directa' ? 'ARJ Venta Directa' : 'Distribuidora ARJ'}`);
      }, 400);
      setTimeout(() => { this.mostrandoTransicionEmpresa = false; }, 1450);
    },

    // ═══════════════ TASAS (C-09) ═══════════════
    async confirmarTasas(bcv = this.tasa_bcv, par = this.tasa_par) {
      if (!this._exigirGerente('confirmar las tasas')) return false;
      if (!this._exigirConexion('Confirmar tasas')) return false;
      const b = parseFloat(bcv), p = parseFloat(par);
      if (!(b > 0) || !(p > 0)) { this.notif('Las tasas deben ser números mayores que cero', 'error'); return false; }
      if (b > p) { this.notif('El BCV quedó por encima del paralelo. Revisa: normalmente es al revés.', 'error'); return false; }
      const r = await db.confirmarTasasBD(b, p);
      if (!r.ok) { this.notif('No se guardaron las tasas: ' + r.error, 'error'); return false; }
      this.tasa_bcv = b;
      this.tasa_par = p;
      this.tasas_actualizadas = r.tasas_actualizadas;
      if (this.configuracion) Object.assign(this.configuracion, { tasa_bcv: b, tasa_par: p, tasas_actualizadas: r.tasas_actualizadas });
      this.dto_divisa = null;
      this.logBitacora('precio', `Confirmó tasas: BCV Bs.${b} · Paralelo Bs.${p}`, true);
      this.notif('Tasas confirmadas. Las facturas ya emitidas mantienen su tasa congelada.', 'success');
      return true;
    },

    fijarDtoDivisa(pct) {
      if (!this._exigirGerente('ajustar el descuento por divisas')) return;
      this.dto_divisa = pct;
      const ex = this.dtoDivisaExcedente;
      this.logBitacora('precio', `Descuento por divisas ajustado a ${Number(pct).toFixed(1)}%` +
        (ex > 0.001 ? ` (${ex.toFixed(1)} pts por encima de la brecha)` : ' (conversión a la brecha)'), ex > 0.001);
      this.actualizarVerdesCarrito();
    },

    // ═══════════════ CARRITO ═══════════════
    agregarAlCarrito(prod, cant = 1) {
      const n = Math.max(1, parseInt(cant) || 1);
      const stock = this.empresa === 'directa' ? (prod.stock_vd || 0) : (prod.stock_dist || 0);
      const idx = this.carrito.items.findIndex(it => it.id === prod.id);
      if (idx !== -1) {
        const item = this.carrito.items[idx];
        item.cant += n;
        if (item.cant > stock) this.notif(`'${prod.desc}' supera el stock disponible (${stock}). Se registrará como préstamo inter-empresa.`, 'warning');
        return;
      }
      const item = {
        id: prod.id,
        cod_alt: prod.cod_alt,
        cod_orig: prod.cod_orig,
        desc: prod.desc,
        marca: prod.marca,
        fob: prod.fob,
        precio_manual: prod.precio_manual,
        stock_vd: prod.stock_vd,
        stock_dist: prod.stock_dist,
        factor_landed: prod.factor_landed,
        origen: prod.origen,
        cant: n,
        precio: 0,
        precio_base: 0,
        precio_fijo: false,
        modo_verde: false,
        precio_verde: 0
      };
      this._preciarItem(item);
      this.carrito.items.push(item);
      if (n > stock) this.notif(`'${prod.desc}' supera el stock (${stock}). Se registrará como préstamo inter-empresa.`, 'warning');
    },

    // Una sola ruta de precios (v13.9): descuento manual > precio congelado > tier
    _preciarItem(it) {
      const dto = (this.empresa === 'directa' && this.carrito.descuento_manual > 0) ? this.carrito.descuento_manual : 0;
      if (dto > 0) {
        it.precio = Math.round(precioBaseItem(it) * (1 - dto / 100) * 100) / 100;
      } else if (it.precio_fijo) {
        it.precio = precioBaseItem(it);
      } else {
        it.precio = precioConTier(it.fob, this.carrito.tier || 'Publico', it);
        it.precio_base = it.precio;
      }
      it.precio_verde = bcvAVerde(it.precio, this.estadoTasas);
    },

    actualizarPreciosCarrito() {
      this.carrito.items.forEach(it => this._preciarItem(it));
    },
    actualizarVerdesCarrito() {
      this.carrito.items.forEach(it => { it.precio_verde = bcvAVerde(it.precio, this.estadoTasas); });
    },

    removerDelCarrito(index) {
      if (index >= 0 && index < this.carrito.items.length) this.carrito.items.splice(index, 1);
    },

    actualizarCantCarrito(index, cant) {
      const item = this.carrito.items[index];
      if (!item) return;
      const prod = this.productos.find(p => p.id === item.id);
      const stock = prod ? (this.empresa === 'directa' ? prod.stock_vd : prod.stock_dist) : 0;
      item.cant = Math.max(1, parseInt(cant) || 1);
      if (item.cant > stock) this.notif(`Cantidad (${item.cant}) supera el stock (${stock}). Préstamo inter-empresa.`, 'warning');
    },

    toggleModoVerdeItem(index) {
      if (!this._exigirGerente('modificar precios')) return;
      const it = this.carrito.items[index];
      if (!it) return;
      it.modo_verde = !it.modo_verde;
      it.precio_verde = bcvAVerde(it.precio, this.estadoTasas);
    },

    cambiarPrecioVerdeItem(index, valorVerde) {
      if (!this._exigirGerente('modificar precios')) return;
      const it = this.carrito.items[index];
      if (!it) return;
      const v = parseFloat(valorVerde) || 0;
      if (v <= 0) { this.notif('Precio inválido', 'error'); return; }
      const ant = it.precio;
      it.precio = verdeABcv(v, this.estadoTasas);
      it.precio_verde = v;
      it.precio_fijo = true;  // v13.23: no lo pisa un cambio de tier o cliente
      it.precio_base = it.precio;
      this.logBitacora('precio', `Precio de '${it.desc}' fijado en ${fmtUSD(v)} efectivo (${fmtUSD(ant)} → ${fmtUSD(it.precio)} BCV)`, true);
    },

    // A-01: solo el gerente cambia el nivel de precio, en ambas empresas
    cambiarTier(nuevoTier) {
      if (!this._exigirGerente('cambiar el nivel de precio')) return;
      if (this.empresa === 'directa' && nuevoTier !== 'Publico') {
        this.notif('En Venta Directa siempre se cobra precio público. Usa el descuento manual.', 'warning');
        return;
      }
      this.carrito.tier = nuevoTier;
      this.actualizarPreciosCarrito();
    },

    aplicarDescuentoManual(pct, motivo) {
      if (!this._exigirGerente('aplicar descuentos manuales')) return;
      if (this.empresa !== 'directa') { this.notif('El descuento manual es solo para Venta Directa', 'error'); return; }
      const p = parseFloat(pct) || 0;
      if (p < 0 || p > 50) { this.notif('El descuento debe estar entre 0% y 50%', 'error'); return; }
      if (p > 0 && !(motivo || '').trim()) { this.notif('Indica el motivo del descuento', 'error'); return; }
      this.carrito.descuento_manual = p;
      this.carrito.descuento_motivo = p > 0 ? motivo.trim() : '';
      this.actualizarPreciosCarrito();
      if (p > 0) this.logBitacora('precio', `Descuento manual ${p}% a ${this.carrito.cliente_nombre || 'cliente'} — motivo: "${motivo}"`, true);
      this.notif(p > 0 ? `Descuento de ${p}% aplicado` : 'Descuento manual retirado', 'success');
    },

    seleccionarCliente(cli) {
      if (!cli) {
        this.carrito.cliente_id = null;
        this.carrito.cliente_nombre = '';
        return;
      }
      const esOtroCliente = this.carrito.cliente_id !== cli.id;
      this.carrito.cliente_id = cli.id;
      this.carrito.cliente_nombre = cli.nombre;
      if (this.empresa === 'directa') {
        // En Venta Directa SIEMPRE precio público; el descuento manual se reinicia
        this.carrito.tier = 'Publico';
        this.carrito.descuento_manual = 0;
        this.carrito.descuento_motivo = '';
      } else {
        this.carrito.tier = cli.nivel || 'Publico';
      }
      // El término habitual del cliente solo se propone al cambiar de cliente; no pisa
      // lo que el cajero ya eligió para este mismo cliente
      if (esOtroCliente) this.carrito.tipo_pago = cli.tipo === 'credito' ? 'credito' : 'contado';
      this.actualizarPreciosCarrito();
    },

    // ═══════════════ PAGOS (C-03) ═══════════════
    agregarPagoCarrito({ metodo, monto, ref = '' }) {
      const m = parseFloat(monto) || 0;
      if (m <= 0) { this.notif('Monto de pago inválido', 'error'); return false; }
      this.carrito.pagos.push({ metodo, moneda: monedaDeMetodo(metodo), monto: Math.round(m * 100) / 100, ref: (ref || '').trim() });
      return true;
    },
    removerPagoCarrito(idx) {
      if (idx >= 0 && idx < this.carrito.pagos.length) this.carrito.pagos.splice(idx, 1);
    },
    montoCompletarPago(idx) {
      return montoParaCompletar(this.carrito.pagos, idx, this.totales);
    },

    // v13.22 cobro redondo en efectivo (solo gerente)
    fijarCobrarVerde(valor) {
      if (!this._exigirGerente('ajustar el cobro en efectivo')) return;
      const n = parseFloat(valor);
      this.carrito.cobrar_verde = (Number.isFinite(n) && n > 0) ? Math.round(n * 100) / 100 : null;
    },
    redondearCobrarVerde() {
      if (!this._exigirGerente('ajustar el cobro en efectivo')) return;
      const objetivo = Math.round(this.totales.totalUsdBase);
      this.carrito.cobrar_verde = objetivo > 0 ? objetivo : null;
    },

    limpiarCarrito() {
      this.carrito = carritoVacio();
      this.dto_divisa = null; // v13.12: la siguiente factura vuelve a la brecha del día
    },

    // ═══════════════ EMISIÓN ═══════════════
    validarEmision() {
      const c = this.carrito;
      if (!this.supabaseConectado) return 'Sin conexión a la base de datos. No se permite facturar offline.';
      if (c.items.length === 0) return 'El carrito está vacío.';
      if (!c.cliente_id) return 'Selecciona un cliente registrado antes de emitir.';
      if (!this.tasasCargadas) return 'Faltan las tasas de cambio (BCV y paralelo).';
      if (!this.tasasConfirmadasHoy) return 'Las tasas no se han confirmado hoy. El gerente debe confirmarlas antes de facturar.';
      const sinCosto = c.items.filter(sinFob);
      if (sinCosto.length) return `${sinCosto.length} producto(s) sin costo FOB: ${sinCosto.map(i => i.cod_alt).join(', ')}`;
      const sinDesc = c.items.filter(it => !it.desc || !String(it.desc).trim());
      if (sinDesc.length) return `Hay ${sinDesc.length} renglón(es) sin descripción.`;
      if (c.descuento_manual > 0 && this.rol !== 'gerente') return 'Solo el gerente puede aplicar descuentos manuales.';
      const sinRef = c.pagos.filter(p => requiereReferencia(p.metodo) && !p.ref);
      if (sinRef.length) return `Falta la referencia del pago (${sinRef.map(p => p.metodo).join(', ')}).`;
      if (c.tipo_pago === 'contado' && this.faltaPorPagarUSD > 1) {
        return `Los pagos no cubren el total. Faltan ${fmtUSD(this.faltaPorPagarUSD)}.`;
      }
      return null;
    },

    async emitirFactura() {
      if (this.procesando) return { ok: false, error: 'Ya hay una emisión en curso' };
      const err = this.validarEmision();
      if (err) { this.notif('Emisión bloqueada: ' + err, 'error'); return { ok: false, error: err }; }

      const c = this.carrito;
      const cli = this.clientes.find(x => x.id === c.cliente_id);
      if (!cli) return { ok: false, error: 'El cliente no existe en la base de datos' };

      const descManual = (this.empresa === 'directa' && c.descuento_manual > 0)
        ? Math.round(c.items.reduce((a, it) => a + it.cant * (precioBaseItem(it) - it.precio), 0) * 100) / 100
        : 0;
      const r = resumenEmision({
        items: c.items, pagos: c.pagos, tipoPago: c.tipo_pago, estado: this.estadoTasas,
        descManual, motivoManual: descManual > 0 ? `Descuento manual ${c.descuento_manual}%: ${c.descuento_motivo}` : ''
      });

      const factura = {
        empresa: this.empresa,
        cliente_id: cli.id,
        cliente_nombre: cli.nombre,
        // A-03: snapshot fiscal tal como estaba el cliente al emitir
        cliente_nombre_snap: cli.nombre || '',
        cliente_rif_snap: cli.rif || '',
        cliente_tel_snap: cli.tel || '',
        cliente_dir_snap: cli.direccion || '',
        subtotal_usd: Math.round(r.subtotal * 100) / 100,
        saldo_pendiente: r.saldoIni,
        estado: r.estadoFactura,
        tipo_pago: c.tipo_pago,
        dias_credito: c.tipo_pago === 'credito' ? (parseInt(c.dias_credito) || 30) : 0,
        tasa_par: this.tasa_par,
        tasa_bcv: this.tasa_bcv,
        factor_bs: r.factorBs,
        descuento_manual: r.descuentoTotal,
        descuento_manual_pct: c.descuento_manual || 0,
        motivo_descuento: r.motivo,
        pidio_fiscal: !!c.pidio_fiscal,
        cobrar_verde: r.cobrarVerde,
        cotizacion_id: c.cotizacion_origen ? c.cotizacion_origen.id : null
      };
      const items = c.items.map(it => ({
        producto_id: it.id,
        cod_alt: it.cod_alt,
        descripcion: it.desc,
        cantidad: it.cant,
        fob_unitario: it.fob || 0,
        precio_unitario: it.precio,
        total_linea: Math.round(it.cant * it.precio * 100) / 100,
        tier: c.tier || 'Publico',
        factor_landed: factorLandedDe(it, this.productos),  // se congela (no se reescribe la utilidad)
        origen: origenDe(it, this.productos)
      }));
      const pagos = pagosParaBD(c.pagos, this.estadoTasas, this.usuarioNombre);

      this.procesando = true;
      try {
        const res = await db.emitirFacturaBD(factura, items, pagos);
        if (!res.ok) {
          this.notif('❌ La factura NO se emitió: ' + res.error, 'error');
          this.logBitacora('error', `Emisión rechazada: ${res.error}`, true);
          return { ok: false, error: res.error };
        }
        const fac = db.mapFactura(res.data);
        fac.items = c.items.map(it => ({ ...it }));
        fac.pagos = pagos;
        this.todasFacturas.unshift(fac);
        if (c.cotizacion_origen) {
          const cot = this.presupuestos.find(p => p.id === c.cotizacion_origen.id);
          if (cot) cot.estado = 'convertida';
        }
        this.logBitacora('factura', `Emitió ${fac.num} a ${fac.cliente} — ${fmtUSD(fac.total)}`);
        this.facturaReciente = fac;
        this.modalFacturaActivo = true;
        const fiscal = c.pidio_fiscal;
        this.limpiarCarrito();
        await Promise.all([this.recargarProductos(c.items.map(i => i.id)), this.recargarClientes([cli.id])]);
        this.notif(`✓ Factura ${fac.num} emitida`, 'success');
        if (fiscal) setTimeout(() => this.notif('📋 Recordatorio: el cliente pidió factura fiscal', 'warning'), 2000);
        return { ok: true, factura: fac };
      } finally {
        this.procesando = false;
      }
    },

    // ═══════════════ ANULACIÓN ═══════════════
    async anularFactura(facturaId, motivo) {
      if (!this._exigirGerente('anular facturas')) return false;
      if (!this._exigirConexion('Anulación')) return false;
      if (!(motivo || '').trim()) { this.notif('El motivo es obligatorio', 'error'); return false; }
      const fac = this.todasFacturas.find(f => f.id === facturaId);
      if (!fac) { this.notif('Factura no encontrada', 'error'); return false; }
      this.procesando = true;
      try {
        const r = await db.anularFacturaBD(fac.id, motivo.trim());
        if (!r.ok) { this.notif('❌ No se anuló: ' + r.error, 'error'); return false; }
        const nueva = await db.cargarFactura(fac.id);
        if (nueva) Object.assign(fac, nueva);
        this.logBitacora('anulacion', `Anuló ${fac.num}. Motivo: "${motivo}"`, true);
        await Promise.all([this.recargarProductos(), this.recargarClientes()]);
        this.notif(`Factura ${fac.num} anulada y existencias devueltas`, 'warning');
        return true;
      } finally {
        this.procesando = false;
      }
    },

    // ═══════════════ COBROS CxC (C-04) ═══════════════
    async registrarCobro(facturaId, { montoIn, moneda, modo, metodo, ref }) {
      if (!this._exigirConexion('Cobro')) return { ok: false };
      if (this.procesando) return { ok: false, error: 'Ya hay un cobro en curso' };
      const fac = this.todasFacturas.find(f => f.id === facturaId);
      if (!fac) return { ok: false, error: 'Factura no encontrada' };
      if (requiereReferencia(metodo) && !(ref || '').trim()) return { ok: false, error: 'La referencia es obligatoria para ' + metodo };
      if (!this.tasasCargadas) return { ok: false, error: 'Faltan las tasas de cambio' };
      // Igual que al emitir: el servidor (sql/08) valora lo entregado con las tasas del día
      if (!this.tasasConfirmadasHoy) return { ok: false, error: 'Las tasas no se han confirmado hoy. El gerente debe confirmarlas antes de cobrar.' };

      const calc = calcularAbono({ f: fac, montoIn, moneda, modo, estado: this.estadoTasas });
      if (!calc.ok) return calc;
      const pago = {
        monto_usd: calc.entregado.verde,
        monto_bs: calc.entregado.bs,
        tasa_usada: calc.entregado.tasa,
        metodo,
        referencia: (ref || '').trim()
      };
      this.procesando = true;
      try {
        const r = await db.registrarAbonoBD(fac.id, calc.acreditaUSD, pago);
        if (!r.ok) return { ok: false, error: r.error };
        fac.saldo_pendiente = r.saldo_pendiente;
        fac.estado = r.estado;
        fac.estado_bd = r.estado;
        fac.abonado = Math.max(0, fac.total - r.saldo_pendiente);
        if (fac.cliente_id) await this.recargarClientes([fac.cliente_id]);
        this.logBitacora('cobro', `Abono ${fmtUSD(calc.acreditaUSD)} a ${fac.num} (${metodo}). Saldo: ${fmtUSD(r.saldo_pendiente)}`);
        return { ok: true, acreditaUSD: calc.acreditaUSD, saldo: r.saldo_pendiente };
      } finally {
        this.procesando = false;
      }
    },

    // ═══════════════ COTIZACIONES (A-10) ═══════════════
    async guardarPresupuesto({ cliente_id, cliente, items, tier }) {
      if (!this._exigirConexion('Guardar cotización')) return null;
      if (!items || !items.length) { this.notif('La cotización no tiene productos', 'error'); return null; }
      const r = await db.guardarCotizacionBD(
        { empresa: this.empresa, cliente_id: cliente_id || null, cliente_nombre: cliente || 'CLIENTE MOSTRADOR', tasa_bcv: this.tasa_bcv, tasa_par: this.tasa_par },
        items.map(it => ({
          producto_id: it.id, cod_alt: it.cod_alt, descripcion: it.desc, cantidad: it.cant,
          fob_unitario: it.fob || 0, precio_unitario: it.precio, tier: tier || 'Publico'
        }))
      );
      if (!r.ok) { this.notif('No se guardó la cotización: ' + r.error, 'error'); return null; }
      await this.recargarCotizaciones();
      this.logBitacora('presupuesto', `Cotización ${r.numero} para ${cliente || 'mostrador'} por ${fmtUSD(r.total)}`);
      this.notif(`Cotización ${r.numero} guardada (vigencia 45 días)`, 'success');
      return this.presupuestos.find(p => p.id === r.id) || null;
    },

    async rechazarPresupuesto(id) {
      const r = await db.cambiarEstadoCotizacionBD(id, 'rechazada');
      if (!r.ok) { this.notif('No se pudo rechazar: ' + r.error, 'error'); return false; }
      const p = this.presupuestos.find(x => x.id === id);
      if (p) p.estado = 'rechazada';
      return true;
    },

    // Carga la cotización al carrito con los precios COTIZADOS congelados.
    // Se marca 'convertida' solo cuando la factura se emite (en la BD).
    convertirPresupuestoEnVenta(preId) {
      const pre = this.presupuestos.find(p => p.id === preId);
      if (!pre) return;
      if (pre.empresa !== this.empresa) {
        this.notif(`Esa cotización es de ${pre.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora'}. Cambia de empresa primero.`, 'warning');
        return;
      }
      if (['convertida', 'rechazada', 'vencida'].includes(pre.estado)) {
        this.notif(`La cotización está ${pre.estado}`, 'warning');
        return;
      }
      this.limpiarCarrito();
      const cli = this.clientes.find(c => c.id === pre.cliente_id);
      if (cli) this.seleccionarCliente(cli);
      const faltan = [];
      pre.items.forEach(it => {
        const prod = this.productos.find(p => p.id === it.id || p.cod_alt === it.cod_alt);
        if (!prod) { faltan.push(it.cod_alt); return; }
        this.agregarAlCarrito(prod, it.cant);
        const linea = this.carrito.items.find(x => x.id === prod.id);
        if (linea && it.precio > 0) {
          linea.precio_fijo = true;
          linea.precio_base = it.precio;
          this._preciarItem(linea);
        }
      });
      this.carrito.cotizacion_origen = { id: pre.id, num: pre.num };
      this.vistaActiva = 'facturacion';
      if (faltan.length) this.notif(`No están en el catálogo: ${faltan.join(', ')}`, 'warning');
      else this.notif(`Cotización ${pre.num} cargada con sus precios cotizados`, 'success');
    },

    // ═══════════════ CLIENTES (C-02) ═══════════════
    async crearCliente(datos) {
      if (!this._exigirConexion('Crear cliente')) return null;
      const r = await db.crearClienteBD(datos);
      if (!r.ok) { this.notif('❌ El cliente NO se guardó: ' + r.error, 'error'); return null; }
      this.clientes.unshift(r.cliente);
      this.clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));
      this.logBitacora('cliente', `Registró cliente ${r.cliente.nombre}`);
      this.notif(`Cliente ${r.cliente.nombre} registrado`, 'success');
      return r.cliente;
    },

    async actualizarCliente(id, datos) {
      if (!this._exigirConexion('Actualizar cliente')) return false;
      const actual = this.clientes.find(c => c.id === id);
      if (datos.nivel && actual && datos.nivel !== actual.nivel && this.rol !== 'gerente') {
        this.notif('Solo el gerente puede cambiar el nivel de precio de un cliente', 'error');
        return false;
      }
      const r = await db.actualizarClienteBD(id, datos);
      if (!r.ok) { this.notif('❌ No se actualizó: ' + r.error, 'error'); return false; }
      await this.recargarClientes([id]);
      this.logBitacora('cliente', `Actualizó cliente ${datos.nombre}`);
      this.notif('Cliente actualizado', 'success');
      return true;
    },

    // ═══════════════ INVENTARIO (C-01) ═══════════════
    async guardarProducto(datos) {
      if (!this._exigirGerente('editar productos')) return false;
      if (!this._exigirConexion('Guardar producto')) return false;
      // Al editar se manda también el stock que se vio al abrir: el servidor solo lo
      // cambia si el gerente lo modificó y nadie lo movió mientras tanto
      const original = datos.id ? this.productos.find(p => p.id === datos.id) : null;
      const r = await db.guardarProductoBD({
        id: datos.id || null, cod_alt: datos.cod_alt, cod_orig: datos.cod_orig, cod_barras: datos.cod_barras,
        descripcion: datos.desc, marca: datos.marca, fob: datos.fob, stock_vd: datos.stock_vd, stock_dist: datos.stock_dist,
        stock_vd_original: datos.stock_vd_original ?? (original ? original.stock_vd : null),
        stock_dist_original: datos.stock_dist_original ?? (original ? original.stock_dist : null),
        marca_modelo: datos.marca_modelo, sistema: datos.sistema, precio_manual: datos.precio_manual || null,
        origen: datos.origen, factor_landed: datos.factor_landed, proveedor: datos.proveedor
      });
      if (!r.ok) { this.notif('❌ No se guardó el producto: ' + r.error, 'error'); return false; }
      await (datos.id ? this.recargarProductos([datos.id]) : this.recargarProductos());
      this.logBitacora('producto', `${datos.id ? 'Editó' : 'Creó'} producto ${datos.cod_alt}`, true);
      this.notif(`Producto ${datos.cod_alt} guardado`, 'success');
      return true;
    },

    async desactivarProducto(prod) {
      if (!this._exigirGerente('dar de baja productos')) return false;
      if (!this._exigirConexion('Baja de producto')) return false;
      const r = await db.desactivarProductoBD(prod.id);
      if (!r.ok) { this.notif('No se dio de baja: ' + r.error, 'error'); return false; }
      await this.recargarProductos();
      this.logBitacora('producto', `Dio de baja ${prod.cod_alt} (${prod.desc})`, true);
      this.notif(`${prod.cod_alt} dado de baja`, 'success');
      return true;
    },

    // items: [{ producto_id, cantidad }]
    async ejecutarTraspaso(items, referencia) {
      if (!this._exigirGerente('hacer traspasos')) return null;
      if (!this._exigirConexion('Traspaso')) return null;
      const r = await db.aplicarTraspasoBD(items, referencia);
      if (!r.ok) { this.notif('❌ Traspaso NO aplicado: ' + r.error, 'error'); return null; }
      await this.recargarProductos(items.map(i => i.producto_id));
      this._kardex('traspaso', `Nota ${r.numero}: ${r.renglones} renglón(es), ${r.unidades} ud Dist → VD`, r.unidades);
      this.logBitacora('traspaso', `Traspaso ${r.numero}: ${r.unidades} ud (${r.renglones} renglones) Dist → VD`, true);
      this.notif(`Traspaso aplicado · Nota ${r.numero}`, 'success');
      return r;
    },

    async aplicarRecepcion(args) {
      if (!this._exigirGerente('registrar recepciones y conteos')) return null;
      if (!this._exigirConexion('Recepción')) return null;
      const r = await db.aplicarRecepcionBD(args);
      if (!r.ok) { this.notif('❌ NO se aplicó: ' + r.error, 'error'); return null; }
      await this.recargarProductos((args.items || []).map(i => i.producto_id));
      this._kardex(args.tipo === 'conteo' ? 'ajuste' : 'entrada', `${r.numero}${args.referencia ? ' — ' + args.referencia : ''}`, r.unidades);
      this.logBitacora('inventario', `${args.tipo === 'conteo' ? 'Conteo físico' : 'Recepción'} ${r.numero}: ${r.renglones} productos, ${r.unidades} ud` +
        (r.sellados ? ` · ${r.sellados} sellados` : '') + (r.conflictos && r.conflictos.length ? ` · ${r.conflictos.length} en conflicto de embarque` : ''), true);
      return r;
    },

    // Ajuste puntual de stock = conteo físico de un producto
    // Ajuste relativo: el servidor suma/resta sobre el stock ACTUAL de la BD, así no
    // se pierden ventas hechas desde otra caja mientras esta pantalla estaba abierta
    async ajustarStock(prod, tipo, cant, motivo) {
      const delta = tipo === 'entrada' ? cant : -cant;
      return this.aplicarRecepcion({
        tipo: 'conteo', destino: this.empresa === 'directa' ? 'directa' : 'dist', embarqueId: null,
        referencia: 'Ajuste manual: ' + motivo, items: [{ producto_id: prod.id, delta }], noContados: []
      });
    },

    async guardarEmbarque(datos) {
      if (!this._exigirGerente('gestionar embarques')) return false;
      if (!this._exigirConexion('Guardar embarque')) return false;
      const r = await db.guardarEmbarqueBD(datos);
      if (!r.ok) { this.notif('No se guardó el embarque: ' + r.error, 'error'); return false; }
      await this.recargarEmbarques();
      this.logBitacora('inventario', `${datos.id ? 'Editó' : 'Creó'} embarque ${r.data.codigo} — factor ${Number(r.data.factor).toFixed(4)}`, true);
      this.notif(`Embarque ${r.data.codigo} guardado (factor ${Number(r.data.factor).toFixed(4)})`, 'success');
      return true;
    },

    async recalcularEmbarque(emb) {
      if (!this._exigirGerente('recalcular costos')) return false;
      const r = await db.recalcularEmbarqueBD(emb.id);
      if (!r.ok) { this.notif('No se recalculó: ' + r.error, 'error'); return false; }
      await this.recargarProductos();
      this.logBitacora('inventario', `Recalculó ${r.actualizados} producto(s) de ${emb.codigo} a factor ${Number(r.factor).toFixed(4)}`, true);
      this.notif(`${r.actualizados} producto(s) recalculados`, 'success');
      return true;
    },

    _kardex(tipo, motivo, cant) {
      this.movimientos.unshift({
        id: Date.now() + Math.random(),
        fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
        tipo, producto: '', cod_alt: '', cant, empresa: this.empresa, motivo, usuario: this.usuarioNombre
      });
    },

    // ═══════════════ CONFIGURACIÓN (A-07, A-08) ═══════════════
    async actualizarConfiguracion(campos, descripcion) {
      if (!this._exigirGerente('cambiar la configuración')) return false;
      if (!this._exigirConexion('Guardar configuración')) return false;
      const r = await db.actualizarConfiguracionBD(campos);
      if (!r.ok) { this.notif('No se guardó: ' + r.error, 'error'); return false; }
      await this.recargarConfiguracion();
      if (descripcion) this.logBitacora('config', descripcion, true);
      return true;
    },

    costosFijosDe(periodo) {
      const cfg = this.configuracion;
      if (!cfg) return 0;
      const h = cfg.costos_fijos_hist || {};
      if (h[periodo] != null) return parseFloat(h[periodo]) || 0;
      // Hereda el último período anterior registrado; si no hay, el valor base
      const anteriores = Object.keys(h).filter(k => k < periodo).sort();
      return anteriores.length ? (parseFloat(h[anteriores[anteriores.length - 1]]) || 0) : (cfg.costos_fijos_mes || 0);
    },
    periodoActual() { return periodoDe(new Date()); },

    // ═══════════════ TURNOS DE CAJA (M-07) ═══════════════
    abrirTurno(inicialUSD, inicialBs) {
      if (this.turnoActual) { this.notif('Ya tienes un turno abierto', 'warning'); return; }
      const t = {
        id: Date.now(),
        usuario_id: this.perfil.id,
        cajero: this.usuarioNombre,
        empresa: this.empresa,
        apertura_iso: new Date().toISOString(),
        fecha_apertura: new Date().toLocaleString('es-VE'),
        fecha_cierre: null,
        inicial_usd: parseFloat(inicialUSD) || 0,
        inicial_bs: parseFloat(inicialBs) || 0,
        estado: 'abierto'
      };
      this.turnos.unshift(t);
      this.logBitacora('caja', `Abrió turno con ${fmtUSD(t.inicial_usd)} + Bs.${t.inicial_bs}`);
      this.notif('Turno de caja abierto', 'success');
    },

    // Efectivo cobrado por este usuario desde la apertura (de la BD)
    async esperadoTurno() {
      const t = this.turnoActual;
      if (!t) return null;
      const pagos = await db.cargarPagosDesde(t.apertura_iso, this.usuarioNombre);
      let usd = 0, bs = 0;
      pagos.forEach(p => {
        if (/^efectivo usd$/i.test(p.metodo || '')) usd += parseFloat(p.monto_usd) || 0;
        else if (/^efectivo bs/i.test(p.metodo || '')) bs += parseFloat(p.monto_bs) || 0;
      });
      return {
        ventas_usd: Math.round(usd * 100) / 100,
        ventas_bs: Math.round(bs * 100) / 100,
        esperado_usd: Math.round((t.inicial_usd + usd) * 100) / 100,
        esperado_bs: Math.round((t.inicial_bs + bs) * 100) / 100
      };
    },

    cerrarTurno(arqueoUSD, arqueoBs, notas, esperado) {
      const t = this.turnoActual;
      if (!t) return null;
      const realUsd = parseFloat(arqueoUSD) || 0;
      const realBs = parseFloat(arqueoBs) || 0;
      const difUsd = realUsd - (esperado ? esperado.esperado_usd : t.inicial_usd);
      const difBs = realBs - (esperado ? esperado.esperado_bs : t.inicial_bs);
      const dif = difUsd + (this.tasa_bcv > 0 ? difBs / this.tasa_bcv : 0);
      Object.assign(t, {
        fecha_cierre: new Date().toLocaleString('es-VE'),
        arqueo_usd: realUsd, arqueo_bs: realBs, notas_cierre: notas || '',
        ventas_usd: esperado ? esperado.ventas_usd : 0, ventas_bs: esperado ? esperado.ventas_bs : 0,
        esperado_usd: esperado ? esperado.esperado_usd : t.inicial_usd, esperado_bs: esperado ? esperado.esperado_bs : t.inicial_bs,
        diferencia_usd: Math.round(dif * 100) / 100,
        estado: Math.abs(dif) < 0.5 ? 'cerrado' : 'cerrado_dif'
      });
      this.logBitacora('caja', `Cerró turno — diferencia ${fmtUSD(dif)} ${Math.abs(dif) < 0.5 ? '(cuadró)' : '(¡con diferencia!)'}`, Math.abs(dif) >= 0.5);
      this.notif(Math.abs(dif) < 0.5 ? 'Turno cerrado: ¡cuadró!' : `Turno cerrado con diferencia de ${fmtUSD(dif)}`, Math.abs(dif) < 0.5 ? 'success' : 'warning');
      return t;
    }
  }
});
