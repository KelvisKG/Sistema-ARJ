<template>
  <div class="page active" id="page-facturacion">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="page-title"><i class="ti ti-file-invoice"></i> Nueva Factura</h1>
        <p class="page-sub" style="margin-bottom:0">
          Empresa: <strong>{{ store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora ARJ' }}</strong>
          · Factura N° <strong>(se asigna al emitir)</strong>
          · Fecha: <strong>{{ fechaHoy }}</strong>
        </p>
      </div>
      <div>
        <button class="btn btn-gold" @click="store.modoCajaActivo = true">
          <i class="ti ti-cash-register"></i> Modo Caja (Pantalla Simple)
        </button>
      </div>
    </div>

    <div class="help-box">
      <i class="ti ti-info-circle"></i>
      <div>
        <strong>¿Cómo facturar?</strong> Elige cliente → busca producto (puedes usar código alterno, OEM, descripción, marca o escanear) → ajusta precio (solo gerente) → registra pagos → emite. <strong>Estas facturas NO causan IVA</strong> (repuestos agrícolas exentos).
      </div>
    </div>

    <div class="factura-layout">
      <!-- COLUMNA PRINCIPAL -->
      <div>
        <!-- DATOS DEL CLIENTE -->
        <div class="card">
          <div class="card-tit"><i class="ti ti-user"></i> Datos del cliente</div>
          <div class="field-row">
            <label>Cliente:</label>
            <div style="display:flex;gap:8px;flex:1;position:relative">
              <input
                type="text"
                v-model="busquedaCliente"
                class="val-input"
                style="flex:1"
                placeholder="Buscar por nombre o RIF..."
                @input="mostrarClientes = true"
                @focus="mostrarClientes = true"
              >
              <div
                v-if="mostrarClientes && clientesFiltrados.length > 0"
                class="search-results show"
                style="display:block;max-height:250px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;margin-top:40px;background:var(--card-bg);box-shadow:var(--shadow-lg);z-index:100;position:absolute;width:calc(100% - 46px)"
              >
                <div
                  class="search-result-item"
                  style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer"
                  @click="seleccionarConsumidorFinal"
                >
                  <strong style="color:var(--text)">-- Consumidor final (mostrador) --</strong>
                </div>
                <div
                  v-for="c in clientesFiltrados"
                  :key="c.id"
                  class="search-result-item"
                  style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between"
                  @click="seleccionarCliente(c)"
                >
                  <div>
                    <strong style="color:var(--navy)">{{ c.nombre }}</strong>
                    <div style="font-size:11px;color:var(--dgray);margin-top:2px">RIF: {{ c.rif || 'Sin RIF' }}</div>
                  </div>
                </div>
              </div>
              <button
                class="btn btn-primary btn-sm"
                title="Nuevo cliente rápido"
                style="white-space:nowrap;padding:6px 12px"
                @click="store.modalNuevoClienteActivo = true"
              >
                <i class="ti ti-user-plus"></i>
              </button>
            </div>
          </div>

          <!-- NIVEL DE PRECIO EN DISTRIBUIDORA -->
          <div v-if="store.empresa === 'distribuidora'" class="field-row" id="fila-nivel-precio">
            <label>Nivel precio:</label>
            <div class="tier-selector" id="tier-selector" :style="{ opacity: store.rol === 'gerente' ? 1 : 0.6 }" :title="store.rol === 'gerente' ? '' : 'Solo el gerente cambia el nivel de precio'">
              <div
                :class="['tier-btn', { active: store.carrito.tier === 'Publico' }]"
                @click="store.cambiarTier('Publico')"
              >
                Público
              </div>
              <div
                :class="['tier-btn', { active: store.carrito.tier === 'T1' }]"
                @click="store.cambiarTier('T1')"
              >
                Aliado –5%
              </div>
              <div
                :class="['tier-btn', { active: store.carrito.tier === 'T2' }]"
                @click="store.cambiarTier('T2')"
              >
                Aliado –10%
              </div>
              <div
                :class="['tier-btn', { active: store.carrito.tier === 'T3' }]"
                @click="store.cambiarTier('T3')"
              >
                Mayorista –20%
              </div>
            </div>
          </div>

          <!-- NIVEL DE PRECIO EN VENTA DIRECTA -->
          <div v-else class="field-row" id="fila-precio-publico-vd">
            <label>Nivel precio:</label>
            <div style="flex:1;display:flex;align-items:center;gap:10px">
              <span style="background:var(--lblue);color:var(--navy);padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600">
                <i class="ti ti-tag"></i> Precio público
              </span>
              <button
                v-if="store.rol === 'gerente'"
                class="btn btn-secondary btn-sm"
                style="font-size:11px"
                @click="store.modalDtoManualActivo = true"
              >
                <i class="ti ti-discount"></i> Descuento manual
              </button>
              <span v-if="store.carrito.descuento_manual > 0" style="font-size:11.5px;color:var(--green);font-weight:600">
                −{{ store.carrito.descuento_manual }}% aplicado ({{ store.carrito.descuento_motivo }})
              </span>
            </div>
          </div>

          <div v-if="clienteSeleccionado" style="display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--dgray);margin-top:5px;background:var(--lblue);padding:8px 12px;border-radius:6px">
            <div style="flex:1">
              <strong>Seleccionado:</strong> {{ clienteSeleccionado.nombre }}
              · <i class="ti ti-phone"></i> {{ clienteSeleccionado.tel || 'Sin teléfono' }}
              · <i class="ti ti-map-pin"></i> {{ clienteSeleccionado.direccion || 'Sin dirección' }}
            </div>
            <div>
              Saldo pendiente: <strong style="color:var(--red)">{{ fmtUSD(store.empresa === 'directa' ? clienteSeleccionado.saldo_vd : clienteSeleccionado.saldo_dist) }}</strong>
            </div>
            <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px" @click="seleccionarCliente(null)"><i class="ti ti-x"></i></button>
          </div>
        </div>

        <!-- AGREGAR PRODUCTOS (5 PESTAÑAS) -->
        <div class="card">
          <div class="card-tit"><i class="ti ti-search"></i> Agregar productos</div>

          <!-- Pestañas de Búsqueda -->
          <div style="display:flex;gap:4px;margin-bottom:10px;border-bottom:1px solid var(--gray);overflow-x:auto">
            <button
              :class="['search-tab', { active: tabBusqueda === 'normal' }]"
              @click="tabBusqueda = 'normal'"
            >
              <i class="ti ti-search"></i> Buscar
            </button>
            <button
              :class="['search-tab', { active: tabBusqueda === 'aplicacion' }]"
              @click="tabBusqueda = 'aplicacion'"
            >
              <i class="ti ti-tractor"></i> Por aplicación
            </button>
            <button
              :class="['search-tab', { active: tabBusqueda === 'barras' }]"
              @click="tabBusqueda = 'barras'"
            >
              <i class="ti ti-barcode"></i> Código de barras
            </button>
            <button
              :class="['search-tab', { active: tabBusqueda === 'favoritos' }]"
              @click="tabBusqueda = 'favoritos'"
            >
              <i class="ti ti-star"></i> Favoritos
            </button>
            <button
              :class="['search-tab', { active: tabBusqueda === 'importar' }]"
              @click="tabBusqueda = 'importar'"
            >
              <i class="ti ti-upload"></i> Importar
            </button>
          </div>

          <!-- 1. TAB BÚSQUEDA NORMAL -->
          <div v-if="tabBusqueda === 'normal'" class="search-tab-content active" id="tab-normal">
            <div class="search-box">
              <i class="ti ti-search"></i>
              <input
                v-model="busquedaTexto"
                type="text"
                id="busqueda-prod"
                placeholder="Busca por código, descripción o marca (ej: bomba, 5075, filtro, luk...)"
                autocomplete="off"
                @input="mostrarResultados = true"
                @focus="mostrarResultados = true"
              >
            </div>

            <!-- RESULTADOS AUTOCOMPLETE -->
            <div
              v-if="mostrarResultados && productosFiltrados.length > 0"
              class="search-results show"
              id="search-results"
              style="display:block;max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;margin-top:6px;background:var(--card-bg);box-shadow:var(--shadow-lg);z-index:100;position:relative"
            >
              <div
                v-for="p in productosFiltrados"
                :key="p.id"
                class="search-result-item"
                style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:background 0.15s"
                @click="seleccionarProducto(p)"
              >
                <div>
                  <strong style="color:var(--primary);font-size:13.5px">{{ p.cod_alt }}</strong>
                  <span v-if="p.cod_orig" style="color:var(--text-muted);font-size:11px;margin-left:6px">({{ p.cod_orig }})</span>
                  <div style="font-size:12px;color:var(--text);margin-top:2px">{{ p.desc }}</div>
                  <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                    Marca: <strong style="color:var(--text)">{{ p.marca }}</strong>
                    <span v-if="p.marca_modelo"> · {{ p.marca_modelo }}</span>
                  </div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:800;color:var(--green);font-size:14px">
                    {{ fmtUSD(precioConTier(p.fob, store.carrito.tier, p)) }}
                  </div>
                  <span :class="['badge', stockDe(p) > 0 ? 'badge-success' : 'badge-danger']" style="font-size:10.5px;margin-top:4px">
                    Stock: {{ stockDe(p) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. TAB POR APLICACIÓN -->
          <div v-if="tabBusqueda === 'aplicacion'" class="search-tab-content active" id="tab-aplicacion">
            <div class="help-box" style="margin-bottom:12px">
              <i class="ti ti-bulb"></i>
              <span>Filtra por tractor, motor o sistema mecánico.</span>
            </div>
            <div class="search-box">
              <i class="ti ti-tractor"></i>
              <input
                v-model="busquedaAplicacion"
                type="text"
                placeholder="Marca y modelo del tractor (ej: John Deere 6420, Ford 6600, Massey 290, Perkins...)"
              >
            </div>
            <!-- Marcas frecuentes -->
            <div style="margin-top:10px">
              <div style="font-size:11px;color:var(--dgray);margin-bottom:5px;font-weight:500">MARCAS FRECUENTES:</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button
                  v-for="m in ['John Deere', 'Massey Ferguson', 'Ford / New Holland', 'Case IH', 'Perkins', 'Cummins']"
                  :key="m"
                  class="btn btn-secondary btn-sm"
                  style="font-size:11px;padding:3px 8px"
                  @click="busquedaAplicacion = m"
                >
                  {{ m }}
                </button>
              </div>
            </div>

            <!-- RESULTADOS POR APLICACIÓN -->
            <div v-if="productosPorAplicacion.length > 0" style="margin-top:12px;max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:6px">
              <div
                v-for="p in productosPorAplicacion"
                :key="p.id"
                style="padding:6px 10px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;cursor:pointer"
                @click="seleccionarProducto(p)"
              >
                <div>
                  <strong>{{ p.cod_alt }}</strong> · {{ p.desc }}
                  <div style="font-size:11px;color:var(--dgray)">{{ p.marca_modelo }} · {{ p.sistema }}</div>
                </div>
                <button class="btn btn-secondary btn-sm"><i class="ti ti-plus"></i></button>
              </div>
            </div>
          </div>

          <!-- 3. TAB CÓDIGO DE BARRAS -->
          <div v-if="tabBusqueda === 'barras'" class="search-tab-content active" id="tab-barras">
            <div class="help-box" style="margin-bottom:12px">
              <i class="ti ti-barcode"></i>
              <span>Conecta el lector USB y escanea el código. Se agregará automáticamente al carrito.</span>
            </div>
            <div class="search-box">
              <i class="ti ti-barcode"></i>
              <input
                v-model="codigoBarrasInput"
                type="text"
                id="busqueda-barras"
                placeholder="Pasa el lector de código de barras o escribe el código y presiona Enter..."
                style="font-family:'Courier New',monospace;font-size:15px;letter-spacing:1px"
                @keyup.enter="escanearBarras"
              >
            </div>
            <div v-if="ultimoEscaneado" style="margin-top:6px;font-size:11.5px;color:var(--green)">
              <i class="ti ti-check"></i> Último escaneado: <strong>{{ ultimoEscaneado }}</strong>
            </div>
          </div>

          <!-- 4. TAB FAVORITOS -->
          <div v-if="tabBusqueda === 'favoritos'" class="search-tab-content active" id="tab-favoritos">
            <div class="help-box" style="margin-bottom:12px">
              <i class="ti ti-star"></i>
              <span>Repuestos frecuentes. Haz clic en cualquiera para agregarlo inmediatamente al carrito:</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">
              <div
                v-for="p in productosFavoritos"
                :key="p.id"
                class="card"
                style="margin:0;padding:12px;cursor:pointer;border:1px solid var(--border);border-radius:8px;text-align:center;background:var(--card-bg);transition:all 0.15s ease"
                @click="seleccionarProducto(p)"
              >
                <div style="font-weight:700;color:var(--primary);font-size:12.5px">{{ p.cod_alt }}</div>
                <div style="font-size:11px;color:var(--text-muted);height:32px;overflow:hidden;margin:6px 0;line-height:1.3">{{ p.desc }}</div>
                <div style="font-weight:800;color:var(--green);font-size:13.5px">{{ fmtUSD(precioConTier(p.fob, store.carrito.tier, p)) }}</div>
              </div>
            </div>
          </div>

          <!-- 5. TAB IMPORTAR MASIVO DESDE EXCEL -->
          <div v-if="tabBusqueda === 'importar'" class="search-tab-content active" id="tab-importar">
            <div class="help-box" style="margin-bottom:12px">
              <i class="ti ti-upload"></i>
              <span>Copia desde Excel (código y cantidad separados por espacio o tab) y pega aquí:</span>
            </div>
            <textarea
              v-model="textoImportar"
              class="val-input"
              placeholder="BOM-JD-5075 2&#10;EMB-MF-290 1&#10;FIL-DON-P550008 5"
              style="width:100%;height:100px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;padding:10px;resize:vertical"
            ></textarea>
            <div style="margin-top:8px;text-align:right">
              <button class="btn btn-primary btn-sm" @click="procesarImportacion">
                <i class="ti ti-arrow-right"></i> Procesar e Importar al Carrito
              </button>
            </div>
          </div>

          <!-- TABLA DE ITEMS EN CARRITO -->
          <table class="tbl" id="tbl-items" style="margin-top:14px">
            <thead>
              <tr>
                <th style="width:14%">Código</th>
                <th style="width:30%">Descripción</th>
                <th class="num" style="width:9%">Stock</th>
                <th class="num" style="width:11%">Cantidad</th>
                <th class="num" style="width:14%">Dólar BCV</th>
                <th v-if="store.rol === 'gerente'" class="num" style="width:10%">Margen %</th>
                <th class="num" style="width:12%">Total USD</th>
                <th style="width:4%"></th>
              </tr>
            </thead>
            <tbody id="items-body">
              <tr v-if="store.carrito.items.length === 0" id="row-empty">
                <td :colspan="store.rol === 'gerente' ? 8 : 7" style="text-align:center;padding:24px;color:var(--dgray)">
                  No has agregado productos. Usa el buscador de arriba ↑
                </td>
              </tr>
              <template v-for="(it, idx) in store.carrito.items" :key="it.id || it.cod_alt">
                <tr>
                  <td>
                    <strong style="color:var(--navy)">{{ it.cod_alt }}</strong>
                    <div style="font-size:10px;color:var(--dgray)">{{ it.marca }}</div>
                  </td>
                  <td>{{ it.desc }}</td>
                  <td class="num">
                    <span :class="['badge', stockDe(it) <= 0 ? 'badge-danger' : (it.cant > stockDe(it) ? 'badge-warning' : 'badge-info')]">
                      {{ stockDe(it) }}
                    </span>
                  </td>
                  <td class="num">
                    <input
                      type="number"
                      min="1"
                      :value="it.cant"
                      class="val-input"
                      :style="{ width: '55px', padding: '4px 2px', textAlign: 'center', fontWeight: '700', borderColor: it.cant > stockDe(it) ? 'var(--gold)' : '' }"
                      @change="store.actualizarCantCarrito(idx, $event.target.value)"
                    >
                  </td>
                  <td class="num">
                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px">
                      <span v-if="!it.modo_verde" style="font-weight:700">{{ fmtUSD(it.precio) }}</span>
                      <input
                        v-else
                        type="number"
                        step="0.5"
                        :value="it.precio_verde"
                        class="val-input"
                        style="width:75px;padding:3px 6px;font-size:12px;border-color:var(--green);text-align:right;font-weight:700;color:var(--green)"
                        @change="store.cambiarPrecioVerdeItem(idx, $event.target.value)"
                      >
                      <button
                        v-if="store.rol === 'gerente'"
                        :class="['btn-sm', it.modo_verde ? 'btn-green' : 'btn-secondary']"
                        style="padding:2px 5px;font-size:10px"
                        :title="it.modo_verde ? 'Modo Efectivo Verde activo' : 'Cambiar a modo efectivo'"
                        @click="store.toggleModoVerdeItem(idx)"
                      >
                        $
                      </button>
                    </div>
                  </td>
                  <td v-if="store.rol === 'gerente'" class="num" style="font-size:11.5px;color:var(--dgray)">
                    {{ margenItem(it) }}%
                  </td>
                  <td class="num" style="font-weight:700;color:var(--navy)">
                    {{ fmtUSD(it.cant * it.precio) }}
                  </td>
                  <td style="text-align:center">
                    <button
                      class="btn btn-danger btn-sm"
                      style="padding:3px 7px"
                      title="Eliminar ítem"
                      @click="store.removerDelCarrito(idx)"
                    >
                      <i class="ti ti-trash"></i>
                    </button>
                  </td>
                </tr>
                <!-- ALERTA PRODUCTO SIN FOB (v13.17) -->
                <tr v-if="sinFob(it)">
                  <td colspan="8" style="padding:0">
                    <div style="margin:0;background:#FDECEA;border-left:3px solid var(--red);padding:6px 12px;font-size:11px;color:#8B1A10;display:flex;gap:6px;align-items:center">
                      <i class="ti ti-alert-octagon" style="font-size:14px"></i>
                      <div><strong>{{ it.cod_alt }} no tiene costo cargado (FOB en 0).</strong> No se podrá emitir la factura hasta corregir el FOB en Inventario.</div>
                    </div>
                  </td>
                </tr>
                <!-- ALERTA STOCK INSUFICIENTE / PRÉSTAMO (v13.1) -->
                <tr v-if="it.cant > stockDe(it)">
                  <td colspan="8" style="padding:0">
                    <div style="margin:0;background:#FFF8E1;border-left:3px solid var(--gold);padding:6px 12px;font-size:11px;color:#854F0B;display:flex;gap:6px;align-items:center">
                      <i class="ti ti-alert-triangle" style="font-size:14px"></i>
                      <div><strong>Stock insuficiente para {{ it.desc }}.</strong> Disponible local: {{ stockDe(it) }}. Se registrará como préstamo inter-empresarial.</div>
                    </div>
                  </td>
                </tr>
                <!-- ALERTA MARGEN BAJO (GERENTE) -->
                <tr v-if="store.rol === 'gerente' && !sinFob(it) && margenItem(it) < MARGEN_MINIMO">
                  <td colspan="8" style="padding:0">
                    <div style="margin:0;background:#FFF3E0;border-left:3px solid #E65100;padding:6px 12px;font-size:11px;color:#BF360C;display:flex;gap:6px;align-items:center">
                      <i class="ti ti-trending-down" style="font-size:14px"></i>
                      <div><strong>Margen de {{ margenItem(it) }}% en {{ it.cod_alt }}</strong> — por debajo del mínimo de {{ MARGEN_MINIMO }}%.</div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- SIDEBAR TOTALES Y PAGOS -->
      <div>
        <div class="total-box">
          <div class="total-row">
            <span>Subtotal (precio de lista)</span>
            <span id="t-subtotal">{{ fmtUSD(store.subtotalCarrito) }}</span>
          </div>
          <div v-if="store.subtotalCarrito - t.subtotal > 0.004" class="total-row" style="color:var(--lgold)">
            <span>Descuento manual</span>
            <span>−{{ fmtUSD(store.subtotalCarrito - t.subtotal) }}</span>
          </div>
          <div class="total-row iva-zero">
            <span><i class="ti ti-info-circle"></i> IVA (exento)</span>
            <span>$ 0,00</span>
          </div>

          <div class="total-row big">
            <span>Total ($BCV)</span>
            <span id="t-total-bcv">{{ fmtUSD(t.subtotal) }}</span>
          </div>

          <div class="total-row big" style="background:#FDF6E3;margin:4px -14px;padding:8px 14px;border-radius:4px">
            <span style="color:#5D4037">
              Cobrar en efectivo $
              <span
                class="badge"
                :style="{ fontSize: '9px', marginLeft: '4px', cursor: store.rol === 'gerente' ? 'pointer' : 'default', background: store.dtoDivisaExcedente > 0 ? 'var(--red)' : 'var(--blue)', color: '#fff' }"
                :title="store.dtoDivisaExcedente > 0 ? 'Conversión + ' + store.dtoDivisaExcedente.toFixed(1) + ' puntos de descuento real' : 'Solo conversión a la brecha del día'"
                @click="store.rol === 'gerente' && (store.modalDtoDivisaActivo = true)"
              >−{{ store.dtoDivisaPct.toFixed(1) }}%</span>
            </span>
            <span style="color:#5D4037;font-weight:800">{{ fmtUSD(t.totalUsd) }}</span>
          </div>
          <div v-if="store.dtoDivisaExcedente > 0" style="font-size:10.5px;color:#FFD9D9;margin:2px 0 4px">
            Regalas {{ store.dtoDivisaExcedente.toFixed(1) }} pts sobre la brecha = {{ fmtUSD(t.subtotal * store.dtoDivisaExcedente / 100) }}. Se registra como descuento.
          </div>
          <div v-if="t.ajuste && Math.abs(t.ajuste.dif) >= 0.005" :style="{ fontSize: '10.5px', margin: '2px 0 4px', color: t.ajuste.arriba ? '#FFD9D9' : '#FFF' }">
            <template v-if="t.ajuste.arriba">⚠ Estás cobrando {{ fmtUSD(t.ajuste.dif) }} de MÁS en efectivo. Asegúrate de que el cliente lo sepa.</template>
            <template v-else>Ajuste de {{ fmtUSD(Math.abs(t.ajuste.dif)) }} para cobrar {{ fmtUSD(t.ajuste.objetivo) }} en billetes. Sale de tu utilidad.</template>
          </div>
          <div v-if="store.rol === 'gerente' && t.subtotal > 0" style="display:flex;gap:6px;align-items:center;margin:4px 0 6px;font-size:11px">
            <span style="color:rgba(255,255,255,.8)">Cobro redondo:</span>
            <input type="text" inputmode="decimal" :value="store.carrito.cobrar_verde || ''" placeholder="—"
              class="val-input" style="width:80px;padding:3px 6px;font-size:12px"
              @change="store.fijarCobrarVerde(parseMontoVE($event.target.value))">
            <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px" @click="store.redondearCobrarVerde()">Redondear</button>
            <button v-if="store.carrito.cobrar_verde" class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:10px" @click="store.fijarCobrarVerde(null)">×</button>
          </div>

          <div class="total-row small" style="border:none;padding-bottom:0">
            <span>Cobrar en Bs (tasa BCV {{ store.tasa_bcv }})</span>
            <span id="t-bs" style="font-weight:700;color:#FFF">{{ fmtBsMonto(t.totalBs) }}</span>
          </div>
          <div class="total-row small" style="border:none;padding-top:4px;color:rgba(255,255,255,0.6);font-size:10px;justify-content:flex-end;gap:8px">
            <span>Brecha cambiaria:</span>
            <span style="font-weight:600">{{ brechaCambiaria }}%</span>
          </div>
        </div>

        <!-- PAGOS MÚLTIPLES: cada pago se mide contra el total anunciado en SU moneda -->
        <div class="pago-section" style="margin-top:14px">
          <div class="pago-tit"><i class="ti ti-coins"></i> Forma de pago — descuenta del total</div>

          <div v-for="(p, pidx) in store.carrito.pagos" :key="pidx" style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12.5px">
            <div>
              <strong>{{ p.metodo }}</strong> <span v-if="p.ref" style="color:var(--text-muted)">(Ref. {{ p.ref }})</span>
              <div style="font-size:11px;color:var(--text-muted)">Cubre {{ (fraccionDe(p) * 100).toFixed(1) }}% de la factura</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:700;color:var(--green)">{{ p.moneda === 'USD' ? fmtUSD(p.monto) : fmtBsMonto(p.monto) }}</span>
              <button class="btn btn-danger btn-sm" style="padding:2px 6px;font-size:11px" @click="store.removerPagoCarrito(pidx)">&times;</button>
            </div>
          </div>

          <div v-if="mostrarFormPago" style="margin-top:10px;background:var(--card-bg);padding:12px;border-radius:8px;border:1px solid var(--border)">
            <select v-model="nuevoMetodo" @change="completarMonto" class="val-input" style="width:100%;margin-bottom:8px">
              <option v-for="m in METODOS_PAGO" :key="m" :value="m">{{ m }}</option>
            </select>
            <div style="display:flex;gap:8px;margin-bottom:8px">
              <div style="flex:1;display:flex;align-items:center;gap:4px">
                <span style="font-weight:700;color:var(--dgray);min-width:22px">{{ monedaNueva === 'USD' ? '$' : 'Bs' }}</span>
                <input v-model="nuevoMontoTexto" type="text" inputmode="decimal" placeholder="0,00" class="val-input" style="width:100%"
                  :class="{ 'is-invalid': errorsPago.monto }" @input="errorsPago.monto = null">
              </div>
              <input v-model="nuevaRef" type="text" :placeholder="requiereReferencia(nuevoMetodo) ? 'Referencia (obligatoria)' : 'Referencia'" class="val-input" style="flex:1"
                :class="{ 'is-invalid': errorsPago.ref }" @input="errorsPago.ref = null">
            </div>
            <span v-if="errorsPago.monto" class="field-error"><i class="ti ti-alert-circle"></i> {{ errorsPago.monto }}</span>
            <span v-if="errorsPago.ref" class="field-error"><i class="ti ti-alert-circle"></i> {{ errorsPago.ref }}</span>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px">
              <button class="btn btn-secondary btn-sm" title="Llenar con el monto exacto que falta" @click="completarMonto">Completar</button>
              <div style="display:flex;gap:8px">
                <button class="btn btn-secondary btn-sm" @click="mostrarFormPago = false">Cancelar</button>
                <button class="btn btn-success btn-sm" @click="agregarPago">
                  <i class="ti ti-plus"></i> Agregar
                </button>
              </div>
            </div>
          </div>

          <button v-else class="add-pago" style="margin-top:8px" @click="abrirFormPago">
            <i class="ti ti-plus"></i> Agregar forma de pago
          </button>

          <div class="saldo-row" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
            <span>{{ store.faltaPorPagarUSD > 0.1 ? 'Falta por pagar ($BCV):' : '✓ Pago completo' }}</span>
            <span style="font-weight:800;font-size:15px" :style="{ color: store.faltaPorPagarUSD > 0.1 ? 'var(--red)' : 'var(--green)' }">
              {{ fmtUSD(store.faltaPorPagarUSD > 0.1 ? store.faltaPorPagarUSD : 0) }}
            </span>
          </div>
          <div v-if="store.faltaPorPagarUSD > 0.1 && t.subtotal > 0" style="font-size:11px;color:var(--dgray);text-align:right">
            Equivale a {{ fmtUSD(t.totalUsd * store.faltaPorPagarUSD / t.subtotal) }} en efectivo o {{ fmtBsMonto(t.totalBs * store.faltaPorPagarUSD / t.subtotal) }}
          </div>

          <div
            v-if="store.carrito.tipo_pago === 'contado' && store.faltaPorPagarUSD > 1 && t.subtotal > 0"
            style="margin-top:10px;background:#FDECEA;border:1px solid #F5C2C7;border-left:4px solid var(--red);color:#842029;padding:9px 12px;border-radius:6px;font-size:12px;line-height:1.45"
          >
            <strong>Venta de contado:</strong> registra el pago completo para poder emitir.
          </div>
          <div
            v-else-if="store.carrito.tipo_pago === 'credito' && store.carrito.pagos.length > 0 && t.subtotal > 0"
            style="margin-top:10px;background:#E8F0F8;border-left:4px solid var(--blue);padding:8px 12px;border-radius:6px;font-size:12px"
          >
            Abono inicial: <strong>{{ fmtUSD(store.totalPagadoCarritoUSD) }}</strong> · queda a crédito <strong>{{ fmtUSD(store.faltaPorPagarUSD) }}</strong>
          </div>
        </div>

        <!-- CONDICIÓN DE PAGO -->
        <div class="pago-section" style="margin-top:12px">
          <div class="pago-tit"><i class="ti ti-calendar"></i> Término Comercial</div>
          <div style="display:flex;gap:8px;align-items:center;margin:10px 0">
            <label style="font-size:12px;font-weight:600;color:var(--text);min-width:40px">Tipo:</label>
            <select v-model="store.carrito.tipo_pago" id="tipo-pago-factura" class="val-input" style="flex:1">
              <option value="contado">Contado</option>
              <option value="credito">Crédito</option>
            </select>
            <select v-if="store.carrito.tipo_pago === 'credito'" v-model.number="store.carrito.dias_credito" id="dias-credito" class="val-input" style="width:110px">
              <option :value="15">15 días</option>
              <option :value="30">30 días</option>
              <option :value="45">45 días</option>
              <option :value="60">60 días</option>
            </select>
          </div>
          <div v-if="store.carrito.cotizacion_origen" style="font-size:11.5px;color:var(--navy)">
            <i class="ti ti-file-text"></i> Desde cotización <strong>{{ store.carrito.cotizacion_origen.num }}</strong> (precios cotizados)
          </div>
        </div>

        <div class="fiscal-check" style="margin-top:10px">
          <input v-model="store.carrito.pidio_fiscal" type="checkbox" id="emitir-fiscal">
          <label for="emitir-fiscal">
            <i class="ti ti-receipt-tax"></i> El cliente pidió factura fiscal
            <small>Al emitir, te recordará registrar también en el sistema fiscal homologado</small>
          </label>
        </div>

        <div class="action-buttons" style="margin-top:14px">
          <button class="btn btn-secondary" @click="cancelarFactura">
            <i class="ti ti-x"></i> Cancelar
          </button>
          <button class="btn btn-green" id="btn-emitir" :disabled="!!motivoBloqueo || store.procesando" @click="confirmarEmitir">
            <i class="ti ti-printer"></i> {{ store.procesando ? 'Emitiendo...' : 'Emitir e Imprimir' }}
          </button>
        </div>
        <div v-if="motivoBloqueo && store.carrito.items.length > 0" style="margin-top:6px;font-size:11.5px;color:var(--red);text-align:right;font-weight:600">
          <i class="ti ti-lock"></i> {{ motivoBloqueo }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useArjStore } from '../stores/useArjStore.js';
import { fmtUSD, fmtBsMonto, precioConTier, costoLanded, sinFob, MARGEN_MINIMO } from '../services/pricing.js';
import { METODOS_PAGO, monedaDeMetodo, requiereReferencia, parseMontoVE, fraccionPagada } from '../services/cobros.js';

const store = useArjStore();
const tabBusqueda = ref('normal');
const busquedaTexto = ref('');
const busquedaAplicacion = ref('');
const codigoBarrasInput = ref('');
const ultimoEscaneado = ref('');
const textoImportar = ref('');
const mostrarResultados = ref(false);

const t = computed(() => store.totales);

// ── Pagos ──
const mostrarFormPago = ref(false);
const nuevoMetodo = ref(METODOS_PAGO[0]);
const nuevoMontoTexto = ref('');
const nuevaRef = ref('');
const errorsPago = ref({});
const monedaNueva = computed(() => monedaDeMetodo(nuevoMetodo.value));


// Fracción de la factura que cubre un pago (contra el total en SU moneda)
function fraccionDe(p) {
  return fraccionPagada([p], t.value);
}

// "Completar": llena el monto exacto que falta en la moneda del método
function completarMonto() {
  errorsPago.value = {};
  const falta = Math.max(0, 1 - fraccionPagada(store.carrito.pagos, t.value));
  const monto = monedaNueva.value === 'USD' ? falta * t.value.totalUsd : falta * t.value.totalBs;
  nuevoMontoTexto.value = monto > 0 ? (Math.round(monto * 100) / 100).toFixed(2).replace('.', ',') : '';
}

function abrirFormPago() {
  mostrarFormPago.value = true;
  nuevoMetodo.value = METODOS_PAGO[0];
  nuevaRef.value = '';
  completarMonto();
}

function agregarPago() {
  errorsPago.value = {};
  const monto = parseMontoVE(nuevoMontoTexto.value);
  if (!(monto > 0)) errorsPago.value.monto = 'Ingresa un monto válido mayor a 0';
  if (requiereReferencia(nuevoMetodo.value) && !nuevaRef.value.trim()) {
    errorsPago.value.ref = 'La referencia es obligatoria para ' + nuevoMetodo.value;
  }
  if (Object.keys(errorsPago.value).length) return;
  if (store.agregarPagoCarrito({ metodo: nuevoMetodo.value, monto, ref: nuevaRef.value })) {
    mostrarFormPago.value = false;
    nuevoMontoTexto.value = '';
    nuevaRef.value = '';
  }
}

const motivoBloqueo = computed(() => store.validarEmision());

const fechaHoy = computed(() => new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }));

const clienteSeleccionado = computed(() => {
  if (!store.carrito.cliente_id) return null;
  return store.clientes.find(c => c.id === store.carrito.cliente_id);
});

const brechaCambiaria = computed(() => {
  if (store.tasa_bcv <= 0) return '0.00';
  return (((store.tasa_par - store.tasa_bcv) / store.tasa_bcv) * 100).toFixed(2);
});

const busquedaCliente = ref(store.carrito.cliente_nombre || '');
const mostrarClientes = ref(false);

const clientesFiltrados = computed(() => {
  const query = busquedaCliente.value.trim().toLowerCase();
  if (!query) return store.clientes.slice(0, 50);
  return store.clientes.filter(c =>
    (c.nombre || '').toLowerCase().includes(query) || (c.rif || '').toLowerCase().includes(query)
  ).slice(0, 50);
});

const productosFiltrados = computed(() => {
  const query = busquedaTexto.value.trim().toLowerCase();
  if (!query) return [];
  return store.productos.filter(p =>
    (p.cod_alt || '').toLowerCase().includes(query) ||
    (p.cod_orig || '').toLowerCase().includes(query) ||
    (p.desc || '').toLowerCase().includes(query) ||
    (p.marca || '').toLowerCase().includes(query)
  ).slice(0, 10);
});

const productosPorAplicacion = computed(() => {
  const q = busquedaAplicacion.value.trim().toLowerCase();
  if (!q) return [];
  return store.productos.filter(p =>
    (p.marca_modelo || '').toLowerCase().includes(q) ||
    (p.marca || '').toLowerCase().includes(q) ||
    (p.sistema || '').toLowerCase().includes(q)
  ).slice(0, 15);
});

const productosFavoritos = computed(() => store.productos.filter(p => store.favoritos.includes(p.cod_alt)).slice(0, 8));

function stockDe(p) {
  const prod = store.productos.find(x => x.id === p.id) || p;
  return store.empresa === 'directa' ? (prod.stock_vd || 0) : (prod.stock_dist || 0);
}

function margenItem(it) {
  const costo = costoLanded(it, store.productos);
  if (costo <= 0 || it.precio <= 0) return 0;
  return Math.round(((it.precio - costo) / it.precio) * 100);
}

function seleccionarCliente(cli) {
  store.seleccionarCliente(cli);
  busquedaCliente.value = cli ? cli.nombre : '';
  mostrarClientes.value = false;
}

function seleccionarConsumidorFinal() {
  const cf = store.clientes.find(c => /consumidor final/i.test(c.nombre || ''));
  if (!cf) {
    store.notif('No existe el cliente "CONSUMIDOR FINAL" en la base de datos. Regístralo primero.', 'error');
    return;
  }
  seleccionarCliente(cf);
}

function seleccionarProducto(p) {
  store.agregarAlCarrito(p, 1);
  busquedaTexto.value = '';
  mostrarResultados.value = false;
}

function escanearBarras() {
  const code = codigoBarrasInput.value.trim();
  if (!code) return;
  const prod = store.productos.find(p => p.cod_barras === code || p.cod_alt === code);
  if (prod) {
    store.agregarAlCarrito(prod, 1);
    ultimoEscaneado.value = `${prod.cod_alt} - ${prod.desc}`;
    codigoBarrasInput.value = '';
  } else {
    store.notif(`Código '${code}' no encontrado`, 'warning');
  }
}

function procesarImportacion() {
  let procesados = 0;
  const noEncontrados = [];
  textoImportar.value.split('\n').forEach(line => {
    const parts = line.trim().split(/[\s,;]+/);
    if (!parts[0]) return;
    const code = parts[0].trim();
    const cant = parseInt(parts[1]) || 1;
    const prod = store.productos.find(p => p.cod_alt === code || p.cod_orig === code);
    if (prod) { store.agregarAlCarrito(prod, cant); procesados++; } else noEncontrados.push(code);
  });
  if (procesados > 0) {
    store.notif(`Se importaron ${procesados} productos` + (noEncontrados.length ? ` · no encontrados: ${noEncontrados.join(', ')}` : ''), noEncontrados.length ? 'warning' : 'success');
    textoImportar.value = '';
  } else {
    store.notif('No se encontraron códigos coincidentes para importar', 'warning');
  }
}

function cancelarFactura() {
  if (store.carrito.items.length && !confirm('¿Descartar la factura en curso?')) return;
  store.limpiarCarrito();
  busquedaCliente.value = '';
}

async function confirmarEmitir() {
  const err = store.validarEmision();
  if (err) {
    alert('No se puede emitir:\n\n' + err);
    return;
  }
  const negativos = store.carrito.items.filter(it => it.cant > stockDe(it));
  if (negativos.length > 0) {
    const detalle = negativos.map(it => `• ${it.cod_alt} (Solicitado: ${it.cant}, Disponible: ${stockDe(it)})`).join('\n');
    if (!confirm(`⚠ PRÉSTAMO INTER-EMPRESA:\n${negativos.length} producto(s) superan el stock en ${store.empresa === 'directa' ? 'Venta Directa' : 'Distribuidora'}:\n\n${detalle}\n\n¿Emitir de todas formas?`)) return;
  }
  const resumen = `Cliente: ${store.carrito.cliente_nombre}\nTotal: ${fmtUSD(t.value.subtotal)} ($BCV)\n` +
    (store.carrito.tipo_pago === 'credito' ? `Crédito ${store.carrito.dias_credito} días · queda debiendo ${fmtUSD(store.faltaPorPagarUSD)}` : 'Contado');
  if (!confirm('¿Emitir e imprimir esta factura?\n\n' + resumen)) return;
  const r = await store.emitirFactura();
  if (r && r.ok) busquedaCliente.value = '';
  else if (r && r.error) alert('La factura NO se emitió.\n\n' + r.error);
}
</script>
