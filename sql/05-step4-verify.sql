-- STEP 4 수동 검증용 읽기 전용 SQL
select table_schema, table_name
from information_schema.tables
where table_schema = 'core'
  and table_name in ('upload_batch', 'import_staging', 'column_mapping', 'validation_error')
order by table_name;

select column_name, data_type
from information_schema.columns
where table_schema = 'core' and table_name = 'upload_batch'
order by ordinal_position;

select routine_schema, routine_name, routine_identity_arguments
from information_schema.routines
where routine_schema = 'core'
  and routine_name in ('import_batch', 'rollback_batch');

select * from analytics.v_import_history order by uploaded_at desc;

select * from analytics.v_import_stale_candidates order by imported_at desc;

select batch_id, count(*) as error_count
from core.validation_error
group by batch_id
order by batch_id;

select batch_id, count(*) as missing_tracking_count
from raw.usage_history
where batch_id is null or source_type is null or loaded_at is null or source_record_id is null
group by batch_id;
