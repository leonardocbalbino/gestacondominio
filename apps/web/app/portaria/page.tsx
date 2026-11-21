import type { Metadata } from 'next';
import { formatData, formatDiaMesHora, formatarPlaca } from '@gc/core';
import { Painel } from '@/components/painel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/field';
import { dadosPortaria } from '@/lib/dados';
import { exigirPerfil } from '@/lib/sessao';
import { registrarAcesso } from './actions';

export const metadata: Metadata = { title: 'Portaria' };
export const dynamic = 'force-dynamic';

const TIPO: Record<string, string> = { entrada: 'Entrada', saida: 'Saída', visitante: 'Visitante', prestador: 'Prestador', entrega: 'Entrega' };

export default async function Page() {
  const sessao = await exigirPerfil('portaria', 'sindico');
  const d = await dadosPortaria(sessao.condominioId!);

  return (
    <Painel sessao={sessao} titulo="Portaria">
      <Card className="p-4">
        <CardTitle className="mb-3">Registrar acesso</CardTitle>
        <form action={registrarAcesso} className="flex flex-wrap gap-2">
          <Select name="tipo" aria-label="Tipo" className="w-40">
            {Object.entries(TIPO).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </Select>
          <Input name="unidade" aria-label="Unidade" placeholder="Unidade (ex.: 304-A)" required className="w-48" />
          <Input name="obs" aria-label="Observação" placeholder="Observação (opcional)" className="min-w-48 flex-1" />
          <Button>Registrar</Button>
        </form>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <div className="px-4 pb-1.5 pt-3.5">
            <CardTitle>Pessoas autorizadas</CardTitle>
            <p className="m-0 mt-1 text-xs text-muted">CPF mascarado. Contratos, valores e contatos não são exibidos à portaria.</p>
          </div>
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="text-xs text-muted">
              <tr>
                {['Nome', 'CPF', 'Unidade', 'Vínculo', 'Facial'].map((h) => (
                  <th key={h} scope="col" className="border-t border-surface-2 px-4 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.pessoas.map((p, i) => (
                <tr key={i} className="border-t border-surface-2">
                  <td className="px-4 py-2.5 font-semibold">{p.nome}</td>
                  <td className="px-4 py-2.5 font-mono text-xs" data-testid="cpf-mascarado">
                    {p.cpf}
                  </td>
                  <td className="px-4 py-2.5">{p.unidade}</td>
                  <td className="px-4 py-2.5">{p.vinculo}</td>
                  <td className="px-4 py-2.5">{p.facial ? <Badge tom="ok">Cadastrada</Badge> : <Badge>Pendente</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="overflow-hidden">
            <div className="px-4 pb-1.5 pt-3.5">
              <CardTitle>Vagas cedidas</CardTitle>
            </div>
            {d.vagas.map((v, i) => (
              <div key={i} className="flex items-center justify-between border-t border-surface-2 px-4 py-2.5">
                <div>
                  <div className="font-semibold">
                    Vaga {v.vaga} · {v.local}
                  </div>
                  <div className="text-xs text-muted">
                    Usada pela {v.unidade}
                    {v.fim ? ` até ${formatData(v.fim)}` : ''}
                  </div>
                </div>
                <span className="rounded-md border border-line px-2 py-1 font-mono text-[13px] font-semibold tracking-wider">{formatarPlaca(v.placa)}</span>
              </div>
            ))}
          </Card>
          <Card className="overflow-hidden">
            <div className="px-4 pb-1.5 pt-3.5">
              <CardTitle>Últimos registros</CardTitle>
              <p className="m-0 mt-1 text-xs text-muted">Guardados por 6 meses e apagados automaticamente.</p>
            </div>
            {d.registros.map((r, i) => (
              <div key={i} className="flex items-center justify-between border-t border-surface-2 px-4 py-2.5">
                <span>
                  <b>{TIPO[r.tipo] ?? r.tipo}</b> · {r.unidade}
                </span>
                <span className="text-xs text-muted">
                  {formatDiaMesHora(r.quando)} · {r.meio}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </Painel>
  );
}
