'use server';

import { headers } from 'next/headers';
import { consentimentoFacialSchema } from '@gc/core';
import { demo } from '@/lib/demo-store';
import { MODO_DEMO, supabaseServidor } from '@/lib/supabase/server';

/** Registra o consentimento explícito (data, IP e versão do termo) antes de qualquer captura. */
export async function consentir(token: string, versaoTermo: string): Promise<{ ok: boolean; erro?: string }> {
  const v = consentimentoFacialSchema.safeParse({ token, aceite: true, versaoTermo });
  if (!v.success) return { ok: false, erro: 'Link inválido' };
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';

  if (MODO_DEMO) {
    const l = demo().links.get(token);
    if (!l || l.usado) return { ok: false, erro: 'Link expirado' };
    l.consentiu = true;
    return { ok: true };
  }
  const sb = await supabaseServidor();
  const { error } = await sb.rpc('link_facial_consentir', { p_token: token, p_versao: versaoTermo, p_ip: ip });
  return error ? { ok: false, erro: 'Este link expirou. Peça um novo ao morador.' } : { ok: true };
}
