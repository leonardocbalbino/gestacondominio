import 'server-only';
import { demoLinkFacial, demoMetricasDono, DEMO_TOKEN_FACIAL, IDS } from '@gc/core/demo';

/**
 * Estado em memória do modo demonstração (sem Supabase). Reinicia a cada deploy.
 * Espelha o seed: nomes e números fictícios.
 */
export interface PedidoAprovacao {
  id: string;
  tipo: 'locacao' | 'cessao' | 'reserva';
  titulo: string;
  unidade: string;
  detalhe: string;
  inicio: Date;
  fim: Date | null;
  status: string;
}

export interface PedidoSuporte {
  id: string;
  condominioId: string;
  condominio: string;
  motivo: string;
  duracaoHoras: 1 | 4 | 24;
  status: 'solicitado' | 'aprovado' | 'negado' | 'expirado' | 'revogado';
  expiraEm: Date | null;
  criadoEm: Date;
}

const g = globalThis as unknown as { __gcDemo?: ReturnType<typeof criar> };

function criar() {
  return {
    condominios: demoMetricasDono.map((c) => ({ ...c })),
    convites: [] as { condominio: string; email: string; link: string }[],
    aprovacoes: [
      {
        id: '70000000-0000-4000-8000-000000000001',
        tipo: 'locacao',
        titulo: 'Locatária · Marina Souza',
        unidade: '304-A',
        detalhe: 'Temporada · Airbnb · 2 hóspedes',
        inicio: new Date('2026-11-22T14:00:00-03:00'),
        fim: new Date('2026-11-25T11:00:00-03:00'),
        status: 'aguardando_sindico',
      },
      {
        id: 'demo-cessao-1',
        tipo: 'cessao',
        titulo: 'Cessão da vaga 18 · 304-A → 207-A',
        unidade: '304-A',
        detalhe: 'Placa RTX-4E21 · confirmada pela 207-A',
        inicio: new Date('2026-12-01T00:00:00-03:00'),
        fim: new Date('2027-05-31T00:00:00-03:00'),
        status: 'aguardando_sindico',
      },
      {
        id: 'demo-reserva-1',
        tipo: 'reserva',
        titulo: 'Churrasqueira',
        unidade: '502-B',
        detalhe: 'Reserva de área comum',
        inicio: new Date('2026-12-06T12:00:00-03:00'),
        fim: new Date('2026-12-06T17:00:00-03:00'),
        status: 'aguardando_sindico',
      },
    ] as PedidoAprovacao[],
    suporte: [
      {
        id: 'demo-suporte-1',
        condominioId: IDS.condoAcacias,
        condominio: 'Res. Jardim das Acácias',
        motivo: 'Chamado #4821 — reserva do salão não aparece para a unidade',
        duracaoHoras: 1,
        status: 'solicitado',
        expiraEm: null,
        criadoEm: new Date('2026-11-21T09:12:00-03:00'),
      },
    ] as PedidoSuporte[],
    portaria: {
      pessoas: [
        { nome: 'Ricardo Alves', cpf: '***.792.468-**', unidade: '304-A', vinculo: 'Proprietário', facial: true },
        { nome: 'Lúcia Alves', cpf: '***.159.265-**', unidade: '304-A', vinculo: 'Residente', facial: true },
        { nome: 'Bruno Melo', cpf: '***.828.182-**', unidade: '207-A', vinculo: 'Proprietário', facial: true },
        { nome: 'Pedro Lima', cpf: '***.803.398-**', unidade: '1102-B', vinculo: 'Inquilino', facial: false },
        { nome: 'Tânia Rocha', cpf: '***.213.565-**', unidade: '502-B', vinculo: 'Proprietário', facial: false },
      ],
      vagas: [{ vaga: '07', local: 'Subsolo 1', unidade: '1102-B', placa: 'BRA-2E19', fim: new Date('2027-04-30T00:00:00-03:00') }],
      registros: [
        { quando: new Date(Date.now() - 2 * 3_600_000), unidade: '304-A', tipo: 'entrada', meio: 'facial' },
        { quando: new Date(Date.now() - 5 * 3_600_000), unidade: '207-A', tipo: 'saida', meio: 'facial' },
        { quando: new Date(Date.now() - 26 * 3_600_000), unidade: '1102-B', tipo: 'entrega', meio: 'portaria' },
      ],
    },
    // Mesmo critério do seed: 23/11 às 14:22 ou, se já passou, +48h a partir de agora.
    links: new Map([
      [
        DEMO_TOKEN_FACIAL,
        {
          ...demoLinkFacial,
          expiraEm: new Date(Math.max(demoLinkFacial.expiraEm.getTime(), Date.now() + 48 * 3_600_000)),
          consentiu: false,
          usado: false,
        },
      ],
    ]),
  };
}

export function demo() {
  g.__gcDemo ??= criar();
  return g.__gcDemo;
}
