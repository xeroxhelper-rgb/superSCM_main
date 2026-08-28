# STEP 4 데이터 적재 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CSV/XLSX를 서버에서 staging·검증한 뒤 사용자 승인 데이터만 batch 단위로 기존 raw 테이블에 적재하고, 이력·오류 다운로드·rollback을 제공한다.

**Architecture:** 브라우저는 파일과 확인 동작만 전달하고, Route Handler가 서버 전용 parser와 단일 validation 모듈을 호출한다. 원본과 매핑 결과는 `core.import_staging`에 보존하며, 최종 raw write와 batch 상태 변경은 권한 검사를 포함한 PostgreSQL RPC transaction에서 수행한다. 화면은 API 결과와 analytics/history view만 조회한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase SSR, PostgreSQL RLS/RPC, `papaparse`, `xlsx`, Node test runner

**Spec:** `docs/superpowers/specs/2026-08-28-step4-import-pipeline-design.md`

## Global Constraints

- 순수 CSS만 사용하고 Tailwind, styled-components, CSS Modules를 추가하지 않는다.
- `raw` 테이블을 drop/recreate하지 않고 기존 컬럼 계약을 사용한다.
- 파일 파싱과 모든 validation은 서버에서 수행한다.
- 사용자 승인 전에는 raw 테이블에 쓰지 않는다.
- 원본 오류값을 임의 보정하거나 null을 0으로 치환하지 않는다.
- 모든 raw 적재에는 `batch_id`, `source_type = 'FILE_UPLOAD'`, `loaded_at`, `source_record_id`를 채운다.
- anon 업로드를 차단하고 API와 DB/RPC 양쪽에서 권한을 검증한다.
- Supabase service role key를 브라우저 코드에 노출하지 않는다.
- 화면 컴포넌트에 parser·validation·계산 로직을 넣지 않는다.
- 구현 후 `npm test`, `npx tsc --noEmit`, `npm run build`를 실행한다.

---

### Task 1: STEP 4 DB migration과 검증 쿼리

**Files:**
- Create: `supabase/migrations/20260828000300_step4_import_pipeline.sql`
- Create: `sql/05-step4-verify.sql`
- Test: `lib/step4-schema.test.ts`

**Interfaces:**
- Produces tables `core.upload_batch`, `core.import_staging`, `core.column_mapping`, `core.validation_error`.
- Produces enums/check constraints for import type, mode, batch status, validation status, severity.
- Produces RPC signatures `core.import_batch(uuid, boolean)` and `core.rollback_batch(uuid)`.
- Produces read view `analytics.v_import_history` and grants/RLS used by later repository code.

- [ ] **Step 1: Write the failing schema contract test**

Assert that the migration defines all four tables, required batch columns, staging JSONB columns, validation error columns, `FILE_UPLOAD`, RPC names, RLS, and `analytics.v_import_history`.

- [ ] **Step 2: Run the schema test to verify it fails**

Run: `node --test lib/step4-schema.test.ts`

Expected: FAIL because the STEP 4 migration and contract do not exist.

- [ ] **Step 3: Write the migration**

Create tables with `create table if not exists`, indexes on `batch_id` and `uploaded_by`, append-only validation records, and safe status transitions. Enable RLS on all four tables. Allow authenticated users to read their own batches/staging/errors and ADMIN to read all; grant no anon access. Revoke raw direct mutations and define RPCs with `security definer`, fixed `search_path`, `auth.uid()`/`core.is_admin()` checks, explicit import type allow-list, and transaction-safe status/count updates. The RPC must reject unvalidated batches, unconfirmed imports, ERROR rows, USER replace, and unsupported target types. `rollback_batch` must delete only rows whose raw tracking `batch_id` equals the requested batch and must reject non-reversible replace batches.

- [ ] **Step 4: Add read-only Supabase verification queries**

Verify objects, columns, RLS policies, grants, RPC signatures, and that history exposes filename/type/mode/counts/user/time/status.

- [ ] **Step 5: Run the schema test to verify it passes**

