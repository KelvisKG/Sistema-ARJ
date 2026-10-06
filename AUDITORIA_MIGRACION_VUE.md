# Auditoría de migración: Sistema ARJ — Monolito (v13) vs. Vue 3

**Fecha:** 06-oct-2026 · **Alcance:** `src/` (Vue 3 + Pinia, ~12.300 líneas) comparado con `legacy/ARJ_Sistema_Prototipo_v13 pro.html` (~10.500 líneas de JS) y `Base de datos ARJ/01_solucion_auditoria_transaccional.sql`.
**Método:** lectura de código lado a lado y `vite build` (compila sin errores). No se ejecutó contra la base de datos real, así que lo que depende del estado de Supabase (RLS, funciones RPC instaladas, triggers) está marcado como **"verificar en BD"**.

---

## 1. Veredicto

**La versión Vue no está lista para reemplazar al monolito en producción.**

El núcleo de facturación mejoró en algo concreto: hay una RPC transaccional, el correlativo usa `FOR UPDATE` y se bloquea la emisión sin conexión. Pero la migración tiene tres problemas de fondo:

1. **Se perdió la persistencia de la mayoría de los módulos.** El monolito escribe en unas 20 tablas y Vue solo en 7. Inventario (edición, recepciones, traspasos, embarques, ajustes), cotizaciones, gastos de caja, configuración, metas y altas de clientes **viven solo en memoria** y se pierden al recargar, aunque la pantalla diga "guardado con éxito".
2. **Volvieron bugs monetarios que el monolito ya había corregido:** v13.12 (Bs acreditados a tasa paralela), v13.32 (abono en $ efectivo restado a valor de cara) y v13.33 (`pagos.monto_usd` inflado). También se perdieron el snapshot fiscal del cliente, el cobro redondo en efectivo y el registro del descuento por divisas.
3. **El modelo de seguridad es más débil que el del monolito:** la sesión y el rol se restauran desde `localStorage` sin consultar Supabase, cualquiera puede registrarse y entrar como vendedor, el vendedor puede cambiar de empresa y de tier, y las RPC `SECURITY DEFINER` se pueden llamar con la clave pública.

| Severidad | Cantidad |
|---|---|
| 🔴 Crítico | 10 |
| 🟠 Alto | 14 |
| 🟡 Medio | 12 |
| ⚪ Bajo | 7 |

---

## 2. Hallazgos críticos 🔴

### C-01 · Inventario, cotizaciones, embarques y gastos no se guardan en la base de datos
Ninguna de estas acciones llama a Supabase. Solo modifican arrays de Pinia, que además `persistence.js` no serializa. Al recargar, todo se pierde y el catálogo vuelve al stock real de la BD.

| Acción | Código Vue | Monolito |
|---|---|---|
| Editar producto (FOB, stock, precio manual…) | [useArjStore.js:1328](src/stores/useArjStore.js:1328) `guardarEdicionProducto` → `Object.assign` local | `productos.update` |
| Traspaso Dist → VD | [useArjStore.js:1265](src/stores/useArjStore.js:1265) | `traspasos` + `traspaso_items` + nota NE |
| Recepción / conteo físico | [RecepcionModal.vue](src/components/modals/RecepcionModal.vue) `aplicarRecepcion` | `recepciones` + `recepcion_items` + sellado de embarque |
| Ajuste manual de stock | [MovimientosView.vue](src/views/MovimientosView.vue) `aplicarAjusteStock` | `productos.update` |
| Embarques / costeo landed | [EmbarquesModal.vue](src/components/modals/EmbarquesModal.vue) `agregarEmbarque` | `embarques.insert/update` |
| Cotizaciones | [useArjStore.js:1125](src/stores/useArjStore.js:1125) `guardarPresupuesto` | `cotizaciones` + `cotizacion_items` |
| Gastos / movimientos de caja | [MovimientosView.vue](src/views/MovimientosView.vue) `guardarMovimientoDinero` | `movimientos_caja.insert` |

**Impacto:** el usuario ve "✓ actualizado / guardado", vende sobre stock ficticio y la BD queda desincronizada. Un traspaso hecho hoy no existe mañana.
**Corrección:** portar los `_sbGuardarProducto`, `trasAplicar`, `recAplicar`, `guardarEmbarque`, `guardarMovimiento` y `preImprimir` del legado a servicios en `supabase.js`. Mientras no estén portados, **deshabilitar esos botones**.

