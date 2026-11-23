-- =====================================================================
-- GestaCondomínio · 0009 · Gestão do síndico
--   * contratos do condomínio com fornecedores (vigência, valor, documento)
--   * encerrar locação antes do fim
--   * convite de morador já vinculado à unidade
--   * resposta do síndico em ocorrências
-- =====================================================================

-- ---------------------------------------------------------------------
-- Contratos com fornecedores
-- ---------------------------------------------------------------------
create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  fornecedor text not null check (length(trim(fornecedor)) > 1),
  cnpj_fornecedor text,
  contato_fornecedor text,
  categoria text not null default 'outros'
    check (categoria in ('manutencao','limpeza','seguranca','elevadores','jardinagem','seguro','administradora','agua_gas_energia','obras','outros')),
  objeto text not null check (length(trim(objeto)) > 1),
  valor numeric(12,2) check (valor is null or valor >= 0),
  periodicidade text not null default 'mensal' check (periodicidade in ('mensal','trimestral','anual','unico')),
  inicio date not null,
  fim date,
  renovacao_automatica boolean not null default false,
  aviso_dias int not null default 30 check (aviso_dias between 0 and 365),
  status text not null default 'ativo' check (status in ('ativo','encerrado')),
  encerrado_em date,
  documento_path text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (fim is null or fim >= inicio)
);
create index on public.contratos (condominio_id, status, fim);

alter table public.contratos enable row level security;
create policy dono_sem_dados_pessoais on public.contratos as restrictive for all to authenticated
  using (not app.is_dono() or app.suporte_ativo(condominio_id)) with check (not app.is_dono());
create policy suporte_leitura on public.contratos for select to authenticated using (app.suporte_ativo(condominio_id));
-- Conselho acompanha; só o síndico cadastra e altera. Moradores e portaria não veem.
create policy gestao_le on public.contratos for select to authenticated using (app.is_gestao(condominio_id));
create policy sindico_gerencia on public.contratos for all to authenticated
  using (app.is_sindico(condominio_id)) with check (app.is_sindico(condominio_id));
create trigger trg_auditar after insert or update or delete on public.contratos
  for each row execute function app.trg_auditar();

-- ---------------------------------------------------------------------
-- Encerrar locação antes do fim (saída antecipada, rescisão)
-- ---------------------------------------------------------------------
create or replace function public.encerrar_locacao(p_id uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_cid uuid; v_status text;
begin
  select condominio_id, status into v_cid, v_status from public.locacoes where id = p_id for update;
  if v_cid is null or not app.is_sindico(v_cid) then raise exception 'apenas o síndico encerra a locação' using errcode = '42501'; end if;
  if v_status not in ('aprovada','aguardando_sindico') then raise exception 'locação já encerrada' using errcode = '22023'; end if;

  update public.locacoes
     set status = case when v_status = 'aprovada' then 'encerrada' else 'cancelada' end,
         fim = least(fim, now()), motivo_decisao = coalesce(p_motivo, motivo_decisao),
         decidido_por = auth.uid(), decidido_em = now(), updated_at = now()
   where id = p_id;
  -- Fim do acesso: vínculos dos hóspedes terminam e a biometria é apagada agora.
  update public.vinculos v set fim = least(coalesce(v.fim, now()), now())
   where v.pessoa_id in (select h.pessoa_id from public.hospedes h where h.locacao_id = p_id)
     and v.tipo in ('locatario_temporada','hospede','inquilino') and (v.fim is null or v.fim > now());
  update public.biometrias b set apagar_em = now()
   where b.pessoa_id in (select h.pessoa_id from public.hospedes h where h.locacao_id = p_id);
end $$;
revoke execute on function public.encerrar_locacao(uuid, text) from public, anon;
grant execute on function public.encerrar_locacao(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Convite de morador (síndico): a conta nasce vinculada à unidade
-- ---------------------------------------------------------------------
alter table public.convites
  add column unidade_id uuid references public.unidades(id) on delete cascade,
  add column tipo_vinculo public.tipo_vinculo;

create or replace function public.convidar_morador(p_unidade uuid, p_nome text, p_email text, p_tipo public.tipo_vinculo)
returns text
language plpgsql security definer set search_path = '' as $$
declare v_cid uuid; v_token text;
begin
  select condominio_id into v_cid from public.unidades where id = p_unidade;
  if v_cid is null or not app.is_sindico(v_cid) then raise exception 'apenas o síndico convida moradores' using errcode = '42501'; end if;
  if p_tipo not in ('proprietario','inquilino','residente') then raise exception 'tipo de vínculo inválido' using errcode = '22023'; end if;
  if coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'e-mail inválido' using errcode = '22023'; end if;
  if length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'informe o nome' using errcode = '22023'; end if;

  v_token := app.novo_token();
  insert into public.convites (condominio_id, email, nome, papel, token_hash, unidade_id, tipo_vinculo, created_by)
  values (v_cid, lower(trim(p_email)), trim(p_nome), 'morador', app.hash_token(v_token), p_unidade, p_tipo, auth.uid());
  perform app.registrar_auditoria(v_cid, 'convidar_morador', 'convites', null);
  return v_token;
end $$;
revoke execute on function public.convidar_morador(uuid, text, text, public.tipo_vinculo) from public, anon;
grant execute on function public.convidar_morador(uuid, text, text, public.tipo_vinculo) to authenticated;

-- Aceite do convite agora também cria o vínculo com a unidade (quando houver).
create or replace function public.cadastrar_por_convite(p_token text, p_nome text, p_senha text) returns text
language plpgsql security definer set search_path = '' as $$
declare c public.convites; uid uuid; pid uuid;
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
  values (lower(c.email), p_nome, extensions.crypt(p_senha, extensions.gen_salt('bf')), now())
  returning id into uid;
  insert into public.membros_condominio (condominio_id, user_id, papel, created_by) values (c.condominio_id, uid, c.papel, uid);
  insert into public.pessoas (condominio_id, user_id, nome, email, created_by)
  values (c.condominio_id, uid, p_nome, lower(c.email), uid) returning id into pid;
  if c.unidade_id is not null then
    insert into public.vinculos (condominio_id, pessoa_id, unidade_id, tipo, responsavel, created_by)
    values (c.condominio_id, pid, c.unidade_id, coalesce(c.tipo_vinculo, 'residente'), c.tipo_vinculo = 'proprietario', uid);
  end if;
  update public.convites set aceito_em = now() where id = c.id;
  if c.papel = 'sindico' then
    update public.condominios set status = 'ativo' where id = c.condominio_id and status = 'implantacao';
  end if;
  perform app.registrar_auditoria(c.condominio_id, 'cadastro_por_convite', 'convites', c.id);
  return lower(c.email);
end $$;
revoke all on function public.cadastrar_por_convite(text, text, text) from public;
grant execute on function public.cadastrar_por_convite(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Ocorrências: resposta do síndico ao morador
-- ---------------------------------------------------------------------
alter table public.ocorrencias add column resposta text, add column respondida_em timestamptz;
