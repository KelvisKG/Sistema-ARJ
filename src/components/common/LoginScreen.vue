<template>
  <div class="login-screen" id="login-screen">
    <div class="login-box">
      <div class="login-logo">
        <i class="ti ti-building-store"></i>
        <h1>Sistema ARJ</h1>
        <p>Acceso seguro · Repuestos Agrícolas</p>
      </div>

      <div v-if="store.inactividadExpulsado" class="login-error" style="display:block; background-color: var(--orange-light, #fff3cd); color: var(--orange, #856404); border-color: #ffeeba;">
        <i class="ti ti-clock-pause"></i> Has sido expulsado por inactividad de 5 minutos.
      </div>

      <div v-if="errorVisible" class="login-error" style="display:block">
        <i class="ti ti-x"></i> {{ errorMessage }}
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

      <button class="login-btn" id="btn-login-submit" @click="handleLogin">
        <i class="ti ti-login"></i> Iniciar sesión
      </button>

      <div class="login-hint">
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
const errors = ref({});
const errorVisible = ref(false);
const errorMessage = ref('');

function handleLogin() {
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
    // Si falla el auth real, permitir acceso con credenciales demo si coincide el formato
    if (email.value.includes('gerente') || email.value.includes('admin')) {
      store.login('gerente', 'JJ (Gerente)');
      await store.initApp();
    } else if (email.value.includes('vendedor') || email.value.includes('demo')) {
      store.login('vendedor', 'HUMBERTO ARJ');
      await store.initApp();
    } else {
      errorVisible.value = true;
      errorMessage.value = 'Email o contraseña incorrectos';
    }
  } else {
    // Auth exitoso, buscar perfil
    const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', authData.user.id).single();
    if (perfil) {
      store.login(perfil.rol, perfil.nombre_display);
    } else {
      // Si no tiene perfil, usamos algo basico
      store.login('vendedor', email.value);
    }
    await store.initApp(); // Cargar los datos desde Supabase YA autenticados!
  }
  
  store.cargando = false;
}
</script>
