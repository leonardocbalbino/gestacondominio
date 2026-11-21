import 'server-only';
import { contagemAnonima } from '@gc/core';
import { banco, MODO_DEMO } from './db';
import { demo, type PedidoAprovacao, type PedidoSuporte } from './demo-store';

/*
 * Leituras do painel. Fora do modo demonstração, TODAS rodam como o usuário logado
 * (banco().comoUsuario) — o RLS decide o que cada um enxerga.
 */

export interface MetricaCondominio {
  condominio_id: string;
  nome: string;
  cidade: string;
  uf: string;
  plano: string | null;
  status: string;
  unidades: string;
  moradores_ativos: string;
  pedidos_30d: string;
  biometrias_ativas: string;
  hospedes_mes: string;
}

/** Visão do dono: só agregados, já com supressão "< 3" aplicada no banco. */
export async function metricasDono(uid: string): Promise<MetricaCondominio[]> {
  if (MODO_DEMO) {
    return demo().condominios.map((c) => ({
      ...c,
      unidades: contagemAnonima(c.unidades),
      moradores_ativos: contagemAnonima(c.moradores_ativos),
      pedidos_30d: contagemAnonima(c.pedidos_30d),
      biometrias_ativas: contagemAnonima(c.biometrias_ativas),
      hospedes_mes: contagemAnonima(c.hospedes_mes),
    }));
  }
  return banco().comoUsuario(uid, (q) => q<MetricaCondominio>('select * from public.metricas_dono()'));
}

export async function planos(uid: string): Promise<{ id: string; nome: string; max_unidades: number; preco_mensal: number }[]> {
  if (MODO_DEMO) {
    return [
      { id: 'f0000000-0000-4000-8000-000000000001', nome: 'Essencial', max_unidades: 60, preco_mensal: 189 },
      { id: 'f0000000-0000-4000-8000-000000000002', nome: 'Profissional', max_unidades: 200, preco_mensal: 389 },
      { id: 'f0000000-0000-4000-8000-000000000003', nome: 'Corporativo', max_unidades: 2000, preco_mensal: 990 },
    ];
  }
  const r = await banco().comoUsuario(uid, (q) =>
    q<{ id: string; nome: string; max_unidades: number; preco_mensal: string }>(
      'select id, nome, max_unidades, preco_mensal from public.planos where ativo order by preco_mensal',
    ),
  );
  return r.map((p) => ({ ...p, preco_mensal: Number(p.preco_mensal) }));
}

export async function pedidosSuporte(uid: string, condominioId?: string): Promise<PedidoSuporte[]> {
  if (MODO_DEMO) return demo().suporte.filter((s) => !condominioId || s.condominioId === condominioId);
  const r = await banco().comoUsuario(uid, (q) =>
    q<{ id: string; condominio_id: string; motivo: string; duracao_horas: 1 | 4 | 24; status: PedidoSuporte['status']; expira_em: Date | null; created_at: Date }>(
      `select id, condominio_id, motivo, duracao_horas, status, expira_em, created_at
         from public.acessos_suporte where ($1::uuid is null or condominio_id = $1) order by created_at desc limit 50`,
      [condominioId ?? null],
    ),
  );
  return r.map((s) => ({
    id: s.id, condominioId: s.condominio_id, condominio: '', motivo: s.motivo, duracaoHoras: s.duracao_horas,
    status: s.status, expiraEm: s.expira_em, criadoEm: s.created_at,
  }));
}