Run: `node --test lib/step4-schema.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/step4-schema.test.ts supabase/migrations/20260828000300_step4_import_pipeline.sql sql/05-step4-verify.sql
git commit -m "STEP4 import pipeline DB 구조 추가"
```

### Task 2: Import 타입 registry와 parser 의존성

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/import/types.ts`
- Create: `lib/import/schema.ts`
- Create: `lib/import/parse.ts`
- Test: `lib/import/parse.test.ts`

**Interfaces:**
- `ImportType = 'usage_history' | 'inventory' | 'item_master' | 'supplier_master' | 'purchase_order' | 'goods_receipt' | 'sales_order' | 'business_event'`.
- `ImportMode = 'append' | 'upsert' | 'replace'`.
- `parseImportFile(file: File, importType: ImportType): Promise<ParsedImport>` returns `{ headers, rows, fileName, totalRows }` and never inserts data.
- `getImportSchema(importType): ImportSchema` returns target table, required fields, aliases, field types, business key, and relationship rules.

- [ ] **Step 1: Write failing parser tests**

Test CSV parsing, XLSX first-sheet parsing, Korean/English headers remaining in original rows, unsupported extension rejection, and empty file rejection.

- [ ] **Step 2: Run parser tests to verify they fail**

Run: `node --test lib/import/parse.test.ts`

Expected: FAIL because parser modules and dependencies do not exist.

- [ ] **Step 3: Add dependencies and implement registry/parser**

Install `papaparse` and `xlsx`. Keep the parser server-only; reject files over the configured byte/row limits, preserve cell strings before normalization, and return structured errors rather than silently dropping rows. Define only tables confirmed by the current schema.

- [ ] **Step 4: Run parser tests to verify they pass**

Run: `node --test lib/import/parse.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/import/types.ts lib/import/schema.ts lib/import/parse.ts lib/import/parse.test.ts
git commit -m "STEP4 CSV Excel parser와 import 계약 추가"
```

### Task 3: Mapping과 단일 validation 모듈

**Files:**
- Create: `lib/import/map.ts`
- Create: `lib/import/validate.ts`
- Test: `lib/import/map.test.ts`
- Test: `lib/import/validate.test.ts`

**Interfaces:**
- `inferColumnMapping(headers: string[], schema: ImportSchema): ColumnMapping[]` supports aliases such as `품목코드 → item_id`, `출고일 → use_date`, `출고수량 → qty`.
- `applyColumnMapping(row, mapping): MappedRow` preserves unmapped source values and does not coerce invalid values.
- `validateRows(rows: MappedRow[], context: ValidationContext): ValidationSummary` returns per-row `SUCCESS | WARNING | ERROR`, all `ValidationIssue` records, and valid row numbers.
- `ValidationIssue` contains `rowNumber`, `fieldName`, `errorCode`, `errorMessage`, `severity`, `originalValue`.

- [ ] **Step 1: Write failing mapping/validation tests**

Cover required column/value, invalid number/date, duplicate source row, unknown item/supplier, negative quantity, date-order error, unsupported column, WARNING versus ERROR, and no correction of null/invalid values.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test lib/import/map.test.ts lib/import/validate.test.ts`

Expected: FAIL because mapping and validation functions do not exist.

- [ ] **Step 3: Implement the minimal registry-driven logic**

