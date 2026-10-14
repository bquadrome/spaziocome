-- Reception: eventi del giorno (anche senza iscritti), per mostrarli come card con i partecipanti.

create or replace function public.reception_events(p_key text, p_date date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_date date := coalesce(p_date, public.rome_today());
begin
  if not public.reception_allowed(p_key) then raise exception 'Non autorizzato'; end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'time_start', e.time_start,
        'time_end', e.time_end,
        'image_path', e.image_path,
        'capacity', e.capacity
      )
      order by e.time_start, e.title
    )
    from public.site_events e
    where e.on_date = v_date
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.reception_events(text, date) to anon, authenticated;
