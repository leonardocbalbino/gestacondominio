'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { autenticar, encerrarSessao, gravarCookieSessao, sessaoDoCookie } from '@/lib/auth';
import { banco, MODO_DEMO } from '@/lib/db';
import { limitar } from '@/lib/limite';
import { COOKIE_DEMO, destinoDoPerfil, exige2fa, perfilDoUsuario } from '@/lib/sessao';

export async function entrar(_: unknown, form: FormData): Promise<{ erro?: string }> {
  if (MODO_DEMO) {
    const perfil = String(form.get('perfil') ?? '');
    if (!['dono', 'sindico', 'portaria'].includes(perfil)) return { erro: 'Escolha um perfil' };
    (await cookies()).set(COOKIE_DEMO, perfil, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
    redirect(destinoDoPerfil(perfil as 'dono'));
  }
  if (!(await limitar('login', 10, 5 * 60_000))) return { erro: 'Muitas tentativas. Aguarde alguns minutos.' };

  const r = await autenticar(String(form.get('email') ?? ''), String(form.get('senha') ?? ''), 'web');
  if (!r.ok) return { erro: r.erro === 'bloqueada' ? 'Conta bloqueada por 15 minutos após várias tentativas.' : 'E-mail ou senha incorretos' };
  await gravarCookieSessao(r.token);

  const p = await perfilDoUsuario(r.userId);
  if (!p) return { erro: 'Seu usuário não está vinculado a nenhum condomínio' };
  // 2FA obrigatório para dono, síndico e portaria (opcional com DESATIVAR_2FA=1, só em teste).
  if (exige2fa(p.perfil)) redirect(r.totpAtivo ? '/login/2fa' : '/login/2fa?cadastrar=1');
  redirect(destinoDoPerfil(p.perfil));
}

export async function sair() {
  if (MODO_DEMO) (await cookies()).delete(COOKIE_DEMO);
  else await encerrarSessao();
  redirect('/login');
}

export async function verificarCodigo(_: unknown, form: FormData): Promise<{ erro?: string }> {
  const s = await sessaoDoCookie();
  if (!s) redirect('/login');
  if (!(await limitar(`totp:${s.userId}`, 6, 5 * 60_000))) return { erro: 'Muitas tentativas. Aguarde alguns minutos.' };
  const codigo = String(form.get('codigo') ?? '').replace(/\D/g, '');
  const [r] = await banco().comoAnon((q) => q<{ ok: boolean }>('select auth.verificar_totp($1, $2) as ok', [s.token, codigo]));
  if (!r?.ok) return { erro: 'Código inválido' };
  const p = await perfilDoUsuario(s.userId);
  redirect(p ? destinoDoPerfil(p.perfil) : '/');
}
