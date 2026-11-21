import { describe, expect, it } from 'vitest';
import {
  cessaoVagaSchema,
  classificarCotacoes,
  contagemAnonima,
  estadoEtapas,
  expiracaoLink,
  expiracaoSuporte,
  formatBRL,
  formatCheck,
  formatDiaMesHora,
  formatPeriodo,
  linkFacialValido,
  locacaoSchema,
  mascararCPF,
  mascararCelular,
  parseDataBR,
  pode,
  podeTransicionarCessao,
  resumoCotacoes,
  detalheCotacao,
  textoValidadeLink,
  validarCPF,
  validarPlaca,
} from '../src';
import { demoDemandas } from '../src/demo';
import { paraBase64 } from '../src/acesso';

describe('formatação pt-BR', () => {
  it('formata reais sem centavos quando inteiro', () => {
    expect(formatBRL(78400)).toBe('R$ 78.400');
    expect(formatBRL(1234.5)).toBe('R$ 1.234,50');
  });
  it('usa America/Sao_Paulo', () => {
    const d = new Date('2026-11-23T17:22:00Z');
    expect(formatDiaMesHora(d)).toBe('23/11 às 14:22');
    expect(formatCheck(new Date('2026-11-22T17:00:00Z'))).toBe('22/11 · 14h');
  });
  it('formata períodos', () => {
    expect(formatPeriodo(new Date('2026-11-22T17:00:00Z'), new Date('2026-11-25T14:00:00Z'))).toBe('22 a 25/11');
    expect(formatPeriodo(new Date('2026-11-28T17:00:00Z'), new Date('2026-12-02T14:00:00Z'))).toBe('28/11 a 02/12');
    expect(formatPeriodo(new Date('2026-12-13T21:00:00Z'), new Date('2026-12-14T02:00:00Z'))).toBe('13/12 · 18h às 23h');
  });
  it('lê datas dd/mm/aaaa e rejeita inválidas', () => {
    expect(parseDataBR('01/12/2026')?.toISOString()).toBe('2026-12-01T03:00:00.000Z');
    expect(parseDataBR('31/02/2026')).toBeNull();
    expect(parseDataBR('2026-12-01')).toBeNull();
  });
});

describe('documentos e LGPD', () => {
  it('valida e mascara CPF para a portaria', () => {
    expect(validarCPF('529.982.247-25')).toBe(true);
    expect(validarCPF('111.111.111-11')).toBe(false);
    expect(mascararCPF('123.456.789-09')).toBe('***.456.789-**');
  });
  it('mascara celular', () => {
    expect(mascararCelular('(41) 9 9812-3344')).toBe('(41) 9 ****-3344');
  });
  it('valida placas antiga e Mercosul', () => {
    expect(validarPlaca('RTX-4E21')).toBe(true);
    expect(validarPlaca('ABC-1234')).toBe(true);
    expect(validarPlaca('12-ABCD')).toBe(false);
  });
  it('suprime contagens pequenas (k-anonimato)', () => {
    expect(contagemAnonima(0)).toBe('< 3');
    expect(contagemAnonima(2)).toBe('< 3');
    expect(contagemAnonima(3)).toBe('3');
  });
  it('dono do sistema só vê agregados', () => {
    expect(pode('dono', 'ver_metricas_agregadas')).toBe(true);
    expect(pode('dono', 'ver_dados_pessoais')).toBe(false);
    expect(pode('portaria', 'ver_contratos')).toBe(false);
    expect(pode('portaria', 'ver_cpf_completo')).toBe(false);
  });
  it('break-glass aceita só 1h, 4h ou 24h', () => {
    const t = new Date('2026-11-21T12:00:00Z');
    expect(expiracaoSuporte(t, 4).toISOString()).toBe('2026-11-21T16:00:00.000Z');
    expect(() => expiracaoSuporte(t, 48)).toThrow();
  });
});

