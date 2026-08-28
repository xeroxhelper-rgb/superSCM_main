-- STEP 9: Lead Time 정책화와 Forecast 기반 Inventory Projection
-- 모든 수치 계산은 DB에서 수행한다. 화면에서는 analytics View 결과만 조회한다.

create schema if not exists core;
create schema if not exists analytics;

alter table if exists core.leadtime_plan add column if not exists effective_from date;
alter table if exists core.leadtime_plan add column if not exists changed_by uuid references auth.users(id) on delete set null;

create table if not exists core.leadtime_policy_history (
  history_id bigint generated always as identity primary key,
  supplier_id text not null,
  previous_lead_time integer,
  next_lead_time integer,
  effective_from date not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text not null,
  changed_at timestamptz not null default now()
);

comment on table core.leadtime_policy_history is '관리자 확정 Lead Time 변경 이력. 삭제하지 않고 append-only로 보존한다.';
comment on column core.leadtime_policy_history.next_lead_time is '일 단위 관리자 확정 Lead Time. null이 아니면 실적 P80보다 우선한다.';
comment on table core.leadtime_policy_history is '표본 부족으로 P80을 산출할 수 없는 경우에는 INSUFFICIENT_SAMPLE을 보존하고 임의 Lead Time을 만들지 않는다.';

insert into core.policy_config (policy_key, config_value_text, description, active)
values ('CONFIRMED_ORDER_DEMAND_MODE', 'ADDITIVE_COMMITTED', '확정수주를 Forecast와 별도 차감할지 결정하는 Projection 정책', true)
on conflict (policy_key) do nothing;

create or replace view core.v_effective_lead_time as
select
  coalesce(lp.supplier_id, lg.supplier_id) as supplier_id,
  lg.supplier_name,
  lg.country,
  lg.p50_days,
  lg.p80_days,
  lg.p90_days,
  lp.planned_lead_time as confirmed_lead_time,
  coalesce(lp.planned_lead_time, lg.p80_days)::integer as effective_lead_time,
  case when lp.planned_lead_time is not null then 'ADMIN_CONFIRMED' when lg.p80_days is not null then 'ACTUAL_P80' end as effective_source,
  lp.effective_from,
  lp.changed_by,
  case when coalesce(lp.planned_lead_time, lg.p80_days) is null then 'NO_LEADTIME' end as reason_code
from analytics.v_leadtime_gap lg
full join core.leadtime_plan lp on lp.supplier_id = lg.supplier_id;

create or replace view analytics.v_leadtime_policy as
select
  e.supplier_id,
  e.supplier_name,
  e.country,
  e.p50_days,
  e.p80_days,
  e.p90_days,
  e.confirmed_lead_time,
  e.effective_lead_time,
  e.effective_source,
  e.effective_from,
  e.changed_by,
  e.reason_code
from core.v_effective_lead_time e;

create or replace view analytics.v_leadtime_policy_history as
select history_id, supplier_id, previous_lead_time, next_lead_time, effective_from, changed_by, reason, changed_at
from core.leadtime_policy_history;

