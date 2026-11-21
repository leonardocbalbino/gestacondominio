'use client';

import { useActionState } from 'react';
import { formatBRL } from '@gc/core';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { criarCondominio, type EstadoNovoCondominio } from './actions';

export function NovoCondominio({ planos }: { planos: { id: string; nome: string; max_unidades: number; preco_mensal: number }[] }) {
  const [estado, acao, pendente] = useActionState<EstadoNovoCondominio, FormData>(criarCondominio, {});
  return (
    <Card className="flex flex-col gap-3 p-4">
      <CardTitle>Novo condomínio</CardTitle>
      {estado.conviteLink ? (
        <div className="rounded-md border border-primary-soft-border bg-primary-tint p-3 text-[13px]" role="status">
          <b>{estado.nome}</b> criado em implantação. Convite do síndico (mostrado só agora, válido por 7 dias):
          <code className="mt-1.5 block break-all rounded bg-surface p-2 text-xs">{estado.conviteLink}</code>
        </div>
      ) : null}
      <form action={acao} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Nome">
            <Input name="nome" placeholder="Res. Parque das Araucárias" required />
          </Field>
        </div>
        <Field label="Cidade">
          <Input name="cidade" required />
        </Field>
        <Field label="UF">
          <Input name="uf" maxLength={2} required className="uppercase" />
        </Field>
        <Field label="CNPJ (opcional)">
          <Input name="cnpj" inputMode="numeric" />
        </Field>
        <Field label="Plano">
          <Select name="planoId" required>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · até {p.max_unidades} un. · {formatBRL(p.preco_mensal)}/mês
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nome do síndico">
          <Input name="sindicoNome" required />
        </Field>
        <Field label="E-mail do síndico">
          <Input name="sindicoEmail" type="email" required />
        </Field>
        {estado.erro ? (
          <p role="alert" className="col-span-2 m-0 text-[13px] font-semibold text-danger">
            {estado.erro}
          </p>
        ) : null}
        <div className="col-span-2">
          <Button size="lg" disabled={pendente}>
            Criar e convidar síndico
          </Button>
        </div>
      </form>
    </Card>
  );
}
