#!/usr/bin/env node
/**
 * Kiln Token Release CLI
 *
 * 사용법:
 *   node scripts/release.mjs patch   ← 버그픽스 (0.1.0 → 0.1.1)
 *   node scripts/release.mjs minor   ← 신규 토큰 추가 (0.1.0 → 0.2.0)
 *   node scripts/release.mjs major   ← 파괴적 변경 (0.1.0 → 1.0.0)
 *   node scripts/release.mjs --dry-run patch  ← 실제 변경 없이 시뮬레이션
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// ---- Args ----
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const bumpType = args.find((a) => ["patch", "minor", "major"].includes(a));

if (!bumpType) {
  console.error("Usage: node scripts/release.mjs [--dry-run] patch|minor|major");
  process.exit(1);
}

const ROOT = path.resolve(import.meta.dirname, "..");
const PKG_PATH = path.join(ROOT, "package.json");
const TOKENS_PATH = path.join(ROOT, "tokens", "kiln.with_meta.json");
const DIST_DIR = path.join(ROOT, "dist");
const CHANGELOG_PATH = path.join(ROOT, "CHANGELOG.md");

// ---- Step 1: Lint guard ----
console.log("\n🔍 Step 1: Running token lint...");
try {
  execSync("node scripts/lint-tokens.mjs tokens/kiln.with_meta.json schema/component-schema.json", {
    cwd: ROOT,
    stdio: "inherit",
  });
} catch {
  console.error("\n❌ Release blocked: token lint failed. Fix errors first.");
  process.exit(1);
}

// ---- Step 2: Version bump ----
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf-8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);

let nextVersion;
if (bumpType === "major") nextVersion = `${major + 1}.0.0`;
else if (bumpType === "minor") nextVersion = `${major}.${minor + 1}.0`;
else nextVersion = `${major}.${minor}.${patch + 1}`;

console.log(`\n📦 Step 2: Version bump ${pkg.version} → ${nextVersion} (${bumpType})`);

// ---- Step 3: Collect release stats ----
const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));

function countLeaves(node) {
  if (!node || typeof node !== "object") return 0;
  if ("type" in node && "value" in node) return 1;
  return Object.values(node).reduce((s, v) => s + countLeaves(v), 0);
}

const stats = {
  total: countLeaves(tokens),
  semantic: countLeaves(tokens?.color?.semantic),
  component: countLeaves(tokens?.color?.component),
  primitive: countLeaves(tokens?.["🔒primitive font&color"]),
};

console.log(
  `   Token stats: ${stats.total} total` +
    ` (semantic=${stats.semantic}, component=${stats.component}, primitive=${stats.primitive})`
);

// ---- Step 4: Changelog entry ----
const today = new Date().toISOString().split("T")[0];
const changelogEntry = `## v${nextVersion} — ${today}\n\n- Token stats: ${stats.total} total (semantic=${stats.semantic}, component=${stats.component}, primitive=${stats.primitive})\n- Released via \`node scripts/release.mjs ${bumpType}\`\n\n`;

// ---- Step 5: Build dist artifact ----
console.log(`\n📁 Step 3: Building dist artifact...`);

if (!isDryRun) {
  // version bump
  pkg.version = nextVersion;
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n");

  // dist 폴더
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

  // versioned snapshot
  fs.copyFileSync(TOKENS_PATH, path.join(DIST_DIR, `kiln-tokens-${nextVersion}.json`));

  // latest alias
  fs.copyFileSync(TOKENS_PATH, path.join(DIST_DIR, "kiln-tokens-latest.json"));

  // schema snapshot
  fs.copyFileSync(
    path.join(ROOT, "schema", "component-schema.json"),
    path.join(DIST_DIR, `kiln-schema-${nextVersion}.json`)
  );

  console.log(`   → dist/kiln-tokens-${nextVersion}.json`);
  console.log(`   → dist/kiln-tokens-latest.json`);
  console.log(`   → dist/kiln-schema-${nextVersion}.json`);

  // changelog prepend
  const existing = fs.existsSync(CHANGELOG_PATH)
    ? fs.readFileSync(CHANGELOG_PATH, "utf-8")
    : "# Changelog\n\n";
  const header = existing.startsWith("# Changelog") ? existing : "# Changelog\n\n" + existing;
  const body = header.replace("# Changelog\n\n", "# Changelog\n\n" + changelogEntry);
  fs.writeFileSync(CHANGELOG_PATH, body);

  // git commit + tag
  console.log(`\n🏷  Step 4: Git commit + tag v${nextVersion}...`);
  try {
    execSync(`git add package.json dist/ CHANGELOG.md`, { cwd: ROOT, stdio: "inherit" });
    execSync(`git commit -m "release: v${nextVersion}"`, { cwd: ROOT, stdio: "inherit" });
    execSync(`git tag v${nextVersion}`, { cwd: ROOT, stdio: "inherit" });
    console.log(`   → Tagged v${nextVersion}`);
  } catch (e) {
    console.error(`   ⚠️  Git operation failed: ${e.message}`);
    console.error("   (Dist artifact created, but commit/tag failed — run manually if needed)");
  }
} else {
  console.log("   [dry-run] Would write:");
  console.log(`     dist/kiln-tokens-${nextVersion}.json`);
  console.log(`     dist/kiln-tokens-latest.json`);
  console.log(`     dist/kiln-schema-${nextVersion}.json`);
  console.log(`     CHANGELOG.md entry`);
  console.log(`     git commit "release: v${nextVersion}" + tag v${nextVersion}`);
}

// ---- Done ----
console.log(`\n✅ Release ${isDryRun ? "(dry-run) " : ""}complete: v${nextVersion}`);
console.log(
  `\n   Consumers can import:\n   import tokens from "./dist/kiln-tokens-latest.json";\n`
);
