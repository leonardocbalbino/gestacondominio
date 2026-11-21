import { z } from 'zod';
import { validarCelular, validarCPF, validarPlaca, normalizarPlaca, apenasDigitos } from './documentos';
import { parseDataBR } from './format';

const dataBR = z
  .string()
  .trim()
  .refine((v) => parseDataBR(v) !== null, { message: 'Use o formato dd/mm/aaaa' });

const celular = z
  .string()
  .trim()
  .refine(validarCelular, { message: 'Celular inválido — use (00) 9 0000-0000' })
  .transform(apenasDigitos);

export const cpfSchema = z
  .string()
  .trim()
  .refine(validarCPF, { message: 'CPF inválido' })
  .transform(apenasDigitos);

/** Morador · Ceder vaga */
export const cessaoVagaSchema = z
  .object({
    vagaId: z.string().uuid({ message: 'Escolha a vaga' }),
    unidadeCessionariaId: z.string().uuid({ message: 'Escolha a unidade que vai usar' }),
    inicio: dataBR,
    semTermino: z.boolean().default(false),
    fim: z.string().trim().optional(),
    placa: z
      .string()
      .trim()
      .refine(validarPlaca, { message: 'Placa inválida (ex.: RTX-4E21)' })
      .transform(normalizarPlaca),
    valorMensal: z.number().nonnegative().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.semTermino) return;
    const fim = v.fim ? parseDataBR(v.fim) : null;
    if (!fim) {
      ctx.addIssue({ code: 'custom', path: ['fim'], message: 'Informe o fim ou marque "Sem data de término"' });
      return;
    }
    const ini = parseDataBR(v.inicio);
    if (ini && fim <= ini) ctx.addIssue({ code: 'custom', path: ['fim'], message: 'O fim deve ser depois do início' });
  });
export type CessaoVagaInput = z.input<typeof cessaoVagaSchema>;

export const ORIGENS_TEMPORADA = ['Airbnb', 'Booking', 'Direto'] as const;

/** Morador · Cadastrar locatário · Temporada */
export const locacaoTemporadaSchema = z
  .object({
    tipo: z.literal('temporada'),
    responsavel: z.string().trim().min(3, 'Informe o nome do responsável'),
    celular,
    checkin: z.coerce.date(),
    checkout: z.coerce.date(),
    hospedes: z.number().int().min(1).max(20),
    origem: z.enum(ORIGENS_TEMPORADA),
  })
  .refine((v) => v.checkout > v.checkin, { path: ['checkout'], message: 'O check-out deve ser depois do check-in' });

/** Morador · Cadastrar locatário · Aluguel */
export const locacaoAluguelSchema = z
  .object({
    tipo: z.literal('aluguel'),
    nome: z.string().trim().min(3, 'Informe o nome completo'),
    celular,
    inicio: dataBR,
    fim: dataBR,
    imobiliaria: z.string().trim().optional(),
    moradores: z.number().int().min(1).max(20),
    contratoPath: z.string().optional(),
  })
  .refine((v) => (parseDataBR(v.fim) ?? 0) > (parseDataBR(v.inicio) ?? 0), {
    path: ['fim'],
    message: 'O fim do contrato deve ser depois do início',
  });

export const locacaoSchema = z.union([locacaoTemporadaSchema, locacaoAluguelSchema]);
export type LocacaoInput = z.input<typeof locacaoSchema>;

/** Dono · criar condomínio */
export const novoCondominioSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome do condomínio'),
  cnpj: z
    .string()
    .trim()
    .transform(apenasDigitos)
    .refine((v) => v.length === 14, 'CNPJ deve ter 14 dígitos')
    .optional(),
  cidade: z.string().trim().min(2),
  uf: z.string().trim().length(2).toUpperCase(),
  planoId: z.string().uuid(),
  sindicoEmail: z.string().trim().email('E-mail do síndico inválido'),
  sindicoNome: z.string().trim().min(3),
});
export type NovoCondominioInput = z.input<typeof novoCondominioSchema>;

/** Link externo · cadastro facial — o botão "Tirar foto" só libera com consentimento. */
export const consentimentoFacialSchema = z.object({
  token: z.string().min(32),
  aceite: z.literal(true, { message: 'É preciso autorizar o uso da imagem para continuar' }),
  versaoTermo: z.string(),
});
