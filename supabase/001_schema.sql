-- DFL Events: frontend (Vercel) falando direto com o Supabase.
-- Execute uma vez no SQL Editor do projeto tech-events-house.
-- Pode ser executado de novo sem perder dados (usa IF NOT EXISTS / OR REPLACE).
--
-- Modelo de acesso:
--   * Contas são criadas por você no painel (Authentication → Users) e
--     liberadas inserindo o id em public.members. Sem cadastro público.
--   * Membros enxergam e editam tudo (agenda compartilhada da casa).
--   * Visitantes (anon) só acessam as duas funções públicas do final:
--     ver um evento pelo link e se inscrever nele.
begin;

-- ---------------------------------------------------------------- members
create table if not exists public.members (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

-- Schema não exposto pela Data API: guarda a função de autorização.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.members m where m.user_id = (select auth.uid()));
$$;
revoke all on function private.is_member() from public, anon;
grant execute on function private.is_member() to authenticated;

-- ----------------------------------------------------------------- events
-- Catálogo: eventos coletados das fontes e eventos criados à mão.
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  external_id text unique,                       -- id da fonte (null = criado à mão)
  title       text not null check (char_length(title) between 1 and 300),
  start_date  date not null,
  end_date    date check (end_date is null or end_date >= start_date),
  url         text check (url is null or url ~ '^https?://'),
  source      text not null default 'Manual',
  mode        text,                              -- Online, Presencial, cidade...
  location    text,
  description text,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists events_start_date_idx on public.events (start_date);

-- ----------------------------------------------------------- agenda_items
-- Eventos que a casa vai. Cada um ganha um link público de inscrição.
create table if not exists public.agenda_items (
  event_id     uuid primary key references public.events (id) on delete cascade,
  public_token uuid not null unique default gen_random_uuid(),
  added_by     uuid default auth.uid() references auth.users (id) on delete set null,
  added_at     timestamptz not null default now()
);

-- ----------------------------------------------------------- participants
create table if not exists public.participants (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.agenda_items (event_id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 150),
  email      text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status     text not null default 'invited' check (status in ('invited', 'confirmed', 'declined')),
  origin     text not null default 'invite' check (origin in ('invite', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists participants_event_email_key on public.participants (event_id, lower(email));

-- --------------------------------------------------------------- triggers
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function private.touch_updated_at();
drop trigger if exists participants_touch on public.participants;
create trigger participants_touch before update on public.participants
  for each row execute function private.touch_updated_at();

-- -------------------------------------------------------------------- RLS
alter table public.members      enable row level security;
alter table public.events       enable row level security;
alter table public.agenda_items enable row level security;
alter table public.participants enable row level security;

-- A Data API pode não expor tabelas novas automaticamente: grants explícitos.
revoke all on public.members, public.events, public.agenda_items, public.participants from anon;
grant select on public.members to authenticated;
grant select, insert, update, delete on public.events, public.agenda_items, public.participants to authenticated;

drop policy if exists "membros veem membros" on public.members;
create policy "membros veem membros" on public.members for select to authenticated
  using ((select private.is_member()));

do $$
declare t text;
begin
  foreach t in array array['events', 'agenda_items', 'participants'] loop
    execute format('drop policy if exists "membros leem" on public.%I', t);
    execute format('drop policy if exists "membros criam" on public.%I', t);
    execute format('drop policy if exists "membros alteram" on public.%I', t);
    execute format('drop policy if exists "membros removem" on public.%I', t);
    execute format('create policy "membros leem" on public.%I for select to authenticated using ((select private.is_member()))', t);
    execute format('create policy "membros criam" on public.%I for insert to authenticated with check ((select private.is_member()))', t);
    execute format('create policy "membros alteram" on public.%I for update to authenticated using ((select private.is_member())) with check ((select private.is_member()))', t);
    execute format('create policy "membros removem" on public.%I for delete to authenticated using ((select private.is_member()))', t);
  end loop;
end $$;

-- ------------------------------------------------- funções públicas (anon)
-- SECURITY DEFINER de propósito: são os únicos pontos de acesso de
-- visitantes. Retornam só os campos do evento e validam a entrada.
create or replace function public.get_public_event(p_token uuid)
returns table (title text, start_date date, end_date date, url text, mode text, location text, description text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.title, e.start_date, e.end_date, e.url, e.mode, e.location, e.description
  from public.agenda_items a
  join public.events e on e.id = a.event_id
  where a.public_token = p_token;
$$;

create or replace function public.register_for_event(p_token uuid, p_name text, p_email text, p_response text default 'confirmed')
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event uuid;
  v_name  text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if p_response not in ('confirmed', 'declined') then raise exception 'Resposta inválida.' using errcode = '22023'; end if;
  if char_length(v_name) not between 1 and 150 then raise exception 'Informe seu nome.' using errcode = '22023'; end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Informe um e-mail válido.' using errcode = '22023'; end if;

  select a.event_id into v_event from public.agenda_items a where a.public_token = p_token;
  if v_event is null then raise exception 'Evento não encontrado.' using errcode = 'P0002'; end if;
  if (select count(*) from public.participants where event_id = v_event) >= 1000 then
    raise exception 'As inscrições deste evento estão encerradas.' using errcode = '22023';
  end if;

  -- Quem já foi convidado mantém o nome cadastrado; só a resposta muda.
  insert into public.participants (event_id, name, email, status, origin)
  values (v_event, v_name, v_email, p_response, 'public')
  on conflict (event_id, lower(email)) do update set status = excluded.status;
  return p_response;
end;
$$;

revoke all on function public.get_public_event(uuid) from public;
revoke all on function public.register_for_event(uuid, text, text, text) from public;
grant execute on function public.get_public_event(uuid) to anon, authenticated;
grant execute on function public.register_for_event(uuid, text, text, text) to anon, authenticated;

commit;

-- ------------------------------------------------------------------------
-- Depois de criar cada conta em Authentication → Users, libere o acesso:
--   insert into public.members (user_id, name)
--   select id, 'Seu nome' from auth.users where email = 'voce@exemplo.com';
-- Recomendado: desligue "Allow new users to sign up" em
-- Authentication → Sign In / Providers → Email.
