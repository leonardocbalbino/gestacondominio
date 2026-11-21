/**
 * Worker de fundo (substitui pg_cron/Edge Functions quando não disponíveis):
 *   - jobs LGPD: encerra períodos, apaga biometrias vencidas, expurga registros da portaria
 *   - fila de exclusão: apaga os arquivos cifrados do disco
 *   - push: envia notificações pendentes via Expo Push API
 *   - limpa sessões vencidas
 * Roda como service_role (BYPASSRLS) — só aqui e no upload de biometria.
 */
import { rm } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { Banco } from '@gc/db';

const db = new Banco({ url: process.env.DATABASE_URL ?? '', chaveCripto: process.env.APP_CRYPTO_KEY ?? '', max: 2 });
const STORAGE = process.env.STORAGE_DIR ?? join(process.cwd(), '.armazenamento');
const INTERVALO_MS = Number(process.env.WORKER_INTERVALO_MS ?? 5 * 60_000);

const log = (msg: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ em: new Date().toISOString(), msg, ...extra }));

async function jobsLgpd() {
  const [r] = await db.comoServico((q) => q<{ r: Record<string, number> }>('select public.executar_jobs_lgpd() as r'));
  const n = await db.comoServico((q) => q<{ n: number }>('select auth.limpar_sessoes() as n'));
  log('jobs-lgpd', { ...r!.r, sessoes_expiradas: n[0]!.n });
}

async function filaExclusao() {
  const itens = await db.comoServico((q) =>
    q<{ id: number; bucket: string; path: string }>('select id, bucket, path from public.fila_exclusao_arquivos where processado_em is null order by id limit 200'),
  );
  let ok = 0;
  for (const it of itens) {
    const valido = /^[0-9a-f-]{36}\.bin$/.test(it.path) && ['biometrias', 'contratos', 'documentos'].includes(it.bucket);
    const alvo = normalize(join(STORAGE, it.bucket, it.path));
    if (valido && alvo.startsWith(normalize(STORAGE))) {
      await rm(alvo, { force: true });
    } else {
      // Nunca apaga fora do armazenamento; marca para não travar a fila.
      log('fila-caminho-invalido', { id: it.id });
    }
    // A remoção do cadastro nos leitores faciais é feita pelo agente local do condomínio
    // (packages/core/acesso), que consulta esta mesma fila pela API.
    await db.comoServico((q) => q('update public.fila_exclusao_arquivos set processado_em = now() where id = $1', [it.id]));
    ok++;
  }
  if (itens.length) log('fila-exclusao', { processados: ok });
}

async function push() {
  const pend = await db.comoServico((q) =>
    q<{ id: string; titulo: string; corpo: string | null; link: string | null; token: string }>(
      `select n.id, n.titulo, n.corpo, n.link, d.token
         from public.notificacoes n join public.dispositivos_push d on d.user_id = n.user_id
        where n.push_enviado_em is null and n.created_at > now() - interval '1 day'
        order by n.created_at limit 100`,
    ),
  );
  if (!pend.length) return;
  // Conteúdo mínimo no push (aparece na tela bloqueada): sem nomes nem valores.
  const msgs = pend.map((p) => ({ to: p.token, title: p.titulo, body: p.corpo ?? undefined, data: { link: p.link } }));
  const r = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(msgs),
  }).catch(() => null);
  if (!r?.ok) {
    log('push-falhou', { status: r?.status ?? 0 });
    return;
  }
  const ids = [...new Set(pend.map((p) => p.id))];
  await db.comoServico((q) => q('update public.notificacoes set push_enviado_em = now() where id = any($1::uuid[])', [ids]));
  log('push', { enviados: msgs.length });
}

async function ciclo() {
  for (const [nome, fn] of [['jobs', jobsLgpd], ['fila', filaExclusao], ['push', push]] as const) {
    try {
      await fn();
    } catch (e) {
      log('erro', { tarefa: nome, erro: (e as Error).message });
    }
  }
}

await ciclo();
if (process.argv.includes('--uma-vez')) {
  await db.fechar();
} else {
  log('worker iniciado', { intervalo_ms: INTERVALO_MS });
  setInterval(ciclo, INTERVALO_MS);
}
