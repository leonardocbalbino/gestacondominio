export const PAPEIS = ['sindico', 'conselho', 'portaria', 'morador', 'hospede'] as const;
export type Papel = (typeof PAPEIS)[number];
export type Perfil = Papel | 'dono';

export const ROTULO_PAPEL: Record<Perfil, string> = {
  dono: 'Dono do sistema',
  sindico: 'Síndico',
  conselho: 'Conselho',
  portaria: 'Portaria',
  morador: 'Morador',
  hospede: 'Hóspede',
};

export type Capacidade =
  | 'ver_dados_pessoais'
  | 'ver_cpf_completo'
  | 'ver_contratos'
  | 'ver_valores_cessao'
  | 'aprovar_pedidos'
  | 'registrar_acesso'
  | 'publicar_transparencia'
  | 'aprovar_suporte'
  | 'ver_metricas_agregadas';

const MATRIZ: Record<Perfil, readonly Capacidade[]> = {
  dono: ['ver_metricas_agregadas'],
  sindico: [
    'ver_dados_pessoais',
    'ver_cpf_completo',
    'ver_contratos',
    'ver_valores_cessao',
    'aprovar_pedidos',
    'publicar_transparencia',
    'aprovar_suporte',
  ],
  conselho: ['publicar_transparencia'],
  portaria: ['registrar_acesso'],
  morador: [],
  hospede: [],
};

/** Espelho da política aplicada no banco (RLS) para decidir o que mostrar na UI. O banco é a fonte de verdade. */
export function pode(perfil: Perfil, cap: Capacidade): boolean {
  return MATRIZ[perfil].includes(cap);
}

/** Papéis que exigem 2FA (TOTP) no login. */
export const EXIGE_2FA: readonly Perfil[] = ['dono', 'sindico', 'portaria'];
