-- =====================================================================
-- GestaCondomínio · 0004 · Auditoria, criptografia, RPCs e views
-- RPCs públicas ficam em "public" (expostas pelo PostgREST via supabase.rpc);
-- todas são SECURITY DEFINER com search_path vazio e checam permissão explicitamente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Auditoria imutável
-- ---------------------------------------------------------------------
create or replace function app.registrar_auditoria(
  p_condominio uuid, p_acao text, p_tabela text default null, p_registro uuid default null,
  p_campos text[] default null, p_contexto jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_papel text;
begin
  select case when app.is_dono() then 'dono' else (
    select string_agg(m.papel::text, ',') from public.membros_condominio m
    where m.condominio_id = p_condominio and m.user_id = auth.uid() and m.ativo) end
  into v_papel;
  insert into public.auditoria (condominio_id, ator, ator_papel, acao, tabela, registro_id, campos, contexto, created_by)
  values (p_condominio, auth.uid(), coalesce(v_papel, case when auth.uid() is null then 'sistema' end),
          p_acao, p_tabela, p_registro, p_campos, p_contexto, auth.uid());
end $$;

create or replace function app.trg_auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_campos text[];
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_campos
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key not in ('updated_at');
  end if;
  perform app.registrar_auditoria(
    (v_row->>'condominio_id')::uuid, lower(tg_op), tg_table_name, (v_row->>'id')::uuid, v_campos);
  return coalesce(new, old);
end $$;

create or replace function app.trg_auditoria_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'auditoria é imutável (operação % negada)', tg_op using errcode = '42501';
end $$;

create trigger trg_imutavel before update or delete on public.auditoria
  for each row execute function app.trg_auditoria_imutavel();
create trigger trg_imutavel_truncate before truncate on public.auditoria
  for each statement execute function app.trg_auditoria_imutavel();

do $$
declare t text;
begin
  foreach t in array array[
    'condominios','membros_condominio','pessoas','vinculos','cessoes_vaga','locacoes','hospedes','biometrias',
    'consentimentos','pedidos_titular','acessos_suporte','aceites_dpa','demandas_transparencia','cotacoes',
    'registros_acesso','convites','equipamentos_acesso','votos'
  ] loop
    execute format('create trigger trg_auditar after insert or update or delete on public.%I for each row execute function app.trg_auditar()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Criptografia de colunas (CPF/celular)
-- Chave: Supabase Vault (segredo "app_crypto_key") ou GUC app.crypto_key em dev/teste.
-- ---------------------------------------------------------------------
create or replace function app.chave_cripto() returns text
language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  if to_regclass('vault.decrypted_secrets') is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v using 'app_crypto_key';
  end if;
  v := coalesce(v, nullif(current_setting('app.crypto_key', true), ''));
  if v is null then
    raise exception 'chave de criptografia não configurada (Vault app_crypto_key ou app.crypto_key)';
  end if;
  return v;
end $$;
revoke all on function app.chave_cripto() from public, anon, authenticated;

create or replace function app.so_digitos(t text) returns text
language sql immutable as $$ select regexp_replace(coalesce(t, ''), '\D', '', 'g') $$;

create or replace function app.mascarar_cpf(cpf text) returns text
language sql immutable as $$
  select case when length(app.so_digitos(cpf)) = 11
    then '***.' || substr(app.so_digitos(cpf), 4, 3) || '.' || substr(app.so_digitos(cpf), 7, 3) || '-**'
    else '***.***.***-**' end
$$;

create or replace function app.mascarar_celular(cel text) returns text
language sql immutable as $$
  select case when length(app.so_digitos(cel)) = 11
    then '(' || substr(app.so_digitos(cel), 1, 2) || ') 9 ****-' || right(app.so_digitos(cel), 4)
    else '(**) ****-****' end
$$;

-- Grava CPF/celular criptografados. Chamada por RPCs e pelo seed.
create or replace function app.definir_documentos(p_pessoa uuid, p_cpf text, p_celular text) returns void
language plpgsql security definer set search_path = '' as $$
declare k text := app.chave_cripto();
begin
  update public.pessoas set
    cpf_cripto = case when p_cpf is null then cpf_cripto else extensions.pgp_sym_encrypt(app.so_digitos(p_cpf), k) end,
    cpf_hash = case when p_cpf is null then cpf_hash else encode(extensions.hmac(app.so_digitos(p_cpf), k, 'sha256'), 'hex') end,
    cpf_mascarado = case when p_cpf is null then cpf_mascarado else app.mascarar_cpf(p_cpf) end,
    celular_cripto = case when p_celular is null then celular_cripto else extensions.pgp_sym_encrypt(app.so_digitos(p_celular), k) end,
    celular_mascarado = case when p_celular is null then celular_mascarado else app.mascarar_celular(p_celular) end
  where id = p_pessoa;
end $$;
revoke all on function app.definir_documentos(uuid, text, text) from public, anon, authenticated;

-- CPF completo: só síndico do condomínio ou o próprio titular. Toda leitura é auditada.
create or replace function public.cpf_completo(p_pessoa uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare p public.pessoas;
begin
  select * into p from public.pessoas where id = p_pessoa;
  if p.id is null then return null; end if;
  if not (p.user_id = auth.uid() or (app.is_sindico(p.condominio_id) and not app.is_dono())) then
    raise exception 'sem permissão para ver o CPF completo' using errcode = '42501';
  end if;
  perform app.registrar_auditoria(p.condominio_id, 'ler_cpf_completo', 'pessoas', p.id);
  return extensions.pgp_sym_decrypt(p.cpf_cripto, app.chave_cripto());
end $$;

-- ---------------------------------------------------------------------
-- Tokens (links faciais e convites): guardamos só o SHA-256
-- ---------------------------------------------------------------------
create or replace function app.hash_token(t text) returns text
language sql immutable as $$ select encode(extensions.digest(t, 'sha256'), 'hex') $$;

create or replace function app.novo_token() returns text
language sql volatile as $$ select encode(extensions.gen_random_bytes(24), 'hex') $$;

-- ---------------------------------------------------------------------
-- Dono do sistema: criar condomínio + convidar síndico; métricas agregadas
-- ---------------------------------------------------------------------
create or replace function public.criar_condominio(
  p_nome text, p_cidade text, p_uf text, p_plano uuid, p_sindico_email text, p_sindico_nome text, p_cnpj text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_token text := app.novo_token();
begin
  if not app.is_dono() then raise exception 'apenas o dono do sistema cria condomínios' using errcode = '42501'; end if;
  insert into public.condominios (nome, sigla, cidade, uf, plano_id, cnpj, status, created_by)
  values (p_nome, app.sigla(p_nome), p_cidade, upper(p_uf), p_plano, nullif(app.so_digitos(p_cnpj), ''), 'implantacao', auth.uid())
  returning id into v_id;
  insert into public.convites (condominio_id, email, nome, papel, token_hash, created_by)
  values (v_id, lower(p_sindico_email), p_sindico_nome, 'sindico', app.hash_token(v_token), auth.uid());
  perform app.registrar_auditoria(v_id, 'criar_condominio', 'condominios', v_id);
  -- O token volta uma única vez para o servidor enviar o e-mail de convite.
  return jsonb_build_object('condominio_id', v_id, 'convite_token', v_token);
end $$;

create or replace function public.aceitar_convite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.convites; v_pessoa uuid;
begin
  if auth.uid() is null then raise exception 'faça login para aceitar o convite' using errcode = '42501'; end if;
  select * into c from public.convites where token_hash = app.hash_token(p_token) for update;
  if c.id is null or c.aceito_em is not null or c.expira_em < now() then
    raise exception 'convite inválido ou expirado' using errcode = '22023';
  end if;
  insert into public.membros_condominio (condominio_id, user_id, papel, created_by)
  values (c.condominio_id, auth.uid(), c.papel, auth.uid()) on conflict do nothing;
  select id into v_pessoa from public.pessoas where condominio_id = c.condominio_id and user_id = auth.uid();
  if v_pessoa is null then
    insert into public.pessoas (condominio_id, user_id, nome, email, created_by)
    values (c.condominio_id, auth.uid(), c.nome, c.email, auth.uid());
  end if;
  update public.convites set aceito_em = now() where id = c.id;
  if c.papel = 'sindico' then
    update public.condominios set status = 'ativo' where id = c.condominio_id and status = 'implantacao';
  end if;
  return c.condominio_id;
end $$;

-- Aceite do DPA (contrato de operador) pelo síndico — registra data, IP e versão.
create or replace function public.aceitar_dpa(p_condominio uuid, p_versao text, p_ip text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.is_sindico(p_condominio) then raise exception 'apenas o síndico aceita o DPA' using errcode = '42501'; end if;
  insert into public.aceites_dpa (condominio_id, versao, aceito_por, ip, created_by)
  values (p_condominio, p_versao, auth.uid(), nullif(p_ip, '')::inet, auth.uid());
end $$;

-- "Res. Jardim das Acácias" → "JA"
create or replace function app.sigla(nome text) returns text
language sql immutable as $$
  select upper(string_agg(left(w, 1), '' order by ord))
  from (
    select w, ord from unnest(string_to_array(
      regexp_replace(nome, '^\s*(res\.|cond\.|residencial|condom[ií]nio|edif[ií]cio|ed\.)\s*', '', 'i'), ' ')) with ordinality as t(w, ord)
    where w <> '' and lower(w) not in ('de','da','das','do','dos','e')
    order by ord limit 2
  ) s
$$;

-- Contagens < 3 viram "< 3" (k-anonimato) para impedir reidentificação.
create or replace function app.k(n bigint) returns text
language sql immutable as $$ select case when n < 3 then '< 3' else n::text end $$;

create or replace function public.metricas_dono()
returns table (
  condominio_id uuid, nome text, cidade text, uf text, plano text, status text,
  unidades text, moradores_ativos text, pedidos_30d text, biometrias_ativas text, hospedes_mes text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_dono() then raise exception 'apenas o dono do sistema' using errcode = '42501'; end if;
  return query
  select c.id, c.nome, c.cidade, c.uf::text, pl.nome, c.status,
    app.k((select count(*) from public.unidades u where u.condominio_id = c.id)),
    app.k((select count(distinct v.pessoa_id) from public.vinculos v where v.condominio_id = c.id
           and v.tipo in ('proprietario','inquilino','residente') and (v.fim is null or v.fim > now()))),
    app.k((select count(*) from public.cessoes_vaga x where x.condominio_id = c.id and x.created_at > now() - interval '30 days')
        + (select count(*) from public.locacoes x where x.condominio_id = c.id and x.created_at > now() - interval '30 days')
        + (select count(*) from public.reservas x where x.condominio_id = c.id and x.created_at > now() - interval '30 days')),
    app.k((select count(*) from public.biometrias b where b.condominio_id = c.id)),
    app.k((select count(*) from public.hospedes h join public.locacoes l on l.id = h.locacao_id
           where h.condominio_id = c.id and l.inicio > date_trunc('month', now())))
  from public.condominios c
  left join public.planos pl on pl.id = c.plano_id
  order by c.nome;
end $$;

-- Totais da plataforma (também agregados).
create or replace function public.totais_plataforma()
returns table (condominios bigint, unidades text, moradores text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_dono() then raise exception 'apenas o dono do sistema' using errcode = '42501'; end if;
  return query select
    (select count(*) from public.condominios),
    app.k((select count(*) from public.unidades)),
    app.k((select count(distinct pessoa_id) from public.vinculos where tipo in ('proprietario','inquilino','residente')));
end $$;

-- ---------------------------------------------------------------------
-- Break-glass
-- ---------------------------------------------------------------------
create or replace function public.solicitar_suporte(p_condominio uuid, p_motivo text, p_horas int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  if not app.is_dono() then raise exception 'apenas o suporte da plataforma' using errcode = '42501'; end if;
  if p_horas not in (1,4,24) then raise exception 'duração deve ser 1h, 4h ou 24h' using errcode = '22023'; end if;
  insert into public.acessos_suporte (condominio_id, solicitado_por, motivo, duracao_horas, created_by)
  values (p_condominio, auth.uid(), p_motivo, p_horas, auth.uid()) returning id into v;
  insert into public.notificacoes (condominio_id, user_id, titulo, corpo, link)
  select p_condominio, m.user_id, 'Pedido de acesso do suporte', p_motivo, '/sindico/suporte'
  from public.membros_condominio m where m.condominio_id = p_condominio and m.papel = 'sindico' and m.ativo;
  return v;
end $$;

create or replace function public.decidir_suporte(p_id uuid, p_aprovar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.acessos_suporte;
begin
  select * into s from public.acessos_suporte where id = p_id for update;
  if s.id is null or not app.is_sindico(s.condominio_id) then
    raise exception 'apenas o síndico decide o acesso de suporte' using errcode = '42501';
  end if;
  if s.status <> 'solicitado' then raise exception 'pedido já decidido' using errcode = '22023'; end if;
  update public.acessos_suporte set
    status = case when p_aprovar then 'aprovado' else 'negado' end,
    aprovado_por = auth.uid(),
    inicio = case when p_aprovar then now() end,
    expira_em = case when p_aprovar then now() + make_interval(hours => s.duracao_horas) end
  where id = p_id;
end $$;

create or replace function public.revogar_suporte(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.acessos_suporte;
begin
  select * into s from public.acessos_suporte where id = p_id;
  if s.id is null or not app.is_sindico(s.condominio_id) then raise exception 'sem permissão' using errcode = '42501'; end if;
  update public.acessos_suporte set status = 'revogado', expira_em = now() where id = p_id and status = 'aprovado';
end $$;

-- ---------------------------------------------------------------------
-- Morador: cessão de vaga
-- ---------------------------------------------------------------------
-- Unidades para o seletor "Unidade que vai usar": código + nome do responsável. Só para membros.
create or replace function public.unidades_destino(p_condominio uuid)
returns table (unidade_id uuid, rotulo text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.tem_papel(p_condominio, '{morador,sindico}') or app.is_dono() then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  return query
  select u.id, u.codigo || coalesce(' · ' || (
      select split_part(p.nome, ' ', 1) || ' ' || split_part(p.nome, ' ', array_length(string_to_array(p.nome, ' '), 1))
      from public.vinculos v join public.pessoas p on p.id = v.pessoa_id
      where v.unidade_id = u.id and v.responsavel and (v.fim is null or v.fim > now()) limit 1), '')
  from public.unidades u
  where u.condominio_id = p_condominio and u.id not in (select app.minhas_unidades())
  order by u.codigo;
end $$;

create or replace function public.responder_cessao(p_id uuid, p_aceitar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.cessoes_vaga;
begin
  select * into c from public.cessoes_vaga where id = p_id for update;
  if c.id is null or c.unidade_cessionaria_id not in (select app.minhas_unidades()) then
    raise exception 'apenas a unidade cessionária confirma' using errcode = '42501';
  end if;
  if c.status <> 'aguardando_cessionario' then raise exception 'pedido não está aguardando a unidade' using errcode = '22023'; end if;
  update public.cessoes_vaga set status = case when p_aceitar then 'aguardando_sindico' else 'recusada' end where id = p_id;
end $$;

-- Síndico decide cessões, locações e reservas.
create or replace function public.decidir_pedido(p_tipo text, p_id uuid, p_aprovar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_cid uuid; v_status text; v_unidade uuid; v_fim timestamptz;
begin
  if p_tipo = 'cessao' then
    select condominio_id, status, unidade_cedente_id, fim::timestamptz into v_cid, v_status, v_unidade, v_fim from public.cessoes_vaga where id = p_id for update;
  elsif p_tipo = 'locacao' then
    select condominio_id, status, unidade_id, fim into v_cid, v_status, v_unidade, v_fim from public.locacoes where id = p_id for update;
  elsif p_tipo = 'reserva' then
    select condominio_id, status, unidade_id into v_cid, v_status, v_unidade from public.reservas where id = p_id for update;
  else
    raise exception 'tipo inválido' using errcode = '22023';
  end if;
  if v_cid is null or not app.is_sindico(v_cid) then raise exception 'apenas o síndico decide' using errcode = '42501'; end if;
  if v_status <> 'aguardando_sindico' then raise exception 'pedido não está com o síndico' using errcode = '22023'; end if;

  if p_tipo = 'cessao' then
    update public.cessoes_vaga set status = case when p_aprovar then 'aprovada' else 'recusada' end,
      motivo_decisao = p_motivo, decidido_por = auth.uid(), decidido_em = now() where id = p_id;
  elsif p_tipo = 'locacao' then
    update public.locacoes set status = case when p_aprovar then 'aprovada' else 'recusada' end,
      motivo_decisao = p_motivo, decidido_por = auth.uid(), decidido_em = now() where id = p_id;
    -- Biometria dos hóspedes/locatário é apagada no fim do período (ou já, se recusada).
    update public.biometrias b set apagar_em = case when p_aprovar then v_fim else now() end
    where b.pessoa_id in (select h.pessoa_id from public.hospedes h where h.locacao_id = p_id);
  else
    update public.reservas set status = case when p_aprovar then 'confirmada' else 'recusada' end where id = p_id;
  end if;

  -- Avisa os moradores da unidade solicitante.
  insert into public.notificacoes (condominio_id, user_id, titulo, link)
  select v_cid, p.user_id,
         case when p_aprovar then 'Seu pedido foi aprovado' else 'Seu pedido foi recusado' end, '/inicio'
  from public.vinculos v join public.pessoas p on p.id = v.pessoa_id
  where v.unidade_id = v_unidade and p.user_id is not null and (v.fim is null or v.fim > now());
end $$;

-- ---------------------------------------------------------------------
-- Morador: cadastrar locatário (temporada | aluguel)
-- Retorna os tokens dos links faciais UMA vez para o app compartilhar.
-- ---------------------------------------------------------------------
create or replace function app.criar_locacao(
  p_unidade uuid, p_tipo text, p_nome text, p_celular text, p_inicio timestamptz, p_fim timestamptz,
  p_qtd int, p_origem text, p_imobiliaria text, p_contrato text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cid uuid; v_pessoa uuid; v_loc uuid; v_token text := app.novo_token();
begin
  select condominio_id into v_cid from public.unidades where id = p_unidade;
  if v_cid is null or p_unidade not in (select app.minhas_unidades()) then
    raise exception 'você só cadastra locatários da sua unidade' using errcode = '42501';
  end if;
  if p_fim <= p_inicio then raise exception 'o fim deve ser depois do início' using errcode = '22023'; end if;

  insert into public.pessoas (condominio_id, nome, created_by) values (v_cid, p_nome, auth.uid()) returning id into v_pessoa;
  perform app.definir_documentos(v_pessoa, null, p_celular);
  insert into public.vinculos (condominio_id, pessoa_id, unidade_id, tipo, inicio, fim, created_by)
  values (v_cid, v_pessoa, p_unidade, case when p_tipo = 'temporada' then 'locatario_temporada' else 'inquilino' end::public.tipo_vinculo,
          p_inicio, p_fim, auth.uid());
  insert into public.locacoes (condominio_id, unidade_id, tipo, responsavel_pessoa_id, inicio, fim, qtd_pessoas, origem, imobiliaria, contrato_path, created_by)
  values (v_cid, p_unidade, p_tipo, v_pessoa, p_inicio, p_fim, p_qtd, p_origem, p_imobiliaria, p_contrato, auth.uid())
  returning id into v_loc;
  insert into public.hospedes (condominio_id, locacao_id, pessoa_id, created_by) values (v_cid, v_loc, v_pessoa, auth.uid());
  insert into public.links_facial (condominio_id, pessoa_id, unidade_id, token_hash, expira_em, created_by)
  values (v_cid, v_pessoa, p_unidade, app.hash_token(v_token), least(now() + interval '48 hours', p_fim), auth.uid());

  insert into public.notificacoes (condominio_id, user_id, titulo, link)
  select v_cid, m.user_id, 'Novo locatário para aprovar', '/sindico/aprovacoes'
  from public.membros_condominio m where m.condominio_id = v_cid and m.papel = 'sindico' and m.ativo;

  return jsonb_build_object('locacao_id', v_loc, 'links', jsonb_build_array(jsonb_build_object('pessoa_id', v_pessoa, 'token', v_token)));
end $$;
revoke all on function app.criar_locacao(uuid, text, text, text, timestamptz, timestamptz, int, text, text, text) from public, anon;
grant execute on function app.criar_locacao(uuid, text, text, text, timestamptz, timestamptz, int, text, text, text) to authenticated;

create or replace function public.criar_locacao_temporada(
  p_unidade uuid, p_responsavel text, p_celular text, p_checkin timestamptz, p_checkout timestamptz, p_hospedes int, p_origem text
) returns jsonb language sql security definer set search_path = '' as $$
  select app.criar_locacao(p_unidade, 'temporada', p_responsavel, p_celular, p_checkin, p_checkout, p_hospedes, p_origem, null, null)
$$;

create or replace function public.criar_locacao_aluguel(
  p_unidade uuid, p_nome text, p_celular text, p_inicio date, p_fim date, p_moradores int, p_imobiliaria text default null, p_contrato text default null
) returns jsonb language sql security definer set search_path = '' as $$
  select app.criar_locacao(p_unidade, 'aluguel', p_nome, p_celular,
    (p_inicio::timestamp at time zone 'America/Sao_Paulo'), ((p_fim + 1)::timestamp at time zone 'America/Sao_Paulo'),
    p_moradores, null, p_imobiliaria, p_contrato)
$$;

-- ---------------------------------------------------------------------
-- Link externo · cadastro facial (anônimo, protegido pelo token)
-- ---------------------------------------------------------------------
create or replace function public.link_facial_info(p_token text)
returns table (condominio text, sigla text, primeiro_nome text, unidade text, expira_em timestamptz, valido boolean, versao_termo text)
language sql stable security definer set search_path = '' as $$
  select c.nome, c.sigla, split_part(p.nome, ' ', 1), u.codigo, l.expira_em,
         (l.usado_em is null and l.expira_em > now()), 'biometria-v1'
  from public.links_facial l
  join public.condominios c on c.id = l.condominio_id
  join public.pessoas p on p.id = l.pessoa_id
  join public.unidades u on u.id = l.unidade_id
  where l.token_hash = app.hash_token(p_token)
$$;

create or replace function public.link_facial_consentir(p_token text, p_versao text, p_ip text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare l public.links_facial; v uuid;
begin
  select * into l from public.links_facial where token_hash = app.hash_token(p_token);
  if l.id is null or l.usado_em is not null or l.expira_em <= now() then
    raise exception 'link inválido ou expirado' using errcode = '22023';
  end if;
  insert into public.consentimentos (condominio_id, pessoa_id, finalidade, versao_termo, ip)
  values (l.condominio_id, l.pessoa_id, 'biometria_acesso', p_versao, nullif(p_ip, '')::inet) returning id into v;
  return v;
end $$;

-- Chamada só pela Edge Function (service_role) depois de gravar a foto no bucket privado.
create or replace function app.registrar_biometria_por_link(p_token text, p_path text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare l public.links_facial; v_cons uuid; v_fim timestamptz; v uuid;
begin
  select * into l from public.links_facial where token_hash = app.hash_token(p_token) for update;
  if l.id is null or l.usado_em is not null or l.expira_em <= now() then
    raise exception 'link inválido ou expirado' using errcode = '22023';
  end if;
  select id into v_cons from public.consentimentos
  where pessoa_id = l.pessoa_id and finalidade = 'biometria_acesso' and revogado_em is null
  order by aceito_em desc limit 1;
  if v_cons is null then raise exception 'consentimento ausente' using errcode = '42501'; end if;
  -- Fim do período: check-out/fim de contrato do vínculo temporário (morador permanente = null).
  select max(fim) into v_fim from public.vinculos where pessoa_id = l.pessoa_id and tipo in ('locatario_temporada','hospede','inquilino');
  insert into public.biometrias (condominio_id, pessoa_id, consentimento_id, storage_path, apagar_em)
  values (l.condominio_id, l.pessoa_id, v_cons, p_path, v_fim)
  on conflict (pessoa_id) do update set storage_path = excluded.storage_path, consentimento_id = excluded.consentimento_id,
    apagar_em = excluded.apagar_em, sincronizada_em = null
  returning id into v;
  update public.links_facial set usado_em = now() where id = l.id;
  return v;
end $$;
revoke all on function app.registrar_biometria_por_link(text, text) from public, anon, authenticated;
grant execute on function app.registrar_biometria_por_link(text, text) to service_role;

-- ---------------------------------------------------------------------
-- Direitos do titular
-- ---------------------------------------------------------------------
create or replace function public.exportar_meus_dados() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  select jsonb_build_object(
    'gerado_em', now(),
    'controlador', (select jsonb_agg(jsonb_build_object('condominio', c.nome, 'encarregado', c.encarregado_nome, 'contato', c.encarregado_email))
                    from public.condominios c where c.id in (select condominio_id from public.pessoas where user_id = auth.uid())),
    'pessoas', (select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'email', p.email,
                  'cpf', p.cpf_mascarado, 'celular', p.celular_mascarado, 'criado_em', p.created_at))
                from public.pessoas p where p.user_id = auth.uid()),
    'vinculos', (select jsonb_agg(jsonb_build_object('unidade', u.codigo, 'tipo', v.tipo, 'inicio', v.inicio, 'fim', v.fim))
                 from public.vinculos v join public.unidades u on u.id = v.unidade_id
                 where v.pessoa_id in (select app.minhas_pessoas())),
    'consentimentos', (select jsonb_agg(jsonb_build_object('finalidade', c.finalidade, 'versao', c.versao_termo,
                         'aceito_em', c.aceito_em, 'revogado_em', c.revogado_em))
                       from public.consentimentos c where c.pessoa_id in (select app.minhas_pessoas())),
    'biometrias', (select jsonb_agg(jsonb_build_object('cadastrada_em', b.created_at, 'apagar_em', b.apagar_em))
                   from public.biometrias b where b.pessoa_id in (select app.minhas_pessoas())),
    'acessos', (select jsonb_agg(jsonb_build_object('tipo', r.tipo, 'meio', r.meio, 'em', r.ocorrido_em) order by r.ocorrido_em desc)
                from public.registros_acesso r where r.pessoa_id in (select app.minhas_pessoas())),
    'pedidos_titular', (select jsonb_agg(jsonb_build_object('tipo', t.tipo, 'status', t.status, 'criado_em', t.created_at))
                        from public.pedidos_titular t where t.user_id = auth.uid())
  ) into v;
  return v;
end $$;

create or replace function public.revogar_consentimento(p_consentimento uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.consentimentos;
begin
  select * into c from public.consentimentos where id = p_consentimento;
  if c.id is null or c.pessoa_id not in (select app.minhas_pessoas()) then
    raise exception 'consentimento não encontrado' using errcode = '42501';
  end if;
  update public.consentimentos set revogado_em = now() where id = c.id and revogado_em is null;
  -- Sem consentimento não há base legal: a biometria é apagada no próximo ciclo do job.
  update public.biometrias set apagar_em = now() where consentimento_id = c.id;
end $$;

-- ---------------------------------------------------------------------
-- Views da portaria: só o mínimo para liberar acesso (sem contratos, valores, telefone, CPF completo)
-- Views rodam com privilégio do dono da view; o filtro de papel é explícito.
-- ---------------------------------------------------------------------
create or replace view public.vw_portaria_pessoas as
select p.id as pessoa_id, p.condominio_id, p.nome, p.cpf_mascarado, u.codigo as unidade,
       v.tipo::text as vinculo, v.inicio as acesso_inicio, v.fim as acesso_fim,
       exists (select 1 from public.biometrias b where b.pessoa_id = p.id) as tem_facial
from public.pessoas p
join public.vinculos v on v.pessoa_id = p.id
join public.unidades u on u.id = v.unidade_id
where app.tem_papel(p.condominio_id, '{portaria,sindico}')
  and not app.is_dono()
  and (v.fim is null or v.fim > now() - interval '1 day')
  and (v.tipo in ('proprietario','inquilino','residente')
       or exists (select 1 from public.locacoes l join public.hospedes h on h.locacao_id = l.id
                  where h.pessoa_id = p.id and l.status = 'aprovada'));

create or replace view public.vw_portaria_vagas as
select c.condominio_id, g.numero as vaga, g.local, uc.codigo as unidade_que_usa, c.placa, c.inicio, c.fim
from public.cessoes_vaga c
join public.vagas g on g.id = c.vaga_id
join public.unidades uc on uc.id = c.unidade_cessionaria_id
where c.status = 'aprovada' and (c.fim is null or c.fim >= current_date)
  and app.tem_papel(c.condominio_id, '{portaria,sindico}') and not app.is_dono();

-- Resultado agregado de votação (sem identificar unidades).
create or replace view public.vw_resultado_pautas as
select p.condominio_id, p.id as pauta_id, p.titulo,
       count(*) filter (where v.opcao = 'sim') as sim,
       count(*) filter (where v.opcao = 'nao') as nao,
       count(*) filter (where v.opcao = 'abstencao') as abstencao
from public.pautas p left join public.votos v on v.pauta_id = p.id
where app.ve_transparencia(p.condominio_id) and not app.is_dono()
group by p.condominio_id, p.id, p.titulo;

revoke all on public.vw_portaria_pessoas, public.vw_portaria_vagas, public.vw_resultado_pautas from anon;
grant select on public.vw_portaria_pessoas, public.vw_portaria_vagas, public.vw_resultado_pautas to authenticated;

-- Funções internas não devem ser chamadas pelo anon.
revoke execute on function public.metricas_dono(), public.totais_plataforma(), public.criar_condominio(text, text, text, uuid, text, text, text),
  public.solicitar_suporte(uuid, text, int), public.decidir_suporte(uuid, boolean), public.revogar_suporte(uuid),
  public.decidir_pedido(text, uuid, boolean, text), public.responder_cessao(uuid, boolean), public.unidades_destino(uuid),
  public.exportar_meus_dados(), public.revogar_consentimento(uuid), public.cpf_completo(uuid), public.aceitar_dpa(uuid, text, text),
  public.aceitar_convite(text)
  from public, anon;
grant execute on function public.metricas_dono(), public.totais_plataforma(), public.criar_condominio(text, text, text, uuid, text, text, text),
  public.solicitar_suporte(uuid, text, int), public.decidir_suporte(uuid, boolean), public.revogar_suporte(uuid),
  public.decidir_pedido(text, uuid, boolean, text), public.responder_cessao(uuid, boolean), public.unidades_destino(uuid),
  public.exportar_meus_dados(), public.revogar_consentimento(uuid), public.cpf_completo(uuid), public.aceitar_dpa(uuid, text, text),
  public.aceitar_convite(text)
  to authenticated;
revoke execute on function public.criar_locacao_temporada(uuid, text, text, timestamptz, timestamptz, int, text),
  public.criar_locacao_aluguel(uuid, text, text, date, date, int, text, text) from public, anon;
grant execute on function public.criar_locacao_temporada(uuid, text, text, timestamptz, timestamptz, int, text),
  public.criar_locacao_aluguel(uuid, text, text, date, date, int, text, text) to authenticated;
-- link_facial_info / link_facial_consentir ficam disponíveis ao anon (protegidos pelo token).
