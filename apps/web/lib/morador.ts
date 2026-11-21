import 'server-only';
import {
  cessaoVagaSchema,
  locacaoSchema,
  ocorrenciaSchema,
  parseDataBR,
  reservaSchema,
  TIPOS_PEDIDO_TITULAR,
  type EtapaDemanda,
} from '@gc/core';
import type { Executor } from '@gc/db';
import { banco } from './db';

/** Erro de validação/negócio que vira HTTP 400/422 com mensagem para o usuário. */
export class ErroNegocio extends Error {
  constructor(msg: string, readonly status = 422) {
    super(msg);
  }
}

const VINCULO: Record<string, string> = { proprietario: 'Proprietário', inquilino: 'Inquilino', residente: 'Residente' };

interface Contexto {
  pessoaId: string;
  nome: string;
  condominioId: string;
  condominio: string;
  sigla: string;
  unidadeId: string;
  unidade: string;
  vinculo: string;
}

async function contexto(q: Executor, uid: string): Promise<Contexto> {
  const [c] = await q<Contexto>(
    `select p.id as "pessoaId", p.nome, c.id as "condominioId", c.nome as condominio, c.sigla,
            u.id as "unidadeId", u.codigo as unidade, v.tipo::text as vinculo
       from public.pessoas p
       join public.condominios c on c.id = p.condominio_id
       join public.vinculos v on v.pessoa_id = p.id and v.tipo in ('proprietario','inquilino','residente')
                              and v.inicio <= now() and (v.fim is null or v.fim > now())
       join public.unidades u on u.id = v.unidade_id
      where p.user_id = $1
      order by v.responsavel desc limit 1`,
    [uid],
  );
  if (!c) throw new ErroNegocio('Seu usuário não está vinculado a uma unidade', 403);
  return c;
}

const sob = <T>(uid: string, fn: (q: Executor, ctx: Contexto) => Promise<T>) =>
  banco().comoUsuario(uid, async (q) => fn(q, await contexto(q, uid)));

export function inicio(uid: string) {
  return sob(uid, async (q, ctx) => {
    const [res] = await q<{ moradores: number; faciais: number; vaga: string | null; pendentes: number; nao_lidas: number }>(
      `select
         (select total from public.resumo_facial_unidade($1)) as moradores,
         (select cadastradas from public.resumo_facial_unidade($1)) as faciais,
         (select numero from public.vagas where unidade_id = $1 order by numero limit 1) as vaga,
         (select count(*)::int from public.locacoes where unidade_id = $1 and status = 'aguardando_sindico') as pendentes,
         (select count(*)::int from public.notificacoes where user_id = $2 and lida_em is null) as nao_lidas`,
      [ctx.unidadeId, uid],
    );
    const pedidos = await q<{ id: string; titulo: string; inicio: Date; fim: Date; detalhe: string; status: string }>(
      `select l.id, 'Locatário(a) · ' || coalesce(p.nome, '') as titulo,
              l.inicio, l.fim, l.tipo as detalhe, l.status
         from public.locacoes l left join public.pessoas p on p.id = l.responsavel_pessoa_id
        where l.unidade_id = $1 and l.fim > now() - interval '7 days'
       union all
       select r.id, a.nome, r.inicio, r.fim, 'reserva', r.status
         from public.reservas r join public.areas_comuns a on a.id = r.area_id
        where r.unidade_id = $1 and r.fim > now()
       union all
       select c.id, 'Cessão da vaga ' || g.numero, c.inicio::timestamptz, coalesce(c.fim, c.inicio + 3650)::timestamptz, 'cessão', c.status
         from public.cessoes_vaga c join public.vagas g on g.id = c.vaga_id
        where (c.unidade_cedente_id = $1 or c.unidade_cessionaria_id = $1) and c.status in ('aguardando_cessionario','aguardando_sindico')
       order by inicio limit 10`,
      [ctx.unidadeId],
    );
    return {
      condominio: { id: ctx.condominioId, nome: ctx.condominio, sigla: ctx.sigla },
      usuario: { primeiroNome: ctx.nome.split(' ')[0] ?? ctx.nome, notificacoesNaoLidas: res!.nao_lidas },
      unidade: { id: ctx.unidadeId, codigo: ctx.unidade, vinculo: VINCULO[ctx.vinculo] ?? ctx.vinculo },
      resumo: { facialCadastradas: res!.faciais, facialTotal: res!.moradores, vaga: res!.vaga ?? '—', locatariosPendentes: res!.pendentes },
      pedidos,
    };
  });
}