-- Forecast 결과가 없는 SKU는 Projection 행을 만들 수 없으므로 Risk View에서 별도로 계산 불가로 표시한다.
create or replace view core.v_inventory_projection as
with recursive
settings as (
  select
    granularity,
    (select config_value_text from core.policy_config where policy_key = 'CONFIRMED_ORDER_DEMAND_MODE' and active) as order_mode
  from core.forecast_setting
  where setting_id = 1
),
latest_champion as (
  select distinct on (item_id)
    item_id, champion_model_id, forecast_run_id, model_version
  from core.champion_model
  order by item_id, selected_at desc, champion_id desc
),
forecast_rows as (
  select
    fr.item_id,
    fr.period,
    sum(fr.predicted_qty)::numeric as forecast_demand,
    count(*)::integer as forecast_row_count
  from analytics.v_forecast_result fr
  join latest_champion c
    on c.item_id = fr.item_id
   and c.champion_model_id = fr.model_id
   and c.forecast_run_id = fr.run_id
  group by fr.item_id, fr.period
),
inventory_latest as (
  select
    i."품목코드"::text as item_id,
    sum(i."현재고"::numeric) as available_inventory,
    max(i."기준일자"::date) as inventory_as_of
  from raw.inventory i
  where i."기준일자" is not null
  group by i."품목코드"
),
receipt_by_period as (
  select
    po."품목코드"::text as item_id,
    case when s.granularity = 'MONTH' then date_trunc('month', po."납기예정일"::date)::date
         when s.granularity = 'WEEK' then date_trunc('week', po."납기예정일"::date)::date
         else po."납기예정일"::date end as period,
    sum(po."발주수량"::numeric) as scheduled_receipt,
    count(*)::integer as receipt_row_count
  from raw.purchase_order po cross join settings s
  where po."납기예정일" is not null
  group by po."품목코드", 2
),
confirmed_orders as (
  select
    so.item_id::text,
    case when s.granularity = 'MONTH' then date_trunc('month', coalesce(so.requested_date, so.order_date))::date
         when s.granularity = 'WEEK' then date_trunc('week', coalesce(so.requested_date, so.order_date))::date
         else coalesce(so.requested_date, so.order_date) end as period,
    sum(so.quantity::numeric) as confirmed_sales_order,
    count(*)::integer as sales_order_row_count
  from raw.sales_order so cross join settings s
  where upper(coalesce(so.status, '')) in ('CONFIRMED', '확정', 'CONFIRM')
  group by so.item_id, 2
),
soft_allocations as (
  select
    be.item_id::text,
    case when s.granularity = 'MONTH' then date_trunc('month', be.event_date)::date
         when s.granularity = 'WEEK' then date_trunc('week', be.event_date)::date
         else be.event_date end as period,
    sum(be.quantity::numeric) as soft_allocation,
    count(*)::integer as soft_allocation_row_count
  from raw.business_event be cross join settings s
  where upper(replace(coalesce(be.event_type, ''), ' ', '_')) in ('SOFT_ALLOCATION', 'SOFT_ALLOC', '가예약')
  group by be.item_id, 2
),
period_rows as (
  select
    f.item_id,
    f.period,
    row_number() over (partition by f.item_id order by f.period)::integer as period_no,
    case when s.order_mode = 'EXCLUSIVE' and o.sales_order_row_count is not null then 0 else f.forecast_demand end as forecast_demand,
    f.forecast_row_count,
    coalesce(r.scheduled_receipt, 0)::numeric as scheduled_receipt,
    coalesce(o.confirmed_sales_order, 0)::numeric as confirmed_sales_order,
    coalesce(a.soft_allocation, 0)::numeric as soft_allocation,
    (r.receipt_row_count is not null) as receipt_data_present,
    (o.sales_order_row_count is not null) as sales_order_data_present,
    (a.soft_allocation_row_count is not null) as soft_allocation_data_present,
    (i.available_inventory is not null) as inventory_data_present,
    i.available_inventory,
    i.inventory_as_of
  from forecast_rows f
  cross join settings s
  left join receipt_by_period r using (item_id, period)
  left join confirmed_orders o using (item_id, period)
  left join soft_allocations a using (item_id, period)
  left join inventory_latest i using (item_id)
),
projection as (
  select
    p.item_id,
    p.period,
    p.period_no,
    p.available_inventory as beginning_inventory,
    p.scheduled_receipt,
    p.confirmed_sales_order,
    p.soft_allocation,
    p.forecast_demand,
    case when p.available_inventory is null then null
         else p.available_inventory + p.scheduled_receipt - p.confirmed_sales_order - p.soft_allocation - p.forecast_demand end as ending_projected_inventory,
    p.forecast_row_count,
    p.receipt_data_present,
    p.sales_order_data_present,
    p.soft_allocation_data_present,
    p.available_inventory is not null as inventory_data_present,
    p.inventory_as_of
  from period_rows p
  where p.period_no = 1

  union all

  select
    current_row.item_id,
    current_row.period,
    current_row.period_no,
    previous_row.ending_projected_inventory as beginning_inventory,
    current_row.scheduled_receipt,
    current_row.confirmed_sales_order,
    current_row.soft_allocation,
    current_row.forecast_demand,
    case when previous_row.ending_projected_inventory is null then null
         else previous_row.ending_projected_inventory + current_row.scheduled_receipt - current_row.confirmed_sales_order - current_row.soft_allocation - current_row.forecast_demand end,
    current_row.forecast_row_count,
    current_row.receipt_data_present,
    current_row.sales_order_data_present,
    current_row.soft_allocation_data_present,
    current_row.inventory_data_present,
    current_row.inventory_as_of
  from projection previous_row
  join period_rows current_row
    on current_row.item_id = previous_row.item_id
   and current_row.period_no = previous_row.period_no + 1
)
select
  p.item_id,
  im."품목명"::text as item_name,
  im.supplier_id::text as supplier_id,
  p.period,
  p.period_no,
  p.beginning_inventory,
  p.scheduled_receipt,
  p.confirmed_sales_order,
  p.soft_allocation,
  p.forecast_demand,
  p.ending_projected_inventory,
  p.inventory_data_present,
  p.receipt_data_present,
  p.sales_order_data_present,
  p.soft_allocation_data_present,
  case when not p.inventory_data_present then 'NO_INVENTORY_DATA'
       when p.forecast_row_count = 0 then 'NO_FORECAST' end as reason_code,
  p.inventory_as_of
