-- =====================================================================
-- GestaCondomínio · 0006 · Wrappers expostos apenas ao service_role
-- (PostgREST só publica o schema "public"; o anon/authenticated não executam.)
-- =====================================================================

create or replace function public.registrar_biometria_link(p_token text, p_path text) returns uuid
language sql security definer set search_path = '' as $$
  select app.registrar_biometria_por_link(p_token, p_path)
$$;
revoke all on function public.registrar_biometria_link(text, text) from public, anon, authenticated;
grant execute on function public.registrar_biometria_link(text, text) to service_role;

-- Jobs também podem ser disparados por Edge Function agendada (quando não houver pg_cron).
create or replace function public.executar_jobs_lgpd() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a int; r int;
begin
  perform app.job_encerrar_periodos();
  a := app.job_apagar_biometrias();
  r := app.job_retencao_portaria();
  return jsonb_build_object('biometrias_apagadas', a, 'registros_expurgados', r);
end $$;
revoke all on function public.executar_jobs_lgpd() from public, anon, authenticated;
grant execute on function public.executar_jobs_lgpd() to service_role;
