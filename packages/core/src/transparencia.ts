import { formatBRL } from './format';

export const ETAPAS_DEMANDA = ['solicitacao', 'cotacoes', 'aprovacao', 'contrato', 'execucao'] as const;
export type EtapaDemanda = (typeof ETAPAS_DEMANDA)[number];

export const ROTULO_ETAPA: Record<EtapaDemanda, string> = {
  solicitacao: 'Solicitação',
  cotacoes: 'Cotações',
  aprovacao: 'Aprovação',
  contrato: 'Contrato assinado',
  execucao: 'Execução',
};

/** Rótulo curto do badge de status da demanda (lista e cabeçalho). */
export const BADGE_ETAPA: Record<EtapaDemanda, { texto: string; textoCurto: string; tom: 'info' | 'warn' | 'ok' | 'neu' }> = {
  solicitacao: { texto: 'Solicitada', textoCurto: 'Solicitação', tom: 'neu' },
  cotacoes: { texto: 'Em cotação', textoCurto: 'Cotação', tom: 'info' },
  aprovacao: { texto: 'Em aprovação', textoCurto: 'Aprovação', tom: 'warn' },
  contrato: { texto: 'Contratada', textoCurto: 'Contrato', tom: 'ok' },
  execucao: { texto: 'Em execução', textoCurto: 'Execução', tom: 'ok' },
};

export type EstadoEtapa = 'done' | 'cur' | 'todo';

export function estadoEtapas(atual: EtapaDemanda, concluida = false): { etapa: EtapaDemanda; estado: EstadoEtapa; numero: number }[] {
  const idx = ETAPAS_DEMANDA.indexOf(atual);
  return ETAPAS_DEMANDA.map((etapa, i) => ({
    etapa,
    numero: i + 1,
    estado: concluida || i < idx ? 'done' : i === idx ? 'cur' : 'todo',
  }));
}

export interface CotacaoBase {
  id: string;
  fornecedor: string;
  valor: number;
  prazo_dias: number;
  garantia_anos: number | null;
}

export type SeloCotacao = 'menor_preco' | 'acima_do_teto' | null;

/**
 * "Menor preço" vai para a cotação mais barata dentro do teto aprovado.
 * "Acima do teto" marca toda cotação que ultrapassa o teto da assembleia.
 */
export function classificarCotacoes<T extends CotacaoBase>(cotacoes: T[], teto: number | null): (T & { selo: SeloCotacao })[] {
  const dentro = cotacoes.filter((c) => teto === null || c.valor <= teto);
  const menor = dentro.length ? Math.min(...dentro.map((c) => c.valor)) : null;
  return [...cotacoes]
    .sort((a, b) => a.valor - b.valor)
    .map((c) => ({
      ...c,
      selo: teto !== null && c.valor > teto ? 'acima_do_teto' : c.valor === menor ? 'menor_preco' : null,
    }));
}

/** "3 cotações · de R$ 78.400 a R$ 92.300" */
export function resumoCotacoes(valores: number[]): string {
  if (valores.length === 0) return 'Aguardando cotações';
  if (valores.length === 1) return `1 cotação · ${formatBRL(valores[0]!)}`;
  return `${valores.length} cotações · de ${formatBRL(Math.min(...valores))} a ${formatBRL(Math.max(...valores))}`;
}

/** "25 dias · garantia 5 anos" */
export function detalheCotacao(c: Pick<CotacaoBase, 'prazo_dias' | 'garantia_anos'>): string {
  const prazo = `${c.prazo_dias} ${c.prazo_dias === 1 ? 'dia' : 'dias'}`;
  if (!c.garantia_anos) return prazo;
  return `${prazo} · garantia ${c.garantia_anos} ${c.garantia_anos === 1 ? 'ano' : 'anos'}`;
}
