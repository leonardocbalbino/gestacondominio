/**
 * Acesso a dados do app do morador. Com Supabase configurado, tudo passa pelo RLS
 * (o morador só enxerga a própria unidade); sem ele, usa os dados fictícios do seed.
 */
import { parseDataBR, type CessaoVagaInput, type EtapaDemanda } from '@gc/core';
import { demoCederVaga, demoDemandas, demoMoradorInicio, type DemandaDemo } from '@gc/core/demo';
import { MODO_DEMO, supabase } from './supabase';

export type Inicio = typeof demoMoradorInicio;

const atraso = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

export async function carregarInicio(): Promise<Inicio> {
  if (MODO_DEMO || !supabase) return atraso(demoMoradorInicio);
  const sb = supabase;
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  const { data: pessoa } = await sb.from('pessoas').select('id, nome, condominio_id, condominios(nome, sigla)').eq('user_id', uid!).single();
  const { data: vinc } = await sb.from('vinculos').select('tipo, unidade_id, unidades(codigo)').eq('pessoa_id', pessoa!.id).is('fim', null).limit(1).single();
  const unidadeId = vinc!.unidade_id as string;
  const [moradores, bios, vaga, locs, reservas, demandas, notif] = await Promise.all([
    sb.from('vinculos').select('pessoa_id', { count: 'exact', head: true }).eq('unidade_id', unidadeId).in('tipo', ['proprietario', 'inquilino', 'residente']),
    sb.from('biometrias').select('id', { count: 'exact', head: true }),
    sb.from('vagas').select('numero').eq('unidade_id', unidadeId).limit(1).maybeSingle(),
    sb.from('locacoes').select('id, tipo, inicio, fim, status, pessoas:responsavel_pessoa_id(nome)').eq('unidade_id', unidadeId).order('inicio', { ascending: false }).limit(5),
    sb.from('reservas').select('id, inicio, fim, status, areas_comuns(nome)').eq('unidade_id', unidadeId).gte('fim', new Date().toISOString()).limit(5),
    listarDemandas(),
    sb.from('notificacoes').select('id', { count: 'exact', head: true }).is('lida_em', null),
  ]);
  const cond = pessoa!.condominios as unknown as { nome: string; sigla: string };
  const ROT: Record<string, string> = { proprietario: 'Proprietário', inquilino: 'Inquilino', residente: 'Residente' };
  void demandas;
  return {
    condominio: { id: pessoa!.condominio_id, nome: cond.nome, sigla: cond.sigla } as Inicio['condominio'],
    usuario: { primeiroNome: String(pessoa!.nome).split(' ')[0]!, notificacoesNaoLidas: notif.count ?? 0 },
    unidade: { id: unidadeId, codigo: (vinc!.unidades as unknown as { codigo: string }).codigo, vinculo: ROT[vinc!.tipo] ?? vinc!.tipo } as Inicio['unidade'],
    resumo: {
      facialCadastradas: bios.count ?? 0,
      facialTotal: moradores.count ?? 0,
      vaga: vaga.data?.numero ?? '—',
      locatariosPendentes: (locs.data ?? []).filter((l) => l.status === 'aguardando_sindico').length,
    },
    pedidos: [
      ...(locs.data ?? []).map((l) => ({
        id: l.id, titulo: `Locatário(a) · ${(l.pessoas as unknown as { nome: string } | null)?.nome ?? ''}`,
        inicio: new Date(l.inicio), fim: new Date(l.fim), detalhe: l.tipo, status: l.status,
      })),
      ...(reservas.data ?? []).map((r) => ({
        id: r.id, titulo: (r.areas_comuns as unknown as { nome: string }).nome,
        inicio: new Date(r.inicio), fim: new Date(r.fim), detalhe: 'reserva', status: r.status,
      })),
    ],
  };
}