### C-02 · Los clientes nuevos nunca llegan a la base de datos
- **Alta rápida desde Facturación** ([NuevoClienteRapidoModal.vue:179](src/components/modals/NuevoClienteRapidoModal.vue:179)): no llama a Supabase. Crea el cliente con `id: Date.now()` (~1,76×10¹²) y lo selecciona para facturar. Al emitir, la RPC hace `NULLIF(p_factura->>'cliente_id','')::INT`, ese número no cabe en un `int4` y **la factura se rechaza** con "integer out of range". En el camino alterno falla igual.
- **Alta desde Clientes** ([ClientesView.vue:672-681](src/views/ClientesView.vue:672)): envía la columna `canal_venta`, que no existe en `clientes` según el volcado de la BD. PostgREST responde con error, `guardarClienteEnSupabase` encola el insert, la cola lo reintenta 5 veces con el mismo payload y **lo descarta en silencio** ([syncQueue.js:90](src/services/syncQueue.js:90)). La función siempre devuelve `{ok:true}`. Tampoco se inserta en `contactos_cliente`.

**Corrección:** insertar en línea, usar el `id` que devuelve la BD, mapear solo columnas válidas e insertar el contacto principal. Si falla, mostrar el error en vez de encolar.

### C-03 · Regresión del bug v13.12: los pagos en Bs se acreditan a tasa paralela
- La pantalla muestra **"Cobrar en Dólar BCV: Bs = USD × BCV"** ([FacturacionView.vue:491](src/views/FacturacionView.vue:491)).
- `agregarPagoCarrito` acredita **Bs ÷ tasa_par** ([useArjStore.js:761](src/stores/useArjStore.js:761)), y el botón de pago precarga **USD × tasa_par** ([FacturacionView.vue:696](src/views/FacturacionView.vue:696)).
- Con las tasas de la BD (BCV 857,89 / paralelo 980), si el cliente paga exactamente los Bs que muestra la pantalla, se le acredita un 12,5 % menos. En contado la emisión queda bloqueada ("faltan $…"), y en crédito el cliente queda debiendo de más.
- Si el cajero cobra lo que precarga el sistema, el cliente paga un 14 % más en Bs que el precio anunciado. Eso contradice la decisión v13.13 de JJ: *"un solo precio anunciado… SUNDDE exige cobrar a la tasa oficial del día"*.

El monolito mide cada pago contra el total anunciado **en su moneda** (fracciones, ver `recalcular()` línea ~8771). El cambio "M2" del commit `ea6364c` reintrodujo el bug.
**Corrección:** volver al modelo de fracciones: Bs contra `total × factorBs × tasa_bcv` y $ efectivo contra `totalEnDivisas`. **Decisión de negocio:** confirmar con JJ que el Bs se cobra a tasa BCV.

### C-04 · Regresión de v13.32 y v13.33 en abonos de CxC
En [CuentasCobrarView.vue](src/views/CuentasCobrarView.vue) y `registrarCobro` ([useArjStore.js:1172](src/stores/useArjStore.js:1172)):
- El monto se escribe solo en "USD" y **se resta a valor de cara del saldo en $BCV**, aunque el método sea "Dólares efectivo ($ verde)". Un cliente que debe $100 BCV y entrega $87,5 en billetes, que es lo que salda con la brecha de hoy, queda debiendo $12,5.
- No existen los tres modos del monolito (saldar / convertir / valor de cara), ni el objetivo `cobrar_verde` prorrateado, ni el abono en Bs con regla "cubre el Cobrar HOY → salda".
- `pagos.monto_bs = abono × tasa_par` no corresponde a ningún monto real. En la emisión, `pagos.monto_usd` guarda el equivalente BCV y no los billetes entregados. Esto infla "cobrado", flujo de caja y cuadre (regresión v13.33).
- **El error al insertar en `pagos` solo genera un `console.warn`** y se sigue adelante: el saldo baja sin que exista el pago ([useArjStore.js:1207](src/stores/useArjStore.js:1207)). El monolito lanza el error y no toca nada.
- No hay campo de referencia, que el monolito exige para transferencia, pago móvil, punto y Zelle. Tampoco hay protección contra doble clic (`_abonoEnProceso`).
- El saldo del cliente se rebaja con el abono completo aunque `abonado` se tope en el total.

