import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { EXIGE_2FA, type Perfil } from '@gc/core';
import { IDS } from '@gc/core/demo';
import { sessaoDoCookie } from './auth';
import { banco, MODO_DEMO } from './db';

export interface Sessao {
  userId: string;
  nome: string;
  perfil: Perfil;
  condominioId: string | null;
  condominioNome: string | null;
  demo: boolean;
  /** 2 = senha + TOTP */
  aal: number;
  totpAtivo: boolean;
}

export const COOKIE_DEMO = 'gc_demo_perfil';

const DEMO: Record<string, Sessao> = {
  dono: { userId: 'demo-dono', nome: 'Dono da Plataforma', perfil: 'dono', condominioId: null, condominioNome: null, demo: true, aal: 2, totpAtivo: true },
  sindico: { userId: 'demo-sindico', nome: 'Helena Prado', perfil: 'sindico', condominioId: IDS.condoAcacias, condominioNome: 'Res. Jardim das Acácias', demo: true, aal: 2, totpAtivo: true },
  portaria: { userId: 'demo-portaria', nome: 'José Antunes', perfil: 'portaria', condominioId: IDS.condoAcacias, condominioNome: 'Res. Jardim das Acácias', demo: true, aal: 2, totpAtivo: true },
};

const ORDEM: Perfil[] = ['sindico', 'conselho', 'portaria', 'morador', 'hospede'];

/** Perfil principal do usuário, lido sob RLS (cada um só enxerga os próprios vínculos). */
export async function perfilDoUsuario(userId: string): Promise<{ perfil: Perfil; condominioId: string | null; condominioNome: string | null } | null> {
  return banco().comoUsuario(userId, async (q) => {
    const dono = await q('select 1 from public.plataforma_admins where user_id = $1', [userId]);
    if (dono.length) return { perfil: 'dono' as Perfil, condominioId: null, condominioNome: null };
    const membros = await q<{ papel: Perfil; condominio_id: string; nome: string }>(
      `select m.papel::text as papel, m.condominio_id, c.nome
         from public.membros_condominio m join public.condominios c on c.id = m.condominio_id
        where m.user_id = $1 and m.ativo`,
      [userId],
    );
    const m = membros.sort((a, b) => ORDEM.indexOf(a.papel) - ORDEM.indexOf(b.papel))[0];
    return m ? { perfil: m.papel, condominioId: m.condominio_id, condominioNome: m.nome } : null;
  });
}

export async function sessaoAtual(): Promise<Sessao | null> {
  if (MODO_DEMO) {
    const perfil = (await cookies()).get(COOKIE_DEMO)?.value;
    return perfil ? (DEMO[perfil] ?? null) : null;
  }
  const s = await sessaoDoCookie();
  if (!s) return null;
  const p = await perfilDoUsuario(s.userId);
  if (!p) return null;
  return { userId: s.userId, nome: s.nome, ...p, demo: false, aal: s.aal, totpAtivo: s.totpAtivo };
}

/** Garante sessão com um dos perfis (e 2FA quando exigido); senão redireciona. */
export async function exigirPerfil(...perfis: Perfil[]): Promise<Sessao> {
  const s = await sessaoAtual();
  if (!s) redirect('/login');
  if (EXIGE_2FA.includes(s.perfil) && s.aal < 2) redirect(s.totpAtivo ? '/login/2fa' : '/login/2fa?cadastrar=1');
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
