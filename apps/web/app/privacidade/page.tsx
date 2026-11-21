import type { Metadata } from 'next';
import { PRAZO_RESPOSTA_TITULAR_DIAS, ROTULO_PEDIDO_TITULAR, TIPOS_PEDIDO_TITULAR } from '@gc/core';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { sessaoAtual } from '@/lib/sessao';
import { abrirPedidoTitular } from './actions';

export const metadata: Metadata = { title: 'Privacidade e seus dados' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const sessao = await sessaoAtual();
  const { enviado } = await searchParams;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <h1 className="m-0 font-heading text-2xl font-semibold">Privacidade e seus dados</h1>
      <Card className="flex flex-col gap-2 p-4 text-[14px]">
        <CardTitle>Quem cuida dos seus dados</CardTitle>
        <p className="m-0">
          O <b>condomínio</b> é o controlador dos seus dados pessoais. A plataforma GestaCondomínio atua como <b>operadora</b>, seguindo as
          instruções do condomínio (art. 39 da LGPD), e não usa seus dados para outras finalidades.
        </p>
        <p className="m-0">
          A biometria facial é um dado sensível: só é coletada com seu consentimento explícito, fica criptografada em armazenamento privado e é
          apagada automaticamente no fim do período de acesso (check-out, fim do contrato) ou quando você pedir.
        </p>
        <p className="m-0">Registros da portaria são guardados por 6 meses (ou o prazo definido pelo condomínio) e depois apagados.</p>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <CardTitle>Seus direitos</CardTitle>
        <p className="m-0 text-[13px] text-muted">
          O condomínio tem até {PRAZO_RESPOSTA_TITULAR_DIAS} dias para responder. Cada pedido fica registrado.
        </p>
        {enviado ? (
          <p role="status" className="m-0 rounded-md bg-success-bg p-3 text-[13px] font-semibold text-success">
            Pedido enviado ao encarregado de dados do condomínio.
          </p>
        ) : null}
        {sessao && sessao.perfil !== 'dono' ? (
          <div className="flex flex-col gap-2">
            <a href="/api/meus-dados" className="no-underline">
              <Button variant="outline" size="lg" type="button">
                Baixar meus dados (JSON)
              </Button>
            </a>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TIPOS_PEDIDO_TITULAR.filter((t) => t !== 'exportacao').map((t) => (
                <form key={t} action={abrirPedidoTitular} className="contents">
                  <input type="hidden" name="tipo" value={t} />
                  <Button variant={t === 'exclusao' ? 'danger' : 'outline'}>{ROTULO_PEDIDO_TITULAR[t]}</Button>
                </form>
              ))}
            </div>
          </div>
        ) : (
          <p className="m-0 text-[13px]">
            <a href="/login">Entre</a> com sua conta de morador para ver, exportar, corrigir ou excluir seus dados.
          </p>
        )}
      </Card>
    </main>
  );
}
