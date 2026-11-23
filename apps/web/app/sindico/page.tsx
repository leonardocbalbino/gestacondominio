import type { Metadata } from 'next';
import Link from 'next/link';
import { formatBRL, formatData, formatDiaMesHora, formatPeriodo } from '@gc/core';
import { Cabecalho } from '@/components/painel';
import { Indicador, Vazio } from '@/components/gestao-ui';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { aprovacoesPendentes } from '@/lib/dados';
import { listarComunicados, listarContratos, listarLocacoes, listarOcorrencias, reservasProximas, situacaoContrato, valorMensal } from '@/lib/gestao';
import { exigirPerfil } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Visão geral' };
export const dynamic = 'force-dynamic';

const ROTULO_TIPO = { locacao: 'Locação', cessao: 'Cessão de vaga', reserva: 'Reserva' } as const;
const SEMANA = 7 * 86_400_000;

export default async function Page() {
  const s = await exigirPerfil('sindico', 'conselho');
  const cid = s.condominioId!;
  const ehSindico = s.perfil === 'sindico';
  const [pendentes, locacoes, contratos, ocorrencias, reservas, comunicados] = await Promise.all([
    ehSindico ? aprovacoesPendentes(s.userId, cid) : [],
    ehSindico ? listarLocacoes(s.userId, cid) : [],
    listarContratos(s.userId, cid),
    ehSindico ? listarOcorrencias(s.userId, cid) : [],
    ehSindico ? reservasProximas(s.userId, cid) : [],
    listarComunicados(s.userId, cid),
  ]);

  const agora = Date.now();
  const ativas = locacoes.filter((l) => l.status === 'aprovada' && l.inicio.getTime() <= agora && l.fim.getTime() > agora);
  const alertas = contratos.map((c) => ({ c, sit: situacaoContrato(c) })).filter((x) => x.sit.tom === 'warn' || x.sit.tom === 'bad');
  const custoMensal = contratos.reduce((t, c) => t + valorMensal(c), 0);
  const abertas = ocorrencias.filter((o) => o.status !== 'resolvida');
  const movimentos = locacoes
    .filter((l) => l.status === 'aprovada')
    .flatMap((l) => [
      { quando: l.inicio, tipo: 'Entrada' as const, l },
      { quando: l.fim, tipo: 'Saída' as const, l },
    ])
    .filter((m) => m.quando.getTime() >= agora - 86_400_000 && m.quando.getTime() <= agora + SEMANA)
    .sort((a, b) => a.quando.getTime() - b.quando.getTime());

  return (
    <>
      <Cabecalho titulo={`Olá, ${s.nome.split(' ')[0]}`} descricao={`Resumo do ${s.condominioNome ?? 'condomínio'} hoje.`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ehSindico ? (
          <>
            <Indicador rotulo="Aprovações pendentes" valor={pendentes.length} tom={pendentes.length ? 'warn' : 'ok'} href="/sindico/aprovacoes" detalhe={pendentes.length ? 'Toque para decidir' : 'Tudo em dia'} />
            <Indicador rotulo="Locações em curso" valor={ativas.length} href="/sindico/alugueis?filtro=ativas" detalhe={`${ativas.filter((l) => l.tipo === 'temporada').length} de temporada`} />
            <Indicador rotulo="Ocorrências abertas" valor={abertas.length} tom={abertas.length ? 'warn' : 'ok'} href="/sindico/ocorrencias" />
          </>
        ) : null}
        <Indicador rotulo="Contratos com alerta" valor={alertas.length} tom={alertas.some((a) => a.sit.tom === 'bad') ? 'bad' : alertas.length ? 'warn' : 'ok'} href="/sindico/contratos" detalhe={`${formatBRL(custoMensal)}/mês em contratos`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {ehSindico ? (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
              <CardTitle>Aguardando sua decisão</CardTitle>
              <Link href="/sindico/aprovacoes" className="text-[13px] font-semibold">Ver todas</Link>
            </div>
            {pendentes.length === 0 ? <Vazio>Nenhum pedido aguardando.</Vazio> : null}
            <ul className="m-0 list-none p-0">
              {pendentes.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 border-t border-surface-2 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.titulo}</div>
                    <div className="text-xs text-muted">Unidade {p.unidade} · {p.fim ? formatPeriodo(p.inicio, p.fim) : formatData(p.inicio)}</div>
                  </div>
                  <Badge tom="info">{ROTULO_TIPO[p.tipo]}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
            <CardTitle>Contratos que pedem atenção</CardTitle>
            <Link href="/sindico/contratos" className="text-[13px] font-semibold">Ver contratos</Link>
          </div>
          {alertas.length === 0 ? <Vazio>Nenhum contrato vencendo.</Vazio> : null}
          <ul className="m-0 list-none p-0">
            {alertas.map(({ c, sit }) => (
              <li key={c.id} className="border-t border-surface-2">
                <Link href={`/sindico/contratos/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-ink no-underline hover:bg-primary-tint">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{c.fornecedor}</div>
                    <div className="truncate text-xs text-muted">{c.objeto}{c.fim ? ` · até ${formatData(c.fim)}` : ''}</div>
                  </div>
                  <Badge tom={sit.tom}>{sit.rotulo}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {ehSindico ? (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
              <CardTitle>Entradas e saídas (7 dias)</CardTitle>
              <Link href="/sindico/alugueis" className="text-[13px] font-semibold">Ver aluguéis</Link>
            </div>
            {movimentos.length === 0 ? <Vazio>Nenhum check-in ou check-out nos próximos dias.</Vazio> : null}
            <ul className="m-0 list-none p-0">
              {movimentos.map((m) => (
                <li key={`${m.l.id}-${m.tipo}`} className="border-t border-surface-2">
                  <Link href={`/sindico/alugueis/${m.l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-ink no-underline hover:bg-primary-tint">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{m.l.responsavel ?? 'Sem responsável'} · {m.l.unidade}</div>
                      <div className="text-xs text-muted">{formatDiaMesHora(m.quando)} · {m.l.qtdPessoas} pessoa(s)</div>
                    </div>
                    <Badge tom={m.tipo === 'Entrada' ? 'ok' : 'neu'}>{m.tipo}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {ehSindico ? (
          <Card className="overflow-hidden">
            <div className="px-4 pb-2 pt-3.5">
              <CardTitle>Próximas reservas</CardTitle>
            </div>
            {reservas.length === 0 ? <Vazio>Nenhuma reserva marcada.</Vazio> : null}
            <ul className="m-0 list-none p-0">
              {reservas.map((r) => (
                <li key={`${r.area}-${r.inicio.toISOString()}`} className="flex items-center justify-between gap-3 border-t border-surface-2 px-4 py-3">
                  <div>
                    <div className="font-semibold">{r.area}</div>
                    <div className="text-xs text-muted">Unidade {r.unidade} · {formatPeriodo(r.inicio, r.fim)}</div>
                  </div>
                  <Badge tom={r.status === 'confirmada' ? 'ok' : 'warn'}>{r.status === 'confirmada' ? 'Confirmada' : 'Pendente'}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
              <CardTitle>Últimos comunicados</CardTitle>
              <Link href="/sindico/comunicados" className="text-[13px] font-semibold">Publicar</Link>
            </div>
            {comunicados.length === 0 ? <Vazio>Nenhum comunicado.</Vazio> : null}
            <ul className="m-0 list-none p-0">
              {comunicados.slice(0, 4).map((c) => (
                <li key={c.id} className="border-t border-surface-2 px-4 py-3">
                  <div className="font-semibold">{c.titulo}</div>
                  <div className="text-xs text-muted">{formatData(c.publicadoEm)}</div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
