import type { Metadata } from 'next';
import { EmailSuporte, PaginaPublica } from '@/components/pagina-publica';

export const metadata: Metadata = { title: 'Suporte', description: 'Ajuda e contato do app GestaCondomínio.' };
export const dynamic = 'force-dynamic';

const PERGUNTAS: { p: string; r: React.ReactNode }[] = [
  {
    p: 'Como eu crio minha conta?',
    r: 'Não há cadastro aberto. O síndico do seu condomínio envia um convite por e-mail; abra o link, defina sua senha e entre no app com o mesmo e-mail.',
  },
  { p: 'Esqueci minha senha.', r: 'Peça ao síndico ou à administração do condomínio um novo convite para o seu e-mail.' },
  {
    p: 'Não recebi o convite.',
    r: 'Confira a caixa de spam e se o e-mail informado ao condomínio está correto. O convite expira; se passou do prazo, peça outro ao síndico.',
  },
  {
    p: 'Como cadastro meu rosto para a portaria?',
    r: 'O condomínio envia um link de cadastro facial. Abra no celular, leia e aceite o termo, e tire a foto com boa luz, sem óculos escuros ou boné.',
  },
  {
    p: 'Meu hóspede ou locatário não consegue entrar.',
    r: 'O acesso só vale depois que o síndico aprova o cadastro e entre as datas de check-in e check-out. Confira o pedido em Início → Meus pedidos.',
  },
  { p: 'Não recebo notificações.', r: 'Permita notificações para o GestaCondomínio nas configurações do celular e entre no app de novo.' },
  {
    p: 'Como vejo, corrijo ou apago meus dados?',
    r: (
      <>
        No app, em <b>Perfil</b>. Detalhes na <a href="/politica-de-privacidade">política de privacidade</a> e em{' '}
        <a href="/excluir-conta">excluir minha conta</a>.
      </>
    ),
  },
];

export default function Page() {
  return (
    <PaginaPublica titulo="Suporte" subtitulo="Ajuda para moradores, síndicos e portaria">
      <p>
        Fale com a gente: <EmailSuporte assunto="Suporte GestaCondomínio" />. Respondemos em até 2 dias úteis. Para assuntos do seu condomínio
        (cobranças, regras, liberação de visitantes), fale direto com o síndico ou a administração.
      </p>
      <h2>Perguntas frequentes</h2>
      <div className="flex flex-col gap-2">
        {PERGUNTAS.map((q) => (
          <details key={q.p} className="rounded-xl border border-line bg-surface px-4 py-3">
            <summary className="cursor-pointer font-semibold">{q.p}</summary>
            <p className="mt-2 text-ink-2">{q.r}</p>
          </details>
        ))}
      </div>
      <h2>Ao escrever, informe</h2>
      <ul>
        <li>nome do condomínio e sua unidade;</li>
        <li>modelo do celular e versão do app (em Perfil);</li>
        <li>o que tentou fazer e a mensagem de erro, se houver.</li>
      </ul>
      <p className="text-[13px] text-muted">Nunca pedimos sua senha ou código de verificação por e-mail ou telefone.</p>
    </PaginaPublica>
  );
}
