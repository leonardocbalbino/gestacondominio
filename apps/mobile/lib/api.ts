import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Endereço do painel (ex.: https://app.seucondominio.com.br). Sem ele, o app roda em modo demonstração. */
const BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const MODO_DEMO = !BASE;
export const URL_WEB = BASE;

const CHAVE = 'gc_token';
// Token no Keychain/Keystore (SecureStore); AsyncStorage só na versão web.
const cofre =
  Platform.OS === 'web'
    ? { ler: () => AsyncStorage.getItem(CHAVE), gravar: (v: string) => AsyncStorage.setItem(CHAVE, v), apagar: () => AsyncStorage.removeItem(CHAVE) }
    : { ler: () => SecureStore.getItemAsync(CHAVE), gravar: (v: string) => SecureStore.setItemAsync(CHAVE, v), apagar: () => SecureStore.deleteItemAsync(CHAVE) };

export class SessaoExpirada extends Error {}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const reviver = (_: string, v: unknown) => (typeof v === 'string' && ISO.test(v) ? new Date(v) : v);

export async function api<T>(caminho: string, init: { metodo?: 'GET' | 'POST'; corpo?: unknown; form?: FormData } = {}): Promise<T> {
  const token = await cofre.ler();
  const r = await fetch(`${BASE}/api/v1/${caminho}`, {
    method: init.metodo ?? (init.corpo || init.form ? 'POST' : 'GET'),
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.corpo ? { 'content-type': 'application/json' } : {}),
    },
    body: init.form ?? (init.corpo ? JSON.stringify(init.corpo) : undefined),
  });
  const texto = await r.text();
  const dados = texto ? JSON.parse(texto, reviver) : null;
  if (r.status === 401 && caminho !== 'login') {
    await cofre.apagar();
    throw new SessaoExpirada('Sua sessão expirou. Entre novamente.');
  }
  if (!r.ok) throw new Error(dados?.erro ?? 'Não foi possível concluir');
  return dados as T;
}

export async function entrar(email: string, senha: string): Promise<void> {
  const r = await api<{ token: string }>('login', { corpo: { email, senha } });
  await cofre.gravar(r.token);
}

export async function sair(): Promise<void> {
  await api('sair', { metodo: 'POST' }).catch(() => {});
  await cofre.apagar();
}

export async function temSessao(): Promise<boolean> {
  return MODO_DEMO || Boolean(await cofre.ler());
}
