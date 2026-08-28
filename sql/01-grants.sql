-- STEP 2 보조 권한 스크립트입니다. canonical 기준은 supabase/migrations의 migration입니다.
revoke all on schema core, analytics from anon;
revoke all privileges on all tables in schema core from anon;
revoke all privileges on all tables in schema analytics from anon;
revoke insert, update, delete on all tables in schema public from anon;
grant usage on schema core, analytics to authenticated;
grant select on all tables in schema core, analytics to authenticated;
alter default privileges in schema core grant select on tables to authenticated;
alter default privileges in schema analytics grant select on tables to authenticated;

select has_schema_privilege('anon', 'analytics', 'usage') as anon_schema_usage,
       has_table_privilege('anon', 'analytics.v_leadtime_gap', 'select') as anon_view_select,
       has_table_privilege('authenticated', 'analytics.v_leadtime_gap', 'select') as authenticated_view_select;