### C-05 · Sesión y rol restaurados desde `localStorage` sin validar contra Supabase
`restaurarSesion()` ([useArjStore.js:201](src/stores/useArjStore.js:201)) confía en `localStorage.arj_sesion = {autenticado, rol}`. Basta editar ese valor en DevTools para entrar como **gerente** o para seguir dentro con un token vencido. El monolito llama a `auth.getSession()`, vuelve a leer `perfiles` y cierra la sesión si no hay perfil o está inactivo (`restaurarSesionSiExiste`, línea ~8140).
**Corrección:** en el arranque, `getSession()` → leer `perfiles` → derivar el rol de ahí. No guardar el rol en `localStorage`.

### C-06 · Cualquiera puede registrarse y operar como vendedor
`LoginScreen` ofrece "Regístrate aquí" (`auth.signUp`). Al hacer login, si **no existe perfil**, entra con `store.login('vendedor', email)` ([LoginScreen.vue:156](src/components/common/LoginScreen.vue:156)). El monolito cierra la sesión en ese caso.
**Verificar en BD:** si existe un trigger que crea `perfiles` con `activo=false`. Aun con ese trigger, la rama sin perfil debe cerrar la sesión.

### C-07 · Las RPC `SECURITY DEFINER` se pueden ejecutar con la clave pública
`emitir_factura_atomica`, `anular_factura_atomica` y `obtener_siguiente_correlativo_seq` se crean `SECURITY DEFINER` sin `REVOKE EXECUTE … FROM anon, public` y sin `SET search_path`. La clave anónima viaja en el bundle (y hay un fallback en el código, ver A-12). Cualquiera con la URL puede **anular facturas, crear facturas o quemar correlativos** saltándose RLS y roles.
**Corrección:** `REVOKE EXECUTE … FROM public, anon; GRANT … TO authenticated;`, validar dentro de la función el rol con `auth.uid()` contra `perfiles` y agregar `SET search_path = public`.

### C-08 · El script SQL de la auditoría anterior tiene un error de sintaxis
En [01_solucion_auditoria_transaccional.sql:279](<Base de datos ARJ/01_solucion_auditoria_transaccional.sql:279>): `CASE WHEN … THEN 'stock_vd' ELSE 'stock_dist'; END;`. El `;` dentro del `CASE` rompe la creación de `anular_factura_atomica`. Si el archivo se ejecutó de una vez en el SQL Editor, el error **revierte todo el lote**: tampoco quedarían el índice único de `numero`, los contadores ni `emitir_factura_atomica`. En ese caso el cliente usa siempre los caminos alternos no atómicos.
**Verificar en BD:** `select proname from pg_proc where proname like '%atomica%' or proname like 'obtener_siguiente%';` y `\d facturas` para el índice único.

### C-09 · Las tasas se dan por "confirmadas hoy" con fecha UTC y por dispositivo
- `confirmarTasas()` y `cargarDatosLocal()` usan `new Date().toISOString().slice(0,10)`, que da la fecha **UTC** ([useArjStore.js:367](src/stores/useArjStore.js:367), [persistence.js:63](src/services/persistence.js:63)). En Venezuela (UTC−4), si se confirma después de las 8:00 p.m., se guarda la fecha de *mañana*. Al día siguiente se puede facturar con las tasas de anoche sin el bloqueo M1.
- La confirmación queda solo en el `localStorage` del equipo. Se escribe `configuracion.tasas_actualizadas`, pero **nadie la lee**. El monolito deriva el estado de esa columna (fecha local, compartida entre terminales).
- Cualquier rol puede pulsar "Confirmar hoy" en el banner ([HeaderNav.vue:74](src/components/common/HeaderNav.vue:74)).
- No se valida `tasa_bcv ≤ tasa_par` ni se rechazan valores vacíos al editar (el monolito sí, en `actualizarTasas`).

