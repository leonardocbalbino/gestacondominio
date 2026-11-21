/** Formatação pt-BR. O condomínio opera sempre em America/Sao_Paulo. */
export const TIMEZONE = 'America/Sao_Paulo';
export const LOCALE = 'pt-BR';

/** R$ 78.400 (sem centavos quando inteiro) ou R$ 1.234,56. */
export function formatBRL(valor: number): string {
  const inteiro = Number.isInteger(valor);
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: inteiro ? 0 : 2,
    maximumFractionDigits: 2,
  })
    .format(valor)
    .replace(/ /g, ' ');
}

function partes(data: Date) {
  const p = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(data);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { dia: get('day'), mes: get('month'), ano: get('year'), hora: get('hour'), min: get('minute') };
}

/** 22/11 */
export function formatDiaMes(data: Date): string {
  const { dia, mes } = partes(data);
  return `${dia}/${mes}`;
}

/** 01/12/2026 */
export function formatData(data: Date): string {
  const { dia, mes, ano } = partes(data);
  return `${dia}/${mes}/${ano}`;
}

/** 14:22 */
export function formatHora(data: Date): string {
  const { hora, min } = partes(data);
  return `${hora}:${min}`;
}

/** 23/11 às 14:22 */
export function formatDiaMesHora(data: Date): string {
  return `${formatDiaMes(data)} às ${formatHora(data)}`;
}

/** 22/11 · 14h — formato compacto de check-in/check-out. */
export function formatCheck(data: Date): string {
  const { hora, min } = partes(data);
  return `${formatDiaMes(data)} · ${Number(hora)}h${min === '00' ? '' : min}`;
}

/** "22 a 25/11" no mesmo mês; "28/11 a 02/12" entre meses; "13/12 · 18h às 23h" no mesmo dia. */
export function formatPeriodo(inicio: Date, fim: Date): string {
  const a = partes(inicio);
  const b = partes(fim);
  if (a.dia === b.dia && a.mes === b.mes && a.ano === b.ano) return `${a.dia}/${a.mes} · ${formatFaixaHoras(inicio, fim)}`;
  if (a.mes === b.mes && a.ano === b.ano) return `${a.dia} a ${b.dia}/${b.mes}`;
  return `${a.dia}/${a.mes} a ${b.dia}/${b.mes}`;
}

/** "18h às 23h" */
export function formatFaixaHoras(inicio: Date, fim: Date): string {
  return `${Number(partes(inicio).hora)}h às ${Number(partes(fim).hora)}h`;
}

/**
 * Lê data+hora digitadas no formato das telas: "22/11 · 14h", "22/11 14h", "22/11/2026 14:30".
 * Sem ano, assume a próxima ocorrência a partir de `ref` (check-in é sempre futuro próximo).
 */
export function parseCheckBR(texto: string, ref = new Date()): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*(?:·|às|,|-)?\s*(\d{1,2})\s*(?:h|:)?\s*(\d{2})?\s*h?$/i.exec(texto.trim());
  if (!m) return null;
  const [, d, mo, y, h, mi] = m;
  const hh = Number(h);
  const mm = Number(mi ?? '0');
  if (hh > 23 || mm > 59) return null;
  const pad = (n: string | number) => String(n).padStart(2, '0');
  const montar = (ano: number) => parseDataBR(`${pad(d!)}/${pad(mo!)}/${ano}`, `${pad(hh)}:${pad(mm)}`);
  if (y) return montar(Number(y));
  const anoRef = Number(formatData(ref).slice(6));
  const data = montar(anoRef);
  if (!data) return null;
  // Mais de 1 dia no passado → é do ano seguinte (ex.: digitar 05/01 em dezembro).
  return data.getTime() < ref.getTime() - 86_400_000 ? montar(anoRef + 1) : data;
}

/** Converte "dd/mm/aaaa" (horário de Brasília, -03:00) em Date. Retorna null se inválida. */
export function parseDataBR(texto: string, hora = '00:00'): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const data = new Date(`${y}-${mo}-${d}T${hora}:00-03:00`);
  if (Number.isNaN(data.getTime())) return null;
  if (formatData(data) !== `${d}/${mo}/${y}`) return null; // rejeita 31/02 etc.
  return data;
}
