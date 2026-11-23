import type { Metadata } from 'next';
import { formatDiaMesHora, suporteAtivo } from '@gc/core';
import { Cabecalho } from '@/components/painel';
import { Vazio } from '@/components/gestao-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { pedidosSuporte } from '@/lib/dados';
import { exigirPerfil } from '@/lib/sessao';
import { decidirSuporte, revogarSuporte } from '../actions';

export const metadata: Metadata = { title: 'Acesso do suporte' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const s = await exigirPerfil('sindico');
  const suporte = await pedidosSuporte(s.userId, s.condominioId!);

  return (
    <>
      <Cabecalho
        titulo="Acesso do suporte"
        descricao="O suporte da plataforma só enxerga dados do condomínio com a sua aprovação, em modo leitura e pelo prazo pedido. Biometrias nunca são acessíveis."
      />
      <Card className="overflow-hidden">
        {suporte.length === 0 ? <Vazio>Nenhum pedido de acesso.</Vazio> : null}
        <ul className="m-0 list-none p-0">
          {suporte.map((x) => {
            const ativo = suporteAtivo({ status: x.status, expira_em: x.expiraEm });
            return (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 px-4 py-3 first:border-t-0">
                <div>
                  <div className="font-semibold">{x.motivo}</div>
                  <div className="text-xs text-muted">
                    Pedido em {formatDiaMesHora(x.criadoEm)} · duração {x.duracaoHoras}h
                    {ativo && x.expiraEm ? ` · ativo até ${formatDiaMesHora(x.expiraEm)}` : ''}
                  </div>
                </div>
                {x.status === 'solicitado' ? (
                  <div className="flex gap-2">
                    {(['negar', 'aprovar'] as const).map((d) => (
                      <form key={d} action={decidirSuporte}>
                        <input type="hidden" name="id" value={x.id} />
                        <input type="hidden" name="decisao" value={d} />
                        <Button variant={d === 'aprovar' ? 'primary' : 'danger'} size="sm">
                          {d === 'aprovar' ? `Liberar ${x.duracaoHoras}h` : 'Negar'}
                        </Button>
                      </form>
                    ))}
                  </div>
                ) : ativo ? (
                  <form action={revogarSuporte}>
                    <input type="hidden" name="id" value={x.id} />
                    <Button variant="danger" size="sm">Encerrar agora</Button>
                  </form>
                ) : (
                  <Badge>{x.status === 'negado' ? 'Negado' : 'Encerrado'}</Badge>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
