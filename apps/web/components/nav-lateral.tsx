'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export type NomeIcone =
  | 'inicio' | 'aprovacoes' | 'alugueis' | 'contratos' | 'moradores' | 'ocorrencias' | 'comunicados' | 'suporte'
  | 'privacidade' | 'portaria' | 'plataforma';

export interface ItemNav {
  href: string;
  rotulo: string;
  icone: NomeIcone;
  contador?: number;
  /** Ativo só na rota exata (ex.: "Visão geral" em /sindico). */
  exato?: boolean;
}

const D: Record<NomeIcone, string> = {
  inicio: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  aprovacoes: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  alugueis: 'M15 7a4 4 0 1 1-3.9 4.9L3 20v-3l2-1v-2h2l1.9-1.9A4 4 0 0 1 15 7Zm1.5 2.5h.01',
  contratos: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6M9 17h4',
  moradores: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm10 9v-1.5a3.5 3.5 0 0 0-2.5-3.3M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  ocorrencias: 'M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  comunicados: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Zm13-3a5 5 0 0 1 0 8m2.5-10.5a8.5 8.5 0 0 1 0 13',
  suporte: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z',
  privacidade: 'M6 10V8a6 6 0 1 1 12 0v2M5 10h14v11H5zM12 14v3',
  portaria: 'M3 21V7l9-4 9 4v14M9 21v-6h6v6',
  plataforma: 'M4 5h16v10H4zM8 19h8M12 15v4',
};

export function Icone({ nome, className }: { nome: NomeIcone; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('h-[18px] w-[18px] flex-none', className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={D[nome]} />
    </svg>
  );
}

function ativo(path: string, item: ItemNav) {
  return item.exato ? path === item.href : path === item.href || path.startsWith(item.href + '/');
}

export function NavLateral({ itens }: { itens: ItemNav[] }) {
  const path = usePathname();
  return (
    <>
      {/* Computador: coluna lateral */}
      <nav aria-label="Seções" className="hidden flex-col gap-0.5 lg:flex">
        {itens.map((i) => {
          const on = ativo(path, i);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-[14px] font-semibold no-underline transition-colors',
                on ? 'bg-primary-soft text-primary-dark' : 'text-ink-2 hover:bg-surface-2',
              )}
            >
              <Icone nome={i.icone} className={on ? 'text-primary' : 'text-muted'} />
              <span className="flex-1">{i.rotulo}</span>
              {i.contador ? (
                <span className="min-w-5 rounded-full bg-alert px-1.5 text-center text-[11px] font-bold leading-5 text-white">{i.contador}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      {/* Celular/tablet: abas roláveis */}
      <nav aria-label="Seções" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden">
        {itens.map((i) => {
          const on = ativo(path, i);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'flex min-h-10 flex-none items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold no-underline',
                on ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-2',
              )}
            >
              <Icone nome={i.icone} className="h-4 w-4" />
              {i.rotulo}
              {i.contador ? <span className={cn('rounded-full px-1.5 text-[11px] font-bold', on ? 'bg-white text-primary' : 'bg-alert text-white')}>{i.contador}</span> : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
