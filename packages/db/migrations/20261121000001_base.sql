-- =====================================================================
-- GestaCondomínio · 0001 · Base: extensões, schema privado, tenant raiz
-- Convenções:
--   * toda tabela de domínio tem condominio_id, created_at, updated_at, created_by
--   * RLS habilitado em TODAS as tabelas (ver 0003)
--   * funções auxiliares ficam no schema "app" (não exposto pela API)
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------
create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function app.set_created_by() returns trigger
language plpgsql as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;

-- Aplica os triggers padrão (updated_at / created_by) a uma tabela.
create or replace function app.padronizar(tabela regclass) returns void
language plpgsql as $$
begin
  execute format('create trigger trg_updated_at before update on %s for each row execute function app.set_updated_at()', tabela);
  execute format('create trigger trg_created_by before insert on %s for each row execute function app.set_created_by()', tabela);
end $$;

-- ---------------------------------------------------------------------
-- Plataforma (dono do sistema)
-- ---------------------------------------------------------------------
create table public.plataforma_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table public.planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  max_unidades int not null,
  preco_mensal numeric(10,2) not null,
  recursos jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

-- O próprio condomínio é o tenant: condominio_id = id.
create table public.condominios (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid generated always as (id) stored,
  nome text not null,
  sigla text not null default '',
  cnpj text,
  cidade text not null,
  uf char(2) not null,
  plano_id uuid references public.planos(id),
  status text not null default 'ativo' check (status in ('implantacao','ativo','suspenso','encerrado')),
  -- Encarregado (DPO) do controlador — exibido na política de privacidade do condomínio.
  encarregado_nome text,
  encarregado_email text,
  retencao_portaria_meses int not null default 6 check (retencao_portaria_meses between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create type public.papel as enum ('sindico','conselho','portaria','morador','hospede');

create table public.membros_condominio (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel public.papel not null,
  ativo boolean not null default true,
  -- 2FA obrigatório para síndico e portaria (sessão AAL2: senha + TOTP, ver auth.verificar_totp).
  exige_2fa boolean generated always as (papel in ('sindico','portaria')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (condominio_id, user_id, papel)
);
create index on public.membros_condominio (user_id) where ativo;

select app.padronizar('public.plataforma_admins');
select app.padronizar('public.planos');
select app.padronizar('public.condominios');
select app.padronizar('public.membros_condominio');
