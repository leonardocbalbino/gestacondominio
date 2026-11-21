-- =====================================================================
-- GestaCondomínio · 0008 · Resumo da unidade para o morador
-- O RLS só deixa o titular ver a PRÓPRIA biometria; para o card "Facial 2 de 2"
-- o morador precisa só da contagem da unidade — sem ver dados dos outros.
-- =====================================================================
create or replace function public.resumo_facial_unidade(p_unidade uuid)
returns table (cadastradas int, total int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_unidade not in (select app.minhas_unidades()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  return query
  select count(b.id)::int, count(*)::int
    from public.vinculos v left join public.biometrias b on b.pessoa_id = v.pessoa_id
   where v.unidade_id = p_unidade and v.tipo in ('proprietario','inquilino','residente')
     and v.inicio <= now() and (v.fim is null or v.fim > now());
end $$;
revoke execute on function public.resumo_facial_unidade(uuid) from public, anon;
grant execute on function public.resumo_facial_unidade(uuid) to authenticated;
