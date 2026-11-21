'use server';

import { revalidatePath } from 'next/cache';
import { banco, MODO_DEMO } from '@/lib/db';
import { demo } from '@/lib/demo-store';
import { exigirPerfil } from '@/lib/sessao';

const TIPOS = ['entrada', 'saida', 'visitante', 'prestador', 'entrega'] as const;

export async function registrarAcesso(form: FormData) {
  const s = await exigirPerfil('portaria', 'sindico');
  const tipo = String(form.get('tipo'));
  const unidade = String(form.get('unidade') ?? '').trim().toUpperCase();
  if (!TIPOS.includes(tipo as (typeof TIPOS)[number]) || !unidade) return;

  if (MODO_DEMO) {
    demo().portaria.registros.unshift({ quando: new Date(), unidade, tipo, meio: 'portaria' });
  } else {
    await banco().comoUsuario(s.userId, (q) =>
      q(
        `insert into public.registros_acesso (condominio_id, unidade_id, tipo, meio, observacao)
         values ($1, (select id from public.unidades where condominio_id = $1 and codigo = $2), $3, 'portaria', nullif($4, ''))`,
        [s.condominioId, unidade, tipo, String(form.get('obs') ?? '')],
      ),
    );
  }
  revalidatePath('/portaria');
}

/** Encomenda recebida: o banco notifica os moradores da unidade (trigger). */
export async function registrarEncomenda(form: FormData) {
  const s = await exigirPerfil('portaria', 'sindico');
  const unidade = String(form.get('unidade') ?? '').trim().toUpperCase();
  const descricao = String(form.get('descricao') ?? '').trim();
  if (!unidade || !descricao) return;
  if (!MODO_DEMO) {
    await banco().comoUsuario(s.userId, (q) =>
      q(
        `insert into public.encomendas (condominio_id, unidade_id, descricao)
         select $1, id, $3 from public.unidades where condominio_id = $1 and codigo = $2`,
        [s.condominioId, unidade, descricao],
      ),
    );
  }
  revalidatePath('/portaria');
}
