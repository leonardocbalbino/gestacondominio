import type { Metadata } from 'next';
import Link from 'next/link';
import { Cabecalho } from '@/components/painel';
import { FormContrato } from '@/components/form-contrato';
import { Aviso } from '@/components/gestao-ui';
import { Card } from '@/components/ui/card';
import { exigirPerfil } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Novo contrato' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await exigirPerfil('sindico');
  const { erro } = await searchParams;
  return (
    <>
      <Link href="/sindico/contratos" className="text-[13px] font-semibold">← Contratos</Link>
      <Cabecalho titulo="Novo contrato" descricao="Cadastre o fornecedor, a vigência e anexe o PDF assinado. Você recebe alerta antes do vencimento." />
      <Aviso erro={erro} />
      <Card className="max-w-3xl p-5">
        <FormContrato />
      </Card>
    </>
  );
}
