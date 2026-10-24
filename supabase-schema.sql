-- Run this once in Supabase → SQL Editor.
create table public.learning_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{"sets":[],"activeSetId":""}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint learning_states_state_is_object check (jsonb_typeof(state) = 'object')
);

alter table public.learning_states enable row level security;

create policy "Users read their own learning state"
  on public.learning_states for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create their own learning state"
  on public.learning_states for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update their own learning state"
  on public.learning_states for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.voci_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger voci_learning_states_updated_at
before update on public.learning_states
for each row execute function public.voci_set_updated_at();