from projection p
left join raw.item_master im on im."품목코드"::text = p.item_id;

create or replace view analytics.v_inventory_projection as
select
  item_id,
  item_name,
  supplier_id,
  period,
  period_no,
  beginning_inventory,
  scheduled_receipt,
  confirmed_sales_order,
  soft_allocation,
  forecast_demand,
  ending_projected_inventory,
  inventory_data_present,
  receipt_data_present,
  sales_order_data_present,
  soft_allocation_data_present,
  reason_code,
  inventory_as_of
from core.v_inventory_projection;

drop view if exists analytics.v_stockout_kpi;
drop view if exists analytics.v_stockout_risk;

create view analytics.v_stockout_risk as
with items as (
  select distinct
    im."품목코드"::text as item_id,
    im."품목명"::text as item_name,
    im.supplier_id::text as supplier_id
  from raw.item_master im
),
projection_summary as (
  select
    p.item_id,
    max(p.item_name) as item_name,
    max(p.supplier_id) as supplier_id,
    min(p.beginning_inventory) filter (where p.period_no = 1) as current_stock,
    sum(p.scheduled_receipt) as inbound_qty,
    count(*)::integer as projection_periods,
    min(p.period) filter (where p.ending_projected_inventory <= 0) as stockout_period,
    min(p.period_no) filter (where p.ending_projected_inventory <= 0) as stockout_period_no,
    bool_or(p.inventory_data_present) as inventory_data_present,
    bool_and(p.forecast_demand is not null) as forecast_data_present,
    bool_or(p.soft_allocation_data_present) as soft_allocation_data_present,
    sum(p.confirmed_sales_order) as confirmed_sales_order,
    sum(p.soft_allocation) as soft_allocation,
    sum(p.forecast_demand) as forecast_demand
  from analytics.v_inventory_projection p
  group by p.item_id
),
leadtime as (
  select supplier_id, effective_lead_time, effective_source, reason_code
  from core.v_effective_lead_time
),
summary as (
  select
    i.item_id,
    i.item_name,
    i.supplier_id,
    p.current_stock,
    p.inbound_qty,
    case when p.current_stock is null then null else p.current_stock + p.inbound_qty end as available_qty,
    l.effective_lead_time as planned_lead_time,
    l.effective_source,
    p.stockout_period,
    p.stockout_period_no,
    p.projection_periods,
    p.inventory_data_present,
    p.forecast_data_present,
    p.soft_allocation_data_present,
    p.confirmed_sales_order,
    p.soft_allocation,
    p.forecast_demand,
    l.reason_code as leadtime_reason_code
  from items i
  left join projection_summary p using (item_id)
  left join leadtime l on l.supplier_id = i.supplier_id
)
select
  s.item_id,
  s.item_name,
  s.supplier_id,
  s.current_stock,
  s.inbound_qty,
  s.available_qty,
  s.planned_lead_time,
  s.stockout_period,
  s.stockout_period as stockout_date,
  case when s.inventory_data_present is distinct from true then 'CALCULATION_UNAVAILABLE'
       when s.forecast_data_present is distinct from true then 'CALCULATION_UNAVAILABLE'
       when s.planned_lead_time is null then 'CALCULATION_UNAVAILABLE'
       when s.stockout_period is null then 'SAFE'
       when (s.stockout_period - current_date) <= s.planned_lead_time then 'CRITICAL'
       else 'WARNING' end as risk_status,
  case when s.inventory_data_present is distinct from true then 'NO_INVENTORY_DATA'
       when s.forecast_data_present is distinct from true then 'NO_FORECAST'
       when s.planned_lead_time is null then coalesce(s.leadtime_reason_code, 'NO_LEADTIME') end as reason_code,
  case when s.stockout_period is null or s.current_stock is null then null
       else greatest(0, s.stockout_period - current_date)::numeric end as days_of_supply,
  case when s.stockout_period is null or s.current_stock is null then null
       else greatest(0, s.stockout_period - current_date)::numeric / 30 end as months_of_supply,
  s.effective_source,
  s.projection_periods,
  s.soft_allocation_data_present,
  s.confirmed_sales_order,
  s.soft_allocation,
  s.forecast_demand
