-- Rigenera la chiave della pagina reception (solo admin). Il vecchio link smette di funzionare.

create or replace function public.rotate_reception_key()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    raise exception 'Non autorizzato';
  end if;
  delete from public.reception_keys where true;
  insert into public.reception_keys (label) values ('Reception') returning key into v_key;
  return v_key;
end;
$$;
revoke execute on function public.rotate_reception_key() from public, anon;
grant execute on function public.rotate_reception_key() to authenticated;
