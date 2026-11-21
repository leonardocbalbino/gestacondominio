'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { entrar } from './actions';

export function FormLogin({ demo }: { demo: boolean }) {
  const [estado, acao, pendente] = useActionState(entrar, {});
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h1 className="m-0 font-heading text-2xl font-semibold">Entrar</h1>
      <form action={acao} className="flex flex-col gap-4">
        {demo ? (
          <>
            <p className="m-0 rounded-md border border-primary-soft-border bg-primary-tint p-3 text-[13px]">
              <b>Modo demonstração</b> — sem Supabase configurado. Escolha um perfil fictício para explorar.
            </p>
            <fieldset className="flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1.5 text-[13px] font-semibold">Perfil</legend>
              {[
                ['dono', 'Dono do sistema', 'Só métricas agregadas'],
                ['sindico', 'Síndica · Helena Prado', 'Res. Jardim das Acácias'],
                ['portaria', 'Portaria · José Antunes', 'Res. Jardim das Acácias'],
              ].map(([v, t, d], i) => (
                <label key={v} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line px-3.5 py-2.5 has-[:checked]:border-2 has-[:checked]:border-primary has-[:checked]:bg-primary-tint">
                  <input type="radio" name="perfil" value={v} defaultChecked={i === 0} className="h-[18px] w-[18px] accent-primary" />
                  <span>
                    <span className="block font-semibold">{t}</span>
                    <span className="text-xs text-muted">{d}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </>
        ) : (
          <>
            <Field label="E-mail">
              <Input name="email" type="email" autoComplete="email" required />
            </Field>
            <Field label="Senha">
              <Input name="senha" type="password" autoComplete="current-password" required />
            </Field>
          </>
        )}
        {estado?.erro ? (
          <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
            {estado.erro}
          </p>
        ) : null}
        <Button size="lg" disabled={pendente}>
          {pendente ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </Card>
  );
}
