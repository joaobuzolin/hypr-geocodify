// ─── auth_ui ─────────────────────────────────────────────────────────
// Extracted from app-legacy.js — domain module

var SUPABASE_URL  = 'https://qfyqvcxhcmduhknbpofx.supabase.co';
var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeXF2Y3hoY21kdWhrbmJwb2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjk1NjAsImV4cCI6MjA4OTAwNTU2MH0.k92V1LN4OqqdtfF86iml4L-gVg0AabENKt7S5vlP2dk';
// Inicializar imediatamente — supabase.js já carregou (script síncrono no <head>)
var _supa = null;
var currentUser = null;

function supaLogout() {
  try { sessionStorage.removeItem('hypr_last_map'); } catch(e) {}
  _supa.auth.signOut();
  currentUser = null;
  document.getElementById('login-screen').style.display = '';
  document.getElementById('gallery-screen').classList.add('hidden');
}

// Criar versão debounced de applyFilters (150ms) para sliders
var _debouncedFilter = debounce(applyFilters, 150);

// ─── Estado do tipo de mapa atual ─────────────────────────────────────────────


// ─── window.* exports ──────────────────────────────────────────────────
window.supaLogout = supaLogout;
