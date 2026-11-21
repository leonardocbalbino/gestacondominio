import type { Metadata } from 'next';
import { formatData, formatDiaMesHora, formatPeriodo, suporteAtivo } from '@gc/core';
import { Painel } from '@/components/painel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { aprovacoesPendentes, pedidosSuporte } from '@/lib/dados';
import { exigirPerfil } from '@/lib/sessao';
import { decidirPedido, decidirSuporte, revogarSuporte } from './actions';

export const metadata: Metadata = { title: 'Síndico' };
export const dynamic = 'force-dynamic';

const ROTULO_TIPO = { locacao: 'Locação', cessao: 'Cessão de vaga', reserva: 'Reserva' } as const;

export default async function Page() {
  const sessao = await exigirPerfil('sindico', 'conselho');
  const cid = sessao.condominioId!;
  const [pendentes, suporte] = await Promise.all([aprovacoesPendentes(cid), pedidosSuporte(cid)]);
  const ehSindico = sessao.perfil === 'sindico';

  return (
    <Painel sessao={sessao} titulo="Aprovações" nav={[{ href: '/sindico', rotulo: 'Aprovações' }, { href: '/privacidade', rotulo: 'Privacidade' }]}>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 pb-1.5 pt-3.5">
          <CardTitle>Pedidos com o síndico</CardTitle>
          <Badge tom={pendentes.length ? 'warn' : 'ok'}>{pendentes.length ? `${pendentes.length} pendente(s)` : 'Tudo em dia'}</Badge>
        </div>
        {pendentes.length === 0 ? <p className="m-0 border-t border-surface-2 px-4 py-4 text-muted">Nenhum pedido aguardando.</p> : null}
        <ul className="m-0 list-none p-0">
          {pendentes.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge tom="info">{ROTULO_TIPO[p.tipo]}</Badge>
                  <span className="font-semibold">{p.titulo}</span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  Unidade {p.unidade} · {p.fim ? formatPeriodo(p.inicio, p.fim) : `a partir de ${formatData(p.inicio)}`} · {p.detalhe}
                </div>
              </div>
              {ehSindico ? (
                <div className="flex gap-2">
                  {(['recusar', 'aprovar'] as const).map((d) => (
                    <form key={d} action={decidirPedido}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="tipo" value={p.tipo} />
                      <input type="hidden" name="decisao" value={d} />
                      <Button variant={d === 'aprovar' ? 'primary' : 'danger'} size="sm" aria-label={`${d === 'aprovar' ? 'Aprovar' : 'Recusar'} ${p.titulo}`}>
                        {d === 'aprovar' ? 'Aprovar' : 'Recusar'}
                      </Button>
                    </form>
                  ))}
                </div>
              ) : (
                <Badge tom="warn">Com o síndico</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {ehSindico ? (
        <Card className="overflow-hidden">
          <div className="px-4 pb-1.5 pt-3.5">
            <CardTitle>Acesso do suporte da plataforma</CardTitle>
            <p className="m-0 mt-1 text-[13px] text-muted">
              O suporte só enxerga dados do condomínio com a sua aprovação, em modo leitura e pelo prazo pedido. Biometrias nunca são
              acessíveis.
            </p>
          </div>
          <ul className="m-0 list-none p-0">
            {suporte.length === 0 ? <li className="border-t border-surface-2 px-4 py-4 text-muted">Nenhum pedido.</li> : null}
            {suporte.map((s) => {
              const ativo = suporteAtivo({ status: s.status, expira_em: s.expiraEm });
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 px-4 py-3">
                  <div>
                    <div className="font-semibold">{s.motivo}</div>
                    <div className="text-xs text-muted">
                      Pedido em {formatDiaMesHora(s.criadoEm)} · duração {s.duracaoHoras}h
                      {ativo && s.expiraEm ? ` · ativo até ${formatDiaMesHora(s.expiraEm)}` : ''}
                    </div>
                  </div>
                  {s.status === 'solicitado' ? (
                    <div className="flex gap-2">
                      {(['negar', 'aprovar'] as const).map((d) => (
                        <form key={d} action={decidirSuporte}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="decisao" value={d} />
                          <Button variant={d === 'aprovar' ? 'primary' : 'danger'} size="sm">
                            {d === 'aprovar' ? `Liberar ${s.duracaoHoras}h` : 'Negar'}
                          </Button>
                        </form>
                      ))}
                    </div>
                  ) : ativo ? (
                    <form action={revogarSuporte}>
                      <input type="hidden" name="id" value={s.id} />
                      <Button variant="danger" size="sm">
                        Encerrar agora
                      </Button>
                    </form>
                  ) : (
                    <Badge>{s.status === 'negado' ? 'Negado' : 'Encerrado'}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </Painel>
  );
}
