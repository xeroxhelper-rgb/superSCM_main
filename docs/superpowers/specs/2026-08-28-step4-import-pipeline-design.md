# STEP 4 데이터 적재 파이프라인 설계

## 목표

CSV와 Excel 파일을 서버에서 파싱·검증하고, 사용자가 확인한 데이터만 기존 `raw` 테이블에 batch 단위로 적재한다. 업로드 이력, 행별 오류, 오류 CSV 다운로드, rollback을 제공하며 STEP 2 RBAC과 STEP 3 적재 추적 컬럼을 유지한다.

## 범위와 순서

이번 설계는 STEP 4만 다룬다. STEP 5 Demand Profile은 STEP 4의 적재 계약이 확정된 뒤 별도 설계와 계획으로 진행한다.

구현 흐름은 다음과 같다.

```text
파일 선택 → import type/mode 선택 → 서버 parse → staging 저장
→ 표준 컬럼 mapping → validation → preview/result
→ 사용자 승인 → 서버 RPC import → raw 저장 → history
```

Validation이 끝나지 않았거나 ERROR 행이 남아 있으면 Import RPC를 호출할 수 없다. WARNING은 사용자가 확인한 경우에만 승인할 수 있다.

## 지원 범위

현재 STEP 3 및 `SCHEMA.md`에 정의된 raw 입력 테이블만 지원한다.

| import type | 대상 raw 테이블 | 주요 표준 컬럼 |
|---|---|---|
| `usage_history` | `raw.usage_history` | `item_id`, `use_date`, `qty`, `warehouse`, `note` |
| `inventory` | `raw.inventory` | 기존 테이블의 실제 컬럼 계약 |
| `item_master` | `raw.item_master` | 기존 테이블의 실제 컬럼 계약 |
| `supplier_master` | `raw.supplier_master` | 기존 테이블의 실제 컬럼 계약 |
| `purchase_order` | `raw.purchase_order` | 기존 테이블의 실제 컬럼 계약 |
| `goods_receipt` | `raw.goods_receipt` | 기존 테이블의 실제 컬럼 계약 |
| `sales_order` | `raw.sales_order` | STEP 3 표준 컬럼 |
| `business_event` | `raw.business_event` | STEP 3 표준 컬럼 |

존재하지 않는 테이블이나 컬럼은 import type으로 노출하지 않는다. 표준 컬럼 정의는 `lib/import/schema.ts`의 단일 registry에서 관리하고 DB 적재 컬럼은 migration의 실제 계약과 일치시킨다.

## DB 구조

새 migration은 기존 raw 테이블을 drop/recreate하지 않는다.

### `core.upload_batch`

`batch_id uuid primary key`, `file_name`, `import_type`, `import_mode`, `total_rows`, `success_rows`, `warning_rows`, `error_rows`, `status`, `uploaded_by`, `uploaded_at`, `imported_at`, `validation_completed_at`, `rolled_back_at`, `rollback_reason`을 저장한다. 상태는 `UPLOADED`, `PARSING`, `VALIDATING`, `VALIDATED`, `IMPORTING`, `IMPORTED`, `FAILED`, `ROLLED_BACK`으로 제한한다.

### `core.import_staging`

`staging_id bigint identity`, `batch_id`, `row_number`, `raw_data jsonb`, `mapped_data jsonb`, `validation_status`, `created_at`을 저장한다. 파일 원본 값은 `raw_data`에 보존하고, 표준 컬럼으로 연결된 값은 `mapped_data`에 저장한다. 이 테이블은 사용자 승인 전의 유일한 데이터 원천이다.

### `core.column_mapping`

`mapping_id bigint identity`, `import_type`, `source_column`, `target_column`, `confidence`, `created_by`, `created_at`, `updated_at`을 저장한다. `import_type + source_column`에 unique 제약을 두고, 자동 추정 결과도 사용자가 확정한 경우에만 재사용한다.

### `core.validation_error`

`error_id bigint identity`, `batch_id`, `staging_id`, `row_number`, `field_name`, `error_code`, `error_message`, `severity`, `original_value`, `created_at`을 저장한다. `severity`는 `WARNING` 또는 `ERROR`만 허용한다.

### RPC 경계

- `core.import_batch(batch_id uuid, confirmed boolean)`
  - 호출자 active authenticated 확인
  - ADMIN만 `replace` 수행 가능
  - `VALIDATED` 상태와 승인 여부 확인
  - ERROR 행이 있으면 거부
  - 성공 행만 기존 raw 테이블에 기록
  - `batch_id`, `source_type = 'FILE_UPLOAD'`, `loaded_at`, `source_record_id`를 항상 채움
  - 결과 건수와 상태를 같은 transaction에서 갱신
- `core.rollback_batch(batch_id uuid)`
  - ADMIN만 호출 가능
  - replace batch는 완전 rollback 불가 상태를 명확히 반환
  - append/upsert로 적재된 해당 batch의 행만 삭제
  - 다른 batch의 행은 조건상 삭제하지 않음

RPC는 `security definer`, 고정 `search_path`, 명시적 권한 검사를 사용하고 anon에는 execute 권한을 주지 않는다. service role key는 사용하지 않는다.

## 서버 코드 경계

