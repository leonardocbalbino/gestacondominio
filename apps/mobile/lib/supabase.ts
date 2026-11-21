import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Sem variáveis do Supabase, o app roda em modo demonstração com dados fictícios. */
export const MODO_DEMO = !url || !anon;

// Sessão no Keychain/Keystore (SecureStore) no celular; AsyncStorage só na web.
const armazenamento =
  Platform.OS === 'web'
    ? AsyncStorage
    : {
        getItem: (k: string) => SecureStore.getItemAsync(k),
        setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
        removeItem: (k: string) => SecureStore.deleteItemAsync(k),
      };

export const supabase: SupabaseClient | null = MODO_DEMO
  ? null
  : createClient(url, anon, {
      auth: { storage: armazenamento, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
