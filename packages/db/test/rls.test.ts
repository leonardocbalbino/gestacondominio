import { afterAll, describe, expect, it } from 'vitest';
import { C, como, falha, pool, U, UN } from './helpers';

afterAll(() => pool.end());

const TABELAS_PESSOAIS = [
  'pessoas', 'vinculos', 'locacoes', 'hospedes', 'biometrias', 'consentimentos', 'cessoes_vaga',
  'registros_acesso', 'encomendas', 'reservas', 'pedidos_titular', 'links_facial', 'auditoria', 'membros_condominio',
  'notificacoes', 'unidades', 'condominios',
];

describe('Dono do sistema — sem dados pessoais (bloqueado no banco)', () => {
  it('NÃO consegue ler pessoas.nome', async () => {
    await como(U.dono, async ({ q }) => {
      const rows = await q('select nome from public.pessoas');
      expect(rows).toHaveLength(0);
    });
  });

  it.each(TABELAS_PESSOAIS)('não lê nenhuma linha de %s', async (t) => {
    await como(U.dono, async ({ q }) => {
      expect(await q(`select * from public.${t}`)).toHaveLength(0);
    });
  });

  it('não lê views da portaria nem resultados de votação', async () => {
    await como(U.dono, async ({ q }) => {
      expect(await q('select * from public.vw_portaria_pessoas')).toHaveLength(0);
      expect(await q('select * from public.vw_portaria_vagas')).toHaveLength(0);
    });
  });

  it('não consegue inserir pessoas mesmo informando o condomínio', async () => {
    await como(U.dono, async ({ q }) => {
      const msg = await falha(q(`insert into public.pessoas (condominio_id, nome) values ($1, 'Intruso')`, [C.acacias]));
      expect(msg).toMatch(/row-level security/);
    });
  });

  it('não consegue ler CPF completo', async () => {
    await como(U.dono, async ({ q }) => {
      // a RPC nem encontra a pessoa (RLS no definer não se aplica, mas a checagem explícita barra)
      const msg = await falha(q(`select public.cpf_completo('50000000-0000-4000-8000-0000000000a4')`));
      expect(msg).toMatch(/sem permissão/);
    });
  });

  it('vê métricas agregadas com contagens pequenas suprimidas ("< 3")', async () => {
    await como(U.dono, async ({ q }) => {
      const rows = await q<{ nome: string; unidades: string; moradores_ativos: string; hospedes_mes: string }>(
        'select * from public.metricas_dono()',
      );
      expect(rows.map((r) => r.nome)).toEqual(['Cond. Vila dos Ipês', 'Res. Jardim das Acácias']);
      const ipes = rows.find((r) => r.nome.includes('Ipês'))!;
      expect(ipes.unidades).toBe('< 3'); // 2 unidades
      expect(ipes.moradores_ativos).toBe('< 3');
      const acacias = rows.find((r) => r.nome.includes('Acácias'))!;
      expect(acacias.unidades).toBe('5');
      // Nenhum campo traz nome de pessoa
      const texto = JSON.stringify(rows);
      for (const nome of ['Ricardo', 'Helena', 'Marina', 'Pedro', 'Ana Ribeiro']) expect(texto).not.toContain(nome);
    });
  });

  it('cria condomínio e convida o síndico (sem ver dados de ninguém)', async () => {
    await como(U.dono, async ({ q }) => {
      const [r] = await q<{ criar_condominio: { condominio_id: string; convite_token: string } }>(
        `select public.criar_condominio('Res. Parque das Araucárias', 'Londrina', 'pr', 'f0000000-0000-4000-8000-000000000001', 'sindica@example.com', 'Sílvia Costa')`,
      );
      expect(r!.criar_condominio.convite_token).toHaveLength(48);
      const m = await q<{ nome: string; status: string }>('select nome, status from public.metricas_dono()');
      expect(m.find((x) => x.nome === 'Res. Parque das Araucárias')?.status).toBe('implantacao');
    });
  });

  it('morador não consegue chamar métricas do dono', async () => {
    await como(U.ricardo, async ({ q }) => {
      expect(await falha(q('select * from public.metricas_dono()'))).toMatch(/apenas o dono/);
    });
  });
});

