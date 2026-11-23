import type { Metadata } from 'next';
import Link from 'next/link';
import { formatBRL, formatData } from '@gc/core';
import { Cabecalho } from '@/components/painel';
import { Abas, Indicador, linkPrimario, Vazio } from '@/components/gestao-ui';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CATEGORIAS_CONTRATO, listarContratos, PERIODICIDADES, situacaoContrato, valorMensal } from '@/lib/gestao';
import { exigirPerfil } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Contratos' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ filtro?: string; categoria?: string }> }) {
  const s = await exigirPerfil('sindico', 'conselho');
  const sp = await searchParams;
  const filtro = ['ativos', 'alerta', 'encerrados', 'todos'].includes(sp.filtro ?? '') ? sp.filtro! : 'ativos';
  const categoria = sp.categoria && sp.categoria in CATEGORIAS_CONTRATO ? sp.categoria : null;
  const todos = await listarContratos(s.userId, s.condominioId!);
  const comSit = todos.map((c) => ({ c, sit: situacaoContrato(c) }));

  const porFiltro = {
    ativos: (x: (typeof comSit)[number]) => x.c.status === 'ativo',
    alerta: (x: (typeof comSit)[number]) => x.sit.tom === 'warn' || x.sit.tom === 'bad',
    encerrados: (x: (typeof comSit)[number]) => x.c.status === 'encerrado',
    todos: () => true,
  }[filtro as 'ativos'];
  const lista = comSit.filter(porFiltro).filter((x) => !categoria || x.c.categoria === categoria);
  const ativos = todos.filter((c) => c.status === 'ativo');
  const mensal = todos.reduce((t, c) => t + valorMensal(c), 0);
  const url = (f: string, cat = categoria) => `/sindico/contratos?filtro=${f}${cat ? `&categoria=${cat}` : ''}`;

  return (
    <>
      <Cabecalho
        titulo="Contratos"
        descricao="Fornecedores e prestadores do condomínio, com vigência, valores e documentos."
        acoes={s.perfil === 'sindico' ? <Link href="/sindico/contratos/novo" className={linkPrimario}>+ Novo contrato</Link> : null}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Contratos ativos" valor={ativos.length} href={url('ativos', null)} />
        <Indicador rotulo="Custo mensal estimado" valor={formatBRL(mensal)} detalhe="Anuais e trimestrais divididos por mês" />
        <Indicador
          rotulo="Vencendo"
          valor={comSit.filter((x) => x.sit.tom === 'warn').length}
          tom={comSit.some((x) => x.sit.tom === 'warn') ? 'warn' : 'ok'}
          href={url('alerta', null)}
        />
        <Indicador
          rotulo="Vencidos"
          valor={comSit.filter((x) => x.sit.tom === 'bad').length}
          tom={comSit.some((x) => x.sit.tom === 'bad') ? 'bad' : 'ok'}
          href={url('alerta', null)}
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Abas
          ativo={filtro}
          itens={[
            { valor: 'ativos', rotulo: 'Ativos', href: url('ativos'), contador: comSit.filter((x) => x.c.status === 'ativo').length },
            { valor: 'alerta', rotulo: 'Com alerta', href: url('alerta'), contador: comSit.filter((x) => x.sit.tom === 'warn' || x.sit.tom === 'bad').length },
            { valor: 'encerrados', rotulo: 'Encerrados', href: url('encerrados'), contador: comSit.filter((x) => x.c.status === 'encerrado').length },
            { valor: 'todos', rotulo: 'Todos', href: url('todos'), contador: todos.length },
          ]}
        />
        <form className="flex items-center gap-2">
          <input type="hidden" name="filtro" value={filtro} />
          <label htmlFor="categoria" className="text-[13px] font-semibold text-muted">Categoria</label>
          <select id="categoria" name="categoria" defaultValue={categoria ?? ''} className="min-h-11 rounded-lg border border-line-input bg-surface px-3 text-[14px]">
            <option value="">Todas</option>
            {Object.entries(CATEGORIAS_CONTRATO).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button className="min-h-11 cursor-pointer rounded-lg border border-line-input bg-surface px-3 text-[13px] font-semibold">Filtrar</button>
        </form>
      </div>

      <Card className="overflow-hidden">
        {lista.length === 0 ? <Vazio>Nenhum contrato neste filtro.</Vazio> : null}
        <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr_150px] gap-3 border-b border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-muted md:grid">
          <span>Fornecedor e objeto</span>
          <span>Categoria</span>
          <span>Valor</span>
          <span>Vigência</span>
          <span>Situação</span>
        </div>
        <ul className="m-0 list-none p-0">
          {lista.map(({ c, sit }) => (
            <li key={c.id} className="border-t border-surface-2 first:border-t-0">
              <Link
                href={`/sindico/contratos/${c.id}`}
                className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3 text-ink no-underline hover:bg-primary-tint md:grid-cols-[1.6fr_1fr_1fr_1fr_150px] md:items-center"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.fornecedor}</span>
                  <span className="block truncate text-xs text-muted">{c.objeto}</span>
                </span>
                <span className="text-[13px] text-ink-2 max-md:hidden">{CATEGORIAS_CONTRATO[c.categoria]}</span>
                <span className="text-[13px] max-md:order-3">
                  {c.valor != null ? formatBRL(c.valor) : '—'}
                  <span className="text-xs text-muted"> {c.periodicidade !== 'unico' ? `/${PERIODICIDADES[c.periodicidade].toLowerCase().replace('mensal', 'mês').replace('anual', 'ano').replace('trimestral', 'trimestre')}` : ''}</span>
                </span>
                <span className="text-[13px] text-ink-2 max-md:order-4">
                  {formatData(c.inicio)} – {c.fim ? formatData(c.fim) : 'indeterminado'}
                </span>
                <span className="max-md:order-2 max-md:row-start-1 max-md:col-start-2">
                  <Badge tom={sit.tom}>{sit.rotulo}</Badge>
                  {c.temDocumento ? <span className="ml-1.5 text-xs text-muted" title="PDF anexado">PDF</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
