'use server';

import { redirect } from 'next/navigation';
import { TIPOS_PEDIDO_TITULAR, type TipoPedidoTitular } from '@gc/core';
import { sessaoAtual } from '@/lib/sessao';
import { MODO_DEMO, supabaseServidor } from '@/lib/supabase/server';

export async function abrirPedidoTitular(form: FormData) {
  const s = await sessaoAtual();
  if (!s) redirect('/login');
  const tipo = String(form.get('tipo')) as TipoPedidoTitular;
  if (!TIPOS_PEDIDO_TITULAR.includes(tipo)) return;
  if (!MODO_DEMO) {
    const sb = await supabaseServidor();
    const { data: pessoa } = await sb.from('pessoas').select('id, condominio_id').eq('user_id', s.userId).limit(1).maybeSingle();
    if (!pessoa) return;
    await sb.from('pedidos_titular').insert({ condominio_id: pessoa.condominio_id, pessoa_id: pessoa.id, user_id: s.userId, tipo });
  }
  redirect('/privacidade?enviado=1');
}
