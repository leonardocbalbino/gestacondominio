/**
 * Acesso ao Postgres com RLS aplicado no banco.
 *
 * Toda operação roda numa transação que assume um papel:
 *   - comoUsuario(userId)  → role "authenticated" + JWT claims {sub}
 *   - comoAnon()           → role "anon" (link facial, login, convite)
 *   - comoServico()        → role "service_role" (worker, upload de biometria) — BYPASSRLS, use com parcimônia
 * A chave de criptografia de colunas (APP_CRYPTO_KEY) é injetada só na transação.
 */
import pg from 'pg';

export type Executor = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

export interface ConfigDb {
  url: string;
  chaveCripto: string;
  max?: number;
}

export class Banco {
  readonly pool: pg.Pool;
  private readonly chave: string;

  constructor(cfg: ConfigDb) {
    if (!cfg.chaveCripto || cfg.chaveCripto.length < 32) {
      throw new Error('APP_CRYPTO_KEY ausente ou curta (mínimo 32 caracteres)');
    }
    this.pool = new pg.Pool({ connectionString: cfg.url, max: cfg.max ?? 10 });
    this.chave = cfg.chaveCripto;
  }

  private async transacao<T>(role: 'anon' | 'authenticated' | 'service_role', userId: string | null, fn: (q: Executor) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('begin');
      await c.query(`set local role ${role}`);
      await c.query(
        `select set_config('request.jwt.claims', $1, true), set_config('app.crypto_key', $2, true), set_config('timezone', 'America/Sao_Paulo', true)`,
        [JSON.stringify(userId ? { sub: userId, role } : { role }), this.chave],
      );
      const q: Executor = async (sql, params) => (await c.query(sql, params)).rows;
      const r = await fn(q);
      await c.query('commit');
      return r;
    } catch (e) {
      await c.query('rollback').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }

  comoUsuario<T>(userId: string, fn: (q: Executor) => Promise<T>) {
    return this.transacao('authenticated', userId, fn);
  }
  comoAnon<T>(fn: (q: Executor) => Promise<T>) {
    return this.transacao('anon', null, fn);
  }
  comoServico<T>(fn: (q: Executor) => Promise<T>) {
    return this.transacao('service_role', null, fn);
  }

  fechar() {
    return this.pool.end();
  }
}

/** Erros de negócio levantados pelas funções do banco (mensagens já em pt-BR). */
export function mensagemDoBanco(e: unknown, padrao = 'Não foi possível concluir'): string {
  const err = e as { code?: string; message?: string };
  if (err?.code && ['22023', '42501', '28P01', '28000', '23505', '23P01'].includes(err.code)) {
    if (err.code === '23P01') return 'Já existe um pedido para esse horário';
    // Nunca expor o texto interno das políticas RLS.
    if (err.code === '42501' && /row-level security|permission denied/.test(err.message ?? '')) return 'Você não tem permissão para esta operação';
    return err.message ?? padrao;
  }
  return padrao;
}

