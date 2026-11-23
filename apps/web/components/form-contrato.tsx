import { salvarContrato } from '@/app/sindico/actions';
import { CATEGORIAS_CONTRATO, PERIODICIDADES, type Contrato } from '@/lib/gestao';
import { Button } from './ui/button';
import { Field, Input, Select } from './ui/field';

const iso = (d: Date | null | undefined) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10) : '');
const moeda = (v: number | null | undefined) => (v == null ? '' : v.toFixed(2).replace('.', ','));

/** Cadastro e edição de contrato com fornecedor (o PDF é cifrado no servidor). */
export function FormContrato({ c }: { c?: Contrato }) {
  return (
    <form action={salvarContrato} className="flex flex-col gap-4">
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Fornecedor">
          <Input name="fornecedor" required defaultValue={c?.fornecedor} placeholder="Razão social ou nome" />
        </Field>
        <Field label="CNPJ/CPF do fornecedor">
          <Input name="cnpj" defaultValue={c?.cnpj ?? ''} placeholder="00.000.000/0000-00" />
        </Field>
        <Field label="Categoria">
          <Select name="categoria" defaultValue={c?.categoria ?? 'manutencao'}>
            {Object.entries(CATEGORIAS_CONTRATO).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Contato do fornecedor" hint="Telefone ou e-mail para chamados">
          <Input name="contato" defaultValue={c?.contato ?? ''} />
        </Field>
      </div>
      <Field label="Objeto do contrato">
        <Input name="objeto" required defaultValue={c?.objeto} placeholder="Ex.: manutenção preventiva dos elevadores" />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Valor (R$)">
          <Input name="valor" inputMode="decimal" defaultValue={moeda(c?.valor)} placeholder="1.890,00" />
        </Field>
        <Field label="Periodicidade do valor">
          <Select name="periodicidade" defaultValue={c?.periodicidade ?? 'mensal'}>
            {Object.entries(PERIODICIDADES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Avisar antes do fim (dias)">
          <Input name="aviso" type="number" min={0} max={365} defaultValue={c?.avisoDias ?? 30} />
        </Field>
        <Field label="Início">
          <Input name="inicio" type="date" required defaultValue={iso(c?.inicio)} />
        </Field>
        <Field label="Fim" hint="Deixe em branco se for por prazo indeterminado">
          <Input name="fim" type="date" defaultValue={iso(c?.fim)} />
        </Field>
        <label className="flex min-h-12 items-center gap-2 self-end text-[14px] font-semibold">
          <input type="checkbox" name="renovacao" defaultChecked={c?.renovacaoAutomatica} className="h-5 w-5 accent-[var(--color-primary)]" />
          Renovação automática
        </label>
      </div>
      <Field label={c?.temDocumento ? 'Substituir documento (PDF)' : 'Documento do contrato (PDF)'} hint="Até 10 MB. Fica criptografado; só síndico e conselho abrem.">
        <input name="documento" type="file" accept="application/pdf" className="text-[14px] font-normal" />
      </Field>
      <Field label="Observações">
        <textarea name="observacoes" rows={3} defaultValue={c?.observacoes ?? ''} className="rounded-md border border-line-input p-3 text-[15px] font-normal" placeholder="Reajuste, multa rescisória, SLA de atendimento…" />
      </Field>
      <div className="flex gap-2">
        <Button>{c ? 'Salvar alterações' : 'Cadastrar contrato'}</Button>
      </div>
    </form>
  );
}
