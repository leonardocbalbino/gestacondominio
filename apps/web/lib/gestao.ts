import 'server-only';
import { banco, MODO_DEMO } from './db';
import { demoGestao } from './demo-gestao';

/*
 * Leituras da área do síndico/conselho. Fora do modo demonstração rodam como o usuário
 * logado (comoUsuario): o RLS decide o que cada papel enxerga (conselho não vê CPF, etc.).
 */

export type StatusLocacao = 'aguardando_sindico' | 'aprovada' | 'recusada' | 'cancelada' | 'encerrada';

export interface Locacao {
  id: string;
  tipo: 'temporada' | 'aluguel';
  unidade: string;
  responsavel: string | null;
  inicio: Date;
  fim: Date;
  qtdPessoas: number;
  origem: string | null;
  imobiliaria: string | null;
  status: StatusLocacao;
  temContrato: boolean;
  hospedes: number;
  motivo: string | null;
  decididoEm: Date | null;
}

export interface Hospede {
  nome: string;
  cpf: string | null;
  celular: string | null;
  facial: boolean;
}

export const CATEGORIAS_CONTRATO = {
  manutencao: 'Manutenção',
  limpeza: 'Limpeza',
  seguranca: 'Segurança/portaria',
  elevadores: 'Elevadores',
  jardinagem: 'Jardinagem',
  seguro: 'Seguro',
  administradora: 'Administradora',
  agua_gas_energia: 'Água, gás e energia',
  obras: 'Obras',
  outros: 'Outros',
} as const;
export type CategoriaContrato = keyof typeof CATEGORIAS_CONTRATO;

