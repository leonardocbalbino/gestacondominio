import { ROTULO_PAPEL } from '@gc/core';
import type { Sessao } from '@/lib/sessao';
import { sair } from '@/app/login/actions';
import { NavLateral, type ItemNav } from './nav-lateral';

/** Moldura dos painéis: topo com condomínio/usuário e menu lateral (abas roláveis no celular). */
export function Moldura({ sessao, nav, children }: { sessao: Sessao; nav: ItemNav[]; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-primary-dark font-heading text-[13px] font-bold text-white">GC</div>
            <div className="min-w-0">
              <div className="truncate font-semibold">{sessao.condominioNome ?? 'GestaCondomínio'}</div>
              <div className="truncate text-xs text-muted">
                {sessao.nome} · {ROTULO_PAPEL[sessao.perfil]}
                {sessao.demo ? ' · demonstração' : ''}
              </div>
            </div>
          </div>
          <form action={sair}>
            <button className="min-h-10 cursor-pointer rounded-md border border-line bg-surface px-3 text-[13px] font-semibold text-ink-2 hover:border-primary">Sair</button>
          </form>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[220px_1fr] lg:gap-8 lg:py-7">
        <aside className="lg:sticky lg:top-[76px] lg:self-start">
          <NavLateral itens={nav} />
        </aside>
        <main className="flex min-w-0 flex-col gap-5">{children}</main>
      </div>
    </div>
  );
}

/** Título da página com descrição e ações à direita. */
export function Cabecalho({ titulo, descricao, acoes }: { titulo: string; descricao?: React.ReactNode; acoes?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="m-0 font-heading text-2xl font-semibold">{titulo}</h1>
        {descricao ? <p className="m-0 mt-1 text-[14px] text-muted">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap gap-2">{acoes}</div> : null}
    </div>
  );
}

/** Compatível com dono e portaria: moldura + título numa chamada só. */
export function Painel({ sessao, titulo, children, nav }: { sessao: Sessao; titulo: string; children: React.ReactNode; nav?: ItemNav[] }) {
  return (
    <Moldura sessao={sessao} nav={nav ?? []}>
      <Cabecalho titulo={titulo} />
      {children}
    </Moldura>
  );
}
