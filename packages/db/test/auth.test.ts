import { createHmac } from 'node:crypto';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { Banco } from '../src';
import { CHAVE_TESTE } from './global-setup';
import { C, como, falha, pool, U, UN } from './helpers';

afterAll(() => pool.end());

/** TOTP de referência (RFC 6238) em Node, para conferir a implementação em SQL. */
function totp(segredoHex: string, passo = Math.floor(Date.now() / 1000 / 30)): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(passo));
  const h = createHmac('sha1', Buffer.from(segredoHex, 'hex')).update(buf).digest();
  const o = h[19]! & 15;
  const bin = ((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(bin % 1_000_000).padStart(6, '0');
}

describe('Autenticação própria (schema auth)', () => {
  it('entra com senha correta e recusa a errada', async () => {
    await como(null, async ({ q }) => {
      const [s] = await q<{ token: string; user_id: string; totp_ativo: boolean }>(
        `select * from auth.entrar('Ricardo.Alves@example.com', 'Demo@2026!', 'web')`,
      );
      expect(s!.user_id).toBe(U.ricardo);
      expect(s!.token).toHaveLength(64);
      const [sessao] = await q<{ user_id: string; aal: number }>('select * from auth.sessao($1)', [s!.token]);
      expect(sessao).toMatchObject({ user_id: U.ricardo, aal: 1 });
      const [errada] = await q<{ token: string | null; erro: string }>(`select * from auth.entrar('ricardo.alves@example.com', 'errada', 'web')`);
      expect(errada).toMatchObject({ token: null, erro: 'credenciais' });
      const [ninguem] = await q<{ erro: string }>(`select * from auth.entrar('ninguem@example.com', 'x', 'web')`);
      expect(ninguem!.erro).toBe('credenciais');
    });
  });

  it('bloqueia após 5 senhas erradas (mesmo com a senha certa depois)', async () => {
    await como(null, async ({ q }) => {
      const erros: string[] = [];
      for (let i = 0; i < 5; i++) {
        const [r] = await q<{ erro: string }>(`select * from auth.entrar('bruno.melo@example.com', 'x', 'web')`);
        erros.push(r!.erro);
      }
      expect(erros).toEqual(['credenciais', 'credenciais', 'credenciais', 'credenciais', 'bloqueada']);
      const [certa] = await q<{ token: string | null; erro: string }>(`select * from auth.entrar('bruno.melo@example.com', 'Demo@2026!', 'web')`);
      expect(certa).toMatchObject({ token: null, erro: 'bloqueada' });
    });
  });

  it('anon e authenticated não leem as tabelas de auth', async () => {
    await como(null, async ({ q }) => {
      expect(await falha(q('select * from auth.users'))).toMatch(/permission denied/);
      expect(await falha(q('select * from auth.sessoes'))).toMatch(/permission denied/);
    });
    await como(U.ricardo, async ({ q }) => {
      expect(await falha(q('select senha_hash from auth.users'))).toMatch(/permission denied/);
    });
  });

  it('sessão encerrada deixa de valer', async () => {
    await como(null, async ({ q }) => {
      const [s] = await q<{ token: string }>(`select token from auth.entrar('ana.ribeiro@example.com', 'Demo@2026!', 'mobile')`);
      await q('select auth.sair($1)', [s!.token]);
      expect(await q('select * from auth.sessao($1)', [s!.token])).toHaveLength(0);
    });
  });

  it('TOTP calculado no banco confere com a RFC 6238 e eleva a sessão para AAL2', async () => {
    await como(null, async ({ q, admin }) => {
      // vetor da RFC 6238 (segredo ASCII "12345678901234567890", T=59s → passo 1); função interna, só admin
      const [r] = await admin<{ c: string }>(`select auth.totp_codigo(convert_to('12345678901234567890', 'UTF8'), 1) as c`);
      expect(r!.c).toBe('287082');
      expect(await falha(q(`select auth.totp_codigo('\\x00'::bytea, 1)`))).toMatch(/permission denied/);

      const [s] = await q<{ token: string }>(`select token from auth.entrar('helena.prado@example.com', 'Demo@2026!', 'web')`);
      const [{ iniciar_totp: seg }] = (await q<{ iniciar_totp: string }>('select auth.iniciar_totp($1)', [s!.token])) as [{ iniciar_totp: string }];
      expect(seg).toHaveLength(40);
      const [ruim] = await q<{ verificar_totp: boolean }>('select auth.verificar_totp($1, $2)', [s!.token, '000000']);
      expect(ruim!.verificar_totp).toBe(totp(seg) === '000000');
      const [bom] = await q<{ verificar_totp: boolean }>('select auth.verificar_totp($1, $2)', [s!.token, totp(seg)]);
      expect(bom!.verificar_totp).toBe(true);
      const [sessao] = await q<{ aal: number; totp_ativo: boolean }>('select * from auth.sessao($1)', [s!.token]);
      expect(sessao).toMatchObject({ aal: 2, totp_ativo: true });
    });
  });
});

describe('Cadastro por convite', () => {
  it('cria a conta com o e-mail do convite, vínculo e pessoa; convite vira uso único', async () => {
    await como(U.dono, async ({ q, trocar }) => {
      const [r] = await q<{ criar_condominio: { convite_token: string } }>(
        `select public.criar_condominio('Res. Parque das Araucárias', 'Londrina', 'PR', 'f0000000-0000-4000-8000-000000000001', 'Silvia@Example.com', 'Sílvia Costa')`,
      );
      const token = r!.criar_condominio.convite_token;
      await trocar(null);
      const [info] = await q<{ email_mascarado: string; valido: boolean; papel: string }>('select * from public.convite_info($1)', [token]);
      expect(info).toMatchObject({ email_mascarado: 'si***@example.com', valido: true, papel: 'sindico' });
      expect(await falha(q(`select public.cadastrar_por_convite($1, 'Sílvia Costa', 'curta')`, [token]))).toMatch(/10 caracteres/);
      const [ok] = await q<{ cadastrar_por_convite: string }>(`select public.cadastrar_por_convite($1, 'Sílvia Costa', 'senha-bem-longa-123')`, [token]);
      expect(ok!.cadastrar_por_convite).toBe('silvia@example.com');
      expect(await falha(q(`select public.cadastrar_por_convite($1, 'X', 'senha-bem-longa-123')`, [token]))).toMatch(/inválido ou expirado/);
      const [s] = await q<{ token: string; user_id: string }>(`select * from auth.entrar('silvia@example.com', 'senha-bem-longa-123', 'web')`);
      await trocar(s!.user_id);
      const [m] = await q<{ papel: string }>('select papel from public.membros_condominio');
      expect(m!.papel).toBe('sindico');
      const [cond] = await q<{ status: string }>('select status from public.condominios');
      expect(cond!.status).toBe('ativo');
    });
  });
});

describe('Reservas, encomendas e push', () => {
  const AREA = '80000000-0000-4000-8000-000000000001';

  it('o banco recusa duas reservas ativas no mesmo horário', async () => {
    await como(U.bruno, async ({ q }) => {
      await q(
        `insert into public.reservas (condominio_id, area_id, unidade_id, inicio, fim) values ($1, $2, $3, '2027-01-10 18:00-03', '2027-01-10 22:00-03')`,
        [C.acacias, AREA, UN.u207A],
      );
      const msg = await falha(
        q(
          `insert into public.reservas (condominio_id, area_id, unidade_id, inicio, fim) values ($1, $2, $3, '2027-01-10 21:00-03', '2027-01-10 23:00-03')`,
          [C.acacias, AREA, UN.u207A],
        ),
      );
      expect(msg).toMatch(/reservas_sem_sobreposicao/);
      // ocupação é visível sem identificar a unidade
      const occ = await q<Record<string, unknown>>(`select * from public.ocupacao_area($1, '2027-01-10', '2027-01-11')`, [AREA]);
      expect(occ).toHaveLength(1);
      expect(Object.keys(occ[0]!)).toEqual(['inicio', 'fim']);
    });
  });

  it('encomenda registrada pela portaria notifica os moradores da unidade', async () => {
    await como(U.portaria, async ({ q, trocar }) => {
      await q(`insert into public.encomendas (condominio_id, unidade_id, descricao) values ($1, $2, 'Caixa pequena · Amazon')`, [C.acacias, UN.u207A]);
      await trocar(U.bruno);
      const n = await q<{ corpo: string }>(`select corpo from public.notificacoes where titulo = 'Chegou uma encomenda'`);
      expect(n.map((x) => x.corpo)).toContain('Caixa pequena · Amazon');
      await trocar(U.ricardo);
      expect(await q(`select * from public.notificacoes where titulo = 'Chegou uma encomenda'`)).toHaveLength(0);
    });
  });

  it('cada usuário só vê e grava os próprios dispositivos de push', async () => {
    await como(U.ricardo, async ({ q, trocar }) => {
      await q(`insert into public.dispositivos_push (user_id, token, plataforma) values ($1, 'ExponentPushToken[ricardo]', 'android')`, [U.ricardo]);
      expect(
        await falha(q(`insert into public.dispositivos_push (user_id, token, plataforma) values ($1, 'ExponentPushToken[x]', 'ios')`, [U.bruno])),
      ).toMatch(/row-level security/);
      await trocar(U.bruno);
      expect(await q('select * from public.dispositivos_push')).toHaveLength(0);
    });
  });
});

describe('Resumo da unidade', () => {
  it('morador vê a contagem de faciais da unidade sem ver as biometrias dos outros', async () => {
    await como(U.ricardo, async ({ q }) => {
      expect(await q('select * from public.biometrias')).toHaveLength(1); // só a própria
      const [r] = await q<{ cadastradas: number; total: number }>('select * from public.resumo_facial_unidade($1)', [UN.u304A]);
      expect(r).toEqual({ cadastradas: 2, total: 2 });
      expect(await falha(q('select * from public.resumo_facial_unidade($1)', [UN.u207A]))).toMatch(/sem permissão/);
    });
  });
});

describe('Conexão real da aplicação (usuário gc_app sem privilégios próprios)', () => {
  it('só enxerga dados assumindo papéis; RLS vale por transação', async () => {
    const adm = await pool.connect();
    try {
      await adm.query(`drop role if exists gc_app_teste`);
      await adm.query(`create role gc_app_teste login noinherit password 'senha-de-teste-123456'`);
      await adm.query('grant anon, authenticated, service_role to gc_app_teste');
    } finally {
      adm.release();
    }
    const url = new URL('postgres://gc_app_teste:senha-de-teste-123456@127.0.0.1:55339/gc_test');
    // Sem papel nenhum: nada.
    const cru = new pg.Client({ connectionString: url.toString() });
    await cru.connect();
    expect(await falha(cru.query('select * from public.pessoas'))).toMatch(/permission denied/);
    await cru.end();

    const db = new Banco({ url: url.toString(), chaveCripto: CHAVE_TESTE, max: 2 });
    try {
      const minhas = await db.comoUsuario(U.ricardo, (q) => q<{ nome: string }>('select nome from public.pessoas order by nome'));
      expect(minhas.map((p) => p.nome)).toEqual(['Lúcia Alves', 'Marina Souza', 'Ricardo Alves']);
      const dono = await db.comoUsuario(U.dono, (q) => q('select nome from public.pessoas'));
      expect(dono).toHaveLength(0);
      await expect(db.comoAnon((q) => q('select * from public.pessoas'))).rejects.toThrow(/permission denied/);
      const todos = await db.comoServico((q) => q<{ n: string }>('select count(*) n from public.pessoas'));
      expect(Number(todos[0]!.n)).toBeGreaterThan(10);
      // a chave vem da transação: CPF completo para o titular
      const [cpf] = await db.comoUsuario(U.ricardo, (q) => q<{ c: string }>(`select public.cpf_completo('50000000-0000-4000-8000-0000000000a4') c`));
      expect(cpf!.c).toBe('13579246828');
    } finally {
      await db.fechar();
    }
  });
});
