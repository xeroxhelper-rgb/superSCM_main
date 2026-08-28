# STEP 1 디자인 시스템·라우팅 기반 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 SCM 화면을 공통 디자인 시스템, 공통 UI 컴포넌트, 역할별 라우팅, 레거시 격리 구조로 전환하고 Lead Time·Stockout Risk 화면에서 재사용성을 검증한다.

**Architecture:** 전역 토큰은 `app/globals.css`에 두고 스타일을 shell/component/chart 파일로 분리한다. 사용자·관리자 화면은 route group과 `lib/menu.ts`로 구성하고, 기존 workflow는 `(legacy)` 아래로 격리한다. 분석 화면은 `lib/scm-model.ts`와 `lib/scm.ts`의 데이터 경계를 유지하며 공통 UI만 교체한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, 순수 CSS, Supabase, lucide-react, Node test runner

**Spec:** `design.md` 및 사용자 제공 STEP1 요구사항

## Global Constraints

- 스타일은 순수 CSS이며 Tailwind, styled-components, CSS Modules를 추가하지 않는다.
- 화면 컴포넌트에 hex 색상을 직접 작성하지 않는다.
- `raw`를 직접 조회하지 않고 `core`·`analytics` 경계를 유지한다.
- 계산 로직과 기존 DB 계산 로직을 변경하지 않는다.
- 계산 불가 값은 `— + reason_code` 형식으로 표시한다.
- 화면 문구·주석·커밋 메시지는 한국어로 작성한다.
- 기존 `AGENTS.md`, `ARCHITECTURE.md`, `design.md`의 미커밋 변경은 덮어쓰지 않는다.

---

### Task 1: 스타일 토큰과 공통 스타일 레이어

**Files:**
- Create: `styles/shell.css`
- Create: `styles/components.css`
- Create: `styles/chart.css`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `--color-*`, `--space-*`, `--radius-*` 토큰과 shell/component/chart 공통 클래스

- [ ] 기존 `app/globals.css`의 공통 클래스 목록과 사용처를 확인한다.
- [ ] `globals.css`를 토큰·reset·세 스타일시트 import 중심으로 정리한다.
- [ ] shell 레이아웃과 반응형 규칙을 `styles/shell.css`에 작성한다.
- [ ] panel, button, badge, table, form, empty/error 상태 스타일을 `styles/components.css`에 작성한다.
- [ ] 차트 컨테이너와 SVG 보조 스타일을 `styles/chart.css`에 작성한다.
- [ ] 기존 화면이 즉시 깨지지 않도록 기존 클래스의 호환 규칙을 유지한다.

### Task 2: 공통 UI 컴포넌트와 메뉴 모델

**Files:**
- Create: `components/shell/sidebar.tsx`
- Create: `components/shell/topbar.tsx`
- Create: `components/shell/page-header.tsx`
- Create: `components/ui/kpi-card.tsx`
- Create: `components/ui/panel.tsx`
- Create: `components/ui/badge.tsx`
- Create: `components/ui/button.tsx`
- Create: `components/ui/data-table.tsx`
- Create: `components/ui/alert-row.tsx`
- Create: `components/ui/insight-banner.tsx`
- Create: `components/ui/empty-value.tsx`
- Create: `lib/menu.ts`

**Interfaces:**
- `MenuItem`: `{ href: string; label: string; description?: string; icon?: LucideIcon; status?: 'ready' | 'locked' }`
- `menuByRole`: `{ user: MenuItem[]; admin: MenuItem[] }`
- `EmptyValue`: `{ reason?: string | null; label?: string }`
- `Badge`: `{ status: 'safe' | 'warning' | 'critical' | 'calculation_unavailable' | 'info' }`
- `DataTable<T>`: columns, rows, rowKey, empty state, error state를 받는 제네릭 표

- [ ] `lib/menu.ts`에 USER·ADMIN 메뉴를 단일 소스로 정의한다.
- [ ] 상태 배지는 SAFE, WARNING, CRITICAL, CALCULATION_UNAVAILABLE을 공통 타입으로 사용한다.
- [ ] `EmptyValue`가 `—`와 reason code를 분리해 표시하도록 만든다.
- [ ] `Panel`, `KpiCard`, `AlertRow`, `InsightBanner`를 순수 표시 컴포넌트로 만든다.
- [ ] 기존 `components/analysis/data-table.tsx`의 기능을 새 UI 표로 옮기되 기존 파일은 호환용으로 유지한다.
- [ ] 공통 컴포넌트 내부에 DB 조회나 계산 로직을 넣지 않는다.

