import { NextResponse } from 'next/server';
import { demo } from '@/lib/demo-store';
import { MODO_DEMO, supabaseServico } from '@/lib/supabase/server';

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Recebe a foto do link facial e grava no bucket PRIVADO "biometrias".
 * - nome do arquivo aleatório (sem dados pessoais no caminho)
 * - a gravação só é aceita se houver consentimento ativo (checado no banco)
 * - nada é logado além do resultado
 */
export async function POST(req: Request) {
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

  const sb = await supabaseServico();
  const path = `${crypto.randomUUID()}.jpg`;
  const up = await sb.storage.from('biometrias').upload(path, foto, { contentType: 'image/jpeg', upsert: false });
  if (up.error) return NextResponse.json({ erro: 'Falha ao gravar a foto' }, { status: 500 });
  const { error } = await sb.rpc('registrar_biometria_link', { p_token: token, p_path: path });
  if (error) {
    await sb.storage.from('biometrias').remove([path]); // sem base legal, não guarda
    return NextResponse.json({ erro: 'Link expirado ou sem consentimento' }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
