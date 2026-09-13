// === Global State & Enums ===
    // ═══════════════════════════════════════════════════════════════
    // v13.2: el catalogo demo se elimino. PRODUCTOS se llena SOLO desde
    // Supabase en cargarDatosSupabase(). Si esa carga falla, el array queda
    // vacio a proposito: es preferible una pantalla vacia a un catalogo falso.
    const PRODUCTOS = [];

    // Lista editable de sistemas de tractor
    let SISTEMAS = [
      "Motor", "Sistema hidráulico", "Embrague", "Tren delantero",
      "Sistema de enfriamiento", "Estoperas", "Buje-bocina",
      "Eléctrico", "Cabina", "Filtros"
    ];

    // v13.2: los 7 clientes demo se eliminaron. CLIENTES se llena SOLO desde
    // Supabase. Se podia facturar a "AGROPECUARIA EL TURPIAL C.A." (cliente_id 1),
    // que no existe en la base real.
    const CLIENTES = [];

    const FACTURAS_COBRAR = [];

    const VENTAS_RECIENTES = [];

    // v13: USUARIOS — solo metadata para mostrar en la pestaña de Configuración.
    // La autenticación REAL la hace Supabase Auth + tabla `perfiles`. Las passwords
    // ya NO se guardan aquí — eso era inseguro. Si quieres cambiar passwords,
    // usa el dashboard de Supabase: Authentication > Users > (usuario) > Reset password.
    // v13.2: se quitaron vendedor1/2/3@arj.local (filas huerfanas de la demo).
    const USUARIOS = {
      'josehjimenezcas@gmail.com': { rol: "gerente", nombre: "JJ", empresa: "ambas" },
      'humbertoarj@gmail.com': { rol: "gerente", nombre: "HUMBERTO ARJ", empresa: "ambas" },
    };

    // ═══ PRESUPUESTOS DEMO (vigencia 45 días) ═══
    let COTIZACIONES = [];

    // ═══ APARTADOS DEMO ═══
    let APARTADOS = [];

    // v12: Array completo de facturas (para la pestaña Historial)
    let TODAS_FACTURAS = [];

    // ═══ FAVORITOS DEMO ═══
    // Obligatorios: definidos por el gerente, todos los vendedores los ven
    let FAVORITOS_OBLIGATORIOS = [];
    // Personales: cada vendedor tiene sus propios (máx 12 entre obligatorios + personales)
    // v13.2: se vaciaron los favoritos demo (apuntaban a codigos que ya no existen)
    let FAVORITOS_PERSONALES = {};

    // ═══ TURNOS DEMO (Lote B) ═══
    let TURNOS = [];
    let miTurnoActual = null; // se asigna al abrir uno

    // ═══ ALERTAS INTELIGENTES (Lote B) ═══
    let ALERTAS = [];
    let filtroAlertasActual = 'todas';

    // ═══ LISTAS DE PRECIOS PERSONALIZADAS (Lote B) ═══
    // v13.2: listas demo eliminadas. Pendiente definir la jerarquia contra los
    // tiers T1/T2/T3 antes de construir este modulo.
    let LISTAS_PRECIOS = [];
    let BITACORA = [];
    // ═══════════════════════════════════════════════════════════════
    // ESTADO
    // ═══════════════════════════════════════════════════════════════
    let estado = {
      empresa: 'directa',
      empresa_pendiente: null,
      cliente: null,
      tier: 'Publico',
      items: [],
      pagos: [],
      // v13.20 Nacen en null, no en un numero viejo. Un valor inicial que
      // parece valido es peor que uno vacio: nadie lo cuestiona. Si Supabase
      // no carga, estas quedan null y el sistema lo dice en vez de facturar
      // a la tasa de hace meses.
      tasa_par: null,
      tasa_bcv: null,
      tasas_actualizadas: null, // v13.12: cuando se confirmaron por ultima vez
      dto_divisa: null,         // v13.12: % de dto por pago en divisas (null = usa la brecha)
      factor_default: 1.471,
      costos_fijos_mes: 0,
      costos_fijos_hist: {},
      rol: null,
      usuario: null,
    };

    // CARGA INMEDIATA: solo declaramos la bandera. La carga real va al FINAL del script,
    // porque metas y ventasMesActual se declaran más abajo (estaríamos en TDZ aquí).
    let _arjDatosCargados = false;

    // AUTO-SAVE DE SEGURIDAD: cada 60s, si no hay guardado pendiente, fuerza un guardado.
    // Cubre el caso en que alguna mutación interna no haya disparado guardarDatos().
    setInterval(function () {
      if (_persistenciaLista && !_guardadoPendiente) {
        try { localStorage.setItem(ARJ_STORAGE_KEY, JSON.stringify(_serializarDatos())); } catch (e) { }
      }
    }, 60000);

    const PRECIOS_TIER = { 'Publico': 1.0, 'T1': 0.95, 'T2': 0.90, 'T3': 0.80 };
    const TIER_NAMES = { 'Publico': 'Público', 'T1': 'Aliado T1 (–5%)', 'T2': 'Aliado T2 (–10%)', 'T3': 'Aliado T3 (–20%)' };

    // v13.34: ATRIBUCION DE ORIGEN DEL CLIENTE
    // Sin este campo no se puede saber que canal de captacion trae clientes y
    // cual solo gasta tiempo. Se pide en el alta y se puede corregir al editar.
    const ORIGEN_NAMES = {
      'instagram': 'Instagram',
      'facebook': 'Facebook',
      'tiktok': 'TikTok',
      'whatsapp': 'WhatsApp directo',
      'referido': 'Referido',
      'visita': 'Llegó al local',
      'vendedor': 'Prospección del vendedor',
      'feria': 'Feria / evento',
      'otro': 'Otro',
      'historico': 'Anterior al registro'
    };
    // Agrupacion para el tablero: digital vs boca a boca vs esfuerzo propio.
    const ORIGEN_GRUPO = {
      'instagram': 'Digital', 'facebook': 'Digital', 'tiktok': 'Digital', 'whatsapp': 'Digital',
      'referido': 'Boca a boca', 'visita': 'Boca a boca',
      'vendedor': 'Esfuerzo propio', 'feria': 'Esfuerzo propio',
      'otro': 'Sin clasificar', 'historico': 'Sin clasificar'
    };
    const ORIGEN_COLOR = { 'Digital': '#5C6BC0', 'Boca a boca': '#2E9E5B', 'Esfuerzo propio': '#C79100', 'Sin clasificar': '#9E9E9E' };
    function origenTxt(c) { return ORIGEN_NAMES[c && c.origen] || 'Sin registrar'; }
