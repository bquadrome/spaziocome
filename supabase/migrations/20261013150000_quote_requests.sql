-- Spazi "su richiesta": il cliente invia una richiesta, lo staff risponde con un preventivo,
-- il cliente accetta o chiede un nuovo preventivo, lo staff segna il pagamento.

alter table public.events
  add column if not exists request_mode boolean not null default false;
update public.events set request_mode = true where id = 'meeting';

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  event_id text not null references public.events (id),
  dates date[] not null,
  slot_ids uuid[] not null,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  notes text not null default '',
  custom jsonb not null default '[]'::jsonb,
  status text not null default 'new'
    check (status in ('new', 'quoted', 'accepted', 'revision', 'paid', 'archived')),
  quote_subject text not null default '',
  quote_body text not null default '',
  quote_amount numeric(10, 2),
  quoted_at timestamptz,
  accepted_at timestamptz,
  paid_at timestamptz,
  revision_name text not null default '',
  revision_email text not null default '',
  revision_message text not null default '',
  revision_at timestamptz,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_requests_status_idx on public.quote_requests (status, created_at desc);

alter table public.quote_requests enable row level security;
drop policy if exists quote_requests_admin on public.quote_requests;
create policy quote_requests_admin on public.quote_requests
  for all to authenticated using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quote_requests'
  ) then
    alter publication supabase_realtime add table public.quote_requests;
  end if;
end $$;

