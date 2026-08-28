-- STEP 10: Safety Stock 및 Purchase Recommendation
-- 수치 계산은 DB에서 수행하며 화면은 analytics View만 조회한다.

create schema if not exists analytics;

insert into core.policy_config (policy_key, safety_buffer_days, description, active)
values ('SAFETY_BUFFER_DAYS', 0, '발주권고일 계산에 더하는 안전 버퍼 일수', true)
on conflict (policy_key) do nothing;

-- SERVICE_LEVEL_<GRADE>와 Z_VALUE_<GRADE>의 값은 관리자가 정책 테이블에서 입력한다.
create or replace view analytics.v_safety_stock with (security_invoker = true) as
with
policy as (
  select
    max(safety_buffer_days) filter (where policy_key = 'SAFETY_BUFFER_DAYS' and active) as safety_buffer_days,
    max(config_value_numeric) filter (where policy_key = 'Z_VALUE_DEFAULT' and active) as default_z_value,
    max(service_level) filter (where policy_key = 'SERVICE_LEVEL_DEFAULT' and active) as default_service_level
  from core.policy_config
),
items as (
  select distinct on (im."품목코드"::text)
    im."품목코드"::text as item_id,
    im."품목명"::text as item_name,
    im.supplier_id::text as supplier_id
  from raw.item_master im
  order by im."품목코드"::text, im."품목명" nulls last
),
projection as (
  select
    p.item_id,
    min(p.beginning_inventory) filter (where p.period_no = 1) as available_inventory,
    coalesce(sum(p.scheduled_receipt), 0) as scheduled_receipt,
    sum(p.confirmed_sales_order) as confirmed_order_qty,
    sum(p.forecast_demand) as projection_forecast_qty
  from analytics.v_inventory_projection p
  group by p.item_id
),
forecast as (
  select
    fr.item_id,
    max(fr.run_id::text) as forecast_run_id,
    max(fr.model_version::text) as model_version,
    sum(fr.predicted_qty) as forecast_qty,
    avg(fr.predicted_qty) as demand_per_period,
    avg(fr.sigma) as demand_sigma
  from analytics.v_forecast_result fr
  join core.champion_model cm
    on cm.item_id = fr.item_id
   and cm.forecast_run_id = fr.run_id
   and cm.champion_model_id = fr.model_id
  where cm.selection_method in ('AUTO', 'MANUAL')
  group by fr.item_id
),
leadtime as (
  select
    i.item_id,
    e.effective_lead_time,
    g.std_days as leadtime_sigma,
    e.effective_source
  from items i
  left join core.v_effective_lead_time e on e.supplier_id = i.supplier_id
  left join analytics.v_leadtime_gap g on g.supplier_id = i.supplier_id
),
item_policy as (
  select
    i.item_id,
    ip.item_grade,
    ip.moq,
    ip.pack_size,
    coalesce(ip.service_level, grade_policy.service_level, default_policy.service_level) as service_level,
    coalesce(grade_policy.z_value, default_policy.z_value) as z_value
  from items i
  left join core.item_policy ip on ip.item_id = i.item_id
  left join lateral (
    select pc.service_level, pc.config_value_numeric as z_value
    from core.policy_config pc
    where pc.active and pc.policy_key = 'SERVICE_LEVEL_' || upper(coalesce(ip.item_grade, ''))
    order by pc.updated_at desc
    limit 1
  ) grade_policy on true
  left join lateral (
    select
      max(pc.service_level) filter (where pc.policy_key = 'SERVICE_LEVEL_DEFAULT') as service_level,
      max(pc.config_value_numeric) filter (where pc.policy_key = 'Z_VALUE_DEFAULT') as z_value
    from core.policy_config pc
    where pc.active
  ) default_policy on true
),
stockout as (
  select distinct on (r.item_id)
    r.item_id,
    r.stockout_date,
    r.risk_status
  from analytics.v_stockout_risk r
  order by r.item_id
),
base as (
  select
    i.item_id,
    i.item_name,
    ip.item_grade,
    f.forecast_qty,
    coalesce(p.confirmed_order_qty, 0) as confirmed_order_qty,
    p.available_inventory,
    p.scheduled_receipt,
    f.demand_per_period,
    f.demand_sigma,
    l.effective_lead_time,
    l.leadtime_sigma,
    ip.service_level,
    ip.z_value,
    ip.moq,
    ip.pack_size,
    s.stockout_date,
    s.risk_status,
    f.forecast_run_id,
    f.model_version,
    pol.safety_buffer_days
  from items i
  left join projection p using (item_id)
  left join forecast f using (item_id)
  left join leadtime l using (item_id)
  left join item_policy ip using (item_id)
  cross join policy pol
  left join stockout s using (item_id)
),
calculated as (
  select
    b.*,
    greatest(coalesce(b.forecast_qty, 0), b.confirmed_order_qty) as demand_basis_qty,
    case when b.effective_lead_time is null or b.demand_sigma is null or b.demand_per_period is null or b.leadtime_sigma is null then null
         else sqrt(b.effective_lead_time * power(b.demand_sigma, 2) + power(b.demand_per_period, 2) * power(b.leadtime_sigma, 2)) end as sigma_dlt
  from base b
),
final as (
  select
    c.*,
    case when c.sigma_dlt is null or c.z_value is null then null else c.z_value * c.sigma_dlt end as safety_stock
  from calculated c
)
select
  item_id,
  item_name,
  item_grade,
  forecast_qty,
  confirmed_order_qty,
  demand_basis_qty,
  demand_per_period,
  demand_sigma,
  leadtime_sigma,
  effective_lead_time as effective_leadtime,
  service_level,
  z_value,
  sigma_dlt,
  safety_stock,
  available_inventory,
  scheduled_receipt,
  moq,
  pack_size,
  stockout_date,
  risk_status,
  safety_buffer_days,
  forecast_run_id,
  model_version,
  case when forecast_qty is null then 'NO_FORECAST'
       when available_inventory is null then 'NO_INVENTORY_DATA'
       when effective_lead_time is null then 'NO_LEADTIME'
       when demand_sigma is null or demand_per_period is null then 'INSUFFICIENT_FORECAST_ERROR'
       when leadtime_sigma is null then 'INSUFFICIENT_LEADTIME_SAMPLE'
       when service_level is null or z_value is null then 'NO_SERVICE_LEVEL'
       when moq is null or pack_size is null then 'NO_ITEM_POLICY' end as reason_code,
  case when forecast_qty is null or available_inventory is null or effective_lead_time is null
             or demand_sigma is null or demand_per_period is null or leadtime_sigma is null
             or service_level is null or z_value is null or moq is null or pack_size is null
       then 'CALCULATION_UNAVAILABLE' else 'CALCULATED' end as calculation_status
