/**
 * pnpm db:migrate  → aplica migrações pendentes (DATABASE_URL_ADMIN = dono do banco)
 * pnpm db:seed     → dados fictícios de desenvolvimento (recusa se NODE_ENV=production)
 * pnpm db:app-user → cria/atualiza o usuário de login da aplicação (GC_APP_PASSWORD)
 */
import pg from 'pg';
import { aplicarSeed, migrar } from './migrar';

const cmd = process.argv[2];
const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_URL_ADMIN (usuário dono do banco).');
  process.exit(1);
}

if (cmd === 'migrate') {
  const novas = await migrar(url);
  console.log(novas.length ? `${novas.length} migração(ões) aplicada(s).` : 'Banco já está atualizado.');
} else if (cmd === 'seed') {
  if (process.env.NODE_ENV === 'production') {
    console.error('Seed fictício não roda em produção.');
    process.exit(1);
  }
  const chave = process.env.APP_CRYPTO_KEY;
  if (!chave) {
    console.error('Defina APP_CRYPTO_KEY.');
    process.exit(1);
  }
  await aplicarSeed(url, chave);
  console.log('Seed aplicado (2 condomínios fictícios).');
} else if (cmd === 'app-user') {
  const senha = process.env.GC_APP_PASSWORD;
  if (!senha || senha.length < 16) {
    console.error('Defina GC_APP_PASSWORD (mínimo 16 caracteres).');
    process.exit(1);
  }
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  // O gc_app não é dono de nada: só pode assumir os três papéis da aplicação.
  const existe = (await c.query(`select 1 from pg_roles where rolname = 'gc_app'`)).rowCount;
  const ident = c.escapeLiteral(senha);
  await c.query(existe ? `alter role gc_app with login password ${ident}` : `create role gc_app login noinherit password ${ident}`);
  await c.query('grant anon, authenticated, service_role to gc_app');
  await c.end();
  console.log('Usuário gc_app pronto.');
} else {
  console.error('Uso: cli.ts migrate | seed | app-user');
  process.exit(1);
}
