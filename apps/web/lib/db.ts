import 'server-only';
import { Banco } from '@gc/db';

/** Sem DATABASE_URL o app roda em modo demonstração (dados fictícios em memória). */
export const MODO_DEMO = !process.env.DATABASE_URL;

const g = globalThis as unknown as { __gcBanco?: Banco };

/** Pool único por processo. Conecta como gc_app (sem privilégios próprios; ver @gc/db). */
export function banco(): Banco {
  if (MODO_DEMO) throw new Error('Banco indisponível no modo demonstração');
  g.__gcBanco ??= new Banco({ url: process.env.DATABASE_URL!, chaveCripto: process.env.APP_CRYPTO_KEY ?? '' });
  return g.__gcBanco;
}