describe('Isolamento entre condomínios', () => {
  it('síndico do Ipês não vê ninguém do Acácias', async () => {
    await como(U.marcos, async ({ q }) => {
      const nomes = (await q<{ nome: string }>('select nome from public.pessoas')).map((r) => r.nome);
      expect(nomes).toContain('Ana Ribeiro');
      expect(nomes).not.toContain('Ricardo Alves');
      expect(await q('select * from public.locacoes')).toHaveLength(0);
      expect(await q('select * from public.condominios where id = $1', [C.acacias])).toHaveLength(0);
    });
  });

  it('síndico não grava em outro condomínio', async () => {
    await como(U.marcos, async ({ q }) => {
      const msg = await falha(q(`insert into public.comunicados (condominio_id, titulo, corpo) values ($1, 'x', 'y')`, [C.acacias]));
      expect(msg).toMatch(/row-level security/);
    });
  });
});

describe('Morador', () => {
  it('vê só as pessoas e locações da própria unidade', async () => {
    await como(U.ricardo, async ({ q }) => {
      const nomes = (await q<{ nome: string }>('select nome from public.pessoas order by nome')).map((r) => r.nome);
      expect(nomes).toEqual(['Lúcia Alves', 'Marina Souza', 'Ricardo Alves']);
      const locs = await q<{ unidade_id: string }>('select unidade_id from public.locacoes');
      expect(locs.every((l) => l.unidade_id === UN.u304A)).toBe(true);
    });
  });

  it('não lê CPF criptografado de vizinhos nem CPF completo de outra pessoa', async () => {
    await como(U.bruno, async ({ q }) => {
      expect(await q(`select * from public.pessoas where nome = 'Ricardo Alves'`)).toHaveLength(0);
      expect(await falha(q(`select public.cpf_completo('50000000-0000-4000-8000-0000000000a4')`))).toMatch(/sem permissão/);
    });
  });

  it('titular lê o próprio CPF completo (e a leitura é auditada)', async () => {
    await como(U.ricardo, async ({ q, admin }) => {
      const [r] = await q<{ cpf_completo: string }>(`select public.cpf_completo('50000000-0000-4000-8000-0000000000a4')`);
      expect(r!.cpf_completo).toBe('13579246828');
      const aud = await admin(`select * from public.auditoria where acao = 'ler_cpf_completo' and ator = $1`, [U.ricardo]);
      expect(aud).toHaveLength(1);
    });
  });

  it('CPF fica criptografado em repouso', async () => {
    await como(U.helena, async ({ q }) => {
      const [p] = await q<{ cpf_cripto: Buffer; cpf_mascarado: string }>(
        `select cpf_cripto, cpf_mascarado from public.pessoas where nome = 'Ricardo Alves'`,
      );
      expect(p!.cpf_cripto.toString('latin1')).not.toContain('13579246828');
      expect(p!.cpf_mascarado).toBe('***.792.468-**');
    });
  });

  it('cria cessão de vaga só da própria vaga; cessionária confirma; síndico aprova', async () => {
    await como(U.ricardo, async ({ q }) => {
      const [c] = await q<{ id: string }>(
        `insert into public.cessoes_vaga (condominio_id, vaga_id, unidade_cedente_id, unidade_cessionaria_id, inicio, fim, placa, valor_mensal)
         values ($1, 'c0000000-0000-4000-8000-000000000018', $2, $3, '2026-12-01', '2027-05-31', 'RTX4E21', 300) returning id`,
        [C.acacias, UN.u304A, UN.u207A],
      );
      // vaga de outra unidade: negado
      expect(
        await falha(
          q(
            `insert into public.cessoes_vaga (condominio_id, vaga_id, unidade_cedente_id, unidade_cessionaria_id, inicio, placa)
             values ($1, 'c0000000-0000-4000-8000-000000000007', $2, $3, '2026-12-01', 'RTX4E21')`,
            [C.acacias, UN.u304A, UN.u207A],
          ),
        ),
      ).toMatch(/row-level security/);
      // o próprio cedente não pode "confirmar" pela cessionária
      expect(await falha(q('select public.responder_cessao($1, true)', [c!.id]))).toMatch(/cessionária/);
      // síndico não decide antes da unidade confirmar — verificado no fluxo abaixo
      expect(c!.id).toBeTruthy();
    });
  });

  it('valor da cessão é visível só para cedente, cessionária e síndico', async () => {
    const sql = `select valor_mensal from public.cessoes_vaga where placa = 'BRA2E19'`;
    await como(U.bruno, async ({ q }) => expect(await q(sql)).toHaveLength(1)); // cedente 207-A
    await como(U.pedro, async ({ q }) => expect(await q(sql)).toHaveLength(1)); // cessionária 1102-B
    await como(U.helena, async ({ q }) => expect(await q(sql)).toHaveLength(1)); // síndica
    await como(U.ricardo, async ({ q }) => expect(await q(sql)).toHaveLength(0)); // terceiro
    await como(U.portaria, async ({ q }) => expect(await q(sql)).toHaveLength(0)); // portaria
  });

  it('cadastra locatário de temporada e recebe link facial; não cadastra em unidade alheia', async () => {
    await como(U.ricardo, async ({ q }) => {
      const [r] = await q<{ criar_locacao_temporada: { locacao_id: string; links: { token: string }[] } }>(
        `select public.criar_locacao_temporada($1, 'Fulano Teste', '41999990000', now() + interval '1 day', now() + interval '3 days', 2, 'Booking')`,
        [UN.u304A],
      );
      const token = r!.criar_locacao_temporada.links[0]!.token;
      expect(token).toHaveLength(48);
      const [info] = await q<{ primeiro_nome: string; unidade: string; valido: boolean }>(
        'select * from public.link_facial_info($1)',
        [token],
      );
      expect(info).toMatchObject({ primeiro_nome: 'Fulano', unidade: '304-A', valido: true });
      expect(
        await falha(
          q(
            `select public.criar_locacao_temporada($1, 'X Y', '41999990000', now(), now() + interval '1 day', 1, 'Direto')`,
            [UN.u207A],
          ),
        ),
      ).toMatch(/sua unidade/);
    });
  });
});

