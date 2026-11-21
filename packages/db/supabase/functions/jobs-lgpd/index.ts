// Edge Function (Deno) — alternativa ao pg_cron: encerra períodos vencidos, apaga biometrias
// expiradas e expurga registros da portaria fora da retenção. Agendar a cada 15 min.
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('não autorizado', { status: 401 });
  }
  const { data, error } = await sb.rpc('executar_jobs_lgpd');
  if (error) return Response.json({ erro: error.message }, { status: 500 });
  return Response.json(data);
});