### Task 3: Route group과 레거시 격리

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(user)/layout.tsx`
- Create: `app/(user)/page.tsx`
- Create: `app/(user)/analysis/leadtime/page.tsx`
- Create: `app/(user)/analysis/stockout/page.tsx`
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/page.tsx`
- Create: `app/(legacy)/workflow/page.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- `/`는 USER 대시보드로 연결한다.
- `/analysis/leadtime`와 `/analysis/stockout`은 USER 분석 화면으로 연결한다.
- `/admin`은 ADMIN 진입 화면으로 연결한다.
- `/login`은 AUTH 진입 화면으로 연결한다.
- `/workflow`는 기존 레거시 workflow 진입점으로 격리한다.

- [ ] 기존 홈 동작을 직접 삭제하지 않고 `(legacy)/workflow` 진입점에서 렌더링한다.
- [ ] route group layout은 `Sidebar`, `Topbar`, `main` shell을 조립한다.
- [ ] `/`와 `/admin`은 각각 `lib/menu.ts`의 역할별 메뉴만 사용한다.
- [ ] 인증 구현 전까지 `/login`은 준비 화면으로 두고 인증 로직을 발명하지 않는다.

### Task 4: 분석 모델과 Lead Time 화면 전환

**Files:**
- Modify: `lib/scm-model.ts`
- Modify: `lib/scm.ts`
- Modify: `app/(user)/analysis/leadtime/page.tsx`
- Test: `lib/scm-model.test.ts`

**Interfaces:**
- Existing `getLeadtimeGap()`의 Supabase 조회 경계를 유지한다.
- `LeadtimeGap`의 nullable 숫자는 `EmptyValue`로 렌더링한다.

- [ ] 기존 `app/analysis/leadtime/page.tsx`의 데이터 조회와 정규화 흐름을 보존한다.
- [ ] 공통 `PageHeader`, `KpiCard`, `Panel`, `DataTable`, `EmptyValue`를 사용해 화면을 재구성한다.
- [ ] `gap === null`, `masterLeadTime === null`, `p80 === null`을 임의의 0으로 바꾸지 않는다.
- [ ] 샘플/실제 데이터 상태를 `SUPABASE LIVE` 등 기존 의미와 일치하게 표시한다.
- [ ] 정규화 테스트를 실행해 기존 alias 동작을 보존한다.

### Task 5: Stockout Risk 조회·모델·화면 검증

**Files:**
- Modify: `lib/scm-model.ts`
- Modify: `lib/scm.ts`
- Create: `app/(user)/analysis/stockout/page.tsx`
- Create: `lib/scm-stockout-model.test.ts`

**Interfaces:**
- `StockoutRisk` fields: `itemId`, `itemName`, `supplier`, `currentStock`, `inboundQty`, `availableQty`, `dailyUsageAvg`, `plannedLeadTime`, `stockoutDays`, `stockoutDate`, `riskStatus`, `reason`
- `getStockoutRisk(): Promise<{ rows: StockoutRisk[]; error: string | null }>`
- `getStockoutKpi()`의 기존 반환 구조를 유지한다.

- [ ] `analytics.v_stockout_risk`의 실제 컬럼을 nullable-aware 방식으로 정규화한다.
- [ ] `risk_status`를 SAFE/WARNING/CRITICAL/CALCULATION_UNAVAILABLE으로 표시한다.
- [ ] `stockout_days`, `stockout_date`가 null이면 `EmptyValue`로 `— + reason`을 표시한다.
- [ ] 화면 컴포넌트에서 평균·소진일·위험 판정을 계산하지 않는다.
- [ ] 조회 오류와 빈 결과를 별도 상태로 표시한다.
- [ ] SCHEMA.md의 기대 행 수 20건을 기준으로 표시 건수를 검증한다.

### Task 6: 검증과 마무리

**Files:**
- Verify: all changed source files

- [ ] 화면 파일의 직접 hex 색상 검색 결과가 0건인지 확인한다.
- [ ] 주요 route(`/`, `/login`, `/admin`, `/analysis/leadtime`, `/analysis/stockout`, `/workflow`)가 빌드 목록에 있는지 확인한다.
- [ ] `npm test`를 실행한다.
- [ ] `npm run build`를 실행한다.
- [ ] 레거시 컴포넌트가 새 공통 컴포넌트와 섞여 직접 중복 메뉴를 만들지 않는지 확인한다.
- [ ] 변경 파일·신규 파일·레거시 격리·테스트 결과·남은 작업을 보고한다.
