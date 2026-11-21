import { NextResponse } from 'next/server';
import { apagarArquivo, salvarArquivo } from '@/lib/arquivos';
import { banco, MODO_DEMO } from '@/lib/db';
import { demo } from '@/lib/demo-store';
import { limitar } from '@/lib/limite';

export const runtime = 'nodejs';
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Recebe a foto do link facial e grava CIFRADA (AES-256-GCM) no armazenamento privado.
 * - nome de arquivo aleatório (sem dado pessoal)
 * - só é aceita com consentimento ativo e link válido (checado no banco); senão o arquivo é apagado
 */
export async function POST(req: Request) {
  if (!(await limitar('facial-foto', 10, 10 * 60_000))) return NextResponse.json({ erro: 'Muitas tentativas' }, { status: 429 });
  const form = await req.formData();
  const token = String(form.get('token') ?? '');
  const foto = form.get('foto');
  if (!token || !(foto instanceof Blob)) return NextResponse.json({ erro: 'Dados incompletos' }, { status: 400 });
  if (foto.size > MAX_BYTES || foto.type !== 'image/jpeg') {
    return NextResponse.json({ erro: 'A foto deve ser JPEG de até 2 MB' }, { status: 400 });
  }

  if (MODO_DEMO) {
    const l = demo().links.get(token);
    if (!l || l.usado || !l.consentiu) return NextResponse.json({ erro: 'Link inválido ou sem consentimento' }, { status: 403 });
    l.usado = true; // no modo demonstração a imagem é descartada
    return NextResponse.json({ ok: true });
  }

  const nome = await salvarArquivo('biometrias', new Uint8Array(await foto.arrayBuffer()));
  try {
    await banco().comoServico((q) => q('select public.registrar_biometria_link($1, $2)', [token, nome]));
  } catch {
    await apagarArquivo('biometrias', nome); // sem base legal, não guarda
    return NextResponse.json({ erro: 'Link expirado ou sem consentimento' }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
