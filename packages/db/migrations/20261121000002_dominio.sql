-- =====================================================================
-- GestaCondomínio · 0002 · Modelo de domínio
-- Dados pessoais sensíveis (CPF, celular) ficam criptografados (pgp_sym)
-- com hash HMAC para busca e uma versão mascarada para exibição.
-- =====================================================================

-- Estrutura física -----------------------------------------------------
create table public.blocos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (condominio_id, nome)
);

create table public.unidades (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  bloco_id uuid references public.blocos(id) on delete set null,
  codigo text not null,                  -- ex.: 304-A
  max_biometrias int not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (condominio_id, codigo)
);

-- Pessoas ----------------------------------------------------------------
create table public.pessoas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nome text not null,
  email text,
  cpf_cripto bytea,
  cpf_hash text,
  cpf_mascarado text,        -- ***.456.789-**
  celular_cripto bytea,
  celular_mascarado text,    -- (41) 9 ****-3344
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (condominio_id, cpf_hash)
);
create index on public.pessoas (user_id);

create type public.tipo_vinculo as enum ('proprietario','inquilino','residente','locatario_temporada','hospede');

create table public.vinculos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  tipo public.tipo_vinculo not null,
  responsavel boolean not null default false,
  inicio timestamptz not null default now(),
  fim timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index on public.vinculos (pessoa_id);
create index on public.vinculos (unidade_id);

-- Vagas e cessões -------------------------------------------------------
create table public.vagas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  numero text not null,
  local text,               -- Subsolo 1
  descricao text,           -- Coberta · carro
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (condominio_id, numero)
);

create table public.cessoes_vaga (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  vaga_id uuid not null references public.vagas(id) on delete cascade,
  unidade_cedente_id uuid not null references public.unidades(id),
  unidade_cessionaria_id uuid not null references public.unidades(id),
  inicio date not null,
  fim date,
  placa text not null,
  valor_mensal numeric(10,2),   -- visível só a cedente, cessionária e síndico
  status text not null default 'aguardando_cessionario'
    check (status in ('aguardando_cessionario','aguardando_sindico','aprovada','recusada','cancelada','encerrada')),
  motivo_decisao text,
  decidido_por uuid,
  decidido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  check (fim is null or fim > inicio),
  check (unidade_cedente_id <> unidade_cessionaria_id)
);

-- Locações e hóspedes ---------------------------------------------------
create table public.locacoes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  tipo text not null check (tipo in ('temporada','aluguel')),
  responsavel_pessoa_id uuid references public.pessoas(id) on delete set null,
  inicio timestamptz not null,
  fim timestamptz not null,
  qtd_pessoas int not null default 1 check (qtd_pessoas between 1 and 20),
  origem text,                 -- Airbnb / Booking / Direto
  imobiliaria text,
  contrato_path text,          -- bucket privado "contratos"; portaria não vê
  status text not null default 'aguardando_sindico'
    check (status in ('aguardando_sindico','aprovada','recusada','cancelada','encerrada')),
  motivo_decisao text,
  decidido_por uuid,
  decidido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  check (fim > inicio)
);
create index on public.locacoes (unidade_id);

create table public.hospedes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  locacao_id uuid not null references public.locacoes(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (locacao_id, pessoa_id)
);

