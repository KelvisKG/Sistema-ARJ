<template>
  <div class="login-screen" id="login-screen">
    <div class="login-box">
      <div class="login-logo">
        <i class="ti ti-building-store"></i>
        <h1>Sistema ARJ</h1>
        <p>Acceso seguro · Repuestos Agrícolas</p>
      </div>

      <div v-if="errorVisible" class="login-error" style="display:block">
        <i class="ti ti-info-circle"></i> {{ errorMessage }}
      </div>

      <div class="login-field">
        <label>Email</label>
        <input
          v-model="email"
          type="email"
          id="login-user"
          placeholder="tu correo"
          autocomplete="email"
          :class="{ 'is-invalid': errors.email }"
          @input="errors.email = null"
          @keyup.enter="handleLogin"
        >
        <span v-if="errors.email" class="field-error">
          <i class="ti ti-alert-circle"></i> {{ errors.email }}
        </span>
      </div>

      <div class="login-field">
        <label>Contraseña</label>
        <input
          v-model="password"
          type="password"
          id="login-pass"
          placeholder="••••••••"
          autocomplete="current-password"
          :class="{ 'is-invalid': errors.password }"
          @input="errors.password = null"
          @keyup.enter="handleLogin"
        >
        <span v-if="errors.password" class="field-error">
          <i class="ti ti-alert-circle"></i> {{ errors.password }}
        </span>
      </div>

      <button class="login-btn" id="btn-login-submit" @click="handleLogin" :disabled="store.cargando">
        <i class="ti ti-login"></i> {{ store.cargando ? 'Verificando...' : 'Iniciar sesión' }}
      </button>

      <div class="login-hint" style="margin-top:20px;">
        <strong>Acceso solo para personal autorizado</strong><br>
        Las cuentas las crea el gerente. Si no tienes acceso, pídelo a gerencia.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { isNonEmpty, isValidEmail } from '../../services/validators.js';

const store = useArjStore();
const email = ref('');
const password = ref('');

const errors = ref({});
const errorVisible = ref(false);
const errorMessage = ref('');

async function handleLogin() {
  errors.value = {};
  errorVisible.value = false;

  if (!isNonEmpty(email.value)) {
    errors.value.email = 'El correo electrónico es requerido';
  } else if (!isValidEmail(email.value)) {
    errors.value.email = 'Ingresa un correo con formato válido';
  }
  if (!isNonEmpty(password.value)) {
    errors.value.password = 'La contraseña es requerida';
  }
  if (Object.keys(errors.value).length > 0) {
    errorVisible.value = true;
    errorMessage.value = 'Corrige los campos marcados en rojo';
    return;
  }

  // C-06: sin perfil activo no se entra (el store cierra la sesión de Supabase)
  const r = await store.iniciarSesion(email.value.trim().toLowerCase(), password.value);
  if (!r.ok) {
    errorVisible.value = true;
    errorMessage.value = r.error || 'No se pudo iniciar sesión';
  }
  password.value = '';
}
</script>
