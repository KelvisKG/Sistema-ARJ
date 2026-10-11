<template>
  <!-- Recepción de mercancía / conteo físico (monolito v13.4 – v13.21) -->
  <div v-if="store.modalRecepcionActivo" class="modal show" id="modal-recepcion">
    <div class="modal-content" style="max-width:820px;text-align:left;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--gray);padding-bottom:12px">
        <h3 style="margin:0;font-size:18px;color:var(--navy);font-weight:600"><i class="ti ti-truck-delivery"></i> Recepción de mercancía</h3>
        <button class="btn btn-secondary btn-sm" @click="cerrar"><i class="ti ti-x"></i></button>
      </div>

      <!-- PASO 1: pegar -->
      <div v-if="paso === 1">
        <div style="background:var(--lblue);border-radius:6px;padding:9px 12px;margin-bottom:12px;font-size:11.5px;color:var(--navy)">
          <i class="ti ti-info-circle"></i> Pega una línea por producto: <strong>código</strong> y <strong>cantidad</strong>, separados por tabulador, coma, punto y coma o espacios. Copiar y pegar desde Excel funciona directo.
        </div>
        <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap">
          <div style="flex:1.4;min-width:200px">
            <label class="rc-lbl">¿Qué vas a hacer?</label>
            <select v-model="modo" class="val-input" style="width:100%">
              <option value="conteo">Conteo físico — comparar contra el sistema</option>
              <option value="recepcion">Recepción — sumar al stock actual</option>
            </select>
          </div>
          <div style="flex:1;min-width:150px">
            <label class="rc-lbl">Almacén</label>
            <select v-model="destino" class="val-input" style="width:100%">
              <option value="dist">Distribuidora</option>
              <option value="vd">Venta Directa</option>
            </select>
          </div>
          <div v-if="modo === 'conteo'" style="flex:1;min-width:150px">
            <label class="rc-lbl">Solo marca</label>
            <select v-model="soloMarca" class="val-input" style="width:100%">
              <option value="">Todas las marcas</option>
              <option v-for="m in marcas" :key="m.marca" :value="m.marca">{{ m.marca }} ({{ m.n }})</option>
            </select>
          </div>
          <div style="flex:1;min-width:150px">
            <label class="rc-lbl">Referencia</label>
            <input v-model="referencia" type="text" class="val-input" placeholder="Ej: Contenedor Santos 1" style="width:100%">
          </div>
          <div style="flex:1.4;min-width:230px">
            <label class="rc-lbl">Embarque (sella el costo)</label>
            <select v-model="embId" class="val-input" style="width:100%">
              <option value="">— No sellar costo —</option>
              <option v-for="e in embarquesActivos" :key="e.id" :value="e.id">{{ e.codigo }} · factor {{ (parseFloat(e.factor) || 0).toFixed(4) }}</option>
            </select>
          </div>
        </div>

        <div v-if="!embSel" style="background:#F5F5F5;border-left:3px solid var(--dgray);border-radius:6px;padding:8px 11px;margin-bottom:10px;font-size:11.5px;color:var(--dgray)">
          <i class="ti ti-info-circle"></i> Sin embarque: solo se ajusta el stock. El costo de cada producto queda como está.</div>
        <div v-else style="background:#E8F5E9;border-left:3px solid var(--green);border-radius:6px;padding:8px 11px;margin-bottom:10px;font-size:11.5px;color:#1B5E20">
          <i class="ti ti-ship"></i> Los productos de la lista quedarán sellados con <strong>factor {{ (parseFloat(embSel.factor) || 0).toFixed(4) }}</strong>
          y proveedor <strong>{{ embSel.proveedor }}</strong>. Una pieza de FOB $10 pasará a costar {{ fmtUSD(10 * (parseFloat(embSel.factor) || 0)) }}.</div>

        <div v-if="modo === 'conteo'" style="background:#FFF8E1;border-left:3px solid var(--gold);border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:11.5px;color:#5D4037">
          <i class="ti ti-info-circle"></i> Compara tu conteo contra el sistema y te muestra las diferencias. <strong>No modifica nada</strong> hasta que lo decidas al final.
        </div>
        <div v-else style="background:var(--lgreen);border-left:3px solid var(--green);border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:11.5px;color:#1B5E20">
          <i class="ti ti-plus"></i> Las cantidades se <strong>suman</strong> al stock que ya existe. Para corregir stock usa Conteo físico.
        </div>

        <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;flex-wrap:wrap">
          <div style="flex:1;min-width:170px">
            <label class="rc-lbl">Traer códigos del sistema por marca</label>
            <select v-model="marcaTraer" class="val-input" style="width:100%">
              <option value="">— Elegir marca —</option>
              <option v-for="m in marcas" :key="m.marca" :value="m.marca">{{ m.marca }} ({{ m.n }})</option>
            </select>
          </div>
          <button class="btn btn-secondary btn-sm" @click="traerMarca"><i class="ti ti-download"></i> Traer al cuadro</button>
        </div>
        <textarea v-model="texto" placeholder="5198060	12&#10;82025254	4&#10;5191547-2	30"
          style="width:100%;min-height:180px;background:#FFF;border:1px solid var(--border);border-radius:6px;padding:10px;font-size:13px;font-family:ui-monospace,Menlo,Consolas,monospace;resize:vertical"></textarea>
      </div>

      <!-- PASO 2: revisión — RECEPCIÓN -->
      <div v-else-if="paso === 2 && A && A.tipo === 'recepcion'">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          <div class="rc-kpi" style="background:var(--lgreen)"><div class="rc-kpi-l">Se actualizan</div><div class="rc-kpi-v" style="color:var(--green)">{{ A.ok.length }}</div></div>
          <div class="rc-kpi" style="background:var(--lblue)"><div class="rc-kpi-l">Unidades</div><div class="rc-kpi-v" style="color:var(--navy)">{{ A.ok.reduce((a, r) => a + r.cant, 0).toLocaleString('es-VE') }}</div></div>
          <div class="rc-kpi" style="background:var(--lgold)"><div class="rc-kpi-l">Valor a costo</div><div class="rc-kpi-v" style="color:#854F0B">{{ fmtUSD(A.ok.reduce((a, r) => a + costo(r.prod) * r.cant, 0)) }}</div></div>
        </div>
        <div v-if="A.malas.length" style="background:#FEF5F5;border-left:3px solid var(--red);border-radius:6px;padding:8px 12px;margin-top:8px;font-size:11.5px;color:#B71C1C">
          <i class="ti ti-x"></i> {{ A.malas.length }} línea(s) con problema <strong>no se van a tocar</strong>.</div>
        <div style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-top:10px">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:var(--gray);position:sticky;top:0">
              <th style="text-align:left;padding:7px 10px">Código</th><th style="text-align:left;padding:7px 10px">Descripción</th>
              <th style="text-align:right;padding:7px 10px">Tiene</th><th style="text-align:right;padding:7px 10px">Entra</th>
              <th style="text-align:right;padding:7px 10px">Queda</th></tr></thead>
            <tbody>
              <tr v-for="r in A.ok" :key="r.cod" style="border-top:1px solid var(--border)">
                <td style="padding:6px 10px;font-family:ui-monospace,monospace">{{ r.cod }}<span v-if="r.lineas.length > 1" style="color:var(--dgray);font-size:10px"> ×{{ r.lineas.length }}</span></td>
                <td style="padding:6px 10px;color:var(--dgray)">{{ (r.prod.desc || '').slice(0, 40) }}</td>
                <td style="padding:6px 10px;text-align:right;color:var(--dgray)">{{ r.actual }}</td>
                <td style="padding:6px 10px;text-align:right;font-weight:600">+{{ r.cant }}</td>
                <td style="padding:6px 10px;text-align:right;font-weight:700;color:var(--green)">{{ r.nuevo }}</td>
              </tr>
              <tr v-for="m in A.malas" :key="'m' + m.linea" style="border-top:1px solid var(--border);background:#FEF5F5">
                <td style="padding:6px 10px;color:var(--red);font-family:ui-monospace,monospace">{{ m.cod || '—' }}</td>
                <td colspan="4" style="padding:6px 10px;color:var(--red)">Línea {{ m.linea }}: {{ m.error }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- PASO 2: revisión — CONTEO -->
      <div v-else-if="paso === 2 && A && A.tipo === 'conteo'">
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
          <div class="rc-kpi" style="background:var(--lgreen)"><div class="rc-kpi-l">Cuadran</div><div class="rc-kpi-v" style="color:var(--green)">{{ A.cuadran.length }}</div></div>
          <div class="rc-kpi" :style="{ background: A.faltan.length ? '#FEF5F5' : 'var(--gray)' }"><div class="rc-kpi-l">Falta</div><div class="rc-kpi-v" :style="{ color: A.faltan.length ? 'var(--red)' : 'var(--dgray)' }">{{ A.faltan.length }}</div></div>
          <div class="rc-kpi" :style="{ background: A.sobran.length ? 'var(--lgold)' : 'var(--gray)' }"><div class="rc-kpi-l">Sobra</div><div class="rc-kpi-v" :style="{ color: A.sobran.length ? '#854F0B' : 'var(--dgray)' }">{{ A.sobran.length }}</div></div>
          <div class="rc-kpi" style="background:var(--gray)"><div class="rc-kpi-l">No contados</div><div class="rc-kpi-v" style="color:var(--dgray)">{{ A.noContados.length }}</div></div>
          <div class="rc-kpi" style="background:var(--lblue)"><div class="rc-kpi-l">Descuadre</div><div class="rc-kpi-v" :style="{ color: (valores.falta - valores.sobra) > 0 ? 'var(--red)' : 'var(--navy)' }">{{ fmtUSD(valores.falta - valores.sobra) }}</div></div>
        </div>
        <div style="font-size:11px;color:var(--dgray);margin-top:6px">
          Almacén: <strong>{{ A.nomDest }}</strong><template v-if="A.prov"> · Marca: <strong>{{ A.prov }}</strong></template> ·
          Faltante {{ fmtUSD(valores.falta) }} · Sobrante {{ fmtUSD(valores.sobra) }} — valorado a costo landed
        </div>
        <div v-if="A.noContados.length" style="background:var(--gray);border-radius:6px;padding:8px 11px;margin-top:8px;font-size:11.5px;color:var(--dgray)">
          <i class="ti ti-eye-off"></i> Los <strong>{{ A.noContados.length }} no contados</strong> ({{ fmtUSD(valores.noCont) }}) <strong>NO se van a tocar</strong> —
          no están en tu lista. Para que no aparezcan, usa el filtro <strong>"Solo marca"</strong> arriba.</div>

        <div style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-top:10px;padding:8px">
          <div v-if="!A.faltan.length && !A.sobran.length && !A.noContados.length" style="text-align:center;padding:24px;color:var(--green)">
            <i class="ti ti-circle-check" style="font-size:40px"></i>
            <div style="font-size:15px;font-weight:600;margin-top:8px">Todo cuadra</div>
            <div style="font-size:12px;color:var(--dgray)">El conteo coincide con el sistema en los {{ A.cuadran.length }} productos revisados</div>
            <div v-if="A.sellar.length" style="font-size:12.5px;color:var(--navy);margin-top:10px;background:var(--lblue);border-radius:6px;padding:9px 12px;display:inline-block">
              Falta sellar el costo de <strong>{{ A.sellar.length }}</strong> producto(s) con <strong>{{ A.emb.codigo }}</strong> — usa el botón de abajo.</div>
          </div>
          <!-- Mismo orden que el monolito: Falta, No contados, Sobra, códigos desconocidos, líneas malas, Cuadran -->
          <template v-for="s in secciones" :key="s.id">
            <template v-if="s.id === 'cuadra'">
              <div v-if="A.desconocidos.length" style="background:var(--lblue);padding:8px 12px;border-radius:6px;margin-bottom:10px;font-size:12px;color:var(--navy)">
                <strong><i class="ti ti-help"></i> {{ A.desconocidos.length }} código(s) que no están en el catálogo:</strong><br>
                <span style="font-family:ui-monospace,monospace;font-size:11px">{{ A.desconocidos.map(d => d.cod + ' (' + d.cant + ')').join(' · ') }}</span></div>
              <div v-if="A.malas.length" style="background:#FEF5F5;padding:8px 12px;border-radius:6px;margin-bottom:10px;font-size:12px;color:#B71C1C">
                <strong><i class="ti ti-x"></i> {{ A.malas.length }} línea(s) mal escritas:</strong>
                <div v-for="m in A.malas" :key="m.linea">Línea {{ m.linea }}: {{ m.error }}</div></div>
            </template>
            <div v-if="s.filas.length" style="margin-bottom:10px">
              <div :style="{ cursor: 'pointer', background: s.bg, padding: '8px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }"
                @click="abiertas[s.id] = !abiertas[s.id]">
                <span :style="{ fontWeight: 600, fontSize: '12.5px', color: s.color }"><i :class="'ti ti-' + s.icono"></i> {{ s.titulo }} ({{ s.filas.length }})</span>
                <span style="font-size:10.5px;color:var(--dgray)">{{ s.nota }} ▾</span>
              </div>
              <table v-show="abiertas[s.id]" style="width:100%;border-collapse:collapse;font-size:12px">
                <tbody>
                  <tr v-for="r in s.filas" :key="r.cod" style="border-bottom:1px solid var(--border)">
                    <td style="padding:5px 10px;font-family:ui-monospace,monospace;width:110px">{{ r.cod }}</td>
                    <td style="padding:5px 10px;color:var(--dgray)">{{ (r.prod.desc || '').slice(0, 38) }}</td>
                    <td style="padding:5px 10px;text-align:right;width:70px;color:var(--dgray)">sist. {{ r.sistema }}</td>
                    <td style="padding:5px 10px;text-align:right;width:70px">fís. {{ r.fisico }}</td>
                    <td :style="{ padding: '5px 10px', textAlign: 'right', width: '60px', fontWeight: 700, color: r.dif < 0 ? 'var(--red)' : r.dif > 0 ? '#854F0B' : 'var(--green)' }">{{ r.dif > 0 ? '+' : '' }}{{ r.dif }}</td>
                    <td style="padding:5px 10px;text-align:right;width:85px;color:var(--dgray)">{{ fmtUSD(costo(r.prod) * Math.abs(r.dif)) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </div>

      <!-- PASO 3: resultado -->
      <div v-else-if="paso === 3 && res">
        <div style="text-align:center;padding:22px 10px">
          <i class="ti ti-circle-check" style="font-size:44px;color:var(--green)"></i>
          <div style="font-size:17px;font-weight:600;color:var(--navy);margin-top:10px">{{ res.hechos }} producto(s) {{ res.verbo }}</div>
          <div style="font-size:12.5px;color:var(--dgray);margin-top:4px">{{ res.nomDest }}{{ res.ref ? ' · ' + res.ref : '' }}</div>
          <div v-if="res.sellados" style="background:#E8F5E9;border:1px solid #A5D6A7;border-radius:8px;padding:10px;margin-top:12px;font-size:12px;color:#1B5E20">
            <strong>{{ res.sellados }} producto(s) sellados</strong> con factor {{ (parseFloat(res.emb.factor) || 0).toFixed(4) }} · {{ res.emb.codigo }}</div>
          <div style="background:#E8F0F8;border:1px solid #A9C7E8;border-radius:8px;padding:10px;margin-top:10px;font-size:12px;color:#0D3B66">
            <strong>Registro {{ res.numero }}</strong> · {{ res.renglones }} renglón(es) · {{ res.unidades }} unidad(es)<template v-if="res.no_contados"> · {{ res.no_contados }} no contado(s)</template><br>
            <span style="font-size:11px">Queda guardado cuánto entró, no solo el stock resultante.</span></div>
          <div v-if="res.conflicto.length" style="background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;padding:10px;margin-top:10px;text-align:left;font-size:12px;color:#5D4037">
            <strong>{{ res.conflicto.length }} NO se sellaron</strong> — ya venían de otro embarque y no se tocaron:
            <div v-for="c in res.conflicto" :key="c.cod">· {{ c.cod }} → {{ c.otro }}</div></div>
        </div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;border-top:1px solid var(--gray);padding-top:12px">
        <button v-if="paso !== 2" class="btn btn-secondary" @click="cerrar">{{ paso === 3 ? 'Cerrar' : 'Cancelar' }}</button>
        <button v-if="paso === 2" class="btn btn-secondary" :disabled="aplicando" @click="paso = 1">← Corregir</button>
        <button v-if="paso === 1" class="btn btn-primary" @click="analizar"><i class="ti ti-eye"></i> Revisar antes de aplicar</button>
        <button v-if="paso === 2 && A && A.tipo === 'conteo'" class="btn btn-secondary" :disabled="aplicando" @click="exportar"><i class="ti ti-file-spreadsheet"></i> Descargar reporte</button>
        <button v-if="paso === 2 && botonAplicar" class="btn btn-primary" :disabled="aplicando" @click="aplicar">
          <template v-if="aplicando">Guardando...</template>
          <template v-else><i :class="'ti ti-' + botonAplicar.icono"></i> {{ botonAplicar.texto }}</template>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { fmtUSD, costoLanded } from '../../services/pricing.js';
import { parsearLineas, buscarPorCodigo, descargarCSV, hoyArchivo } from '../../services/monolito.js';

const store = useArjStore();
const paso = ref(1);
const modo = ref('conteo');
const destino = ref('dist');
const soloMarca = ref('');
const referencia = ref('');
const embId = ref('');
const marcaTraer = ref('');
const texto = ref('');
const A = ref(null);
const res = ref(null);
const aplicando = ref(false);
const abiertas = ref({});

const costo = p => costoLanded(p, store.productos);
const activos = computed(() => store.productos.filter(p => p.activo !== false));
const embarquesActivos = computed(() => store.embarques.filter(e => e.activo !== false));
const embSel = computed(() => store.embarques.find(e => e.id === embId.value) || null);

// v13.11: se acota por MARCA (el proveedor está vacío en casi todo el catálogo)
const marcas = computed(() => {
  const n = {};
  activos.value.forEach(p => { const m = (p.marca || '').trim(); if (m) n[m] = (n[m] || 0) + 1; });
  return Object.keys(n).sort().map(m => ({ marca: m, n: n[m] }));
});

watch(() => store.modalRecepcionActivo, abierto => {
  if (!abierto) return;
  paso.value = 1; modo.value = 'conteo'; destino.value = 'dist'; soloMarca.value = ''; referencia.value = '';
  embId.value = ''; marcaTraer.value = ''; texto.value = ''; A.value = null; res.value = null;
}, { immediate: true });

// Trae al cuadro los códigos de una marca con el stock que YA tiene el sistema:
// sirve cuando el conteo ya se cargó a mano y solo falta sellar el costo
function traerMarca() {
  const m = marcaTraer.value;
  if (!m) { store.notif('Elige una marca primero', 'error'); return; }
  const campo = destino.value === 'vd' ? 'stock_vd' : 'stock_dist';
  const lista = activos.value.filter(p => (p.marca || '').trim() === m);
  if (!lista.length) { store.notif('No hay productos de ' + m, 'error'); return; }
  if (texto.value.trim() && !confirm('El cuadro ya tiene texto. ¿Reemplazarlo?')) return;
  texto.value = lista.map(p => `${p.cod_alt}\t${parseInt(p[campo]) || 0}`).join('\n');
  store.notif(`${lista.length} código(s) de ${m} traídos con su stock actual`, 'success');
}

// Separa los productos en: se pueden sellar / ya tienen OTRO embarque
function sellado(an, prods) {
  an.embId = embId.value || '';
  an.sellar = []; an.conflicto = []; an.emb = null;
  if (!an.embId || !embSel.value) { an.embId = ''; return; }
  an.emb = embSel.value;
  prods.forEach(p => {
    if (p.embarque_id && p.embarque_id !== an.embId) {
      const otro = store.embarques.find(x => x.id === p.embarque_id);
      an.conflicto.push({ prod: p, cod: p.cod_alt, otro: otro ? otro.codigo : '(desconocido)' });
    } else if (p.embarque_id !== an.embId) {
      an.sellar.push(p);
    }
  });
}

function analizar() {
  if (!texto.value.trim()) { store.notif('Pega la lista primero', 'error'); return; }
  const campo = destino.value === 'vd' ? 'stock_vd' : 'stock_dist';
  const nomDest = destino.value === 'vd' ? 'Venta Directa' : 'Distribuidora';
  const contado = {}, desconocidos = [], malas = [];
  parsearLineas(texto.value).forEach(f => {
    if (f.error) { malas.push(f); return; }
    const p = buscarPorCodigo(store.productos, f.cod);
    if (!p) { desconocidos.push(f); return; }
    // Un código repetido se ACUMULA: puede venir en dos cajas o contarse en dos estanterías
    if (contado[p.cod_alt]) { contado[p.cod_alt].cant += f.cant; contado[p.cod_alt].lineas.push(f.linea); }
    else contado[p.cod_alt] = { prod: p, cant: f.cant, lineas: [f.linea] };
  });
  const prods = Object.values(contado).map(c => c.prod);

  if (modo.value === 'recepcion') {
    const ok = Object.values(contado).map(c => ({
      prod: c.prod, cod: c.prod.cod_alt, cant: c.cant, lineas: c.lineas,
      actual: c.prod[campo] || 0, nuevo: (c.prod[campo] || 0) + c.cant
    }));
    const an = { tipo: 'recepcion', ok, malas: malas.concat(desconocidos.map(d => ({ ...d, error: 'Código no existe en el catálogo' }))), campo, destino: destino.value, nomDest };
    sellado(an, prods);
    A.value = an;
  } else {
    const cuadran = [], faltan = [], sobran = [];
    Object.values(contado).forEach(c => {
      const sis = c.prod[campo] || 0;
      const dif = c.cant - sis;
      const fila = { prod: c.prod, cod: c.prod.cod_alt, sistema: sis, fisico: c.cant, dif, lineas: c.lineas };
      if (dif === 0) cuadran.push(fila); else if (dif < 0) faltan.push(fila); else sobran.push(fila);
    });
    // NO CONTADOS: tienen stock en el sistema y no aparecen en la lista
    const prov = soloMarca.value;
    const noContados = store.productos.filter(p => (p[campo] || 0) > 0 && !contado[p.cod_alt] && (!prov || (p.marca || '').trim() === prov))
      .map(p => ({ prod: p, cod: p.cod_alt, sistema: p[campo] || 0, fisico: 0, dif: -(p[campo] || 0) }));
    const an = { tipo: 'conteo', cuadran, faltan, sobran, noContados, desconocidos, malas, campo, destino: destino.value, nomDest, prov };
    sellado(an, prods);
    A.value = an;
    abiertas.value = { falta: true, nocont: true, sobra: true, cuadra: false };
  }
  paso.value = 2;
}

// "Falta" y "No contados" son cosas DISTINTAS (v13.11): falta se ajusta, no contado no se toca
const valores = computed(() => {
  const an = A.value;
  if (!an || an.tipo !== 'conteo') return { falta: 0, sobra: 0, noCont: 0 };
  return {
    falta: an.faltan.reduce((a, r) => a + costo(r.prod) * Math.abs(r.dif), 0),
    noCont: an.noContados.reduce((a, r) => a + costo(r.prod) * Math.abs(r.dif), 0),
    sobra: an.sobran.reduce((a, r) => a + costo(r.prod) * r.dif, 0)
  };
});

const secciones = computed(() => {
  const an = A.value;
  if (!an || an.tipo !== 'conteo') return [];
  return [
    { id: 'falta', titulo: 'Falta — el sistema dice más de lo que contaste', filas: an.faltan, color: 'var(--red)', bg: '#FEF5F5', icono: 'alert-triangle', nota: 'revisar' },
    { id: 'nocont', titulo: 'No contados — tienen stock y no están en tu lista', filas: an.noContados, color: 'var(--red)', bg: '#FEF5F5', icono: 'eye-off', nota: '¿no llegaron?' },
    { id: 'sobra', titulo: 'Sobra — contaste más de lo que dice el sistema', filas: an.sobran, color: '#854F0B', bg: 'var(--lgold)', icono: 'plus', nota: 'revisar factura' },
    // "Cuadran" siempre va en la lista: delante de él se pintan desconocidos y líneas malas
    { id: 'cuadra', titulo: 'Cuadran perfecto', filas: an.cuadran, color: 'var(--green)', bg: 'var(--lgreen)', icono: 'circle-check', nota: 'sin diferencia' }
  ];
});

// v13.11: el botón también sale cuando no hay ajuste pero sí costos por sellar
const botonAplicar = computed(() => {
  const an = A.value;
  if (!an) return null;
  if (an.tipo === 'recepcion') return an.ok.length ? { icono: 'check', texto: 'Sumar al stock' } : null;
  const hayAjuste = an.faltan.length + an.sobran.length > 0;
  if (hayAjuste) return { icono: 'adjustments', texto: 'Ajustar sistema al físico' };
  if (an.sellar.length) return { icono: 'ship', texto: `Sellar costo de ${an.sellar.length} producto(s)` };
  return null;
});

function exportar() {
  const an = A.value;
  if (!an || an.tipo !== 'conteo') return;
  const filas = [['CONTEO FÍSICO ARJ — ' + an.nomDest + (an.prov ? ' — Proveedor: ' + an.prov : '')],
    ['Fecha', new Date().toLocaleString('es-VE')],
    ['Referencia', referencia.value.trim()], [],
    ['Grupo', 'Codigo', 'Descripcion', 'Sistema', 'Fisico', 'Diferencia', 'Costo landed unit', 'Valor diferencia']];
  const add = (grupo, arr) => arr.forEach(r => filas.push([grupo, r.cod, r.prod.desc || '',
    r.sistema, r.fisico, r.dif, costo(r.prod).toFixed(2), (costo(r.prod) * Math.abs(r.dif)).toFixed(2)]));
  add('FALTA', an.faltan); add('NO CONTADO', an.noContados); add('SOBRA', an.sobran); add('CUADRA', an.cuadran);
  an.desconocidos.forEach(d => filas.push(['DESCONOCIDO', d.cod, '(no está en el catálogo)', '', d.cant, '', '', '']));
  descargarCSV('ARJ_conteo_' + hoyArchivo() + '.csv', filas);
  store.notif('Reporte descargado', 'success');
}

function textoSellado(an) {
  if (!an.embId) return '\n\nNo se va a tocar ningún costo (sin embarque seleccionado).';
  let t = `\n\nCOSTO: ${an.sellar.length} producto(s) quedarán sellados con factor ${(parseFloat(an.emb.factor) || 0).toFixed(4)} (${an.emb.codigo}).`;
  if (an.conflicto.length) t += `\n${an.conflicto.length} NO se tocarán: ya vienen de otro embarque.`;
  return t;
}

async function aplicar() {
  const an = A.value;
  if (!an) return;
  let items, verbo, n;
  if (an.tipo === 'recepcion') {
    items = an.ok.map(r => ({ producto_id: r.prod.id, cantidad: r.cant }));
    verbo = 'sumados'; n = an.ok.length;
    if (!confirm(`Se van a SUMAR las cantidades a ${n} producto(s) en ${an.nomDest}.` + textoSellado(an) + '\n\n¿Aplicar?')) return;
  } else {
    // Solo lo contado. Los NO CONTADOS jamás se ponen en cero automáticamente
    const ajustes = an.faltan.concat(an.sobran);
    items = ajustes.map(r => ({ producto_id: r.prod.id, fisico: r.fisico }));
    // Los que cuadran solo viajan para sellar su costo (delta 0 = no mueve stock)
    const ajustados = new Set(ajustes.map(r => r.prod.id));
    an.sellar.filter(p => !ajustados.has(p.id)).forEach(p => items.push({ producto_id: p.id, delta: 0 }));
    verbo = 'ajustados'; n = ajustes.length;
    if (!confirm(`Se va a ajustar el stock de ${n} producto(s) al conteo físico en ${an.nomDest}.\n\n`
      + `Los ${an.noContados.length} "no contados" NO se tocan: podrían no haberse contado todavía.`
      + textoSellado(an) + '\n\n¿Aplicar?')) return;
  }
  if (!items.length) return;
  aplicando.value = true;
  try {
    const ref = referencia.value.trim();
    const r = await store.aplicarRecepcion({
      tipo: an.tipo, destino: an.destino === 'vd' ? 'directa' : 'dist', embarqueId: an.embId || null,
      referencia: ref, items, noContados: an.tipo === 'conteo' ? an.noContados.map(x => x.prod.id) : []
    });
    if (!r) return;
    res.value = { ...r, hechos: n, verbo, nomDest: an.nomDest, ref, emb: an.emb, conflicto: an.conflicto };
    paso.value = 3;
    store.notif(`${n} producto(s) ${verbo}`, 'success');
  } finally {
    aplicando.value = false;
  }
}

function cerrar() { store.modalRecepcionActivo = false; }
</script>

<style scoped>
.rc-lbl { font-size: 11px; color: var(--dgray); font-weight: 500; display: block; margin-bottom: 3px }
.rc-kpi { border-radius: 8px; padding: 10px 12px }
.rc-kpi-l { font-size: 10.5px; color: var(--dgray); text-transform: uppercase; letter-spacing: .04em }
.rc-kpi-v { font-size: 19px; font-weight: 600 }
</style>
