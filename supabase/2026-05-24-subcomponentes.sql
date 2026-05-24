/* =====================================================================
   SUPABASE — Sistema de Qualidade de Subcomponentes

   Rode este arquivo no Supabase SQL Editor antes de publicar/usar o site.
   Ele cria:
   - usuarios_app, caso seu projeto ainda não tenha essa tabela;
   - funções de perfil/segurança;
   - tabelas empresas_subcomponentes, estoque_subcomponentes e inspecoes_subcomponentes;
   - RLS para usuários autenticados e ativos.

   Perfis usados:
   - admin: lê, cadastra, edita e exclui.
   - qualidade: lê, cadastra, edita e exclui registros operacionais.
   - consulta: apenas lê.
   ===================================================================== */

create extension if not exists "pgcrypto";

/* ---------------------------------------------------------------------
   1. Usuários do aplicativo
   --------------------------------------------------------------------- */
create table if not exists public.usuarios_app (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text not null,
  perfil text not null default 'consulta' check (perfil in ('admin', 'qualidade', 'consulta')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.usuarios_app enable row level security;
revoke all on table public.usuarios_app from anon;
grant select, insert, update, delete on table public.usuarios_app to authenticated;

create or replace function public.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_app u
    where u.id = auth.uid()
      and u.ativo = true
  );
$$;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_app u
    where u.id = auth.uid()
      and u.ativo = true
      and u.perfil = 'admin'
  );
$$;

create or replace function public.usuario_tem_perfil(perfis text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_app u
    where u.id = auth.uid()
      and u.ativo = true
      and u.perfil = any(perfis)
  );
$$;

drop policy if exists "usuario le proprio perfil ou admin" on public.usuarios_app;
create policy "usuario le proprio perfil ou admin"
on public.usuarios_app
for select
to authenticated
using (id = auth.uid() or public.eh_admin());

drop policy if exists "admin gerencia usuarios" on public.usuarios_app;
create policy "admin gerencia usuarios"
on public.usuarios_app
for all
to authenticated
using (public.eh_admin())
with check (public.eh_admin());

/* ---------------------------------------------------------------------
   2. Tabelas do sistema de subcomponentes
   IDs são text para aceitar tanto UUID quanto IDs antigos do site local.
   --------------------------------------------------------------------- */
create table if not exists public.empresas_subcomponentes (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  tipo text not null default 'Fornecedor',
  cidade text,
  contato text,
  status text not null default 'Ativa',
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null
);

create table if not exists public.estoque_subcomponentes (
  id text primary key default gen_random_uuid()::text,
  data date,
  empresa_id text references public.empresas_subcomponentes(id) on delete set null,
  empresa_nome text,
  subcomponente text not null,
  cod_sap text,
  lote text not null,
  quantidade_entrada numeric not null default 0,
  saldo_atual numeric not null default 0,
  amostragem numeric not null default 0,
  status_estoque text not null default 'Pendente',
  data_inspecao date,
  obs text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null
);

create table if not exists public.inspecoes_subcomponentes (
  id text primary key default gen_random_uuid()::text,
  dia_inspecao date,
  semana text,
  local text,
  subcomponente text not null,
  cod_sap text,
  empresa_id text references public.empresas_subcomponentes(id) on delete set null,
  empresa_nome text,
  lote text not null,
  qtd_estoque numeric not null default 0,
  qtd_amostra numeric not null default 0,
  qtd_inspecionado numeric not null default 0,
  qtd_nc numeric not null default 0,
  status text not null default 'Pendente',
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null
);

create index if not exists idx_empresas_subcomponentes_nome on public.empresas_subcomponentes (nome);
create index if not exists idx_empresas_subcomponentes_status on public.empresas_subcomponentes (status);
create index if not exists idx_estoque_subcomponentes_data on public.estoque_subcomponentes (data desc);
create index if not exists idx_estoque_subcomponentes_empresa on public.estoque_subcomponentes (empresa_id);
create index if not exists idx_estoque_subcomponentes_material_lote on public.estoque_subcomponentes (subcomponente, lote);
create index if not exists idx_estoque_subcomponentes_status on public.estoque_subcomponentes (status_estoque);
create index if not exists idx_inspecoes_subcomponentes_dia on public.inspecoes_subcomponentes (dia_inspecao desc);
create index if not exists idx_inspecoes_subcomponentes_empresa on public.inspecoes_subcomponentes (empresa_id);
create index if not exists idx_inspecoes_subcomponentes_material_lote on public.inspecoes_subcomponentes (subcomponente, lote);
create index if not exists idx_inspecoes_subcomponentes_status on public.inspecoes_subcomponentes (status);
create index if not exists idx_inspecoes_subcomponentes_semana on public.inspecoes_subcomponentes (semana);

alter table public.empresas_subcomponentes enable row level security;
alter table public.estoque_subcomponentes enable row level security;
alter table public.inspecoes_subcomponentes enable row level security;

revoke all on table public.empresas_subcomponentes from anon;
revoke all on table public.estoque_subcomponentes from anon;
revoke all on table public.inspecoes_subcomponentes from anon;

grant select, insert, update, delete on table public.empresas_subcomponentes to authenticated;
grant select, insert, update, delete on table public.estoque_subcomponentes to authenticated;
grant select, insert, update, delete on table public.inspecoes_subcomponentes to authenticated;

/* ---------------------------------------------------------------------
   3. Auditoria simples: preenchimento automático de criado/atualizado
   --------------------------------------------------------------------- */
create or replace function public.preencher_auditoria_subcomponentes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.criado_por is null then
      new.criado_por := auth.uid();
    end if;
    new.atualizado_por := coalesce(new.atualizado_por, auth.uid());
    new.criado_em := coalesce(new.criado_em, now());
    new.atualizado_em := coalesce(new.atualizado_em, now());
  elsif tg_op = 'UPDATE' then
    new.atualizado_por := auth.uid();
    new.atualizado_em := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_empresas_subcomponentes_auditoria on public.empresas_subcomponentes;
create trigger trg_empresas_subcomponentes_auditoria
before insert or update on public.empresas_subcomponentes
for each row execute function public.preencher_auditoria_subcomponentes();

drop trigger if exists trg_estoque_subcomponentes_auditoria on public.estoque_subcomponentes;
create trigger trg_estoque_subcomponentes_auditoria
before insert or update on public.estoque_subcomponentes
for each row execute function public.preencher_auditoria_subcomponentes();

drop trigger if exists trg_inspecoes_subcomponentes_auditoria on public.inspecoes_subcomponentes;
create trigger trg_inspecoes_subcomponentes_auditoria
before insert or update on public.inspecoes_subcomponentes
for each row execute function public.preencher_auditoria_subcomponentes();

/* ---------------------------------------------------------------------
   4. Políticas RLS
   --------------------------------------------------------------------- */
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

/* ---------------------------------------------------------------------
   5. Como cadastrar o primeiro perfil

   1) Supabase > Authentication > Users > Add user.
   2) Copie o UID do usuário criado.
   3) Troque os dados abaixo e rode somente o INSERT.
   --------------------------------------------------------------------- */

/* EXEMPLO — ajuste antes de rodar:
insert into public.usuarios_app (id, nome, email, perfil, ativo)
values ('UUID_DO_USUARIO_AUTH', 'Nome do Usuário', 'email@empresa.com', 'admin', true)
on conflict (id) do update
set nome = excluded.nome,
    email = excluded.email,
    perfil = excluded.perfil,
    ativo = excluded.ativo,
    atualizado_em = now();
*/
