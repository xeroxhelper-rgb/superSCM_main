-- STEP 4: 파일 적재 pipeline
-- 전제: STEP 2, STEP 3 migration을 먼저 적용한다.

create schema if not exists core;
create schema if not exists analytics;

create table if not exists core.upload_batch (
  batch_id uuid primary key default gen_random_uuid(),
  file_name text not null,
  import_type text not null check (import_type in ('usage_history','inventory','item_master','supplier_master','purchase_order','goods_receipt','sales_order','business_event')),
  import_mode text not null check (import_mode in ('append','upsert','replace')),
  total_rows integer not null default 0 check (total_rows >= 0),
  success_rows integer not null default 0 check (success_rows >= 0),
  warning_rows integer not null default 0 check (warning_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  status text not null default 'UPLOADED' check (status in ('UPLOADED','PARSING','VALIDATING','VALIDATED','IMPORTING','IMPORTED','FAILED','ROLLED_BACK')),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  validation_completed_at timestamptz,
  imported_at timestamptz,
  rolled_back_at timestamptz,
  rollback_reason text,
  replace_rollback_supported boolean not null default false
);

create table if not exists core.import_staging (
  staging_id bigint generated always as identity primary key,
  batch_id uuid not null references core.upload_batch(batch_id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw_data jsonb not null,
  mapped_data jsonb,
  validation_status text not null default 'PENDING' check (validation_status in ('PENDING','SUCCESS','WARNING','ERROR')),
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create table if not exists core.column_mapping (
  mapping_id bigint generated always as identity primary key,
  import_type text not null,
  source_column text not null,
  target_column text not null,
  confidence numeric(5,4),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_type, source_column)
);

create table if not exists core.validation_error (
  error_id bigint generated always as identity primary key,
  batch_id uuid not null references core.upload_batch(batch_id) on delete cascade,
  staging_id bigint references core.import_staging(staging_id) on delete cascade,
  row_number integer not null,
  field_name text,
  error_code text not null,
  error_message text not null,
  severity text not null check (severity in ('WARNING','ERROR')),
  original_value text,
  created_at timestamptz not null default now()
);

create index if not exists upload_batch_uploaded_by_idx on core.upload_batch(uploaded_by, uploaded_at desc);
create index if not exists import_staging_batch_idx on core.import_staging(batch_id, row_number);
create index if not exists validation_error_batch_idx on core.validation_error(batch_id, row_number);

create or replace view analytics.v_import_history as
select b.batch_id, b.file_name, b.import_type, b.import_mode, b.total_rows,
       b.success_rows, b.warning_rows, b.error_rows, b.status,
       b.uploaded_by, u.email as uploaded_by_email, b.uploaded_at,
       b.validation_completed_at, b.imported_at, b.rolled_back_at,
       b.rollback_reason, b.replace_rollback_supported
from core.upload_batch b
left join auth.users u on u.id = b.uploaded_by;

alter table core.upload_batch enable row level security;
alter table core.import_staging enable row level security;
alter table core.column_mapping enable row level security;
alter table core.validation_error enable row level security;

drop policy if exists upload_batch_owner_read on core.upload_batch;
create policy upload_batch_owner_read on core.upload_batch for select to authenticated
  using (uploaded_by = auth.uid() or core.is_admin());
drop policy if exists upload_batch_owner_insert on core.upload_batch;
create policy upload_batch_owner_insert on core.upload_batch for insert to authenticated
  with check (uploaded_by = auth.uid() and (select coalesce((select active from core.app_user where user_id = auth.uid()), false)));
drop policy if exists upload_batch_admin_update on core.upload_batch;
create policy upload_batch_admin_update on core.upload_batch for update to authenticated
  using (core.is_admin()) with check (core.is_admin());

drop policy if exists import_staging_owner_read on core.import_staging;
create policy import_staging_owner_read on core.import_staging for select to authenticated
  using (exists (select 1 from core.upload_batch b where b.batch_id = import_staging.batch_id and (b.uploaded_by = auth.uid() or core.is_admin())));
drop policy if exists import_staging_owner_insert on core.import_staging;
create policy import_staging_owner_insert on core.import_staging for insert to authenticated
  with check (exists (select 1 from core.upload_batch b where b.batch_id = import_staging.batch_id and b.uploaded_by = auth.uid()));
drop policy if exists import_staging_owner_update on core.import_staging;
create policy import_staging_owner_update on core.import_staging for update to authenticated
  using (exists (select 1 from core.upload_batch b where b.batch_id = import_staging.batch_id and (b.uploaded_by = auth.uid() or core.is_admin())))
  with check (exists (select 1 from core.upload_batch b where b.batch_id = import_staging.batch_id and (b.uploaded_by = auth.uid() or core.is_admin())));

drop policy if exists column_mapping_read on core.column_mapping;
create policy column_mapping_read on core.column_mapping for select to authenticated using (created_by = auth.uid() or core.is_admin());
drop policy if exists column_mapping_write on core.column_mapping;
create policy column_mapping_write on core.column_mapping for all to authenticated using (created_by = auth.uid() or core.is_admin()) with check (created_by = auth.uid() or core.is_admin());

drop policy if exists validation_error_owner_read on core.validation_error;
create policy validation_error_owner_read on core.validation_error for select to authenticated
  using (exists (select 1 from core.upload_batch b where b.batch_id = validation_error.batch_id and (b.uploaded_by = auth.uid() or core.is_admin())));
drop policy if exists validation_error_owner_insert on core.validation_error;
create policy validation_error_owner_insert on core.validation_error for insert to authenticated
  with check (exists (select 1 from core.upload_batch b where b.batch_id = validation_error.batch_id and (b.uploaded_by = auth.uid() or core.is_admin())));

revoke all on core.upload_batch, core.import_staging, core.column_mapping, core.validation_error from anon;
revoke all on analytics.v_import_history from anon;
grant select on analytics.v_import_history to authenticated;
create or replace function core.import_batch(target_batch_id uuid, confirmed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b core.upload_batch;
  s core.import_staging;
  target_table text;
  payload jsonb;
  inserted_count integer := 0;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception using errcode = '42501', message = '로그인이 필요합니다.'; end if;
  select * into b from core.upload_batch where batch_id = target_batch_id for update;
  if not found or (b.uploaded_by <> current_user_id and not core.is_admin()) then raise exception using errcode = '42501', message = '업로드 batch 접근 권한이 없습니다.'; end if;
  if b.import_mode = 'replace' and not core.is_admin() then raise exception using errcode = '42501', message = 'replace는 관리자만 실행할 수 있습니다.'; end if;
  if b.status <> 'VALIDATED' or not confirmed then raise exception using errcode = '40900', message = '검증 완료 및 사용자 확인 후에만 적재할 수 있습니다.'; end if;
  if b.error_rows > 0 then raise exception using errcode = '22023', message = 'ERROR 행이 남아 있어 적재할 수 없습니다.'; end if;

  target_table := b.import_type;
  if b.import_mode = 'replace' then
    execute format('delete from raw.%I', target_table);
  end if;
  update core.upload_batch set status = 'IMPORTING' where batch_id = target_batch_id;

  for s in select * from core.import_staging where batch_id = target_batch_id and validation_status in ('SUCCESS','WARNING') order by row_number loop
    payload := coalesce(s.mapped_data, '{}'::jsonb)
      || jsonb_build_object('batch_id', target_batch_id, 'source_type', 'FILE_UPLOAD', 'loaded_at', now(), 'source_record_id', coalesce(s.raw_data->>'source_record_id', target_batch_id::text || ':' || s.row_number::text));
    execute format('insert into raw.%I select (jsonb_populate_record(null::raw.%I, $1)).*', target_table, target_table) using payload;
    inserted_count := inserted_count + 1;
  end loop;

  update core.upload_batch set status = 'IMPORTED', imported_at = now(), success_rows = inserted_count where batch_id = target_batch_id;
  return jsonb_build_object('batch_id', target_batch_id, 'status', 'IMPORTED', 'success_rows', inserted_count);
exception when others then
  update core.upload_batch set status = 'FAILED' where batch_id = target_batch_id;
  raise;
end;
$$;

create or replace function core.rollback_batch(target_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b core.upload_batch;
  deleted_count integer := 0;
  affected_count integer := 0;
begin
  if auth.uid() is null or not core.is_admin() then raise exception using errcode = '42501', message = '관리자 권한이 필요합니다.'; end if;
  select * into b from core.upload_batch where batch_id = target_batch_id for update;
  if not found then raise exception using errcode = 'P0002', message = '업로드 batch를 찾을 수 없습니다.'; end if;
  if b.import_mode = 'replace' or not b.replace_rollback_supported then
    raise exception using errcode = '0A000', message = 'replace batch는 완전 rollback을 지원하지 않습니다.';
  end if;
  execute 'delete from raw.usage_history where batch_id = $1' using target_batch_id;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;
  execute 'delete from raw.inventory where batch_id = $1' using target_batch_id;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;
  execute 'delete from raw.item_master where batch_id = $1' using target_batch_id;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;
  execute 'delete from raw.supplier_master where batch_id = $1' using target_batch_id;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;
  execute 'delete from raw.purchase_order where batch_id = $1' using target_batch_id;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;
  execute 'delete from raw.goods_receipt where batch_id = $1' using target_batch_id;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;
  execute 'delete from raw.sales_order where batch_id = $1' using target_batch_id;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;
  execute 'delete from raw.business_event where batch_id = $1' using target_batch_id;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;
  update core.upload_batch set status = 'ROLLED_BACK', rolled_back_at = now() where batch_id = target_batch_id;
  return jsonb_build_object('batch_id', target_batch_id, 'status', 'ROLLED_BACK', 'deleted_rows', deleted_count);
end;
$$;

revoke all on function core.import_batch(uuid, boolean) from public, anon, authenticated;
revoke all on function core.rollback_batch(uuid) from public, anon, authenticated;
grant execute on function core.import_batch(uuid, boolean) to authenticated;
grant execute on function core.rollback_batch(uuid) to authenticated;
