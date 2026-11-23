import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Mensagem de retorno de uma ação (?ok= / ?erro=). */
export function Aviso({ ok, erro }: { ok?: string | null; erro?: string | null }) {
  if (!ok && !erro) return null;
  return (
    <p
      role={erro ? 'alert' : 'status'}
      className={cn('m-0 rounded-lg px-4 py-3 text-[14px] font-semibold', erro ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success')}
    >
      {erro ?? ok}
    </p>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="m-0 px-4 py-8 text-center text-[14px] text-muted">{children}</p>;
}

/** Indicador numérico da visão geral, opcionalmente clicável. */
export function Indicador({ rotulo, valor, detalhe, href, tom = 'neu' }: { rotulo: string; valor: React.ReactNode; detalhe?: string; href?: string; tom?: 'neu' | 'warn' | 'bad' | 'ok' }) {
  const cor = { neu: 'text-ink', warn: 'text-warning', bad: 'text-danger', ok: 'text-success' }[tom];
  const corpo = (
    <>
      <div className="text-[13px] font-semibold text-muted">{rotulo}</div>
      <div className={cn('mt-1 font-heading text-[28px] font-semibold leading-none', cor)}>{valor}</div>
      {detalhe ? <div className="mt-1.5 text-xs text-muted">{detalhe}</div> : null}
    </>
  );
  const cls = 'block rounded-xl border border-line bg-surface p-4 no-underline';
  return href ? (
    <Link href={href} className={cn(cls, 'text-ink transition-colors hover:border-primary')}>
      {corpo}
    </Link>
  ) : (
    <div className={cls}>{corpo}</div>
  );
}

/** Abas por parâmetro de URL (filtros de lista). */
export function Abas({ itens, ativo }: { itens: { valor: string; rotulo: string; href: string; contador?: number }[]; ativo: string }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-xl bg-segment p-1">
      {itens.map((i) => (
        <Link
          key={i.valor}
          role="tab"
          aria-selected={i.valor === ativo}
          href={i.href}
          className={cn(
            'flex min-h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold no-underline',
            i.valor === ativo ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
          )}
        >
          {i.rotulo}
          {i.contador != null ? <span className="text-xs font-bold text-muted">{i.contador}</span> : null}
        </Link>
      ))}
    </div>
  );
}

/** Linha "rótulo: valor" das telas de detalhe. */
export function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-muted">{rotulo}</dt>
      <dd className="m-0 text-[14px]">{children ?? '—'}</dd>
    </div>
  );
}

export const linkBotao =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-semibold no-underline';
export const linkPrimario = cn(linkBotao, 'bg-primary text-white hover:bg-primary-hover');
export const linkContorno = cn(linkBotao, 'border border-line-input bg-surface text-ink hover:border-primary');
