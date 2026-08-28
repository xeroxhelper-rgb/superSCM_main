import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/20260828000300_step4_import_pipeline.sql', import.meta.url);

test('STEP 4 migration은 batch/staging/mapping/error 객체와 추적 필드를 정의한다', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  for (const table of ['upload_batch', 'import_staging', 'column_mapping', 'validation_error']) {
    assert.match(sql, new RegExp(`create table if not exists core\\.${table}`, 'i'));
  }
  for (const column of ['batch_id', 'file_name', 'import_type', 'import_mode', 'total_rows', 'success_rows', 'warning_rows', 'error_rows', 'status', 'uploaded_by', 'uploaded_at', 'imported_at']) {
    assert.match(sql, new RegExp(`\\b${column}\\b`, 'i'));
  }
  assert.match(sql, /raw_data\s+jsonb/i);
  assert.match(sql, /mapped_data\s+jsonb/i);
  assert.match(sql, /source_type['\"]?[, ]+['\"]FILE_UPLOAD['\"]/i);
  assert.match(sql, /severity\s+text/i);
});

test('STEP 4 migration은 import/rollback RPC와 history view 및 보안 경계를 정의한다', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /create or replace function core\.import_batch\s*\(/i);
  assert.match(sql, /create or replace function core\.rollback_batch\s*\(/i);
  assert.match(sql, /create or replace view analytics\.v_import_history/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /core\.is_admin\(\)/i);
  assert.match(sql, /revoke all on core\.upload_batch[^;]*from anon/i);
});