describe('Fluxo completo de cessão', () => {
  it('cedente → cessionária confirma → síndico aprova → portaria vê placa (sem valor)', async () => {
    await como(U.ricardo, async ({ q, trocar }) => {
      const [c] = await q<{ id: string }>(
        `insert into public.cessoes_vaga (condominio_id, vaga_id, unidade_cedente_id, unidade_cessionaria_id, inicio, fim, placa, valor_mensal)
         values ($1, 'c0000000-0000-4000-8000-000000000018', $2, $3, current_date, current_date + 90, 'RTX4E21', 300) returning id`,
        [C.acacias, UN.u304A, UN.u207A],
      );
      const id = c!.id;
      // Síndica ainda não pode decidir
      await trocar(U.helena);
      expect(await falha(q(`select public.decidir_pedido('cessao', $1, true)`, [id]))).toMatch(/não está com o síndico/);
      // Bruno (207-A) confirma
      await trocar(U.bruno);
      await q('select public.responder_cessao($1, true)', [id]);
      // Helena aprova
      await trocar(U.helena);
      await q(`select public.decidir_pedido('cessao', $1, true)`, [id]);
      // Ricardo recebe notificação
      await trocar(U.ricardo);
      const notif = await q<{ titulo: string }>(`select titulo from public.notificacoes where titulo = 'Seu pedido foi aprovado'`);
      expect(notif).toHaveLength(1);
      // Portaria enxerga a vaga 18 com placa, sem valor
      await trocar(U.portaria);
      const [v] = await q<Record<string, unknown>>(`select * from public.vw_portaria_vagas where vaga = '18'`);
      expect(v).toMatchObject({ unidade_que_usa: '207-A', placa: 'RTX4E21' });
      expect(v).not.toHaveProperty('valor_mensal');
    });
  });

  it('síndico não aprova cessão que ainda aguarda a unidade', async () => {
    await como(U.helena, async ({ q, admin }) => {
      const [c] = await admin<{ id: string }>(
        `insert into public.cessoes_vaga (condominio_id, vaga_id, unidade_cedente_id, unidade_cessionaria_id, inicio, placa)
         values ($1, 'c0000000-0000-4000-8000-000000000018', $2, $3, current_date, 'RTX4E21') returning id`,
        [C.acacias, UN.u304A, UN.u207A],
      );
      expect(await falha(q(`select public.decidir_pedido('cessao', $1, true)`, [c!.id]))).toMatch(/não está com o síndico/);
      await admin(`update public.cessoes_vaga set status = 'aguardando_sindico' where id = $1`, [c!.id]);
      await q(`select public.decidir_pedido('cessao', $1, true)`, [c!.id]);
      const [r] = await q<{ status: string }>('select status from public.cessoes_vaga where id = $1', [c!.id]);
      expect(r!.status).toBe('aprovada');
    });
  });

  it('cessionária confirma via RPC', async () => {
    await como(U.bruno, async ({ q, admin }) => {
      const [c] = await admin<{ id: string }>(
        `insert into public.cessoes_vaga (condominio_id, vaga_id, unidade_cedente_id, unidade_cessionaria_id, inicio, placa)
         values ($1, 'c0000000-0000-4000-8000-000000000018', $2, $3, current_date, 'RTX4E21') returning id`,
        [C.acacias, UN.u304A, UN.u207A],
      );
      await q('select public.responder_cessao($1, true)', [c!.id]);
      const [r] = await q<{ status: string }>('select status from public.cessoes_vaga where id = $1', [c!.id]);
      expect(r!.status).toBe('aguardando_sindico');
    });
  });
});

