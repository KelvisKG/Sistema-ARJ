// === Config & Supabase Init ===
    const SUPABASE_URL = 'https://ahnzbmzzjvwyddiwdpss.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_0xpS9KJi3LVwHySmkphvBA_KxNpY7Ep';
    let _sb = null;
    let _supabaseConectado = false;

    try {
      _sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
    } catch (e) {
      console.error('[ARJ] No se pudo inicializar Supabase:', e);
    }