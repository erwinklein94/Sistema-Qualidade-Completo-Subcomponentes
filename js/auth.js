/* =====================================================================
   AUTH.JS — Login, sessão e proteção das páginas
   ===================================================================== */

var Auth = (() => {
  const LOGIN_PAGE = 'login.html';

  function cliente() {
    return window.SUPABASE_CLIENTE || null;
  }

  function cfg() {
    return window.SUPABASE_CONFIG || {};
  }

  function chavePublica() {
    return String(cfg().publishableKey || '').trim();
  }

  function chavePreenchida() {
    const k = chavePublica();
    return !!k && !k.includes('COLE_AQUI');
  }

  function chavePodeEstarIncompleta() {
    const k = chavePublica();
    // Aviso conservador: não bloqueia login, apenas ajuda no diagnóstico.
    // A publishable key nova começa com sb_publishable_; se ela for copiada
    // visualmente da tela, pode vir cortada. Use sempre o botão Copy do Supabase.
    return k.startsWith('sb_publishable_') && k.length < 50;
  }

  function configurado() {
    return !!(window.supabase && cfg().url && chavePreenchida() && cliente());
  }

  function diagnostico() {
    return {
      bibliotecaSupabaseCarregada: !!window.supabase,
      urlConfigurada: !!cfg().url,
      publishableKeyPreenchida: chavePreenchida(),
      publishableKeyPodeEstarIncompleta: chavePodeEstarIncompleta(),
      clienteCriado: !!cliente(),
      configurado: configurado(),
    };
  }

  function paginaAtual() {
    return String(location.pathname.split('/').pop() || 'index.html');
  }

  function ehLogin() {
    return paginaAtual().toLowerCase() === LOGIN_PAGE;
  }

  function urlLogin() {
    const atual = location.href;
    return `${LOGIN_PAGE}?next=${encodeURIComponent(atual)}`;
  }

  function proximaUrlPadrao() {
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    if (!next) return 'index.html';
    try {
      const u = new URL(next, location.href);
      if (u.origin === location.origin) return u.href;
    } catch (_) {}
    return 'index.html';
  }

  function erroConfiguracao() {
    const d = diagnostico();
    if (!d.bibliotecaSupabaseCarregada) {
      return 'A biblioteca do Supabase não carregou. Verifique a internet, bloqueadores/extensões do navegador ou tente atualizar com Ctrl+F5.';
    }
    if (!d.urlConfigurada) {
      return 'Supabase sem URL configurada em js/supabase-config.js.';
    }
    if (!d.publishableKeyPreenchida) {
      return 'Supabase ainda não configurado. Abra js/supabase-config.js e cole sua Publishable key.';
    }
    if (!d.clienteCriado) {
      return 'O cliente Supabase não foi inicializado. Confira js/supabase-config.js.';
    }
    return 'Supabase configurado.';
  }

  function avisoChave() {
    if (!chavePodeEstarIncompleta()) return '';
    return 'A Publishable key parece curta. Se o login falhar com erro de API key, copie novamente pelo botão Copy do Supabase, não pelo texto visível na tela.';
  }

  function exibirBloqueioConfiguracao() {
    const html = `
      <div class="auth-bloqueio">
        <div class="login-card">
          <div class="login-marca">rum<span class="o-circ"></span></div>
          <h1>Configuração pendente</h1>
          <p>${erroConfiguracao()}</p>
          <div class="aviso-info" style="margin-top:16px">
            <strong>Use somente a publishable key.</strong><br>
            Não use service_role, secret key, senha do banco ou connection string no navegador.
          </div>
        </div>
      </div>`;
    const montar = () => {
      document.body.innerHTML = html;
      document.body.setAttribute('data-tema', localStorage.getItem('temaControleDormentesSubcomponentes') || 'claro');
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar, { once: true });
    else montar();
  }

  async function sessaoAtual() {
    if (!configurado()) return null;
    const { data, error } = await cliente().auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function perfilAtual() {
    const session = await sessaoAtual();
    if (!session?.user?.id) return null;
    const { data, error } = await cliente()
      .from('usuarios_app')
      .select('id,nome,email,perfil,ativo')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function exigirLogin() {
    if (ehLogin()) return true;
    if (!configurado()) {
      location.replace(`${LOGIN_PAGE}?erro=${encodeURIComponent(erroConfiguracao())}`);
      return false;
    }

    try {
      const session = await sessaoAtual();
      if (!session) {
        location.replace(urlLogin());
        return false;
      }

      const perfil = await perfilAtual();
      if (!perfil || perfil.ativo !== true) {
        await cliente().auth.signOut();
        location.replace(`${LOGIN_PAGE}?erro=${encodeURIComponent('Usuário sem perfil ativo no sistema.')}`);
        return false;
      }

      window.USUARIO_ATUAL = { session, perfil };
      montarStatusUsuario();
      return true;
    } catch (err) {
      console.error('Erro ao validar login', err);
      location.replace(`${LOGIN_PAGE}?erro=${encodeURIComponent('Não foi possível validar sua sessão. Faça login novamente.')}`);
      return false;
    }
  }

  async function entrar(email, senha) {
    if (!configurado()) throw new Error(erroConfiguracao());

    const { data, error } = await cliente().auth.signInWithPassword({ email, password: senha });
    if (error) throw error;

    if (!data?.session?.user?.id) {
      throw new Error('Login não retornou sessão. Verifique se o e-mail foi confirmado no Supabase.');
    }

    const perfil = await perfilAtual();
    if (!perfil || perfil.ativo !== true) {
      await cliente().auth.signOut();
      throw new Error('Login feito, mas este usuário não está ativo em usuarios_app.');
    }

    window.USUARIO_ATUAL = { session: data.session, perfil };
    return perfil;
  }

  async function sair() {
    if (configurado()) await cliente().auth.signOut();
    location.href = LOGIN_PAGE;
  }

  async function montarStatusUsuario() {
    const alvo = document.getElementById('areaUsuario');
    if (!alvo || !configurado()) return;
    try {
      const perfil = window.USUARIO_ATUAL?.perfil || await perfilAtual();
      if (!perfil) return;
      alvo.innerHTML = `
        <div class="usuario-pill" title="${escapeHtml(perfil.email || '')}">
          <span class="usuario-nome">${escapeHtml(perfil.nome || perfil.email || 'Usuário')}</span>
          <span class="usuario-perfil">${escapeHtml(perfil.perfil || '')}</span>
        </div>
        <button class="btn btn-secundario btn-sm" type="button" onclick="Auth.sair()">Sair</button>`;
    } catch (err) {
      console.warn('Não foi possível montar status do usuário', err);
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    cliente,
    configurado,
    diagnostico,
    avisoChave,
    exigirLogin,
    entrar,
    sair,
    sessaoAtual,
    perfilAtual,
    montarStatusUsuario,
    proximaUrlPadrao,
    erroConfiguracao,
  };
})();

window.Auth = Auth;
