-- =====================================================================
-- GestaCondomínio · 0007 · Cadastro por convite, reservas, encomendas, push
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cadastro por convite (não existe cadastro aberto): o anon chama com o
-- token recebido por e-mail; a conta é criada com o e-mail do convite.
-- ---------------------------------------------------------------------
create or replace function public.cadastrar_por_convite(p_token text, p_nome text, p_senha text) returns text
language plpgsql security definer set search_path = '' as $$
declare c public.convites; uid uuid;
begin
  if length(coalesce(p_senha, '')) < 10 then raise exception 'a senha precisa ter ao menos 10 caracteres' using errcode = '22023'; end if;
  select * into c from public.convites where token_hash = app.hash_token(p_token) for update;
  if c.id is null or c.aceito_em is not null or c.expira_em < now() then
    raise exception 'convite inválido ou expirado' using errcode = '22023';
  end if;
  select id into uid from auth.users where lower(email) = lower(c.email);
  if uid is not null then
    raise exception 'já existe conta com este e-mail: entre e aceite o convite' using errcode = '23505';
  end if;
  insert into auth.users (email, nome, senha_hash, email_confirmado_em)
  values (lower(c.email), p_nome, extensions.crypt(p_senha, extensions.gen_salt('bf')), now())  -- o link do e-mail confirma o endereço
  returning id into uid;
  insert into public.membros_condominio (condominio_id, user_id, papel, created_by) values (c.condominio_id, uid, c.papel, uid);
  insert into public.pessoas (condominio_id, user_id, nome, email, created_by) values (c.condominio_id, uid, p_nome, lower(c.email), uid);
  update public.convites set aceito_em = now() where id = c.id;
  if c.papel = 'sindico' then
    update public.condominios set status = 'ativo' where id = c.condominio_id and status = 'implantacao';
  end if;
  perform app.registrar_auditoria(c.condominio_id, 'cadastro_por_convite', 'convites', c.id);
  return lower(c.email);
end $$;
revoke all on function public.cadastrar_por_convite(text, text, text) from public;
grant execute on function public.cadastrar_por_convite(text, text, text) to anon, authenticated;

-- Dados mínimos para a tela do convite (sem expor o e-mail completo).
create or replace function public.convite_info(p_token text)
returns table (condominio text, papel text, email_mascarado text, valido boolean)
language sql stable security definer set search_path = '' as $$
  select c2.nome, c.papel::text,
         left(c.email, 2) || '***@' || split_part(c.email, '@', 2),
         c.aceito_em is null and c.expira_em > now()
  from public.convites c join public.condominios c2 on c2.id = c.condominio_id
  where c.token_hash = app.hash_token(p_token)
$$;
grant execute on function public.convite_info(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Reservas: o banco impede dois pedidos ativos no mesmo espaço e horário.
-- ---------------------------------------------------------------------
create extension if not exists btree_gist with schema extensions;
alter table public.reservas add constraint reservas_sem_sobreposicao
  exclude using gist (area_id with =, tstzrange(inicio, fim) with &&)
  where (status in ('aguardando_sindico', 'confirmada'));

-- Ocupação das áreas (sem dizer qual unidade reservou) para o morador escolher horário.
create or replace function public.ocupacao_area(p_area uuid, p_de timestamptz, p_ate timestamptz)
returns table (inicio timestamptz, fim timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare cid uuid;
begin
  select condominio_id into cid from public.areas_comuns where id = p_area;
  if cid is null or not app.is_membro(cid) or app.is_dono() then raise exception 'sem permissão' using errcode = '42501'; end if;
  return query select r.inicio, r.fim from public.reservas r
    where r.area_id = p_area and r.status in ('aguardando_sindico','confirmada') and r.fim > p_de and r.inicio < p_ate
    order by r.inicio;
end $$;
revoke execute on function public.ocupacao_area(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.ocupacao_area(uuid, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- Encomenda registrada pela portaria → notificação para os moradores da unidade.
-- ---------------------------------------------------------------------
create or replace function app.trg_notificar_encomenda() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notificacoes (condominio_id, user_id, titulo, corpo, link)
  select new.condominio_id, p.user_id, 'Chegou uma encomenda', new.descricao, '/encomendas'
  from public.vinculos v join public.pessoas p on p.id = v.pessoa_id
  where v.unidade_id = new.unidade_id and p.user_id is not null
    and v.tipo in ('proprietario','inquilino','residente') and (v.fim is null or v.fim > now());
  return new;
end $$;
create trigger trg_notificar_encomenda after insert on public.encomendas
  for each row execute function app.trg_notificar_encomenda();

-- ---------------------------------------------------------------------
-- Push (Expo): dispositivos por usuário; o worker envia as notificações pendentes.
-- ---------------------------------------------------------------------
create table public.dispositivos_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  plataforma text not null check (plataforma in ('ios','android','web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
select app.padronizar('public.dispositivos_push');
alter table public.dispositivos_push enable row level security;
create policy proprio on public.dispositivos_push for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.dispositivos_push from anon;

alter table public.notificacoes add column push_enviado_em timestamptz;
create index on public.notificacoes (created_at) where push_enviado_em is null;
