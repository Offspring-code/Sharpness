-- Budget-Wise / ADMIN-ME onboarding schema for Supabase Postgres.
-- Run only after creating a Supabase project and configuring Auth.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null,
  phone text not null,
  location text not null,
  verified boolean not null default false,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  email text not null,
  phone text not null,
  location text not null,
  terms_accepted boolean not null default false check (terms_accepted),
  status text not null default 'pending' check (status in ('pending','code_issued','verified','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role = 'admin')
);

create table if not exists public.verification_codes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.signup_requests(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.signup_requests enable row level security;
alter table public.admin_roles enable row level security;
alter table public.verification_codes enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.admin_roles where user_id = auth.uid() and role = 'admin'); $$;

-- Users can read/update only their own profile; admins can read user contact/profile fields.
drop policy if exists "profile self read" on public.profiles;
create policy "profile self read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profile self update" on public.profiles;
create policy "profile self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "admin profile management" on public.profiles;
create policy "admin profile management" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Signup requests are submitted through a trusted server endpoint, not direct client inserts.
drop policy if exists "admin requests read" on public.signup_requests;
create policy "admin requests read" on public.signup_requests for select to authenticated using (public.is_admin());
drop policy if exists "admin requests update" on public.signup_requests;
create policy "admin requests update" on public.signup_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin roles private" on public.admin_roles;
create policy "admin roles private" on public.admin_roles for select to authenticated using (user_id = auth.uid());
drop policy if exists "admin codes private" on public.verification_codes;
create policy "admin codes private" on public.verification_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Issue a one-time six-digit code manually from ADMIN-ME. Previous unused codes are invalidated.
create or replace function public.admin_issue_code(p_request_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare v_code text; v_request public.signup_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select * into v_request from public.signup_requests where id = p_request_id for update;
  if not found then raise exception 'Signup request not found'; end if;
  if v_request.status = 'verified' then raise exception 'Request is already verified'; end if;
  update public.verification_codes set used_at = now() where request_id = p_request_id and used_at is null;
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  insert into public.verification_codes(request_id, code_hash) values (p_request_id, crypt(v_code, gen_salt('bf')));
  update public.signup_requests set status = 'code_issued' where id = p_request_id;
  return v_code; -- display only to admin once; do not log or store the plain code.
end; $$;
revoke all on function public.admin_issue_code(uuid) from public, anon;
grant execute on function public.admin_issue_code(uuid) to authenticated;

-- Verify code. A successful code is consumed and the request becomes verified.
create or replace function public.verify_signup_code(p_request_id uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_code public.verification_codes%rowtype;
begin
  if p_code !~ '^[0-9]{6}$' then return false; end if;
  select * into v_code from public.verification_codes
   where request_id = p_request_id and used_at is null and expires_at > now()
   order by created_at desc limit 1 for update;
  if not found or crypt(p_code, v_code.code_hash) <> v_code.code_hash then return false; end if;
  update public.verification_codes set used_at = now() where id = v_code.id;
  update public.signup_requests set status = 'verified' where id = p_request_id;
  return true;
end; $$;
revoke all on function public.verify_signup_code(uuid,text) from public;
grant execute on function public.verify_signup_code(uuid,text) to anon, authenticated;

-- IMPORTANT: set the first admin by inserting their auth.users UUID manually in the SQL editor:
-- insert into public.admin_roles(user_id, role) values ('YOUR_AUTH_USER_UUID', 'admin');
-- Do not expose the Supabase service-role key in the browser.
