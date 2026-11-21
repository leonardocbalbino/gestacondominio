-- =====================================================================
-- GestaCondomínio · 0000 · Autenticação própria em Postgres puro
--
-- Modelo de execução (igual em produção e nos testes):
--   * a aplicação conecta com um usuário de login (ex.: gc_app) que só tem
--     permissão de assumir os papéis anon / authenticated / service_role;
--   * cada requisição roda numa transação com
--       SET LOCAL ROLE authenticated;
--       SELECT set_config('request.jwt.claims', '{"sub":"<uuid>"}', true);
--       SELECT set_config('app.crypto_key', '<chave do .env>', true);
--   * auth.uid() lê o "sub" → as políticas RLS se aplicam no banco.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

grant usage on schema public, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome text,
  senha_hash text,                      -- bcrypt (pgcrypto crypt/gen_salt('bf'))
  email_confirmado_em timestamptz,
  totp_segredo_cripto bytea,            -- segredo TOTP criptografado com app.crypto_key
  totp_ativo boolean not null default false,
  tentativas_falhas int not null default 0,
  bloqueado_ate timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index users_email_unico on auth.users (lower(email));

create table auth.sessoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,      -- sha256 do token; o token em claro só existe no cookie/app
  aal smallint not null default 1,      -- 1 = senha; 2 = senha + TOTP
  canal text not null check (canal in ('web','mobile')),
  ip inet,
  user_agent text,
  expira_em timestamptz not null,
  ultimo_uso timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on auth.sessoes (user_id);

-- Tabelas de auth nunca são lidas diretamente pelos papéis da aplicação.
revoke all on all tables in schema auth from anon, authenticated;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  ), '')::uuid
$$;

create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;

create or replace function auth.hash(t text) returns text
language sql immutable as $$ select encode(extensions.digest(t, 'sha256'), 'hex') $$;

create or replace function auth.chave() returns text
language plpgsql stable as $$
declare v text := nullif(current_setting('app.crypto_key', true), '');
begin
  if v is null then raise exception 'app.crypto_key não definida na transação'; end if;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Login com bloqueio após 5 falhas (15 min). Devolve um token opaco.
-- Falhas NÃO levantam exceção: um RAISE desfaria o incremento do contador.
-- erro ∈ (null, 'credenciais', 'bloqueada').
-- ---------------------------------------------------------------------
create or replace function auth.entrar(p_email text, p_senha text, p_canal text, p_ip text default null, p_ua text default null)
returns table (token text, user_id uuid, totp_ativo boolean, erro text)
language plpgsql security definer set search_path = '' as $$
declare u auth.users; t text;
begin
  select * into u from auth.users where lower(email) = lower(trim(p_email)) for update;
  if u.id is null then
    perform extensions.crypt(p_senha, extensions.gen_salt('bf')); -- tempo ~constante
    return query select null::text, null::uuid, null::boolean, 'credenciais'::text;
    return;
  end if;
  if u.bloqueado_ate is not null and u.bloqueado_ate > now() then
    return query select null::text, null::uuid, null::boolean, 'bloqueada'::text;
    return;
  end if;
  if u.senha_hash is null or u.senha_hash <> extensions.crypt(p_senha, u.senha_hash) then
    update auth.users set tentativas_falhas = tentativas_falhas + 1,
      bloqueado_ate = case when tentativas_falhas + 1 >= 5 then now() + interval '15 minutes' end
    where id = u.id;
    return query select null::text, null::uuid, null::boolean,
      case when u.tentativas_falhas + 1 >= 5 then 'bloqueada' else 'credenciais' end;
    return;
  end if;
  update auth.users set tentativas_falhas = 0, bloqueado_ate = null where id = u.id;
  t := encode(extensions.gen_random_bytes(32), 'hex');
  insert into auth.sessoes (user_id, token_hash, canal, ip, user_agent, expira_em)
  values (u.id, auth.hash(t), p_canal, nullif(p_ip, '')::inet, left(p_ua, 300),
          now() + case when p_canal = 'mobile' then interval '30 days' else interval '12 hours' end);
  return query select t, u.id, u.totp_ativo, null::text;
end $$;

