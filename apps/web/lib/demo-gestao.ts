import 'server-only';
import type { Comunicado, Contrato, Decisao, Hospede, Locacao, Ocorrencia, ReservaProxima, Unidade } from './gestao';

/** Dados fictícios da área do síndico no modo demonstração (memória; reinicia a cada deploy). */
const g = globalThis as unknown as { __gcDemoGestao?: ReturnType<typeof criar> };

const d = (s: string) => new Date(s);
const daqui = (dias: number) => new Date(Date.now() + dias * 86_400_000);

function criar() {
  const locacoes: Locacao[] = [
    {
      id: '70000000-0000-4000-8000-000000000001', tipo: 'temporada', unidade: '304-A', responsavel: 'Marina Souza',
      inicio: d('2026-11-22T14:00:00-03:00'), fim: d('2026-11-25T11:00:00-03:00'), qtdPessoas: 2, origem: 'Airbnb', imobiliaria: null,
      status: 'aguardando_sindico', temContrato: false, hospedes: 1, motivo: null, decididoEm: null,
    },
    {
      id: '70000000-0000-4000-8000-000000000002', tipo: 'aluguel', unidade: '207-A', responsavel: 'Bruno Melo',
      inicio: d('2026-03-01T00:00:00-03:00'), fim: d('2028-02-29T00:00:00-03:00'), qtdPessoas: 3, origem: null, imobiliaria: 'Lar Imóveis',
      status: 'aprovada', temContrato: true, hospedes: 1, motivo: null, decididoEm: d('2026-02-20T10:00:00-03:00'),
    },
    {
      id: '70000000-0000-4000-8000-000000000003', tipo: 'temporada', unidade: '1102-B', responsavel: 'Laura Dias',
      inicio: daqui(-1), fim: daqui(2), qtdPessoas: 4, origem: 'Booking', imobiliaria: null,
      status: 'aprovada', temContrato: false, hospedes: 2, motivo: null, decididoEm: daqui(-3),
    },
    {
      id: '70000000-0000-4000-8000-000000000004', tipo: 'temporada', unidade: '502-B', responsavel: 'Caio Prates',
      inicio: d('2026-10-10T14:00:00-03:00'), fim: d('2026-10-13T11:00:00-03:00'), qtdPessoas: 2, origem: 'Direto', imobiliaria: null,
      status: 'encerrada', temContrato: false, hospedes: 2, motivo: null, decididoEm: d('2026-10-08T09:00:00-03:00'),
    },
  ];
  const hospedes: Record<string, Hospede[]> = {
    '70000000-0000-4000-8000-000000000001': [{ nome: 'Marina Souza', cpf: '***.218.447-**', celular: '(41) 9 ****-7781', facial: false }],
    '70000000-0000-4000-8000-000000000002': [{ nome: 'Bruno Melo', cpf: '***.902.115-**', celular: '(41) 9 ****-2210', facial: true }],
    '70000000-0000-4000-8000-000000000003': [
      { nome: 'Laura Dias', cpf: '***.330.981-**', celular: '(11) 9 ****-4402', facial: true },
      { nome: 'Tiago Dias', cpf: '***.330.982-**', celular: null, facial: true },
    ],
  };
  const contratos: Contrato[] = [
    {
      id: 'c1000000-0000-4000-8000-000000000001', fornecedor: 'Elevadores Sul Ltda', cnpj: '12.345.678/0001-90', contato: '(41) 3333-1000',
      categoria: 'elevadores', objeto: 'Manutenção preventiva e corretiva dos 4 elevadores', valor: 1890, periodicidade: 'mensal',
      inicio: d('2025-12-01T00:00:00-03:00'), fim: daqui(18), renovacaoAutomatica: true, avisoDias: 30, status: 'ativo', encerradoEm: null,
      temDocumento: true, observacoes: 'Reajuste anual pelo IPCA.',
    },
    {
      id: 'c1000000-0000-4000-8000-000000000002', fornecedor: 'Limpa Mais Serviços', cnpj: '23.456.789/0001-01', contato: 'contato@limpamais.example',
      categoria: 'limpeza', objeto: 'Limpeza das áreas comuns (2 colaboradores, seg a sáb)', valor: 9800, periodicidade: 'mensal',
      inicio: d('2026-01-01T00:00:00-03:00'), fim: d('2026-12-31T00:00:00-03:00'), renovacaoAutomatica: false, avisoDias: 45, status: 'ativo',
      encerradoEm: null, temDocumento: true, observacoes: null,
    },
    {
      id: 'c1000000-0000-4000-8000-000000000003', fornecedor: 'Porto Seguro (fictício)', cnpj: null, contato: null, categoria: 'seguro',
      objeto: 'Seguro predial obrigatório', valor: 14400, periodicidade: 'anual', inicio: d('2026-04-01T00:00:00-03:00'),
      fim: d('2027-03-31T00:00:00-03:00'), renovacaoAutomatica: false, avisoDias: 60, status: 'ativo', encerradoEm: null, temDocumento: false,
      observacoes: null,
    },
    {
      id: 'c1000000-0000-4000-8000-000000000004', fornecedor: 'Verde Vivo Jardinagem', cnpj: '34.567.890/0001-12', contato: null,
      categoria: 'jardinagem', objeto: 'Manutenção quinzenal dos jardins', valor: 1200, periodicidade: 'mensal',
      inicio: d('2025-06-01T00:00:00-03:00'), fim: daqui(-5), renovacaoAutomatica: false, avisoDias: 30, status: 'ativo', encerradoEm: null,
      temDocumento: false, observacoes: null,
    },
    {
      id: 'c1000000-0000-4000-8000-000000000005', fornecedor: 'Vigia Total', cnpj: '45.678.901/0001-23', contato: null, categoria: 'seguranca',
      objeto: 'Portaria remota (substituída por portaria própria)', valor: 6500, periodicidade: 'mensal', inicio: d('2024-01-01T00:00:00-03:00'),
      fim: d('2025-12-31T00:00:00-03:00'), renovacaoAutomatica: false, avisoDias: 30, status: 'encerrado', encerradoEm: d('2025-12-31T00:00:00-03:00'),
      temDocumento: true, observacoes: null,
    },
  ];
  const unidades: Unidade[] = [
    { id: 'a0000000-0000-4000-8000-000000000207', codigo: '207-A', bloco: 'A', moradores: [
      { nome: 'Bruno Melo', tipo: 'Inquilino', responsavel: true, temConta: true, facial: true },
    ], convitesPendentes: [] },
    { id: 'a0000000-0000-4000-8000-000000000304', codigo: '304-A', bloco: 'A', moradores: [
      { nome: 'Ricardo Alves', tipo: 'Proprietário', responsavel: true, temConta: true, facial: true },
      { nome: 'Carla Nunes', tipo: 'Residente', responsavel: false, temConta: true, facial: true },
    ], convitesPendentes: [] },
    { id: 'b0000000-0000-4000-8000-000000000502', codigo: '502-B', bloco: 'B', moradores: [], convitesPendentes: [
      { nome: 'Joana Freitas', email: 'joana@example.com', tipo: 'Proprietário' },
    ] },
    { id: 'b0000000-0000-4000-8000-000000001102', codigo: '1102-B', bloco: 'B', moradores: [
      { nome: 'Pedro Lima', tipo: 'Proprietário', responsavel: true, temConta: true, facial: false },
    ], convitesPendentes: [] },
  ];
  const ocorrencias: Ocorrencia[] = [
    { id: 'o1', titulo: 'Lâmpada queimada na garagem', descricao: 'Subsolo 1, perto da vaga 18.', unidade: '304-A', status: 'aberta', criadaEm: daqui(-1), resposta: null },
    { id: 'o2', titulo: 'Barulho após as 22h', descricao: 'Som alto no 8º andar do bloco B.', unidade: '1102-B', status: 'em_andamento', criadaEm: daqui(-3), resposta: 'Notificamos a unidade.' },
    { id: 'o3', titulo: 'Portão da garagem lento', descricao: null, unidade: '207-A', status: 'resolvida', criadaEm: daqui(-12), resposta: 'Motor ajustado pela manutenção.' },
  ];
  const comunicados: Comunicado[] = [
    { id: 'm1', titulo: 'Manutenção dos elevadores', corpo: 'Elevador social do Bloco B parado dia 26/11, das 8h às 12h.', publicadoEm: daqui(-2) },
  ];
  const decisoes: Decisao[] = [
    { tipo: 'locacao', titulo: 'Temporada · Laura Dias', unidade: '1102-B', status: 'aprovada', quando: daqui(-3), motivo: null },
    { tipo: 'reserva', titulo: 'Salão de festas', unidade: '304-A', status: 'confirmada', quando: daqui(-6), motivo: null },
    { tipo: 'cessao', titulo: 'Vaga 22 · 502-B → 110-A', unidade: '502-B', status: 'recusada', quando: daqui(-9), motivo: 'Placa não informada pela unidade de destino.' },
  ];
  const reservas: ReservaProxima[] = [
    { area: 'Salão de festas', unidade: '304-A', inicio: d('2026-12-13T18:00:00-03:00'), fim: d('2026-12-13T23:00:00-03:00'), status: 'confirmada' },
  ];
  return { locacoes, hospedes, contratos, unidades, ocorrencias, comunicados, decisoes, reservas };
}

export function demoGestao() {
  g.__gcDemoGestao ??= criar();
  return g.__gcDemoGestao;
}
