/** Máquinas de estado dos pedidos do morador. O banco valida as mesmas transições (trigger). */
import { formatDiaMesHora } from './format';

export type StatusCessao = 'aguardando_cessionario' | 'aguardando_sindico' | 'aprovada' | 'recusada' | 'cancelada' | 'encerrada';
export type StatusLocacao = 'aguardando_sindico' | 'aprovada' | 'recusada' | 'cancelada' | 'encerrada';
export type StatusReserva = 'aguardando_sindico' | 'confirmada' | 'recusada' | 'cancelada';

const TRANSICOES_CESSAO: Record<StatusCessao, StatusCessao[]> = {
  aguardando_cessionario: ['aguardando_sindico', 'recusada', 'cancelada'],
  aguardando_sindico: ['aprovada', 'recusada', 'cancelada'],
  aprovada: ['encerrada', 'cancelada'],
  recusada: [],
  cancelada: [],
  encerrada: [],
};

const TRANSICOES_LOCACAO: Record<StatusLocacao, StatusLocacao[]> = {
  aguardando_sindico: ['aprovada', 'recusada', 'cancelada'],
  aprovada: ['encerrada', 'cancelada'],
  recusada: [],
  cancelada: [],
  encerrada: [],
};

export function podeTransicionarCessao(de: StatusCessao, para: StatusCessao): boolean {
  return TRANSICOES_CESSAO[de].includes(para);
}

export function podeTransicionarLocacao(de: StatusLocacao, para: StatusLocacao): boolean {
  return TRANSICOES_LOCACAO[de].includes(para);
}

type Tom = 'ok' | 'warn' | 'info' | 'bad' | 'neu';

export const BADGE_STATUS: Record<string, { texto: string; tom: Tom }> = {
  aguardando_cessionario: { texto: 'Aguardando unidade', tom: 'info' },
  aguardando_sindico: { texto: 'Com o síndico', tom: 'warn' },
  aprovada: { texto: 'Aprovado', tom: 'ok' },
  confirmada: { texto: 'Confirmado', tom: 'ok' },
  recusada: { texto: 'Recusado', tom: 'bad' },
  cancelada: { texto: 'Cancelado', tom: 'neu' },
  encerrada: { texto: 'Encerrado', tom: 'neu' },
};

/** Acesso do hóspede/locatário só vale dentro da janela aprovada. */
export function dentroDaJanela(inicio: Date, fim: Date | null, agora = new Date()): boolean {
  return agora >= inicio && (fim === null || agora <= fim);
}

/** Biometria de hóspede/locatário é apagada ao fim do período (check-out ou fim do contrato). */
export function dataExclusaoBiometria(fimPeriodo: Date | null): Date | null {
  return fimPeriodo;
}

export function linkFacialValido(expiraEm: Date, usadoEm: Date | null, agora = new Date()): boolean {
  return usadoEm === null && expiraEm > agora;
}

/** "Link pessoal · válido até 23/11 às 14:22" */
export function textoValidadeLink(expiraEm: Date): string {
  return `Link pessoal · válido até ${formatDiaMesHora(expiraEm)}`;
}

/** Links faciais valem 48h a partir do envio, nunca além do fim do período. */
export const VALIDADE_LINK_HORAS = 48;

export function expiracaoLink(enviadoEm: Date, fimPeriodo: Date | null): Date {
  const padrao = new Date(enviadoEm.getTime() + VALIDADE_LINK_HORAS * 3_600_000);
  return fimPeriodo && fimPeriodo < padrao ? fimPeriodo : padrao;
}
