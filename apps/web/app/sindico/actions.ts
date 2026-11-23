'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { expiracaoSuporte } from '@gc/core';
import { mensagemDoBanco } from '@gc/db';
import { salvarArquivo } from '@/lib/arquivos';
import { banco, MODO_DEMO } from '@/lib/db';
import { demo } from '@/lib/demo-store';
import { demoGestao } from '@/lib/demo-gestao';
import { enviarEmail } from '@/lib/email';
import { CATEGORIAS_CONTRATO, PERIODICIDADES, type CategoriaContrato, type Periodicidade } from '@/lib/gestao';
import { exigirPerfil } from '@/lib/sessao';

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const UUID = /^[0-9a-f-]{36}$/;

/** Revalida toda a área (contadores do menu e visão geral dependem de várias telas). */
const atualizar = () => revalidatePath('/sindico', 'layout');

// ---------------------------------------------------------------------------
// Aprovações
// ---------------------------------------------------------------------------
export async function decidirPedido(form: FormData) {
  const s = await exigirPerfil('sindico');
  const id = txt(form, 'id');
  const tipo = txt(form, 'tipo');
  const aprovar = form.get('decisao') === 'aprovar';
  const motivo = txt(form, 'motivo') || null;

  if (MODO_DEMO) {
    const p = demo().aprovacoes.find((a) => a.id === id);
    if (p) p.status = aprovar ? (tipo === 'reserva' ? 'confirmada' : 'aprovada') : 'recusada';
    const l = demoGestao().locacoes.find((x) => x.id === id);
    if (l) Object.assign(l, { status: aprovar ? 'aprovada' : 'recusada', motivo, decididoEm: new Date() });
    if (p) demoGestao().decisoes.unshift({ tipo: p.tipo, titulo: p.titulo, unidade: p.unidade, status: aprovar ? 'aprovada' : 'recusada', quando: new Date(), motivo });
  } else {
    await banco().comoUsuario(s.userId, (q) => q('select public.decidir_pedido($1, $2, $3, $4)', [tipo, id, aprovar, motivo]));
  }
  atualizar();
}

// ---------------------------------------------------------------------------
// Acesso do suporte (break-glass)
// ---------------------------------------------------------------------------
export async function decidirSuporte(form: FormData) {
  const s = await exigirPerfil('sindico');
  const id = txt(form, 'id');
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
  atualizar();
}

export async function revogarSuporte(form: FormData) {
  const s = await exigirPerfil('sindico');
  const id = txt(form, 'id');
  if (MODO_DEMO) {
    const x = demo().suporte.find((y) => y.id === id);
    if (x) {
      x.status = 'revogado';
      x.expiraEm = new Date();
    }
  } else {
    await banco().comoUsuario(s.userId, (q) => q('select public.revogar_suporte($1)', [id]));
  }
  atualizar();
}

// ---------------------------------------------------------------------------
// Aluguéis e temporadas
// ---------------------------------------------------------------------------
export async function encerrarLocacao(form: FormData) {
  const s = await exigirPerfil('sindico');
  const id = txt(form, 'id');
  const motivo = txt(form, 'motivo') || null;
  if (!UUID.test(id)) return;
  if (MODO_DEMO) {
    const l = demoGestao().locacoes.find((x) => x.id === id);
    if (l) Object.assign(l, { status: l.status === 'aprovada' ? 'encerrada' : 'cancelada', fim: new Date(Math.min(l.fim.getTime(), Date.now())), motivo });
  } else {
    try {
      await banco().comoUsuario(s.userId, (q) => q('select public.encerrar_locacao($1, $2)', [id, motivo]));
    } catch (e) {
      redirect(`/sindico/alugueis/${id}?erro=${encodeURIComponent(mensagemDoBanco(e))}`);
    }
  }
  atualizar();
  redirect(`/sindico/alugueis/${id}?ok=encerrada`);
}

// ---------------------------------------------------------------------------
// Contratos com fornecedores
// ---------------------------------------------------------------------------
async function pdfDoForm(form: FormData): Promise<Uint8Array | null | 'invalido'> {
  const f = form.get('documento');
  if (!(f instanceof Blob) || f.size === 0) return null;
  if (f.size > 10 * 1024 * 1024) return 'invalido';
  const bytes = new Uint8Array(await f.arrayBuffer());
  return new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-' ? bytes : 'invalido';
}

