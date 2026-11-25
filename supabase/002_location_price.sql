-- Local, preço e temas dos eventos. Execute no SQL Editor depois do 001.
-- Pode ser executado de novo sem perder dados.
begin;

alter table public.events
  add column if not exists country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add column if not exists state text,
  add column if not exists city text,
  add column if not exists is_online boolean not null default false,
  add column if not exists price text check (price is null or price in ('free', 'paid')),
  add column if not exists topics text[] not null default '{}';

-- Lista de próximos eventos: filtra por término (ou início) a partir de hoje.
create index if not exists events_upcoming_idx on public.events ((coalesce(end_date, start_date)));
create index if not exists events_country_idx on public.events (country_code);

-- Página pública passa a mostrar cidade, estado e país.
drop function if exists public.get_public_event(uuid);
create function public.get_public_event(p_token uuid)
returns table (title text, start_date date, end_date date, url text, mode text, location text, description text, city text, state text, country_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.title, e.start_date, e.end_date, e.url, e.mode, e.location, e.description, e.city, e.state, e.country_code
  from public.agenda_items a
  join public.events e on e.id = a.event_id
  where a.public_token = p_token;
$$;
revoke all on function public.get_public_event(uuid) from public;
grant execute on function public.get_public_event(uuid) to anon, authenticated;

commit;