describe('transparência', () => {
  const laje = demoDemandas[0]!;
  it('marca menor preço e acima do teto (teto R$ 90.000)', () => {
    const r = classificarCotacoes(laje.cotacoes, laje.teto);
    expect(r.map((c) => [c.fornecedor, c.selo])).toEqual([
      ['ImperSul', 'menor_preco'],
      ['Vedatec Engenharia', null],
      ['Laje Forte', 'acima_do_teto'],
    ]);
  });
  it('nenhuma cotação ganha "menor preço" se todas estão acima do teto', () => {
    const r = classificarCotacoes([{ id: '1', fornecedor: 'X', valor: 100, prazo_dias: 1, garantia_anos: null }], 50);
    expect(r[0]!.selo).toBe('acima_do_teto');
  });
  it('resume a faixa de valores', () => {
    expect(resumoCotacoes([78400, 86900, 92300])).toBe('3 cotações · de R$ 78.400 a R$ 92.300');
    expect(detalheCotacao({ prazo_dias: 25, garantia_anos: 5 })).toBe('25 dias · garantia 5 anos');
  });
  it('linha do tempo de 5 etapas', () => {
    expect(estadoEtapas('cotacoes').map((e) => e.estado)).toEqual(['done', 'cur', 'todo', 'todo', 'todo']);
  });
});

describe('pedidos do morador', () => {
  it('cessão de vaga exige fim depois do início, salvo "sem término"', () => {
    const base = {
      vagaId: 'c0000000-0000-4000-8000-000000000018',
      unidadeCessionariaId: 'a0000000-0000-4000-8000-000000000207',
      inicio: '01/12/2026',
      placa: 'rtx-4e21',
    };
    expect(cessaoVagaSchema.safeParse({ ...base, fim: '31/05/2027' }).success).toBe(true);
    expect(cessaoVagaSchema.safeParse({ ...base, fim: '01/11/2026' }).success).toBe(false);
    expect(cessaoVagaSchema.safeParse({ ...base, semTermino: true }).success).toBe(true);
    const ok = cessaoVagaSchema.parse({ ...base, semTermino: true });
    expect(ok.placa).toBe('RTX4E21');
  });
  it('locação temporada valida check-out após check-in', () => {
    const v = {
      tipo: 'temporada',
      responsavel: 'Marina Souza',
      celular: '(41) 9 9812-3344',
      checkin: '2026-11-22T14:00:00-03:00',
      checkout: '2026-11-25T11:00:00-03:00',
      hospedes: 2,
      origem: 'Airbnb',
    };
    expect(locacaoSchema.safeParse(v).success).toBe(true);
    expect(locacaoSchema.safeParse({ ...v, checkout: '2026-11-21T11:00:00-03:00' }).success).toBe(false);
  });
  it('fluxo da cessão: unidade confirma antes do síndico', () => {
    expect(podeTransicionarCessao('aguardando_cessionario', 'aprovada')).toBe(false);
    expect(podeTransicionarCessao('aguardando_cessionario', 'aguardando_sindico')).toBe(true);
    expect(podeTransicionarCessao('aguardando_sindico', 'aprovada')).toBe(true);
  });
  it('link facial expira e não pode ser reutilizado', () => {
    const exp = new Date('2026-11-23T17:22:00Z');
    expect(textoValidadeLink(exp)).toBe('Link pessoal · válido até 23/11 às 14:22');
    expect(linkFacialValido(exp, null, new Date('2026-11-22T12:00:00Z'))).toBe(true);
    expect(linkFacialValido(exp, null, new Date('2026-11-24T12:00:00Z'))).toBe(false);
    expect(linkFacialValido(exp, new Date(), new Date('2026-11-22T12:00:00Z'))).toBe(false);
    const enviado = new Date('2026-11-21T12:00:00Z');
    expect(expiracaoLink(enviado, new Date('2026-11-22T12:00:00Z')).toISOString()).toBe('2026-11-22T12:00:00.000Z');
  });
});

describe('adaptadores', () => {
  it('base64 sem Buffer', () => {
    expect(paraBase64(new TextEncoder().encode('Olá!'))).toBe(btoa(String.fromCharCode(...new TextEncoder().encode('Olá!'))));
    expect(paraBase64(new Uint8Array([1, 2]))).toBe('AQI=');
  });
});