create or replace function auth.sessao(p_token text)
returns table (user_id uuid, aal smallint, totp_ativo boolean, nome text, email text)
language sql security definer set search_path = '' as $$
  update auth.sessoes s set ultimo_uso = now()
  from auth.users u
  where s.token_hash = auth.hash(p_token) and s.expira_em > now() and u.id = s.user_id
  returning s.user_id, s.aal, u.totp_ativo, u.nome, u.email
$$;

create or replace function auth.sair(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from auth.sessoes where token_hash = auth.hash(p_token)
$$;

-- Troca de senha pelo próprio usuário (encerra as outras sessões).
create or replace function auth.trocar_senha(p_token text, p_nova text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if length(p_nova) < 10 then raise exception 'a senha precisa ter ao menos 10 caracteres' using errcode = '22023'; end if;
  select s.user_id into uid from auth.sessoes s where s.token_hash = auth.hash(p_token) and s.expira_em > now();
  if uid is null then raise exception 'sessão inválida' using errcode = '28000'; end if;
  update auth.users set senha_hash = extensions.crypt(p_nova, extensions.gen_salt('bf')), updated_at = now() where id = uid;
  delete from auth.sessoes where user_id = uid and token_hash <> auth.hash(p_token);
end $$;

-- ---------------------------------------------------------------------
-- TOTP (RFC 6238) verificado DENTRO do banco: o segredo nunca sai daqui
-- depois do cadastro.
-- ---------------------------------------------------------------------
create or replace function auth.totp_codigo(segredo bytea, passo bigint) returns text
language plpgsql immutable as $$
declare h bytea; o int; bin bigint;
begin
  h := extensions.hmac(int8send(passo), segredo, 'sha1');
  o := get_byte(h, 19) & 15;
  bin := ((get_byte(h, o) & 127)::bigint << 24) | (get_byte(h, o + 1)::bigint << 16)
       | (get_byte(h, o + 2)::bigint << 8) | get_byte(h, o + 3)::bigint;
  return lpad((bin % 1000000)::text, 6, '0');
end $$;

create or replace function auth.totp_valido(segredo bytea, codigo text) returns boolean
language sql stable as $$
  select exists (
    select 1 from generate_series(-1, 1) j
    where auth.totp_codigo(segredo, floor(extract(epoch from now()) / 30)::bigint + j) = trim(codigo)
  )
$$;

-- Gera um segredo novo (pendente até confirmar). Devolve hex para o app montar o otpauth://.
create or replace function auth.iniciar_totp(p_token text) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid; seg bytea := extensions.gen_random_bytes(20);
begin
  select s.user_id into uid from auth.sessoes s where s.token_hash = auth.hash(p_token) and s.expira_em > now();
  if uid is null then raise exception 'sessão inválida' using errcode = '28000'; end if;
  if (select totp_ativo from auth.users where id = uid) then raise exception '2FA já ativo' using errcode = '22023'; end if;
  update auth.users set totp_segredo_cripto = extensions.pgp_sym_encrypt_bytea(seg, auth.chave()) where id = uid;
  return encode(seg, 'hex');
end $$;

-- Confirma o código: ativa o 2FA (se pendente) e eleva a sessão para AAL2.
create or replace function auth.verificar_totp(p_token text, p_codigo text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare s auth.sessoes; u auth.users;
begin
  select * into s from auth.sessoes where token_hash = auth.hash(p_token) and expira_em > now();
  if s.id is null then raise exception 'sessão inválida' using errcode = '28000'; end if;
  select * into u from auth.users where id = s.user_id;
  if u.totp_segredo_cripto is null
     or not auth.totp_valido(extensions.pgp_sym_decrypt_bytea(u.totp_segredo_cripto, auth.chave()), p_codigo) then
    return false;
  end if;
  update auth.users set totp_ativo = true where id = u.id;
  update auth.sessoes set aal = 2 where id = s.id;
  return true;
end $$;

revoke all on all functions in schema auth from public;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
grant execute on function auth.entrar(text, text, text, text, text), auth.sessao(text), auth.sair(text),
  auth.trocar_senha(text, text), auth.iniciar_totp(text), auth.verificar_totp(text, text) to anon, authenticated, service_role;

-- Limpeza de sessões vencidas (chamada pelo worker).
create or replace function auth.limpar_sessoes() returns int
language sql security definer set search_path = '' as $$
  with d as (delete from auth.sessoes where expira_em < now() returning 1) select count(*)::int from d
$$;
grant execute on function auth.limpar_sessoes() to service_role;
