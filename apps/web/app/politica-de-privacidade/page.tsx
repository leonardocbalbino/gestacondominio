import type { Metadata } from 'next';
import { PRAZO_RESPOSTA_TITULAR_DIAS } from '@gc/core';
import { EmailSuporte, PaginaPublica } from '@/components/pagina-publica';
import { contato, POLITICA_ATUALIZADA_EM } from '@/lib/contato';

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: 'Como o GestaCondomínio trata os dados pessoais de moradores, locatários, hóspedes e funcionários (LGPD).',
};
// Lê o contato do ambiente em tempo de execução.
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <PaginaPublica titulo="Política de privacidade" subtitulo={`Última atualização: ${POLITICA_ATUALIZADA_EM}`}>
      <p>
        Esta política explica como o aplicativo e o painel <b>GestaCondomínio</b> tratam dados pessoais, conforme a Lei Geral de Proteção de Dados
        (Lei 13.709/2018, LGPD). Ela vale para moradores, proprietários, locatários, hóspedes, síndicos, conselheiros e funcionários da portaria.
      </p>

      <h2>1. Quem é responsável pelos seus dados</h2>
      <p>
        O <b>condomínio</b> ao qual você está vinculado é o <b>controlador</b>: ele decide quais dados são coletados e para quê. A plataforma
        GestaCondomínio, operada por <b>{contato.responsavel}</b>, é a <b>operadora</b> (art. 39 da LGPD): trata os dados somente para prestar o
        serviço ao condomínio, segundo as instruções dele e um contrato de tratamento de dados aceito pelo síndico.
      </p>

      <h2>2. Dados que tratamos</h2>
      <ul>
        <li><b>Cadastro:</b> nome, e-mail, celular, CPF, unidade e tipo de vínculo (proprietário, locatário, hóspede, funcionário).</li>
        <li><b>Conta:</b> senha (guardada só como hash bcrypt), segredo do 2FA, sessões e o IP de acesso.</li>
        <li>
          <b>Biometria facial (dado sensível):</b> uma foto do rosto, coletada <b>somente com consentimento explícito</b> pelo link de cadastro
          facial, para liberar a entrada nos leitores do condomínio.
        </li>
        <li><b>Uso do condomínio:</b> reservas, cessões de vaga (incluindo placa do veículo), encomendas, ocorrências, votos em assembleias, dúvidas e documentos enviados (como contratos de locação).</li>
        <li><b>Portaria:</b> registros de entrada e saída.</li>
        <li><b>Notificações:</b> o identificador de notificações do seu aparelho, se você permitir.</li>
      </ul>
      <p>
        Não coletamos localização, contatos, fotos da galeria, dados de publicidade nem fazemos rastreamento entre apps ou sites. O app não tem
        anúncios.
      </p>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Identificar você e manter sua conta segura (execução de contrato e legítimo interesse em segurança).</li>
        <li>Prestar os serviços do condomínio: reservas, encomendas, vagas, locações, assembleias e transparência (execução de contrato e obrigações da convenção condominial).</li>
        <li>Controlar o acesso físico ao condomínio, inclusive pela biometria facial (consentimento, art. 11, I, LGPD).</li>
        <li>Cumprir obrigações legais e exercer direitos em processos (art. 7º, II e VI).</li>
      </ul>
      <p>Seus dados não são vendidos nem usados para marketing ou perfilamento.</p>

      <h2>4. Com quem compartilhamos</h2>
      <ul>
        <li><b>Administração do condomínio</b> (síndico, conselho e portaria), cada um vendo só o necessário à sua função. A portaria vê o CPF mascarado.</li>
        <li><b>Leitores de acesso facial</b> instalados no condomínio (Control iD, Hikvision ou Intelbras), que recebem a foto para liberar a entrada.</li>
        <li><b>Fornecedores de infraestrutura</b>: hospedagem do servidor, envio de e-mails e serviço de notificações (Expo, Apple e Google), contratados com obrigação de sigilo.</li>
        <li><b>Autoridades</b>, quando houver ordem legal.</li>
      </ul>

      <h2>5. Por quanto tempo guardamos</h2>
      <ul>
        <li>Biometria de hóspedes e locatários: apagada automaticamente no check-out ou no fim do contrato. De moradores: enquanto durar o vínculo, ou até você revogar o consentimento.</li>
        <li>Registros da portaria: 6 meses, ou o prazo definido pelo condomínio.</li>
        <li>Demais dados: enquanto houver vínculo com o condomínio, e depois pelo prazo exigido por lei.</li>
      </ul>

      <h2>6. Como protegemos</h2>
      <p>
        CPF, celular, segredos de 2FA e arquivos (fotos faciais e contratos) ficam criptografados. O banco isola os dados de cada condomínio
        (segurança em nível de linha), o acesso de síndico, dono e portaria exige verificação em duas etapas, e há backups diários.
      </p>

      <h2>7. Seus direitos</h2>
      <p>
        Você pode confirmar o tratamento, acessar, corrigir, exportar, pedir a exclusão dos seus dados e revogar o consentimento da biometria a
        qualquer momento, sem custo:
      </p>
      <ul>
        <li>no app, em <b>Perfil</b> (exportar dados, corrigir, pedir exclusão da conta, revogar a facial);</li>
        <li>no site, em <a href="/privacidade">/privacidade</a>, após entrar;</li>
        <li>por e-mail: <EmailSuporte assunto="LGPD - pedido do titular" />.</li>
      </ul>
      <p>
        O condomínio tem até {PRAZO_RESPOSTA_TITULAR_DIAS} dias para responder. Veja como <a href="/excluir-conta">excluir sua conta</a>. Você também
        pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>8. Crianças e adolescentes</h2>
      <p>
        O app é destinado a maiores de 18 anos. Dados de menores (por exemplo, a biometria de um filho morador) só são cadastrados por um
        responsável legal e com o consentimento dele.
      </p>

      <h2>9. Mudanças e contato</h2>
      <p>
        Avisaremos no app sobre mudanças relevantes nesta política. Dúvidas e o encarregado de dados (DPO): <EmailSuporte assunto="Privacidade" />.
      </p>
    </PaginaPublica>
  );
}