### C-10 · El descuento por divisas arranca en 0 % y nunca vuelve a la brecha
El monolito arranca con `dto_divisa: null`, que significa "usar la brecha del día", y lo resetea a `null` después de cada factura (línea ~9042). Vue lo inicializa en `0` ([useArjStore.js:40](src/stores/useArjStore.js:40)). `configuracion` no tiene columna `dto_divisa`, así que después de cargar sigue en 0 hasta que alguien edita tasas. Con 0 %, **el "Cobrar en efectivo" es igual al total BCV**: el cliente que paga con billetes paga la brecha completa de más (~12,5 %). Además, el descuento excedente que el gerente pone para una venta queda pegado en las siguientes y sobrevive a la recarga.

---

## 3. Hallazgos altos 🟠

| # | Hallazgo | Evidencia | Monolito |
|---|---|---|---|
| A-01 | **El vendedor puede cambiar el tier en Distribuidora** y dar T3 (−20 %) a cualquiera | `cambiarTier` solo bloquea en VD ([useArjStore.js:663](src/stores/useArjStore.js:663)) | Solo gerente, en ambas empresas |
| A-02 | **El vendedor puede cambiarse a la otra empresa**: se ignora `perfiles.empresa` | [HeaderNav.vue:300](src/components/common/HeaderNav.vue:300) sin control de rol | Vendedor bloqueado en su empresa (`_entrarConPerfil`) |
| A-03 | **Se perdió el snapshot fiscal del cliente** (`cliente_*_snap`) al emitir | `facturaPayload` no lo envía ([supabase.js:384](src/services/supabase.js:384)) | Se congela nombre/RIF/tel/dirección |
| A-04 | **La reimpresión de PDF usa la tasa de hoy, la empresa activa y los datos actuales del cliente**, no los de la factura | [HistorialView.vue:193](src/views/HistorialView.vue:193) `generarFacturaPDF(f, store.empresa, store.tasa_bcv, …)` | Usa la tasa, el factor y el snapshot congelados |
| A-05 | **El libro de ventas fiscal ignora mes y año**: exporta todo lo cargado (hasta 500) | [ExportarFiscalView.vue:103](src/views/ExportarFiscalView.vue:103) `mesSel/anoSel` no filtran; RIF siempre `'J-V-EXENTO'`; omite las anuladas | Rango de fechas, RIF del snapshot, anuladas listadas en 0, detalle por renglón, solo gerente |
| A-06 | **RIF de Distribuidora de relleno** (`J-98765432-1`) en PDFs y razón social distinta a la del monolito (`FINARMA C.A. / J-29620983-9`) | [exportService.js:40-55](src/services/exportService.js:40) | Validar con el contador |
| A-07 | **Configuración es mayormente maqueta**: usuarios, listas, costos fijos y "Guardar parámetros" muestran ✓ sin guardar nada; trae datos inventados (marzo 2026, $6.148) | [ConfigView.vue](src/views/ConfigView.vue) `guardarParametros`, `guardarUsuario`, `actualizarCostosFijos` | Escribe en `configuracion` (factor, costos_fijos_hist, equipo, metas_hist) |
| A-08 | **Reportes con datos fijos**: costos fijos = 2500 en duro, `store.configuracion` no existe (brecha = 1), metas y equipo solo locales | [ReportesView.vue:395](src/views/ReportesView.vue:395), [:407](src/views/ReportesView.vue:407) | Lee `costos_fijos_hist` y `metas_hist` de BD |
| A-09 | **El saldo del cliente se actualiza fuera de la transacción** y con el valor local (posiblemente viejo), tanto al emitir como al anular y cobrar: hay riesgo de perder actualizaciones entre terminales | [useArjStore.js:1006](src/stores/useArjStore.js:1006), [:1111](src/stores/useArjStore.js:1111), [:1227](src/stores/useArjStore.js:1227) | Mismo patrón, pero verifica el error |
| A-10 | **La conversión de cotización** la marca `convertida` *antes* de emitir (y solo en local) y recalcula los precios al valor actual: **no respeta el precio cotizado** | [useArjStore.js:1154](src/stores/useArjStore.js:1154) | Marca al emitir con éxito (`_cotOrigen`) y congela el precio (`precio_fijo`) |
| A-11 | **Se perdió el cobro redondo en efectivo** y el registro del descuento por divisas excedente en `descuento_manual` y `motivo_descuento` | `cobrar_verde` = `totalEnDivisas` siempre ([useArjStore.js:900](src/stores/useArjStore.js:900)) | `aplicarCobrarVerde`, `ajusteVerde`, trazabilidad v13.12/v13.22 |
| A-12 | **Fallback en duro a otro proyecto Supabase**: si falta `.env` en el build, se conecta a `wbxrkygtakdmckfzlzjk` (el monolito usa `ahnzbmzzjvwyddiwdpss`). `process?.env` no existe en el navegador | [supabase.js:9-10](src/services/supabase.js:9) | Quitar el fallback y fallar en voz alta |
| A-13 | **Lista de precios para clientes sin filtro de elegibilidad**: salen productos sin embarque sellado, sin stock o con FOB 0 (precio $0) | [ListaPreciosModal.vue](src/components/modals/ListaPreciosModal.vue) `prodsAExportar` | `_lpElegible` (decisión de JJ, 22-ago-2026) |
| A-14 | **Faltan métodos de pago**: "Efectivo Bs." y "Punto de venta". Tampoco hay parser de montos venezolanos (`1.234,56`) | [FacturacionView.vue:526-529](src/views/FacturacionView.vue:526) | 6 métodos y `parseMontoVE` |

