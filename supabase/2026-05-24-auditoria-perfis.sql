/* =====================================================================
   Auditoria e perfis — Sistema de Qualidade de Subcomponentes
   Rode este arquivo no SQL Editor do Supabase, uma única vez.
   Não apaga nem altera os dados já cadastrados.
   ===================================================================== */

create table if not exists public.auditoria_subcomponentes (
  id bigserial primary key,
  data_hora timestamptz not null default now(),
  usuario_id uuid,
  usuario_email text,
  usuario_nome text,
  usuario_perfil text,
  acao text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  tabela text not null,
  registro_id text,
  resumo text,
  dados_antigos jsonb,
  dados_novos jsonb
);

create index if not exists idx_auditoria_subcomponentes_data on public.auditoria_subcomponentes (data_hora desc);
create index if not exists idx_auditoria_subcomponentes_usuario on public.auditoria_subcomponentes (usuario_id);
create index if not exists idx_auditoria_subcomponentes_tabela on public.auditoria_subcomponentes (tabela);
create index if not exists idx_auditoria_subcomponentes_acao on public.auditoria_subcomponentes (acao);

alter table public.auditoria_subcomponentes enable row level security;
revoke all on table public.auditoria_subcomponentes from anon;
grant select on table public.auditoria_subcomponentes to authenticated;

drop policy if exists "admin le auditoria subcomponentes" on public.auditoria_subcomponentes;
create policy "admin le auditoria subcomponentes"
on public.auditoria_subcomponentes
for select
to authenticated
using (public.eh_admin());

create or replace function public.resumo_auditoria_subcomponentes(nome_tabela text, dados jsonb)
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  if nome_tabela = 'empresas_subcomponentes' then
    return concat_ws(' | ', 'Empresa: ' || coalesce(dados->>'nome', ''), 'Status: ' || coalesce(dados->>'status', ''));
  elsif nome_tabela = 'estoque_subcomponentes' then
    return concat_ws(' | ', 'Estoque: ' || coalesce(dados->>'subcomponente', ''), 'Lote: ' || coalesce(dados->>'lote', ''), 'Empresa: ' || coalesce(dados->>'empresa_nome', ''));
  elsif nome_tabela = 'inspecoes_subcomponentes' then
    return concat_ws(' | ', 'Inspeção: ' || coalesce(dados->>'subcomponente', ''), 'Lote: ' || coalesce(dados->>'lote', ''), 'Status: ' || coalesce(dados->>'status', ''));
  elsif nome_tabela = 'usuarios_app' then
    return concat_ws(' | ', 'Usuário: ' || coalesce(dados->>'email', ''), 'Perfil: ' || coalesce(dados->>'perfil', ''), 'Ativo: ' || coalesce(dados->>'ativo', ''));
  end if;

  return coalesce(dados->>'id', 'Registro sem resumo');
end;
$$;

create or replace function public.registrar_auditoria_subcomponentes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_nome text;
  v_perfil text;
  v_old jsonb;
  v_new jsonb;
  v_dados jsonb;
  v_registro_id text;
  v_resumo text;
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_new := null;
    v_dados := v_old;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_dados := v_new;
  else
    v_old := null;
    v_new := to_jsonb(new);
    v_dados := v_new;
  end if;

  select u.email, u.nome, u.perfil
    into v_email, v_nome, v_perfil
  from public.usuarios_app u
  where u.id = v_uid;

  v_registro_id := coalesce(v_dados->>'id', '');
  v_resumo := public.resumo_auditoria_subcomponentes(tg_table_name, v_dados);

  insert into public.auditoria_subcomponentes (
    usuario_id,
    usuario_email,
    usuario_nome,
    usuario_perfil,
    acao,
    tabela,
    registro_id,
    resumo,
    dados_antigos,
    dados_novos
  ) values (
    v_uid,
    coalesce(v_email, nullif(current_setting('request.jwt.claim.email', true), '')),
    v_nome,
    v_perfil,
    tg_op,
    tg_table_name,
    v_registro_id,
    v_resumo,
    v_old,
    v_new
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


create or replace function public.preencher_atualizacao_usuarios_app()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_em := coalesce(new.criado_em, now());
    new.atualizado_em := coalesce(new.atualizado_em, now());
  elsif tg_op = 'UPDATE' then
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_usuarios_app_atualizacao on public.usuarios_app;
create trigger trg_usuarios_app_atualizacao
before insert or update on public.usuarios_app
for each row execute function public.preencher_atualizacao_usuarios_app();

-- Recria triggers para evitar duplicidade se este SQL for rodado mais de uma vez.
drop trigger if exists trg_audit_empresas_subcomponentes on public.empresas_subcomponentes;
create trigger trg_audit_empresas_subcomponentes
after insert or update or delete on public.empresas_subcomponentes
for each row execute function public.registrar_auditoria_subcomponentes();

drop trigger if exists trg_audit_estoque_subcomponentes on public.estoque_subcomponentes;
create trigger trg_audit_estoque_subcomponentes
after insert or update or delete on public.estoque_subcomponentes
for each row execute function public.registrar_auditoria_subcomponentes();

drop trigger if exists trg_audit_inspecoes_subcomponentes on public.inspecoes_subcomponentes;
create trigger trg_audit_inspecoes_subcomponentes
after insert or update or delete on public.inspecoes_subcomponentes
for each row execute function public.registrar_auditoria_subcomponentes();

drop trigger if exists trg_audit_usuarios_app on public.usuarios_app;
create trigger trg_audit_usuarios_app
after insert or update or delete on public.usuarios_app
for each row execute function public.registrar_auditoria_subcomponentes();

-- Garante a diferença de perfis do sistema:
-- admin: gerencia usuários e vê auditoria; também cadastra, edita e exclui registros operacionais.
-- qualidade: cadastra, edita e exclui registros operacionais.
-- consulta: apenas visualiza registros.
-- As políticas principais já foram criadas no primeiro SQL; o bloco abaixo reaplica de forma idempotente.
do $$
declare
  t text;
begin
  foreach t in array array['empresas_subcomponentes', 'estoque_subcomponentes', 'inspecoes_subcomponentes']
  loop
    execute format('drop policy if exists "usuarios ativos leem %s" on public.%I', t, t);
    execute format('create policy "usuarios ativos leem %s" on public.%I for select to authenticated using (public.usuario_ativo())', t, t);

    execute format('drop policy if exists "qualidade cadastra %s" on public.%I', t, t);
    execute format('create policy "qualidade cadastra %s" on public.%I for insert to authenticated with check (public.usuario_tem_perfil(array[''admin'', ''qualidade'']))', t, t);

    execute format('drop policy if exists "qualidade edita %s" on public.%I', t, t);
    execute format('create policy "qualidade edita %s" on public.%I for update to authenticated using (public.usuario_tem_perfil(array[''admin'', ''qualidade''])) with check (public.usuario_tem_perfil(array[''admin'', ''qualidade'']))', t, t);

    execute format('drop policy if exists "qualidade exclui %s" on public.%I', t, t);
    execute format('create policy "qualidade exclui %s" on public.%I for delete to authenticated using (public.usuario_tem_perfil(array[''admin'', ''qualidade'']))', t, t);
  end loop;
end $$;
