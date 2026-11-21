import type { Metadata } from 'next';
import { DoisFatores } from './dois-fatores';

export const metadata: Metadata = { title: 'Verificação em duas etapas' };

export default async function Page({ searchParams }: { searchParams: Promise<{ cadastrar?: string }> }) {
  const { cadastrar } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center gap-4 px-5">
      <h1 className="m-0 font-heading text-2xl font-semibold">Verificação em duas etapas</h1>
      <p className="m-0 text-muted">
        Obrigatória para dono do sistema, síndico e portaria. Use um app autenticador (Google Authenticator, Authy, 1Password…).
      </p>
      <DoisFatores cadastrar={cadastrar === '1'} />
    </main>
  );
}
