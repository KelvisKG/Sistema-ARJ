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
          placeholder="tu correo (ej: admin@arj.com)"
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

      <div class="login-field" v-if="isRegistering">
        <label>Nombre</label>
        <input
          v-model="nombre"
          type="text"
          placeholder="Tu nombre y apellido"
          :class="{ 'is-invalid': errors.nombre }"
          @input="errors.nombre = null"
        >
        <span v-if="errors.nombre" class="field-error">
          <i class="ti ti-alert-circle"></i> {{ errors.nombre }}
        </span>
      </div>

      <div class="login-field" v-if="isRegistering">
        <label>Empresa / Sucursal (Opcional)</label>
        <select v-model="empresa" style="width: 100%; padding: 0.8rem; border: 1px solid var(--border); border-radius: 8px; font-family: inherit;">
          <option value="ambas">Ambas</option>
          <option value="directa">Venta Directa</option>
          <option value="distribuidora">Distribuidora</option>
        </select>
      </div>

      <button class="login-btn" id="btn-login-submit" @click="isRegistering ? handleRegister() : handleLogin()" :disabled="store.cargando">
        <i class="ti ti-login"></i> {{ store.cargando ? 'Procesando...' : (isRegistering ? 'Registrarse' : 'Iniciar sesión') }}
      </button>

      <div class="login-hint" style="margin-top:15px; cursor:pointer; color:var(--primary); font-weight:600; text-decoration:underline;" @click="toggleMode">
        {{ isRegistering ? '¿Ya tienes cuenta? Inicia sesión aquí' : '¿No tienes cuenta? Regístrate aquí' }}
      </div>

      <div class="login-hint" style="margin-top:20px;">
        <strong>Acceso seguro</strong><br>
        Plataforma administrativa con respaldo en la nube.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useArjStore } from '../../stores/useArjStore.js';
import { isNonEmpty, isValidEmail } from '../../services/validators.js';
import { supabase } from '../../services/supabase.js';

const store = useArjStore();
const email = ref('');
const password = ref('');
const nombre = ref('');
const empresa = ref('ambas');
const isRegistering = ref(false);

const errors = ref({});
const errorVisible = ref(false);
const errorMessage = ref('');

function toggleMode() {
  isRegistering.value = !isRegistering.value;
  errors.value = {};
  errorVisible.value = false;
  errorMessage.value = '';
}

async function handleLogin() {
  errors.value = {};
  errorVisible.value = false;

  if (!isNonEmpty(email.value)) {
    errors.value.email = 'El correo electrónico es requerido';
  } else if (!isValidEmail(email.value) && !email.value.includes('demo') && !email.value.includes('admin') && !email.value.includes('gerente')) {
    errors.value.email = 'Ingresa un correo con formato válido (ej: usuario@empresa.com)';
  }

  if (!isNonEmpty(password.value, 3)) {
    errors.value.password = 'La contraseña debe tener al menos 3 caracteres';
  }

  if (Object.keys(errors.value).length > 0) {
    errorVisible.value = true;
    errorMessage.value = 'Corrige los campos marcados en rojo';
    return;
  }

  store.cargando = true;

  // Intentar Auth real en Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  });

  if (authError) {
    errorVisible.value = true;
    errorMessage.value = 'Email o contraseña incorrectos. Verifica tus credenciales de la base de datos.';
  } else {
    // Auth exitoso, buscar perfil
    const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', authData.user.id).single();
    if (perfil) {
      if (perfil.activo === false) {
        errorVisible.value = true;
        errorMessage.value = 'Tu cuenta está pendiente de aprobación por un administrador.';
        await supabase.auth.signOut();
        store.cargando = false;
        return;
      }
      store.login(perfil.rol, perfil.nombre_display);
    } else {
      // Si no tiene perfil, usamos algo basico
      store.login('vendedor', email.value);
    }
    localStorage.removeItem('arj_modo_directo');
    await store.initApp(); // Cargar los datos desde Supabase YA autenticados!
  }
  
  store.cargando = false;
}

async function handleRegister() {
  errors.value = {};
  errorVisible.value = false;

  if (!isNonEmpty(email.value)) {
    errors.value.email = 'El correo electrónico es requerido';
  } else if (!isValidEmail(email.value)) {
    errors.value.email = 'Ingresa un correo con formato válido';
  }

  if (!isNonEmpty(password.value, 6)) {
    errors.value.password = 'La contraseña debe tener al menos 6 caracteres';
  }
  
  if (!isNonEmpty(nombre.value)) {
    errors.value.nombre = 'El nombre es requerido';
  }

  if (Object.keys(errors.value).length > 0) {
    errorVisible.value = true;
    errorMessage.value = 'Corrige los campos marcados en rojo';
    return;
  }

  const res = await store.registrarUsuario(email.value, password.value, nombre.value, empresa.value);
  if (res.ok) {
    isRegistering.value = false;
    errorVisible.value = true;
    errorMessage.value = 'Registro exitoso. Tu cuenta ha sido creada y está pendiente de aprobación por un administrador.';
  } else {
    errorVisible.value = true;
    errorMessage.value = res.error || 'Error al registrar el usuario';
  }
  
  store.cargando = false;
}

</script>