export async function aprovacoesPendentes(uid: string, condominioId: string): Promise<PedidoAprovacao[]> {
  if (MODO_DEMO) return demo().aprovacoes.filter((a) => a.status === 'aguardando_sindico');
  return banco().comoUsuario(uid, (q) =>
    q<PedidoAprovacao>(
      `select l.id, 'locacao' as tipo,
              case when l.tipo = 'temporada' then 'Locatário(a) temporada · ' else 'Locatário(a) · ' end || coalesce(p.nome, '') as titulo,
              u.codigo as unidade,
              concat_ws(' · ', case when l.tipo = 'temporada' then 'Temporada' else 'Aluguel' end, l.origem, l.qtd_pessoas || ' pessoa(s)') as detalhe,
              l.inicio, l.fim, l.status
         from public.locacoes l join public.unidades u on u.id = l.unidade_id
         left join public.pessoas p on p.id = l.responsavel_pessoa_id
        where l.condominio_id = $1 and l.status = 'aguardando_sindico'
       union all
       select c.id, 'cessao', 'Cessão da vaga ' || g.numero || ' · ' || uc.codigo || ' → ' || us.codigo, uc.codigo,
              'Placa ' || c.placa, c.inicio::timestamptz, c.fim::timestamptz, c.status
         from public.cessoes_vaga c join public.vagas g on g.id = c.vaga_id
         join public.unidades uc on uc.id = c.unidade_cedente_id join public.unidades us on us.id = c.unidade_cessionaria_id
        where c.condominio_id = $1 and c.status = 'aguardando_sindico'
       union all
       select r.id, 'reserva', a.nome, u.codigo, 'Reserva de área comum', r.inicio, r.fim, r.status
         from public.reservas r join public.areas_comuns a on a.id = r.area_id join public.unidades u on u.id = r.unidade_id
        where r.condominio_id = $1 and r.status = 'aguardando_sindico'
       order by inicio`,
      [condominioId],
    ),
  );
}

const ROT_VINCULO: Record<string, string> = {
  proprietario: 'Proprietário', inquilino: 'Inquilino', residente: 'Residente', locatario_temporada: 'Temporada', hospede: 'Hóspede',
};

export async function dadosPortaria(uid: string, condominioId: string) {
  if (MODO_DEMO) return demo().portaria;
  return banco().comoUsuario(uid, async (q) => {
    const pessoas = await q<{ nome: string; cpf_mascarado: string | null; unidade: string; vinculo: string; tem_facial: boolean }>(
      'select nome, cpf_mascarado, unidade, vinculo, tem_facial from public.vw_portaria_pessoas where condominio_id = $1 order by unidade, nome',
      [condominioId],
    );
    const vagas = await q<{ vaga: string; local: string | null; unidade_que_usa: string; placa: string; fim: Date | null }>(
      'select vaga, local, unidade_que_usa, placa, fim from public.vw_portaria_vagas where condominio_id = $1',
      [condominioId],
    );
    const registros = await q<{ ocorrido_em: Date; tipo: string; meio: string; codigo: string | null }>(
      `select r.ocorrido_em, r.tipo, r.meio, u.codigo from public.registros_acesso r
         left join public.unidades u on u.id = r.unidade_id
        where r.condominio_id = $1 order by r.ocorrido_em desc limit 20`,
      [condominioId],
    );
    return {
      pessoas: pessoas.map((x) => ({ nome: x.nome, cpf: x.cpf_mascarado ?? '***.***.***-**', unidade: x.unidade, vinculo: ROT_VINCULO[x.vinculo] ?? x.vinculo, facial: x.tem_facial })),
      vagas: vagas.map((x) => ({ vaga: x.vaga, local: x.local ?? '', unidade: x.unidade_que_usa, placa: x.placa, fim: x.fim })),
      registros: registros.map((x) => ({ quando: x.ocorrido_em, tipo: x.tipo, meio: x.meio, unidade: x.codigo ?? '—' })),
    };
  });
}

export interface InfoLinkFacial {
  condominio: string;
  sigla: string;
  primeiroNome: string;
  unidade: string;
  expiraEm: Date;
  valido: boolean;
  versaoTermo: string;
}

/** Link facial é público (anon): o banco só devolve o mínimo, protegido pelo token. */
export async function infoLinkFacial(token: string): Promise<InfoLinkFacial | null> {
  if (MODO_DEMO) {
    const l = demo().links.get(token);
    if (!l) return null;
    return {
      condominio: l.condominio.nome, sigla: l.condominio.sigla, primeiroNome: l.primeiroNome, unidade: l.unidade,
      expiraEm: l.expiraEm, valido: !l.usado && l.expiraEm.getTime() > Date.now(), versaoTermo: 'biometria-v1',
    };
  }
  const [r] = await banco().comoAnon((q) =>
    q<{ condominio: string; sigla: string; primeiro_nome: string; unidade: string; expira_em: Date; valido: boolean; versao_termo: string }>(
      'select * from public.link_facial_info($1)',
      [token],
    ),
  );
  if (!r) return null;
  return {
    condominio: r.condominio, sigla: r.sigla, primeiroNome: r.primeiro_nome, unidade: r.unidade,
    expiraEm: r.expira_em, valido: r.valido, versaoTermo: r.versao_termo,
  };
}
