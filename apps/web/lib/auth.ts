import 'server-only';
import { cookies, headers } from 'next/headers';
import { banco } from './db';

export const COOKIE_SESSAO = 'gc_sessao';

export interface SessaoAuth {
  token: string;
  userId: string;
  aal: number;
  totpAtivo: boolean;
  nome: string;
  email: string;
}

export async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? '';
}

export type ResultadoLogin = { ok: true; token: string; userId: string; totpAtivo: boolean } | { ok: false; erro: 'credenciais' | 'bloqueada' };

export async function autenticar(email: string, senha: string, canal: 'web' | 'mobile'): Promise<ResultadoLogin> {
  const ip = await ipDaRequisicao();
  const ua = (await headers()).get('user-agent') ?? '';
  const [r] = await banco().comoAnon((q) =>
    q<{ token: string | null; user_id: string | null; totp_ativo: boolean | null; erro: string | null }>(
      'select * from auth.entrar($1, $2, $3, $4, $5)',
      [email, senha, canal, ip, ua],
    ),
  );
  if (!r?.token) return { ok: false, erro: r?.erro === 'bloqueada' ? 'bloqueada' : 'credenciais' };
  return { ok: true, token: r.token, userId: r.user_id!, totpAtivo: Boolean(r.totp_ativo) };
}

export async function sessaoPorToken(token: string | undefined | null): Promise<SessaoAuth | null> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const [s] = await banco().comoAnon((q) =>
    q<{ user_id: string; aal: number; totp_ativo: boolean; nome: string | null; email: string }>('select * from auth.sessao($1)', [token]),
  );
  if (!s) return null;
  return { token, userId: s.user_id, aal: s.aal, totpAtivo: s.totp_ativo, nome: s.nome ?? s.email, email: s.email };
}

export async function gravarCookieSessao(token: string) {
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export async function sessaoDoCookie(): Promise<SessaoAuth | null> {
  return sessaoPorToken((await cookies()).get(COOKIE_SESSAO)?.value);
}

export async function encerrarSessao() {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (token) await banco().comoAnon((q) => q('select auth.sair($1)', [token])).catch(() => {});
  jar.delete(COOKIE_SESSAO);
}

/** Base32 (RFC 4648) para o otpauth:// dos apps autenticadores. */
export function base32(hex: string): string {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = Buffer.from(hex, 'hex');
  let bits = 0;
  let valor = 0;
  let out = '';
  for (const b of bytes) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += A[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += A[(valor << (5 - bits)) & 31];
  return out;
}
