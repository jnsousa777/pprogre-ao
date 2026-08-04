-- Progressão Cloud v5 (estrutura compatível com v4)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.

create extension if not exists pgcrypto;

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  weekday text not null check (weekday in ('segunda','terca','quarta','quinta','sexta','sabado','domingo')),
  start_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table if not exists public.global_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  normalized_name text not null check (char_length(trim(normalized_name)) > 0),
  muscle_group text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name),
  unique (user_id, id)
);

create table if not exists public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id uuid not null,
  global_exercise_id uuid not null,
  target_sets integer not null default 2 check (target_sets between 1 and 20),
  rep_min integer not null default 4 check (rep_min between 1 and 100),
  rep_max integer not null default 8 check (rep_max between 1 and 100 and rep_max >= rep_min),
  load_increment numeric(8,2) not null default 2.5 check (load_increment >= 0),
  order_index integer not null default 0 check (order_index >= 0),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, routine_id, global_exercise_id),
  unique (user_id, id),
  foreign key (user_id, routine_id) references public.routines(user_id, id) on delete cascade,
  foreign key (user_id, global_exercise_id) references public.global_exercises(user_id, id) on delete restrict
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id uuid not null,
  session_date date not null,
  status text not null check (status in ('completed','partial','missed')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, routine_id, session_date),
  unique (user_id, id),
  foreign key (user_id, routine_id) references public.routines(user_id, id) on delete cascade
);

create table if not exists public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null,
  routine_exercise_id uuid,
  global_exercise_id uuid not null,
  status text not null check (status in ('performed','skipped')),
  skip_reason text not null default '',
  position_index integer not null default 0 check (position_index >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_id, global_exercise_id),
  unique (user_id, id),
  foreign key (user_id, session_id) references public.sessions(user_id, id) on delete cascade,
  foreign key (user_id, routine_exercise_id) references public.routine_exercises(user_id, id) on delete set null (routine_exercise_id),
  foreign key (user_id, global_exercise_id) references public.global_exercises(user_id, id) on delete restrict
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_exercise_id uuid not null,
  set_number integer not null check (set_number between 1 and 50),
  load numeric(10,3) not null default 0 check (load >= 0),
  reps integer not null default 0 check (reps between 0 and 500),
  rir numeric(5,2),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_exercise_id, set_number),
  foreign key (user_id, session_exercise_id) references public.session_exercises(user_id, id) on delete cascade
);

create index if not exists routines_user_weekday_idx on public.routines(user_id, weekday, active);
create index if not exists routine_exercises_routine_order_idx on public.routine_exercises(routine_id, active, order_index);
create index if not exists sessions_user_date_idx on public.sessions(user_id, session_date desc);
create index if not exists session_exercises_global_idx on public.session_exercises(user_id, global_exercise_id, created_at desc);
create index if not exists workout_sets_session_exercise_idx on public.workout_sets(session_exercise_id, set_number);

create or replace function public.set_updated_at()
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

do $$
declare
  table_name text;
begin
  foreach table_name in array array['routines','global_exercises','routine_exercises','sessions','session_exercises','workout_sets']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end;
$$;

alter table public.routines enable row level security;
alter table public.global_exercises enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.workout_sets enable row level security;

-- Cada conta enxerga e altera somente as próprias linhas.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['routines','global_exercises','routine_exercises','sessions','session_exercises','workout_sets']
  loop
    execute format('drop policy if exists "own_rows" on public.%I', table_name);
    execute format(
      'create policy "own_rows" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name
    );
  end loop;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.routines to authenticated;
grant select, insert, update, delete on public.global_exercises to authenticated;
grant select, insert, update, delete on public.routine_exercises to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.session_exercises to authenticated;
grant select, insert, update, delete on public.workout_sets to authenticated;
