import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VERSAO_DPA } from '@gc/core';
import { mensagemDoBanco } from '@gc/db';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { autenticar, gravarCookieSessao, ipDaRequisicao } from '@/lib/auth';
import { banco, MODO_DEMO } from '@/lib/db';
import { limitar } from '@/lib/limite';

export const metadata: Metadata = { title: 'Aceitar convite', robots: { index: false } };
export const dynamic = 'force-dynamic';

async function aceitar(form: FormData) {
  'use server';
  const token = String(form.get('token'));
  if (!(await limitar('convite', 10, 10 * 60_000))) redirect(`/convite/${token}?erro=${encodeURIComponent('Muitas tentativas')}`);
  const nome = String(form.get('nome') ?? '').trim();
  const senha = String(form.get('senha') ?? '');
  let email: string;
  try {
    const [r] = await banco().comoAnon((q) => q<{ email: string }>('select public.cadastrar_por_convite($1, $2, $3) as email', [token, nome, senha]));
    email = r!.email;
  } catch (e) {
    redirect(`/convite/${token}?erro=${encodeURIComponent(mensagemDoBanco(e, 'Não foi possível criar sua conta'))}`);
  }
  const login = await autenticar(email, senha, 'web');
  if (!login.ok) redirect('/login');
  await gravarCookieSessao(login.token);
  // Síndico aceita o contrato de operador (DPA): data, IP e versão ficam registrados.
  if (form.get('dpa') === 'on') {
    const ip = await ipDaRequisicao();
    await banco()
      .comoUsuario(login.userId, async (q) => {
        const [m] = await q<{ condominio_id: string }>(`select condominio_id from public.membros_condominio where user_id = $1 and papel = 'sindico'`, [login.userId]);
        if (m) await q('select public.aceitar_dpa($1, $2, $3)', [m.condominio_id, VERSAO_DPA, ip]);
      })
      .catch(() => {});
  }
  redirect('/login/2fa?cadastrar=1');
}

export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { token } = await params;
  const { erro } = await searchParams;
  const info = MODO_DEMO
    ? null
    : (await banco().comoAnon((q) => q<{ condominio: string; papel: string; email_mascarado: string; valido: boolean }>('select * from public.convite_info($1)', [token])))[0];

  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center gap-4 px-5">
      <h1 className="m-0 font-heading text-2xl font-semibold">Você foi convidado</h1>
      {MODO_DEMO ? (
        <p className="text-muted">No modo demonstração os convites não são processados. Configure o banco (DATABASE_URL) para usar este fluxo.</p>
      ) : !info?.valido ? (
        <p className="text-muted">Este convite expirou ou já foi usado. Peça um novo a quem convidou você.</p>
      ) : (
        <Card className="p-5">
          <p className="m-0 mb-3 text-[13px] text-muted">
            {info.condominio} · conta para <b>{info.email_mascarado}</b>
          </p>
          <form action={aceitar} className="flex flex-col gap-3">
            <input type="hidden" name="token" value={token} />
            <Field label="Nome completo">
              <Input name="nome" required autoComplete="name" />
            </Field>
            <Field label="Crie uma senha" hint="Mínimo de 10 caracteres">
              <Input name="senha" type="password" minLength={10} required autoComplete="new-password" />
            </Field>
            {info.papel === 'sindico' ? (
              <label className="flex items-start gap-2.5 text-[13px]">
                <input type="checkbox" name="dpa" required className="mt-0.5 h-5 w-5 accent-primary" />
                <span>
                  Como representante do condomínio (controlador), aceito o <a href="/privacidade">contrato de tratamento de dados (DPA)</a>, versão{' '}
                  {VERSAO_DPA}.
                </span>
              </label>
            ) : null}
            {erro ? (
              <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
                {erro}
              </p>
            ) : null}
            <Button size="lg">Criar acesso</Button>
          </form>
        </Card>
      )}
    </main>
  );
}
