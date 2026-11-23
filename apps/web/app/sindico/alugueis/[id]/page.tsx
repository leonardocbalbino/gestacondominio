import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatData, formatDiaMesHora } from '@gc/core';
import { Cabecalho } from '@/components/painel';
import { Aviso, Dado, linkContorno, Vazio } from '@/components/gestao-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { detalheLocacao, fase, STATUS_LOCACAO } from '@/lib/gestao';
import { exigirPerfil } from '@/lib/sessao';
import { decidirPedido, encerrarLocacao } from '../../actions';

export const metadata: Metadata = { title: 'Locação' };
export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const s = await exigirPerfil('sindico');
  const { id } = await params;
  const sp = await searchParams;
  const d = await detalheLocacao(s.userId, s.condominioId!, id);
  if (!d) notFound();
  const { locacao: l, hospedes } = d;
  const st = STATUS_LOCACAO[l.status];
  const f = fase(l);
  const aberta = l.status === 'aprovada' || l.status === 'aguardando_sindico';
  const titulo = `${l.tipo === 'aluguel' ? 'Locatário(a)' : 'Locatário(a) temporada'} · ${l.responsavel ?? ''}`;

  return (
    <>
      <Link href="/sindico/alugueis" className="text-[13px] font-semibold">← Aluguéis</Link>
      <Cabecalho
        titulo={`${l.responsavel ?? 'Locação'} · ${l.unidade}`}
        descricao={l.tipo === 'aluguel' ? 'Aluguel de longo prazo' : `Temporada${l.origem ? ` · ${l.origem}` : ''}`}
        acoes={<Badge tom={f === 'ativa' ? 'ok' : f === 'futura' ? 'info' : st.tom}>{f === 'ativa' ? 'Em curso' : f === 'futura' ? 'Próxima' : f === 'passada' ? 'Terminou' : st.rotulo}</Badge>}
      />
      <Aviso
        ok={sp.ok === 'encerrada' ? 'Locação encerrada. O acesso facial dos hóspedes foi removido.' : null}
        erro={sp.erro}
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-4">
          <CardTitle>Dados da locação</CardTitle>
          <dl className="m-0 mt-3 grid grid-cols-2 gap-4">
            <Dado rotulo="Unidade">{l.unidade}</Dado>
            <Dado rotulo="Tipo">{l.tipo === 'aluguel' ? 'Aluguel' : 'Temporada'}</Dado>
            <Dado rotulo={l.tipo === 'aluguel' ? 'Início do contrato' : 'Check-in'}>{l.tipo === 'aluguel' ? formatData(l.inicio) : formatDiaMesHora(l.inicio)}</Dado>
            <Dado rotulo={l.tipo === 'aluguel' ? 'Fim do contrato' : 'Check-out'}>{l.tipo === 'aluguel' ? formatData(l.fim) : formatDiaMesHora(l.fim)}</Dado>
            <Dado rotulo="Pessoas">{l.qtdPessoas}</Dado>
            <Dado rotulo={l.tipo === 'aluguel' ? 'Imobiliária' : 'Origem'}>{l.imobiliaria ?? l.origem ?? 'Direto com o proprietário'}</Dado>
            {l.decididoEm ? <Dado rotulo="Decidido em">{formatDiaMesHora(l.decididoEm)}</Dado> : null}
            {l.motivo ? <Dado rotulo="Motivo registrado">{l.motivo}</Dado> : null}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-surface-2 pt-4">
            {l.temContrato ? (
              <a href={`/sindico/arquivo/locacao/${l.id}`} target="_blank" rel="noreferrer" className={linkContorno}>
                Abrir contrato (PDF)
              </a>
            ) : (
              <span className="text-[13px] text-muted">{l.tipo === 'aluguel' ? 'Contrato não anexado pelo proprietário.' : 'Temporada não exige contrato anexado.'}</span>
            )}
          </div>
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <CardTitle>Ações</CardTitle>
          {l.status === 'aguardando_sindico' ? (
            <div className="flex flex-wrap gap-2">
              <form action={decidirPedido}>
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="tipo" value="locacao" />
                <input type="hidden" name="decisao" value="aprovar" />
                <Button aria-label={`Aprovar ${titulo}`}>Aprovar</Button>
              </form>
              <form action={decidirPedido} className="flex flex-1 flex-col gap-2">
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="tipo" value="locacao" />
                <input type="hidden" name="decisao" value="recusar" />
                <input name="motivo" placeholder="Motivo da recusa (opcional)" aria-label="Motivo da recusa" className="min-h-11 rounded-lg border border-line-input px-3 text-[14px]" />
                <Button variant="danger" aria-label={`Recusar ${titulo}`}>Recusar</Button>
              </form>
            </div>
          ) : null}
          {aberta ? (
            <details>
              <summary className="cursor-pointer text-[14px] font-semibold text-danger">
                {l.status === 'aprovada' ? 'Encerrar antes do fim' : 'Cancelar pedido'}
              </summary>
              <form action={encerrarLocacao} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="id" value={l.id} />
                <p className="m-0 text-[13px] text-muted">
                  Use em saída antecipada ou rescisão. O acesso dos hóspedes termina agora e a biometria deles é apagada.
                </p>
                <input name="motivo" placeholder="Motivo (ex.: rescisão do contrato)" aria-label="Motivo do encerramento" className="min-h-11 rounded-lg border border-line-input px-3 text-[14px]" />
                <Button variant="danger">Confirmar encerramento</Button>
              </form>
            </details>
          ) : (
            <p className="m-0 text-[13px] text-muted">Locação {st.rotulo.toLowerCase()}. Nenhuma ação disponível.</p>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 pb-2 pt-3.5">
          <CardTitle>Pessoas cadastradas ({hospedes.length})</CardTitle>
          <p className="m-0 mt-1 text-[13px] text-muted">CPF e celular aparecem mascarados. Cada pessoa recebe um link para cadastrar a facial.</p>
        </div>
        {hospedes.length === 0 ? <Vazio>Nenhuma pessoa cadastrada.</Vazio> : null}
        <ul className="m-0 list-none p-0">
          {hospedes.map((h) => (
            <li key={h.nome} className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-2 px-4 py-3">
              <div>
                <div className="font-semibold">{h.nome}</div>
                <div className="text-xs text-muted">
                  CPF {h.cpf ?? 'não informado'} · {h.celular ?? 'sem celular'}
                </div>
              </div>
              <Badge tom={h.facial ? 'ok' : 'warn'}>{h.facial ? 'Facial cadastrada' : 'Facial pendente'}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
