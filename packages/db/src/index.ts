/** Tipos gerados do banco: rode `pnpm --filter @gc/db types` com o Supabase local ativo. */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
