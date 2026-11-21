-- =====================================================================
-- Seed de desenvolvimento — 2 condomínios FICTÍCIOS.
-- Nomes, CPFs (dígitos verificadores válidos, mas inventados), telefones e e-mails
-- (@example.com) não pertencem a pessoas reais. Senha de todos: Demo@2026!
-- =====================================================================

-- Chave de criptografia local (em produção, configure o segredo no Vault manualmente).
do $$
begin
  if to_regclass('vault.secrets') is not null then
    execute $v$
      select vault.create_secret('chave-local-de-desenvolvimento-troque-em-producao', 'app_crypto_key')
      where not exists (select 1 from vault.secrets where name = 'app_crypto_key')
    $v$;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Usuários (auth)
-- ---------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select id::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', email,
       extensions.crypt('Demo@2026!', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('nome', nome), now(), now(), '', '', '', ''
from (values
  ('00000000-0000-4000-8000-0000000000d0', 'dono@example.com',            'Dono da Plataforma'),
  ('00000000-0000-4000-8000-0000000000a1', 'helena.prado@example.com',    'Helena Prado'),
  ('00000000-0000-4000-8000-0000000000a2', 'carla.nunes@example.com',     'Carla Nunes'),
  ('00000000-0000-4000-8000-0000000000a3', 'portaria.acacias@example.com','José Antunes'),
  ('00000000-0000-4000-8000-0000000000a4', 'ricardo.alves@example.com',   'Ricardo Alves'),
  ('00000000-0000-4000-8000-0000000000a5', 'bruno.melo@example.com',      'Bruno Melo'),
  ('00000000-0000-4000-8000-0000000000a6', 'pedro.lima@example.com',      'Pedro Lima'),
  ('00000000-0000-4000-8000-0000000000b1', 'marcos.teixeira@example.com', 'Marcos Teixeira'),
  ('00000000-0000-4000-8000-0000000000b2', 'ana.ribeiro@example.com',     'Ana Ribeiro')
) as u(id, email, nome);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users where email like '%@example.com';

insert into public.plataforma_admins (user_id) values ('00000000-0000-4000-8000-0000000000d0');

-- ---------------------------------------------------------------------
-- Planos
-- ---------------------------------------------------------------------
insert into public.planos (id, nome, max_unidades, preco_mensal, recursos) values
  ('f0000000-0000-4000-8000-000000000001', 'Essencial',    60,  189.00, '{"facial":true,"transparencia":true}'),
  ('f0000000-0000-4000-8000-000000000002', 'Profissional', 200, 389.00, '{"facial":true,"transparencia":true,"assembleias":true}'),
  ('f0000000-0000-4000-8000-000000000003', 'Corporativo',  2000, 990.00, '{"facial":true,"transparencia":true,"assembleias":true,"multi_portaria":true}');

-- ---------------------------------------------------------------------
-- Condomínio 1 — Res. Jardim das Acácias (Curitiba-PR)
-- ---------------------------------------------------------------------
insert into public.condominios (id, nome, sigla, cnpj, cidade, uf, plano_id, status, encarregado_nome, encarregado_email) values
  ('11111111-1111-4111-8111-111111111111', 'Res. Jardim das Acácias', 'JA', '12345678000190', 'Curitiba', 'PR',
   'f0000000-0000-4000-8000-000000000001', 'ativo', 'Helena Prado', 'privacidade.acacias@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'Cond. Vila dos Ipês', 'VI', '98765432000110', 'Campinas', 'SP',
   'f0000000-0000-4000-8000-000000000002', 'ativo', 'Marcos Teixeira', 'privacidade.ipes@example.com');

insert into public.membros_condominio (condominio_id, user_id, papel) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a1', 'sindico'),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a2', 'conselho'),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a2', 'morador'),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a3', 'portaria'),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a4', 'morador'),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a5', 'morador'),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a6', 'morador'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-0000000000b1', 'sindico'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-0000000000b2', 'morador');

