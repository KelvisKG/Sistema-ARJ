<template>
  <div v-if="store.modalNuevoClienteActivo" class="modal show" id="modal-nuevo-cliente" style="display:flex">
    <div class="modal-content" style="max-width:540px;text-align:left">
      <div class="modal-icon" style="background:#E3F2FD;color:var(--blue)">
        <i class="ti ti-user-plus"></i>
      </div>
      <h2>Registrar Nuevo Cliente Agrícola</h2>
      <p class="modal-sub">
        Completa los datos de la hacienda, productor o empresa para incorporarlo a la cartera.
      </p>

      <div class="field-col">
        <label>Razón Social / Nombre Completo *</label>
        <input
          v-model="form.nombre"
          type="text"
          placeholder="Ej: AGROPECUARIA SAN ISIDRO C.A."
          class="val-input"
          :class="{ 'is-invalid': errors.nombre }"
          @input="errors.nombre = null"
        >
        <span v-if="errors.nombre" class="field-error">
          <i class="ti ti-alert-circle"></i> {{ errors.nombre }}
        </span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="field-col" style="margin-bottom:0">
          <label>RIF / Cédula</label>
          <input
            v-model="form.rif"
            type="text"
            placeholder="J-12345678-9"
            class="val-input"
            :class="{ 'is-invalid': errors.rif }"
            @input="errors.rif = null"
          >
          <span v-if="errors.rif" class="field-error">
            <i class="ti ti-alert-circle"></i> {{ errors.rif }}
          </span>
        </div>
        <div class="field-col" style="margin-bottom:0">
          <label>Teléfono Principal</label>
          <input
            v-model="form.tel"
            type="text"
            placeholder="0414-5551234"
            class="val-input"
            :class="{ 'is-invalid': errors.tel }"
            @input="errors.tel = null"
          >
          <span v-if="errors.tel" class="field-error">
            <i class="ti ti-alert-circle"></i> {{ errors.tel }}
          </span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="field-col" style="margin-bottom:0">
          <label>Nivel de Precio Asignado</label>
          <select v-model="form.nivel" class="val-input">
            <option value="Publico">Público / Mostrador</option>
            <option value="T1" :disabled="store.rol !== 'gerente'">T1 (Aliado –5%)</option>
            <option value="T2" :disabled="store.rol !== 'gerente'">T2 (Taller –10%)</option>
            <option value="T3" :disabled="store.rol !== 'gerente'">T3 (Mayorista / Distribuidor –20%)</option>
          </select>
        </div>
        <div class="field-col" style="margin-bottom:0">
          <label>Condición Comercial</label>
          <select v-model="form.tipo" class="val-input">
            <option value="contado">Contado</option>
            <option value="credito">Crédito (con límite)</option>
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="field-col" style="margin-bottom:0">
          <label>Correo Electrónico</label>
          <input v-model="form.correo" type="email" placeholder="cliente@correo.com" class="val-input">
        </div>
        <div class="field-col" style="margin-bottom:0">
          <label>Detalle de captación</label>
          <input v-model="form.origen_detalle" type="text" placeholder="Ej: quién lo refirió" class="val-input">
        </div>
      </div>

      <div class="field-col">
        <label>Dirección o Ubicación de Entrega</label>
        <input v-model="form.direccion" type="text" placeholder="Carretera Nacional Vía Payara..." class="val-input">
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div class="field-col" style="margin-bottom:0">
          <label>Persona de Contacto</label>
          <input v-model="form.contacto_nombre" type="text" placeholder="Ing. Carlos Pérez" class="val-input">
        </div>
        <div class="field-col" style="margin-bottom:0">
          <label>Cargo del Contacto</label>
          <input v-model="form.contacto_cargo" type="text" placeholder="Jefe de Maquinaria" class="val-input">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div class="field-col" style="margin-bottom:0">
          <label>¿Cómo nos consiguió?</label>
          <select v-model="form.origen" class="val-input">
            <option value="referido">Boca a boca / Referido</option>
            <option value="visita">Llegó al local / Mostrador</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="tiktok">TikTok</option>
            <option value="whatsapp">WhatsApp directo</option>
            <option value="vendedor">Prospección del vendedor</option>
            <option value="feria">Feria / Evento agrícola</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div class="field-col" style="margin-bottom:0">
          <label>Notas</label>
          <input v-model="form.notas" type="text" placeholder="Alguna nota adicional..." class="val-input">
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" @click="store.modalNuevoClienteActivo = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="guardando" @click="guardarCliente">
          <i class="ti ti-check"></i> Registrar Cliente
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { isNonEmpty, isValidPhone, isValidRifOrCedula, isValidEmail } from '../../services/validators.js';

const store = useArjStore();
const errors = ref({});
const guardando = ref(false);
const formVacio = () => ({
  nombre: '', rif: '', tel: '', nivel: 'Publico', tipo: 'contado', direccion: '', correo: '',
  origen: 'visita', origen_detalle: '', notas: '', contacto_nombre: '', contacto_cargo: ''
});
const form = ref(formVacio());

async function guardarCliente() {
  errors.value = {};
  if (!isNonEmpty(form.value.nombre, 3)) errors.value.nombre = 'El nombre o razón social debe tener al menos 3 caracteres';
  if (form.value.rif && !isValidRifOrCedula(form.value.rif)) errors.value.rif = 'El RIF o Cédula debe tener al menos 6 caracteres válidos';
  if (form.value.tel && !isValidPhone(form.value.tel)) errors.value.tel = 'Ingresa un número de teléfono válido (mínimo 7 dígitos)';
  if (form.value.correo && !isValidEmail(form.value.correo)) errors.value.correo = 'Correo inválido';
  if (Object.keys(errors.value).length > 0) {
    store.notif('Por favor completa correctamente los datos del cliente', 'warning');
    return;
  }

  // La tabla clientes no tiene columna de correo: se guarda en las notas
  const notas = [form.value.notas.trim(), form.value.correo ? 'Correo: ' + form.value.correo.trim() : ''].filter(Boolean).join(' · ');
  guardando.value = true;
  try {
    // C-02: se guarda en la BD y se usa el id real que devuelve
    const cli = await store.crearCliente({
      nombre: form.value.nombre,
      rif: form.value.rif,
      tel: form.value.tel,
      nivel: form.value.nivel,
      tipo: form.value.tipo,
      direccion: form.value.direccion,
      origen: form.value.origen,
      origen_detalle: form.value.origen_detalle,
      notas,
      contacto_principal: { nombre: form.value.contacto_nombre, cargo: form.value.contacto_cargo, tel: form.value.tel }
    });
    if (!cli) return;
    store.seleccionarCliente(cli);
    store.modalNuevoClienteActivo = false;
    form.value = formVacio();
  } finally {
    guardando.value = false;
  }
}
</script>
