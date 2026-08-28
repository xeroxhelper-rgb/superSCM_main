-- STEP 6: Forecast Engine - SQL Baseline
-- Forecast 계산은 core.v_train_demand에서 만든 학습 Grid만 사용한다.

create schema if not exists core;
create schema if not exists analytics;

alter table if exists core.forecast_setting add column if not exists forecast_horizon integer not null default 6;
do $$ begin
  alter table core.forecast_setting add constraint forecast_setting_horizon_check check (forecast_horizon >= 0);
exception when duplicate_object then null;
end $$;

create table if not exists core.model_config (
  model_id text primary key,
  model_name text not null,
  family text not null,
  engine text not null default 'SQL' check (engine = 'SQL'),
  version text not null,
  enabled boolean not null default true,
  is_default boolean not null default false,
  applicable_demand_type text[] not null default array['SMOOTH','INTERMITTENT','ERRATIC','LUMPY']::text[],
  parameters jsonb not null default '{}'::jsonb,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists core.model_version (
  model_version_id uuid primary key default gen_random_uuid(),
  model_id text not null references core.model_config(model_id),
  version text not null,
  definition jsonb not null,
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists core.forecast_run (
  run_id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('RUNNING','SUCCESS','FAILED')),
  granularity text not null check (granularity in ('DAY','WEEK','MONTH')),
  train_start date,
  train_end date,
  horizon integer not null check (horizon >= 0),
  champion_metric text,
  data_snapshot_at timestamptz,
  models jsonb not null default '[]'::jsonb,
  n_models integer not null default 0 check (n_models >= 0),
  n_items integer not null default 0 check (n_items >= 0),
  n_rows integer not null default 0 check (n_rows >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms bigint,
  triggered_by uuid references auth.users(id) on delete set null,
  triggered_email text,
  note text,
  message text
);

create table if not exists core.forecast_result (
  run_id uuid not null references core.forecast_run(run_id) on delete restrict,
  model_id text not null references core.model_config(model_id),
  item_id text not null,
  period date not null,
  model_version uuid not null references core.model_version(model_version_id),
  predicted_qty numeric,
  p50 numeric,
  p80 numeric,
  p90 numeric,
  sigma numeric,
  basis text,
  reason_code text,
  created_at timestamptz not null default now(),
  primary key (run_id, model_id, item_id, period)
);

create index if not exists forecast_result_run_idx on core.forecast_result(run_id);
create index if not exists forecast_result_lookup_idx on core.forecast_result(model_id, item_id, period);
create index if not exists model_version_lookup_idx on core.model_version(model_id, created_at desc);

insert into core.model_config (model_id, model_name, family, engine, version, enabled, is_default, applicable_demand_type, parameters, description)
values
  ('MA_3M', '3개월 이동평균', 'MOVING_AVERAGE', 'SQL', '1.0.0', true, true, array['SMOOTH','INTERMITTENT','ERRATIC','LUMPY'], '{"window":3}'::jsonb, '직전 3개월 평균'),
  ('MA_6M', '6개월 이동평균', 'MOVING_AVERAGE', 'SQL', '1.0.0', true, false, array['SMOOTH','INTERMITTENT','ERRATIC','LUMPY'], '{"window":6}'::jsonb, '직전 6개월 평균'),
  ('WMA_3M', '3개월 가중 이동평균', 'WEIGHTED_MOVING_AVERAGE', 'SQL', '1.0.0', true, false, array['SMOOTH','INTERMITTENT','ERRATIC','LUMPY'], '{"weights":[1,2,3],"order":"oldest_to_recent"}'::jsonb, '최근순 3:2:1 가중평균'),
  ('PY_SAME_MONTH', '전년 동월', 'SEASONAL_NAIVE', 'SQL', '1.0.0', true, false, array['SMOOTH','INTERMITTENT','ERRATIC','LUMPY'], '{"lag_months":12}'::jsonb, '12개월 전 같은 월'),
  ('SEASONAL_NAIVE', '계절적 나이브', 'SEASONAL_NAIVE', 'SQL', '1.0.0', true, false, array['SMOOTH','INTERMITTENT','ERRATIC','LUMPY'], '{"lag_months":12}'::jsonb, '설정 lag_months의 같은 월')
on conflict (model_id) do nothing;

create or replace function core.run_baseline_forecast()
returns uuid
language plpgsql
security definer
set search_path = core, analytics, pg_temp
as $$
declare
  v_run_id uuid;
  v_actor uuid := auth.uid();
  v_email text := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'email', '');
  v_started timestamptz := clock_timestamp();
  v_snapshot timestamptz := clock_timestamp();
  v_train_start date;
  v_train_end date;
  v_horizon integer;
  v_granularity text;
  v_model_count integer := 0;
  v_item_count integer := 0;
  v_result_count integer := 0;
  v_model record;
  v_version_id uuid;
  v_finished timestamptz;
begin
  if not core.is_admin() then
    raise exception 'ADMIN 권한이 필요합니다.' using errcode = '42501';
  end if;

  select train_start, train_end, coalesce(forecast_horizon, 6), granularity
    into v_train_start, v_train_end, v_horizon, v_granularity
  from core.forecast_setting
  where setting_id = 1;

  if v_train_start is null or v_train_end is null then
    raise exception 'Forecast 학습 기간이 설정되지 않았습니다.' using errcode = '22023';
  end if;

  insert into core.forecast_run (status, granularity, train_start, train_end, horizon, data_snapshot_at, triggered_by, triggered_email, started_at, message)
  values ('RUNNING', v_granularity, v_train_start, v_train_end, v_horizon, v_snapshot, v_actor, v_email, v_started, 'SQL Baseline 실행 중')
  returning run_id into v_run_id;

  create temporary table tmp_models on commit drop as
  select * from core.model_config where enabled and engine = 'SQL';

  create temporary table tmp_model_versions (model_id text primary key, version_id uuid, version text) on commit drop;
  for v_model in select * from tmp_models order by model_id loop
    insert into core.model_version (model_id, version, definition, parameters, created_by)
    values (v_model.model_id, v_model.version,
      jsonb_build_object('model_id', v_model.model_id, 'model_name', v_model.model_name, 'family', v_model.family, 'engine', v_model.engine, 'applicable_demand_type', v_model.applicable_demand_type, 'description', v_model.description),
      v_model.parameters, v_actor)
    returning model_version_id into v_version_id;
    insert into tmp_model_versions values (v_model.model_id, v_version_id, v_model.version);
  end loop;
  select count(*) into v_model_count from tmp_models;

  create temporary table tmp_train on commit drop as
  with periods as (
    select date_trunc('month', value)::date as period
    from generate_series(date_trunc('month', v_train_start), date_trunc('month', v_train_end), interval '1 month') value
  ), items as (
    select item_id::text, max(item_name)::text as item_name, max(demand_type)::text as demand_type
    from analytics.v_sku_demand_profile group by item_id
  ), observed as (
    select item_id::text, date_trunc('month', use_date)::date as period,
           case when count(qty) = 0 then null::numeric else sum(qty) end as qty
    from core.v_train_demand
    group by item_id::text, date_trunc('month', use_date)::date
  )
  select i.item_id, i.item_name, i.demand_type, p.period, o.qty
  from items i cross join periods p left join observed o using (item_id, period);

  select count(distinct item_id) into v_item_count from tmp_train;
  create temporary table tmp_fit (model_id text, item_id text, period date, actual_qty numeric, fitted_qty numeric, reason_code text) on commit drop;
  insert into tmp_fit
  select m.model_id, t.item_id, t.period, t.qty,
    case
      when m.model_id = 'MA_3M' and (select count(*) from tmp_train h where h.item_id=t.item_id and h.period < t.period and h.period >= t.period - interval '3 months' and h.qty is not null) = 3 then (select avg(h.qty) from tmp_train h where h.item_id=t.item_id and h.period < t.period and h.period >= t.period - interval '3 months')
      when m.model_id = 'MA_6M' and (select count(*) from tmp_train h where h.item_id=t.item_id and h.period < t.period and h.period >= t.period - interval '6 months' and h.qty is not null) = 6 then (select avg(h.qty) from tmp_train h where h.item_id=t.item_id and h.period < t.period and h.period >= t.period - interval '6 months')
      when m.model_id = 'WMA_3M' and (select count(*) from tmp_train h where h.item_id=t.item_id and h.period < t.period and h.period >= t.period - interval '3 months' and h.qty is not null) = 3 then (select sum(h.qty * case when h.period = t.period - interval '3 months' then 1 when h.period = t.period - interval '2 months' then 2 else 3 end) / 6 from tmp_train h where h.item_id=t.item_id and h.period < t.period and h.period >= t.period - interval '3 months')
      when m.model_id in ('PY_SAME_MONTH','SEASONAL_NAIVE') and (select h.qty from tmp_train h where h.item_id=t.item_id and h.period = t.period - interval '12 months') is not null then (select h.qty from tmp_train h where h.item_id=t.item_id and h.period = t.period - interval '12 months')
    end,
    case when t.qty is null then 'NULL_TRAIN_INPUT'
         when m.model_id in ('MA_3M','WMA_3M') and (select count(*) from tmp_train h where h.item_id=t.item_id and h.period < t.period and h.period >= t.period - interval '3 months' and h.qty is not null) < 3 then 'INSUFFICIENT_HISTORY'
         when m.model_id = 'MA_6M' and (select count(*) from tmp_train h where h.item_id=t.item_id and h.period < t.period and h.period >= t.period - interval '6 months' and h.qty is not null) < 6 then 'INSUFFICIENT_HISTORY'
         when m.model_id in ('PY_SAME_MONTH','SEASONAL_NAIVE') and not exists (select 1 from tmp_train h where h.item_id=t.item_id and h.period = t.period - interval '12 months' and h.qty is not null) then 'INSUFFICIENT_HISTORY'
    end
  from tmp_models m cross join tmp_train t
  where coalesce(array_length(m.applicable_demand_type, 1), 0) = 0 or t.demand_type = any(m.applicable_demand_type);

  create temporary table tmp_sigma on commit drop as
  select model_id, item_id, stddev_samp(actual_qty - fitted_qty) as sigma
  from tmp_fit where actual_qty is not null and fitted_qty is not null group by model_id, item_id;

  insert into core.forecast_result (run_id, model_id, item_id, period, model_version, predicted_qty, p50, p80, p90, sigma, basis, reason_code)
  select v_run_id, m.model_id, t.item_id, f.period, mv.version_id,
         f.point_forecast, f.point_forecast,
         case when s.sigma is null or f.point_forecast is null then null else f.point_forecast + 0.841621 * s.sigma end,
         case when s.sigma is null or f.point_forecast is null then null else f.point_forecast + 1.281552 * s.sigma end,
         s.sigma, m.model_id || ':SQL_BASELINE',
         case when f.point_forecast is null then coalesce(f.reason_code, 'INSUFFICIENT_HISTORY') when s.sigma is null then 'SIGMA_UNAVAILABLE' end
  from tmp_models m
  join tmp_model_versions mv using (model_id)
  cross join (select distinct item_id, demand_type from tmp_train) t
  cross join lateral (
    select p.period,
      case
        when m.model_id = 'MA_3M' and (select count(*) from tmp_train h where h.item_id=t.item_id and h.period < p.period and h.qty is not null and h.period >= p.period - interval '3 months') = 3 then (select avg(h.qty) from tmp_train h where h.item_id=t.item_id and h.period < p.period and h.qty is not null and h.period >= p.period - interval '3 months')
        when m.model_id = 'MA_6M' and (select count(*) from tmp_train h where h.item_id=t.item_id and h.period < p.period and h.qty is not null and h.period >= p.period - interval '6 months') = 6 then (select avg(h.qty) from tmp_train h where h.item_id=t.item_id and h.period < p.period and h.qty is not null and h.period >= p.period - interval '6 months')
        when m.model_id = 'WMA_3M' and (select count(*) from tmp_train h where h.item_id=t.item_id and h.period < p.period and h.qty is not null and h.period >= p.period - interval '3 months') = 3 then (select sum(h.qty * case when h.period = p.period - interval '3 months' then 1 when h.period = p.period - interval '2 months' then 2 else 3 end) / 6 from tmp_train h where h.item_id=t.item_id and h.period < p.period and h.qty is not null and h.period >= p.period - interval '3 months')
        when m.model_id in ('PY_SAME_MONTH','SEASONAL_NAIVE') then (select h.qty from tmp_train h where h.item_id=t.item_id and h.period = p.period - interval '12 months')
      end as point_forecast,
      case when m.model_id in ('MA_3M','WMA_3M') and (select count(*) from tmp_train h where h.item_id=t.item_id and h.period < p.period and h.qty is not null and h.period >= p.period - interval '3 months') < 3 then 'INSUFFICIENT_HISTORY' when m.model_id = 'MA_6M' and (select count(*) from tmp_train h where h.item_id=t.item_id and h.period < p.period and h.qty is not null and h.period >= p.period - interval '6 months') < 6 then 'INSUFFICIENT_HISTORY' when m.model_id in ('PY_SAME_MONTH','SEASONAL_NAIVE') and not exists (select 1 from tmp_train h where h.item_id=t.item_id and h.period = p.period - interval '12 months' and h.qty is not null) then 'INSUFFICIENT_HISTORY' end as reason_code
    from generate_series(date_trunc('month', v_train_end) + interval '1 month', date_trunc('month', v_train_end) + (v_horizon || ' months')::interval, interval '1 month') p(period)
  ) f
  left join tmp_sigma s on s.model_id=m.model_id and s.item_id=t.item_id
  where t.demand_type = any(m.applicable_demand_type);

  get diagnostics v_result_count = row_count;
  v_finished := clock_timestamp();
  update core.forecast_run set status='SUCCESS', models=(select coalesce(jsonb_agg(jsonb_build_object('model_id', model_id, 'version', version) order by model_id), '[]'::jsonb) from tmp_model_versions), n_models=v_model_count, n_items=v_item_count, n_rows=v_result_count, finished_at=v_finished, duration_ms=extract(epoch from (v_finished-v_started))*1000, message='SQL Baseline 실행 완료' where run_id=v_run_id;
  return v_run_id;
exception when others then
  if v_run_id is not null then
    update core.forecast_run set status='FAILED', finished_at=clock_timestamp(), duration_ms=extract(epoch from (clock_timestamp()-v_started))*1000, message=sqlerrm where run_id=v_run_id;
  end if;
  raise;
end;
$$;

create or replace view analytics.v_model_config with (security_invoker = true) as
select model_id, model_name, family, engine, version, enabled, is_default, applicable_demand_type, parameters, description, updated_at, updated_by
from core.model_config;

create or replace view analytics.v_forecast_run with (security_invoker = true) as
with source_state as (
  select max(loaded_at) as max_loaded_at, count(*)::bigint as source_row_count from core.v_train_demand
)
select r.*, (source_state.max_loaded_at is null or r.data_snapshot_at is null) as stale_comparison_unavailable,
       case when source_state.max_loaded_at is null or r.data_snapshot_at is null then null else source_state.max_loaded_at > r.data_snapshot_at end as is_stale,
       case when source_state.max_loaded_at is null or r.data_snapshot_at is null then 'SNAPSHOT_UNAVAILABLE' when source_state.max_loaded_at > r.data_snapshot_at then 'TRAIN_SOURCE_CHANGED' else null end as stale_reason
from core.forecast_run r cross join source_state;

create or replace view analytics.v_forecast_result with (security_invoker = true) as
select fr.run_id, fr.model_id, mc.model_name, fr.item_id, fr.period, fr.model_version,
       fr.predicted_qty, fr.p50, fr.p80, fr.p90, fr.sigma, fr.basis, fr.reason_code, fr.created_at
from core.forecast_result fr join core.model_config mc using (model_id);

create or replace view analytics.v_forecast_run_kpi with (security_invoker = true) as
select run_id, status, n_models, n_items, n_rows, count(*) filter (where reason_code is not null)::integer as n_unavailable
from analytics.v_forecast_run r left join core.forecast_result fr using (run_id)
group by run_id, status, n_models, n_items, n_rows;

alter table core.model_config enable row level security;
alter table core.model_version enable row level security;
alter table core.forecast_run enable row level security;
alter table core.forecast_result enable row level security;

drop policy if exists model_config_read_authenticated on core.model_config;
create policy model_config_read_authenticated on core.model_config for select to authenticated using (true);
drop policy if exists model_config_admin_mutation on core.model_config;
create policy model_config_admin_mutation on core.model_config for all to authenticated using (core.is_admin()) with check (core.is_admin());
drop policy if exists forecast_run_read_authenticated on core.forecast_run;
create policy forecast_run_read_authenticated on core.forecast_run for select to authenticated using (true);
drop policy if exists forecast_result_read_authenticated on core.forecast_result;
create policy forecast_result_read_authenticated on core.forecast_result for select to authenticated using (true);

revoke all on core.model_config, core.model_version, core.forecast_run, core.forecast_result from anon;
revoke all on analytics.v_model_config, analytics.v_forecast_run, analytics.v_forecast_result, analytics.v_forecast_run_kpi from anon;
grant usage on schema core, analytics to authenticated;
grant select on analytics.v_model_config, analytics.v_forecast_run, analytics.v_forecast_result, analytics.v_forecast_run_kpi to authenticated;
grant execute on function core.run_baseline_forecast() to authenticated;