export function demandas(uid: string) {
  return banco().comoUsuario(uid, async (q) => {
    const ds = await q<{ id: string; titulo: string; local: string | null; etapa: EtapaDemanda; teto: string | null; assembleia_em: Date | null }>(
      `select id, titulo, local, etapa, teto, assembleia_em from public.demandas_transparencia where publicada order by created_at desc`,
    );
    const etapas = await q<{ demanda_id: string; etapa: EtapaDemanda; detalhe: string | null }>(
      'select demanda_id, etapa, detalhe from public.etapas_demanda',
    );
    const cot = await q<{ demanda_id: string; id: string; fornecedor: string; valor: string; prazo_dias: number; garantia_anos: number | null }>(
      'select demanda_id, id, fornecedor, valor, prazo_dias, garantia_anos from public.cotacoes order by valor',
    );
    return ds.map((d) => ({
      id: d.id, titulo: d.titulo, local: d.local, etapa: d.etapa, teto: d.teto === null ? null : Number(d.teto), assembleiaEm: d.assembleia_em,
      etapas: etapas.filter((e) => e.demanda_id === d.id).map(({ etapa, detalhe }) => ({ etapa, detalhe })),
      cotacoes: cot.filter((c) => c.demanda_id === d.id).map(({ demanda_id: _, valor, ...c }) => ({ ...c, valor: Number(valor) })),
    }));
  });
}

export function enviarDuvida(uid: string, demandaId: string, pergunta: string) {
  if (pergunta.trim().length < 5) throw new ErroNegocio('Escreva sua dúvida');
  return sob(uid, (q, ctx) =>
    q('insert into public.duvidas_demanda (condominio_id, demanda_id, pergunta) values ($1, $2, $3)', [ctx.condominioId, demandaId, pergunta.trim()]),
  );
}

export function opcoesCessao(uid: string) {
  return sob(uid, async (q, ctx) => ({
    vagas: await q<{ id: string; numero: string; local: string; tipo: string }>(
      `select id, numero, coalesce(local, '') as local, coalesce(descricao, '') as tipo from public.vagas where unidade_id = $1 order by numero`,
      [ctx.unidadeId],
    ),
    unidadesDestino: await q<{ id: string; rotulo: string }>('select unidade_id as id, rotulo from public.unidades_destino($1)', [ctx.condominioId]),
    sugestao: { inicio: '', fim: '', placa: '' },
  }));
}

