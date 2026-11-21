'use server';

import { revalidatePath } from 'next/cache';
import { expiracaoSuporte } from '@gc/core';
import { demo } from '@/lib/demo-store';
import { exigirPerfil } from '@/lib/sessao';
import { MODO_DEMO, supabaseServidor } from '@/lib/supabase/server';

export async function decidirPedido(form: FormData) {
  await exigirPerfil('sindico');
  const id = String(form.get('id'));
  const tipo = String(form.get('tipo'));
  const aprovar = form.get('decisao') === 'aprovar';
  const motivo = String(form.get('motivo') ?? '') || null;

  if (MODO_DEMO) {
    const p = demo().aprovacoes.find((a) => a.id === id);
    if (p) p.status = aprovar ? (tipo === 'reserva' ? 'confirmada' : 'aprovada') : 'recusada';
  } else {
    const sb = await supabaseServidor();
    const { error } = await sb.rpc('decidir_pedido', { p_tipo: tipo, p_id: id, p_aprovar: aprovar, p_motivo: motivo });
    if (error) throw new Error('Não foi possível registrar a decisão');
  }
  revalidatePath('/sindico');
}

export async function decidirSuporte(form: FormData) {
  await exigirPerfil('sindico');
  const id = String(form.get('id'));
  const aprovar = form.get('decisao') === 'aprovar';
  if (MODO_DEMO) {
    const s = demo().suporte.find((x) => x.id === id);
    if (s && s.status === 'solicitado') {
      s.status = aprovar ? 'aprovado' : 'negado';
      s.expiraEm = aprovar ? expiracaoSuporte(new Date(), s.duracaoHoras) : null;
    }
  } else {
    const sb = await supabaseServidor();
    await sb.rpc('decidir_suporte', { p_id: id, p_aprovar: aprovar });
  }
  revalidatePath('/sindico');
}

export async function revogarSuporte(form: FormData) {
  await exigirPerfil('sindico');
  const id = String(form.get('id'));
  if (MODO_DEMO) {
    const s = demo().suporte.find((x) => x.id === id);
    if (s) {
      s.status = 'revogado';
      s.expiraEm = new Date();
    }
  } else {
    const sb = await supabaseServidor();
    await sb.rpc('revogar_suporte', { p_id: id });
  }
  revalidatePath('/sindico');
}
