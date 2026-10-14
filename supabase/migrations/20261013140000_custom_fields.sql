-- Campi personalizzati per spazio (testo, numero, tendina) salvati sulla prenotazione.

alter table public.events
  add column if not exists custom_fields jsonb not null default '[]'::jsonb;
alter table public.bookings
  add column if not exists custom jsonb not null default '[]'::jsonb;

-- Normalizza i valori inviati dal form sui campi attivi dello spazio: [{id, label, value}].
create or replace function public.clean_custom(p_event_id text, p_custom jsonb, p_strict boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  f jsonb;
  v_value text;
  v_out jsonb := '[]'::jsonb;
begin
  for f in
    select value from jsonb_array_elements(coalesce((select custom_fields from public.events where id = p_event_id), '[]'::jsonb))
  loop
    if coalesce((f->>'enabled')::boolean, true) is not true then continue; end if;
    select left(btrim(e->>'value'), 500) into v_value
    from jsonb_array_elements(case when jsonb_typeof(p_custom) = 'array' then p_custom else '[]'::jsonb end) e
    where e->>'id' = f->>'id'
    limit 1;
    v_value := coalesce(v_value, '');
    if p_strict and v_value = '' and coalesce((f->>'required')::boolean, false) then
      raise exception 'Compila il campo "%".', f->>'label';
    end if;
    if p_strict and v_value <> '' and f->>'type' = 'number' and v_value !~ '^-?[0-9]+([.,][0-9]+)?$' then
      raise exception 'Il campo "%" deve essere un numero.', f->>'label';
    end if;
    if p_strict and v_value <> '' and f->>'type' = 'select'
      and not exists (select 1 from jsonb_array_elements_text(coalesce(f->'options', '[]'::jsonb)) o where o = v_value) then
      raise exception 'Scelta non valida per "%".', f->>'label';
    end if;
    if v_value <> '' then
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', f->>'id', 'label', f->>'label', 'value', v_value));
    end if;
  end loop;
  return v_out;
end;
$$;
revoke execute on function public.clean_custom(text, jsonb, boolean) from public, anon, authenticated;

drop function if exists public.place_booking(text, date[], uuid[], uuid, text, text, text, text, text, text);
create or replace function public.place_booking(
  p_event_id text,
  p_dates date[],
  p_slot_ids uuid[],
  p_station_id uuid default null,
  p_first_name text default '',
  p_last_name text default '',
  p_email text default '',
  p_phone text default '',
  p_notes text default '',
  p_extra text default '',
  p_custom jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_enabled boolean;
begin
  if p_dates is null or array_length(p_dates, 1) is null then
    raise exception 'Giorno o orario mancante.';
  end if;
  if p_slot_ids is null or array_length(p_slot_ids, 1) is null then
    raise exception 'Giorno o orario mancante.';
  end if;

  select enabled into v_enabled from public.events where id = p_event_id for update;
  if not found then raise exception 'Evento non trovato.'; end if;
  if v_enabled is not true then raise exception 'Evento non prenotabile.'; end if;

  insert into public.bookings (
    event_id, dates, slot_ids, station_id,
    first_name, last_name, email, phone, notes, extra, custom, status
  ) values (
    p_event_id, p_dates, p_slot_ids, p_station_id,
    coalesce(p_first_name,''), coalesce(p_last_name,''), coalesce(p_email,''),
    coalesce(p_phone,''), coalesce(p_notes,''), coalesce(p_extra,''),
    public.clean_custom(p_event_id, p_custom, coalesce(auth.role(), '') <> 'authenticated'),
    'active'
  ) returning id into v_id;

  perform public.occupy_booking(v_id);
  return v_id;
end;
$$;
grant execute on function public.place_booking(text, date[], uuid[], uuid, text, text, text, text, text, text, jsonb) to anon, authenticated;

drop function if exists public.update_booking(uuid, text, date[], uuid[], uuid, text, text, text, text, text, text);
create or replace function public.update_booking(
  p_id uuid,
  p_event_id text,
  p_dates date[],
  p_slot_ids uuid[],
  p_station_id uuid default null,
  p_first_name text default '',
  p_last_name text default '',
  p_email text default '',
  p_phone text default '',
  p_notes text default '',
  p_extra text default '',
  p_custom jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Non autorizzato';
  end if;
  delete from public.occupancy where booking_id = p_id;
  update public.bookings set
    event_id = p_event_id,
    dates = p_dates,
    slot_ids = p_slot_ids,
    station_id = p_station_id,
    first_name = coalesce(p_first_name,''),
    last_name = coalesce(p_last_name,''),
    email = coalesce(p_email,''),
    phone = coalesce(p_phone,''),
    notes = coalesce(p_notes,''),
    extra = coalesce(p_extra,''),
    custom = public.clean_custom(p_event_id, p_custom, false)
  where id = p_id;
  if not found then raise exception 'Prenotazione non trovata.'; end if;
  perform public.occupy_booking(p_id);
end;
$$;
revoke execute on function public.update_booking(uuid, text, date[], uuid[], uuid, text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.update_booking(uuid, text, date[], uuid[], uuid, text, text, text, text, text, text, jsonb) to authenticated;
