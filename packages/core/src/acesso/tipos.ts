/**
 * Contrato comum dos adaptadores de controle de acesso (leitores faciais).
 * A imagem facial nunca é persistida pelo adaptador: ela chega do bucket privado
 * via URL assinada de curta duração, é enviada ao equipamento e descartada.
 */
export interface UsuarioAcesso {
  /** Identificador estável no equipamento (usamos o id da pessoa, sem dados pessoais). */
  id: string;
  /** Nome de exibição curto — primeiro nome + unidade, ex.: "Pedro 1102-B". */
  rotulo: string;
  tipo: 'morador' | 'locatario' | 'hospede' | 'prestador';
  /** Janela de validade (hóspede: check-in → check-out). null = sem limite. */
  inicio: Date | null;
  fim: Date | null;
}

export interface ResultadoAcesso {
  ok: boolean;
  detalhe?: string;
}

export interface AdaptadorAcesso {
  readonly fabricante: 'controlid' | 'hikvision' | 'intelbras' | 'mock';
  cadastrarUsuario(u: UsuarioAcesso): Promise<ResultadoAcesso>;
  enviarFace(usuarioId: string, imagemJpeg: Uint8Array): Promise<ResultadoAcesso>;
  /** Remove usuário e face do equipamento (usado no check-out e na exclusão LGPD). */
  removerUsuario(usuarioId: string): Promise<ResultadoAcesso>;
  liberarPorta(porta?: number): Promise<ResultadoAcesso>;
}

/** Cliente HTTP injetável — permite autenticação digest/sessão e testes sem hardware. */
export interface ClienteHttp {
  request(req: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    query?: Record<string, string>;
    json?: unknown;
    body?: Uint8Array;
    contentType?: string;
  }): Promise<{ status: number; json?: unknown; text?: string }>;
}

export interface ConfigEquipamento {
  baseUrl: string;
  usuario: string;
  /** Lida do cofre de segredos do condomínio; nunca logada. */
  senha: string;
  porta?: number;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 sem depender de Buffer (funciona em Node, Edge Functions e React Native). */
export function paraBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : B64[c & 63];
  }
  return out;
}

export function epochSegundos(d: Date | null): number {
  return d ? Math.floor(d.getTime() / 1000) : 0;
}

/** ISO local sem fuso, exigido pela ISAPI: 2026-11-22T14:00:00 (horário de Brasília). */
export function isoLocalBrasilia(d: Date): string {
  const local = new Date(d.getTime() - 3 * 3_600_000);
  return local.toISOString().slice(0, 19);
}
