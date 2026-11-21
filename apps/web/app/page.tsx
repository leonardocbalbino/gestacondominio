import { redirect } from 'next/navigation';
import { destinoDoPerfil, sessaoAtual } from '@/lib/sessao';

export default async function Page() {
  const s = await sessaoAtual();
  redirect(s ? destinoDoPerfil(s.perfil) : '/login');
}
