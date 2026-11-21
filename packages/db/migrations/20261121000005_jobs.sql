-- =====================================================================
-- GestaCondomínio · 0005 · Jobs de retenção e expiração
-- =====================================================================

-- Apaga biometrias vencidas (check-out, fim de contrato, revogação) e enfileira
-- a remoção do arquivo no Storage e do cadastro no equipamento.
create or replace function app.job_apagar_biometrias() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with apagadas as (
    delete from public.biometrias where apagar_em is not null and apagar_em <= now()
    returning condominio_id, pessoa_id, storage_path
  ), fila as (
    insert into public.fila_exclusao_arquivos (condominio_id, bucket, path, remover_do_equipamento_pessoa)
    select condominio_id, 'biometrias', storage_path, pessoa_id from apagadas
    returning condominio_id
  )
  select count(*) into n from fila;
  if n > 0 then
    perform app.registrar_auditoria(null, 'job_apagar_biometrias', 'biometrias', null, null, jsonb_build_object('quantidade', n));
  end if;
  return n;
end $$;

-- Encerra períodos vencidos (locações, cessões, acessos de suporte).
create or replace function app.job_encerrar_periodos() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.locacoes set status = 'encerrada' where status = 'aprovada' and fim < now();
  update public.cessoes_vaga set status = 'encerrada' where status = 'aprovada' and fim is not null and fim < current_date;
  update public.acessos_suporte set status = 'expirado' where status = 'aprovado' and expira_em <= now();
  -- Pedidos que nunca foram aprovados não mantêm biometria.
  update public.biometrias b set apagar_em = now()
  where b.apagar_em is null and exists (
    select 1 from public.hospedes h join public.locacoes l on l.id = h.locacao_id
    where h.pessoa_id = b.pessoa_id and l.status in ('recusada','cancelada'));
end $$;

-- Retenção dos registros da portaria (padrão 6 meses, configurável por condomínio).
create or replace function app.job_retencao_portaria() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.registros_acesso r using public.condominios c
  where c.id = r.condominio_id and r.ocorrido_em < now() - make_interval(months => c.retencao_portaria_meses);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function app.job_apagar_biometrias(), app.job_encerrar_periodos(), app.job_retencao_portaria() from public, anon, authenticated;
grant execute on function app.job_apagar_biometrias(), app.job_encerrar_periodos(), app.job_retencao_portaria() to service_role;

-- Agenda com pg_cron se a extensão estiver instalada; senão o worker (apps/worker) executa os jobs.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule('gc-apagar-biometrias', '*/15 * * * *', 'select app.job_apagar_biometrias()');
    perform cron.schedule('gc-encerrar-periodos', '*/10 * * * *', 'select app.job_encerrar_periodos()');
    perform cron.schedule('gc-retencao-portaria', '30 3 * * *', 'select app.job_retencao_portaria()');
  end if;
end $$;