export async function listarDemandas(): Promise<DemandaDemo[]> {
  if (MODO_DEMO || !supabase) return atraso(demoDemandas);
  const { data } = await supabase
    .from('demandas_transparencia')
    .select('id, titulo, local, etapa, teto, assembleia_em, etapas_demanda(etapa, detalhe), cotacoes(id, fornecedor, valor, prazo_dias, garantia_anos)')
    .eq('publicada', true)
    .order('created_at', { ascending: false });
  return (data ?? []).map((d) => ({
    id: d.id, titulo: d.titulo, local: d.local, etapa: d.etapa as EtapaDemanda, teto: d.teto === null ? null : Number(d.teto),
    assembleiaEm: d.assembleia_em ? new Date(d.assembleia_em) : null,
    etapas: (d.etapas_demanda ?? []) as DemandaDemo['etapas'],
    cotacoes: (d.cotacoes ?? []).map((c) => ({ ...c, valor: Number(c.valor) })),
  }));
}

export async function carregarDemanda(id: string): Promise<DemandaDemo | null> {
  return (await listarDemandas()).find((d) => d.id === id) ?? null;
}

export async function opcoesCessao() {
  if (MODO_DEMO || !supabase) return atraso(demoCederVaga);
  const ini = await carregarInicio();
  const [vagas, destinos] = await Promise.all([
    supabase.from('vagas').select('id, numero, local, descricao').eq('unidade_id', ini.unidade.id),
    supabase.rpc('unidades_destino', { p_condominio: ini.condominio.id }),
  ]);
  return {
    vagas: (vagas.data ?? []).map((v) => ({ id: v.id, numero: v.numero, local: v.local ?? '', tipo: v.descricao ?? '' })),
    unidadesDestino: ((destinos.data ?? []) as { unidade_id: string; rotulo: string }[]).map((d) => ({ id: d.unidade_id, rotulo: d.rotulo })),
    sugestao: { inicio: '', fim: '', placa: '' },
  };
}

/** Envia a cessão: a unidade cessionária confirma no app antes de ir ao síndico. */
export async function enviarCessao(v: { vagaId: string; unidadeCessionariaId: string; inicio: string; fim?: string; semTermino?: boolean; placa: string; valorMensal?: number }): Promise<void> {
  if (MODO_DEMO || !supabase) return atraso(undefined);
  const ini = await carregarInicio();
  const iso = (t: string) => parseDataBR(t)!.toISOString().slice(0, 10);
  const { error } = await supabase.from('cessoes_vaga').insert({
    condominio_id: ini.condominio.id, vaga_id: v.vagaId, unidade_cedente_id: ini.unidade.id,
    unidade_cessionaria_id: v.unidadeCessionariaId, inicio: iso(v.inicio), fim: v.semTermino || !v.fim ? null : iso(v.fim),
    placa: v.placa, valor_mensal: v.valorMensal ?? null,
  });
  if (error) throw new Error('Não foi possível enviar o pedido');
}
export type { CessaoVagaInput };

/** Cria a locação; para temporada, devolve os links faciais (uso único) para compartilhar. */
export async function enviarLocacao(
  v:
    | { tipo: 'temporada'; responsavel: string; celular: string; checkin: Date; checkout: Date; hospedes: number; origem: string }
    | { tipo: 'aluguel'; nome: string; celular: string; inicio: string; fim: string; imobiliaria?: string; moradores: number },
): Promise<{ links: string[] }> {
  if (MODO_DEMO || !supabase) return atraso({ links: ['https://app.gestacondominio.com/f/demo-pedro-1102b-0123456789abcdef0123456789abcdef'] });
  const ini = await carregarInicio();
  const base = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://app.gestacondominio.com';
  const r =
    v.tipo === 'temporada'
      ? await supabase.rpc('criar_locacao_temporada', {
          p_unidade: ini.unidade.id, p_responsavel: v.responsavel, p_celular: v.celular,
          p_checkin: v.checkin.toISOString(), p_checkout: v.checkout.toISOString(), p_hospedes: v.hospedes, p_origem: v.origem,
        })
      : await supabase.rpc('criar_locacao_aluguel', {
          p_unidade: ini.unidade.id, p_nome: v.nome, p_celular: v.celular,
          p_inicio: parseDataBR(v.inicio)!.toISOString().slice(0, 10), p_fim: parseDataBR(v.fim)!.toISOString().slice(0, 10),
          p_moradores: v.moradores, p_imobiliaria: v.imobiliaria ?? null,
        });
  if (r.error) throw new Error('Não foi possível enviar');
  const links = ((r.data as { links: { token: string }[] }).links ?? []).map((l) => `${base}/f/${l.token}`);
  return { links };
}
