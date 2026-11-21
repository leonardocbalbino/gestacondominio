import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VERSAO_DPA } from '@gc/core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { MODO_DEMO, supabaseServidor } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export const metadata: Metadata = { title: 'Aceitar convite', robots: { index: false } };
export const dynamic = 'force-dynamic';

async function aceitar(form: FormData) {
  'use server';
  const token = String(form.get('token'));
  const sb = await supabaseServidor();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) {
    const { error } = await sb.auth.signUp({
      email: String(form.get('email')),
      password: String(form.get('senha')),
      options: { data: { nome: String(form.get('nome')) } },
    });
    if (error) redirect(`/convite/${token}?erro=cadastro`);
  }
  const { data: cid, error } = await sb.rpc('aceitar_convite', { p_token: token });
  if (error) redirect(`/convite/${token}?erro=convite`);
  // Síndico aceita o contrato de operador (DPA): data, IP e versão ficam registrados.
  if (form.get('dpa') === 'on') {
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    await sb.rpc('aceitar_dpa', { p_condominio: cid, p_versao: VERSAO_DPA, p_ip: ip });
  }
  redirect('/login/2fa?cadastrar=1');
}

export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { token } = await params;
  const { erro } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center gap-4 px-5">
      <h1 className="m-0 font-heading text-2xl font-semibold">Você foi convidado</h1>
      {MODO_DEMO ? (
        <p className="text-muted">No modo demonstração os convites não são processados. Configure o Supabase para usar este fluxo.</p>
      ) : (
        <Card className="p-5">
          <form action={aceitar} className="flex flex-col gap-3">
            <input type="hidden" name="token" value={token} />
            <Field label="Nome completo">
              <Input name="nome" required autoComplete="name" />
            </Field>
            <Field label="E-mail">
              <Input name="email" type="email" required autoComplete="email" />
            </Field>
            <Field label="Crie uma senha">
              <Input name="senha" type="password" minLength={10} required autoComplete="new-password" />
            </Field>
            <label className="flex items-start gap-2.5 text-[13px]">
              <input type="checkbox" name="dpa" required className="mt-0.5 h-5 w-5 accent-primary" />
              <span>
                Como representante do condomínio (controlador), aceito o <a href="/privacidade">contrato de tratamento de dados (DPA)</a>, versão{' '}
                {VERSAO_DPA}.
              </span>
            </label>
            {erro ? (
              <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
                {erro === 'convite' ? 'Convite inválido ou expirado.' : 'Não foi possível criar sua conta.'}
              </p>
            ) : null}
            <Button size="lg">Aceitar convite</Button>
          </form>
        </Card>
      )}
    </main>
  );
}