export async function salvarContrato(form: FormData) {
  const s = await exigirPerfil('sindico');
  const id = txt(form, 'id');
  const volta = id ? `/sindico/contratos/${id}` : '/sindico/contratos/novo';
  const erro = (m: string) => redirect(`${volta}?erro=${encodeURIComponent(m)}`);

  const categoria = txt(form, 'categoria') as CategoriaContrato;
  const periodicidade = txt(form, 'periodicidade') as Periodicidade;
  const valorTxt = txt(form, 'valor').replace(/\./g, '').replace(',', '.');
  const v = {
    fornecedor: txt(form, 'fornecedor'),
    cnpj: txt(form, 'cnpj') || null,
    contato: txt(form, 'contato') || null,
    objeto: txt(form, 'objeto'),
    valor: valorTxt ? Number(valorTxt) : null,
    inicio: txt(form, 'inicio'),
    fim: txt(form, 'fim') || null,
    renovacao: form.get('renovacao') === 'on',
    aviso: Number(txt(form, 'aviso') || 30),
    observacoes: txt(form, 'observacoes') || null,
  };
  if (v.fornecedor.length < 2) return erro('Informe o fornecedor');
  if (v.objeto.length < 2) return erro('Descreva o objeto do contrato');
  if (!(categoria in CATEGORIAS_CONTRATO) || !(periodicidade in PERIODICIDADES)) return erro('Categoria ou periodicidade inválida');
  if (v.valor != null && (!Number.isFinite(v.valor) || v.valor < 0)) return erro('Valor inválido');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.inicio)) return erro('Informe a data de início');
  if (v.fim && (!/^\d{4}-\d{2}-\d{2}$/.test(v.fim) || v.fim < v.inicio)) return erro('A data de fim deve ser depois do início');
  if (!Number.isInteger(v.aviso) || v.aviso < 0 || v.aviso > 365) return erro('Aviso deve ser de 0 a 365 dias');
  const pdf = await pdfDoForm(form);
  if (pdf === 'invalido') return erro('O documento precisa ser um PDF de até 10 MB');

  let novoId = id;
  if (MODO_DEMO) {
    const dados = {
      fornecedor: v.fornecedor, cnpj: v.cnpj, contato: v.contato, categoria, objeto: v.objeto, valor: v.valor, periodicidade,
      inicio: new Date(`${v.inicio}T00:00:00-03:00`), fim: v.fim ? new Date(`${v.fim}T00:00:00-03:00`) : null,
      renovacaoAutomatica: v.renovacao, avisoDias: v.aviso, observacoes: v.observacoes,
    };
    const lista = demoGestao().contratos;
    const c = lista.find((x) => x.id === id);
    if (c) Object.assign(c, dados, pdf ? { temDocumento: true } : {});
    else {
      novoId = crypto.randomUUID();
      lista.unshift({ id: novoId, ...dados, status: 'ativo', encerradoEm: null, temDocumento: Boolean(pdf) });
    }
  } else {
    const caminho = pdf ? await salvarArquivo('documentos', pdf) : null;
    const p = [s.condominioId, v.fornecedor, v.cnpj, v.contato, categoria, v.objeto, v.valor, periodicidade, v.inicio, v.fim, v.renovacao, v.aviso, v.observacoes, caminho];
    try {
      if (id) {
        if (!UUID.test(id)) return erro('Contrato inválido');
        await banco().comoUsuario(s.userId, (q) =>
          q(
            `update public.contratos set fornecedor = $2, cnpj_fornecedor = $3, contato_fornecedor = $4, categoria = $5, objeto = $6, valor = $7,
                    periodicidade = $8, inicio = $9, fim = $10, renovacao_automatica = $11, aviso_dias = $12, observacoes = $13,
                    documento_path = coalesce($14, documento_path), updated_at = now()
              where condominio_id = $1 and id = $15`,
            [...p, id],
          ),
        );
      } else {
        const [r] = await banco().comoUsuario(s.userId, (q) =>
          q<{ id: string }>(
            `insert into public.contratos (condominio_id, fornecedor, cnpj_fornecedor, contato_fornecedor, categoria, objeto, valor, periodicidade,
                    inicio, fim, renovacao_automatica, aviso_dias, observacoes, documento_path)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning id`,
            p,
          ),
        );
        novoId = r!.id;
      }
    } catch (e) {
      return erro(mensagemDoBanco(e, 'Não foi possível salvar o contrato'));
    }
  }
  atualizar();
  redirect(`/sindico/contratos/${novoId}?ok=salvo`);
}

export async function encerrarContrato(form: FormData) {
  const s = await exigirPerfil('sindico');
  const id = txt(form, 'id');
  const reabrir = form.get('acao') === 'reabrir';
  if (!UUID.test(id)) return;
  if (MODO_DEMO) {
    const c = demoGestao().contratos.find((x) => x.id === id);
    if (c) Object.assign(c, reabrir ? { status: 'ativo', encerradoEm: null } : { status: 'encerrado', encerradoEm: new Date() });
  } else {
    await banco().comoUsuario(s.userId, (q) =>
      q(
        reabrir
          ? `update public.contratos set status = 'ativo', encerrado_em = null where condominio_id = $1 and id = $2`
          : `update public.contratos set status = 'encerrado', encerrado_em = current_date where condominio_id = $1 and id = $2`,
        [s.condominioId, id],
      ),
    );
  }
  atualizar();
  redirect(`/sindico/contratos/${id}?ok=${reabrir ? 'reaberto' : 'encerrado'}`);
}