insert into public.blocos (id, condominio_id, nome) values
  ('10000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'A'),
  ('10000000-0000-4000-8000-00000000000b', '11111111-1111-4111-8111-111111111111', 'B');

insert into public.unidades (id, condominio_id, bloco_id, codigo) values
  ('a0000000-0000-4000-8000-000000000304', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-00000000000a', '304-A'),
  ('a0000000-0000-4000-8000-000000000207', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-00000000000a', '207-A'),
  ('a0000000-0000-4000-8000-000000000101', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-00000000000a', '101-A'),
  ('b0000000-0000-4000-8000-000000001102', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-00000000000b', '1102-B'),
  ('b0000000-0000-4000-8000-000000000502', '11111111-1111-4111-8111-111111111111', '10000000-0000-4000-8000-00000000000b', '502-B'),
  ('c1000000-0000-4000-8000-000000000011', '22222222-2222-4222-8222-222222222222', null, 'Casa 11'),
  ('c1000000-0000-4000-8000-000000000012', '22222222-2222-4222-8222-222222222222', null, 'Casa 12');

-- Pessoas (CPF/celular criptografados logo abaixo)
insert into public.pessoas (id, condominio_id, user_id, nome, email) values
  ('50000000-0000-4000-8000-0000000000a1', '11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a1', 'Helena Prado', 'helena.prado@example.com'),
  ('50000000-0000-4000-8000-0000000000a2', '11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a2', 'Carla Nunes', 'carla.nunes@example.com'),
  ('50000000-0000-4000-8000-0000000000a3', '11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a3', 'José Antunes', 'portaria.acacias@example.com'),
  ('50000000-0000-4000-8000-0000000000a4', '11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a4', 'Ricardo Alves', 'ricardo.alves@example.com'),
  ('50000000-0000-4000-8000-0000000000a7', '11111111-1111-4111-8111-111111111111', null,                                   'Lúcia Alves', null),
  ('50000000-0000-4000-8000-0000000000a5', '11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a5', 'Bruno Melo', 'bruno.melo@example.com'),
  ('50000000-0000-4000-8000-0000000000a6', '11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a6', 'Pedro Lima', 'pedro.lima@example.com'),
  ('50000000-0000-4000-8000-0000000000a8', '11111111-1111-4111-8111-111111111111', null,                                   'Tânia Rocha', null),
  ('50000000-0000-4000-8000-0000000000a9', '11111111-1111-4111-8111-111111111111', null,                                   'Marina Souza', null),
  ('50000000-0000-4000-8000-0000000000b1', '22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-0000000000b1', 'Marcos Teixeira', 'marcos.teixeira@example.com'),
  ('50000000-0000-4000-8000-0000000000b2', '22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-0000000000b2', 'Ana Ribeiro', 'ana.ribeiro@example.com'),
  ('50000000-0000-4000-8000-0000000000b3', '22222222-2222-4222-8222-222222222222', null,                                   'Paulo Ramos', null);

select app.definir_documentos(id::uuid, cpf, cel) from (values
  ('50000000-0000-4000-8000-0000000000a1', '12345678909', '41998120001'),
  ('50000000-0000-4000-8000-0000000000a2', '98765432100', '41998120002'),
  ('50000000-0000-4000-8000-0000000000a3', '24681357928', '41998120003'),
  ('50000000-0000-4000-8000-0000000000a4', '13579246828', '41998120004'),
  ('50000000-0000-4000-8000-0000000000a7', '31415926590', '41998120005'),
  ('50000000-0000-4000-8000-0000000000a5', '27182818205', '41998120006'),
  ('50000000-0000-4000-8000-0000000000a6', '16180339805', '41998120007'),
  ('50000000-0000-4000-8000-0000000000a8', '14142135651', '41998120008'),
  ('50000000-0000-4000-8000-0000000000a9', '17320508052', '41998123344'),
  ('50000000-0000-4000-8000-0000000000b1', '22360679767', '19998120001'),
  ('50000000-0000-4000-8000-0000000000b2', '24494897469', '19998120002'),
  ('50000000-0000-4000-8000-0000000000b3', '26457513182', '19998120003')
) as d(id, cpf, cel);

insert into public.vinculos (condominio_id, pessoa_id, unidade_id, tipo, responsavel, inicio) values
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a4', 'a0000000-0000-4000-8000-000000000304', 'proprietario', true,  '2019-03-01'),
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a7', 'a0000000-0000-4000-8000-000000000304', 'residente',    false, '2019-03-01'),
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a5', 'a0000000-0000-4000-8000-000000000207', 'proprietario', true,  '2021-07-15'),
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a6', 'b0000000-0000-4000-8000-000000001102', 'inquilino',    true,  '2026-11-01'),
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-000000000101', 'proprietario', true,  '2015-01-10'),
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a8', 'b0000000-0000-4000-8000-000000000502', 'proprietario', true,  '2018-05-20'),
  ('22222222-2222-4222-8222-222222222222', '50000000-0000-4000-8000-0000000000b2', 'c1000000-0000-4000-8000-000000000011', 'proprietario', true,  '2020-02-02'),
  ('22222222-2222-4222-8222-222222222222', '50000000-0000-4000-8000-0000000000b3', 'c1000000-0000-4000-8000-000000000012', 'proprietario', true,  '2022-09-09');

-- Vagas
insert into public.vagas (id, condominio_id, unidade_id, numero, local, descricao) values
  ('c0000000-0000-4000-8000-000000000018', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000304', '18', 'Subsolo 1', 'Coberta · carro'),
  ('c0000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000207', '07', 'Subsolo 1', 'Coberta · carro'),
  ('c0000000-0000-4000-8000-000000000033', '11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000001102', '33', 'Térreo', 'Descoberta · moto');

-- Cessão aprovada: 207-A empresta a vaga 07 para a 1102-B (valor só para as partes e o síndico)
insert into public.cessoes_vaga (condominio_id, vaga_id, unidade_cedente_id, unidade_cessionaria_id, inicio, fim, placa, valor_mensal, status, decidido_em)
values ('11111111-1111-4111-8111-111111111111', 'c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000207',
        'b0000000-0000-4000-8000-000000001102', '2026-11-01', '2027-04-30', 'BRA2E19', 250.00, 'aprovada', now());

-- Biometria + consentimento (Ricardo e Lúcia — "Facial 2 de 2")
insert into public.consentimentos (id, condominio_id, pessoa_id, finalidade, versao_termo, ip) values
  ('60000000-0000-4000-8000-0000000000a4', '11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a4', 'biometria_acesso', 'biometria-v1', '177.10.0.4'),
  ('60000000-0000-4000-8000-0000000000a7', '11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a7', 'biometria_acesso', 'biometria-v1', '177.10.0.4'),
  ('60000000-0000-4000-8000-0000000000a5', '11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a5', 'biometria_acesso', 'biometria-v1', '177.10.0.6');
insert into public.biometrias (condominio_id, pessoa_id, consentimento_id, storage_path, sincronizada_em) values
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a4', '60000000-0000-4000-8000-0000000000a4', '11111111-1111-4111-8111-111111111111/50000000-0000-4000-8000-0000000000a4.jpg', now()),
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a7', '60000000-0000-4000-8000-0000000000a7', '11111111-1111-4111-8111-111111111111/50000000-0000-4000-8000-0000000000a7.jpg', now()),
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a5', '60000000-0000-4000-8000-0000000000a5', '11111111-1111-4111-8111-111111111111/50000000-0000-4000-8000-0000000000a5.jpg', now());

-- Locação de temporada pendente (Marina Souza, 22 a 25/11, Airbnb, 2 hóspedes)
insert into public.vinculos (condominio_id, pessoa_id, unidade_id, tipo, inicio, fim) values
  ('11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a9', 'a0000000-0000-4000-8000-000000000304',
   'locatario_temporada', '2026-11-22 14:00-03', '2026-11-25 11:00-03');
insert into public.locacoes (id, condominio_id, unidade_id, tipo, responsavel_pessoa_id, inicio, fim, qtd_pessoas, origem, status, created_by) values
  ('70000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000304', 'temporada',
   '50000000-0000-4000-8000-0000000000a9', '2026-11-22 14:00-03', '2026-11-25 11:00-03', 2, 'Airbnb', 'aguardando_sindico',
   '00000000-0000-4000-8000-0000000000a4');
insert into public.hospedes (condominio_id, locacao_id, pessoa_id) values
  ('11111111-1111-4111-8111-111111111111', '70000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-0000000000a9');

-- Link facial do Pedro (1102-B) — token de demonstração; em produção o token é aleatório.
insert into public.links_facial (id, condominio_id, pessoa_id, unidade_id, token_hash, expira_em, created_by) values
  ('e0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '50000000-0000-4000-8000-0000000000a6',
   'b0000000-0000-4000-8000-000000001102', app.hash_token('demo-pedro-1102b-0123456789abcdef0123456789abcdef'),
   greatest('2026-11-23 14:22-03'::timestamptz, now() + interval '48 hours'), '00000000-0000-4000-8000-0000000000a1');

-- Áreas comuns e reservas
insert into public.areas_comuns (id, condominio_id, nome) values
  ('80000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Salão de festas'),
  ('80000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Churrasqueira'),
  ('80000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'Quiosque');
insert into public.reservas (condominio_id, area_id, unidade_id, inicio, fim, status) values
  ('11111111-1111-4111-8111-111111111111', '80000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000304',
   '2026-12-13 18:00-03', '2026-12-13 23:00-03', 'confirmada');

-- Transparência
insert into public.demandas_transparencia (id, condominio_id, titulo, local, descricao, etapa, teto, prazo_cotacoes, publicada) values
  ('d0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Impermeabilização da laje', 'Bloco B',
   'Infiltração no 12º andar', 'cotacoes', 90000, '2026-11-28', true),
  ('d0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Pintura da fachada', null,
   'Desgaste da pintura externa', 'aprovacao', null, null, true),
  ('d0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Troca do portão da garagem', null,
   'Rascunho do conselho', 'solicitacao', null, null, false);
update public.demandas_transparencia set assembleia_em = '2026-12-04 19:30-03' where id = 'd0000000-0000-4000-8000-000000000002';

insert into public.etapas_demanda (condominio_id, demanda_id, etapa, detalhe, concluida_em) values
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001', 'solicitacao', '03/11 · infiltração no 12º andar', '2026-11-03 10:00-03'),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001', 'cotacoes', '3 recebidas · prazo 28/11', null),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001', 'aprovacao', 'Conselho', null),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001', 'contrato', null, null),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001', 'execucao', null, null),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000002', 'solicitacao', '15/09 · desgaste da pintura', '2026-09-15 10:00-03'),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000002', 'cotacoes', '4 recebidas', '2026-10-30 10:00-03'),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000002', 'aprovacao', 'Assembleia em 04/12', null),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000002', 'contrato', null, null),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000002', 'execucao', null, null);

insert into public.cotacoes (condominio_id, demanda_id, fornecedor, valor, prazo_dias, garantia_anos) values
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001', 'ImperSul', 78400, 25, 5),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001', 'Vedatec Engenharia', 86900, 20, 5),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000001', 'Laje Forte', 92300, 18, 10),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000002', 'Cores do Sul', 142000, 60, 3),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000002', 'Pinta Bem', 151500, 45, 3),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000002', 'Fachada Nova', 158900, 50, 5),
  ('11111111-1111-4111-8111-111111111111', 'd0000000-0000-4000-8000-000000000002', 'Prisma Reformas', 166300, 40, 5);