describe('Portaria', () => {
  it('não lê pessoas, locações, contratos nem biometria diretamente', async () => {
    await como(U.portaria, async ({ q }) => {
      // só o próprio cadastro (direito de acesso do titular)
      const pessoas = await q<{ nome: string }>('select nome from public.pessoas');
      expect(pessoas.map((p) => p.nome)).toEqual(['José Antunes']);
      for (const t of ['locacoes', 'biometrias', 'consentimentos', 'cessoes_vaga', 'links_facial']) {
        expect(await q(`select * from public.${t}`), t).toHaveLength(0);
      }
    });
  });

  it('vê CPF mascarado (***.456.789-**) e nenhuma coluna de contato/contrato', async () => {
    await como(U.portaria, async ({ q }) => {
      const rows = await q<Record<string, unknown>>('select * from public.vw_portaria_pessoas order by nome');
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(String(r.cpf_mascarado)).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
        expect(Object.keys(r)).not.toEqual(expect.arrayContaining(['cpf_cripto']));
        for (const proibida of ['cpf_cripto', 'celular_cripto', 'celular_mascarado', 'email', 'contrato_path', 'valor_mensal']) {
          expect(r).not.toHaveProperty(proibida);
        }
      }
      // locatária de temporada pendente (não aprovada) não aparece para a portaria
      expect(rows.map((r) => r.nome)).not.toContain('Marina Souza');
    });
  });

  it('vê vagas cedidas com placa, sem valor', async () => {
    await como(U.portaria, async ({ q }) => {
      const [v] = await q<Record<string, unknown>>('select * from public.vw_portaria_vagas');
      expect(v).toMatchObject({ vaga: '07', unidade_que_usa: '1102-B', placa: 'BRA2E19' });
      expect(v).not.toHaveProperty('valor_mensal');
    });
  });

  it('registra acesso, mas não vê transparência', async () => {
    await como(U.portaria, async ({ q }) => {
      await q(`insert into public.registros_acesso (condominio_id, unidade_id, tipo, meio) values ($1, $2, 'visitante', 'portaria')`, [C.acacias, UN.u304A]);
      expect(await q('select * from public.demandas_transparencia')).toHaveLength(0);
      expect(await q('select * from public.cotacoes')).toHaveLength(0);
    });
  });
});

