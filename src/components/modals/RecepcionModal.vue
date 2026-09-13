<template>
  <div v-if="store.modalRecepcionActivo" class="modal show" id="modal-recepcion">
    <div class="modal-content" style="max-width:880px;text-align:left;max-height:90vh;overflow-y:auto">
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="modal-icon" style="background:rgba(37,99,235,0.12);color:var(--primary);margin:0;width:38px;height:38px;font-size:18px">
            <i class="ti ti-truck-delivery"></i>
          </div>
          <div>
            <h3 style="margin:0;font-size:17px;color:var(--text);font-weight:700">Recepción de Mercancía y Conteo Físico</h3>
            <span style="font-size:12px;color:var(--text-muted)">Ingreso masivo de stock o conciliación de inventario</span>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" @click="cerrar"><i class="ti ti-x"></i></button>
      </div>

      <!-- PASO 1: PEGAR Y CONFIGURAR -->
      <div v-if="paso === 1">
        <div class="help-box" style="margin-bottom:14px">
          <i class="ti ti-info-circle"></i>
          <span>Pega una línea por producto: <strong>código</strong> y <strong>cantidad</strong>, separados por tabulador o espacio. Copiar y pegar directamente desde Excel funciona directo.</span>
        </div>

        <div style="display:grid;grid-template-columns:1.5fr 1fr 1fr 1.5fr;gap:12px;margin-bottom:14px">
          <div class="field-col">
            <label>¿Qué vas a hacer?</label>
            <select v-model="modo" class="val-input">
              <option value="conteo">Conteo físico — comparar contra el sistema</option>
              <option value="recepcion">Recepción — sumar al stock actual</option>
            </select>
          </div>

          <div class="field-col">
            <label>Almacén destino</label>
            <select v-model="almacenDestino" class="val-input">
              <option value="dist">Distribuidora</option>
              <option value="vd">Venta Directa</option>
            </select>
          </div>

          <div class="field-col">
            <label>Referencia</label>
            <input v-model="referencia" type="text" class="val-input" placeholder="Ej: Contenedor Santos 1">
          </div>

          <div class="field-col">
            <label>Embarque vinculado</label>
            <select v-model="embarqueSeleccionado" class="val-input">
              <option value="">Sin embarque (costo actual)</option>
              <option v-for="emb in store.embarques" :key="emb.id" :value="emb.id">
                {{ emb.id }} — {{ emb.proveedor }}
              </option>
            </select>
          </div>
        </div>

        <div class="field-col" style="margin-bottom:12px">
          <label>Pega los códigos y cantidades:</label>
          <textarea
            v-model="textoEntrada"
            placeholder="BOM-JD-5075&#9;12&#10;EMB-MF-290&#9;4&#10;FIL-DON-P550008&#9;30"
            class="val-input"
            style="min-height:180px;font-family:ui-monospace,Menlo,Consolas,monospace;resize:vertical;line-height:1.5"
            :class="{ 'is-invalid': errors.texto }"
            @input="errors.texto = null"
          ></textarea>
          <span v-if="errors.texto" class="field-error"><i class="ti ti-alert-circle"></i> {{ errors.texto }}</span>
        </div>
      </div>

      <!-- PASO 2: REVISIÓN Y COMPARACIÓN -->
      <div v-else-if="paso === 2">
        <div style="background:rgba(217,119,6,0.1);border:1px solid rgba(217,119,6,0.25);border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:13px;color:var(--text);display:flex;gap:16px;flex-wrap:wrap">
          <span>Modo: <strong style="color:var(--gold)">{{ modo === 'conteo' ? 'Conteo Físico' : 'Recepción de Mercancía' }}</strong></span>
          <span>Almacén: <strong>{{ almacenDestino === 'vd' ? 'Venta Directa' : 'Distribuidora' }}</strong></span>
          <span>Partidas procesadas: <strong style="color:var(--primary)">{{ itemsProcesados.length }}</strong></span>
        </div>

        <div style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:10px">
          <table class="simple-tbl" style="width:100%;font-size:12.5px;margin:0">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Stock Actual</th>
                <th>{{ modo === 'conteo' ? 'Conteo' : 'A Ingresar' }}</th>
                <th>{{ modo === 'conteo' ? 'Diferencia' : 'Stock Resultante' }}</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(it, i) in itemsProcesados" :key="i">
                <td><strong style="color:var(--primary)">{{ it.codigo }}</strong></td>
                <td>{{ it.desc }}</td>
                <td>{{ it.stockActual }} ud</td>
                <td><strong style="color:var(--primary)">{{ it.cantidad }} ud</strong></td>
                <td>
                  <span v-if="modo === 'conteo'" :style="{ color: it.diferencia < 0 ? 'var(--red)' : it.diferencia > 0 ? 'var(--green)' : 'var(--text-muted)', fontWeight: 700 }">
                    {{ it.diferencia > 0 ? '+' : '' }}{{ it.diferencia }} ud
                  </span>
                  <span v-else style="color:var(--green);font-weight:700">
                    {{ it.stockActual + it.cantidad }} ud
                  </span>
                </td>
                <td>
                  <span v-if="it.encontrado" class="badge badge-success">Encontrado</span>
                  <span v-else class="badge badge-danger">No registrado</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- BOTONES DE ACCIÓN -->
      <div class="modal-actions">
        <button class="btn btn-secondary" @click="cerrar">Cancelar</button>
        <button v-if="paso === 2" class="btn btn-secondary" @click="paso = 1">← Volver a Editar</button>
        <button v-if="paso === 1" class="btn btn-primary" @click="revisarEntrada">
          <i class="ti ti-eye"></i> Revisar antes de aplicar
        </button>
        <button v-if="paso === 2" class="btn btn-success" @click="aplicarRecepcion">
          <i class="ti ti-check"></i> Aplicar al Almacén
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';