from summary s;

create or replace view analytics.v_stockout_kpi as
select
  count(*)::integer as n_items,
  count(*) filter (where risk_status = 'CRITICAL')::integer as n_critical,
  count(*) filter (where risk_status = 'WARNING')::integer as n_warning,
  count(*) filter (where risk_status = 'SAFE')::integer as n_safe,
  count(*) filter (where risk_status = 'CALCULATION_UNAVAILABLE')::integer as n_calculation_unavailable,
  count(*) filter (where stockout_period is not null)::integer as n_with_stockout,
  avg(days_of_supply) filter (where days_of_supply is not null) as avg_stockout_days
from analytics.v_stockout_risk;

create or replace function core.admin_set_leadtime(
  p_supplier_id text,
  p_next_lead_time integer,
  p_effective_from date,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = core, public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  previous_value integer;
begin
  if not core.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_supplier_id is null or trim(p_supplier_id) = '' then raise exception 'SUPPLIER_REQUIRED'; end if;
  if p_next_lead_time is null or p_next_lead_time < 0 then raise exception 'INVALID_LEADTIME'; end if;
  if p_effective_from is null then raise exception 'EFFECTIVE_DATE_REQUIRED'; end if;
  if p_reason is null or trim(p_reason) = '' then raise exception 'REASON_REQUIRED'; end if;

  select planned_lead_time into previous_value from core.leadtime_plan where supplier_id = p_supplier_id for update;
  insert into core.leadtime_policy_history(supplier_id, previous_lead_time, next_lead_time, effective_from, changed_by, reason)
  values (p_supplier_id, previous_value, p_next_lead_time, p_effective_from, actor, trim(p_reason));
  insert into core.leadtime_plan(supplier_id, planned_lead_time, basis, confirmed_reason, confirmed_at, effective_from, changed_by)
  values (p_supplier_id, p_next_lead_time, 'ADMIN_CONFIRMED', trim(p_reason), now(), p_effective_from, actor)
  on conflict (supplier_id) do update set planned_lead_time = excluded.planned_lead_time, basis = excluded.basis, confirmed_reason = excluded.confirmed_reason, confirmed_at = excluded.confirmed_at, effective_from = excluded.effective_from, changed_by = excluded.changed_by;
  insert into core.audit_log(actor, action, target_type, target_id, before, after)
  values (actor, 'LEADTIME_POLICY_CHANGED', 'SUPPLIER', p_supplier_id, jsonb_build_object('planned_lead_time', previous_value), jsonb_build_object('planned_lead_time', p_next_lead_time, 'effective_from', p_effective_from, 'reason', trim(p_reason)));
end;
$$;

alter table core.leadtime_policy_history enable row level security;
revoke all on core.leadtime_policy_history from anon, authenticated;
grant select on analytics.v_leadtime_policy, analytics.v_leadtime_policy_history, analytics.v_inventory_projection, analytics.v_stockout_risk, analytics.v_stockout_kpi to authenticated;
grant usage on schema core, analytics to authenticated;
grant execute on function core.admin_set_leadtime(text, integer, date, text) to authenticated;

drop policy if exists leadtime_policy_history_admin_read on core.leadtime_policy_history;
create policy leadtime_policy_history_admin_read on core.leadtime_policy_history for select to authenticated using (core.is_admin());