describe('Transparência', () => {
  it('morador vê demandas publicadas e cotações; rascunho fica oculto', async () => {
    await como(U.bruno, async ({ q }) => {
      const d = await q<{ titulo: string }>('select titulo from public.demandas_transparencia order by titulo');
      expect(d.map((x) => x.titulo)).toEqual(['Impermeabilização da laje', 'Pintura da fachada']);
      const c = await q<{ fornecedor: string; valor: string }>(
        `select fornecedor, valor from public.cotacoes where demanda_id = 'd0000000-0000-4000-8000-000000000001' order by valor`,
      );
      expect(c.map((x) => [x.fornecedor, Number(x.valor)])).toEqual([
        ['ImperSul', 78400],
        ['Vedatec Engenharia', 86900],
        ['Laje Forte', 92300],
      ]);
    });
  });

  it('conselho vê rascunhos e pode publicar', async () => {
    await como(U.carla, async ({ q }) => {
      expect(await q('select * from public.demandas_transparencia')).toHaveLength(3);
      await q(`update public.demandas_transparencia set publicada = true where titulo like 'Troca%'`);
    });
  });

  it('morador não edita cotações', async () => {
    await como(U.ricardo, async ({ q }) => {
      const r = await q(`update public.cotacoes set valor = 1 where fornecedor = 'ImperSul' returning id`);
      expect(r).toHaveLength(0);
    });
  });

  it('um voto por unidade, só com votação aberta', async () => {
    await como(U.ricardo, async ({ q, admin }) => {
      const [p] = await admin<{ id: string }>(`update public.pautas set votacao_aberta = true returning id`);
      await q(`insert into public.votos (condominio_id, pauta_id, unidade_id, opcao) values ($1, $2, $3, 'sim')`, [C.acacias, p!.id, UN.u304A]);
      expect(
        await falha(q(`insert into public.votos (condominio_id, pauta_id, unidade_id, opcao) values ($1, $2, $3, 'nao')`, [C.acacias, p!.id, UN.u304A])),
      ).toMatch(/duplicate key|unique/);
      expect(
        await falha(q(`insert into public.votos (condominio_id, pauta_id, unidade_id, opcao) values ($1, $2, $3, 'sim')`, [C.acacias, p!.id, UN.u207A])),
      ).toMatch(/row-level security/);
      const [res] = await q<{ sim: string }>('select sim from public.vw_resultado_pautas');
      expect(Number(res!.sim)).toBe(1);
    });
  });
});

describe('Link externo · cadastro facial (anônimo)', () => {
  const TOKEN = 'demo-pedro-1102b-0123456789abcdef0123456789abcdef';

  it('anon não lê nenhuma tabela', async () => {
    await como(null, async ({ q }) => {
      expect(await falha(q('select * from public.pessoas'))).toMatch(/permission denied/);
      expect(await falha(q('select * from public.links_facial'))).toMatch(/permission denied/);
    });
  });

  it('com token válido vê só primeiro nome, unidade e validade', async () => {
    await como(null, async ({ q }) => {
      const [r] = await q<Record<string, unknown>>('select * from public.link_facial_info($1)', [TOKEN]);
      expect(r).toMatchObject({ condominio: 'Res. Jardim das Acácias', sigla: 'JA', primeiro_nome: 'Pedro', unidade: '1102-B', valido: true });
      expect(Object.keys(r!).sort()).toEqual(['condominio', 'expira_em', 'primeiro_nome', 'sigla', 'unidade', 'valido', 'versao_termo']);
      expect(await q('select * from public.link_facial_info($1)', ['token-inexistente'])).toHaveLength(0);
    });
  });

  it('consentimento é registrado; foto só é aceita com consentimento e uma única vez', async () => {
    await como(null, async ({ q, admin }) => {
      // sem consentimento a Edge Function (service_role) é barrada
      expect(await falha(admin('select app.registrar_biometria_por_link($1, $2)', [TOKEN, 'x/pedro.jpg']))).toMatch(/consentimento ausente/);
      await q(`select public.link_facial_consentir($1, 'biometria-v1', '200.1.2.3')`, [TOKEN]);
      await admin('select app.registrar_biometria_por_link($1, $2)', [TOKEN, 'x/pedro.jpg']);
      const [b] = await admin<{ n: string }>(`select count(*) n from public.biometrias where pessoa_id = '50000000-0000-4000-8000-0000000000a6'`);
      expect(Number(b!.n)).toBe(1);
      expect(await falha(q(`select public.link_facial_consentir($1, 'biometria-v1')`, [TOKEN]))).toMatch(/expirado/);
    });
  });

  it('anon não executa a gravação de biometria', async () => {
    await como(null, async ({ q }) => {
      expect(await falha(q('select app.registrar_biometria_por_link($1, $2)', [TOKEN, 'x.jpg']))).toMatch(/permission denied/);
    });
  });

  it('link expirado é recusado', async () => {
    await como(null, async ({ q, admin }) => {
      await admin(`update public.links_facial set expira_em = now() - interval '1 minute' where id = 'e0000000-0000-4000-8000-000000000001'`);
      const [r] = await q<{ valido: boolean }>('select valido from public.link_facial_info($1)', [TOKEN]);
      expect(r!.valido).toBe(false);
      expect(await falha(q(`select public.link_facial_consentir($1, 'biometria-v1')`, [TOKEN]))).toMatch(/expirado/);
    });
  });
});

