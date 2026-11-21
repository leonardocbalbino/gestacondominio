import pg from 'pg';

const url = (process.env.DATABASE_URL_TESTE ?? 'postgres://postgres:postgres@127.0.0.1:55339/gc_test');
export const pool = new pg.Pool({ connectionString: url, max: 4 });

export const U = {
  dono: '00000000-0000-4000-8000-0000000000d0',
  helena: '00000000-0000-4000-8000-0000000000a1', // síndica Acácias
  carla: '00000000-0000-4000-8000-0000000000a2', // conselho + moradora 101-A
  portaria: '00000000-0000-4000-8000-0000000000a3',
  ricardo: '00000000-0000-4000-8000-0000000000a4', // 304-A
  bruno: '00000000-0000-4000-8000-0000000000a5', // 207-A
  pedro: '00000000-0000-4000-8000-0000000000a6', // 1102-B
  marcos: '00000000-0000-4000-8000-0000000000b1', // síndico Ipês
  ana: '00000000-0000-4000-8000-0000000000b2', // moradora Ipês
} as const;

export const C = {
  acacias: '11111111-1111-4111-8111-111111111111',
  ipes: '22222222-2222-4222-8222-222222222222',
};

export const UN = {
  u304A: 'a0000000-0000-4000-8000-000000000304',
  u207A: 'a0000000-0000-4000-8000-000000000207',
  u1102B: 'b0000000-0000-4000-8000-000000001102',
};

export type Q = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

export interface Sessao {
  q: Q;
  /** Executa como superusuário dentro da MESMA transação (para preparar cenários). */
  admin: Q;
  /** Troca o usuário ativo da sessão (mesma transação), para simular outra parte do fluxo. */
  trocar: (userId: string | null) => Promise<void>;
}

/**
 * Executa `fn` como o usuário informado (role authenticated + JWT sub) numa transação
 * que sempre sofre ROLLBACK — os testes não se contaminam.
 */
export async function como<T>(userId: string | null, fn: (s: Sessao) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let atual = userId;
  const entrar = async () => {
    const role = atual ? 'authenticated' : 'anon';
    await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(atual ? { sub: atual, role } : { role }),
    ]);
  };
  const trocar = async (uid: string | null) => {
    atual = uid;
    await client.query('reset role');
    await entrar();
  };
  // Cada comando roda num SAVEPOINT: um erro esperado não aborta a transação do teste.
  const rodar = async (sql: string, params?: unknown[]) => {
    await client.query('savepoint cmd');
    try {
      const r = await client.query(sql, params);
      await client.query('release savepoint cmd');
      return r.rows;
    } catch (e) {
      await client.query('rollback to savepoint cmd');
      throw e;
    }
  };
  const q: Q = async (sql, params) => (await rodar(sql, params)) as never;
  const admin: Q = async (sql, params) => {
    await client.query('reset role');
    try {
      return (await rodar(sql, params)) as never;
    } finally {
      await entrar();
    }
  };
  try {
    await client.query('begin');
    await entrar();
    return await fn({ q, admin, trocar });
  } finally {
    await client.query('rollback').catch(() => {});
    client.release();
  }
}

/** Espera que a promessa falhe com erro do Postgres; devolve a mensagem. */
export async function falha(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error('era esperado erro, mas a operação foi permitida');
}