from final;

create or replace view analytics.v_purchase_recommendation with (security_invoker = true) as
with base as (
  select * from analytics.v_safety_stock
),
required as (
  select
    b.*,
    case when b.calculation_status <> 'CALCULATED' then null
         else b.demand_basis_qty + b.safety_stock - b.available_inventory - b.scheduled_receipt end as required_qty,
    b.stockout_date - (b.effective_leadtime + b.safety_buffer_days) as recommended_order_date
  from base b
),
rounded as (
  select
    r.*,
    case when r.required_qty is null then null
         when r.required_qty <= 0 then 0
         else ceil(greatest(r.required_qty, r.moq) / r.pack_size) * r.pack_size end as recommended_qty
  from required r
)
select
  item_id,
  item_name,
  item_grade,
  forecast_qty,
  confirmed_order_qty,
  demand_basis_qty,
  available_inventory,
  scheduled_receipt,
  safety_stock,
  effective_leadtime,
  stockout_date,
  safety_buffer_days,
  required_qty,
  moq,
  pack_size,
  recommended_qty,
  recommended_order_date,
  (recommended_order_date is not null and recommended_order_date < current_date) as immediate_order,
  (recommended_order_date is not null and recommended_order_date < current_date) as overdue,
  risk_status,
  calculation_status,
  reason_code,
  forecast_run_id,
  model_version,
  demand_per_period,
  demand_sigma,
  leadtime_sigma,
  service_level,
  z_value,
  sigma_dlt,
  jsonb_build_object(
    'demand_basis_qty', demand_basis_qty,
    'safety_stock', safety_stock,
    'available_inventory', available_inventory,
    'scheduled_receipt', scheduled_receipt,
    'required_qty', required_qty,
    'moq', moq,
    'pack_size', pack_size,
    'recommended_qty', recommended_qty
  ) as calculation_trace
from rounded;

create or replace view analytics.v_purchase_recommendation_detail with (security_invoker = true) as
select
  r.item_id,
  r.item_name,
  r.forecast_run_id,
  r.model_version,
  p.period,
  p.forecast_demand,
  p.beginning_inventory,
  p.scheduled_receipt,
  p.confirmed_sales_order,
  p.soft_allocation,
  p.ending_projected_inventory,
  r.safety_stock,
  r.required_qty,
  r.recommended_qty,
  r.calculation_status,
  r.reason_code
from analytics.v_purchase_recommendation r
left join analytics.v_inventory_projection p using (item_id);

comment on view analytics.v_safety_stock is 'STEP 7 Forecast Error sigma와 STEP 9 Effective Lead Time/재고를 결합한 Safety Stock. 데이터 부족 시 null과 reason_code를 반환한다.';
comment on view analytics.v_purchase_recommendation is 'Demand Basis, Safety Stock, Inventory, Open PO, MOQ, Pack Size를 포함한 발주추천 계산 trace.';
comment on column analytics.v_purchase_recommendation.calculation_trace is '추천수량 산출에 사용한 입력과 중간값 snapshot';

revoke all on analytics.v_safety_stock, analytics.v_purchase_recommendation, analytics.v_purchase_recommendation_detail from anon;
grant usage on schema analytics to authenticated;
grant select on analytics.v_safety_stock, analytics.v_purchase_recommendation, analytics.v_purchase_recommendation_detail to authenticated;
