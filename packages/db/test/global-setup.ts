/**
 * Recria o banco "gc_test" do zero com as MESMAS rotinas de produção: migrar() → aplicarSeed().
 * Requer o Postgres de teste: `pnpm db:test:up` (docker) ou DATABASE_URL_TESTE_ADMIN apontando para outro.
 */
import pg from 'pg';
import { aplicarSeed, migrar } from '../src/migrar';

const ADMIN_URL = process.env.DATABASE_URL_TESTE_ADMIN ?? 'postgres://postgres:postgres@127.0.0.1:55339/postgres';
export const TEST_DB = 'gc_test';
export const CHAVE_TESTE = 'chave-de-teste-nao-usar-em-producao-0123456789';

export default async function setup() {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  // Nos testes a chave fica no banco por conveniência; em produção o servidor injeta por transação.
  await admin.query(`alter database ${TEST_DB} set app.crypto_key = '${CHAVE_TESTE}'`);
  await admin.query(`alter database ${TEST_DB} set timezone = 'America/Sao_Paulo'`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${TEST_DB}`;
  await migrar(url.toString(), () => {});
  await aplicarSeed(url.toString(), CHAVE_TESTE);
}
