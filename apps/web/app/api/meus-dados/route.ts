import { NextResponse } from 'next/server';
import { banco, MODO_DEMO } from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao';

export const runtime = 'nodejs';

/** Portabilidade (art. 18, V, LGPD): exporta os dados do próprio titular em JSON. */
export async function GET() {
  const s = await sessaoAtual();
  if (!s) return NextResponse.json({ erro: 'Faça login' }, { status: 401 });
  const dados = MODO_DEMO
    ? { gerado_em: new Date().toISOString(), aviso: 'Modo demonstração — dados fictícios', pessoas: [{ nome: s.nome }] }
    : (await banco().comoUsuario(s.userId, (q) => q<{ d: unknown }>('select public.exportar_meus_dados() as d')))[0]?.d;
  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="meus-dados.json"',
      'Cache-Control': 'no-store',
    },
  });
}
