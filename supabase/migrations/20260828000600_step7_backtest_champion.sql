-- STEP 7: 저장된 Forecast Result와 검증 Actual의 성능 비교 및 Champion snapshot
-- Bias 정의: sum(forecast - actual) / sum(actual) * 100. 양수는 과대예측이다.

create schema if not exists core;
create schema if not exists analytics;

alter table if exists core.forecast_setting add column if not exists champion_metric text default 'WAPE';
alter table if exists core.forecast_setting add column if not exists reference_model_id text;
do $$ begin
  alter table core.forecast_setting add constraint forecast_setting_champion_metric_check
    check (champion_metric is null or champion_metric in ('WAPE','MAPE','RMSE','MAE'));
exception when duplicate_object then null;
end $$;

create table if not exists core.backtest_run (
  backtest_run_id uuid primary key default gen_random_uuid(),
  forecast_run_id uuid not null references core.forecast_run(run_id) on delete restrict,
  test_start date,
  test_end date,
  metric text not null check (metric in ('WAPE','MAPE','RMSE','MAE')),
  status text not null check (status in ('RUNNING','SUCCESS','FAILED')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  triggered_by uuid references auth.users(id) on delete set null,
  message text,
  unique (backtest_run_id, forecast_run_id)
);

create table if not exists core.model_performance (
  performance_id uuid primary key default gen_random_uuid(),
  backtest_run_id uuid not null references core.backtest_run(backtest_run_id) on delete cascade,
  run_id uuid not null references core.forecast_run(run_id) on delete restrict,
  model_id text not null,
  model_version uuid references core.model_version(model_version_id) on delete restrict,
  item_id text not null,
  n_periods integer not null default 0 check (n_periods >= 0),
  n_compared_periods integer not null default 0 check (n_compared_periods >= 0),
  wape numeric,
  mape numeric,
  bias numeric,
  rmse numeric,
  mae numeric,
  baseline_improvement numeric,
  rank integer,
  metric_value numeric,
  calculation_status text not null check (calculation_status in ('CALCULATED','PARTIAL','UNAVAILABLE')),
  reason_code text,
  calculated_at timestamptz not null default now(),
  unique (backtest_run_id, model_id, item_id)
);

create table if not exists core.champion_model (
  champion_id uuid primary key default gen_random_uuid(),
  item_id text not null,
  backtest_run_id uuid references core.backtest_run(backtest_run_id) on delete restrict,
  forecast_run_id uuid references core.forecast_run(run_id) on delete restrict,
  champion_model_id text not null,
  model_version uuid references core.model_version(model_version_id) on delete restrict,
  champion_metric text not null check (champion_metric in ('WAPE','MAPE','RMSE','MAE')),
  champion_metric_value numeric,
  wape numeric,
  mape numeric,
  bias numeric,
  rmse numeric,
  mae numeric,
  candidate_performance jsonb not null default '[]'::jsonb,
  selection_reason text,
  selection_method text not null check (selection_method in ('AUTO','MANUAL')),
  selected_at timestamptz not null default now(),
  selected_by uuid references auth.users(id) on delete set null
);

comment on column core.model_performance.wape is 'sum(abs(actual - forecast)) / sum(actual) * 100; actual 합계가 0이면 null';
comment on column core.model_performance.mape is 'actual != 0인 기간만 평균; 분모가 없으면 null';
comment on column core.model_performance.bias is 'sum(forecast - actual) / sum(actual) * 100; 양수는 과대예측';
comment on column core.champion_model.candidate_performance is 'Champion 선정 당시 SKU의 전체 후보 성능 snapshot';

create index if not exists model_performance_item_idx on core.model_performance(item_id, calculated_at desc);
create index if not exists champion_item_idx on core.champion_model(item_id, selected_at desc);

create or replace function core.run_backtest(p_forecast_run_id uuid, p_metric text default null)
returns uuid
language plpgsql
security definer
set search_path = core, analytics, pg_temp
as $$
declare
  v_backtest_id uuid;
  v_actor uuid := auth.uid();
  v_setting record;
  v_run record;
  v_metric text;
  v_finished timestamptz;
begin
  if not core.is_admin() then
    raise exception 'ADMIN 권한이 필요합니다.' using errcode = '42501';
  end if;

  select * into v_run from core.forecast_run where run_id = p_forecast_run_id;
  if not found then raise exception 'Forecast 실행을 찾을 수 없습니다.' using errcode = '22023'; end if;
  select * into v_setting from core.forecast_setting where setting_id = 1;
  v_metric := upper(coalesce(p_metric, v_setting.champion_metric));
  if v_metric is null or v_metric not in ('WAPE','MAPE','RMSE','MAE') then
    raise exception 'Champion metric 설정이 유효하지 않습니다.' using errcode = '22023';
  end if;

  insert into core.backtest_run (forecast_run_id, test_start, test_end, metric, status, triggered_by, message)
  values (p_forecast_run_id, v_setting.test_start, v_setting.test_end, v_metric, 'RUNNING', v_actor, 'Backtest scoring 실행 중')
  returning backtest_run_id into v_backtest_id;

  create temporary table tmp_actual on commit drop as
    select item_id::text, date_trunc('month', use_date)::date as period, sum(qty)::numeric as actual_qty
    from core.v_test_actual
    group by item_id::text, date_trunc('month', use_date)::date;

  create temporary table tmp_comparison on commit drop as
    select fr.run_id, fr.model_id, fr.model_version, fr.item_id::text, fr.period,
           fr.predicted_qty::numeric as forecast_qty, a.actual_qty
    from analytics.v_forecast_result fr
    left join tmp_actual a on a.item_id = fr.item_id::text and a.period = date_trunc('month', fr.period)::date
    where fr.run_id = p_forecast_run_id
      and v_setting.test_start is not null and v_setting.test_end is not null
      and fr.period between date_trunc('month', v_setting.test_start)::date and date_trunc('month', v_setting.test_end)::date;

  create temporary table tmp_metric on commit drop as
    select model_id, model_version, item_id,
           count(*)::integer as n_periods,
           count(*) filter (where forecast_qty is not null and actual_qty is not null)::integer as n_compared_periods,
           sum(abs(actual_qty - forecast_qty)) filter (where forecast_qty is not null and actual_qty is not null) / nullif(sum(actual_qty) filter (where forecast_qty is not null and actual_qty is not null), 0) * 100 as wape,
           avg(abs(actual_qty - forecast_qty) / nullif(abs(actual_qty), 0) * 100) filter (where forecast_qty is not null and actual_qty is not null and actual_qty <> 0) as mape,
           sum(forecast_qty - actual_qty) filter (where forecast_qty is not null and actual_qty is not null) / nullif(sum(actual_qty) filter (where forecast_qty is not null and actual_qty is not null), 0) * 100 as bias,
           sqrt(avg(power(forecast_qty - actual_qty, 2)) filter (where forecast_qty is not null and actual_qty is not null)) as rmse,
           avg(abs(forecast_qty - actual_qty)) filter (where forecast_qty is not null and actual_qty is not null) as mae
    from tmp_comparison
    group by model_id, model_version, item_id;

  create temporary table tmp_ranked on commit drop as
    with metric_values as (
      select m.*, case v_metric when 'WAPE' then wape when 'MAPE' then mape when 'RMSE' then rmse when 'MAE' then mae end as metric_value,
             case when v_setting.reference_model_id is not null then v_setting.reference_model_id else (select model_id from core.model_config where is_default order by model_id limit 1) end as reference_model_id
      from tmp_metric m
    ), reference_values as (
      select item_id, max(metric_value) filter (where model_id = reference_model_id) as reference_metric
      from metric_values group by item_id
    ), ranked as (
      select v.*, r.reference_metric,
             case when v.metric_value is null then null else dense_rank() over (partition by v.item_id order by v.metric_value asc, abs(coalesce(v.bias, 1e99)) asc, coalesce(v.rmse, 1e99) asc, coalesce(v.mae, 1e99) asc, v.model_id) end::integer as rank
      from metric_values v left join reference_values r using (item_id)
    )
    select *, case when metric_value is null then null when reference_metric is null or reference_metric = 0 then null else (reference_metric - metric_value) / reference_metric * 100 end as baseline_improvement
    from ranked;

  insert into core.model_performance (backtest_run_id, run_id, model_id, model_version, item_id, n_periods, n_compared_periods, wape, mape, bias, rmse, mae, baseline_improvement, rank, metric_value, calculation_status, reason_code)
  select v_backtest_id, p_forecast_run_id, model_id, model_version, item_id, n_periods, n_compared_periods, wape, mape, bias, rmse, mae, baseline_improvement, rank, metric_value,
         case when n_compared_periods = 0 then 'UNAVAILABLE' when n_compared_periods < n_periods then 'PARTIAL' else 'CALCULATED' end,
         case when n_compared_periods = 0 then 'NO_COMPARISON_ROWS' when n_compared_periods < n_periods then 'ACTUAL_OR_FORECAST_MISSING' when wape is null then 'ACTUAL_SUM_ZERO' when mape is null then 'MAPE_DENOMINATOR_ZERO' end
  from tmp_ranked;

  insert into core.champion_model (item_id, backtest_run_id, forecast_run_id, champion_model_id, model_version, champion_metric, champion_metric_value, wape, mape, bias, rmse, mae, candidate_performance, selection_reason, selection_method, selected_by)
  select r.item_id, v_backtest_id, p_forecast_run_id, r.model_id, r.model_version, v_metric, r.metric_value, r.wape, r.mape, r.bias, r.rmse, r.mae,
         (select coalesce(jsonb_agg(to_jsonb(x) order by x.rank nulls last, x.model_id), '[]'::jsonb) from (select model_id, model_version, metric_value, wape, mape, bias, rmse, mae, baseline_improvement, rank, calculation_status, reason_code from tmp_ranked c where c.item_id = r.item_id) x),
         'AUTO: ' || v_metric || ' 최저 유효 성능', 'AUTO', v_actor
  from tmp_ranked r
  where r.rank = 1;

  v_finished := clock_timestamp();
  update core.backtest_run set status = 'SUCCESS', finished_at = v_finished, message = 'Backtest scoring 완료' where backtest_run_id = v_backtest_id;
  return v_backtest_id;
exception when others then
  if v_backtest_id is not null then update core.backtest_run set status = 'FAILED', finished_at = clock_timestamp(), message = sqlerrm where backtest_run_id = v_backtest_id; end if;
  raise;
end;
$$;

create or replace function core.set_manual_champion(p_item_id text, p_model_id text, p_reason text, p_backtest_run_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = core, analytics, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_performance record;
  v_candidate jsonb;
  v_before jsonb;
  v_id uuid;
begin
  if not core.is_admin() then raise exception 'ADMIN 권한이 필요합니다.' using errcode = '42501'; end if;
  if nullif(trim(p_reason), '') is null then raise exception '수동 Champion 변경 사유는 필수입니다.' using errcode = '22023'; end if;
  select mp.*, br.forecast_run_id into v_performance
  from core.model_performance mp join core.backtest_run br using (backtest_run_id)
  where mp.item_id = p_item_id and mp.model_id = p_model_id and (p_backtest_run_id is null or mp.backtest_run_id = p_backtest_run_id)
    and mp.calculation_status <> 'UNAVAILABLE' order by mp.calculated_at desc limit 1;
  if not found then raise exception '선택할 수 있는 성능 결과가 없습니다.' using errcode = '22023'; end if;
  select to_jsonb(c) into v_before from (select champion_model_id, model_version, champion_metric, champion_metric_value, selection_method, selection_reason from core.champion_model where item_id = p_item_id order by selected_at desc limit 1) c;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.rank nulls last, x.model_id), '[]'::jsonb) into v_candidate from (select model_id, model_version, metric_value, wape, mape, bias, rmse, mae, baseline_improvement, rank, calculation_status, reason_code from core.model_performance where item_id = p_item_id and backtest_run_id = v_performance.backtest_run_id) x;
  insert into core.champion_model (item_id, backtest_run_id, forecast_run_id, champion_model_id, model_version, champion_metric, champion_metric_value, wape, mape, bias, rmse, mae, candidate_performance, selection_reason, selection_method, selected_by)
  values (p_item_id, v_performance.backtest_run_id, v_performance.forecast_run_id, p_model_id, v_performance.model_version, (select metric from core.backtest_run where backtest_run_id = v_performance.backtest_run_id), v_performance.metric_value, v_performance.wape, v_performance.mape, v_performance.bias, v_performance.rmse, v_performance.mae, v_candidate, p_reason, 'MANUAL', v_actor) returning champion_id into v_id;
  insert into core.audit_log (actor, action, target_type, target_id, before, after) values (v_actor, 'CHAMPION_MANUAL_UPDATE', 'champion_model', p_item_id, v_before, jsonb_build_object('champion_id', v_id, 'model_id', p_model_id, 'reason', p_reason));
  return v_id;