create or replace function public.quote_log(p_type text, p_extra jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
as $$
  select jsonb_build_array(jsonb_build_object('at', now(), 'type', p_type) || coalesce(p_extra, '{}'::jsonb))
$$;

-- Prenotazione diretta vietata al pubblico sugli spazi su richiesta (l'admin può ancora bloccare date).
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
  v_request boolean;
  v_staff boolean := coalesce(auth.role(), '') = 'authenticated';
begin
  if p_dates is null or array_length(p_dates, 1) is null then
    raise exception 'Giorno o orario mancante.';
  end if;
  if p_slot_ids is null or array_length(p_slot_ids, 1) is null then
    raise exception 'Giorno o orario mancante.';
  end if;

  select enabled, request_mode into v_enabled, v_request from public.events where id = p_event_id for update;
  if not found then raise exception 'Evento non trovato.'; end if;
  if v_enabled is not true then raise exception 'Evento non prenotabile.'; end if;
  if v_request and not v_staff then raise exception 'Questo spazio si prenota su richiesta.'; end if;

  insert into public.bookings (
    event_id, dates, slot_ids, station_id,
    first_name, last_name, email, phone, notes, extra, custom, status
  ) values (
    p_event_id, p_dates, p_slot_ids, p_station_id,
    coalesce(p_first_name,''), coalesce(p_last_name,''), coalesce(p_email,''),
    coalesce(p_phone,''), coalesce(p_notes,''), coalesce(p_extra,''),
    public.clean_custom(p_event_id, p_custom, not v_staff),
    'active'
  ) returning id into v_id;

  perform public.occupy_booking(v_id);
  return v_id;
end;
$$;

create or replace function public.submit_quote_request(
  p_event_id text,
  p_dates date[],
  p_slot_ids uuid[],
  p_first_name text default '',
  p_last_name text default '',
  p_email text default '',
  p_phone text default '',
  p_notes text default '',
  p_custom jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.events%rowtype;
  v_id uuid;
  v_email text := btrim(coalesce(p_email, ''));
begin
  select * into e from public.events where id = p_event_id;
  if not found then raise exception 'Spazio non trovato.'; end if;
  if e.enabled is not true or e.request_mode is not true then raise exception 'Questo spazio non accetta richieste.'; end if;
  if p_dates is null or array_length(p_dates, 1) is null or p_slot_ids is null or array_length(p_slot_ids, 1) is null then
    raise exception 'Giorno o orario mancante.';
  end if;
  if exists (select 1 from unnest(p_dates) d where d < public.rome_today()) then
    raise exception 'Una data scelta è già passata.';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Serve una mail valida per ricevere il preventivo.';
  end if;

  insert into public.quote_requests (
    event_id, dates, slot_ids, first_name, last_name, email, phone, notes, custom, history
  ) values (
    p_event_id,
    (select array_agg(distinct d order by d) from unnest(p_dates) d),
    p_slot_ids,
    left(btrim(coalesce(p_first_name, '')), 120),
    left(btrim(coalesce(p_last_name, '')), 120),
    left(v_email, 200),
    left(btrim(coalesce(p_phone, '')), 60),
    left(btrim(coalesce(p_notes, '')), 4000),
    public.clean_custom(p_event_id, p_custom, true),
    public.quote_log('request')
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.quote_view(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'status', q.status,
    'first_name', q.first_name,
    'last_name', q.last_name,
    'email', q.email,
    'event_name', e.name,
    'dates', to_jsonb(q.dates),
    'slots', coalesce((
      select jsonb_agg(s order by s->>'start')
      from jsonb_array_elements(e.slots) s
      where s->>'id' = any (q.slot_ids::text[])
    ), '[]'::jsonb),
    'quote_subject', q.quote_subject,
    'quote_body', q.quote_body,
    'quote_amount', q.quote_amount,
    'quoted_at', q.quoted_at
  )
  from public.quote_requests q
  join public.events e on e.id = q.event_id
  where q.token = p_token
$$;

create or replace function public.quote_accept(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quote_requests%rowtype;
begin
  select * into q from public.quote_requests where token = p_token for update;
  if not found then raise exception 'Preventivo non trovato.'; end if;
  if q.status = 'accepted' or q.status = 'paid' then raise exception 'Preventivo già accettato.'; end if;
  if q.status <> 'quoted' then raise exception 'Questo preventivo non è più attivo.'; end if;
  update public.quote_requests
    set status = 'accepted', accepted_at = now(), updated_at = now(),
        history = history || public.quote_log('accepted')
    where id = q.id;
  return q.id;
end;
$$;

create or replace function public.quote_revision(p_token uuid, p_name text, p_email text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quote_requests%rowtype;
  v_message text := left(btrim(coalesce(p_message, '')), 4000);
  v_email text := btrim(coalesce(p_email, ''));
begin
  select * into q from public.quote_requests where token = p_token for update;
  if not found then raise exception 'Preventivo non trovato.'; end if;
  if q.status = 'revision' then raise exception 'Hai già chiesto un nuovo preventivo: ti risponderemo a breve.'; end if;
  if q.status <> 'quoted' then raise exception 'Questo preventivo non è più attivo.'; end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'Inserisci il tuo nome.'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Inserisci una mail valida.'; end if;
  if v_message = '' then raise exception 'Scrivi un messaggio.'; end if;
  update public.quote_requests
    set status = 'revision',
        revision_name = left(btrim(p_name), 120),
        revision_email = left(v_email, 200),
        revision_message = v_message,
        revision_at = now(),
        updated_at = now(),
        history = history || public.quote_log('revision', jsonb_build_object('message', v_message))
    where id = q.id;
  return q.id;
end;
$$;

create or replace function public.quote_send(p_id uuid, p_subject text, p_body text, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then raise exception 'Non autorizzato'; end if;
  if btrim(coalesce(p_body, '')) = '' then raise exception 'Scrivi il testo del preventivo.'; end if;
  update public.quote_requests
    set status = 'quoted',
        quote_subject = left(btrim(coalesce(p_subject, '')), 200),
        quote_body = left(p_body, 8000),
        quote_amount = p_amount,
        quoted_at = now(),
        updated_at = now(),
        history = history || public.quote_log('quoted', jsonb_build_object('amount', p_amount))
    where id = p_id and status in ('new', 'quoted', 'revision');
  if not found then raise exception 'Richiesta non trovata o già chiusa.'; end if;
end;
$$;

create or replace function public.quote_set_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then raise exception 'Non autorizzato'; end if;
  if p_status not in ('paid', 'archived', 'accepted', 'new') then raise exception 'Stato non valido'; end if;
  update public.quote_requests
    set status = p_status,
        paid_at = case when p_status = 'paid' then now() else paid_at end,
        updated_at = now(),
        history = history || public.quote_log(p_status)
    where id = p_id;
  if not found then raise exception 'Richiesta non trovata.'; end if;
end;
$$;

revoke execute on function public.quote_log(text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_quote_request(text, date[], uuid[], text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.quote_view(uuid) to anon, authenticated;
grant execute on function public.quote_accept(uuid) to anon, authenticated;
grant execute on function public.quote_revision(uuid, text, text, text) to anon, authenticated;
revoke execute on function public.quote_send(uuid, text, text, numeric) from public, anon;
grant execute on function public.quote_send(uuid, text, text, numeric) to authenticated;
revoke execute on function public.quote_set_status(uuid, text) from public, anon;
grant execute on function public.quote_set_status(uuid, text) to authenticated;
