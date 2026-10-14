-- Eventi nella sede: creati dall'admin, bloccano la Meeting Room, iscrizioni con posti, QR e check-in.
-- Un evento è pubblico (home + pagina) solo se è pubblicato e ha la locandina.

create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  description text not null default '',
  on_date date not null,
  time_start text not null,
  time_end text not null,
  image_path text not null default '',
  published boolean not null default true,
  registration_open boolean not null default true,
  capacity integer check (capacity is null or capacity > 0),
  space_id text not null default 'meeting' references public.events (id),
  booking_id uuid references public.bookings (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists site_events_date_idx on public.site_events (on_date, time_start);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  event_id uuid not null references public.site_events (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  status text not null default 'active' check (status in ('active', 'cancelled')),
  checked_in_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists event_registrations_event_idx on public.event_registrations (event_id);
create unique index if not exists event_registrations_once
  on public.event_registrations (event_id, lower(email)) where status = 'active';

alter table public.site_events enable row level security;
alter table public.event_registrations enable row level security;
drop policy if exists site_events_admin on public.site_events;
create policy site_events_admin on public.site_events
  for all to authenticated using (true) with check (true);
drop policy if exists event_registrations_admin on public.event_registrations;
create policy event_registrations_admin on public.event_registrations
  for all to authenticated using (true) with check (true);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'site_events') then
    alter publication supabase_realtime add table public.site_events;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'event_registrations') then
    alter publication supabase_realtime add table public.event_registrations;
  end if;
end $$;

-- Locandine: lettura pubblica, scrittura solo admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists event_images_insert on storage.objects;
create policy event_images_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'event-images');
drop policy if exists event_images_update on storage.objects;
create policy event_images_update on storage.objects
  for update to authenticated using (bucket_id = 'event-images') with check (bucket_id = 'event-images');
drop policy if exists event_images_delete on storage.objects;
create policy event_images_delete on storage.objects
  for delete to authenticated using (bucket_id = 'event-images');

create or replace function public.make_event_slug(p_title text, p_date date)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_base text;
  v_slug text;
  n integer := 1;
begin
  v_base := translate(lower(coalesce(p_title, '')), 'àáâãäåèéêëìíîïòóôõöùúûüñç', 'aaaaaaeeeeiiiiooooouuuunc');
  v_base := trim(both '-' from regexp_replace(v_base, '[^a-z0-9]+', '-', 'g'));
  v_base := left(v_base, 60);
  if v_base = '' then v_base := 'evento'; end if;
  v_base := v_base || '-' || to_char(p_date, 'DD-MM-YYYY');
  v_slug := v_base;
  while exists (select 1 from public.site_events where slug = v_slug) loop
    n := n + 1;
    v_slug := v_base || '-' || n;
  end loop;
  return v_slug;
end;
$$;

create or replace function public.site_event_card(e public.site_events)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id,
    'slug', e.slug,
    'title', e.title,
    'summary', e.summary,
    'description', e.description,
    'on_date', e.on_date,
    'time_start', e.time_start,
    'time_end', e.time_end,
    'image_path', e.image_path,
    'registration_open', e.registration_open,
    'capacity', e.capacity,
    'taken', (select count(*) from public.event_registrations r where r.event_id = e.id and r.status = 'active'),
    'past', e.on_date < public.rome_today()
  )
$$;

create or replace function public.registration_summary(r public.event_registrations)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'kind', 'event',
    'status', r.status,
    'first_name', r.first_name,
    'last_name', r.last_name,
    'event_id', e.id,
    'event_name', e.title,
    'has_qr', true,
    'dates', jsonb_build_array(e.on_date),
    'slots', jsonb_build_array(jsonb_build_object('start', e.time_start, 'end', e.time_end)),
    'station', null,
    'checkins', case
      when r.checked_in_at is null then '{}'::jsonb
      else jsonb_build_object(e.on_date::text, r.checked_in_at)
    end
  )
  from public.site_events e
  where e.id = r.event_id
$$;

-- Pubblico: solo eventi pubblicati con locandina.
create or replace function public.public_site_events()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.site_event_card(e) - 'description' order by e.on_date, e.time_start), '[]'::jsonb)
  from public.site_events e
  where e.published and e.image_path <> '' and e.on_date >= public.rome_today()
$$;