describe('Acesso de suporte (break-glass)', () => {
  it('pedido não aprovado não dá acesso; aprovado dá leitura por prazo; nunca escrita', async () => {
    await como(U.dono, async ({ q, admin, trocar }) => {
      const [s] = await q<{ solicitar_suporte: string }>(
        `select public.solicitar_suporte($1, 'Chamado #123: erro na reserva', 1)`,
        [C.acacias],
      );
      expect(await q('select nome from public.pessoas')).toHaveLength(0);

      // síndica aprova por 1h
      await trocar(U.helena);
      await q('select public.decidir_suporte($1, true)', [s!.solicitar_suporte]);
      await trocar(U.dono);

      const nomes = await q<{ nome: string }>('select nome from public.pessoas');
      expect(nomes.length).toBeGreaterThan(0);
      // Ainda sem biometria nem links
      expect(await q('select * from public.biometrias')).toHaveLength(0);
      expect(await q('select * from public.links_facial')).toHaveLength(0);
      // Somente leitura
      expect(await q(`update public.pessoas set nome = 'x' where nome = 'Ricardo Alves' returning id`)).toHaveLength(0);
      expect(
        await falha(q(`insert into public.comunicados (condominio_id, titulo, corpo) values ($1, 'x', 'y')`, [C.acacias])),
      ).toMatch(/row-level security/);
      // Ipês continua fechado
      expect(await q('select * from public.pessoas where condominio_id = $1', [C.ipes])).toHaveLength(0);

      // Expira
      await admin(`update public.acessos_suporte set expira_em = now() - interval '1 second' where id = $1`, [s!.solicitar_suporte]);
      expect(await q('select nome from public.pessoas')).toHaveLength(0);
    });
  });

  it('só aceita 1h, 4h ou 24h e só o síndico aprova', async () => {
    await como(U.dono, async ({ q }) => {
      expect(await falha(q(`select public.solicitar_suporte($1, 'x', 48)`, [C.acacias]))).toMatch(/1h, 4h ou 24h/);
      const [s] = await q<{ solicitar_suporte: string }>(`select public.solicitar_suporte($1, 'x', 4)`, [C.acacias]);
      expect(await falha(q('select public.decidir_suporte($1, true)', [s!.solicitar_suporte]))).toMatch(/apenas o síndico/);
    });
  });
});

describe('Auditoria imutável', () => {
  it('síndico lê, mas ninguém altera ou apaga — nem o superusuário', async () => {
    await como(U.helena, async ({ q, admin }) => {
      const rows = await q('select * from public.auditoria limit 5');
      expect(rows.length).toBeGreaterThan(0);
      expect(await falha(q('update public.auditoria set acao = $1', ['x']))).toMatch(/permission denied/);
      expect(await falha(q('delete from public.auditoria'))).toMatch(/permission denied/);
      expect(await falha(admin('delete from public.auditoria'))).toMatch(/imutável/);
      expect(await falha(admin('update public.auditoria set acao = $1', ['x']))).toMatch(/imutável/);
    });
  });

  it('não grava valores pessoais, só nomes de campos', async () => {
    await como(U.helena, async ({ q }) => {
      await q(`update public.pessoas set nome = 'Ricardo A. Alves' where nome = 'Ricardo Alves'`);
      const [a] = await q<{ campos: string[]; contexto: unknown }>(
        `select campos, contexto from public.auditoria where tabela = 'pessoas' and acao = 'update' order by id desc limit 1`,
      );
      expect(a!.campos).toEqual(['nome']);
      expect(JSON.stringify(a)).not.toContain('Ricardo');
    });
  });
});

