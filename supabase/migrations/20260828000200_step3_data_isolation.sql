-- STEP 3 canonical migration: raw 적재 추적, 정책 설정, Forecast 기간 계약

create schema if not exists raw;
create schema if not exists core;
create schema if not exists analytics;

do $$
declare table_name text;
begin
  foreach table_name in array array['shipment_log','supplier_master','item_master','inventory','usage_history','forecast','goods_receipt','purchase_order'] loop
    execute format('alter table if exists raw.%I add column if not exists batch_id uuid', table_name);
    execute format('alter table if exists raw.%I add column if not exists source_type text', table_name);
    execute format('alter table if exists raw.%I add column if not exists loaded_at timestamptz default now()', table_name);
    execute format('alter table if exists raw.%I add column if not exists source_record_id text', table_name);
  end loop;
end $$;

create table if not exists raw.business_event (
  id bigint generated always as identity primary key,
  event_type text not null,
  event_date date not null,
  item_id text,
  quantity numeric,
  customer_id text,
  note text,
  batch_id uuid,
  source_type text,
  loaded_at timestamptz not null default now(),
  source_record_id text
);
create table if not exists raw.sales_order (
  id bigint generated always as identity primary key,
  order_id text not null,
  order_date date not null,
  customer_id text,
  item_id text not null,
  quantity numeric,
  requested_date date,
  status text,
  batch_id uuid,
  source_type text,
  loaded_at timestamptz not null default now(),
  source_record_id text
);
create table if not exists raw.item_substitute (
  id bigint generated always as identity primary key,
  item_id text not null,
  substitute_item_id text not null,
  priority integer,
  valid_from date,
  valid_to date,
  note text,
  batch_id uuid,
  source_type text,
  loaded_at timestamptz not null default now(),
  source_record_id text,
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create table if not exists core.policy_config (
  policy_key text primary key,
  service_level numeric,
  review_period_days integer,
  safety_buffer_days integer,
  config_value_numeric numeric,
  config_value_text text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (service_level is null or service_level between 0 and 1),
  check (review_period_days is null or review_period_days >= 0),
  check (safety_buffer_days is null or safety_buffer_days >= 0)
);
create table if not exists core.outlier_rule (
  rule_code text primary key,
  rule_name text not null,
  anomaly_type text not null check (anomaly_type in ('PROJECT', 'RETURN', 'DUPLICATE', 'OTHER')),
  exclude_from_training boolean not null default true,
  enabled boolean not null default true,
  priority integer not null default 100,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists core.item_policy (
  item_id text primary key,
  moq numeric,
  pack_size numeric,
  item_grade text,
  service_level numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (moq is null or moq >= 0),
  check (pack_size is null or pack_size > 0),
  check (service_level is null or service_level between 0 and 1)
);
create table if not exists core.forecast_setting (
  setting_id smallint primary key default 1 check (setting_id = 1),
  train_start date,
  train_end date,
  test_start date,
  test_end date,
  granularity text not null default 'DAY' check (granularity in ('DAY', 'WEEK', 'MONTH')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (train_start is null or train_end is null or train_start <= train_end),
  check (test_start is null or test_end is null or test_start <= test_end),
  check (test_start is null or train_end is null or test_start > train_end)
);
insert into core.forecast_setting (setting_id) values (1) on conflict (setting_id) do nothing;

create or replace function core.step3_set_updated_at() returns trigger language plpgsql security definer set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
do $$
declare table_name text;
begin
  foreach table_name in array array['policy_config','outlier_rule','item_policy','forecast_setting'] loop
    execute format('drop trigger if exists %I_set_updated_at on core.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on core.%I for each row execute function core.step3_set_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace view core.v_train_demand as
select u.usage_id, u.item_id, u.use_date, u.qty, u.warehouse, u.note,
       u.batch_id, u.source_type, u.loaded_at, u.source_record_id
from raw.usage_history u
join core.forecast_setting s on s.setting_id = 1
where s.train_start is not null
  and s.train_end is not null
  and u.use_date between s.train_start and s.train_end;

create or replace view core.v_test_actual as
select u.usage_id, u.item_id, u.use_date, u.qty, u.warehouse, u.note,
       u.batch_id, u.source_type, u.loaded_at, u.source_record_id
from raw.usage_history u
join core.forecast_setting s on s.setting_id = 1
where s.test_start is not null
  and s.test_end is not null
  and u.use_date between s.test_start and s.test_end;

create or replace view analytics.v_data_coverage as
with actual as (
  select min(use_date) as actual_start, max(use_date) as actual_end
  from raw.usage_history
), setting as (
  select train_start, train_end, test_start, test_end
  from core.forecast_setting
  where setting_id = 1
)
select actual.actual_start, actual.actual_end,
       setting.train_start, setting.train_end, setting.test_start, setting.test_end,
       (select count(*) from core.v_train_demand) as train_row_count,
       (select count(*) from core.v_test_actual) as test_row_count,
       (actual.actual_start is not null and setting.train_start is not null and setting.train_end is not null
        and actual.actual_start <= setting.train_start and actual.actual_end >= setting.train_end) as train_window_ok,
       (actual.actual_start is not null and setting.test_start is not null and setting.test_end is not null
        and actual.actual_start <= setting.test_start and actual.actual_end >= setting.test_end) as test_window_ok,
       (setting.train_end is not null and setting.test_start is not null and setting.test_start > setting.train_end) as windows_do_not_overlap
from actual cross join setting;

create or replace view analytics.v_forecast_setting_admin as
select c.actual_start, c.actual_end, c.train_start, c.train_end, c.test_start, c.test_end,
       s.granularity, c.train_row_count, c.test_row_count,
       c.train_window_ok, c.test_window_ok, c.windows_do_not_overlap,
       coalesce((select jsonb_agg(
         jsonb_build_object(
           'policy_key', p.policy_key,
           'service_level', p.service_level,
           'review_period_days', p.review_period_days,
           'safety_buffer_days', p.safety_buffer_days,
           'config_value_numeric', p.config_value_numeric,
           'config_value_text', p.config_value_text,
           'description', p.description
         )
         order by p.policy_key
       ) from core.policy_config p where p.active), '[]'::jsonb) as policy_values,
       (select count(*) from core.item_policy) as item_policy_count,
       (select count(*) from core.outlier_rule where enabled) as enabled_outlier_rule_count
from analytics.v_data_coverage c
join core.forecast_setting s on s.setting_id = 1
where core.is_admin();

do $$
declare table_name text;
begin
  foreach table_name in array array['shipment_log','supplier_master','item_master','inventory','usage_history','forecast','goods_receipt','purchase_order','business_event','sales_order','item_substitute'] loop
    execute format('alter table if exists raw.%I enable row level security', table_name);
  end loop;
end $$;

alter table core.policy_config enable row level security;
alter table core.outlier_rule enable row level security;
alter table core.item_policy enable row level security;
alter table core.forecast_setting enable row level security;

drop policy if exists policy_config_read_active on core.policy_config;
create policy policy_config_read_active on core.policy_config for select to authenticated
  using ((select coalesce((select active from core.app_user where user_id = auth.uid()), false)) or core.is_admin());
drop policy if exists policy_config_admin_mutation on core.policy_config;
create policy policy_config_admin_mutation on core.policy_config for all to authenticated
  using (core.is_admin()) with check (core.is_admin());
drop policy if exists outlier_rule_read_active on core.outlier_rule;
create policy outlier_rule_read_active on core.outlier_rule for select to authenticated
  using ((select coalesce((select active from core.app_user where user_id = auth.uid()), false)) or core.is_admin());
drop policy if exists outlier_rule_admin_mutation on core.outlier_rule;
create policy outlier_rule_admin_mutation on core.outlier_rule for all to authenticated
  using (core.is_admin()) with check (core.is_admin());
drop policy if exists item_policy_read_active on core.item_policy;
create policy item_policy_read_active on core.item_policy for select to authenticated
  using ((select coalesce((select active from core.app_user where user_id = auth.uid()), false)) or core.is_admin());
drop policy if exists item_policy_admin_mutation on core.item_policy;
create policy item_policy_admin_mutation on core.item_policy for all to authenticated
  using (core.is_admin()) with check (core.is_admin());
drop policy if exists forecast_setting_read_active on core.forecast_setting;
create policy forecast_setting_read_active on core.forecast_setting for select to authenticated
  using ((select coalesce((select active from core.app_user where user_id = auth.uid()), false)) or core.is_admin());
drop policy if exists forecast_setting_admin_mutation on core.forecast_setting;
create policy forecast_setting_admin_mutation on core.forecast_setting for all to authenticated
  using (core.is_admin()) with check (core.is_admin());

revoke all on schema raw from anon, authenticated;
revoke all privileges on all tables in schema raw from anon, authenticated;
grant usage on schema core, analytics to authenticated;
grant select on core.v_train_demand, core.v_test_actual to authenticated;
grant select on analytics.v_data_coverage to authenticated;
grant select on analytics.v_forecast_setting_admin to authenticated;
grant select on core.policy_config, core.outlier_rule, core.item_policy, core.forecast_setting to authenticated;
alter default privileges in schema raw revoke all on tables from anon, authenticated;
