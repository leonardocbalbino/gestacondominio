import 'server-only';
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';

/**
 * Armazenamento privado em disco (substitui o Storage do Supabase).
 * Cada arquivo é cifrado com AES-256-GCM; a chave é derivada (HKDF) da APP_CRYPTO_KEY.
 * Os arquivos ficam FORA da pasta pública e só são servidos por rotas que checam permissão no banco.
 * Formato: [12 bytes IV][16 bytes tag][dados cifrados]
 */
export type Bucket = 'biometrias' | 'contratos' | 'documentos';

const RAIZ = process.env.STORAGE_DIR ?? join(process.cwd(), '.armazenamento');

function chave(bucket: Bucket): Buffer {
  const base = process.env.APP_CRYPTO_KEY ?? '';
  if (base.length < 32) throw new Error('APP_CRYPTO_KEY ausente');
  return Buffer.from(hkdfSync('sha256', base, 'gestacondominio', `arquivos:${bucket}`, 32));
}

function caminho(bucket: Bucket, nome: string): string {
  if (!/^[0-9a-f-]{36}\.bin$/.test(nome)) throw new Error('nome de arquivo inválido');
  const p = normalize(join(RAIZ, bucket, nome));
  if (!p.startsWith(normalize(join(RAIZ, bucket)))) throw new Error('caminho inválido');
  return p;
}

/** Grava e devolve o nome (aleatório, sem dado pessoal). */
export async function salvarArquivo(bucket: Bucket, dados: Uint8Array): Promise<string> {
  const nome = `${randomUUID()}.bin`;
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chave(bucket), iv);
  const cifrado = Buffer.concat([c.update(dados), c.final()]);
  await mkdir(join(RAIZ, bucket), { recursive: true, mode: 0o700 });
  await writeFile(caminho(bucket, nome), Buffer.concat([iv, c.getAuthTag(), cifrado]), { mode: 0o600 });
  return nome;
}

export async function lerArquivo(bucket: Bucket, nome: string): Promise<Buffer> {
  const bruto = await readFile(caminho(bucket, nome));
  const d = createDecipheriv('aes-256-gcm', chave(bucket), bruto.subarray(0, 12));
  d.setAuthTag(bruto.subarray(12, 28));
  return Buffer.concat([d.update(bruto.subarray(28)), d.final()]);
}

export async function apagarArquivo(bucket: Bucket, nome: string): Promise<void> {
  await rm(caminho(bucket, nome), { force: true });
}
