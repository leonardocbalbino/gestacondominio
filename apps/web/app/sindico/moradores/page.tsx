import type { Metadata } from 'next';
import { Cabecalho } from '@/components/painel';
import { Indicador, Vazio } from '@/components/gestao-ui';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { listarUnidades } from '@/lib/gestao';
import { exigirPerfil } from '@/lib/sessao';
import { FormConvite } from './form-convite';

export const metadata: Metadata = { title: 'Moradores' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string }> }) {
  const s = await exigirPerfil('sindico');
  const sp = await searchParams;
  const busca = (sp.q ?? '').trim().toLowerCase();
  const unidades = await listarUnidades(s.userId, s.condominioId!);
  const vazias = unidades.filter((u) => u.moradores.length === 0);
  const pessoas = unidades.flatMap((u) => u.moradores);
  const lista = unidades
    .filter((u) => (sp.filtro === 'vazias' ? u.moradores.length === 0 : true))
    .filter((u) => !busca || `${u.codigo} ${u.moradores.map((m) => m.nome).join(' ')}`.toLowerCase().includes(busca));
  const blocos = [...new Set(lista.map((u) => u.bloco ?? 'Sem bloco'))];

  return (
    <>
      <Cabecalho titulo="Moradores e unidades" descricao="Quem mora em cada unidade, quem já tem conta no app e quem tem acesso facial." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Unidades" valor={unidades.length} />
        <Indicador rotulo="Moradores" valor={pessoas.length} detalhe={`${pessoas.filter((p) => p.temConta).length} com conta no app`} />
        <Indicador rotulo="Com facial" valor={pessoas.filter((p) => p.facial).length} />
        <Indicador rotulo="Unidades sem morador" valor={vazias.length} tom={vazias.length ? 'warn' : 'ok'} href="/sindico/moradores?filtro=vazias" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <form role="search" className="flex gap-2">
            {sp.filtro ? <input type="hidden" name="filtro" value={sp.filtro} /> : null}
            <input
              name="q"
              defaultValue={busca}
              placeholder="Buscar unidade ou morador"
              aria-label="Buscar unidade ou morador"
              className="min-h-11 flex-1 rounded-lg border border-line-input bg-surface px-3 text-[14px]"
            />
            <button className="min-h-11 cursor-pointer rounded-lg border border-line-input bg-surface px-4 text-[13px] font-semibold">Buscar</button>
          </form>
          {lista.length === 0 ? (
            <Card>
              <Vazio>Nenhuma unidade encontrada.</Vazio>
            </Card>
          ) : null}
          {blocos.map((b) => (
            <Card key={b} className="overflow-hidden">
              <div className="border-b border-line bg-surface-2 px-4 py-2 text-[13px] font-semibold text-ink-2">{b === 'Sem bloco' ? b : `Bloco ${b}`}</div>
              <ul className="m-0 list-none p-0">
                {lista
                  .filter((u) => (u.bloco ?? 'Sem bloco') === b)
                  .map((u) => (
                    <li key={u.id} className="grid gap-2 border-t border-surface-2 px-4 py-3 first:border-t-0 md:grid-cols-[90px_1fr]">
                      <span className="font-heading text-[16px] font-semibold">{u.codigo}</span>
                      <div className="flex flex-col gap-1.5">
                        {u.moradores.length === 0 && u.convitesPendentes.length === 0 ? <span className="text-[13px] text-muted">Sem moradores cadastrados</span> : null}
                        {u.moradores.map((m) => (
                          <div key={m.nome} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold">{m.nome}</span>
                            <span className="text-[13px] text-muted">{m.tipo}{m.responsavel ? ' · responsável' : ''}</span>
                            {!m.temConta ? <Badge>Sem conta</Badge> : null}
                            <Badge tom={m.facial ? 'ok' : 'neu'}>{m.facial ? 'Facial' : 'Sem facial'}</Badge>
                          </div>
                        ))}
                        {u.convitesPendentes.map((c) => (
                          <div key={c.email} className="flex flex-wrap items-center gap-2 text-[13px]">
                            <span className="font-semibold text-ink-2">{c.nome}</span>
                            <span className="text-muted">{c.tipo} · {c.email}</span>
                            <Badge tom="warn">Convite enviado</Badge>
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>

        <Card className="flex h-fit flex-col gap-3 p-4 xl:sticky xl:top-[76px]">
          <CardTitle>Convidar morador</CardTitle>
          <p className="m-0 text-[13px] text-muted">
            O morador recebe um link por e-mail (válido por 7 dias), cria a senha e já entra vinculado à unidade.
          </p>
          <FormConvite unidades={unidades.map((u) => ({ id: u.id, codigo: u.codigo }))} />
        </Card>
      </div>
    </>
  );
}
