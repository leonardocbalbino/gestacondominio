'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { DURACOES_SUPORTE_HORAS, novoCondominioSchema } from '@gc/core';
import { mensagemDoBanco } from '@gc/db';
import { banco, MODO_DEMO } from '@/lib/db';
import { demo } from '@/lib/demo-store';
import { enviarEmail } from '@/lib/email';
import { exigirPerfil } from '@/lib/sessao';

export interface EstadoNovoCondominio {
  erro?: string;
  conviteLink?: string;
  emailEnviado?: boolean;
  nome?: string;
}

export async function criarCondominio(_: EstadoNovoCondominio, form: FormData): Promise<EstadoNovoCondominio> {
  const s = await exigirPerfil('dono');
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
  const origem = process.env.APP_URL ?? (await headers()).get('origin') ?? '';

  if (MODO_DEMO) {
    const id = crypto.randomUUID();
    demo().condominios.push({
      condominio_id: id, nome: v.data.nome, cidade: v.data.cidade, uf: v.data.uf, plano: 'Essencial', status: 'implantacao',
      unidades: 0, moradores_ativos: 0, pedidos_30d: 0, biometrias_ativas: 0, hospedes_mes: 0,
    });
    revalidatePath('/dono');
    return { nome: v.data.nome, conviteLink: `${origem}/convite/${crypto.randomUUID().replace(/-/g, '')}` };
  }

  let token: string;
  try {
    const [r] = await banco().comoUsuario(s.userId, (q) =>
      q<{ r: { convite_token: string } }>('select public.criar_condominio($1, $2, $3, $4, $5, $6, $7) as r', [
        v.data.nome, v.data.cidade, v.data.uf, v.data.planoId, v.data.sindicoEmail, v.data.sindicoNome, v.data.cnpj ?? null,
      ]),
    );
    token = r!.r.convite_token;
  } catch (e) {
    return { erro: mensagemDoBanco(e, 'Não foi possível criar o condomínio') };
  }
  const link = `${origem}/convite/${token}`;
  const enviado = await enviarEmail(
    v.data.sindicoEmail,
    `Convite: síndico(a) do ${v.data.nome}`,
    `Olá, ${v.data.sindicoNome}!\n\nVocê foi convidado(a) para administrar o ${v.data.nome} no GestaCondomínio.\n` +
      `Crie seu acesso por este link (válido por 7 dias, uso único):\n${link}\n`,
  ).catch(() => false);
  revalidatePath('/dono');
  // Sem SMTP configurado, o link é mostrado uma única vez para o dono repassar.
  return { nome: v.data.nome, emailEnviado: enviado, conviteLink: enviado ? undefined : link };
}

export async function solicitarSuporte(form: FormData) {
  const s = await exigirPerfil('dono');
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
    await banco().comoUsuario(s.userId, (q) => q('select public.solicitar_suporte($1, $2, $3)', [condominioId, motivo, horas]));
  }
  revalidatePath('/dono');
}
