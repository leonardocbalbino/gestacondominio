/**
 * Dados fictícios de demonstração — os mesmos do seed (packages/db/supabase/seed.sql).
 * Usados pelo modo demonstração quando o app roda sem Supabase configurado.
 * Nenhuma pessoa real: nomes, CPFs e telefones são inventados.
 */
import type { EtapaDemanda } from './transparencia';

export const IDS = {
  condoAcacias: '11111111-1111-4111-8111-111111111111',
  condoIpes: '22222222-2222-4222-8222-222222222222',
  unidade304A: 'a0000000-0000-4000-8000-000000000304',
  unidade207A: 'a0000000-0000-4000-8000-000000000207',
  unidade1102B: 'b0000000-0000-4000-8000-000000001102',
  vaga18: 'c0000000-0000-4000-8000-000000000018',
  demandaLaje: 'd0000000-0000-4000-8000-000000000001',
  demandaFachada: 'd0000000-0000-4000-8000-000000000002',
  linkPedro: 'e0000000-0000-4000-8000-000000000001',
} as const;

/** Token público de demonstração do link facial (em produção é aleatório e só o hash é salvo). */
export const DEMO_TOKEN_FACIAL = 'demo-pedro-1102b-0123456789abcdef0123456789abcdef';

const d = (iso: string) => new Date(iso);

export const demoMoradorInicio = {
  condominio: { id: IDS.condoAcacias, nome: 'Res. Jardim das Acácias', sigla: 'JA' },
  usuario: { primeiroNome: 'Ricardo', notificacoesNaoLidas: 2 },
  unidade: { id: IDS.unidade304A, codigo: '304-A', vinculo: 'Proprietário' },
  resumo: { facialCadastradas: 2, facialTotal: 2, vaga: '18', locatariosPendentes: 1 },
  pedidos: [
    {
      id: 'p1',
      titulo: 'Locatária · Marina Souza',
      inicio: d('2026-11-22T14:00:00-03:00'),
      fim: d('2026-11-25T11:00:00-03:00'),
      detalhe: 'temporada',
      status: 'aguardando_sindico',
    },
    {
      id: 'p2',
      titulo: 'Salão de festas',
      inicio: d('2026-12-13T18:00:00-03:00'),
      fim: d('2026-12-13T23:00:00-03:00'),
      detalhe: 'reserva',
      status: 'confirmada',
    },
  ],
};

export interface DemandaDemo {
  id: string;
  titulo: string;
  local: string | null;
  etapa: EtapaDemanda;
  teto: number | null;
  assembleiaEm: Date | null;
  etapas: { etapa: EtapaDemanda; detalhe: string | null }[];
  cotacoes: { id: string; fornecedor: string; valor: number; prazo_dias: number; garantia_anos: number | null }[];
}

export const demoDemandas: DemandaDemo[] = [
  {
    id: IDS.demandaLaje,
    titulo: 'Impermeabilização da laje',
    local: 'Bloco B',
    etapa: 'cotacoes',
    teto: 90000,
    assembleiaEm: null,
    etapas: [
      { etapa: 'solicitacao', detalhe: '03/11 · infiltração no 12º andar' },
      { etapa: 'cotacoes', detalhe: '3 recebidas · prazo 28/11' },
      { etapa: 'aprovacao', detalhe: 'Conselho' },
      { etapa: 'contrato', detalhe: null },
      { etapa: 'execucao', detalhe: null },
    ],
    cotacoes: [
      { id: 'q1', fornecedor: 'ImperSul', valor: 78400, prazo_dias: 25, garantia_anos: 5 },
      { id: 'q2', fornecedor: 'Vedatec Engenharia', valor: 86900, prazo_dias: 20, garantia_anos: 5 },
      { id: 'q3', fornecedor: 'Laje Forte', valor: 92300, prazo_dias: 18, garantia_anos: 10 },
    ],
  },
  {
    id: IDS.demandaFachada,
    titulo: 'Pintura da fachada',
    local: null,
    etapa: 'aprovacao',
    teto: null,
    assembleiaEm: d('2026-12-04T19:30:00-03:00'),
    etapas: [
      { etapa: 'solicitacao', detalhe: '15/09 · desgaste da pintura' },
      { etapa: 'cotacoes', detalhe: '4 recebidas' },
      { etapa: 'aprovacao', detalhe: 'Assembleia em 04/12' },
      { etapa: 'contrato', detalhe: null },
      { etapa: 'execucao', detalhe: null },
    ],
    cotacoes: [
      { id: 'q4', fornecedor: 'Cores do Sul', valor: 142000, prazo_dias: 60, garantia_anos: 3 },
      { id: 'q5', fornecedor: 'Pinta Bem', valor: 151500, prazo_dias: 45, garantia_anos: 3 },
      { id: 'q6', fornecedor: 'Fachada Nova', valor: 158900, prazo_dias: 50, garantia_anos: 5 },
      { id: 'q7', fornecedor: 'Prisma Reformas', valor: 166300, prazo_dias: 40, garantia_anos: 5 },
    ],
  },
];

