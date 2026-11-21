import Link from 'next/link';
import { ROTULO_PAPEL } from '@gc/core';
import type { Sessao } from '@/lib/sessao';
import { sair } from '@/app/login/actions';

export function Painel({ sessao, titulo, children, nav }: { sessao: Sessao; titulo: string; children: React.ReactNode; nav?: { href: string; rotulo: string }[] }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-dark font-heading text-[13px] font-bold text-white">GC</div>
            <div>
              <div className="font-semibold">{sessao.condominioNome ?? 'GestaCondomínio'}</div>
              <div className="text-xs text-muted">
                {sessao.nome} · {ROTULO_PAPEL[sessao.perfil]}
                {sessao.demo ? ' · demonstração' : ''}
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-1" aria-label="Seções">
            {nav?.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-[13px] font-semibold text-ink-2 no-underline hover:bg-surface-2">
                {n.rotulo}
              </Link>
            ))}
            <form action={sair}>
              <button className="min-h-11 cursor-pointer rounded-md border-0 bg-transparent px-3 text-[13px] font-semibold text-muted hover:text-ink">Sair</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
        <h1 className="m-0 font-heading text-2xl font-semibold">{titulo}</h1>
        {children}
      </main>
    </div>
  );
}