const store = useArjStore();
const paso = ref(1);
const modo = ref('recepcion');
const almacenDestino = ref('dist');
const referencia = ref('');
const embarqueSeleccionado = ref('');
const textoEntrada = ref('');
const itemsProcesados = ref([]);
const errors = ref({});

function cerrar() {
  store.modalRecepcionActivo = false;
  paso.value = 1;
  textoEntrada.value = '';
  itemsProcesados.value = [];
  errors.value = {};
}

function revisarEntrada() {
  errors.value = {};

  if (!textoEntrada.value.trim()) {
    errors.value.texto = 'Pega al menos un código y su cantidad';
    store.notif('Pega al menos un código y su cantidad', 'error');
    return;
  }

  const lineas = textoEntrada.value.trim().split('\n');
  const resultado = [];

  lineas.forEach(l => {
    const trimmed = l.trim();
    if (!trimmed) return;

    const parts = trimmed.split(/[\t,; ]+/);
    if (parts.length < 2) return;

    const cod = parts[0].trim();
    const cant = parseInt(parts[1].trim()) || 0;

    const p = store.productos.find(prod => prod.cod_alt.toLowerCase() === cod.toLowerCase() || (prod.cod_orig && prod.cod_orig.toLowerCase() === cod.toLowerCase()));

    const stockActual = p ? (almacenDestino.value === 'vd' ? p.stock_vd : p.stock_dist) : 0;
    const diferencia = cant - stockActual;

    resultado.push({
      codigo: cod,
      desc: p ? p.desc : 'Producto no encontrado en catálogo',
      productoId: p ? p.id : null,
      stockActual,
      cantidad: cant,
      diferencia,
      encontrado: !!p
    });
  });

  if (resultado.length === 0) {
    store.notif('No se detectaron partidas válidas (código y cantidad)', 'error');
    return;
  }

  itemsProcesados.value = resultado;
  paso.value = 2;
}

function aplicarRecepcion() {
  let aplicados = 0;
  itemsProcesados.value.forEach(it => {
    if (!it.encontrado) return;
    const p = store.productos.find(x => x.id === it.productoId);
    if (!p) return;

    if (modo.value === 'conteo') {
      if (almacenDestino.value === 'vd') p.stock_vd = it.cantidad;
      else p.stock_dist = it.cantidad;
    } else {
      if (almacenDestino.value === 'vd') p.stock_vd += it.cantidad;
      else p.stock_dist += it.cantidad;
    }

    store.movimientos.unshift({
      id: Date.now() + Math.random(),
      fecha: new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }),
      tipo: modo.value === 'conteo' ? 'ajuste' : 'entrada',
      producto: p.desc,
      cod_alt: p.cod_alt,
      cant: it.cantidad,
      empresa: almacenDestino.value === 'vd' ? 'directa' : 'distribuidora',
      motivo: `${modo.value === 'conteo' ? 'Ajuste por conteo físico' : 'Recepción de mercancía'} ${referencia.value ? '— ' + referencia.value : ''}`,
      usuario: store.usuarioNombre
    });

    aplicados++;
  });

  store.notif(`${aplicados} partidas actualizadas en el almacén ${almacenDestino.value === 'vd' ? 'Venta Directa' : 'Distribuidora'}`, 'success');
  cerrar();
}
</script>