- `lib/import/types.ts`: import type, mode, status, row/result 타입
- `lib/import/schema.ts`: 지원 타입별 표준 컬럼, 필수값, 날짜·숫자 필드 registry
- `lib/import/parse.ts`: `papaparse`와 `xlsx`를 이용한 서버 전용 CSV/XLSX parser
- `lib/import/validate.ts`: 단일 validation 모듈. null, 타입, 날짜, duplicate, master 존재 여부, 음수, 날짜 관계를 검사하고 원본 값을 보존
- `lib/import/repository.ts`: staging, mapping, validation error, batch history 조회·저장
- `lib/import/history.ts`: history 조회와 오류 CSV 행 생성
- `app/api/import/parse/route.ts`: 인증 후 파일 크기·확장자 검사, parse 및 staging
- `app/api/import/validate/route.ts`: staging 기준 validation 실행
- `app/api/import/confirm/route.ts`: requireUser/requireAdmin과 승인 조건을 확인한 뒤 import RPC 호출
- `app/api/import/rollback/route.ts`: requireAdmin 후 rollback RPC 호출

화면은 parser, validation, 계산 로직을 가지지 않고 위 API 결과만 렌더링한다.

## Validation 규칙

각 오류는 원본 값과 reason code를 남긴다. 잘못된 날짜를 추측하거나 null 수량을 0으로 바꾸지 않는다.

- `REQUIRED_COLUMN_MISSING`: 표준 필수 컬럼 없음
- `REQUIRED_VALUE_MISSING`: 필수값 null 또는 빈 문자열
- `INVALID_NUMBER`: 숫자로 해석 불가
- `INVALID_DATE`: ISO 또는 허용된 날짜 형식 아님
- `DUPLICATE_SOURCE_ROW`: 파일 안 중복
- `DUPLICATE_EXISTING_ROW`: append/upsert 기준 기존 데이터 충돌
- `UNKNOWN_ITEM`: `core.v_item_master`에 없는 품목
- `UNKNOWN_SUPPLIER`: `core` 공급처 기준에 없는 공급처
- `NEGATIVE_QUANTITY`: 허용되지 않는 음수 수량
- `DATE_ORDER_INVALID`: 입고일이 발주일보다 빠름 등 날짜 관계 오류
- `UNSUPPORTED_COLUMN`: mapping되지 않은 컬럼

`ERROR`는 Import을 차단하고, `WARNING`은 사용자 확인 후 허용한다. 오류 행을 조용히 제거하지 않으며 ERROR/WARNING 행은 원본 컬럼과 오류 메타데이터를 포함한 CSV로 다운로드한다.

## Import mode

- `append`: 승인된 행을 추가한다. 기존 동일 키 충돌은 validation ERROR로 처리한다.
- `upsert`: 대상 테이블의 명시된 business key로 insert/update한다. 변경 전후 batch와 audit 정보를 남긴다.
- `replace`: 대상 import type의 기존 데이터 전체에 영향을 줄 수 있으므로 ADMIN과 명시적 확인이 필요하다. 완전한 batch rollback이 보장되지 않으면 실행 전과 history에 제한을 표시한다.

## Forecast stale 처리

수요 관련 import가 `IMPORTED`가 되면 기존 forecast 결과를 삭제하지 않는다. 현재 forecast run에 `data_snapshot_at`이 있는 경우 import의 `loaded_at`이 snapshot 이후인지 조회할 수 있는 상태를 제공하고, 해당 run을 stale로 표시하는 기존 구조가 있으면 그 필드 또는 view를 연결한다. 기존 계산 SQL은 변경하지 않고, stale 판정은 데이터 시점 비교로 한정한다.

## 권한과 RLS

- anon: batch, staging, mapping, validation error, raw 모두 접근 차단
- authenticated USER: 자신의 업로드 batch와 staging/history 조회, 허용된 non-replace import 준비
- ADMIN: 모든 import type, replace, rollback, 운영 history 조회
- raw 직접 insert/update/delete는 차단하고 import RPC만 적재 경로로 허용

RLS는 `uploaded_by = auth.uid()`와 `core.is_admin()`을 조합한다. UI에서 메뉴를 숨기는 것과 별개로 모든 API와 RPC가 서버와 DB에서 다시 검사한다.

## 테스트 전략

- CSV/XLSX parser가 표준 컬럼과 원본 값을 보존하는지
- 한국어/영문 컬럼 자동 추정 후 사용자 확정 mapping이 적용되는지
- 필수값, 날짜, 숫자, 품목·공급처, duplicate, 음수, 날짜 관계 오류
- ERROR가 있으면 import가 거부되고 WARNING만 있을 때 확인 후 성공하는지
- append/upsert/replace 경계와 replace 권한
- 모든 raw 행에 동일 batch_id와 FILE_UPLOAD가 기록되는지
- batch rollback이 다른 batch를 삭제하지 않는지
- 오류 CSV가 원본 컬럼과 오류 메타데이터를 포함하는지
- 미로그인/USER/ADMIN별 API 및 RPC 거부·허용

단위 테스트는 `lib/import/*.test.ts`에 두고, DB 동작은 `sql/05-step4-verify.sql`의 읽기 전용 검증 쿼리와 수동 Supabase 테스트로 확인한다.

## 운영상 제약

- 파일 크기와 행 수 상한은 서버 환경에 맞춰 명시한다.
- replace의 완전 rollback이 보장되지 않는 대상은 UI에서 선택할 수 없게 한다.
- Supabase SQL migration은 사용자가 SQL Editor에서 전체 실행해야 한다.
- STEP 5 이후에도 Demand Profile은 `core.v_train_demand`를 사용하며 raw 직접 조회를 추가하지 않는다.
