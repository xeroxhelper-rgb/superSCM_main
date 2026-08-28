-- STEP 5: SKU Demand Profile
-- 모든 기간과 통계는 core.v_train_demand 및 core.forecast_setting만 사용한다.

create schema if not exists analytics;

create or replace view analytics.v_sku_demand_profile
with (security_invoker = true)
as
with settings as (
  select train_start, train_end
  from core.forecast_setting
  where setting_id = 1
), periods as (
  select date_trunc('month', month_value)::date as period_start,
         row_number() over (order by month_value)::numeric as period_index
  from settings
  cross join lateral generate_series(
    date_trunc('month', train_start),
    date_trunc('month', train_end),
    interval '1 month'
  ) as months(month_value)
  where train_start is not null and train_end is not null
), items as (
  select distinct item_id::text as item_id,
         item_name::text as item_name
  from core.v_item_master
), grid as (
  select i.item_id, i.item_name, p.period_start, p.period_index
  from items i cross join periods p
), observations as (
  select g.item_id, g.item_name, g.period_start, g.period_index,
         count(t.usage_id)::integer as source_row_count,
         count(t.qty)::integer as nonnull_qty_count,
         sum(t.qty)::numeric as observed_qty
  from grid g
  left join core.v_train_demand t
    on t.item_id::text = g.item_id
   and date_trunc('month', t.use_date)::date = g.period_start
  group by g.item_id, g.item_name, g.period_start, g.period_index
), monthly as (
  select *,
    case when source_row_count = 0 then 0::numeric
         when nonnull_qty_count = 0 then null::numeric
         else observed_qty end as period_qty,
    (source_row_count > 0 and nonnull_qty_count = 0) as has_null_quantity
  from observations
), base_stats as (
  select item_id, max(item_name) as item_name,
         count(*)::integer as n_periods,
         count(*) filter (where period_qty > 0)::integer as n_nonzero_periods,
         count(*) filter (where period_qty = 0)::integer as n_zero_periods,
         count(*) filter (where period_qty is not null)::integer as n_valid_periods,
         count(*) filter (where has_null_quantity)::integer as n_null_periods,
         sum(period_qty) filter (where period_qty > 0)::numeric as positive_total,
         avg(period_qty) filter (where period_qty > 0)::numeric as positive_mean,
         stddev_samp(period_qty) filter (where period_qty > 0)::numeric as positive_stddev,
         regr_slope(period_qty, period_index) filter (where period_qty is not null)::numeric as trend,
         min(period_start) filter (where period_qty > 0) as first_positive_period,
         max(period_start) filter (where period_qty > 0) as last_positive_period
  from monthly
  group by item_id
), recent as (
  select item_id,
         avg(period_qty) filter (where period_index > max_period_index - 3 and period_qty is not null) as recent_mean,
         avg(period_qty) filter (where period_index > max_period_index - 6 and period_index <= max_period_index - 3 and period_qty is not null) as prior_mean,
         count(*) filter (where period_index > max_period_index - 3 and period_qty is not null) as recent_count,
         count(*) filter (where period_index > max_period_index - 6 and period_index <= max_period_index - 3 and period_qty is not null) as prior_count
  from (
    select m.*, max(period_index) over (partition by item_id) as max_period_index
    from monthly m
  ) x
  group by item_id
), peak as (
  select distinct on (item_id) item_id, period_start as peak_period
  from monthly
  where period_qty > 0
  order by item_id, period_qty desc, period_start asc
), month_means as (
  select item_id, extract(month from period_start)::integer as calendar_month,
         avg(period_qty) filter (where period_qty is not null) as month_mean,
         count(*) filter (where period_qty is not null)::integer as month_count
  from monthly
  group by item_id, extract(month from period_start)
), seasonality as (
  select item_id,
         bool_and(month_count >= 2) as all_months_observed,
         avg(month_mean) as overall_month_mean,
         stddev_samp(month_mean) as month_mean_stddev,
         count(*)::integer as calendar_month_count
  from month_means
  group by item_id
), calculated as (
  select b.*, r.recent_mean, r.prior_mean, r.recent_count, r.prior_count,
         p.peak_period, s.all_months_observed, s.overall_month_mean,
         s.month_mean_stddev, s.calendar_month_count,
         b.n_periods::numeric / nullif(b.n_nonzero_periods, 0) as adi,
         b.positive_stddev / nullif(b.positive_mean, 0) as cv,
         b.positive_stddev * b.positive_stddev / nullif(b.positive_mean * b.positive_mean, 0) as cv_squared
  from base_stats b
  left join recent r using (item_id)
  left join peak p using (item_id)
  left join seasonality s using (item_id)
)
select item_id, item_name, n_periods, n_nonzero_periods,
       adi, cv, cv_squared,
       n_zero_periods::numeric / nullif(n_periods, 0) as zero_demand_rate,
       trend,
       case when recent_count = 3 and prior_count = 3 and prior_mean <> 0
            then (recent_mean - prior_mean) / prior_mean end as recent_change_rate,
       peak_period,
       case
         when adi is null or cv_squared is null then null
         when adi < 1.32 and cv_squared < 0.49 then 'SMOOTH'
         when adi >= 1.32 and cv_squared < 0.49 then 'INTERMITTENT'
         when adi < 1.32 and cv_squared >= 0.49 then 'ERRATIC'
         else 'LUMPY'
       end as demand_type,
       case
         when n_periods < 24 then null
         when not coalesce(all_months_observed, false) then null
         when overall_month_mean = 0 then null
         else (month_mean_stddev / nullif(overall_month_mean, 0) >= 0.10)
       end as seasonality,
       case
         when n_nonzero_periods = 0 then 'NO_POSITIVE_DEMAND'
         when n_null_periods > 0 then 'NULL_QUANTITY'
         when n_nonzero_periods < 2 then 'INSUFFICIENT_NONZERO_PERIODS'
         when positive_mean = 0 then 'ZERO_POSITIVE_MEAN'
         when n_periods < 2 then 'INSUFFICIENT_PERIODS'
         when recent_count < 3 or prior_count < 3 then 'INSUFFICIENT_RECENT_PERIODS'
         when prior_mean = 0 then 'ZERO_PRIOR_MEAN'
         when n_periods < 24 then 'INSUFFICIENT_PERIODS'
         when not coalesce(all_months_observed, false) then 'INSUFFICIENT_SEASONAL_DATA'
         when overall_month_mean = 0 then 'ZERO_OVERALL_MEAN'
         else null
       end as reason_code,
       case when cv_squared is null then null
            when cv_squared < 0.49 then 'STABLE'
            else 'VARIABLE' end as stability
from calculated;

create or replace view analytics.v_demand_profile_kpi
with (security_invoker = true)
as
select count(*)::integer as total_items,
       count(*) filter (where demand_type = 'SMOOTH')::integer as n_smooth,
       count(*) filter (where demand_type = 'INTERMITTENT')::integer as n_intermittent,
       count(*) filter (where demand_type = 'ERRATIC')::integer as n_erratic,
       count(*) filter (where demand_type = 'LUMPY')::integer as n_lumpy,
       count(*) filter (where demand_type in ('INTERMITTENT', 'LUMPY'))::integer as n_croston_needed,
       count(*) filter (where demand_type is null)::integer as n_calculation_unavailable
from analytics.v_sku_demand_profile;

revoke all on analytics.v_sku_demand_profile, analytics.v_demand_profile_kpi from anon;
grant select on analytics.v_sku_demand_profile, analytics.v_demand_profile_kpi to authenticated;
