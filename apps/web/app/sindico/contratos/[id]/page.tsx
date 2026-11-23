import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatBRL, formatData } from '@gc/core';
import { Cabecalho } from '@/components/painel';
import { FormContrato } from '@/components/form-contrato';
import { Aviso, Dado, linkContorno } from '@/components/gestao-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { CATEGORIAS_CONTRATO, obterContrato, PERIODICIDADES, situacaoContrato, valorMensal } from '@/lib/gestao';
import { exigirPerfil } from '@/lib/sessao';
import { encerrarContrato } from '../../actions';

export const metadata: Metadata = { title: 'Contrato' };
export const dynamic = 'force-dynamic';

const OK: Record<string, string> = { salvo: 'Contrato salvo.', encerrado: 'Contrato encerrado.', reaberto: 'Contrato reativado.' };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string; editar?: string }> }) {
  const s = await exigirPerfil('sindico', 'conselho');
  const { id } = await params;
  const sp = await searchParams;
  const c = await obterContrato(s.userId, s.condominioId!, id);
  if (!c) notFound();
  const sit = situacaoContrato(c);
  const ehSindico = s.perfil === 'sindico';
  const editando = ehSindico && (sp.editar === '1' || Boolean(sp.erro));

  return (
    <>
      <Link href="/sindico/contratos" className="text-[13px] font-semibold">← Contratos</Link>
      <Cabecalho
        titulo={c.fornecedor}
        descricao={c.objeto}
        acoes={
          <>
            <Badge tom={sit.tom}>{sit.rotulo}</Badge>
            {ehSindico && !editando ? <Link href={`/sindico/contratos/${c.id}?editar=1`} className={linkContorno}>Editar</Link> : null}
          </>
        }
      />
      <Aviso ok={sp.ok ? OK[sp.ok] : null} erro={sp.erro} />

      {editando ? (
        <Card className="max-w-3xl p-5">
          <FormContrato c={c} />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <Card className="p-4">
            <CardTitle>Dados do contrato</CardTitle>
            <dl className="m-0 mt-3 grid grid-cols-2 gap-4">
              <Dado rotulo="Categoria">{CATEGORIAS_CONTRATO[c.categoria]}</Dado>
              <Dado rotulo="CNPJ/CPF">{c.cnpj}</Dado>
              <Dado rotulo="Valor">{c.valor != null ? `${formatBRL(c.valor)} · ${PERIODICIDADES[c.periodicidade]}` : null}</Dado>
              <Dado rotulo="Equivalente mensal">{c.periodicidade === 'unico' ? 'Pagamento único' : formatBRL(valorMensal({ ...c, status: 'ativo' }))}</Dado>
              <Dado rotulo="Início">{formatData(c.inicio)}</Dado>
              <Dado rotulo="Fim">{c.fim ? formatData(c.fim) : 'Prazo indeterminado'}</Dado>
              <Dado rotulo="Renovação automática">{c.renovacaoAutomatica ? 'Sim' : 'Não'}</Dado>
              <Dado rotulo="Alerta">{`${c.avisoDias} dias antes do fim`}</Dado>
              <Dado rotulo="Contato">{c.contato}</Dado>
              {c.encerradoEm ? <Dado rotulo="Encerrado em">{formatData(c.encerradoEm)}</Dado> : null}
            </dl>
            {c.observacoes ? (
              <div className="mt-4 border-t border-surface-2 pt-3">
                <div className="text-xs font-semibold text-muted">Observações</div>
                <p className="m-0 mt-1 whitespace-pre-line text-[14px]">{c.observacoes}</p>
              </div>
            ) : null}
          </Card>
          <div className="flex flex-col gap-5">
            <Card className="flex flex-col gap-3 p-4">
              <CardTitle>Documento</CardTitle>
              {c.temDocumento ? (
                <a href={`/sindico/arquivo/fornecedor/${c.id}`} target="_blank" rel="noreferrer" className={linkContorno}>
                  Abrir contrato (PDF)
                </a>
              ) : (
                <p className="m-0 text-[13px] text-muted">Nenhum PDF anexado.{ehSindico ? ' Use “Editar” para anexar.' : ''}</p>
              )}
            </Card>
            {ehSindico ? (
              <Card className="flex flex-col gap-3 p-4">
                <CardTitle>{c.status === 'ativo' ? 'Encerrar contrato' : 'Contrato encerrado'}</CardTitle>
                <p className="m-0 text-[13px] text-muted">
                  {c.status === 'ativo'
                    ? 'Marca o contrato como encerrado hoje. Ele continua no histórico com o documento.'
                    : 'Reative se o contrato foi encerrado por engano ou renovado.'}
                </p>
                <form action={encerrarContrato}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="acao" value={c.status === 'ativo' ? 'encerrar' : 'reabrir'} />
                  <Button variant={c.status === 'ativo' ? 'danger' : 'outline'}>{c.status === 'ativo' ? 'Encerrar contrato' : 'Reativar contrato'}</Button>
                </form>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
