/**
 * Recria o banco "gc_test" do zero: shim do Supabase → migrações → seed.
 * Requer o Postgres de teste: `pnpm db:test:up` (docker) ou DATABASE_URL_TESTE apontando para outro.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const ADMIN_URL = process.env.DATABASE_URL_TESTE_ADMIN ?? 'postgres://postgres:postgres@127.0.0.1:55339/postgres';
export const TEST_DB = 'gc_test';

export default async function setup() {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  // Chave de criptografia SÓ de teste (em produção: Supabase Vault, segredo "app_crypto_key").
  await admin.query(`alter database ${TEST_DB} set app.crypto_key = 'chave-de-teste-nao-usar-em-producao'`);
  await admin.query(`alter database ${TEST_DB} set timezone = 'America/Sao_Paulo'`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${TEST_DB}`;
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  const raiz = join(import.meta.dirname, '..');
  await db.query(readFileSync(join(raiz, 'test/shim-supabase.sql'), 'utf8'));
  const dir = join(raiz, 'supabase/migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    try {
      await db.query(readFileSync(join(dir, f), 'utf8'));
    } catch (e) {
      throw new Error(`Falha na migração ${f}: ${(e as Error).message}`);
    }
  }
  try {
    await db.query(readFileSync(join(raiz, 'supabase/seed.sql'), 'utf8'));
  } catch (e) {
    throw new Error(`Falha no seed: ${(e as Error).message}`);
  }
  await db.end();
  process.env.DATABASE_URL_TESTE = url.toString();
}