Use only `ValidationContext` lookups supplied by the repository/API layer. Do not import Supabase inside pure validation functions. Parse date/number strictly, preserve original strings, detect duplicates with schema business keys, and classify each issue without deleting rows.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test lib/import/map.test.ts lib/import/validate.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/import/map.ts lib/import/validate.ts lib/import/map.test.ts lib/import/validate.test.ts
git commit -m "STEP4 컬럼 매핑과 서버 validation 추가"
```

### Task 4: Staging/repository/history와 오류 CSV

**Files:**
- Create: `lib/import/repository.ts`
- Create: `lib/import/history.ts`
- Test: `lib/import/repository.test.ts`
- Test: `lib/import/history.test.ts`

**Interfaces:**
- `createUploadBatch(input): Promise<UploadBatch>` creates a UUID batch in `UPLOADED` state for the authenticated user.
- `saveStagingRows(batchId, rows): Promise<void>` saves original/mapped JSON and row number only.
- `saveValidationResult(batchId, summary): Promise<void>` writes errors and updates counts/status.
- `getImportHistory(): Promise<ImportHistoryRow[]>` queries `analytics.v_import_history`.
- `buildValidationErrorCsv(rows, issues): string` returns CSV with original columns plus row/error metadata and includes only ERROR/WARNING rows.

- [ ] **Step 1: Write failing repository/history tests**

Test batch creation fields, staging never calling a raw insert, validation count mapping, history normalization, CSV escaping, and ERROR/WARNING-only filtering.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test lib/import/repository.test.ts lib/import/history.test.ts`

Expected: FAIL because the repository/history modules do not exist.

- [ ] **Step 3: Implement repository/history**

Use `createSupabaseServerClient()` and `.schema('core'|'analytics')`. Enforce ownership in queries through RLS, update batch state only through allowed transitions, and keep CSV generation independent of React. Any Supabase error is returned to the caller; empty results are not treated as successful imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test lib/import/repository.test.ts lib/import/history.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/import/repository.ts lib/import/history.ts lib/import/repository.test.ts lib/import/history.test.ts
git commit -m "STEP4 staging history와 오류 CSV 추가"
```

### Task 5: Parse/validate/confirm/rollback Route Handler

**Files:**
- Create: `app/api/import/parse/route.ts`
- Create: `app/api/import/validate/route.ts`
- Create: `app/api/import/confirm/route.ts`
- Create: `app/api/import/rollback/route.ts`
- Test: `lib/import/routes.test.ts`

**Interfaces:**
- `POST /api/import/parse` multipart form `{ file, importType, importMode }` returns `batchId`, headers, preview rows, and mapping candidates.
- `POST /api/import/validate` JSON `{ batchId, mapping }` returns counts, row statuses, issues, and `canImport`.
- `POST /api/import/confirm` JSON `{ batchId, confirmed }` invokes `core.import_batch` only when validated and approved.
- `POST /api/import/rollback` JSON `{ batchId }` invokes `core.rollback_batch` only for ADMIN.

- [ ] **Step 1: Write failing route contract tests**

Test unauthenticated rejection, malformed payload rejection, parse-to-staging flow, validation-before-confirm enforcement, ERROR blocking, WARNING confirmation requirement, USER replace rejection, and ADMIN rollback path.

- [ ] **Step 2: Run route tests to verify they fail**

Run: `node --test lib/import/routes.test.ts`

Expected: FAIL because the route handlers do not exist.

- [ ] **Step 3: Implement handlers**

Call `requireUser()` at the start of every handler and `requireAdmin()` for replace/rollback. Keep service credentials out of the route. Use repository functions for staging and validation, never raw inserts. Return stable JSON error codes and HTTP 401/403/409/422 statuses.

- [ ] **Step 4: Run route tests to verify they pass**

Run: `node --test lib/import/routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/import lib/import/routes.test.ts
git commit -m "STEP4 import API와 권한 경계 추가"
```

### Task 6: Data Management 메뉴와 업로드 wizard 화면

**Files:**
- Modify: `lib/menu.ts`
- Create: `app/(admin)/admin/data-management/page.tsx`
- Create: `components/admin/import-wizard.tsx`
- Modify: `styles/components.css`
- Test: `lib/menu.test.ts`

**Interfaces:**
- Route `/admin/data-management` exposes upload, preview/mapping, validation result, confirmation, and history sections.
- Wizard state is `select → parsed → mapped → validated → confirmed`; Import button is disabled unless `canImport` is true.
- Uses shared `Panel`, `Button`, `Badge`, `DataTable`, and `EmptyValue` components.

- [ ] **Step 1: Write failing menu/UI contract tests**

Assert ADMIN menu contains Data Management while USER does not, and source contains no hex color or validation calculation.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test lib/menu.test.ts`

