import type { Metadata } from 'next';
import { formatDiaMesHora } from '@gc/core';
import { Cabecalho } from '@/components/painel';
import { Aviso, Vazio } from '@/components/gestao-ui';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { listarComunicados } from '@/lib/gestao';
import { exigirPerfil } from '@/lib/sessao';
import { excluirComunicado, publicarComunicado } from '../actions';

export const metadata: Metadata = { title: 'Comunicados' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const s = await exigirPerfil('sindico', 'conselho');
  const sp = await searchParams;
  const lista = await listarComunicados(s.userId, s.condominioId!);

  return (
    <>
      <Cabecalho titulo="Comunicados" descricao="Avisos para todos os moradores. Aparecem no app." />
      <Aviso ok={sp.ok ? 'Comunicado publicado.' : null} erro={sp.erro} />
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <Card className="overflow-hidden">
          <div className="px-4 pb-2 pt-3.5">
            <CardTitle>Publicados</CardTitle>
          </div>
          {lista.length === 0 ? <Vazio>Nenhum comunicado publicado.</Vazio> : null}
          <ul className="m-0 list-none p-0">
            {lista.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 border-t border-surface-2 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-semibold">{c.titulo}</div>
                  <div className="text-xs text-muted">{formatDiaMesHora(c.publicadoEm)}</div>
                  <p className="m-0 mt-1.5 whitespace-pre-line text-[14px] text-ink-2">{c.corpo}</p>
                </div>
                <form action={excluirComunicado}>
                  <input type="hidden" name="id" value={c.id} />
                  <Button size="sm" variant="ghost" aria-label={`Excluir ${c.titulo}`} className="text-muted">
                    Excluir
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex h-fit flex-col gap-3 p-4">
          <CardTitle>Novo comunicado</CardTitle>
          <form action={publicarComunicado} className="flex flex-col gap-3">
            <Field label="Título">
              <Input name="titulo" required maxLength={120} />
            </Field>
            <Field label="Texto">
              <textarea name="corpo" required rows={6} className="rounded-md border border-line-input p-3 text-[15px] font-normal" />
            </Field>
            <Button>Publicar</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
