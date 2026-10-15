-- Run this entire file in Supabase Dashboard > SQL Editor.
-- Replace ADMIN_EMAIL_HERE with the exact email you use to administer Nourish.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.user_data enable row level security;
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "Admin can read all profiles" on public.profiles;
create policy "Admin can read all profiles" on public.profiles for select to authenticated using ((auth.jwt()->>'email') = 'ADMIN_EMAIL_HERE');
drop policy if exists "Users can read own data" on public.user_data;
create policy "Users can read own data" on public.user_data for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own data" on public.user_data;
create policy "Users can insert own data" on public.user_data for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own data" on public.user_data;
create policy "Users can update own data" on public.user_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create or replace function public.handle_new_nourish_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id,email,created_at) values (new.id,new.email,coalesce(new.created_at,now()))
  on conflict (id) do update set email=excluded.email;
  return new;
end;
$$;
drop trigger if exists on_nourish_auth_user_created on auth.users;
create trigger on_nourish_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_nourish_user();
