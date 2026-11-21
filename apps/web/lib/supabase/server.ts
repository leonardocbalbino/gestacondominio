import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Sem Supabase configurado o app roda em modo demonstração (dados fictícios em memória). */
export const MODO_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

export async function supabaseServidor() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) store.set(name, value, options);
        } catch {
          // Chamado de Server Component: o middleware renova a sessão.
        }
      },
    },
  });
}

/** Cliente com service_role — SOMENTE em rotas de servidor que precisam (upload de biometria). */
export async function supabaseServico() {
  const { createClient } = await import('@supabase/supabase-js');
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente');
  return createClient(SUPABASE_URL, chave, { auth: { persistSession: false } });
}
