<template>
  <div class="login-screen" id="login-screen">
    <div class="login-box">
      <div class="login-logo">
        <i class="ti ti-building-store"></i>
        <h1>Sistema ARJ</h1>
        <p>Acceso seguro · Repuestos Agrícolas</p>
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

      <button class="login-btn" id="btn-login-submit" @click="handleLogin" :disabled="store.cargando">
        <i class="ti ti-login"></i> {{ store.cargando ? 'Conectando...' : 'Iniciar sesión' }}
      </button>

      <button class="login-btn" style="background:var(--gray);color:var(--navy);margin-top:10px" @click="handleDirectLogin">
        <i class="ti ti-plug-x"></i> Acceso Directo (Sin Nube)
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
import { DEFAULT_PRODUCTOS, DEFAULT_CLIENTES, DEFAULT_FACTURAS_COBRAR } from '../../services/seedData.js';

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

function handleDirectLogin() {
  store.login('gerente', 'JJ (Local)');
  // Bypass Supabase and load seed data directly to avoid RLS block
  store.productos = JSON.parse(JSON.stringify(DEFAULT_PRODUCTOS));
  store.clientes = JSON.parse(JSON.stringify(DEFAULT_CLIENTES));
  store.facturasCobrar = JSON.parse(JSON.stringify(DEFAULT_FACTURAS_COBRAR));
  store.todasFacturas = JSON.parse(JSON.stringify(DEFAULT_FACTURAS_COBRAR));
  store.bitacora = [];
  store.supabaseConectado = false;
  localStorage.setItem('arj_modo_directo', 'true');
  store.logBitacora('sistema', 'Sistema iniciado en Modo Directo (Sin conexión a Base de Datos)');
}
</script>
