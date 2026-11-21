'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_DEMO, destinoDoPerfil, sessaoAtual } from '@/lib/sessao';
import { MODO_DEMO, supabaseServidor } from '@/lib/supabase/server';

export async function entrar(_: unknown, form: FormData): Promise<{ erro?: string }> {
  if (MODO_DEMO) {
    const perfil = String(form.get('perfil') ?? '');
    if (!['dono', 'sindico', 'portaria'].includes(perfil)) return { erro: 'Escolha um perfil' };
    (await cookies()).set(COOKIE_DEMO, perfil, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
    redirect(destinoDoPerfil(perfil as 'dono'));
  }
  const sb = await supabaseServidor();
  const { error } = await sb.auth.signInWithPassword({
    email: String(form.get('email') ?? ''),
    password: String(form.get('senha') ?? ''),
  });
  if (error) return { erro: 'E-mail ou senha incorretos' };

  // 2FA obrigatório para dono, síndico e portaria (AAL2 do Supabase Auth).
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') redirect('/login/2fa');

  const s = await sessaoAtual();
  if (!s) return { erro: 'Seu usuário não está vinculado a nenhum condomínio' };
  if (['dono', 'sindico', 'portaria'].includes(s.perfil) && aal?.nextLevel !== 'aal2') redirect('/login/2fa?cadastrar=1');
  redirect(destinoDoPerfil(s.perfil));
}

export async function sair() {
  if (MODO_DEMO) (await cookies()).delete(COOKIE_DEMO);
  else await (await supabaseServidor()).auth.signOut();
  redirect('/login');
}
