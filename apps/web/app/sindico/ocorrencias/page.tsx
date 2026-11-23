import type { Metadata } from 'next';
import { formatDiaMesHora } from '@gc/core';
import { Cabecalho } from '@/components/painel';
import { Abas, Vazio } from '@/components/gestao-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listarOcorrencias, type Ocorrencia } from '@/lib/gestao';
import { exigirPerfil } from '@/lib/sessao';
import { atualizarOcorrencia } from '../actions';

export const metadata: Metadata = { title: 'Ocorrências' };
export const dynamic = 'force-dynamic';

const STATUS: Record<Ocorrencia['status'], { rotulo: string; tom: 'warn' | 'info' | 'ok' }> = {
  aberta: { rotulo: 'Aberta', tom: 'warn' },
  em_andamento: { rotulo: 'Em andamento', tom: 'info' },
  resolvida: { rotulo: 'Resolvida', tom: 'ok' },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = await exigirPerfil('sindico');
  const { status = 'pendentes' } = await searchParams;
  const todas = await listarOcorrencias(s.userId, s.condominioId!);
  const lista = todas.filter((o) => (status === 'pendentes' ? o.status !== 'resolvida' : status === 'resolvidas' ? o.status === 'resolvida' : true));

  return (
    <>
      <Cabecalho titulo="Ocorrências" descricao="Chamados abertos pelos moradores no app. A resposta aparece para quem abriu." />
      <Abas
        ativo={status}
        itens={[
          { valor: 'pendentes', rotulo: 'Pendentes', href: '/sindico/ocorrencias', contador: todas.filter((o) => o.status !== 'resolvida').length },
          { valor: 'resolvidas', rotulo: 'Resolvidas', href: '/sindico/ocorrencias?status=resolvidas', contador: todas.filter((o) => o.status === 'resolvida').length },
          { valor: 'todas', rotulo: 'Todas', href: '/sindico/ocorrencias?status=todas', contador: todas.length },
        ]}
      />
      <div className="flex flex-col gap-3">
        {lista.length === 0 ? (
          <Card>
            <Vazio>Nenhuma ocorrência aqui.</Vazio>
          </Card>
        ) : null}
        {lista.map((o) => (
          <Card key={o.id} className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{o.titulo}</div>
                <div className="text-xs text-muted">
                  {o.unidade ? `Unidade ${o.unidade} · ` : ''}
                  {formatDiaMesHora(o.criadaEm)}
                </div>
              </div>
              <Badge tom={STATUS[o.status].tom}>{STATUS[o.status].rotulo}</Badge>
            </div>
            {o.descricao ? <p className="m-0 text-[14px] text-ink-2">{o.descricao}</p> : null}
            {o.resposta ? (
              <p className="m-0 rounded-lg bg-primary-tint px-3 py-2 text-[13px]">
                <b>Sua resposta:</b> {o.resposta}
              </p>
            ) : null}
            <form action={atualizarOcorrencia} className="flex flex-col gap-2 border-t border-surface-2 pt-3 md:flex-row md:items-center">
              <input type="hidden" name="id" value={o.id} />
              <input
                name="resposta"
                placeholder={o.resposta ? 'Nova resposta (opcional)' : 'Responder ao morador (opcional)'}
                aria-label={`Resposta para ${o.titulo}`}
                className="min-h-11 flex-1 rounded-lg border border-line-input px-3 text-[14px]"
              />
              <select name="status" defaultValue={o.status} aria-label="Situação" className="min-h-11 rounded-lg border border-line-input bg-surface px-3 text-[14px]">
                <option value="aberta">Aberta</option>
                <option value="em_andamento">Em andamento</option>
                <option value="resolvida">Resolvida</option>
              </select>
              <Button size="sm" variant="outline">Salvar</Button>
            </form>
          </Card>
        ))}
      </div>
    </>
  );
}
