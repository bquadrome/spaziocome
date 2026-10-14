-- Pass personale (token + QR), annullamento self-service e check-in reception.

alter table public.bookings
  add column if not exists token uuid not null default gen_random_uuid();
create unique index if not exists bookings_token_key on public.bookings (token);

alter table public.events
  add column if not exists has_qr boolean not null default false;
update public.events set has_qr = true where id in ('coworking', 'eu');

create table if not exists public.booking_checkins (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  on_date date not null,
  checked_in_at timestamptz not null default now(),
  primary key (booking_id, on_date)
);
alter table public.booking_checkins enable row level security;
drop policy if exists booking_checkins_admin on public.booking_checkins;
create policy booking_checkins_admin on public.booking_checkins
  for all to authenticated using (true) with check (true);

create table if not exists public.reception_keys (
  key text primary key default encode(extensions.gen_random_bytes(24), 'hex'),
  label text not null default '',
  created_at timestamptz not null default now()
);
alter table public.reception_keys enable row level security;
drop policy if exists reception_keys_admin on public.reception_keys;
create policy reception_keys_admin on public.reception_keys
  for all to authenticated using (true) with check (true);
insert into public.reception_keys (label)
select 'Reception' where not exists (select 1 from public.reception_keys);

create or replace function public.rome_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Europe/Rome')::date
$$;

create or replace function public.reception_allowed(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'authenticated'
    or exists (select 1 from public.reception_keys where key = coalesce(p_key, ''))
$$;

create or replace function public.booking_summary(b public.bookings)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', b.id,
    'status', b.status,
    'first_name', b.first_name,
    'last_name', b.last_name,
    'event_id', b.event_id,
    'event_name', e.name,
    'has_qr', coalesce(e.has_qr, false),
    'dates', to_jsonb(b.dates),
    'slots', coalesce((
      select jsonb_agg(s order by s->>'start')
      from jsonb_array_elements(e.slots) s
      where s->>'id' = any (b.slot_ids::text[])
    ), '[]'::jsonb),
    'station', (
      select s->>'label'
      from jsonb_array_elements(e.stations) s
      where s->>'id' = b.station_id::text
      limit 1
    ),
    'checkins', coalesce((
      select jsonb_object_agg(c.on_date::text, c.checked_in_at)
      from public.booking_checkins c
      where c.booking_id = b.id
    ), '{}'::jsonb)
  )
  from public.events e
  where e.id = b.event_id
$$;
revoke execute on function public.booking_summary(public.bookings) from public, anon, authenticated;

create or replace function public.booking_ticket(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
begin
  select * into b from public.bookings where token = p_token;
  if not found then return null; end if;
  return public.booking_summary(b) || jsonb_build_object(
    'token', b.token,
    'cancellable', b.status = 'active'
      and exists (select 1 from unnest(b.dates) d where d >= public.rome_today())
  );
end;
$$;

create or replace function public.cancel_booking_by_token(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
begin
  select * into b from public.bookings where token = p_token for update;
  if not found then raise exception 'Prenotazione non trovata.'; end if;
  if b.status <> 'active' then raise exception 'Prenotazione già annullata.'; end if;
  if not exists (select 1 from unnest(b.dates) d where d >= public.rome_today()) then
    raise exception 'Prenotazione già conclusa.';
  end if;
  delete from public.occupancy where booking_id = b.id;
  update public.bookings set status = 'cancelled' where id = b.id;
  return b.id;
end;
$$;

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
    select jsonb_agg(public.booking_summary(b) order by b.last_name, b.first_name)
    from public.bookings b
    where b.status = 'active' and v_date = any (b.dates)
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
  v_at timestamptz;
  v_result text;
begin
  if not public.reception_allowed(p_key) then raise exception 'Non autorizzato'; end if;
  if p_token is not null then
    select * into b from public.bookings where token = p_token;
  else
    select * into b from public.bookings where id = p_booking_id;
  end if;
  if not found then raise exception 'QR non valido.'; end if;
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
end;
$$;

grant execute on function public.booking_ticket(uuid) to anon, authenticated;
grant execute on function public.cancel_booking_by_token(uuid) to anon, authenticated;
grant execute on function public.reception_day(text, date) to anon, authenticated;
grant execute on function public.reception_checkin(text, uuid, uuid, date, boolean) to anon, authenticated;
revoke execute on function public.reception_allowed(text) from public, anon, authenticated;
