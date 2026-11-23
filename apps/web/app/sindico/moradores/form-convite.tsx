'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { convidarMorador, type EstadoConvite } from '../actions';

export function FormConvite({ unidades }: { unidades: { id: string; codigo: string }[] }) {
  const [estado, acao, enviando] = useActionState<EstadoConvite, FormData>(convidarMorador, {});
  return (
    <form action={acao} className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Unidade">
          <Select name="unidade" required defaultValue="">
            <option value="" disabled>Escolha</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.codigo}</option>
            ))}
          </Select>
        </Field>
        <Field label="Vínculo">
          <Select name="tipo" defaultValue="proprietario">
            <option value="proprietario">Proprietário</option>
            <option value="inquilino">Inquilino</option>
            <option value="residente">Residente (familiar)</option>
          </Select>
        </Field>
        <Field label="Nome do morador">
          <Input name="nome" required autoComplete="off" />
        </Field>
        <Field label="E-mail do morador">
          <Input name="email" type="email" required autoComplete="off" />
        </Field>
      </div>
      {estado.erro ? <p role="alert" className="m-0 text-[13px] font-semibold text-danger">{estado.erro}</p> : null}
      {estado.ok ? (
        <div role="status" className="rounded-lg bg-success-bg p-3 text-[13px] font-semibold text-success">
          {estado.ok}
          {estado.link ? <code className="mt-1 block break-all rounded bg-surface p-2 font-mono text-xs text-ink">{estado.link}</code> : null}
        </div>
      ) : null}
      <div>
        <Button disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar convite'}</Button>
      </div>
    </form>
  );
}