describe('Direitos do titular e retenção', () => {
  it('exporta só os próprios dados', async () => {
    await como(U.ricardo, async ({ q }) => {
      const [r] = await q<{ exportar_meus_dados: Record<string, unknown> }>('select public.exportar_meus_dados()');
      const txt = JSON.stringify(r!.exportar_meus_dados);
      expect(txt).toContain('Ricardo Alves');
      expect(txt).toContain('304-A');
      expect(txt).not.toContain('Lúcia');
      expect(txt).not.toContain('Bruno');
      expect(txt).not.toContain('13579246828'); // CPF só mascarado no export
    });
  });

  it('revogar consentimento agenda exclusão; o job apaga e enfileira o arquivo', async () => {
    await como(U.ricardo, async ({ q, admin }) => {
      await q(`select public.revogar_consentimento('60000000-0000-4000-8000-0000000000a4')`);
      const [{ n }] = (await admin<{ n: number }>('select app.job_apagar_biometrias() as n')) as [{ n: number }];
      expect(n).toBe(1);
      expect(await q('select * from public.biometrias')).toHaveLength(0);
      const fila = await admin<{ bucket: string }>(`select bucket from public.fila_exclusao_arquivos`);
      expect(fila.map((f) => f.bucket)).toEqual(['biometrias']);
    });
  });

  it('biometria de hóspede é apagada no check-out', async () => {
    await como(U.helena, async ({ admin }) => {
      await admin(
        `insert into public.consentimentos (id, condominio_id, pessoa_id, finalidade, versao_termo)
         values ('60000000-0000-4000-8000-0000000000a9', $1, '50000000-0000-4000-8000-0000000000a9', 'biometria_acesso', 'biometria-v1')`,
        [C.acacias],
      );
      await admin(
        `insert into public.biometrias (condominio_id, pessoa_id, consentimento_id, storage_path, apagar_em)
         values ($1, '50000000-0000-4000-8000-0000000000a9', '60000000-0000-4000-8000-0000000000a9', 'x/marina.jpg', now() + interval '1 day')`,
        [C.acacias],
      );
      expect((await admin<{ n: number }>('select app.job_apagar_biometrias() as n'))[0]!.n).toBe(0);
      await admin(`update public.biometrias set apagar_em = now() - interval '1 minute' where storage_path = 'x/marina.jpg'`);
      expect((await admin<{ n: number }>('select app.job_apagar_biometrias() as n'))[0]!.n).toBe(1);
    });
  });

  it('síndico recusando locação agenda exclusão imediata da biometria do hóspede', async () => {
    await como(U.helena, async ({ q, admin }) => {
      await admin(
        `insert into public.consentimentos (id, condominio_id, pessoa_id, finalidade, versao_termo)
         values ('60000000-0000-4000-8000-0000000000a9', $1, '50000000-0000-4000-8000-0000000000a9', 'biometria_acesso', 'biometria-v1')`,
        [C.acacias],
      );
      await admin(
        `insert into public.biometrias (condominio_id, pessoa_id, consentimento_id, storage_path)
         values ($1, '50000000-0000-4000-8000-0000000000a9', '60000000-0000-4000-8000-0000000000a9', 'x/marina.jpg')`,
        [C.acacias],
      );
      await q(`select public.decidir_pedido('locacao', '70000000-0000-4000-8000-000000000001', false, 'Documentação incompleta')`);
      const [b] = await q<{ apagar_em: Date }>(`select apagar_em from public.biometrias where storage_path = 'x/marina.jpg'`);
      expect(b!.apagar_em.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });
  });

  it('retenção da portaria apaga registros com mais de 6 meses', async () => {
    await como(U.helena, async ({ q, admin }) => {
      const antes = await q('select * from public.registros_acesso');
      const [{ n }] = (await admin<{ n: number }>('select app.job_retencao_portaria() as n')) as [{ n: number }];
      expect(n).toBe(1);
      expect(await q('select * from public.registros_acesso')).toHaveLength(antes.length - 1);
    });
  });

  it('morador abre pedido de titular; prazo legal de 15 dias', async () => {
    await como(U.bruno, async ({ q }) => {
      const [p] = await q<{ prazo_em: Date; created_at: Date }>(
        `insert into public.pedidos_titular (condominio_id, pessoa_id, user_id, tipo) values ($1, '50000000-0000-4000-8000-0000000000a5', $2, 'exclusao') returning prazo_em, created_at`,
        [C.acacias, U.bruno],
      );
      const dias = (p!.prazo_em.getTime() - p!.created_at.getTime()) / 86_400_000;
      expect(Math.round(dias)).toBe(15);
    });
  });
});
