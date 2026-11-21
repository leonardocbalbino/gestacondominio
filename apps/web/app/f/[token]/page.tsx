import type { Metadata } from 'next';
import { textoValidadeLink } from '@gc/core';
import { infoLinkFacial } from '@/lib/dados';
import { CadastroFacial } from './cadastro-facial';

export const metadata: Metadata = { title: 'Cadastro de acesso facial', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await infoLinkFacial(token);

  if (!info || !info.valido) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-3 px-5 text-center">
        <h1 className="font-heading text-2xl font-semibold">Link indisponível</h1>
        <p className="text-muted">
          Este link de cadastro facial expirou ou já foi usado. Peça um novo link ao morador responsável pela unidade.
        </p>
      </main>
    );
  }

  return (
    <CadastroFacial
      token={token}
      condominio={info.condominio}
      sigla={info.sigla}
      primeiroNome={info.primeiroNome}
      unidade={info.unidade}
      versaoTermo={info.versaoTermo}
      validade={textoValidadeLink(info.expiraEm)}
    />
  );
}