// ---------------------------------------------------------------------------
// Moradores
// ---------------------------------------------------------------------------
export interface EstadoConvite {
  erro?: string;
  ok?: string;
  link?: string;
}

export async function convidarMorador(_: EstadoConvite, form: FormData): Promise<EstadoConvite> {
  const s = await exigirPerfil('sindico');
  const unidade = txt(form, 'unidade');
  const nome = txt(form, 'nome');
  const email = txt(form, 'email').toLowerCase();
  const tipo = txt(form, 'tipo');
  if (!UUID.test(unidade)) return { erro: 'Escolha a unidade' };
  if (nome.length < 2) return { erro: 'Informe o nome' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { erro: 'E-mail inválido' };
  if (!['proprietario', 'inquilino', 'residente'].includes(tipo)) return { erro: 'Escolha o tipo de vínculo' };
  const origem = process.env.APP_URL ?? (await headers()).get('origin') ?? '';

  if (MODO_DEMO) {
    const u = demoGestao().unidades.find((x) => x.id === unidade);
    u?.convitesPendentes.push({ nome, email, tipo: { proprietario: 'Proprietário', inquilino: 'Inquilino', residente: 'Residente' }[tipo]! });
    atualizar();
    return { ok: `Convite criado para ${nome}.`, link: `${origem}/convite/demo-${crypto.randomUUID().slice(0, 8)}` };
  }
  let token: string;
  try {
    const [r] = await banco().comoUsuario(s.userId, (q) =>
      q<{ t: string }>('select public.convidar_morador($1, $2, $3, $4) as t', [unidade, nome, email, tipo]),
    );
    token = r!.t;
  } catch (e) {
    return { erro: mensagemDoBanco(e, 'Não foi possível criar o convite') };
  }
  const link = `${origem}/convite/${token}`;
  const enviado = await enviarEmail(
    email,
    `Convite: ${s.condominioNome ?? 'seu condomínio'} no GestaCondomínio`,
    `Olá, ${nome}!\n\nO síndico do ${s.condominioNome ?? 'condomínio'} convidou você para o app GestaCondomínio.\n` +
      `Crie seu acesso por este link (válido por 7 dias, uso único):\n${link}\n\nDepois, baixe o app e entre com este e-mail.`,
  ).catch(() => false);
  atualizar();
  return enviado ? { ok: `Convite enviado para ${email}.` } : { ok: 'E-mail não configurado: envie este link ao morador (aparece só agora).', link };
}

// ---------------------------------------------------------------------------
// Ocorrências e comunicados
// ---------------------------------------------------------------------------
export async function atualizarOcorrencia(form: FormData) {
  const s = await exigirPerfil('sindico');
  const id = txt(form, 'id');
  const status = txt(form, 'status');
  const resposta = txt(form, 'resposta') || null;
  if (!['aberta', 'em_andamento', 'resolvida'].includes(status)) return;
  if (MODO_DEMO) {
    const o = demoGestao().ocorrencias.find((x) => x.id === id);
    if (o) Object.assign(o, { status, resposta: resposta ?? o.resposta });
  } else {
    if (!UUID.test(id)) return;
    await banco().comoUsuario(s.userId, (q) =>
      q(
        `update public.ocorrencias set status = $3, resposta = coalesce($4, resposta),
                respondida_em = case when $4::text is not null then now() else respondida_em end, updated_at = now()
          where condominio_id = $1 and id = $2`,
        [s.condominioId, id, status, resposta],
      ),
    );
  }
  atualizar();
}

export async function publicarComunicado(form: FormData) {
  const s = await exigirPerfil('sindico', 'conselho');
  const titulo = txt(form, 'titulo');
  const corpo = txt(form, 'corpo');
  if (titulo.length < 3 || corpo.length < 3) redirect('/sindico/comunicados?erro=' + encodeURIComponent('Preencha título e texto'));
  if (MODO_DEMO) demoGestao().comunicados.unshift({ id: crypto.randomUUID(), titulo, corpo, publicadoEm: new Date() });
  else {
    await banco().comoUsuario(s.userId, (q) =>
      q('insert into public.comunicados (condominio_id, titulo, corpo, created_by) values ($1, $2, $3, $4)', [s.condominioId, titulo, corpo, s.userId]),
    );
  }
  atualizar();
  redirect('/sindico/comunicados?ok=publicado');
}

export async function excluirComunicado(form: FormData) {
  const s = await exigirPerfil('sindico', 'conselho');
  const id = txt(form, 'id');
  if (MODO_DEMO) {
    const l = demoGestao().comunicados;
    const i = l.findIndex((x) => x.id === id);
    if (i >= 0) l.splice(i, 1);
  } else if (UUID.test(id)) {
    await banco().comoUsuario(s.userId, (q) => q('delete from public.comunicados where condominio_id = $1 and id = $2', [s.condominioId, id]));
  }
  atualizar();
}
