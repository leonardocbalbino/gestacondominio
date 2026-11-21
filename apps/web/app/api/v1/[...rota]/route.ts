/**
 * API do app do morador (Bearer token de auth.sessoes, canal "mobile").
 * Toda operação roda como o próprio usuário no Postgres → o RLS vale aqui também.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { mensagemDoBanco } from '@gc/db';
import { salvarArquivo } from '@/lib/arquivos';
import { autenticar, sessaoPorToken } from '@/lib/auth';
import { banco, MODO_DEMO } from '@/lib/db';
import { limitar } from '@/lib/limite';
import * as m from '@/lib/morador';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ rota: string[] }> };

const json = (dados: unknown, status = 200) => NextResponse.json(dados, { status, headers: { 'Cache-Control': 'no-store' } });

async function usuario(req: NextRequest): Promise<{ uid: string; token: string } | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const s = await sessaoPorToken(token);
  return s && token ? { uid: s.userId, token } : null;
}

async function tratar(req: NextRequest, ctx: Ctx, metodo: 'GET' | 'POST') {
  if (MODO_DEMO) return json({ erro: 'Servidor em modo demonstração' }, 503);
  const rota = (await ctx.params).rota.join('/');
  try {
    // Rotas públicas
    if (metodo === 'POST' && rota === 'login') {
      if (!(await limitar('login-mobile', 10, 5 * 60_000))) return json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
      const { email, senha } = (await req.json()) as { email?: string; senha?: string };
      const r = await autenticar(String(email ?? ''), String(senha ?? ''), 'mobile');
      if (!r.ok) return json({ erro: r.erro === 'bloqueada' ? 'Conta bloqueada por 15 minutos.' : 'E-mail ou senha incorretos' }, 401);
      return json({ token: r.token });
    }

    const u = await usuario(req);
    if (!u) return json({ erro: 'Sessão expirada' }, 401);
    const corpo = metodo === 'POST' && req.headers.get('content-type')?.includes('json') ? await req.json() : null;
    const base = process.env.APP_URL ?? req.nextUrl.origin;

    switch (`${metodo} ${rota}`) {
      case 'POST sair':
        await banco().comoAnon((q) => q('select auth.sair($1)', [u.token]));
        return json({ ok: true });
      case 'GET inicio':
        return json(await m.inicio(u.uid));
      case 'GET demandas':
        return json(await m.demandas(u.uid));
      case 'POST duvidas':
        await m.enviarDuvida(u.uid, String(corpo?.demandaId), String(corpo?.pergunta ?? ''));
        return json({ ok: true }, 201);
      case 'GET cessao/opcoes':
        return json(await m.opcoesCessao(u.uid));
      case 'POST cessoes':
        await m.criarCessao(u.uid, corpo);
        return json({ ok: true }, 201);
      case 'POST locacoes':
        return json(await m.criarLocacao(u.uid, reviverDatas(corpo), base), 201);
      case 'POST contratos': {
        const form = await req.formData();
        const pdf = form.get('arquivo');
        if (!(pdf instanceof Blob) || pdf.type !== 'application/pdf' || pdf.size > 10 * 1024 * 1024) {
          return json({ erro: 'Envie um PDF de até 10 MB' }, 400);
        }
        const bytes = new Uint8Array(await pdf.arrayBuffer());
        if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') return json({ erro: 'Arquivo não é PDF' }, 400);
        return json({ contratoPath: await salvarArquivo('contratos', bytes) }, 201);
      }
      case 'GET areas':
        return json(await m.areas(u.uid));
      case 'GET ocupacao': {
        const p = req.nextUrl.searchParams;
        return json(await m.ocupacao(u.uid, String(p.get('area')), new Date(String(p.get('de'))), new Date(String(p.get('ate')))));
      }
      case 'POST reservas':
        await m.criarReserva(u.uid, corpo);
        return json({ ok: true }, 201);
      case 'GET assembleias':
        return json(await m.assembleias(u.uid));
      case 'POST votos':
        await m.votar(u.uid, String(corpo?.pautaId), String(corpo?.opcao));
        return json({ ok: true }, 201);
      case 'GET encomendas':
        return json(await m.encomendas(u.uid));
      case 'GET ocorrencias':
        return json(await m.ocorrencias(u.uid));
      case 'POST ocorrencias':
        await m.criarOcorrencia(u.uid, corpo);
        return json({ ok: true }, 201);
      case 'GET meus-dados':
        return json(await m.exportar(u.uid));
      case 'POST facial/revogar':
        await m.revogarFacial(u.uid);
        return json({ ok: true });
      case 'POST pedidos-titular':
        await m.pedidoTitular(u.uid, String(corpo?.tipo));
        return json({ ok: true }, 201);
      case 'POST push':
        await m.registrarPush(u.uid, String(corpo?.token), String(corpo?.plataforma));
        return json({ ok: true });
      default:
        return json({ erro: 'Rota não encontrada' }, 404);
    }
  } catch (e) {
    if (e instanceof m.ErroNegocio) return json({ erro: e.message }, e.status);
    const msg = mensagemDoBanco(e, '');
    if (msg) return json({ erro: msg }, 422);
    console.error('[api/v1]', rota, (e as Error).message);
    return json({ erro: 'Erro interno' }, 500);
  }
}

/** Datas chegam como ISO no JSON. */
function reviverDatas(c: unknown) {
  const o = { ...(c as Record<string, unknown>) };
  for (const k of ['checkin', 'checkout']) if (typeof o[k] === 'string') o[k] = new Date(o[k] as string);
  return o;
}

/** CORS só para a versão web do app (origens em API_ORIGENS, separadas por vírgula). O app nativo não usa CORS. */
function comCors(req: NextRequest, res: NextResponse) {
  const origem = req.headers.get('origin');
  const permitidas = (process.env.API_ORIGENS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (origem && permitidas.includes(origem)) {
    res.headers.set('Access-Control-Allow-Origin', origem);
    res.headers.set('Access-Control-Allow-Headers', 'authorization, content-type');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.headers.set('Vary', 'Origin');
  }
  return res;
}

export const GET = async (req: NextRequest, ctx: Ctx) => comCors(req, await tratar(req, ctx, 'GET'));
export const POST = async (req: NextRequest, ctx: Ctx) => comCors(req, await tratar(req, ctx, 'POST'));
export const OPTIONS = (req: NextRequest) => comCors(req, new NextResponse(null, { status: 204 }));
