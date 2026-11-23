import { NextResponse, type NextRequest } from 'next/server';
import { lerArquivo } from '@/lib/arquivos';
import { banco, MODO_DEMO } from '@/lib/db';
import { exige2fa, sessaoAtual } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Download de documentos da gestão (PDF cifrado em disco).
 * A leitura do caminho passa pelo RLS como o usuário logado: se ele não pode ver o registro, não baixa.
 */
const FONTES = {
  fornecedor: { sql: 'select documento_path as p from public.contratos where id = $1', bucket: 'documentos' },
  locacao: { sql: 'select contrato_path as p from public.locacoes where id = $1', bucket: 'contratos' },
} as const;

export async function GET(_: NextRequest, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  const { tipo, id } = await params;
  const fonte = FONTES[tipo as keyof typeof FONTES];
  const s = await sessaoAtual();
  if (!s || !['sindico', 'conselho'].includes(s.perfil) || (exige2fa(s.perfil) && s.aal < 2)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  }
  if (!fonte || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 });
  if (MODO_DEMO) return NextResponse.json({ erro: 'Sem arquivos no modo demonstração' }, { status: 404 });

  const [r] = await banco().comoUsuario(s.userId, (q) => q<{ p: string | null }>(fonte.sql, [id]));
  if (!r?.p) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 });
  const dados = await lerArquivo(fonte.bucket, r.p);
  return new NextResponse(new Uint8Array(dados), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="contrato-${id.slice(0, 8)}.pdf"`,
      'cache-control': 'private, no-store',
    },
  });
}
