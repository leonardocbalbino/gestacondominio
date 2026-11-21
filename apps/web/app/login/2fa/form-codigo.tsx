'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { verificarCodigo } from '../actions';

export function FormCodigo() {
  const [estado, acao, pendente] = useActionState(verificarCodigo, {});
  return (
    <form action={acao} className="flex flex-col gap-3">
      <Field label="Código de 6 dígitos">
        <Input name="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus />
      </Field>
      {estado?.erro ? (
        <p role="alert" className="m-0 text-[13px] font-semibold text-danger">
          {estado.erro}
        </p>
      ) : null}
      <Button size="lg" disabled={pendente}>
        Verificar
      </Button>
    </form>
  );
}
