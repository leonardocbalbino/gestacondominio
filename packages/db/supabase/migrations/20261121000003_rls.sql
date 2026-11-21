-- =====================================================================
-- GestaCondomínio · 0003 · Row Level Security
-- Princípios:
--   1. Isolamento por condomínio: só membros ativos enxergam dados do tenant.
--   2. Dono do sistema NÃO lê dados pessoais — política RESTRICTIVE em todas as
--      tabelas do tenant. Exceção única: acesso de suporte aprovado pelo síndico,
--      somente leitura e com prazo (break-glass).
--   3. Portaria não lê pessoas/contratos/valores diretamente; usa views mínimas (0004).
--   4. Morador enxerga o que é da própria unidade.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções auxiliares (SECURITY DEFINER para não recursar nas próprias políticas)
-- ---------------------------------------------------------------------
create or replace function app.is_dono() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plataforma_admins where user_id = auth.uid())
$$;

create or replace function app.tem_papel(cid uuid, papeis public.papel[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros_condominio m
    where m.condominio_id = cid and m.user_id = auth.uid() and m.ativo and m.papel = any (papeis)
  )
$$;

create or replace function app.is_membro(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membros_condominio m
    where m.condominio_id = cid and m.user_id = auth.uid() and m.ativo
  )
$$;

create or replace function app.is_sindico(cid uuid) returns boolean
language sql stable as $$ select app.tem_papel(cid, '{sindico}') $$;

create or replace function app.is_gestao(cid uuid) returns boolean
language sql stable as $$ select app.tem_papel(cid, '{sindico,conselho}') $$;

create or replace function app.is_portaria(cid uuid) returns boolean
language sql stable as $$ select app.tem_papel(cid, '{portaria}') $$;

-- Unidades às quais o usuário está vinculado agora (proprietário, inquilino, residente).
create or replace function app.minhas_unidades() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select v.unidade_id
  from public.vinculos v
  join public.pessoas p on p.id = v.pessoa_id
  where p.user_id = auth.uid()
    and v.tipo in ('proprietario','inquilino','residente')
    and v.inicio <= now() and (v.fim is null or v.fim > now())
$$;

create or replace function app.minhas_pessoas() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select id from public.pessoas where user_id = auth.uid()
$$;

-- Break-glass: acesso de suporte aprovado e dentro do prazo.
create or replace function app.suporte_ativo(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.acessos_suporte s
    where s.condominio_id = cid and s.solicitado_por = auth.uid()
      and s.status = 'aprovado' and s.inicio <= now() and s.expira_em > now()
  )
$$;

-- Papéis que veem a área de transparência (portaria e hóspede não).
create or replace function app.ve_transparencia(cid uuid) returns boolean
language sql stable as $$ select app.tem_papel(cid, '{sindico,conselho,morador}') $$;

-- ---------------------------------------------------------------------
-- Habilita RLS em tudo e aplica as políticas transversais
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  -- Tabelas do tenant com dados de condomínio/pessoas
  tenant text[] := array[
    'condominios','membros_condominio','blocos','unidades','pessoas','vinculos','vagas','cessoes_vaga','locacoes',
    'hospedes','links_facial','consentimentos','biometrias','areas_comuns','reservas','demandas_transparencia',
    'etapas_demanda','cotacoes','duvidas_demanda','assembleias','pautas','votos','comunicados','ocorrencias',
    'encomendas','registros_acesso','notificacoes','convites','equipamentos_acesso','pedidos_titular','aceites_dpa',
    'auditoria'
  ];
  -- O suporte (break-glass) nunca lê biometria, tokens nem credenciais de equipamento.
  sem_suporte text[] := array['biometrias','links_facial','equipamentos_acesso','consentimentos','notificacoes','convites'];
begin
  foreach t in array tenant || array['plataforma_admins','planos','acessos_suporte','fila_exclusao_arquivos'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array tenant loop
    -- (2) Bloqueio do dono do sistema no banco, independentemente das demais políticas.
    execute format($p$
      create policy dono_sem_dados_pessoais on public.%I as restrictive for all to authenticated
      using (not app.is_dono() or app.suporte_ativo(condominio_id))
      with check (not app.is_dono())
    $p$, t);

    if not (t = any (sem_suporte)) then
      execute format($p$
        create policy suporte_leitura on public.%I for select to authenticated
        using (app.suporte_ativo(condominio_id))
      $p$, t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Plataforma
-- ---------------------------------------------------------------------
create policy proprio_registro on public.plataforma_admins for select to authenticated using (user_id = auth.uid());
create policy leitura on public.planos for select to authenticated using (true);
-- fila_exclusao_arquivos: sem políticas → só service_role (jobs/Edge Functions).

-- ---------------------------------------------------------------------
-- Condomínio e membros
-- ---------------------------------------------------------------------
create policy membros_leem on public.condominios for select to authenticated using (app.is_membro(id));
create policy sindico_edita on public.condominios for update to authenticated
  using (app.is_sindico(id)) with check (app.is_sindico(id));

create policy le_proprio_ou_sindico on public.membros_condominio for select to authenticated
  using (user_id = auth.uid() or app.is_sindico(condominio_id));
create policy sindico_gerencia on public.membros_condominio for all to authenticated
  using (app.is_sindico(condominio_id)) with check (app.is_sindico(condominio_id));

-- ---------------------------------------------------------------------
-- Estrutura (todos os membros veem; síndico edita)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['blocos','unidades','vagas','areas_comuns'] loop
    execute format('create policy membros_leem on public.%I for select to authenticated using (app.is_membro(condominio_id))', t);
    execute format('create policy sindico_gerencia on public.%I for all to authenticated using (app.is_sindico(condominio_id)) with check (app.is_sindico(condominio_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Pessoas e vínculos
-- ---------------------------------------------------------------------
create policy titular_le on public.pessoas for select to authenticated using (user_id = auth.uid());
create policy mesma_unidade_le on public.pessoas for select to authenticated using (
  exists (select 1 from public.vinculos v where v.pessoa_id = pessoas.id and v.unidade_id in (select app.minhas_unidades()))
);
create policy sindico_le on public.pessoas for select to authenticated using (app.is_sindico(condominio_id));
create policy sindico_gerencia on public.pessoas for all to authenticated
  using (app.is_sindico(condominio_id)) with check (app.is_sindico(condominio_id));
-- Correção de dados pelo próprio titular (nome/e-mail). CPF/celular só via RPC.
create policy titular_corrige on public.pessoas for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy unidade_le on public.vinculos for select to authenticated using (
  unidade_id in (select app.minhas_unidades()) or pessoa_id in (select app.minhas_pessoas())
);
create policy sindico_gerencia on public.vinculos for all to authenticated
  using (app.is_sindico(condominio_id)) with check (app.is_sindico(condominio_id));

-- ---------------------------------------------------------------------
-- Cessão de vaga: valor visível só para cedente, cessionária e síndico
-- ---------------------------------------------------------------------
create policy partes_leem on public.cessoes_vaga for select to authenticated using (
  unidade_cedente_id in (select app.minhas_unidades()) or unidade_cessionaria_id in (select app.minhas_unidades())
);
create policy sindico_le on public.cessoes_vaga for select to authenticated using (app.is_sindico(condominio_id));
create policy cedente_cria on public.cessoes_vaga for insert to authenticated with check (
  unidade_cedente_id in (select app.minhas_unidades())
  and status = 'aguardando_cessionario'
  and exists (select 1 from public.vagas g where g.id = vaga_id and g.unidade_id = unidade_cedente_id)
);
-- Transições de status passam pelas RPCs responder_cessao / decidir_pedido.

-- ---------------------------------------------------------------------
-- Locações e hóspedes (criação via RPC criar_locacao_*)
-- ---------------------------------------------------------------------
create policy unidade_le on public.locacoes for select to authenticated using (unidade_id in (select app.minhas_unidades()));
create policy sindico_le on public.locacoes for select to authenticated using (app.is_sindico(condominio_id));

create policy unidade_le on public.hospedes for select to authenticated using (
  exists (select 1 from public.locacoes l where l.id = locacao_id and l.unidade_id in (select app.minhas_unidades()))
);
create policy sindico_le on public.hospedes for select to authenticated using (app.is_sindico(condominio_id));

-- ---------------------------------------------------------------------
-- Biometria e consentimento
-- ---------------------------------------------------------------------
create policy titular_le on public.biometrias for select to authenticated using (pessoa_id in (select app.minhas_pessoas()));
create policy sindico_le on public.biometrias for select to authenticated using (app.is_sindico(condominio_id));
create policy titular_apaga on public.biometrias for delete to authenticated using (pessoa_id in (select app.minhas_pessoas()));
create policy sindico_apaga on public.biometrias for delete to authenticated using (app.is_sindico(condominio_id));

create policy titular_le on public.consentimentos for select to authenticated using (pessoa_id in (select app.minhas_pessoas()));
create policy sindico_le on public.consentimentos for select to authenticated using (app.is_sindico(condominio_id));

create policy criador_ou_sindico_le on public.links_facial for select to authenticated
  using (created_by = auth.uid() or app.is_sindico(condominio_id));

-- ---------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------
create policy unidade_le on public.reservas for select to authenticated using (unidade_id in (select app.minhas_unidades()));
create policy unidade_cria on public.reservas for insert to authenticated
  with check (unidade_id in (select app.minhas_unidades()) and status = 'aguardando_sindico');
create policy unidade_cancela on public.reservas for update to authenticated
  using (unidade_id in (select app.minhas_unidades())) with check (status = 'cancelada');
create policy sindico_gerencia on public.reservas for all to authenticated
  using (app.is_sindico(condominio_id)) with check (app.is_sindico(condominio_id));

-- ---------------------------------------------------------------------
-- Transparência e assembleias
-- ---------------------------------------------------------------------
create policy moradores_leem_publicadas on public.demandas_transparencia for select to authenticated
  using (app.ve_transparencia(condominio_id) and (publicada or app.is_gestao(condominio_id)));
create policy gestao_gerencia on public.demandas_transparencia for all to authenticated
  using (app.is_gestao(condominio_id)) with check (app.is_gestao(condominio_id));

do $$
declare t text;
begin
  foreach t in array array['etapas_demanda','cotacoes'] loop
    execute format($p$
      create policy moradores_leem_publicadas on public.%I for select to authenticated using (
        exists (select 1 from public.demandas_transparencia d where d.id = demanda_id
                and app.ve_transparencia(d.condominio_id) and (d.publicada or app.is_gestao(d.condominio_id))))
    $p$, t);
    execute format('create policy gestao_gerencia on public.%I for all to authenticated using (app.is_gestao(condominio_id)) with check (app.is_gestao(condominio_id))', t);
  end loop;
end $$;

create policy autor_ou_gestao_le on public.duvidas_demanda for select to authenticated
  using (created_by = auth.uid() or app.is_gestao(condominio_id));
create policy morador_pergunta on public.duvidas_demanda for insert to authenticated
  with check (app.ve_transparencia(condominio_id) and resposta is null);
create policy gestao_responde on public.duvidas_demanda for update to authenticated
  using (app.is_gestao(condominio_id)) with check (app.is_gestao(condominio_id));

create policy moradores_leem on public.assembleias for select to authenticated using (app.ve_transparencia(condominio_id));
create policy gestao_gerencia on public.assembleias for all to authenticated
  using (app.is_sindico(condominio_id)) with check (app.is_sindico(condominio_id));
create policy moradores_leem on public.pautas for select to authenticated using (app.ve_transparencia(condominio_id));
create policy gestao_gerencia on public.pautas for all to authenticated
  using (app.is_sindico(condominio_id)) with check (app.is_sindico(condominio_id));

-- Voto: um por unidade, só com votação aberta. Resultado agregado via view.
create policy unidade_le_proprio on public.votos for select to authenticated using (unidade_id in (select app.minhas_unidades()));
create policy sindico_le on public.votos for select to authenticated using (app.is_sindico(condominio_id));
create policy unidade_vota on public.votos for insert to authenticated with check (
  unidade_id in (select app.minhas_unidades())
  and exists (select 1 from public.pautas p where p.id = pauta_id and p.votacao_aberta and p.condominio_id = votos.condominio_id)
);

-- ---------------------------------------------------------------------
-- Comunicação e portaria
-- ---------------------------------------------------------------------
create policy membros_leem on public.comunicados for select to authenticated using (app.is_membro(condominio_id));
create policy gestao_publica on public.comunicados for all to authenticated
  using (app.is_sindico(condominio_id)) with check (app.is_sindico(condominio_id));

create policy autor_unidade_le on public.ocorrencias for select to authenticated
  using (created_by = auth.uid() or unidade_id in (select app.minhas_unidades()));
create policy sindico_gerencia on public.ocorrencias for all to authenticated
  using (app.is_sindico(condominio_id)) with check (app.is_sindico(condominio_id));
create policy membro_abre on public.ocorrencias for insert to authenticated
  with check (app.is_membro(condominio_id) and status = 'aberta');

create policy unidade_le on public.encomendas for select to authenticated using (unidade_id in (select app.minhas_unidades()));
create policy portaria_gerencia on public.encomendas for all to authenticated
  using (app.tem_papel(condominio_id, '{sindico,portaria}')) with check (app.tem_papel(condominio_id, '{sindico,portaria}'));

create policy unidade_le on public.registros_acesso for select to authenticated using (unidade_id in (select app.minhas_unidades()));
create policy portaria_le on public.registros_acesso for select to authenticated using (app.tem_papel(condominio_id, '{sindico,portaria}'));
create policy portaria_registra on public.registros_acesso for insert to authenticated with check (app.tem_papel(condominio_id, '{sindico,portaria}'));

create policy proprio on public.notificacoes for select to authenticated using (user_id = auth.uid());
create policy marca_lida on public.notificacoes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy sindico_gerencia on public.convites for all to authenticated
  using (app.is_sindico(condominio_id)) with check (app.is_sindico(condominio_id));
create policy sindico_gerencia on public.equipamentos_acesso for all to authenticated
  using (app.is_sindico(condominio_id)) with check (app.is_sindico(condominio_id));

-- ---------------------------------------------------------------------
-- LGPD
-- ---------------------------------------------------------------------
create policy titular_le on public.pedidos_titular for select to authenticated using (user_id = auth.uid());
create policy titular_cria on public.pedidos_titular for insert to authenticated
  with check (user_id = auth.uid() and pessoa_id in (select app.minhas_pessoas()) and status = 'aberto');
create policy sindico_atende on public.pedidos_titular for all to authenticated
  using (app.is_sindico(condominio_id)) with check (app.is_sindico(condominio_id));

create policy sindico_le on public.aceites_dpa for select to authenticated using (app.is_sindico(condominio_id));

create policy sindico_ou_solicitante_le on public.acessos_suporte for select to authenticated
  using (app.is_sindico(condominio_id) or solicitado_por = auth.uid());
create policy dono_solicita on public.acessos_suporte for insert to authenticated
  with check (app.is_dono() and solicitado_por = auth.uid() and status = 'solicitado');
-- Aprovação/negação via RPC decidir_suporte (define início e expiração).

create policy sindico_le on public.auditoria for select to authenticated using (app.is_sindico(condominio_id));
-- Auditoria: nenhuma política de escrita. Inserções só via funções SECURITY DEFINER.

-- Remove privilégios de escrita direta em tabelas controladas por RPC/trigger
revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;
revoke all on public.fila_exclusao_arquivos from anon, authenticated;
revoke all on all tables in schema public from anon;
