# 기기·옵션 월간 발주계획 MVP

PRD 기준 1단계 로컬 웹 프로토타입입니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## 현재 단계

현재는 전체 업무 흐름을 확인하기 위한 Phase 1 화면입니다.

```text
전체 현황
→ 수요 확정
→ 재고·공급
→ 마스터 검증
→ 발주량 계산
→ 보고자료
```

화면에는 업무 단계, 입력 항목, 계산 결과 구조, 예외 검토, 보고자료 미리보기를 대표 샘플값으로 표시합니다.

## 다음 구현 단계

- SQLite 저장 및 발주계획 생성/조회
- 화면 직접 입력 및 Excel/CSV 업로드
- 실제 발주량 계산 서비스
- 수동 조정 이력
- Excel/PDF 보고서 다운로드

## Supabase 클라우드 연결

현재 프로젝트에는 Supabase 브라우저/서버 클라이언트와 수요확정 핵심 스키마 마이그레이션이 포함되어 있습니다.

1. Supabase Dashboard에서 프로젝트를 생성합니다.
2. 프로젝트의 URL과 Publishable key를 확인합니다.
3. 로컬에서 `.env.example`을 `.env.local`로 복사하고 값을 입력합니다.

```bash
cp .env.example .env.local
```

4. 개발 서버를 실행한 뒤 연결 상태를 확인합니다.

```bash
curl http://localhost:3000/api/health/supabase
```

5. Supabase CLI로 프로젝트를 연결한 후 마이그레이션을 배포합니다.

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

마이그레이션 파일은 `supabase/migrations/`에 있으며, 현재 수요확정 기능에 필요한 `planning_runs`, `ol_demand`, `sfdc_pipeline`, `bulk_deals`, `historical_actuals`, `demand_confirmations` 테이블을 생성합니다. 원격 데이터베이스는 Dashboard에서 직접 수정하지 않고 마이그레이션 파일로 관리합니다.

### STEP 2 인증·권한 설정

`supabase/migrations/20260828000100_step2_auth_rbac.sql`을 배포하면 `core.app_user`, `core.audit_log`, 신규 사용자 trigger, 관리자 RPC, RLS가 함께 생성됩니다. 최초 관리자 계정은 사용자 회원가입 후 SQL Editor에서 한 번 지정합니다.

```sql
update core.app_user set role = 'ADMIN' where email = 'admin@example.com';
```

`core`와 `analytics`를 Supabase API의 Exposed schemas에 추가하고, 테스트용 ADMIN/USER 계정을 각각 준비하세요. USER는 `/admin/*`에 접근할 수 없고, 사용자 변경은 관리자 Server Action과 DB RPC 양쪽에서 검증됩니다. 역할·활성 상태 변경은 `core.audit_log`에 자동 기록됩니다.

권한 점검용 읽기 전용 SQL은 `sql/03-step2-verify.sql`입니다. `sql/01-grants.sql`, `sql/02-policies.sql`은 migration과 동기화된 보조 스크립트입니다. secret key나 service role key는 `.env.local` 또는 브라우저 코드에 넣지 않습니다.

### STEP 3 학습·검증 데이터 설정

`supabase/migrations/20260828000200_step3_data_isolation.sql`은 raw 입력 확장, 적재 추적 컬럼, 정책 테이블, Forecast 기간 설정과 train/test 격리 view를 생성합니다. Supabase SQL Editor에서는 migration 전체를 한 번에 실행하고, `sql/04-step3-verify.sql`로 객체와 권한을 확인합니다.

Forecast 기간은 SQL/TypeScript 코드에 고정하지 않고 `core.forecast_setting`에 입력합니다.

```sql
update core.forecast_setting
set train_start = 'YYYY-MM-DD', train_end = 'YYYY-MM-DD',
    test_start = 'YYYY-MM-DD', test_end = 'YYYY-MM-DD',
    granularity = 'DAY'
where setting_id = 1;
```

`core.v_train_demand`는 학습 기간만, `core.v_test_actual`은 검증 기간만 반환합니다. `analytics.v_data_coverage`의 `train_window_ok`, `test_window_ok`, `windows_do_not_overlap`가 모두 true인지 확인한 뒤 Forecast와 Backtest를 연결합니다. 관리자에서는 `/admin/forecast-settings`에서 기간, 행 수, 정책 상태를 확인할 수 있습니다.

### STEP 4 파일 적재 pipeline

`supabase/migrations/20260828000300_step4_import_pipeline.sql`을 STEP 2·3 이후 Supabase SQL Editor에서 전체 실행합니다. `core.upload_batch`, `core.import_staging`, `core.column_mapping`, `core.validation_error`와 `core.import_batch`, `core.rollback_batch` RPC, `analytics.v_import_history`, `analytics.v_import_stale_candidates`가 생성됩니다. 실행 후 `sql/05-step4-verify.sql`을 전체가 아닌 읽기 전용 검증용으로 실행하세요.

관리자 화면 `/admin/data-management`에서 CSV/XLSX를 선택하고 데이터 종류와 append/upsert/replace 모드를 정한 뒤 Parse → Mapping → Validation → 사용자 확인 → Import 순서로 진행합니다. Validation ERROR가 있으면 Import할 수 없고, WARNING은 확인 표시 후 승인할 수 있습니다. replace와 rollback은 관리자 권한이 필요하며 replace는 완전 rollback을 지원하지 않습니다.

파일은 서버에서만 파싱·검증되며, 사용자 확인 전에는 `raw`에 저장되지 않습니다. 승인된 행에는 `batch_id`, `source_type = 'FILE_UPLOAD'`, `loaded_at`, `source_record_id`가 기록됩니다. 수요 관련 batch가 적재되면 `analytics.v_import_stale_candidates`에서 Forecast 재계산 후보를 확인할 수 있습니다. 현재 저장소에는 기존 Forecast snapshot 테이블이 없어 snapshot 시점 비교는 후속 Forecast 구조에서 확장합니다.

## 참고

샘플 데이터가 제공되면 화면의 대표값을 실제 데이터 구조와 계산 기준에 맞춰 교체합니다.