create or replace function public.public_site_event(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.site_event_card(e)
  from public.site_events e
  where e.slug = p_slug and e.published and e.image_path <> ''
$$;

create or replace function public.register_site_event(
  p_event_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.site_events%rowtype;
  v_email text := btrim(coalesce(p_email, ''));
  v_taken integer;
  v_token uuid;
begin
  select * into e from public.site_events where id = p_event_id for update;
  if not found or not e.published or e.image_path = '' then raise exception 'Evento non trovato.'; end if;
  if e.on_date < public.rome_today() then raise exception 'L''evento è già passato.'; end if;
  if not e.registration_open then raise exception 'Le iscrizioni sono chiuse.'; end if;
  if btrim(coalesce(p_first_name, '')) = '' or btrim(coalesce(p_last_name, '')) = '' then
    raise exception 'Inserisci nome e cognome.';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Inserisci una mail valida.'; end if;
  if exists (
    select 1 from public.event_registrations
    where event_id = e.id and lower(email) = lower(v_email) and status = 'active'
  ) then
    raise exception 'Questa mail è già iscritta all''evento.';
  end if;
  if e.capacity is not null then
    select count(*) into v_taken from public.event_registrations where event_id = e.id and status = 'active';
    if v_taken >= e.capacity then raise exception 'Posti esauriti.'; end if;
  end if;
  insert into public.event_registrations (event_id, first_name, last_name, email, phone)
  values (
    e.id,
    left(btrim(p_first_name), 120),
    left(btrim(p_last_name), 120),
    left(v_email, 200),
    left(btrim(coalesce(p_phone, '')), 60)
  )
  returning token into v_token;
  return jsonb_build_object('token', v_token);
end;
$$;

create or replace function public.event_registration_ticket(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'token', r.token,
    'status', r.status,
    'first_name', r.first_name,
    'last_name', r.last_name,
    'checked_in_at', r.checked_in_at,
    'cancellable', r.status = 'active' and e.on_date >= public.rome_today(),
    'event', public.site_event_card(e) - 'description' - 'taken' - 'capacity'
  )
  from public.event_registrations r
  join public.site_events e on e.id = r.event_id
  where r.token = p_token
$$;

create or replace function public.cancel_event_registration(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.event_registrations%rowtype;
  v_date date;
begin
  select * into r from public.event_registrations where token = p_token for update;
  if not found then raise exception 'Iscrizione non trovata.'; end if;
  if r.status <> 'active' then raise exception 'Iscrizione già annullata.'; end if;
  select on_date into v_date from public.site_events where id = r.event_id;
  if v_date < public.rome_today() then raise exception 'L''evento è già passato.'; end if;
  update public.event_registrations set status = 'cancelled', cancelled_at = now() where id = r.id;
  return r.id;
end;
$$;

-- Admin: crea o aggiorna l'evento e riallinea il blocco della Meeting Room.
create or replace function public.save_site_event(
  p_id uuid,
  p_title text,
  p_summary text,
  p_description text,
  p_on_date date,
  p_time_start text,
  p_time_end text,
  p_image_path text,
  p_published boolean,
  p_registration_open boolean,
  p_capacity integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_title text := btrim(coalesce(p_title, ''));
  v_space text := 'meeting';
  v_old uuid;
  v_slots uuid[];
  v_booking uuid;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then raise exception 'Non autorizzato'; end if;
  if v_title = '' then raise exception 'Inserisci il titolo.'; end if;
  if p_on_date is null then raise exception 'Scegli la data.'; end if;
  if coalesce(p_time_start, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(p_time_end, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Inserisci orario di inizio e di fine (es. 18:00).';
  end if;
  if p_time_end <= p_time_start then raise exception 'L''orario di fine deve essere dopo l''inizio.'; end if;
  if p_capacity is not null and p_capacity < 1 then raise exception 'I posti devono essere almeno 1.'; end if;

  if v_id is null then
    insert into public.site_events (
      slug, title, summary, description, on_date, time_start, time_end,
      image_path, published, registration_open, capacity, space_id
    ) values (
      public.make_event_slug(v_title, p_on_date), v_title, coalesce(p_summary, ''), coalesce(p_description, ''),
      p_on_date, p_time_start, p_time_end, coalesce(p_image_path, ''),
      coalesce(p_published, true), coalesce(p_registration_open, true), p_capacity, v_space
    )
    returning id into v_id;
  else
    select booking_id into v_old from public.site_events where id = v_id for update;
    if not found then raise exception 'Evento non trovato.'; end if;
    if p_capacity is not null and p_capacity < (
      select count(*) from public.event_registrations where event_id = v_id and status = 'active'
    ) then
      raise exception 'Ci sono già più iscritti dei posti indicati.';
    end if;
    update public.site_events set
      title = v_title,
      summary = coalesce(p_summary, ''),
      description = coalesce(p_description, ''),
      on_date = p_on_date,
      time_start = p_time_start,
      time_end = p_time_end,
      image_path = coalesce(p_image_path, ''),
      published = coalesce(p_published, true),
      registration_open = coalesce(p_registration_open, true),
      capacity = p_capacity,
      booking_id = null,
      updated_at = now()
    where id = v_id;
  end if;

  if v_old is not null then
    delete from public.occupancy where booking_id = v_old;
    delete from public.bookings where id = v_old;
  end if;

  select array_agg((s->>'id')::uuid order by s->>'start') into v_slots
  from public.events ev, jsonb_array_elements(ev.slots) s
  where ev.id = v_space and s->>'start' < p_time_end and s->>'end' > p_time_start;

  if v_slots is not null then
    insert into public.bookings (event_id, dates, slot_ids, first_name, notes, extra, status)
    values (
      v_space, array[p_on_date], v_slots, v_title,
      'Blocco automatico per l''evento "' || v_title || '". Si modifica da Admin → Eventi.',
      'Evento', 'active'
    )
    returning id into v_booking;
    begin
      perform public.occupy_booking(v_booking);
    exception when others then
      raise exception 'La Meeting Room è già occupata il % in quell''orario: libera prima lo slot dal Calendario.',
        to_char(p_on_date, 'DD/MM/YYYY');
    end;
    update public.site_events set booking_id = v_booking where id = v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.delete_site_event(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking uuid;
  v_image text;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then raise exception 'Non autorizzato'; end if;
  select booking_id, image_path into v_booking, v_image from public.site_events where id = p_id for update;
  if not found then raise exception 'Evento non trovato.'; end if;
  if v_booking is not null then delete from public.occupancy where booking_id = v_booking; end if;
  delete from public.site_events where id = p_id;
  if v_booking is not null then delete from public.bookings where id = v_booking; end if;
  return v_image;
end;
$$;

-- Reception: prenotazioni + iscritti agli eventi (esclusi i blocchi automatici della Meeting Room).
create or replace function public.reception_day(p_key text, p_date date default null)
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
    select jsonb_agg(t.item order by lower(t.item->>'last_name'), lower(t.item->>'first_name'))
    from (
      select public.booking_summary(b) as item
      from public.bookings b
      where b.status = 'active' and v_date = any (b.dates)
        and not exists (select 1 from public.site_events se where se.booking_id = b.id)
      union all
      select public.registration_summary(r)
      from public.event_registrations r
      join public.site_events e on e.id = r.event_id
      where r.status = 'active' and e.on_date = v_date
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.reception_checkin(
  p_key text,
  p_token uuid default null,
  p_booking_id uuid default null,
  p_date date default null,
  p_present boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := coalesce(p_date, public.rome_today());
  b public.bookings%rowtype;
  r public.event_registrations%rowtype;
  v_event_date date;
  v_at timestamptz;
  v_result text;
begin
  if not public.reception_allowed(p_key) then raise exception 'Non autorizzato'; end if;

  if p_token is not null then
    select * into b from public.bookings where token = p_token;
  else
    select * into b from public.bookings where id = p_booking_id;
  end if;

  if found then
    if b.status <> 'active' then raise exception 'Prenotazione annullata.'; end if;
    if not (v_date = any (b.dates)) then raise exception 'Prenotazione non valida per questa data.'; end if;
    if p_present then
      insert into public.booking_checkins (booking_id, on_date)
      values (b.id, v_date)
      on conflict (booking_id, on_date) do nothing
      returning checked_in_at into v_at;
      v_result := case when v_at is null then 'already' else 'checked' end;
    else
      delete from public.booking_checkins where booking_id = b.id and on_date = v_date;
      v_result := 'removed';
    end if;
    return jsonb_build_object('result', v_result, 'booking', public.booking_summary(b));
  end if;

  if p_token is not null then
    select * into r from public.event_registrations where token = p_token;
  else
    select * into r from public.event_registrations where id = p_booking_id;
  end if;
  if not found then raise exception 'QR non valido.'; end if;
  if r.status <> 'active' then raise exception 'Iscrizione annullata.'; end if;
  select on_date into v_event_date from public.site_events where id = r.event_id;
  if v_event_date <> v_date then
    raise exception 'Iscrizione valida per il %.', to_char(v_event_date, 'DD/MM/YYYY');
  end if;
  if p_present then
    if r.checked_in_at is null then
      update public.event_registrations set checked_in_at = now() where id = r.id returning * into r;
      v_result := 'checked';
    else
      v_result := 'already';
    end if;
  else
    update public.event_registrations set checked_in_at = null where id = r.id returning * into r;
    v_result := 'removed';
  end if;
  return jsonb_build_object('result', v_result, 'booking', public.registration_summary(r));
end;
$$;

revoke execute on function public.make_event_slug(text, date) from public, anon, authenticated;
revoke execute on function public.site_event_card(public.site_events) from public, anon, authenticated;
revoke execute on function public.registration_summary(public.event_registrations) from public, anon, authenticated;
grant execute on function public.public_site_events() to anon, authenticated;
grant execute on function public.public_site_event(text) to anon, authenticated;
grant execute on function public.register_site_event(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.event_registration_ticket(uuid) to anon, authenticated;
grant execute on function public.cancel_event_registration(uuid) to anon, authenticated;
revoke execute on function public.save_site_event(uuid, text, text, text, date, text, text, text, boolean, boolean, integer) from public, anon;
grant execute on function public.save_site_event(uuid, text, text, text, date, text, text, text, boolean, boolean, integer) to authenticated;
revoke execute on function public.delete_site_event(uuid) from public, anon;
grant execute on function public.delete_site_event(uuid) to authenticated;
