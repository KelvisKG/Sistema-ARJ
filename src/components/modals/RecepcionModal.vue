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
                {{ emb.codigo }} — {{ emb.proveedor }} (×{{ Number(emb.factor || 0).toFixed(4) }})
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
          <span v-if="modo === 'conteo'">No contados (no se tocan): <strong>{{ noContados.length }}</strong></span>
          <span v-if="embarqueSel">Se sellan: <strong>{{ sello.sellar }}</strong><span v-if="sello.conflictos.length" style="color:var(--red)"> · {{ sello.conflictos.length }} en conflicto</span></span>
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

      <!-- PASO 3: RESULTADO -->
      <div v-else-if="paso === 3 && resultado" style="text-align:center;padding:20px">
        <i class="ti ti-circle-check" style="font-size:44px;color:var(--green)"></i>
        <div style="font-size:17px;font-weight:600;color:var(--navy);margin-top:10px">Registro {{ resultado.numero }}</div>
        <div style="font-size:12.5px;color:var(--dgray);margin-top:4px">
          {{ resultado.renglones }} producto(s) · {{ resultado.unidades }} unidad(es)
          <span v-if="resultado.no_contados"> · {{ resultado.no_contados }} no contado(s)</span>
          <span v-if="resultado.sellados"> · {{ resultado.sellados }} sellado(s)</span>
        </div>
        <div v-if="resultado.conflictos && resultado.conflictos.length" style="background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;padding:10px;margin-top:12px;text-align:left;font-size:12px;color:#5D4037">
          <strong>{{ resultado.conflictos.length }} NO se sellaron</strong> (ya venían de otro embarque):
          <div v-for="c in resultado.conflictos" :key="c.cod_alt">· {{ c.cod_alt }} → {{ c.otro }}</div>
        </div>
      </div>

      <!-- BOTONES DE ACCIÓN -->
      <div class="modal-actions">
        <button class="btn btn-secondary" :disabled="aplicando" @click="cerrar">{{ paso === 3 ? 'Cerrar' : 'Cancelar' }}</button>
        <button v-if="paso === 2" class="btn btn-secondary" :disabled="aplicando" @click="paso = 1">← Volver a Editar</button>
        <button v-if="paso === 1" class="btn btn-primary" @click="revisarEntrada">
          <i class="ti ti-eye"></i> Revisar antes de aplicar
        </button>
        <button v-if="paso === 2" class="btn btn-success" :disabled="aplicando" @click="aplicarRecepcion">
          <i class="ti ti-check"></i> {{ aplicando ? 'Aplicando...' : 'Aplicar al Almacén' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
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
const aplicando = ref(false);
const resultado = ref(null);

const embarqueSel = computed(() => store.embarques.find(e => e.id === embarqueSeleccionado.value) || null);
const campo = computed(() => (almacenDestino.value === 'vd' ? 'stock_vd' : 'stock_dist'));

// Sellado: productos sin embarque se sellan; los de OTRO embarque no se tocan
const sello = computed(() => {
  const r = { sellar: 0, conflictos: [] };
  if (!embarqueSel.value) return r;
  itemsProcesados.value.filter(i => i.encontrado).forEach(i => {
    const p = store.productos.find(x => x.id === i.productoId);
    if (!p) return;
    if (p.embarque_id && p.embarque_id !== embarqueSel.value.id) {
      const otro = store.embarques.find(e => e.id === p.embarque_id);
      r.conflictos.push(`${p.cod_alt} → ${otro ? otro.codigo : 'otro embarque'}`);
    } else if (!p.embarque_id) r.sellar++;
  });
  return r;
});

// En un conteo: lo que tiene stock en el sistema y no apareció en la lista
const noContados = computed(() => {
  if (modo.value !== 'conteo') return [];
  const contados = new Set(itemsProcesados.value.filter(i => i.encontrado).map(i => i.productoId));
  return store.productos.filter(p => (p[campo.value] || 0) > 0 && !contados.has(p.id));
});

function cerrar() {
  store.modalRecepcionActivo = false;
  paso.value = 1;
  textoEntrada.value = '';
  itemsProcesados.value = [];
  errors.value = {};
  resultado.value = null;
}

function revisarEntrada() {
  errors.value = {};
  if (!textoEntrada.value.trim()) {
    errors.value.texto = 'Pega al menos un código y su cantidad';
    return;
  }
  const porProducto = new Map();
  const lista = [];
  textoEntrada.value.trim().split('\n').forEach(l => {
    const parts = l.trim().split(/[\t,; ]+/);
    if (parts.length < 2 || !parts[0]) return;
    const cod = parts[0].trim();
    const cant = parseInt(parts[1]);
    if (!Number.isFinite(cant) || cant < 0) {
      lista.push({ codigo: cod, desc: 'Cantidad inválida', productoId: null, stockActual: 0, cantidad: 0, diferencia: 0, encontrado: false });
      return;
    }
    const p = store.productos.find(x => (x.cod_alt || '').toLowerCase() === cod.toLowerCase() ||
      (x.cod_orig && x.cod_orig.toLowerCase() === cod.toLowerCase()));
    if (!p) {
      lista.push({ codigo: cod, desc: 'Producto no encontrado en catálogo', productoId: null, stockActual: 0, cantidad: cant, diferencia: 0, encontrado: false });
      return;
    }
    // Código repetido: se suman las cantidades en una sola partida
    if (porProducto.has(p.id)) {
      const it = porProducto.get(p.id);
      it.cantidad += cant;
      it.diferencia = it.cantidad - it.stockActual;
      return;
    }
    const stockActual = p[campo.value] || 0;
    const it = { codigo: p.cod_alt, desc: p.desc, productoId: p.id, stockActual, cantidad: cant, diferencia: cant - stockActual, encontrado: true };
    porProducto.set(p.id, it);
    lista.push(it);
  });
  if (!lista.some(r => r.encontrado)) {
    store.notif('No se detectaron partidas válidas (código y cantidad)', 'error');
    return;
  }
  itemsProcesados.value = lista;
  paso.value = 2;
}

async function aplicarRecepcion() {
  const validos = itemsProcesados.value.filter(i => i.encontrado);
  let items;
  if (modo.value === 'conteo') {
    // Los que cuadran no cambian stock, pero se envían si hay embarque para sellarlos
    items = validos.filter(i => i.diferencia !== 0 || embarqueSel.value).map(i => ({ producto_id: i.productoId, fisico: i.cantidad }));
  } else {
    items = validos.filter(i => i.cantidad > 0).map(i => ({ producto_id: i.productoId, cantidad: i.cantidad }));
  }
  if (!items.length && !noContados.value.length) {
    store.notif('No hay cambios que aplicar', 'info');
    return;
  }
  const texto = modo.value === 'conteo'
    ? `Se ajustará el stock de ${items.length} producto(s) al conteo físico.\nLos ${noContados.value.length} no contados NO se tocan (solo se anotan).`
    : `Se van a SUMAR las cantidades a ${items.length} producto(s).`;
  const textoSello = embarqueSel.value
    ? `\n\nSe sellarán ${sello.value.sellar} producto(s) con ${embarqueSel.value.codigo} (factor ${Number(embarqueSel.value.factor).toFixed(4)}).`
    : '';
  if (!confirm(texto + textoSello + '\n\n¿Aplicar?')) return;

  aplicando.value = true;
  try {
    const r = await store.aplicarRecepcion({
      tipo: modo.value,
      destino: almacenDestino.value === 'vd' ? 'directa' : 'dist',
      embarqueId: embarqueSeleccionado.value || null,
      referencia: referencia.value.trim(),
      items,
      noContados: noContados.value.map(p => p.id)
    });
    if (r) {
      resultado.value = r;
      paso.value = 3;
    }
  } finally {
    aplicando.value = false;
  }
}
</script>
