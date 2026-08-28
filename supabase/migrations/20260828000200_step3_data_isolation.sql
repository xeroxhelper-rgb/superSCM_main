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
