import type { Metadata } from 'next';
import { VERSAO_TERMO_BIOMETRIA } from '@gc/core';

export const metadata: Metadata = { title: 'Termo de uso da biometria facial' };

export default function Page() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-3 px-5 py-8 text-[15px]">
      <h1 className="m-0 font-heading text-2xl font-semibold">Termo de consentimento — biometria facial</h1>
      <p className="m-0 text-xs text-muted">Versão {VERSAO_TERMO_BIOMETRIA}</p>
      <p>
        <b>Finalidade única:</b> sua imagem facial é usada exclusivamente para liberar sua entrada no condomínio pelos leitores faciais. Não é usada
        para marketing, perfilamento ou qualquer outra finalidade.
      </p>
      <p>
        <b>Controlador:</b> o condomínio que enviou o link. <b>Operadora:</b> a plataforma GestaCondomínio, que armazena a imagem criptografada em
        área privada, acessível apenas por links temporários e pelos equipamentos de acesso do condomínio.
      </p>
      <p>
        <b>Prazo:</b> para hóspedes e locatários, a imagem é apagada automaticamente após o check-out ou o fim do contrato. Para moradores, enquanto
        durar o vínculo com a unidade.
      </p>
      <p>
        <b>Seus direitos:</b> você pode revogar este consentimento e pedir a exclusão a qualquer momento, sem custo, pelo app ou falando com o
        encarregado de dados do condomínio. A revogação apaga a imagem e remove seu cadastro dos leitores.
      </p>
      <p>
        <b>Registro:</b> guardamos a data, o IP e a versão deste termo no momento do aceite, como prova do consentimento (art. 8º, LGPD).
      </p>
    </main>
  );
}