---

## 4. Hallazgos medios 🟡

- **M-01 · Precio público con otro redondeo.** Vue redondea al centavo y el monolito sube al $0,50 siguiente ([pricing.js:21](src/services/pricing.js:21)). Ejemplo: FOB 3,13 → legado $13,00, Vue $12,52. El comentario dice "política confirmada por gerencia": **confirmarlo por escrito**, porque cambia todos los precios.
- **M-02 · Nivel por defecto del cliente = `T1`** ([supabase.js:103](src/services/supabase.js:103)). En el monolito es `Publico`. Un cliente sin nivel recibe −5 % en Distribuidora sin que nadie lo decida.
- **M-03 · Al cambiar tasas en Configuración, `calcularBrecha()` pisa el `dto_divisa`** que fijó el gerente, y `dto_divisa` nunca se guarda en BD.
- **M-04 · CxC marca como "Vencida" cualquier factura sin `fecha_vence`** (`dias = 0`). El texto por defecto "15d al día" es inventado ([CuentasCobrarView.vue:220](src/views/CuentasCobrarView.vue:220)). Una factura `parcial` vencida no se marca vencida (pasa igual en el legado).
- **M-05 · Cobros y anulaciones fuera de línea** (`supabaseConectado=false`): `registrarCobro` aplica el abono **solo en local** sin avisar. Debe bloquearse igual que emitir y anular.
- **M-06 · Anulación local con renglones vacíos:** las facturas cargadas desde BD no traen `items`, así que el stock en pantalla no se repone hasta recargar. Si el `id` empieza con `FAC-`, se marca anulada en local **sin tocar la BD**.
- **M-07 · Turnos de caja sin cuadre:** `ventas_usd/bs` quedan siempre en 0, no se compara contra lo cobrado y `turnos` no se persiste (el monolito tampoco usa tabla, pero calcula la diferencia en `recalcularCierre`).
- **M-08 · Embarques:** el factor landed ignora `pct_divisas` y el ID `EMB-2026-0N` es local, no correlativo. No hay sellado de productos (`embarque_id`) ni recálculo.
- **M-09 · `cargarDatosCompletos` no valida catálogos vacíos:** el blindaje v13.2 del monolito ("0 productos ⇒ error") se perdió. `configuracion` y `sistemas` se cargan pero el store nunca los asigna.
- **M-10 · Correlativos de Distribuidora:** la BD usa prefijo `DT` (contador `factura_dist` con prefijo `DT`, último 1) y Vue genera `DIST-…`. El camino alterno busca `DIST-%` y reiniciaría en 00001. Se mezclan dos series en el mismo año. Además, si la RPC de emisión falla, el número ya quedó consumido (hueco en la serie).
- **M-11 · Clientes:** el mapeo de contactos duplica el principal en "adicionales" cuando ninguno tiene `es_principal` ([supabase.js:98](src/services/supabase.js:98)). Esto viene heredado del legado.
- **M-12 · "Importar JSON" en Configuración** reemplaza productos, clientes y facturas en memoria sin validar. Puede dar la falsa impresión de que se restauró un respaldo.

---