end;
$$;

create or replace view analytics.v_backtest_run with (security_invoker = true) as select * from core.backtest_run;
create or replace view analytics.v_model_performance with (security_invoker = true) as select * from core.model_performance;
create or replace view analytics.v_champion_model with (security_invoker = true) as
select distinct on (item_id) * from core.champion_model order by item_id, selected_at desc;
create or replace view analytics.v_model_comparison with (security_invoker = true) as
select fr.run_id, fr.model_id, fr.model_name, fr.item_id, fr.period, fr.model_version, fr.predicted_qty, fr.p50, fr.p80, fr.p90, fr.reason_code as forecast_reason_code,
       a.actual_qty, mp.backtest_run_id, mp.wape, mp.mape, mp.bias, mp.rmse, mp.mae, mp.rank, mp.calculation_status, mp.reason_code,
       c.champion_model_id = fr.model_id as is_champion
from analytics.v_forecast_result fr
left join lateral (select sum(qty)::numeric as actual_qty from core.v_test_actual a0 where a0.item_id::text = fr.item_id::text and date_trunc('month', a0.use_date)::date = date_trunc('month', fr.period)::date) a on true
left join lateral (select mp0.* from core.model_performance mp0 where mp0.run_id = fr.run_id and mp0.model_id = fr.model_id and mp0.item_id = fr.item_id order by mp0.calculated_at desc limit 1) mp on true
left join analytics.v_champion_model c on c.item_id = fr.item_id;

alter table core.backtest_run enable row level security;
alter table core.model_performance enable row level security;
alter table core.champion_model enable row level security;
drop policy if exists backtest_run_read_authenticated on core.backtest_run;
create policy backtest_run_read_authenticated on core.backtest_run for select to authenticated using (true);
drop policy if exists model_performance_read_authenticated on core.model_performance;
create policy model_performance_read_authenticated on core.model_performance for select to authenticated using (true);
drop policy if exists champion_model_read_authenticated on core.champion_model;
create policy champion_model_read_authenticated on core.champion_model for select to authenticated using (true);

revoke all on core.backtest_run, core.model_performance, core.champion_model from anon;
revoke all on analytics.v_backtest_run, analytics.v_model_performance, analytics.v_champion_model, analytics.v_model_comparison from anon;
grant usage on schema core, analytics to authenticated;
grant select on analytics.v_backtest_run, analytics.v_model_performance, analytics.v_champion_model, analytics.v_model_comparison to authenticated;
grant execute on function core.run_backtest(uuid, text), core.set_manual_champion(text, text, text, uuid) to authenticated;
