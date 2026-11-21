'use server';

import { revalidatePath } from 'next/cache';
import { expiracaoSuporte } from '@gc/core';
import { banco, MODO_DEMO } from '@/lib/db';
import { demo } from '@/lib/demo-store';
import { exigirPerfil } from '@/lib/sessao';

export async function decidirPedido(form: FormData) {
  const s = await exigirPerfil('sindico');
  const id = String(form.get('id'));
  const tipo = String(form.get('tipo'));
  const aprovar = form.get('decisao') === 'aprovar';
  const motivo = String(form.get('motivo') ?? '') || null;

  if (MODO_DEMO) {
    const p = demo().aprovacoes.find((a) => a.id === id);
    if (p) p.status = aprovar ? (tipo === 'reserva' ? 'confirmada' : 'aprovada') : 'recusada';
  } else {
    await banco().comoUsuario(s.userId, (q) => q('select public.decidir_pedido($1, $2, $3, $4)', [tipo, id, aprovar, motivo]));
  }
  revalidatePath('/sindico');
}

export async function decidirSuporte(form: FormData) {
  const s = await exigirPerfil('sindico');
  const id = String(form.get('id'));
  const aprovar = form.get('decisao') === 'aprovar';
  if (MODO_DEMO) {
    const x = demo().suporte.find((y) => y.id === id);
    if (x && x.status === 'solicitado') {
      x.status = aprovar ? 'aprovado' : 'negado';
      x.expiraEm = aprovar ? expiracaoSuporte(new Date(), x.duracaoHoras) : null;
    }
  } else {
    await banco().comoUsuario(s.userId, (q) => q('select public.decidir_suporte($1, $2)', [id, aprovar]));
  }
  revalidatePath('/sindico');
}

export async function revogarSuporte(form: FormData) {
  const s = await exigirPerfil('sindico');
  const id = String(form.get('id'));
  if (MODO_DEMO) {
    const x = demo().suporte.find((y) => y.id === id);
    if (x) {
      x.status = 'revogado';
      x.expiraEm = new Date();
    }
  } else {
    await banco().comoUsuario(s.userId, (q) => q('select public.revogar_suporte($1)', [id]));
  }
  revalidatePath('/sindico');
}