Expected: FAIL because the menu item and page do not exist.

- [ ] **Step 3: Implement the wizard**

Use a client component only for file selection, mapping edits, confirmation checkbox, download action, and API calls. Render server/API validation output without recalculating it. Show ERROR/WARNING badges and unavailable values as `EmptyValue`; make replace confirmation explicit and ADMIN-only.

- [ ] **Step 4: Run tests and build**

Run: `node --test lib/menu.test.ts`; `npx tsc --noEmit`; `npm run build`

Expected: PASS and `/admin/data-management` appears in the route list.

- [ ] **Step 5: Commit**

```bash
git add lib/menu.ts lib/menu.test.ts app/\(admin\)/admin/data-management components/admin/import-wizard.tsx styles/components.css
git commit -m "STEP4 Data Management 업로드 화면 추가"
```

### Task 7: Import History와 rollback UI

**Files:**
- Create: `components/admin/import-history-table.tsx`
- Modify: `app/(admin)/admin/data-management/page.tsx`
- Modify: `styles/components.css`
- Test: `lib/import/history.test.ts`

**Interfaces:**
- History table shows filename, type, mode, total/success/warning/error counts, uploader, timestamp, and status.
- Error CSV download calls history API or builds from server-returned error rows.
- Rollback action sends only `batchId`, requires explicit confirmation, and displays replace non-reversible limitation.

- [ ] **Step 1: Add failing UI data contract tests**

Cover history column mapping, status labels, error CSV link behavior, and rollback visibility only for imported reversible batches and ADMIN.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test lib/import/history.test.ts`

Expected: FAIL for the new history behavior.

- [ ] **Step 3: Implement history table and rollback controls**

Keep table presentation separate from the wizard. Do not allow a UI-only status to bypass the server RPC checks. Show server error messages and refresh history after import/rollback.

- [ ] **Step 4: Run focused tests and build**

Run: `node --test lib/import/history.test.ts`; `npm run build`

Expected: PASS and successful build.

- [ ] **Step 5: Commit**

```bash
git add components/admin/import-history-table.tsx app/\(admin\)/admin/data-management/page.tsx styles/components.css lib/import/history.test.ts
git commit -m "STEP4 적재 이력과 batch rollback UI 추가"
```

### Task 8: Forecast stale 연결과 전체 검증

**Files:**
- Modify: `supabase/migrations/20260828000300_step4_import_pipeline.sql`
- Modify: `sql/05-step4-verify.sql`
- Create: `lib/step4-integration.test.ts`
- Modify: `README.md`
- Modify: `error.md` only if a user-reported execution error occurs during validation

**Interfaces:**
- `analytics.v_import_history` exposes imported status and timestamps.
- Demand-related imports expose a stale comparison against existing forecast `data_snapshot_at` without deleting forecast results.
- Verification SQL reports batch counts, raw tracking completeness, error rows, rollback isolation, and stale candidates.

- [ ] **Step 1: Write failing integration contract tests**

Assert demand import is connected to snapshot comparison, raw tracking fields are required in import SQL, no raw direct insert exists in route/component code, and all supported import types are registry-backed.

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `node --test lib/step4-integration.test.ts`

Expected: FAIL until stale contract and all route boundaries are connected.

- [ ] **Step 3: Implement stale view/contract and operator documentation**

Use existing forecast snapshot columns when available; otherwise expose a non-destructive stale candidate view based on imported `loaded_at` and forecast snapshot time. Document Supabase SQL Editor full-file execution, Exposed schemas, file limits, and manual checks.

- [ ] **Step 4: Run the full verification suite**

Run sequentially:

```bash
npm test
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all tests pass, TypeScript exits 0, build succeeds, and diff check has no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260828000300_step4_import_pipeline.sql sql/05-step4-verify.sql lib/step4-integration.test.ts README.md error.md
git commit -m "STEP4 import pipeline 검증과 운영 문서 추가"
```
