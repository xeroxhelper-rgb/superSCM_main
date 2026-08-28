-- STEP 2 보조 RLS 스크립트입니다. canonical 기준은 supabase/migrations의 migration입니다.
revoke insert, update, delete on core.leadtime_plan, core.usage_profile from anon;
grant select, insert, update, delete on core.leadtime_plan, core.usage_profile to authenticated;
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
select schemaname, tablename, policyname, roles, cmd from pg_policies where schemaname = 'core' and tablename in ('leadtime_plan', 'usage_profile');
