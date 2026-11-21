'use server';

import { consentimentoFacialSchema } from '@gc/core';
import { ipDaRequisicao } from '@/lib/auth';
import { banco, MODO_DEMO } from '@/lib/db';
import { demo } from '@/lib/demo-store';
import { limitar } from '@/lib/limite';

/** Registra o consentimento explícito (data, IP e versão do termo) antes de qualquer captura. */
export async function consentir(token: string, versaoTermo: string): Promise<{ ok: boolean; erro?: string }> {
  const v = consentimentoFacialSchema.safeParse({ token, aceite: true, versaoTermo });
  if (!v.success) return { ok: false, erro: 'Link inválido' };
  if (!(await limitar('facial-consentir', 20, 10 * 60_000))) return { ok: false, erro: 'Muitas tentativas. Aguarde alguns minutos.' };

  if (MODO_DEMO) {
    const l = demo().links.get(token);
    if (!l || l.usado) return { ok: false, erro: 'Link expirado' };
    l.consentiu = true;
    return { ok: true };
  }
  const ip = await ipDaRequisicao();
  try {
    await banco().comoAnon((q) => q('select public.link_facial_consentir($1, $2, $3)', [token, versaoTermo, ip]));
    return { ok: true };
  } catch {
    return { ok: false, erro: 'Este link expirou. Peça um novo ao morador.' };
  }
}
