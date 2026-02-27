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

### 3. AI Self-Verification Loop (필수)

작업 후 반드시 아래 명령으로 자기 검증을 실행합니다.

```bash
node scripts/ai-verify.mjs
```

출력이 `STATUS: READY` 가 될 때까지 다음 루프를 반복합니다.

```
① node scripts/ai-verify.mjs 실행
② FAIL 이면 → 에러별 FIX 지침을 읽고 파일 수정
③ 다시 ①로 돌아가 재실행
④ STATUS: READY 확인 → 작업 완료
```

**READY 확인 전까지 작업 완료로 간주하지 않습니다.**

#### 에러 유형별 수정 전략

| 에러 코드 | 원인 | 수정 방법 |
|-----------|------|-----------|
| `[RAW]` | 하드코딩 색상 | primitive alias `{경로}`로 교체 |
| `[REF]` | 깨진 참조 | 실제 존재하는 경로로 수정 |
| `[POLICY]` | component→primitive 직참조 | semantic 경유 or `exceptionCategory` 추가 |
| `[META]` | meta 필드 누락/오류 | `meta.layer`, `meta.policy` 추가 |
| `[SCHEMA]` | 허용되지 않은 property/state | schema 기준으로 경로 수정 |
| `[MATRIX]` | 필수 토큰 누락 | 해당 토큰 경로를 tokens 파일에 추가 |
| `[TYPO]` | `.aplha.` 오타 | `.alpha.`로 수정 |

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