## 5. Hallazgos bajos ⚪

- **B-01** · Estado inicial con el correo personal en duro (`usuarioEmail: 'josehjimenezcas@gmail.com'`, [useArjStore.js:27](src/stores/useArjStore.js:27)).
- **B-02** · La tabla `usuarios` de la BD guarda contraseñas en texto plano (`arj2026`, `venta123`). Si no se usa, eliminarla. **Verificar RLS.**
- **B-03** · `xlsx@0.18.5` tiene CVE conocidos (prototype pollution / ReDoS) y no hay parche en npm. El riesgo es bajo porque solo se usa para escribir; se puede migrar a la build de SheetJS CDN o a `exceljs`.
- **B-04** · Bundle de más de 500 kB sin code-splitting. `persistence.js` se importa de forma estática y dinámica a la vez (aviso del build).
- **B-05** · No hay botón de pánico (Esc / Ctrl+Q), ni limpieza de cotizaciones vencidas, ni eliminación de producto, ni fotos de producto.
- **B-06** · `seedData.js` contiene funciones muertas que referencian globales inexistentes (`PRODUCTOS`, `CLIENTES`).
- **B-07** · El aviso de stock en el carrito busca el producto por `id || cod_alt`. Si dos productos comparten `cod_alt` vacío, se fusionan renglones.

---

## 6. Matriz de paridad funcional

| Módulo | Monolito | Vue | Persiste en BD (Vue) |
|---|---|---|---|
| Emisión de factura | ✅ | ✅ (mejorado: RPC atómica) | ✅ |
| Pagos multimoneda al emitir | ✅ fracciones por moneda | ⚠️ tasa paralela (C-03) | ✅ con valores erróneos |
| Abonos CxC | ✅ 3 modos + Bs | ⚠️ solo USD a valor de cara | ⚠️ inserta pago sin verificar error |
| Anulación | ✅ | ✅ (RPC rota, C-08) | ✅ alterno no atómico |
| Notas de crédito | ✅ | ❌ (solo estado vacío) | ❌ |
| Apartados | ✅ | ❌ | ❌ |
| Cotizaciones | ✅ | ⚠️ crear / convertir | ❌ |
| Clientes: alta | ✅ + contactos | ⚠️ | ❌ (C-02) |
| Clientes: edición | ✅ | ✅ | ✅ |
| Estado de cuenta / WhatsApp | ✅ | ⚠️ parcial | — |
| Productos: alta / edición / baja / fotos | ✅ | ⚠️ edición local | ❌ |
| Traspasos + Nota de entrega | ✅ multi-renglón | ⚠️ un producto, solo local | ❌ (NE solo lectura) |
| Recepciones / conteo | ✅ con sellado | ⚠️ local | ❌ |
| Embarques / landed | ✅ | ⚠️ local, fórmula distinta | ❌ |
| Lista de precios + análisis | ✅ elegibilidad + análisis de márgenes | ⚠️ sin filtros, sin análisis | — |
| Movimientos de caja | ✅ alta / anulación | ⚠️ solo lectura real; alta local | ❌ |
| Turnos / arqueo | ✅ con diferencia | ⚠️ sin cuadre | local |
| Reportes / metas / equipo | ✅ desde BD | ⚠️ valores fijos | ❌ |
| Exportación fiscal | ✅ rango, snapshot, detalle | ⚠️ sin filtro de período | — |
| Configuración (factor, costos fijos, sistemas) | ✅ | ❌ maqueta | ❌ |
| Bitácora | ✅ | ✅ (con cola offline) | ✅ |
| Login / sesión / permisos | ✅ validado contra perfil | ⚠️ (C-05, C-06, A-01, A-02) | — |

---

## 7. Lo que la versión Vue sí mejoró

- La emisión pasa por una **RPC transaccional** (si está instalada) y, si no, por un camino alterno con **reversión compensatoria**. El monolito dejaba facturas sin renglones o sin descuento de stock y solo avisaba.
- El correlativo se obtiene con **`FOR UPDATE`** y hay **índice único** en `facturas.numero`. En el monolito, `select` + `update` tenían condición de carrera.
- **Se bloquea emitir y anular sin conexión**, y las facturas **nunca se encolan** offline (guardia explícita en `syncQueue.js`).
- Validaciones de emisión equivalentes al monolito: FOB > 0, descripción, cliente, tasas, descuento solo del gerente, aviso de préstamo inter-empresa.
- Arquitectura mantenible (componentes, store, servicios), PWA y caché local limitada a preferencias y carrito (M5).

