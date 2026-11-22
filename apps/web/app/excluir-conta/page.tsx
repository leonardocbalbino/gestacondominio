import type { Metadata } from 'next';
import { PRAZO_RESPOSTA_TITULAR_DIAS } from '@gc/core';
import { EmailSuporte, PaginaPublica } from '@/components/pagina-publica';

export const metadata: Metadata = {
  title: 'Excluir minha conta',
  description: 'Como pedir a exclusão da conta e dos dados no GestaCondomínio.',
};
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <PaginaPublica titulo="Excluir minha conta e meus dados" subtitulo="GestaCondomínio">
      <h2>Pelo app</h2>
      <ul>
        <li>Abra o GestaCondomínio e toque em <b>Perfil</b>.</li>
        <li>Toque em <b>Pedir exclusão da conta</b> e confirme.</li>
        <li>Para apagar só a foto facial, toque em <b>Revogar e apagar minha facial</b>. Ela é apagada em minutos.</li>
      </ul>

      <h2>Pelo site ou por e-mail</h2>
      <p>
        Entre em <a href="/privacidade">/privacidade</a> e use <b>Pedir exclusão</b>, ou escreva para{' '}
        <EmailSuporte assunto="Excluir minha conta" /> a partir do e-mail da sua conta, informando o condomínio e a unidade.
      </p>

      <h2>O que acontece depois</h2>
      <ul>
        <li>O pedido é registrado e o condomínio responde em até {PRAZO_RESPOSTA_TITULAR_DIAS} dias.</li>
        <li>São apagados: sua conta de acesso, cadastro (nome, e-mail, celular, CPF), biometria facial, identificadores de notificação e documentos enviados por você.</li>
        <li>
          Podem ser mantidos pelo prazo legal, e depois apagados: registros da portaria (até 6 meses), votos em assembleias e registros de
          consentimento, por obrigação legal ou para defesa em processos (art. 16 da LGPD).
        </li>
      </ul>
      <p className="text-[13px] text-muted">
        Se você deixar de morar no condomínio, o síndico também pode encerrar seu vínculo; a biometria é apagada automaticamente.
      </p>
    </PaginaPublica>
  );
}
