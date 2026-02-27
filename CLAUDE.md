# Kiln Playground — Claude 작업 규칙

이 레포는 디자인 시스템 토큰 기반 컴포넌트 검증 공간입니다.
AI(Claude Code)는 아래 규칙을 반드시 준수해야 합니다.

---

## 작업 범위 (수정 가능 영역)

```
src/pages/ai-output.tsx    ← AI 실험 페이지 (메인 작업 공간)
src/pages/*                ← 신규 실험 페이지 추가 가능
```

## 수정 금지 영역

아래 경로는 절대 수정하지 않습니다.
변경이 필요하다고 판단되면 PR 코멘트로 제안만 합니다.

```
tokens/          ← 토큰 정의 (design-system-owners 전용)
schema/          ← 컴포넌트 스키마 (design-system-owners 전용)
src/components/  ← 공유 컴포넌트 (design-system-owners 전용)
scripts/         ← lint 스크립트 (design-system-owners 전용)
```

---

## 코드 작성 규칙

### 1. 토큰만 사용, raw value 금지

```tsx
// ✅ 올바른 사용
import { resolveToken } from "../lib/token";
const bg = resolveToken("color.component.button.primary.background.rest");

// ❌ 하드코딩 금지
const bg = "#6366F1";
const bg = "rgba(99,102,241,1)";
```

### 2. 존재하는 토큰 경로만 참조

새로운 axis / state / property를 임의로 만들지 않습니다.
허용된 값은 `schema/component-schema.json`의 `vocabulary`, `stateMatrix`, `propertyAllowlist`를 따릅니다.

### 3. 작업 후 반드시 lint 실행

```bash
npm run lint:tokens
```

실패하면 에러 로그를 읽고 원인을 파악한 뒤 수정합니다.
수정 후 다시 실행해서 통과를 확인합니다. **통과 전까지 작업 완료로 간주하지 않습니다.**

---

## 토큰 경로 참조 방법

```typescript
import { resolveToken } from "../lib/token";

// color.component.{component}.{variant}.{property}.{state}
resolveToken("color.component.button.primary.background.rest")
resolveToken("color.component.button.secondary.foreground.hover")

// color.semantic.{category}.{role}
resolveToken("color.semantic.foreground.default")
resolveToken("color.semantic.background.danger")
```

토큰 전체 목록: `tokens/kiln.with_meta.json`
컴포넌트 스키마: `schema/component-schema.json`
