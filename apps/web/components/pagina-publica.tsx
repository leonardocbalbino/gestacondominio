import { contato } from '@/lib/contato';

/** Moldura das páginas públicas (política, suporte, exclusão de conta): legível sem login, em qualquer tela. */
export function PaginaPublica({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-5 py-8 text-[15px] leading-relaxed [&_h2]:mb-0 [&_h2]:mt-4 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-1 [&_p]:my-0 [&_ul]:my-0 [&_ul]:pl-5">
      <a href="/" className="flex items-center gap-2.5 no-underline">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-dark font-heading text-xs font-bold text-white">GC</span>
        <span className="font-heading font-semibold text-ink">GestaCondomínio</span>
      </a>
      <header>
        <h1 className="m-0 font-heading text-2xl font-semibold">{titulo}</h1>
        {subtitulo ? <p className="mt-1 text-xs text-muted">{subtitulo}</p> : null}
      </header>
      {children}
      <footer className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-4 text-[13px] text-muted">
        <a href="/politica-de-privacidade">Política de privacidade</a>
        <a href="/suporte">Suporte</a>
        <a href="/excluir-conta">Excluir minha conta</a>
        <a href="/privacidade/termo-biometria">Termo da biometria</a>
        <span>{contato.responsavel}</span>
      </footer>
    </main>
  );
}

/** Link de e-mail, ou orientação para usar o app quando o e-mail ainda não foi configurado. */
export function EmailSuporte({ assunto }: { assunto?: string }) {
  if (!contato.email) return <span>pelo app, em Perfil</span>;
  const href = `mailto:${contato.email}${assunto ? `?subject=${encodeURIComponent(assunto)}` : ''}`;
  return <a href={href}>{contato.email}</a>;
}
