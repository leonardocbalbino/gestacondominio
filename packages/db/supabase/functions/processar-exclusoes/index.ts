// Edge Function (Deno) — processa a fila de exclusão LGPD:
//   1. apaga o arquivo da biometria no bucket privado
//   2. remove o cadastro da pessoa nos leitores faciais do condomínio
//   3. marca o item como processado
// Agendar a cada 15 min (Supabase Scheduled Functions / pg_cron + pg_net).
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  // Só o agendador (com o segredo de cron) pode disparar.
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('não autorizado', { status: 401 });
  }

  const { data: fila, error } = await sb
    .from('fila_exclusao_arquivos')
    .select('id, condominio_id, bucket, path, remover_do_equipamento_pessoa')
    .is('processado_em', null)
    .order('id')
    .limit(100);
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  let ok = 0;
  for (const item of fila ?? []) {
    const rm = await sb.storage.from(item.bucket).remove([item.path]);
    if (rm.error) continue; // tenta de novo no próximo ciclo

    if (item.remover_do_equipamento_pessoa && item.condominio_id) {
      // Os equipamentos ficam na rede do condomínio; o agente local (packages/core/acesso)
      // consome esta fila via Realtime e chama adaptador.removerUsuario(pessoaId).
      await sb.channel(`acesso:${item.condominio_id}`).send({
        type: 'broadcast',
        event: 'remover_usuario',
        payload: { pessoa_id: item.remover_do_equipamento_pessoa },
      });
    }
    await sb.from('fila_exclusao_arquivos').update({ processado_em: new Date().toISOString() }).eq('id', item.id);
    ok++;
  }
  return Response.json({ processados: ok, pendentes: (fila?.length ?? 0) - ok });
});
