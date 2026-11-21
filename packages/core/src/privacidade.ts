/**
 * Regras de privacidade (LGPD). O condomínio é o controlador; a plataforma é operadora.
 * O dono do sistema vê apenas métricas agregadas, com supressão de contagens pequenas.
 */
export const K_ANONIMATO = 3;

/** Contagens abaixo de K são exibidas como "< 3" para impedir reidentificação. */
export function contagemAnonima(n: number): string {
  return n < K_ANONIMATO ? `< ${K_ANONIMATO}` : String(n);
}

export const DURACOES_SUPORTE_HORAS = [1, 4, 24] as const;
export type DuracaoSuporte = (typeof DURACOES_SUPORTE_HORAS)[number];

/** Acesso de suporte (break-glass): só leitura, aprovado pelo síndico, expira sozinho. */
export function expiracaoSuporte(aprovadoEm: Date, horas: number): Date {
  if (!(DURACOES_SUPORTE_HORAS as readonly number[]).includes(horas)) {
    throw new Error('Duração de suporte inválida: use 1h, 4h ou 24h');
  }
  return new Date(aprovadoEm.getTime() + horas * 3_600_000);
}

export function suporteAtivo(acesso: { status: string; expira_em: Date | null }, agora = new Date()): boolean {
  return acesso.status === 'aprovado' && acesso.expira_em !== null && acesso.expira_em > agora;
}

export const RETENCAO_PORTARIA_PADRAO_MESES = 6;

export function limiteRetencao(agora: Date, meses: number): Date {
  const d = new Date(agora);
  d.setMonth(d.getMonth() - meses);
  return d;
}

export const VERSAO_TERMO_BIOMETRIA = 'biometria-v1';
export const VERSAO_DPA = 'dpa-v1';

export const TIPOS_PEDIDO_TITULAR = ['acesso', 'exportacao', 'correcao', 'revogacao_consentimento', 'exclusao'] as const;
export type TipoPedidoTitular = (typeof TIPOS_PEDIDO_TITULAR)[number];

export const ROTULO_PEDIDO_TITULAR: Record<TipoPedidoTitular, string> = {
  acesso: 'Ver meus dados',
  exportacao: 'Exportar meus dados',
  correcao: 'Corrigir dados',
  revogacao_consentimento: 'Revogar consentimento',
  exclusao: 'Excluir meus dados',
};

/** Prazo legal de resposta ao titular (art. 19, II, LGPD). */
export const PRAZO_RESPOSTA_TITULAR_DIAS = 15;