---

## 8. Plan de remediación recomendado

**Fase 0: antes de usar Vue en producción (bloqueantes)**
1. Arreglar e instalar el SQL (C-08), revocar `EXECUTE` a `anon` y validar el rol dentro de las RPC (C-07).
2. Rehacer la sesión: `getSession` + `perfiles`, sin rol en `localStorage`, sin acceso cuando no hay perfil y con la empresa bloqueada según el perfil (C-05, C-06, A-02).
3. Volver al modelo de cobro del monolito: fracciones por moneda, `dto_divisa = null` (brecha del día) y abonos con los modos saldar / convertir / cara (C-03, C-04, C-10, A-11).
4. Guardar los clientes nuevos de verdad y con el `id` real (C-02).
5. Confirmación de tasas desde `configuracion.tasas_actualizadas` con fecha local, solo gerente (C-09).
6. Deshabilitar o ocultar todo botón que no persista (C-01, A-07) hasta portarlo.

**Fase 1: paridad**
Portar la persistencia de productos, traspasos con NE, recepciones con sellado, embarques, cotizaciones (con `precio_fijo` y `_cotOrigen`), movimientos de caja, configuración, metas y equipo. Agregar snapshot fiscal, PDF con datos congelados y exportación fiscal por rango (A-03 a A-10, A-13, A-14).

**Fase 2: endurecimiento**
Mover el saldo del cliente a la RPC (o calcularlo como `SUM(saldo_pendiente)`), crear una RPC `registrar_abono_atomico`, unificar la serie DT/DIST, agregar pruebas unitarias del motor de precios (`pricing.js`) contra los casos documentados en los comentarios v13.x del monolito y quitar el fallback de credenciales.

---

## 9. Pendiente de verificar en la base de datos (no visible desde el código)

1. ¿Existen `emitir_factura_atomica`, `anular_factura_atomica`, `obtener_siguiente_correlativo_seq` y el índice `facturas_numero_unique_idx`?
2. Políticas RLS de todas las tablas, en especial `usuarios`, `perfiles`, `facturas`, `pagos` y `clientes`.
3. ¿Hay un trigger `on auth.users insert → perfiles(activo=false)`?
4. ¿La tabla `clientes` tiene `canal_venta` en producción? (El volcado del 29-sep dice que no.)
5. ¿Cuál es el RIF y la razón social correctos de cada empresa para los documentos?

---

## 10. Estado de la remediación (06-oct-2026, rama `fix/auditoria-migracion`)

Decisiones de negocio aplicadas: **Bs a tasa BCV**, **redondeo a $0,50 hacia arriba**, **sin registro público**, membrete y RIF **como el monolito**, serie de Distribuidora **DT** (la de la BD). Notas de crédito y apartados quedan para otra etapa.

> ⚠ **Requisito:** casi todo depende de [`sql/02_correcciones_auditoria.sql`](sql/02_correcciones_auditoria.sql). Mientras no se aplique en Supabase, la app muestra el error *"La base de datos no tiene la función …"* y **no guarda nada** (falla en voz alta, no en silencio).

