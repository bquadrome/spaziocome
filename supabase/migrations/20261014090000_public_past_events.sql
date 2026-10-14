-- Pagina eventi: archivio degli eventi passati (pubblicati e con locandina).

create or replace function public.public_past_events()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(card order by on_date desc, time_start desc), '[]'::jsonb)
  from (
    select public.site_event_card(e) - 'description' - 'taken' - 'capacity' as card, e.on_date, e.time_start
    from public.site_events e
    where e.published and e.image_path <> '' and e.on_date < public.rome_today()
    order by e.on_date desc, e.time_start desc
    limit 48
  ) t
$$;

grant execute on function public.public_past_events() to anon, authenticated;
