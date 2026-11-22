import 'server-only';

/**
 * Dados públicos de contato usados na política de privacidade, suporte e exclusão de conta
 * (páginas exigidas pela App Store e Google Play). Configure no infra/.env.
 */
export const contato = {
  /** E-mail de suporte e do encarregado de dados (DPO) da plataforma. */
  email: process.env.SUPORTE_EMAIL || '',
  /** Razão social e CNPJ (ou nome e CPF) de quem opera a plataforma. */
  responsavel: process.env.RESPONSAVEL_LEGAL || 'GestaCondomínio',
};

export const POLITICA_ATUALIZADA_EM = '22/11/2026';