| Hallazgo | Estado | Cómo quedó |
|---|---|---|
| C-01 Módulos sin persistencia | ✅ | Productos, traspasos (+NE), recepciones/conteos (+sellado), ajustes, embarques, cotizaciones, caja, configuración y metas escriben en la BD vía funciones atómicas |
| C-02 Clientes nuevos | ✅ | `crear_cliente` devuelve el id real e inserta el contacto; la cola offline ya no acepta clientes |
| C-03 Bs a tasa paralela | ✅ | Modelo de fracciones del monolito; Bs = total × tasa BCV |
| C-04 Abonos CxC | ✅ | Modos saldar / convertir / cara, Bs a tasa del día, referencia obligatoria, función atómica, sin doble envío. *Cambio deliberado:* un abono **parcial** en Bs se acredita a tasa BCV (el monolito usaba paralelo solo en ese caso) |
| C-05 Sesión en localStorage | ✅ | Verificado en navegador: falsificar `arj_sesion` ya no da acceso |
| C-06 Registro público | ✅ | Eliminado; sin perfil activo se cierra la sesión |
| C-07 RPC ejecutables por anon | ✅ (en script) | `REVOKE` a anon/public y validación de rol/empresa dentro de cada función |
| C-08 Error de sintaxis SQL | ✅ (en script) | Funciones reescritas; el script 02 reemplaza al 01 |
| C-09 Tasas por equipo y en UTC | ✅ | Se leen de `configuracion.tasas_actualizadas` con fecha de Venezuela; solo gerente confirma |
| C-10 Descuento por divisas en 0 % | ✅ | Arranca en la brecha del día y vuelve a ella tras cada factura |
| A-01 / A-02 Tier y empresa del vendedor | ✅ | Solo gerente cambia tier; vendedor fijo en la empresa de su perfil (también validado en el servidor) |
| A-03 / A-04 Snapshot y reimpresión | ✅ | La factura guarda la copia del cliente; el PDF usa empresa, tasa y factor congelados |
| A-05 Libro de ventas | ✅ | Por rango de fechas desde la BD, anuladas en cero, RIF emisor, hoja de detalle |
| A-06 RIF de relleno | ✅ | Membrete del monolito (V-162930024) y emisor fiscal FINARMA J-29620983-9 |
| A-07 / A-08 Configuración y reportes | ✅ | Sin maquetas; datos reales de la BD; usuarios desde `perfiles` (solo lectura) |
| A-09 Saldo del cliente fuera de transacción | ✅ (en script) | Se mueve dentro de emitir / anular / abonar |
| A-10 Conversión de cotización | ✅ | Respeta el precio cotizado; se marca convertida al emitir |
| A-11 Cobro redondo y descuento por divisas | ✅ | Repuestos y registrados en `descuento_manual` / `motivo_descuento` |
| A-12 Credenciales de respaldo | ✅ | Eliminadas; sin `.env` el sistema avisa y no conecta |
| A-13 Lista de precios | ✅ | Filtro de elegibilidad del monolito |
| A-14 Métodos de pago | ✅ | Los 6 del monolito + parser `1.234,56` |
| M-01 … M-12 | ✅ | Incluye: nivel por defecto `Publico`, semáforo de CxC, sin cobros offline, stock recargado tras anular, turnos con cuadre real, embarques con fórmula del monolito, blindaje de catálogo vacío, correlativo dentro de la transacción (sin huecos), contactos sin duplicar, importación JSON eliminada |
| B-01, B-06, B-07 | ✅ | Correo personal quitado, código muerto eliminado, carrito por id |
| B-04 Bundle | ◐ | jsPDF/XLSX se cargan bajo demanda; el bundle principal sigue en ~650 kB (Supabase + Vue) |
| B-05 | ◐ | Botón de pánico **Ctrl+Q** (Esc sigue cerrando ventanas); baja lógica de productos. Fotos de producto: fuera de alcance (requiere bucket) |
| B-02 Tabla `usuarios` | ⏳ | `DROP` comentado en el script: decidir y descomentar |
| B-03 `xlsx` con CVE | ⏳ | Fuera de alcance (riesgo bajo: solo escribe archivos) |
| Notas de crédito / apartados | ⏳ | Próxima etapa, por decisión |
| Turnos de caja | ◐ | Cuadre real contra la BD, pero el turno se guarda por equipo (igual que el monolito; no hay tabla) |

### Pruebas
- `npm test`: **63 pruebas** — motor de cobros (casos del monolito v13), montaje de las 13 vistas y todos los modales sin avisos de Vue, permisos y bloqueos del store.
- `npm run build`: compila sin errores.
- Navegador: login sin errores de consola; sesión falsificada rechazada.

### Pasos para poner en marcha
1. Aplicar `sql/02_correcciones_auditoria.sql` en **staging** y correr las consultas de verificación del final del archivo.
2. Revisar RLS (consulta *b*): ninguna tabla debería quedar sin RLS.
3. Probar en staging: factura contado en Bs y en $, crédito con abono inicial, abono en CxC, anulación, cliente nuevo desde Facturación, traspaso, recepción con embarque, cotización → factura.
4. Repetir el paso 1 en producción y desplegar.
