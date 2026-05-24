/* =====================================================================
   Materiais — Sistema de Qualidade de Subcomponentes
   Rode este arquivo no SQL Editor do Supabase.
   Não apaga dados existentes. Cria a tabela de materiais e integra
   com RLS, perfis e auditoria.
   ===================================================================== */

create extension if not exists "pgcrypto";

create table if not exists public.materiais_subcomponentes (
  id text primary key default gen_random_uuid()::text,
  fornecedor_id text references public.empresas_subcomponentes(id) on delete set null,
  fornecedor_nome text,
  subcomponente text not null,
  cod_sap text,
  tipo_material text,
  criticidade text not null default 'Média',
  norma text,
  plano_amostragem text,
  nivel_inspecao text,
  etm text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null
);

create index if not exists idx_materiais_subcomponentes_fornecedor on public.materiais_subcomponentes (fornecedor_id);
create index if not exists idx_materiais_subcomponentes_nome on public.materiais_subcomponentes (subcomponente);
create index if not exists idx_materiais_subcomponentes_sap on public.materiais_subcomponentes (cod_sap);
create index if not exists idx_materiais_subcomponentes_tipo on public.materiais_subcomponentes (tipo_material);
create index if not exists idx_materiais_subcomponentes_criticidade on public.materiais_subcomponentes (criticidade);

alter table public.materiais_subcomponentes enable row level security;
revoke all on table public.materiais_subcomponentes from anon;
grant select, insert, update, delete on table public.materiais_subcomponentes to authenticated;

-- Recria a função de auditoria de datas/usuário para garantir que a tabela nova use os mesmos campos.
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

drop trigger if exists trg_materiais_subcomponentes_auditoria on public.materiais_subcomponentes;
create trigger trg_materiais_subcomponentes_auditoria
before insert or update on public.materiais_subcomponentes
for each row execute function public.preencher_auditoria_subcomponentes();

-- Atualiza o resumo da auditoria para incluir a nova tabela de materiais.
create or replace function public.resumo_auditoria_subcomponentes(nome_tabela text, dados jsonb)
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  if nome_tabela = 'empresas_subcomponentes' then
    return concat_ws(' | ', 'Empresa: ' || coalesce(dados->>'nome', ''), 'Status: ' || coalesce(dados->>'status', ''));
  elsif nome_tabela = 'materiais_subcomponentes' then
    return concat_ws(' | ', 'Material: ' || coalesce(dados->>'subcomponente', ''), 'SAP: ' || coalesce(dados->>'cod_sap', ''), 'Fornecedor: ' || coalesce(dados->>'fornecedor_nome', ''), 'Criticidade: ' || coalesce(dados->>'criticidade', ''));
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

-- Política de acesso: admin e qualidade escrevem; consulta apenas visualiza.
drop policy if exists "usuarios ativos leem materiais_subcomponentes" on public.materiais_subcomponentes;
create policy "usuarios ativos leem materiais_subcomponentes"
on public.materiais_subcomponentes
for select
to authenticated
using (public.usuario_ativo());

drop policy if exists "qualidade cadastra materiais_subcomponentes" on public.materiais_subcomponentes;
create policy "qualidade cadastra materiais_subcomponentes"
on public.materiais_subcomponentes
for insert
to authenticated
with check (public.usuario_tem_perfil(array['admin', 'qualidade']));

drop policy if exists "qualidade edita materiais_subcomponentes" on public.materiais_subcomponentes;
create policy "qualidade edita materiais_subcomponentes"
on public.materiais_subcomponentes
for update
to authenticated
using (public.usuario_tem_perfil(array['admin', 'qualidade']))
with check (public.usuario_tem_perfil(array['admin', 'qualidade']));

drop policy if exists "qualidade exclui materiais_subcomponentes" on public.materiais_subcomponentes;
create policy "qualidade exclui materiais_subcomponentes"
on public.materiais_subcomponentes
for delete
to authenticated
using (public.usuario_tem_perfil(array['admin', 'qualidade']));

-- Auditoria de INSERT, UPDATE e DELETE na tabela nova.
drop trigger if exists trg_audit_materiais_subcomponentes on public.materiais_subcomponentes;
create trigger trg_audit_materiais_subcomponentes
after insert or update or delete on public.materiais_subcomponentes
for each row execute function public.registrar_auditoria_subcomponentes();
