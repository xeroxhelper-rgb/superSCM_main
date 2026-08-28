-- STEP 3 읽기 전용 검증 SQL. 데이터 변경문은 포함하지 않습니다.

select table_schema, table_name
from information_schema.tables
where table_schema in ('raw', 'core', 'analytics')
  and table_name in ('business_event','sales_order','item_substitute','policy_config','outlier_rule','item_policy','forecast_setting','v_train_demand','v_test_actual','v_data_coverage','v_forecast_setting_admin')
order by table_schema, table_name;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'raw'
  and column_name in ('batch_id','source_type','loaded_at','source_record_id')
order by table_name, column_name;

select has_schema_privilege('anon', 'raw', 'usage') as anon_raw_usage,
       has_table_privilege('anon', 'raw.usage_history', 'select') as anon_raw_select,
       has_table_privilege('authenticated', 'core.v_train_demand', 'select') as authenticated_train_view_select,
       has_table_privilege('authenticated', 'analytics.v_data_coverage', 'select') as authenticated_coverage_select;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'core'
  and tablename in ('policy_config','outlier_rule','item_policy','forecast_setting')
order by tablename, policyname;

select * from analytics.v_data_coverage;
select * from analytics.v_forecast_setting_admin;

-- 기간 설정 예시(관리자가 정책에 맞는 값을 정한 뒤 별도 실행):
-- update core.forecast_setting
-- set train_start = 'YYYY-MM-DD', train_end = 'YYYY-MM-DD',
--     test_start = 'YYYY-MM-DD', test_end = 'YYYY-MM-DD', granularity = 'DAY'
-- where setting_id = 1;
