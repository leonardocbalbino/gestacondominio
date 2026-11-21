'use server';

import { revalidatePath } from 'next/cache';
import { demo } from '@/lib/demo-store';
import { exigirPerfil } from '@/lib/sessao';
import { MODO_DEMO, supabaseServidor } from '@/lib/supabase/server';

const TIPOS = ['entrada', 'saida', 'visitante', 'prestador', 'entrega'] as const;

export async function registrarAcesso(form: FormData) {
  const s = await exigirPerfil('portaria', 'sindico');
  const tipo = String(form.get('tipo'));
  const unidade = String(form.get('unidade') ?? '').trim().toUpperCase();
  if (!TIPOS.includes(tipo as (typeof TIPOS)[number]) || !unidade) return;

  if (MODO_DEMO) {
    demo().portaria.registros.unshift({ quando: new Date(), unidade, tipo, meio: 'portaria' });
  } else {
    const sb = await supabaseServidor();
    const { data: u } = await sb.from('unidades').select('id').eq('condominio_id', s.condominioId!).eq('codigo', unidade).maybeSingle();
    await sb.from('registros_acesso').insert({
      condominio_id: s.condominioId, unidade_id: u?.id ?? null, tipo, meio: 'portaria',
      observacao: String(form.get('obs') ?? '') || null,
    });
  }
  revalidatePath('/portaria');
}
