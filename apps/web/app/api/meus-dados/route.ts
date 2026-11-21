import { NextResponse } from 'next/server';
import { sessaoAtual } from '@/lib/sessao';
import { MODO_DEMO, supabaseServidor } from '@/lib/supabase/server';

/** Portabilidade (art. 18, V, LGPD): exporta os dados do próprio titular em JSON. */
export async function GET() {
  const s = await sessaoAtual();
  if (!s) return NextResponse.json({ erro: 'Faça login' }, { status: 401 });
  let dados: unknown;
  if (MODO_DEMO) {
    dados = { gerado_em: new Date().toISOString(), aviso: 'Modo demonstração — dados fictícios', pessoas: [{ nome: s.nome }] };
  } else {
    const sb = await supabaseServidor();
    const { data, error } = await sb.rpc('exportar_meus_dados');
    if (error) return NextResponse.json({ erro: 'Falha ao exportar' }, { status: 500 });
    dados = data;
  }
  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="meus-dados.json"',
      'Cache-Control': 'no-store',
    },
  });
}
