/* =====================================================================
   LOGIN.JS
   ===================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  document.body.setAttribute('data-tema', localStorage.getItem('temaControleDormentesSubcomponentes') || 'claro');

  const form = document.getElementById('formLogin');
  const msg = document.getElementById('loginMensagem');
  const btn = document.getElementById('btnEntrar');

  const params = new URLSearchParams(location.search);
  const erro = params.get('erro');
  if (erro) mensagem(decodeURIComponent(erro), 'erro');

  console.info('Diagnóstico Supabase:', Auth.diagnostico());

  if (!Auth.configurado()) {
    mensagem(Auth.erroConfiguracao(), 'erro');
    btn.disabled = true;
    return;
  }

  const aviso = Auth.avisoChave();
  if (aviso && !erro) mensagem(aviso, 'info');

  try {
    const session = await Auth.sessaoAtual();
    if (session) {
      mensagem('Você já está logado. Redirecionando...', 'sucesso');
      setTimeout(() => { location.href = Auth.proximaUrlPadrao(); }, 600);
      return;
    }
  } catch (err) {
    console.warn('Não foi possível checar sessão inicial:', err);
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;

    if (!email || !senha) {
      mensagem('Informe e-mail e senha.', 'erro');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando...';
    mensagem('Validando acesso no Supabase...', 'info');

    try {
      const perfil = await Auth.entrar(email, senha);
      mensagem(`Bem-vindo, ${perfil.nome || perfil.email}.`, 'sucesso');
      setTimeout(() => { location.href = Auth.proximaUrlPadrao(); }, 500);
    } catch (err) {
      console.error('Erro de login Supabase:', err);
      mensagem(traduzErro(err), 'erro');
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  });

  function mensagem(texto, tipo = 'info') {
    msg.className = `login-msg ${tipo}`;
    msg.textContent = texto || '';
  }

  function traduzErro(err) {
    const t = String(err?.message || err || 'Erro ao entrar.');
    if (/Invalid login credentials/i.test(t)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(t)) return 'E-mail ainda não confirmado no Supabase.';
    if (/Invalid API key|No API key|API key/i.test(t)) return 'A Publishable key está errada ou incompleta. Copie novamente pelo botão Copy do Supabase em Project Settings → API Keys.';
    if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(t)) return 'Falha de conexão com o Supabase. Verifique internet, bloqueador/extensão do navegador e se o GitHub Pages carregou js/supabase-config.js atualizado.';
    if (/perfil ativo|usuarios_app/i.test(t)) return t;
    if (/Supabase ainda não configurado|biblioteca do Supabase/i.test(t)) return t;
    return `Não foi possível entrar: ${t}`;
  }
});
