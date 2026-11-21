/** CPF, celular e placa — validação e mascaramento (LGPD: minimização na exibição). */

export function apenasDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

export function validarCPF(cpf: string): boolean {
  const d = apenasDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function formatarCPF(cpf: string): string {
  const d = apenasDigitos(cpf).padStart(11, '0');
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara exibida à portaria: ***.456.789-** */
export function mascararCPF(cpf: string): string {
  const d = apenasDigitos(cpf);
  if (d.length !== 11) return '***.***.***-**';
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** (41) 9 9812-3344 */
export function formatarCelular(tel: string): string {
  const d = apenasDigitos(tel);
  if (d.length !== 11) return tel;
  return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
}

/** (41) 9 ****-3344 */
export function mascararCelular(tel: string): string {
  const d = apenasDigitos(tel);
  if (d.length < 10) return '(**) ****-****';
  return `(${d.slice(0, 2)}) ${d.length === 11 ? '9 ' : ''}****-${d.slice(-4)}`;
}

export function validarCelular(tel: string): boolean {
  const d = apenasDigitos(tel);
  return d.length === 11 && d[2] === '9';
}

/** Aceita placa antiga (ABC-1234) ou Mercosul (ABC1D23 / RTX-4E21). */
export function normalizarPlaca(placa: string): string {
  return placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function validarPlaca(placa: string): boolean {
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(normalizarPlaca(placa));
}

export function formatarPlaca(placa: string): string {
  const p = normalizarPlaca(placa);
  return p.length === 7 ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}
