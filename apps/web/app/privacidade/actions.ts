'use server';

import { redirect } from 'next/navigation';
import { TIPOS_PEDIDO_TITULAR, type TipoPedidoTitular } from '@gc/core';
import { banco, MODO_DEMO } from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao';

export async function abrirPedidoTitular(form: FormData) {
  const s = await sessaoAtual();
  if (!s) redirect('/login');
  const tipo = String(form.get('tipo')) as TipoPedidoTitular;
  if (!TIPOS_PEDIDO_TITULAR.includes(tipo)) return;
  if (!MODO_DEMO) {
    await banco().comoUsuario(s.userId, (q) =>
      q(
        `insert into public.pedidos_titular (condominio_id, pessoa_id, user_id, tipo)
         select condominio_id, id, $1, $2 from public.pessoas where user_id = $1 limit 1`,
        [s.userId, tipo],
      ),
    );
  }
  redirect('/privacidade?enviado=1');
}
