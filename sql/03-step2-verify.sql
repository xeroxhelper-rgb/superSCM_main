-- STEP 2 읽기 전용 검증 SQL. 테스트 데이터 변경문은 포함하지 않습니다.
select 'anon_schema_core_usage' as check_name, has_schema_privilege('anon', 'core', 'usage') as result
union all select 'anon_schema_analytics_usage', has_schema_privilege('anon', 'analytics', 'usage')
union all select 'anon_core_app_user_select', has_table_privilege('anon', 'core.app_user', 'select')
union all select 'anon_public_write_planning_runs', has_table_privilege('anon', 'public.planning_runs', 'insert,update,delete');
select schemaname, tablename, policyname, roles, cmd, qual, with_check from pg_policies
where (schemaname = 'core' and tablename in ('app_user','audit_log','leadtime_plan','usage_profile'))
   or (schemaname = 'public' and tablename in ('planning_runs','ol_demand','sfdc_pipeline','bulk_deals','historical_actuals','demand_confirmations'))
order by schemaname, tablename, policyname;
select routine_schema, routine_name, routine_type from information_schema.routines
where routine_schema = 'core' and routine_name in ('is_admin','touch_last_login','admin_set_user_role','admin_set_user_active');
select n.nspname as schema_name, c.relname as table_name, t.tgname as trigger_name
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and ((n.nspname = 'auth' and c.relname = 'users' and t.tgname = 'on_auth_user_created') or (n.nspname = 'core' and c.relname = 'app_user' and t.tgname in ('app_user_set_updated_at','app_user_audit_change')));
-- 수동 검증 예시(실행 전 실제 테스트 계정과 별도 transaction 사용):
-- begin; set local role authenticated; set local request.jwt.claim.sub = 'USER_UUID';
-- select core.admin_set_user_role('TARGET_UUID', 'ADMIN'); rollback;
