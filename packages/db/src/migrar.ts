import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const raiz = () => join(import.meta.dirname, '..');

/**
 * Aplica as migrações pendentes (em ordem, cada uma numa transação) e registra
 * em migracoes.aplicadas. Deve rodar com o usuário DONO do banco (não o gc_app).
 */
export async function migrar(url: string, log = console.log): Promise<string[]> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    await c.query('create schema if not exists migracoes');
    await c.query('create table if not exists migracoes.aplicadas (nome text primary key, aplicada_em timestamptz not null default now())');
    const feitas = new Set((await c.query<{ nome: string }>('select nome from migracoes.aplicadas')).rows.map((r) => r.nome));
    const dir = join(raiz(), 'migrations');
    const novas: string[] = [];
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      if (feitas.has(f)) continue;
      await c.query('begin');
      try {
        await c.query(readFileSync(join(dir, f), 'utf8'));
        await c.query('insert into migracoes.aplicadas (nome) values ($1)', [f]);
        await c.query('commit');
      } catch (e) {
        await c.query('rollback');
        throw new Error(`Falha na migração ${f}: ${(e as Error).message}`);
      }
      novas.push(f);
      log(`✓ ${f}`);
    }
    return novas;
  } finally {
    await c.end();
  }
}

/** Seed de desenvolvimento (2 condomínios fictícios). Nunca rode em produção. */
export async function aplicarSeed(url: string, chaveCripto: string): Promise<void> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('app.crypto_key', $1, true)`, [chaveCripto]);
    await c.query(readFileSync(join(raiz(), 'seed.sql'), 'utf8'));
    await c.query('commit');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw new Error(`Falha no seed: ${(e as Error).message}`);
  } finally {
    await c.end();
  }
}
