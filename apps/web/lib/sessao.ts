import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Perfil } from '@gc/core';
import { IDS } from '@gc/core/demo';
import { MODO_DEMO, supabaseServidor } from './supabase/server';

export interface Sessao {
  userId: string;
  nome: string;
  perfil: Perfil;
  condominioId: string | null;
  condominioNome: string | null;
  demo: boolean;
}

export const COOKIE_DEMO = 'gc_demo_perfil';

const DEMO: Record<string, Sessao> = {
  dono: { userId: 'demo-dono', nome: 'Dono da Plataforma', perfil: 'dono', condominioId: null, condominioNome: null, demo: true },
  sindico: { userId: 'demo-sindico', nome: 'Helena Prado', perfil: 'sindico', condominioId: IDS.condoAcacias, condominioNome: 'Res. Jardim das Acácias', demo: true },
  portaria: { userId: 'demo-portaria', nome: 'José Antunes', perfil: 'portaria', condominioId: IDS.condoAcacias, condominioNome: 'Res. Jardim das Acácias', demo: true },
};

export async function sessaoAtual(): Promise<Sessao | null> {
  if (MODO_DEMO) {
    const perfil = (await cookies()).get(COOKIE_DEMO)?.value;
    return perfil ? (DEMO[perfil] ?? null) : null;
  }
  const sb = await supabaseServidor();
  const { data } = await sb.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const nome = (user.user_metadata?.nome as string | undefined) ?? user.email ?? '';
  const { data: dono } = await sb.from('plataforma_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (dono) return { userId: user.id, nome, perfil: 'dono', condominioId: null, condominioNome: null, demo: false };
  const { data: membros } = await sb
    .from('membros_condominio')
    .select('papel, condominio_id, condominios(nome)')
    .eq('user_id', user.id)
    .eq('ativo', true);
  const ordem: Perfil[] = ['sindico', 'conselho', 'portaria', 'morador', 'hospede'];
  const m = (membros ?? []).sort((a, b) => ordem.indexOf(a.papel as Perfil) - ordem.indexOf(b.papel as Perfil))[0];
  if (!m) return null;
  const cond = m.condominios as unknown as { nome: string } | null;
  return { userId: user.id, nome, perfil: m.papel as Perfil, condominioId: m.condominio_id, condominioNome: cond?.nome ?? null, demo: false };
}

/** Garante sessão com um dos perfis; senão manda para o login. */
export async function exigirPerfil(...perfis: Perfil[]): Promise<Sessao> {
  const s = await sessaoAtual();
  if (!s) redirect('/login');
  if (!perfis.includes(s.perfil)) redirect(destinoDoPerfil(s.perfil));
  return s;
}

export function destinoDoPerfil(p: Perfil): string {
  switch (p) {
    case 'dono':
      return '/dono';
    case 'sindico':
    case 'conselho':
      return '/sindico';
    case 'portaria':
      return '/portaria';
    default:
      return '/privacidade';
  }
}