export const PERIODICIDADES = { mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual', unico: 'Pagamento único' } as const;
export type Periodicidade = keyof typeof PERIODICIDADES;

export interface Contrato {
  id: string;
  fornecedor: string;
  cnpj: string | null;
  contato: string | null;
  categoria: CategoriaContrato;
  objeto: string;
  valor: number | null;
  periodicidade: Periodicidade;
  inicio: Date;
  fim: Date | null;
  renovacaoAutomatica: boolean;
  avisoDias: number;
  status: 'ativo' | 'encerrado';
  encerradoEm: Date | null;
  temDocumento: boolean;
  observacoes: string | null;
}

/** Situação calculada da vigência, para alertas. */
export function situacaoContrato(c: Contrato, hoje = new Date()): { tom: 'ok' | 'warn' | 'bad' | 'neu'; rotulo: string; dias: number | null } {
  if (c.status === 'encerrado') return { tom: 'neu', rotulo: 'Encerrado', dias: null };
  if (!c.fim) return { tom: 'ok', rotulo: 'Prazo indeterminado', dias: null };
  const dias = Math.ceil((c.fim.getTime() - hoje.getTime()) / 86_400_000);
  if (dias < 0) return { tom: 'bad', rotulo: c.renovacaoAutomatica ? 'Renovar (venceu)' : 'Vencido', dias };
  if (dias <= c.avisoDias) return { tom: 'warn', rotulo: dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia(s)`, dias };
  return { tom: 'ok', rotulo: 'Vigente', dias };
}

/** Valor mensal equivalente (para o total do orçamento). */
export function valorMensal(c: Pick<Contrato, 'valor' | 'periodicidade' | 'status'>): number {
  if (c.status !== 'ativo' || c.valor == null) return 0;
  return c.periodicidade === 'mensal' ? c.valor : c.periodicidade === 'trimestral' ? c.valor / 3 : c.periodicidade === 'anual' ? c.valor / 12 : 0;
}

export interface Morador {
  nome: string;
  tipo: string;
  responsavel: boolean;
  temConta: boolean;
  facial: boolean;
}
export interface Unidade {
  id: string;
  codigo: string;
  bloco: string | null;
  moradores: Morador[];
  convitesPendentes: { nome: string; email: string; tipo: string }[];
}

export interface Ocorrencia {
  id: string;
  titulo: string;
  descricao: string | null;
  unidade: string | null;
  status: 'aberta' | 'em_andamento' | 'resolvida';
  criadaEm: Date;
  resposta: string | null;
}

export interface Comunicado {
  id: string;
  titulo: string;
  corpo: string;
  publicadoEm: Date;
}

export interface Decisao {
  tipo: 'locacao' | 'cessao' | 'reserva';
  titulo: string;
  unidade: string;
  status: string;
  quando: Date;
  motivo: string | null;
}

export interface ReservaProxima {
  area: string;
  unidade: string;
  inicio: Date;
  fim: Date;
  status: string;
}

// ---------------------------------------------------------------------------

const num = (v: unknown) => (v == null ? null : Number(v));

export async function listarLocacoes(uid: string, cid: string): Promise<Locacao[]> {
  if (MODO_DEMO) return demoGestao().locacoes;
  const r = await banco().comoUsuario(uid, (q) =>
    q<{
      id: string; tipo: Locacao['tipo']; unidade: string; responsavel: string | null; inicio: Date; fim: Date; qtd_pessoas: number;
      origem: string | null; imobiliaria: string | null; status: StatusLocacao; tem_contrato: boolean; hospedes: string;
      motivo_decisao: string | null; decidido_em: Date | null;
    }>(
      `select l.id, l.tipo, u.codigo as unidade, p.nome as responsavel, l.inicio, l.fim, l.qtd_pessoas, l.origem, l.imobiliaria,
              l.status, l.contrato_path is not null as tem_contrato,
              (select count(*) from public.hospedes h where h.locacao_id = l.id) as hospedes, l.motivo_decisao, l.decidido_em
         from public.locacoes l join public.unidades u on u.id = l.unidade_id
         left join public.pessoas p on p.id = l.responsavel_pessoa_id
        where l.condominio_id = $1
        order by case l.status when 'aguardando_sindico' then 0 when 'aprovada' then 1 else 2 end, l.inicio desc
        limit 500`,
      [cid],
    ),
  );
  return r.map((l) => ({
    id: l.id, tipo: l.tipo, unidade: l.unidade, responsavel: l.responsavel, inicio: l.inicio, fim: l.fim, qtdPessoas: l.qtd_pessoas,
    origem: l.origem, imobiliaria: l.imobiliaria, status: l.status, temContrato: l.tem_contrato, hospedes: Number(l.hospedes),
    motivo: l.motivo_decisao, decididoEm: l.decidido_em,
  }));
}

export async function detalheLocacao(uid: string, cid: string, id: string): Promise<{ locacao: Locacao; hospedes: Hospede[] } | null> {
  if (MODO_DEMO) {
    const l = demoGestao().locacoes.find((x) => x.id === id);
    return l ? { locacao: l, hospedes: demoGestao().hospedes[id] ?? [] } : null;
  }
  const todas = await listarLocacoes(uid, cid);
  const locacao = todas.find((l) => l.id === id);
  if (!locacao) return null;
  const hospedes = await banco().comoUsuario(uid, (q) =>
    q<{ nome: string; cpf_mascarado: string | null; celular_mascarado: string | null; facial: boolean }>(
      `select p.nome, p.cpf_mascarado, p.celular_mascarado,
              exists (select 1 from public.biometrias b where b.pessoa_id = p.id) as facial
         from public.hospedes h join public.pessoas p on p.id = h.pessoa_id
        where h.locacao_id = $1 order by p.nome`,
      [id],
    ),
  );
  return { locacao, hospedes: hospedes.map((h) => ({ nome: h.nome, cpf: h.cpf_mascarado, celular: h.celular_mascarado, facial: h.facial })) };
}

type LinhaContrato = {
  id: string; fornecedor: string; cnpj_fornecedor: string | null; contato_fornecedor: string | null; categoria: CategoriaContrato;
  objeto: string; valor: string | null; periodicidade: Periodicidade; inicio: Date; fim: Date | null; renovacao_automatica: boolean;
  aviso_dias: number; status: Contrato['status']; encerrado_em: Date | null; tem_documento: boolean; observacoes: string | null;
};
const SQL_CONTRATO = `select id, fornecedor, cnpj_fornecedor, contato_fornecedor, categoria, objeto, valor, periodicidade,
  inicio::timestamptz as inicio, fim::timestamptz as fim, renovacao_automatica, aviso_dias, status, encerrado_em::timestamptz as encerrado_em,
  documento_path is not null as tem_documento, observacoes from public.contratos`;
const mapContrato = (c: LinhaContrato): Contrato => ({
  id: c.id, fornecedor: c.fornecedor, cnpj: c.cnpj_fornecedor, contato: c.contato_fornecedor, categoria: c.categoria, objeto: c.objeto,
  valor: num(c.valor), periodicidade: c.periodicidade, inicio: c.inicio, fim: c.fim, renovacaoAutomatica: c.renovacao_automatica,
  avisoDias: c.aviso_dias, status: c.status, encerradoEm: c.encerrado_em, temDocumento: c.tem_documento, observacoes: c.observacoes,
});

export async function listarContratos(uid: string, cid: string): Promise<Contrato[]> {
  if (MODO_DEMO) return demoGestao().contratos;
  const r = await banco().comoUsuario(uid, (q) =>
    q<LinhaContrato>(`${SQL_CONTRATO} where condominio_id = $1 order by status, fim nulls last, fornecedor`, [cid]),
  );
  return r.map(mapContrato);
}

export async function obterContrato(uid: string, cid: string, id: string): Promise<Contrato | null> {
  if (MODO_DEMO) return demoGestao().contratos.find((c) => c.id === id) ?? null;
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [c] = await banco().comoUsuario(uid, (q) => q<LinhaContrato>(`${SQL_CONTRATO} where condominio_id = $1 and id = $2`, [cid, id]));
  return c ? mapContrato(c) : null;
}

const ROT_VINCULO: Record<string, string> = {
  proprietario: 'Proprietário', inquilino: 'Inquilino', residente: 'Residente', locatario_temporada: 'Temporada', hospede: 'Hóspede',
};

export async function listarUnidades(uid: string, cid: string): Promise<Unidade[]> {
  if (MODO_DEMO) return demoGestao().unidades;
  return banco().comoUsuario(uid, async (q) => {
    const us = await q<{ id: string; codigo: string; bloco: string | null }>(
      `select u.id, u.codigo, b.nome as bloco from public.unidades u left join public.blocos b on b.id = u.bloco_id
        where u.condominio_id = $1 order by b.nome nulls first, u.codigo`,
      [cid],
    );
    const ps = await q<{ unidade_id: string; nome: string; tipo: string; responsavel: boolean; tem_conta: boolean; facial: boolean }>(
      `select v.unidade_id, p.nome, v.tipo::text as tipo, v.responsavel, p.user_id is not null as tem_conta,
              exists (select 1 from public.biometrias b where b.pessoa_id = p.id) as facial
         from public.vinculos v join public.pessoas p on p.id = v.pessoa_id
        where v.condominio_id = $1 and v.inicio <= now() and (v.fim is null or v.fim > now())
        order by v.responsavel desc, p.nome`,
      [cid],
    );
    const cs = await q<{ unidade_id: string; nome: string; email: string; tipo: string }>(
      `select unidade_id, nome, email, tipo_vinculo::text as tipo from public.convites
        where condominio_id = $1 and unidade_id is not null and aceito_em is null and expira_em > now()`,
      [cid],
    );
    return us.map((u) => ({
      id: u.id, codigo: u.codigo, bloco: u.bloco,
      moradores: ps.filter((p) => p.unidade_id === u.id).map((p) => ({
        nome: p.nome, tipo: ROT_VINCULO[p.tipo] ?? p.tipo, responsavel: p.responsavel, temConta: p.tem_conta, facial: p.facial,
      })),
      convitesPendentes: cs.filter((c) => c.unidade_id === u.id).map((c) => ({ nome: c.nome, email: c.email, tipo: ROT_VINCULO[c.tipo] ?? c.tipo })),
    }));
  });
}

export async function listarOcorrencias(uid: string, cid: string): Promise<Ocorrencia[]> {
  if (MODO_DEMO) return demoGestao().ocorrencias;
  const r = await banco().comoUsuario(uid, (q) =>
    q<{ id: string; titulo: string; descricao: string | null; codigo: string | null; status: Ocorrencia['status']; created_at: Date; resposta: string | null }>(
      `select o.id, o.titulo, o.descricao, u.codigo, o.status, o.created_at, o.resposta
         from public.ocorrencias o left join public.unidades u on u.id = o.unidade_id
        where o.condominio_id = $1
        order by case o.status when 'aberta' then 0 when 'em_andamento' then 1 else 2 end, o.created_at desc limit 200`,
      [cid],
    ),
  );
  return r.map((o) => ({ id: o.id, titulo: o.titulo, descricao: o.descricao, unidade: o.codigo, status: o.status, criadaEm: o.created_at, resposta: o.resposta }));
}

export async function listarComunicados(uid: string, cid: string): Promise<Comunicado[]> {
  if (MODO_DEMO) return demoGestao().comunicados;
  const r = await banco().comoUsuario(uid, (q) =>
    q<{ id: string; titulo: string; corpo: string; publicado_em: Date }>(
      'select id, titulo, corpo, publicado_em from public.comunicados where condominio_id = $1 order by publicado_em desc limit 100',
      [cid],
    ),
  );
  return r.map((c) => ({ id: c.id, titulo: c.titulo, corpo: c.corpo, publicadoEm: c.publicado_em }));
}

/** Decisões dos últimos 60 dias (histórico da tela de aprovações). */
export async function historicoDecisoes(uid: string, cid: string): Promise<Decisao[]> {
  if (MODO_DEMO) return demoGestao().decisoes;
  return banco().comoUsuario(uid, (q) =>
    q<Decisao>(
      `select 'locacao' as tipo, case when l.tipo = 'temporada' then 'Temporada · ' else 'Aluguel · ' end || coalesce(p.nome, '') as titulo,
              u.codigo as unidade, l.status, coalesce(l.decidido_em, l.updated_at) as quando, l.motivo_decisao as motivo
         from public.locacoes l join public.unidades u on u.id = l.unidade_id left join public.pessoas p on p.id = l.responsavel_pessoa_id
        where l.condominio_id = $1 and l.status <> 'aguardando_sindico' and coalesce(l.decidido_em, l.updated_at) > now() - interval '60 days'
       union all
       select 'cessao', 'Vaga ' || g.numero || ' · ' || uc.codigo || ' → ' || us.codigo, uc.codigo, c.status,
              coalesce(c.decidido_em, c.updated_at), c.motivo_decisao
         from public.cessoes_vaga c join public.vagas g on g.id = c.vaga_id
         join public.unidades uc on uc.id = c.unidade_cedente_id join public.unidades us on us.id = c.unidade_cessionaria_id
        where c.condominio_id = $1 and c.status not in ('aguardando_sindico','aguardando_cessionario') and c.updated_at > now() - interval '60 days'
       union all
       select 'reserva', a.nome, u.codigo, r.status, r.updated_at, null
         from public.reservas r join public.areas_comuns a on a.id = r.area_id join public.unidades u on u.id = r.unidade_id
        where r.condominio_id = $1 and r.status <> 'aguardando_sindico' and r.updated_at > now() - interval '60 days'
       order by quando desc limit 50`,
      [cid],
    ),
  );
}

export async function reservasProximas(uid: string, cid: string): Promise<ReservaProxima[]> {
  if (MODO_DEMO) return demoGestao().reservas;
  return banco().comoUsuario(uid, (q) =>
    q<ReservaProxima>(
      `select a.nome as area, u.codigo as unidade, r.inicio, r.fim, r.status
         from public.reservas r join public.areas_comuns a on a.id = r.area_id join public.unidades u on u.id = r.unidade_id
        where r.condominio_id = $1 and r.fim > now() and r.status in ('confirmada','aguardando_sindico')
        order by r.inicio limit 8`,
      [cid],
    ),
  );
}

export const STATUS_LOCACAO: Record<Locacao['status'], { rotulo: string; tom: 'ok' | 'warn' | 'bad' | 'neu' | 'info' }> = {
  aguardando_sindico: { rotulo: 'Aguardando você', tom: 'warn' },
  aprovada: { rotulo: 'Aprovada', tom: 'ok' },
  recusada: { rotulo: 'Recusada', tom: 'bad' },
  cancelada: { rotulo: 'Cancelada', tom: 'neu' },
  encerrada: { rotulo: 'Encerrada', tom: 'neu' },
};

/** Situação no tempo (para aprovadas): em curso, futura ou terminada. */
export function fase(l: Locacao, agora = Date.now()): 'ativa' | 'futura' | 'passada' | 'pendente' | 'fechada' {
  if (l.status === 'aguardando_sindico') return 'pendente';
  if (l.status !== 'aprovada') return 'fechada';
  if (l.fim.getTime() <= agora) return 'passada';
  return l.inicio.getTime() <= agora ? 'ativa' : 'futura';
}
