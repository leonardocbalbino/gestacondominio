'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { DURACOES_SUPORTE_HORAS, novoCondominioSchema } from '@gc/core';
import { demo } from '@/lib/demo-store';
import { exigirPerfil } from '@/lib/sessao';
import { MODO_DEMO, supabaseServidor } from '@/lib/supabase/server';

export interface EstadoNovoCondominio {
  erro?: string;
  conviteLink?: string;
  nome?: string;
}

export async function criarCondominio(_: EstadoNovoCondominio, form: FormData): Promise<EstadoNovoCondominio> {
  await exigirPerfil('dono');
  const v = novoCondominioSchema.safeParse({
    nome: form.get('nome'),
    cidade: form.get('cidade'),
    uf: form.get('uf'),
    planoId: form.get('planoId'),
    sindicoNome: form.get('sindicoNome'),
    sindicoEmail: form.get('sindicoEmail'),
    cnpj: form.get('cnpj') || undefined,
  });
  if (!v.success) return { erro: v.error.issues[0]?.message ?? 'Dados inválidos' };
  const origem = (await headers()).get('origin') ?? '';

  if (MODO_DEMO) {
    const id = crypto.randomUUID();
    demo().condominios.push({
      condominio_id: id, nome: v.data.nome, cidade: v.data.cidade, uf: v.data.uf, plano: 'Essencial', status: 'implantacao',
      unidades: 0, moradores_ativos: 0, pedidos_30d: 0, biometrias_ativas: 0, hospedes_mes: 0,
    });
    revalidatePath('/dono');
    return { nome: v.data.nome, conviteLink: `${origem}/convite/${crypto.randomUUID().replace(/-/g, '')}` };
  }

  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc('criar_condominio', {
    p_nome: v.data.nome, p_cidade: v.data.cidade, p_uf: v.data.uf, p_plano: v.data.planoId,
    p_sindico_email: v.data.sindicoEmail, p_sindico_nome: v.data.sindicoNome, p_cnpj: v.data.cnpj ?? null,
  });
  if (error) return { erro: 'Não foi possível criar o condomínio' };
  const r = data as { convite_token: string };
  // O e-mail de convite é disparado pela Edge Function "enviar-convite" (fila); aqui o link é mostrado uma única vez.
  revalidatePath('/dono');
  return { nome: v.data.nome, conviteLink: `${origem}/convite/${r.convite_token}` };
}

export async function solicitarSuporte(form: FormData) {
  await exigirPerfil('dono');
  const condominioId = String(form.get('condominioId'));
  const motivo = String(form.get('motivo') ?? '').trim();
  const horas = Number(form.get('horas'));
  if (!motivo || !(DURACOES_SUPORTE_HORAS as readonly number[]).includes(horas)) return;

  if (MODO_DEMO) {
    const c = demo().condominios.find((x) => x.condominio_id === condominioId);
    demo().suporte.unshift({
      id: crypto.randomUUID(), condominioId, condominio: c?.nome ?? '', motivo, duracaoHoras: horas as 1,
      status: 'solicitado', expiraEm: null, criadoEm: new Date(),
    });
  } else {
    const sb = await supabaseServidor();
    await sb.rpc('solicitar_suporte', { p_condominio: condominioId, p_motivo: motivo, p_horas: horas });
  }
  revalidatePath('/dono');
}
