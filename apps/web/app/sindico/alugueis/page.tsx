import type { Metadata } from 'next';
import Link from 'next/link';
import { formatData, formatPeriodo } from '@gc/core';
import { Cabecalho } from '@/components/painel';
import { Abas, Indicador, Vazio } from '@/components/gestao-ui';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { fase, listarLocacoes, STATUS_LOCACAO, type Locacao } from '@/lib/gestao';
import { exigirPerfil } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Aluguéis' };
export const dynamic = 'force-dynamic';

const FILTROS = {
  ativas: { rotulo: 'Em curso', f: (l: Locacao) => fase(l) === 'ativa' },
  futuras: { rotulo: 'Próximas', f: (l: Locacao) => fase(l) === 'futura' },
  pendentes: { rotulo: 'Pendentes', f: (l: Locacao) => fase(l) === 'pendente' },
  encerradas: { rotulo: 'Encerradas', f: (l: Locacao) => ['passada', 'fechada'].includes(fase(l)) },
  todas: { rotulo: 'Todas', f: () => true },
} as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ filtro?: string; tipo?: string; q?: string }> }) {
  const s = await exigirPerfil('sindico');
  const sp = await searchParams;
  const filtro = (sp.filtro && sp.filtro in FILTROS ? sp.filtro : 'ativas') as keyof typeof FILTROS;
  const tipo = sp.tipo === 'aluguel' || sp.tipo === 'temporada' ? sp.tipo : 'todos';
  const busca = (sp.q ?? '').trim().toLowerCase();
  const todas = await listarLocacoes(s.userId, s.condominioId!);

  const doTipo = todas.filter((l) => tipo === 'todos' || l.tipo === tipo);
  const lista = doTipo
    .filter(FILTROS[filtro].f)
    .filter((l) => !busca || `${l.unidade} ${l.responsavel ?? ''} ${l.imobiliaria ?? ''} ${l.origem ?? ''}`.toLowerCase().includes(busca));
  const url = (o: { filtro?: string; tipo?: string }) => {
    const p = new URLSearchParams({ filtro: o.filtro ?? filtro, ...((o.tipo ?? tipo) !== 'todos' ? { tipo: o.tipo ?? tipo } : {}), ...(busca ? { q: busca } : {}) });
    return `/sindico/alugueis?${p}`;
  };
  const ativas = todas.filter((l) => fase(l) === 'ativa');

  return (
    <>
      <Cabecalho
        titulo="Aluguéis e temporadas"
        descricao="Inquilinos de longo prazo e hóspedes de temporada cadastrados pelos proprietários. O acesso facial vale só durante o período aprovado."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Aluguéis em curso" valor={ativas.filter((l) => l.tipo === 'aluguel').length} href={url({ filtro: 'ativas', tipo: 'aluguel' })} />
        <Indicador rotulo="Temporadas em curso" valor={ativas.filter((l) => l.tipo === 'temporada').length} href={url({ filtro: 'ativas', tipo: 'temporada' })} />
        <Indicador rotulo="Pessoas hospedadas agora" valor={ativas.reduce((t, l) => t + l.qtdPessoas, 0)} />
        <Indicador
          rotulo="Aguardando aprovação"
          valor={todas.filter((l) => l.status === 'aguardando_sindico').length}
          tom={todas.some((l) => l.status === 'aguardando_sindico') ? 'warn' : 'ok'}
          href={url({ filtro: 'pendentes', tipo: 'todos' })}
        />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Abas
          ativo={filtro}
          itens={Object.entries(FILTROS).map(([k, v]) => ({ valor: k, rotulo: v.rotulo, href: url({ filtro: k }), contador: doTipo.filter(v.f).length }))}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Abas
            ativo={tipo}
            itens={[
              { valor: 'todos', rotulo: 'Todos', href: url({ tipo: 'todos' }) },
              { valor: 'aluguel', rotulo: 'Aluguel', href: url({ tipo: 'aluguel' }) },
              { valor: 'temporada', rotulo: 'Temporada', href: url({ tipo: 'temporada' }) },
            ]}
          />
          <form className="flex" role="search">
            <input type="hidden" name="filtro" value={filtro} />
            {tipo !== 'todos' ? <input type="hidden" name="tipo" value={tipo} /> : null}
            <input
              name="q"
              defaultValue={busca}
              placeholder="Buscar unidade ou nome"
              aria-label="Buscar unidade ou nome"
              className="min-h-11 w-52 rounded-lg border border-line-input bg-surface px-3 text-[14px]"
            />
          </form>
        </div>
      </div>

      <Card className="overflow-hidden">
        {lista.length === 0 ? <Vazio>Nenhuma locação neste filtro.</Vazio> : null}
        <div className="hidden grid-cols-[90px_1.4fr_1.4fr_1fr_120px] gap-3 border-b border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-muted md:grid">
          <span>Unidade</span>
          <span>Responsável</span>
          <span>Período</span>
          <span>Origem</span>
          <span>Situação</span>
        </div>
        <ul className="m-0 list-none p-0">
          {lista.map((l) => {
            const st = STATUS_LOCACAO[l.status];
            const f = fase(l);
            return (
              <li key={l.id} className="border-t border-surface-2 first:border-t-0">
                <Link
                  href={`/sindico/alugueis/${l.id}`}
                  className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3 text-ink no-underline hover:bg-primary-tint md:grid-cols-[90px_1.4fr_1.4fr_1fr_120px] md:items-center"
                >
                  <span className="font-heading font-semibold">{l.unidade}</span>
                  <span className="md:order-none">
                    <span className="font-semibold">{l.responsavel ?? '—'}</span>
                    <span className="block text-xs text-muted">
                      {l.tipo === 'aluguel' ? 'Aluguel' : 'Temporada'} · {l.qtdPessoas} pessoa(s){l.temContrato ? ' · contrato anexado' : ''}
                    </span>
                  </span>
                  <span className="col-span-2 text-[13px] text-ink-2 md:col-span-1">
                    {l.tipo === 'aluguel' ? `${formatData(l.inicio)} a ${formatData(l.fim)}` : formatPeriodo(l.inicio, l.fim)}
                  </span>
                  <span className="text-[13px] text-muted">{l.imobiliaria ?? l.origem ?? 'Direto'}</span>
                  <span>
                    <Badge tom={f === 'ativa' ? 'ok' : f === 'futura' ? 'info' : st.tom === 'info' ? 'info' : st.tom}>
                      {f === 'ativa' ? 'Em curso' : f === 'futura' ? 'Próxima' : f === 'passada' ? 'Terminou' : st.rotulo}
                    </Badge>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
