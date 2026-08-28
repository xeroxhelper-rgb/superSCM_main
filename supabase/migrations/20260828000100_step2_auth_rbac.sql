-- STEP 2 canonical migration: 인증 사용자, 관리자 RPC, 감사 로그, RLS
create schema if not exists core;
create table if not exists core.app_user (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null, name text not null, department text,
  role text not null default 'USER' check (role in ('ADMIN', 'USER')),
  active boolean not null default true, last_login_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists core.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id) on delete set null,
  action text not null, target_type text not null, target_id text not null,
  before jsonb, after jsonb, at timestamptz not null default now()
);

create or replace function core.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into core.app_user (user_id, email, name, department, role)
  values (new.id, coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    nullif(new.raw_user_meta_data ->> 'department', ''), 'USER')
  on conflict (user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function core.handle_new_auth_user();
insert into core.app_user (user_id, email, name, department, role)
select u.id, coalesce(u.email, ''), coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(coalesce(u.email, 'user'), '@', 1)), nullif(u.raw_user_meta_data ->> 'department', ''), 'USER'
from auth.users u on conflict (user_id) do nothing;

create or replace function core.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from core.app_user where user_id = auth.uid() and role = 'ADMIN' and active = true);
$$;
create or replace function core.touch_last_login() returns void language sql security definer set search_path = '' as $$
  update core.app_user set last_login_at = now(), updated_at = now() where user_id = auth.uid();
$$;
create or replace function core.admin_set_user_role(target_user_id uuid, next_role text) returns core.app_user language plpgsql security definer set search_path = '' as $$
declare updated_user core.app_user;
begin
  if auth.uid() is null or not core.is_admin() then raise exception using errcode = '42501', message = '관리자 권한이 필요합니다.'; end if;
  if next_role not in ('ADMIN', 'USER') then raise exception using errcode = '22023', message = '유효하지 않은 역할입니다.'; end if;
  if target_user_id = auth.uid() and next_role <> 'ADMIN' then raise exception using errcode = '42501', message = '자신의 관리자 권한은 해제할 수 없습니다.'; end if;
  update core.app_user set role = next_role, updated_at = now() where user_id = target_user_id returning * into updated_user;
  if not found then raise exception using errcode = 'P0002', message = '대상 사용자를 찾을 수 없습니다.'; end if;
  return updated_user;
end; $$;
create or replace function core.admin_set_user_active(target_user_id uuid, next_active boolean) returns core.app_user language plpgsql security definer set search_path = '' as $$
declare updated_user core.app_user;
begin
  if auth.uid() is null or not core.is_admin() then raise exception using errcode = '42501', message = '관리자 권한이 필요합니다.'; end if;
  if target_user_id = auth.uid() and next_active = false then raise exception using errcode = '42501', message = '자신의 계정은 비활성화할 수 없습니다.'; end if;
  update core.app_user set active = next_active, updated_at = now() where user_id = target_user_id returning * into updated_user;
  if not found then raise exception using errcode = 'P0002', message = '대상 사용자를 찾을 수 없습니다.'; end if;
  return updated_user;
end; $$;

create or replace function core.set_app_user_updated_at() returns trigger language plpgsql security definer set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create or replace function core.audit_app_user_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role then insert into core.audit_log(actor, action, target_type, target_id, before, after) values (auth.uid(), 'USER_ROLE_CHANGED', 'APP_USER', new.user_id::text, jsonb_build_object('role', old.role), jsonb_build_object('role', new.role)); end if;
  if new.active is distinct from old.active then insert into core.audit_log(actor, action, target_type, target_id, before, after) values (auth.uid(), 'USER_ACTIVE_CHANGED', 'APP_USER', new.user_id::text, jsonb_build_object('active', old.active), jsonb_build_object('active', new.active)); end if;
  return new;
end; $$;
drop trigger if exists app_user_set_updated_at on core.app_user;
create trigger app_user_set_updated_at before update on core.app_user for each row execute function core.set_app_user_updated_at();
drop trigger if exists app_user_audit_change on core.app_user;
create trigger app_user_audit_change after update on core.app_user for each row execute function core.audit_app_user_change();

alter table core.app_user enable row level security;
alter table core.audit_log enable row level security;
drop policy if exists app_user_read_self_or_admin on core.app_user;
create policy app_user_read_self_or_admin on core.app_user for select to authenticated using (user_id = (select auth.uid()) or core.is_admin());
drop policy if exists audit_log_read_admin on core.audit_log;
create policy audit_log_read_admin on core.audit_log for select to authenticated using (core.is_admin());
drop policy if exists "수업용 전체 허용" on core.leadtime_plan;
drop policy if exists "수업용 전체 허용" on core.usage_profile;
drop policy if exists leadtime_plan_read_active on core.leadtime_plan;
create policy leadtime_plan_read_active on core.leadtime_plan for select to authenticated using ((select coalesce((select active from core.app_user where user_id = auth.uid()), false)));
drop policy if exists leadtime_plan_admin_mutation on core.leadtime_plan;
create policy leadtime_plan_admin_mutation on core.leadtime_plan for all to authenticated using (core.is_admin()) with check (core.is_admin());
drop policy if exists usage_profile_read_active on core.usage_profile;
create policy usage_profile_read_active on core.usage_profile for select to authenticated using ((select coalesce((select active from core.app_user where user_id = auth.uid()), false)));
drop policy if exists usage_profile_admin_mutation on core.usage_profile;
create policy usage_profile_admin_mutation on core.usage_profile for all to authenticated using (core.is_admin()) with check (core.is_admin());

do $$ declare table_name text; begin
  foreach table_name in array array['planning_runs','ol_demand','sfdc_pipeline','bulk_deals','historical_actuals','demand_confirmations'] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
    end if;
  end loop;
end $$;
do $$ declare table_name text; begin
  foreach table_name in array array['planning_runs','ol_demand','sfdc_pipeline','bulk_deals','historical_actuals','demand_confirmations'] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists active_authenticated_read on public.%I', table_name);
      execute format('create policy active_authenticated_read on public.%I for select to authenticated using ((select coalesce((select active from core.app_user where user_id = auth.uid()), false)))', table_name);
    end if;
  end loop;
end $$;
revoke all on schema core, analytics from anon;
revoke all privileges on all tables in schema core from anon;
revoke all privileges on all tables in schema analytics from anon;
revoke insert, update, delete on all tables in schema public from anon;
revoke all on function core.admin_set_user_role(uuid, text) from public;
revoke all on function core.admin_set_user_active(uuid, boolean) from public;
revoke all on function core.touch_last_login() from public;
grant usage on schema core, analytics to authenticated;
grant select on all tables in schema core, analytics to authenticated;
grant select on all tables in schema public to authenticated;
grant execute on function core.admin_set_user_role(uuid, text) to authenticated;
grant execute on function core.admin_set_user_active(uuid, boolean) to authenticated;
grant execute on function core.touch_last_login() to authenticated;
grant select, insert, update, delete on core.leadtime_plan, core.usage_profile to authenticated;
alter default privileges in schema core revoke all on tables from anon;
alter default privileges in schema analytics revoke all on tables from anon;
alter default privileges in schema core grant select on tables to authenticated;
alter default privileges in schema analytics grant select on tables to authenticated;
