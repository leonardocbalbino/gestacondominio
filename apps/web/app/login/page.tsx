import type { Metadata } from 'next';
import { MODO_DEMO } from '@/lib/db';
import { FormLogin } from './form-login';

export const metadata: Metadata = { title: 'Entrar' };
// O modo (demonstração ou banco real) é decidido em tempo de execução, não no build.
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center gap-6 px-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-primary-dark font-heading text-sm font-bold text-white">GC</div>
        <div>
          <div className="font-heading text-lg font-semibold">GestaCondomínio</div>
          <div className="text-xs text-muted">Painel de gestão</div>
        </div>
      </div>
      <FormLogin demo={MODO_DEMO} />
      <p className="text-center text-xs text-muted">
        Seus dados são tratados conforme a LGPD. <a href="/privacidade">Privacidade</a>
      </p>
    </main>
  );
}
