#!/usr/bin/env node
/**
 * AI Self-Verification Report
 *
 * Claude Code가 작업 후 자동으로 실행하여:
 *   1. 토큰 lint 결과를 구조화된 형태로 출력
 *   2. 수정이 필요한 항목을 명확하게 지시
 *
 * 사용법:
 *   node scripts/ai-verify.mjs
 *
 * 출력 형식:
 *   PASS → 작업 완료로 간주
 *   FAIL → 에러 목록 + 각 에러별 수정 지침 출력 (Claude가 읽고 즉시 수정)
 */

import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "..");

// ---- 1. Token Lint ----
let lintPassed = false;
let lintOutput = "";

try {
  lintOutput = execSync(
    "node scripts/lint-tokens.mjs tokens/kiln.with_meta.json schema/component-schema.json",
    { cwd: ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
  );
  lintPassed = true;
} catch (e) {
  lintOutput = (e.stdout ?? "") + (e.stderr ?? "");
  lintPassed = false;
}

// ---- 2. Parse lint errors ----
const lintErrors = lintOutput
  .split("\n")
  .filter((l) => l.trim().startsWith("- ["))
  .map((l) => l.trim().slice(2)); // remove "- "

// ---- 3. Error-to-fix mapping ----
const FIX_GUIDE = {
  "[RAW]": "raw color value → 동일 색상의 primitive 토큰 경로({중괄호} alias)로 교체하세요.",
  "[REF]": "참조 경로를 확인하세요. tokens/kiln.with_meta.json에 해당 경로가 존재하는지 확인 후 수정하세요.",
  "[POLICY]":
    "component 토큰이 primitive를 직접 참조하고 있습니다. semantic 토큰을 경유하도록 수정하거나, exceptionCategory(disabled|overlay_alpha|fixed_color)를 meta에 추가하세요.",
  "[META]":
    "meta 필드가 없거나 layer가 틀렸습니다. meta: { layer, policy } 를 토큰에 추가하세요.",
  "[SCHEMA]":
    "schema에 정의되지 않은 property 또는 state입니다. schema/component-schema.json의 propertyAllowlist / stateMatrix를 확인하세요.",
  "[MATRIX]":
    "스키마에서 요구하는 토큰 경로가 없습니다. tokens/kiln.with_meta.json에 해당 경로를 추가하세요.",
  "[TYPO]": "'.aplha.' 오타가 있습니다. '.alpha.'로 수정하세요.",
};

function getFixGuide(errorLine) {
  for (const [prefix, guide] of Object.entries(FIX_GUIDE)) {
    if (errorLine.startsWith(prefix)) return guide;
  }
  return "에러 내용을 읽고 tokens/kiln.with_meta.json 또는 schema/component-schema.json을 수정하세요.";
}

// ---- 4. Git status ----
let gitStatus = "";
try {
  gitStatus = execSync("git status --short", { cwd: ROOT, encoding: "utf-8" });
} catch {
  gitStatus = "(git unavailable)";
}

const hasUncommitted = gitStatus.trim().length > 0;

// ---- 5. Report ----
console.log("=".repeat(60));
console.log("  KILN AI SELF-VERIFICATION REPORT");
console.log("=".repeat(60));

// Lint result
if (lintPassed) {
  console.log("\n✅ [LINT] PASS — 토큰 lint 통과");
} else {
  console.log(`\n❌ [LINT] FAIL — ${lintErrors.length}개 에러 발견`);
  console.log("\n── 수정 지침 ──────────────────────────────────────────");
  for (const err of lintErrors) {
    const guide = getFixGuide(err);
    console.log(`\n  ERROR: ${err}`);
    console.log(`  FIX:   ${guide}`);
  }
  console.log("\n────────────────────────────────────────────────────────");
  console.log("\n🔁 수정 후 다시 실행: node scripts/ai-verify.mjs");
}

// Git status
if (hasUncommitted) {
  console.log(`\n📝 [GIT] 미커밋 변경 있음:`);
  for (const line of gitStatus.trim().split("\n")) {
    console.log(`   ${line}`);
  }
} else {
  console.log("\n✅ [GIT] 미커밋 변경 없음");
}

// Summary
console.log("\n" + "=".repeat(60));

const allOk = lintPassed;
if (allOk) {
  console.log("  STATUS: READY — 작업 완료로 간주합니다.");
} else {
  console.log("  STATUS: NOT READY — 위 에러를 모두 수정하세요.");
  process.exit(1);
}

console.log("=".repeat(60) + "\n");