insert into public.assembleias (id, condominio_id, titulo, data_hora) values
  ('90000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'AGE · Pintura da fachada', '2026-12-04 19:30-03');
insert into public.pautas (condominio_id, assembleia_id, demanda_id, titulo) values
  ('11111111-1111-4111-8111-111111111111', '90000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'Aprovar a pintura da fachada');

insert into public.comunicados (condominio_id, titulo, corpo) values
  ('11111111-1111-4111-8111-111111111111', 'Manutenção dos elevadores', 'Elevador social do Bloco B parado dia 26/11, das 8h às 12h.'),
  ('22222222-2222-4222-8222-222222222222', 'Poda das árvores', 'Poda programada para 30/11.');

-- Portaria: registros recentes + um antigo (fora da retenção de 6 meses)
insert into public.registros_acesso (condominio_id, unidade_id, pessoa_id, tipo, meio, ocorrido_em) values
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000304', '50000000-0000-4000-8000-0000000000a4', 'entrada', 'facial', now() - interval '2 hours'),
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000207', '50000000-0000-4000-8000-0000000000a5', 'saida', 'facial', now() - interval '5 hours'),
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000001102', null, 'entrega', 'portaria', now() - interval '1 day'),
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000304', '50000000-0000-4000-8000-0000000000a4', 'entrada', 'facial', now() - interval '8 months');

insert into public.encomendas (condominio_id, unidade_id, descricao) values
  ('11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000001102', 'Caixa média · Correios');

insert into public.aceites_dpa (condominio_id, versao, aceito_por, ip) values
  ('11111111-1111-4111-8111-111111111111', 'dpa-v1', '00000000-0000-4000-8000-0000000000a1', '177.10.0.1'),
  ('22222222-2222-4222-8222-222222222222', 'dpa-v1', '00000000-0000-4000-8000-0000000000b1', '189.20.0.1');

insert into public.notificacoes (condominio_id, user_id, titulo, link) values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a4', 'Locação da Marina enviada ao síndico', '/inicio'),
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-0000000000a4', 'Reserva do salão confirmada', '/inicio');
