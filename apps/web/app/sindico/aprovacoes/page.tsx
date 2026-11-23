import type { Metadata } from 'next';
import Link from 'next/link';
import { formatData, formatDiaMesHora, formatPeriodo } from '@gc/core';
import { Cabecalho } from '@/components/painel';
import { Abas, Vazio } from '@/components/gestao-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { aprovacoesPendentes } from '@/lib/dados';
import { historicoDecisoes } from '@/lib/gestao';
import { exigirPerfil } from '@/lib/sessao';
import { decidirPedido } from '../actions';

export const metadata: Metadata = { title: 'Aprovações' };
export const dynamic = 'force-dynamic';

const ROTULO_TIPO = { locacao: 'Locação', cessao: 'Cessão de vaga', reserva: 'Reserva' } as const;
const STATUS: Record<string, { rotulo: string; tom: 'ok' | 'bad' | 'neu' }> = {
  aprovada: { rotulo: 'Aprovada', tom: 'ok' },
  confirmada: { rotulo: 'Confirmada', tom: 'ok' },
  recusada: { rotulo: 'Recusada', tom: 'bad' },
  cancelada: { rotulo: 'Cancelada', tom: 'neu' },
  encerrada: { rotulo: 'Encerrada', tom: 'neu' },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const s = await exigirPerfil('sindico');
  const cid = s.condominioId!;
  const { tipo = 'todos' } = await searchParams;
  const [pendentes, historico] = await Promise.all([aprovacoesPendentes(s.userId, cid), historicoDecisoes(s.userId, cid)]);
  const lista = tipo === 'todos' ? pendentes : pendentes.filter((p) => p.tipo === tipo);
  const conta = (t: string) => pendentes.filter((p) => p.tipo === t).length;

  return (
    <>
      <Cabecalho titulo="Aprovações" descricao="Locações, cessões de vaga e reservas que dependem da sua decisão. O morador é avisado no app." />
      <Abas
        ativo={tipo}
        itens={[
          { valor: 'todos', rotulo: 'Todos', href: '/sindico/aprovacoes', contador: pendentes.length },
          { valor: 'locacao', rotulo: 'Locações', href: '/sindico/aprovacoes?tipo=locacao', contador: conta('locacao') },
          { valor: 'cessao', rotulo: 'Vagas', href: '/sindico/aprovacoes?tipo=cessao', contador: conta('cessao') },
          { valor: 'reserva', rotulo: 'Reservas', href: '/sindico/aprovacoes?tipo=reserva', contador: conta('reserva') },
        ]}
      />

      <div className="flex flex-col gap-3">
        {lista.length === 0 ? (
          <Card>
            <Vazio>Nenhum pedido aguardando. Tudo em dia.</Vazio>
          </Card>
        ) : null}
        {lista.map((p) => (
          <Card key={p.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tom="info">{ROTULO_TIPO[p.tipo]}</Badge>
                <span className="font-semibold">{p.titulo}</span>
              </div>
              <div className="mt-1.5 text-[13px] text-muted">
                Unidade <b className="text-ink-2">{p.unidade}</b> · {p.fim ? formatPeriodo(p.inicio, p.fim) : `a partir de ${formatData(p.inicio)}`} · {p.detalhe}
              </div>
              {p.tipo === 'locacao' ? (
                <Link href={`/sindico/alugueis/${p.id}`} className="mt-1 inline-block text-[13px] font-semibold">
                  Ver hóspedes e contrato
                </Link>
              ) : null}
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <details className="group">
                <summary className="flex min-h-9 cursor-pointer list-none items-center rounded-md border border-line-input bg-surface px-3 text-[13px] font-semibold text-danger hover:border-danger">
                  Recusar
                </summary>
                <form action={decidirPedido} className="mt-2 flex w-72 flex-col gap-2 rounded-lg border border-line bg-surface p-3 shadow-sm">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="tipo" value={p.tipo} />
                  <input type="hidden" name="decisao" value="recusar" />
                  <label className="text-xs font-semibold">
                    Motivo (o morador verá)
                    <textarea name="motivo" rows={2} className="mt-1 w-full rounded-md border border-line-input p-2 text-[14px] font-normal" />
                  </label>
                  <Button variant="danger" size="sm" aria-label={`Recusar ${p.titulo}`}>
                    Confirmar recusa
                  </Button>
                </form>
              </details>
              <form action={decidirPedido}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="tipo" value={p.tipo} />
                <input type="hidden" name="decisao" value="aprovar" />
                <Button size="sm" aria-label={`Aprovar ${p.titulo}`}>
                  Aprovar
                </Button>
              </form>
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 pb-2 pt-3.5">
          <CardTitle>Decididos nos últimos 60 dias</CardTitle>
        </div>
        {historico.length === 0 ? <Vazio>Nenhuma decisão recente.</Vazio> : null}
        <ul className="m-0 list-none p-0">
          {historico.map((h, i) => {
            const st = STATUS[h.status] ?? { rotulo: h.status, tom: 'neu' as const };
            return (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-2 px-4 py-2.5">
                <div className="min-w-0">
                  <span className="font-semibold">{h.titulo}</span>
                  <span className="text-[13px] text-muted"> · {ROTULO_TIPO[h.tipo]} · {h.unidade} · {formatDiaMesHora(h.quando)}</span>
                  {h.motivo ? <div className="text-xs text-muted">Motivo: {h.motivo}</div> : null}
                </div>
                <Badge tom={st.tom}>{st.rotulo}</Badge>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
