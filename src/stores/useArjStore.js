// =====================================================================
// ARJ - Store Central Pinia (Vue 3)
// 100% fiel a toda la arquitectura y funcionalidades del Sistema ARJ
// =====================================================================
import { defineStore } from 'pinia';
import { cargarDatosCompletos, guardarFacturaEnSupabase } from '../services/supabase.js';
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

    // Empresa Activa: 'directa' (Venta Directa) | 'distribuidora' (Distribuidora)
    empresa: 'directa',

    // Navegación
    vistaActiva: 'facturacion',

    // Divisas, Tasas y Brecha
    tasa_bcv: 47.80,
    tasa_par: 58.50,
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
    presupuestos: [
      {
        id: 1,
        num: 'PRE-2026-00042',
        empresa: 'directa',
        cliente: 'AGROPECUARIA EL TURPIAL C.A.',
        cliente_id: 201,
        fecha: '02 mar 2026',
        fecha_raw: '2026-03-02T10:00:00.000Z',
        vence: '16 abr 2026',
        total: 820.00,
        estado: 'activo',
        vendedor: 'JJ',
        items: [
          { id: 101, cod_alt: 'BOM-JD-5075', desc: 'Bomba de agua completa con polea John Deere 5075E', cant: 2, precio: 125.00, fob: 48.50 },
          { id: 102, cod_alt: 'EMB-MF-290', desc: 'Kit embrague doble 12" Massey Ferguson 285 / 290', cant: 1, precio: 290.00, fob: 115.00 },
          { id: 103, cod_alt: 'FIL-DON-P550008', desc: 'Filtro de lubricante motor servicio pesado Donaldson', cant: 10, precio: 28.00, fob: 9.20 }
        ]
      }
    ],
    apartados: [],
    notasCredito: [],
    movimientos: [
      {
        id: 1,
        fecha: '28 feb 2026 09:30',
        tipo: 'entrada',
        producto: 'Bomba de agua JD 5075E',
        cod_alt: 'BOM-JD-5075',
        cant: 10,
        empresa: 'directa',
        motivo: 'Recepción embarque EMB-2026-01',
        usuario: 'JJ'
      },
      {
        id: 2,
        fecha: '01 mar 2026 14:15',
        tipo: 'traspaso',
        producto: 'Kit embrague doble MF 290',
        cod_alt: 'EMB-MF-290',
        cant: 4,
        empresa: 'distribuidora -> directa',
        motivo: 'Reposición de stock para mostrador',
        usuario: 'JJ'
      }
    ],
    embarques: [
      {
        id: 'EMB-2026-01',
        proveedor: 'A&I Products USA',
        fecha: '15 ene 2026',
        estado: 'sellado',
        fob_total: 12450.00,
        flete: 1850.00,
        aduana: 2100.00,
        pct_divisas: 25.0,
        factor_landed: 1.471,
        items_count: 42
      }
    ],
    turnos: [
      {
        id: 1,
        cajero: 'JJ',
        fecha_apertura: '11 sep 2026 08:00',
        fecha_cierre: null,
        inicial_usd: 150.00,
        inicial_bs: 2500.00,
        ventas_usd: 850.00,
        ventas_bs: 12400.00,
        estado: 'abierto'
      }
    ],
    turnoActual: {
      id: 1,
      cajero: 'JJ',
      fecha_apertura: '11 sep 2026 08:00',
      inicial_usd: 150.00,
      inicial_bs: 2500.00,
      estado: 'abierto'
    },
    bitacora: [
      {
        id: 1,
        fecha: new Date().toLocaleTimeString('es-VE'),
        tipo: 'sesion',
        usuario: 'JJ',
        mensaje: 'Inicio de sesión en el sistema ARJ',
        esAlerta: false
      }
    ],
    favoritos: ['BOM-JD-5075', 'EMB-MF-290', 'FIL-DON-P550008', 'FIL-RAC-R90P', 'COR-GAT-8PK1420'],

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
    // Inicialización del sistema
    async initApp() {
      this.cargando = true;
      try {
        const datos = await cargarDatosCompletos();
        this.productos = datos.productos;
        this.clientes = datos.clientes;
        this.facturasCobrar = datos.facturasCobrar;
        this.todasFacturas = datos.todasFacturas;
        this.tasa_bcv = datos.tasas.tasa_bcv;
        this.tasa_par = datos.tasas.tasa_par;
        this.dto_divisa = datos.tasas.dto_divisa;
        this.supabaseConectado = datos.conectado;
        this.logBitacora('sistema', 'Sistema ARJ inicializado correctamente');
      } catch (e) {
        console.error('[ARJ Store] Error inicializando:', e);
      } finally {
        this.cargando = false;
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
    },

    // Control de sesión
    login(rol, nombre) {
      this.rol = rol;
      this.usuarioNombre = nombre || (rol === 'gerente' ? 'JJ (Gerente General)' : 'HUMBERTO ARJ (Ventas)');
      this.autenticado = true;
      this.logBitacora('sesion', `Usuario ${this.usuarioNombre} ingresó como ${rol.toUpperCase()}`);
      this.notif(`Bienvenido ${this.usuarioNombre}`, 'success');
    },

    logout() {
      this.logBitacora('sesion', `Usuario ${this.usuarioNombre} cerró sesión`);
      this.autenticado = false;
      this.limpiarCarrito();
      this.notif('Sesión cerrada correctamente', 'info');
    },

    // Cambio de empresa (Directa vs Distribuidora)
    cambiarEmpresa(emp) {
      if (emp !== 'directa' && emp !== 'distribuidora') return;
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
