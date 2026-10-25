-- Run this in Supabase → SQL Editor. It is safe to run again.
create table if not exists public.learning_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{"sets":[],"activeSetId":""}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint learning_states_state_is_object check (jsonb_typeof(state) = 'object')
);

alter table public.learning_states enable row level security;
drop policy if exists "Users read their own learning state" on public.learning_states;
drop policy if exists "Users create their own learning state" on public.learning_states;
drop policy if exists "Users update their own learning state" on public.learning_states;

create policy "Users read their own learning state"
  on public.learning_states for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create their own learning state"
  on public.learning_states for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update their own learning state"
  on public.learning_states for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.voci_set_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists voci_learning_states_updated_at on public.learning_states;
create trigger voci_learning_states_updated_at
before update on public.learning_states
for each row execute function public.voci_set_updated_at();

create table if not exists public.shared_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_set_id text not null,
  set_data jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  constraint shared_sets_data_is_object check (jsonb_typeof(set_data) = 'object'),
  constraint shared_sets_maximum_lifetime check (expires_at <= created_at + interval '7 days')
);

alter table public.shared_sets enable row level security;
revoke all on public.shared_sets from anon, authenticated;
grant delete on public.shared_sets to authenticated;
drop policy if exists "Owners delete their own shared sets" on public.shared_sets;
create policy "Owners delete their own shared sets"
  on public.shared_sets for delete to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.create_shared_set(source_set_id text, set_data jsonb)
returns table (share_token uuid, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or source_set_id = '' or jsonb_typeof(set_data) <> 'object' then
    raise exception 'Invalid shared learning set';
  end if;
  return query
    insert into public.shared_sets (owner_id, source_set_id, set_data)
    values (auth.uid(), source_set_id, set_data)
    returning id, shared_sets.expires_at;
end;
$$;

create or replace function public.get_shared_set(share_token uuid)
returns jsonb
language sql security definer set search_path = ''
as $$
  select set_data
  from public.shared_sets
  where id = share_token and expires_at > now()
  limit 1;
$$;

revoke all on function public.create_shared_set(text, jsonb) from public;
revoke all on function public.get_shared_set(uuid) from public;
grant execute on function public.create_shared_set(text, jsonb) to authenticated;
grant execute on function public.get_shared_set(uuid) to authenticated;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'delete-expired-voci-shares';
select cron.schedule(
  'delete-expired-voci-shares',
  '15 3 * * *',
  $$delete from public.shared_sets where expires_at <= now()$$
);