-- Biometria (dado sensível — art. 11 LGPD) --------------------------------
create table public.links_facial (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  token_hash text not null unique,   -- sha256 do token; o token em claro só existe no link enviado
  expira_em timestamptz not null,
  usado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table public.consentimentos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  finalidade text not null check (finalidade in ('biometria_acesso','comunicacoes')),
  versao_termo text not null,
  aceito_em timestamptz not null default now(),
  ip inet,
  revogado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table public.biometrias (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  consentimento_id uuid not null references public.consentimentos(id),
  storage_path text not null,        -- arquivo criptografado (AES-256-GCM) no armazenamento privado do servidor
  sincronizada_em timestamptz,       -- enviada ao equipamento
  apagar_em timestamptz,             -- check-out / fim do contrato / revogação
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (pessoa_id)
);
create index on public.biometrias (apagar_em) where apagar_em is not null;

-- Áreas comuns e reservas -----------------------------------------------
create table public.areas_comuns (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  nome text not null,
  exige_aprovacao boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  area_id uuid not null references public.areas_comuns(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'aguardando_sindico' check (status in ('aguardando_sindico','confirmada','recusada','cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  check (fim > inicio)
);

-- Transparência ---------------------------------------------------------
create table public.demandas_transparencia (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  titulo text not null,
  local text,
  descricao text,
  etapa text not null default 'solicitacao' check (etapa in ('solicitacao','cotacoes','aprovacao','contrato','execucao','concluida')),
  teto numeric(12,2),
  assembleia_em timestamptz,
  prazo_cotacoes date,
  publicada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table public.etapas_demanda (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  demanda_id uuid not null references public.demandas_transparencia(id) on delete cascade,
  etapa text not null check (etapa in ('solicitacao','cotacoes','aprovacao','contrato','execucao')),
  detalhe text,
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (demanda_id, etapa)
);

create table public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  demanda_id uuid not null references public.demandas_transparencia(id) on delete cascade,
  fornecedor text not null,
  cnpj_fornecedor text,
  valor numeric(12,2) not null check (valor > 0),
  prazo_dias int not null check (prazo_dias > 0),
  garantia_anos int,
  documento_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table public.duvidas_demanda (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  demanda_id uuid not null references public.demandas_transparencia(id) on delete cascade,
  pergunta text not null,
  resposta text,
  respondida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

-- Assembleias -------------------------------------------------------------
create table public.assembleias (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  titulo text not null,
  data_hora timestamptz not null,
  status text not null default 'convocada' check (status in ('convocada','em_votacao','encerrada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table public.pautas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  assembleia_id uuid not null references public.assembleias(id) on delete cascade,
  demanda_id uuid references public.demandas_transparencia(id) on delete set null,
  titulo text not null,
  votacao_aberta boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table public.votos (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  pauta_id uuid not null references public.pautas(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  opcao text not null check (opcao in ('sim','nao','abstencao')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (pauta_id, unidade_id)   -- um voto por unidade
);

-- Comunicação e portaria ------------------------------------------------
create table public.comunicados (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  titulo text not null,
  corpo text not null,
  publicado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  titulo text not null,
  descricao text,
  status text not null default 'aberta' check (status in ('aberta','em_andamento','resolvida')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table public.encomendas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  descricao text not null,
  recebida_em timestamptz not null default now(),
  retirada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table public.registros_acesso (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  pessoa_id uuid references public.pessoas(id) on delete set null,
  tipo text not null check (tipo in ('entrada','saida','visitante','prestador','entrega')),
  meio text not null default 'portaria' check (meio in ('facial','portaria','tag','app')),
  observacao text,
  ocorrido_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index on public.registros_acesso (condominio_id, ocorrido_em);

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  corpo text,
  link text,
  lida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index on public.notificacoes (user_id) where lida_em is null;

create table public.convites (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  email text not null,
  nome text not null,
  papel public.papel not null,
  token_hash text not null unique,
  expira_em timestamptz not null default now() + interval '7 days',
  aceito_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table public.equipamentos_acesso (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  nome text not null,
  fabricante text not null check (fabricante in ('controlid','hikvision','intelbras','mock')),
  base_url text not null,
  segredo_ref text not null,  -- nome do segredo no Vault; a senha nunca fica nesta tabela
  porta int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

-- LGPD ------------------------------------------------------------------
create table public.pedidos_titular (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('acesso','exportacao','correcao','revogacao_consentimento','exclusao')),
  detalhe text,
  status text not null default 'aberto' check (status in ('aberto','em_analise','atendido','negado')),
  prazo_em timestamptz not null default now() + interval '15 days',
  resposta text,
  respondido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table public.aceites_dpa (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  versao text not null,
  aceito_por uuid not null references auth.users(id),
  aceito_em timestamptz not null default now(),
  ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

-- Acesso de suporte (break-glass): pedido pelo dono, aprovado pelo síndico, só leitura, expira sozinho.
create table public.acessos_suporte (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  solicitado_por uuid not null references auth.users(id),
  motivo text not null,
  duracao_horas int not null check (duracao_horas in (1,4,24)),
  status text not null default 'solicitado' check (status in ('solicitado','aprovado','negado','expirado','revogado')),
  aprovado_por uuid,
  inicio timestamptz,
  expira_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

-- Log de auditoria imutável. Não guarda valores pessoais, só QUEM fez O QUÊ e QUAIS campos.
create table public.auditoria (
  id bigint generated always as identity primary key,
  condominio_id uuid references public.condominios(id) on delete set null,
  ator uuid,
  ator_papel text,
  acao text not null,
  tabela text,
  registro_id uuid,
  campos text[],
  contexto jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index on public.auditoria (condominio_id, created_at desc);

-- Fila para o job/worker apagar arquivos do Storage e dos equipamentos.
create table public.fila_exclusao_arquivos (
  id bigint generated always as identity primary key,
  condominio_id uuid,
  bucket text not null,
  path text not null,
  remover_do_equipamento_pessoa uuid,
  processado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

-- Triggers padrão em todas as tabelas de domínio
do $$
declare t text;
begin
  foreach t in array array[
    'blocos','unidades','pessoas','vinculos','vagas','cessoes_vaga','locacoes','hospedes','links_facial',
    'consentimentos','biometrias','areas_comuns','reservas','demandas_transparencia','etapas_demanda','cotacoes',
    'duvidas_demanda','assembleias','pautas','votos','comunicados','ocorrencias','encomendas','registros_acesso',
    'notificacoes','convites','equipamentos_acesso','pedidos_titular','aceites_dpa','acessos_suporte','fila_exclusao_arquivos'
  ] loop
    perform app.padronizar(('public.' || t)::regclass);
  end loop;
end $$;
