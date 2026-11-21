import 'server-only';
import { ipDaRequisicao } from './auth';

/**
 * Limite de taxa em memória (janela deslizante por IP + chave). Suficiente para uma instância
 * na VPS; com várias instâncias, troque por uma tabela UNLOGGED no Postgres.
 */
const g = globalThis as unknown as { __gcLimite?: Map<string, number[]> };
const mapa = (g.__gcLimite ??= new Map());

export async function limitar(chave: string, max: number, janelaMs: number): Promise<boolean> {
  const k = `${chave}|${await ipDaRequisicao()}`;
  const agora = Date.now();
  const lista = (mapa.get(k) ?? []).filter((t: number) => agora - t < janelaMs);
  if (lista.length >= max) {
    mapa.set(k, lista);
    return false;
  }
  lista.push(agora);
  mapa.set(k, lista);
  if (mapa.size > 50_000) mapa.clear(); // proteção de memória
  return true;
}