export const demoCederVaga = {
  vagas: [{ id: IDS.vaga18, numero: '18', local: 'Subsolo 1', tipo: 'Coberta · carro' }],
  unidadesDestino: [
    { id: IDS.unidade207A, rotulo: '207-A · Bruno Melo' },
    { id: IDS.unidade1102B, rotulo: '1102-B · Pedro Lima' },
  ],
  sugestao: { inicio: '01/12/2026', fim: '31/05/2027', placa: 'RTX-4E21' },
};

export const demoLocatarioTemporada = {
  responsavel: 'Marina Souza',
  celular: '(41) 9 9812-3344',
  checkin: d('2026-11-22T14:00:00-03:00'),
  checkout: d('2026-11-25T11:00:00-03:00'),
  hospedes: 2,
  origem: 'Airbnb' as const,
};

export const demoLinkFacial = {
  condominio: { nome: 'Res. Jardim das Acácias', sigla: 'JA' },
  primeiroNome: 'Pedro',
  unidade: '1102-B',
  expiraEm: d('2026-11-23T14:22:00-03:00'),
};

export const demoAreas = [
  { id: '80000000-0000-4000-8000-000000000001', nome: 'Salão de festas' },
  { id: '80000000-0000-4000-8000-000000000002', nome: 'Churrasqueira' },
];

export const demoAssembleias = [
  {
    id: '90000000-0000-4000-8000-000000000001',
    titulo: 'AGE · Pintura da fachada',
    dataHora: d('2026-12-04T19:30:00-03:00'),
    status: 'convocada' as 'convocada' | 'em_votacao' | 'encerrada',
    pautas: [
      {
        id: '91000000-0000-4000-8000-000000000001',
        titulo: 'Aprovar a pintura da fachada',
        votacaoAberta: true,
        meuVoto: null as 'sim' | 'nao' | 'abstencao' | null,
        resultado: { sim: 11, nao: 4, abstencao: 2 },
      },
    ],
  },
];

export const demoEncomendas = [
  { id: 'enc1', descricao: 'Caixa média · Correios', recebidaEm: d('2026-11-20T15:40:00-03:00'), retiradaEm: null as Date | null },
  { id: 'enc2', descricao: 'Envelope · Mercado Livre', recebidaEm: d('2026-11-14T10:05:00-03:00'), retiradaEm: d('2026-11-14T19:12:00-03:00') as Date | null },
];

export const demoOcorrencias = [
  { id: 'oc1', titulo: 'Lâmpada queimada no hall do 3º andar', status: 'em_andamento' as 'aberta' | 'em_andamento' | 'resolvida', criadaEm: d('2026-11-18T08:30:00-03:00') },
];

/** Visão do dono do sistema: somente agregados — nunca nomes, CPFs ou unidades. */
export interface MetricaDemo {
  condominio_id: string;
  nome: string;
  cidade: string;
  uf: string;
  plano: string;
  status: string;
  unidades: number;
  moradores_ativos: number;
  pedidos_30d: number;
  biometrias_ativas: number;
  hospedes_mes: number;
}

export const demoMetricasDono: MetricaDemo[] = [
  { condominio_id: IDS.condoAcacias, nome: 'Res. Jardim das Acácias', cidade: 'Curitiba', uf: 'PR', plano: 'Essencial', status: 'ativo', unidades: 48, moradores_ativos: 112, pedidos_30d: 37, biometrias_ativas: 96, hospedes_mes: 2 },
  { condominio_id: IDS.condoIpes, nome: 'Cond. Vila dos Ipês', cidade: 'Campinas', uf: 'SP', plano: 'Profissional', status: 'ativo', unidades: 24, moradores_ativos: 51, pedidos_30d: 12, biometrias_ativas: 40, hospedes_mes: 0 },
];
