# 오류 기록

## 2026-08-28 — Next.js route group 경로 충돌

### 오류

`npm run build`에서 다음 오류가 발생했습니다.

```text
You cannot have two parallel pages that resolve to the same path.
Please check /(admin)/page and /(user)/page.
```

### 원인

Next.js의 route group 폴더명인 `(admin)`과 `(user)`는 URL 경로에 포함되지 않습니다. 따라서 `app/(admin)/page.tsx`와 `app/(user)/page.tsx`가 모두 `/` 경로로 해석되어 충돌했습니다.

### 해결책

사용자 홈은 `app/(user)/page.tsx`에서 `/`로 유지하고, 관리자 홈은 `app/(admin)/admin/page.tsx`로 이동해 `/admin` 경로가 되도록 분리합니다. 관리자 layout은 `app/(admin)/layout.tsx`에 유지합니다.

### 검증

수정 후 `npm run build`를 다시 실행해 route 충돌이 사라졌는지 확인합니다.
