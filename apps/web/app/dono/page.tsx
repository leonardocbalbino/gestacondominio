import type { Metadata } from 'next';
import { formatDiaMesHora, K_ANONIMATO } from '@gc/core';
import { Painel } from '@/components/painel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/field';
import { metricasDono, pedidosSuporte, planos } from '@/lib/dados';
import { exigirPerfil } from '@/lib/sessao';
import { solicitarSuporte } from './actions';
import { NovoCondominio } from './novo-condominio';

export const metadata: Metadata = { title: 'Dono do sistema' };
export const dynamic = 'force-dynamic';

const STATUS: Record<string, { texto: string; tom: 'ok' | 'warn' | 'neu' | 'bad' | 'info' }> = {
  ativo: { texto: 'Ativo', tom: 'ok' },
  implantacao: { texto: 'Implantação', tom: 'info' },
  suspenso: { texto: 'Suspenso', tom: 'warn' },
  encerrado: { texto: 'Encerrado', tom: 'neu' },
  solicitado: { texto: 'Aguardando síndico', tom: 'warn' },
  aprovado: { texto: 'Aprovado', tom: 'ok' },
  negado: { texto: 'Negado', tom: 'bad' },
  expirado: { texto: 'Expirado', tom: 'neu' },
  revogado: { texto: 'Revogado', tom: 'neu' },
};

export default async function Page() {
  const sessao = await exigirPerfil('dono');
  const [metricas, listaPlanos, suporte] = await Promise.all([metricasDono(), planos(), pedidosSuporte()]);
  const ativos = metricas.filter((m) => m.status === 'ativo').length;

  return (
    <Painel sessao={sessao} titulo="Visão da plataforma">
      <p className="m-0 flex items-start gap-2 rounded-lg border border-primary-soft-border bg-primary-tint p-3 text-[13px]">
        <span aria-hidden>🔒</span>
        <span>
          Como operador (LGPD), você vê apenas <b>números agregados</b>. Nomes, CPFs e unidades ficam bloqueados no banco. Contagens
          abaixo de {K_ANONIMATO} aparecem como “&lt; {K_ANONIMATO}”. Para suporte, peça acesso temporário ao síndico.
        </span>
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Condomínios', String(metricas.length)],
          ['Ativos', String(ativos)],
          ['Em implantação', String(metricas.filter((m) => m.status === 'implantacao').length)],
          ['Pedidos de suporte', String(suporte.filter((s) => s.status === 'solicitado').length)],
        ].map(([r, v]) => (
          <Card key={r} className="p-4">
            <div className="text-xs font-semibold text-muted">{r}</div>
            <div className="font-heading text-[26px] font-semibold">{v}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 pb-1.5 pt-3.5">
          <CardTitle>Condomínios</CardTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
            <thead className="text-xs text-muted">
              <tr>
                {['Condomínio', 'Plano', 'Status', 'Unidades', 'Moradores ativos', 'Pedidos (30 dias)', 'Faciais ativas', 'Hóspedes no mês'].map((h) => (
                  <th key={h} scope="col" className="border-t border-surface-2 px-4 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricas.map((m) => (
                <tr key={m.condominio_id} className="border-t border-surface-2">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold">{m.nome}</div>
                    <div className="text-xs text-muted">
                      {m.cidade}-{m.uf}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{m.plano ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge tom={STATUS[m.status]?.tom}>{STATUS[m.status]?.texto ?? m.status}</Badge>
                  </td>
                  {[m.unidades, m.moradores_ativos, m.pedidos_30d, m.biometrias_ativas, m.hospedes_mes].map((v, i) => (
                    <td key={i} className="px-4 py-2.5 font-heading text-[15px] font-semibold tabular-nums">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <NovoCondominio planos={listaPlanos} />

        <Card className="flex flex-col gap-3 p-4">
          <CardTitle>Acesso de suporte (break-glass)</CardTitle>
          <p className="m-0 text-[13px] text-muted">
            Só leitura, com prazo de 1h, 4h ou 24h, e precisa da aprovação do síndico. Tudo fica registrado na auditoria do condomínio.
          </p>
          <form action={solicitarSuporte} className="flex flex-col gap-2.5">
            <Select name="condominioId" aria-label="Condomínio" required>
              {metricas.map((m) => (
                <option key={m.condominio_id} value={m.condominio_id}>
                  {m.nome}
                </option>
              ))}
            </Select>
            <textarea
              name="motivo"
              required
              placeholder="Motivo / número do chamado"
              className="min-h-20 rounded-md border border-line-input bg-surface p-3 text-[15px]"
            />
            <div className="flex gap-2">
              <Select name="horas" aria-label="Duração" defaultValue="1" className="w-32">
                <option value="1">1 hora</option>
                <option value="4">4 horas</option>
                <option value="24">24 horas</option>
              </Select>
              <Button className="flex-1">Pedir acesso ao síndico</Button>
            </div>
          </form>
          <ul className="m-0 flex list-none flex-col p-0">
            {suporte.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 border-t border-surface-2 py-2.5">
                <div>
                  <div className="font-semibold">
                    {s.condominio || metricas.find((m) => m.condominio_id === s.condominioId)?.nome || 'Condomínio'}
                  </div>
                  <div className="text-xs text-muted">
                    {s.motivo} · {s.duracaoHoras}h{s.expiraEm ? ` · até ${formatDiaMesHora(s.expiraEm)}` : ''}
                  </div>
                </div>
                <Badge tom={STATUS[s.status]?.tom}>{STATUS[s.status]?.texto}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Painel>
  );
}
