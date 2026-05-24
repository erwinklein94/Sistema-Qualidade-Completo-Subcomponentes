/* =====================================================================
   SUPABASE-CONFIG.JS — Configuração pública do Supabase

   Cole aqui apenas a PUBLISHABLE KEY do Supabase.
   Nunca cole service_role, secret key, senha do banco ou connection string.
   ===================================================================== */

window.SUPABASE_CONFIG = {
  url: 'https://kqtvtjgvscjbxrfsbjfg.supabase.co',
  publishableKey: 'sb_publishable_cJSAgmMMzeycNUAsc-UVtQ_5LksyBuu'
};

(function inicializarSupabase() {
  const cfg = window.SUPABASE_CONFIG || {};
  const semChave = !cfg.publishableKey || cfg.publishableKey.includes('COLE_AQUI');
  if (!window.supabase || !cfg.url || semChave) {
    window.SUPABASE_CLIENTE = null;
    return;
  }

  window.SUPABASE_CLIENTE = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  });
})();
