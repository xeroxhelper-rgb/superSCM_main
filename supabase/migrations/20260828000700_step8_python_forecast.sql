-- STEP 8: Python Forecast Service registry와 서버 실행 경계

alter table if exists core.forecast_run add column if not exists error_message text;

do $$
declare constraint_row record;
begin
  for constraint_row in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'core' and rel.relname = 'model_config'
      and pg_get_constraintdef(con.oid) ilike '%engine%'
  loop
    execute format('alter table core.model_config drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table core.model_config add constraint model_config_engine_check check (engine in ('SQL','PYTHON'));

insert into core.model_config (model_id, model_name, family, engine, version, enabled, is_default, applicable_demand_type, parameters, description)
values
  ('PY_ETS', 'Python 지수평활', 'EXPONENTIAL_SMOOTHING', 'PYTHON', '1.0.0', true, false, array['SMOOTH','ERRATIC'], '{"alpha":0.3}'::jsonb, 'Python 서비스 Exponential Smoothing'),
  ('PY_HOLT', 'Python Holt', 'HOLT', 'PYTHON', '1.0.0', true, false, array['SMOOTH','ERRATIC'], '{"alpha":0.3,"beta":0.1}'::jsonb, 'Python 서비스 Holt trend'),
  ('PY_HOLT_WINTERS', 'Python Holt-Winters', 'HOLT_WINTERS', 'PYTHON', '1.0.0', true, false, array['SMOOTH','ERRATIC'], '{"alpha":0.3,"beta":0.1,"season_length":12}'::jsonb, 'Python 서비스 seasonal trend'),
  ('PY_CROSTON', 'Python Croston', 'CROSTON', 'PYTHON', '1.0.0', true, false, array['INTERMITTENT','LUMPY'], '{}'::jsonb, '간헐수요 Croston'),
  ('PY_SBA', 'Python SBA', 'SBA', 'PYTHON', '1.0.0', true, false, array['INTERMITTENT','LUMPY'], '{}'::jsonb, '간헐수요 SBA'),
  ('PY_TSB', 'Python TSB', 'TSB', 'PYTHON', '1.0.0', true, false, array['INTERMITTENT','LUMPY'], '{}'::jsonb, '간헐수요 TSB'),
  ('PY_SARIMA', 'Python SARIMA', 'SARIMA', 'PYTHON', '1.0.0', false, false, array['SMOOTH','ERRATIC'], '{"seasonal":true}'::jsonb, '선택 의존성 statsmodels adapter'),
  ('PY_PROPHET', 'Python Prophet', 'PROPHET', 'PYTHON', '1.0.0', false, false, array['SMOOTH','ERRATIC'], '{}'::jsonb, '선택 의존성 Prophet adapter'),
  ('PY_XGBOOST', 'Python XGBoost', 'GRADIENT_BOOSTING', 'PYTHON', '1.0.0', false, false, array['SMOOTH','ERRATIC'], '{}'::jsonb, '선택 의존성 XGBoost adapter')
on conflict (model_id) do update set engine = excluded.engine, applicable_demand_type = excluded.applicable_demand_type;

-- service_role은 별도 서버에서만 사용된다. 브라우저 역할에는 권한을 부여하지 않는다.
create or replace function core.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select current_setting('request.jwt.claim.role', true) = 'service_role'
      or exists (select 1 from core.app_user where user_id = auth.uid() and role = 'ADMIN' and active = true);
$$;

grant usage on schema core, analytics to service_role;
grant select on core.v_train_demand, core.forecast_setting, analytics.v_sku_demand_profile to service_role;
grant select, insert, update on core.forecast_run, core.model_version, core.forecast_result to service_role;
grant execute on function core.run_backtest(uuid, text) to service_role;
