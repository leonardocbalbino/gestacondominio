import 'server-only';
import { contagemAnonima } from '@gc/core';
import { demo, type PedidoAprovacao, type PedidoSuporte } from './demo-store';
import { MODO_DEMO, supabaseServidor } from './supabase/server';

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
export async function metricasDono(): Promise<MetricaCondominio[]> {
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
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc('metricas_dono');
  if (error) throw new Error(error.message);
  return data as MetricaCondominio[];
}

export async function planos(): Promise<{ id: string; nome: string; max_unidades: number; preco_mensal: number }[]> {
  if (MODO_DEMO) {
    return [
      { id: 'f0000000-0000-4000-8000-000000000001', nome: 'Essencial', max_unidades: 60, preco_mensal: 189 },
      { id: 'f0000000-0000-4000-8000-000000000002', nome: 'Profissional', max_unidades: 200, preco_mensal: 389 },
      { id: 'f0000000-0000-4000-8000-000000000003', nome: 'Corporativo', max_unidades: 2000, preco_mensal: 990 },
    ];
  }
  const sb = await supabaseServidor();
  const { data } = await sb.from('planos').select('id, nome, max_unidades, preco_mensal').eq('ativo', true).order('preco_mensal');
  return data ?? [];
}

export async function pedidosSuporte(condominioId?: string): Promise<PedidoSuporte[]> {
  if (MODO_DEMO) {
    return demo().suporte.filter((s) => !condominioId || s.condominioId === condominioId);
  }
  const sb = await supabaseServidor();
  let q = sb.from('acessos_suporte').select('id, condominio_id, motivo, duracao_horas, status, expira_em, created_at').order('created_at', { ascending: false });
  if (condominioId) q = q.eq('condominio_id', condominioId);
  const { data } = await q;
  return (data ?? []).map((s) => ({
    id: s.id,
    condominioId: s.condominio_id,
    condominio: '',
    motivo: s.motivo,
    duracaoHoras: s.duracao_horas,
    status: s.status,
    expiraEm: s.expira_em ? new Date(s.expira_em) : null,
    criadoEm: new Date(s.created_at),
  }));
}

export async function aprovacoesPendentes(condominioId: string): Promise<PedidoAprovacao[]> {
  if (MODO_DEMO) return demo().aprovacoes.filter((a) => a.status === 'aguardando_sindico');
  const sb = await supabaseServidor();
  const [loc, ces, res] = await Promise.all([
    sb.from('locacoes').select('id, tipo, inicio, fim, origem, qtd_pessoas, status, unidades(codigo), pessoas:responsavel_pessoa_id(nome)')
      .eq('condominio_id', condominioId).eq('status', 'aguardando_sindico'),
    sb.from('cessoes_vaga').select('id, inicio, fim, placa, status, vagas(numero), cedente:unidade_cedente_id(codigo), cessionaria:unidade_cessionaria_id(codigo)')
      .eq('condominio_id', condominioId).eq('status', 'aguardando_sindico'),
    sb.from('reservas').select('id, inicio, fim, status, areas_comuns(nome), unidades(codigo)')
      .eq('condominio_id', condominioId).eq('status', 'aguardando_sindico'),
  ]);
  type R = Record<string, unknown> & { id: string; inicio: string; fim: string | null; status: string };
  const nome = (x: unknown, k: string) => ((x as Record<string, string> | null)?.[k] ?? '');
  return [
    ...((loc.data ?? []) as R[]).map((l) => ({
      id: l.id, tipo: 'locacao' as const,
      titulo: `${l.tipo === 'temporada' ? 'Locatário(a) temporada' : 'Locatário(a)'} · ${nome(l.pessoas, 'nome')}`,
      unidade: nome(l.unidades, 'codigo'),
      detalhe: [l.tipo === 'temporada' ? 'Temporada' : 'Aluguel', l.origem, `${l.qtd_pessoas} pessoa(s)`].filter(Boolean).join(' · '),
      inicio: new Date(l.inicio), fim: l.fim ? new Date(l.fim) : null, status: l.status,
    })),
    ...((ces.data ?? []) as R[]).map((c) => ({
      id: c.id, tipo: 'cessao' as const,
      titulo: `Cessão da vaga ${nome(c.vagas, 'numero')} · ${nome(c.cedente, 'codigo')} → ${nome(c.cessionaria, 'codigo')}`,
      unidade: nome(c.cedente, 'codigo'), detalhe: `Placa ${String(c.placa)}`,
      inicio: new Date(`${c.inicio}T00:00:00-03:00`), fim: c.fim ? new Date(`${c.fim}T00:00:00-03:00`) : null, status: c.status,
    })),
    ...((res.data ?? []) as R[]).map((r) => ({
      id: r.id, tipo: 'reserva' as const, titulo: nome(r.areas_comuns, 'nome'), unidade: nome(r.unidades, 'codigo'),
      detalhe: 'Reserva de área comum', inicio: new Date(r.inicio), fim: r.fim ? new Date(r.fim) : null, status: r.status,
    })),
  ];
}

export async function dadosPortaria(condominioId: string) {
  if (MODO_DEMO) return demo().portaria;
  const sb = await supabaseServidor();
  const [p, v, r] = await Promise.all([
    sb.from('vw_portaria_pessoas').select('nome, cpf_mascarado, unidade, vinculo, tem_facial').eq('condominio_id', condominioId).order('unidade'),
    sb.from('vw_portaria_vagas').select('vaga, local, unidade_que_usa, placa, fim').eq('condominio_id', condominioId),
    sb.from('registros_acesso').select('ocorrido_em, tipo, meio, unidades(codigo)').eq('condominio_id', condominioId)
      .order('ocorrido_em', { ascending: false }).limit(20),
  ]);
  const ROT: Record<string, string> = { proprietario: 'Proprietário', inquilino: 'Inquilino', residente: 'Residente', locatario_temporada: 'Temporada', hospede: 'Hóspede' };
  return {
    pessoas: (p.data ?? []).map((x) => ({ nome: x.nome, cpf: x.cpf_mascarado ?? '***.***.***-**', unidade: x.unidade, vinculo: ROT[x.vinculo] ?? x.vinculo, facial: x.tem_facial })),
    vagas: (v.data ?? []).map((x) => ({ vaga: x.vaga, local: x.local, unidade: x.unidade_que_usa, placa: x.placa, fim: x.fim ? new Date(x.fim) : null })),
    registros: (r.data ?? []).map((x) => ({
      quando: new Date(x.ocorrido_em), tipo: x.tipo, meio: x.meio,
      unidade: (x.unidades as unknown as { codigo: string } | null)?.codigo ?? '—',
    })),
  };
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

export async function infoLinkFacial(token: string): Promise<InfoLinkFacial | null> {
  if (MODO_DEMO) {
    const l = demo().links.get(token);
    if (!l) return null;
    return {
      condominio: l.condominio.nome, sigla: l.condominio.sigla, primeiroNome: l.primeiroNome, unidade: l.unidade,
      expiraEm: l.expiraEm, valido: !l.usado && l.expiraEm.getTime() > Date.now(), versaoTermo: 'biometria-v1',
    };
  }
  const sb = await supabaseServidor();
  const { data } = await sb.rpc('link_facial_info', { p_token: token });
  const r = (data as Record<string, unknown>[] | null)?.[0];
  if (!r) return null;
  return {
    condominio: String(r.condominio), sigla: String(r.sigla), primeiroNome: String(r.primeiro_nome), unidade: String(r.unidade),
    expiraEm: new Date(String(r.expira_em)), valido: Boolean(r.valido), versaoTermo: String(r.versao_termo),
  };
}