export function criarCessao(uid: string, corpo: unknown) {
  const v = cessaoVagaSchema.safeParse(corpo);
  if (!v.success) throw new ErroNegocio(v.error.issues[0]?.message ?? 'Dados inválidos', 400);
  const iso = (t: string) => parseDataBR(t)!.toISOString().slice(0, 10);
  return sob(uid, (q, ctx) =>
    q(
      `insert into public.cessoes_vaga (condominio_id, vaga_id, unidade_cedente_id, unidade_cessionaria_id, inicio, fim, placa, valor_mensal)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [ctx.condominioId, v.data.vagaId, ctx.unidadeId, v.data.unidadeCessionariaId, iso(v.data.inicio),
       v.data.semTermino || !v.data.fim ? null : iso(v.data.fim), v.data.placa, v.data.valorMensal ?? null],
    ),
  );
}

export function criarLocacao(uid: string, corpo: unknown, baseUrl: string) {
  const v = locacaoSchema.safeParse(corpo);
  if (!v.success) throw new ErroNegocio(v.error.issues[0]?.message ?? 'Dados inválidos', 400);
  const d = v.data;
  return sob(uid, async (q, ctx) => {
    const [r] =
      d.tipo === 'temporada'
        ? await q<{ r: { links: { token: string }[] } }>('select public.criar_locacao_temporada($1, $2, $3, $4, $5, $6, $7) as r', [
            ctx.unidadeId, d.responsavel, d.celular, d.checkin, d.checkout, d.hospedes, d.origem,
          ])
        : await q<{ r: { links: { token: string }[] } }>('select public.criar_locacao_aluguel($1, $2, $3, $4, $5, $6, $7, $8) as r', [
            ctx.unidadeId, d.nome, d.celular, parseDataBR(d.inicio)!.toISOString().slice(0, 10), parseDataBR(d.fim)!.toISOString().slice(0, 10),
            d.moradores, d.imobiliaria ?? null, d.contratoPath ?? null,
          ]);
    return { links: (r!.r.links ?? []).map((l) => `${baseUrl}/f/${l.token}`) };
  });
}

export function areas(uid: string) {
  return sob(uid, (q, ctx) => q<{ id: string; nome: string }>('select id, nome from public.areas_comuns where condominio_id = $1 order by nome', [ctx.condominioId]));
}

export function ocupacao(uid: string, areaId: string, de: Date, ate: Date) {
  return banco().comoUsuario(uid, (q) => q<{ inicio: Date; fim: Date }>('select * from public.ocupacao_area($1, $2, $3)', [areaId, de, ate]));
}

export function criarReserva(uid: string, corpo: unknown) {
  const v = reservaSchema.safeParse(corpo);
  if (!v.success) throw new ErroNegocio(v.error.issues[0]?.message ?? 'Dados inválidos', 400);
  return sob(uid, (q, ctx) =>
    q('insert into public.reservas (condominio_id, area_id, unidade_id, inicio, fim) values ($1, $2, $3, $4, $5)', [
      ctx.condominioId, v.data.areaId, ctx.unidadeId, v.data.inicio, v.data.fim,
    ]),
  );
}

export function assembleias(uid: string) {
  return sob(uid, async (q, ctx) => {
    const as = await q<{ id: string; titulo: string; data_hora: Date; status: string }>(
      `select id, titulo, data_hora, status from public.assembleias where condominio_id = $1 order by data_hora desc limit 10`,
      [ctx.condominioId],
    );
    const pautas = await q<{ id: string; assembleia_id: string; titulo: string; votacao_aberta: boolean; meu_voto: string | null; sim: string; nao: string; abstencao: string }>(
      `select p.id, p.assembleia_id, p.titulo, p.votacao_aberta,
              (select opcao from public.votos v where v.pauta_id = p.id and v.unidade_id = $1) as meu_voto,
              r.sim, r.nao, r.abstencao
         from public.pautas p left join public.vw_resultado_pautas r on r.pauta_id = p.id
        where p.condominio_id = $2`,
      [ctx.unidadeId, ctx.condominioId],
    );
    return as.map((a) => ({
      id: a.id, titulo: a.titulo, dataHora: a.data_hora, status: a.status,
      pautas: pautas.filter((p) => p.assembleia_id === a.id).map((p) => ({
        id: p.id, titulo: p.titulo, votacaoAberta: p.votacao_aberta, meuVoto: p.meu_voto,
        resultado: { sim: Number(p.sim ?? 0), nao: Number(p.nao ?? 0), abstencao: Number(p.abstencao ?? 0) },
      })),
    }));
  });
}

export function votar(uid: string, pautaId: string, opcao: string) {
  if (!['sim', 'nao', 'abstencao'].includes(opcao)) throw new ErroNegocio('Opção inválida', 400);
  return sob(uid, (q, ctx) =>
    q('insert into public.votos (condominio_id, pauta_id, unidade_id, opcao) values ($1, $2, $3, $4)', [ctx.condominioId, pautaId, ctx.unidadeId, opcao]),
  );
}

export function encomendas(uid: string) {
  return sob(uid, (q, ctx) =>
    q<{ id: string; descricao: string; recebidaEm: Date; retiradaEm: Date | null }>(
      `select id, descricao, recebida_em as "recebidaEm", retirada_em as "retiradaEm" from public.encomendas
        where unidade_id = $1 order by recebida_em desc limit 30`,
      [ctx.unidadeId],
    ),
  );
}

export function ocorrencias(uid: string) {
  return banco().comoUsuario(uid, (q) =>
    q<{ id: string; titulo: string; status: string; criadaEm: Date }>(
      `select id, titulo, status, created_at as "criadaEm" from public.ocorrencias where created_by = $1 order by created_at desc limit 30`,
      [uid],
    ),
  );
}

export function criarOcorrencia(uid: string, corpo: unknown) {
  const v = ocorrenciaSchema.safeParse(corpo);
  if (!v.success) throw new ErroNegocio(v.error.issues[0]?.message ?? 'Dados inválidos', 400);
  return sob(uid, (q, ctx) =>
    q('insert into public.ocorrencias (condominio_id, unidade_id, titulo, descricao) values ($1, $2, $3, $4)', [
      ctx.condominioId, ctx.unidadeId, v.data.titulo, v.data.descricao ?? null,
    ]),
  );
}

export function exportar(uid: string) {
  return banco().comoUsuario(uid, async (q) => (await q<{ d: unknown }>('select public.exportar_meus_dados() as d'))[0]?.d);
}

export function revogarFacial(uid: string) {
  return banco().comoUsuario(uid, (q) =>
    q(
      `select public.revogar_consentimento(c.id) from public.consentimentos c
        where c.finalidade = 'biometria_acesso' and c.revogado_em is null and c.pessoa_id in (select id from public.pessoas where user_id = $1)`,
      [uid],
    ),
  );
}

export function pedidoTitular(uid: string, tipo: string) {
  if (!(TIPOS_PEDIDO_TITULAR as readonly string[]).includes(tipo)) throw new ErroNegocio('Tipo inválido', 400);
  return sob(uid, (q, ctx) =>
    q('insert into public.pedidos_titular (condominio_id, pessoa_id, user_id, tipo) values ($1, $2, $3, $4)', [ctx.condominioId, ctx.pessoaId, uid, tipo]),
  );
}

export function registrarPush(uid: string, token: string, plataforma: string) {
  if (!/^ExponentPushToken\[[\w-]+\]$/.test(token) || !['ios', 'android', 'web'].includes(plataforma)) throw new ErroNegocio('Token inválido', 400);
  return banco().comoUsuario(uid, (q) =>
    q(
      `insert into public.dispositivos_push (user_id, token, plataforma) values ($1, $2, $3)
       on conflict (token) do update set user_id = excluded.user_id, plataforma = excluded.plataforma, updated_at = now()`,
      [uid, token, plataforma],
    ),
  );
}
