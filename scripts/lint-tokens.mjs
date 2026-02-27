import fs from "node:fs";

const TOKENS_PATH = process.argv[2] ?? "tokens/kiln.with_meta.json";
const SCHEMA_PATH = process.argv[3] ?? "schema/component-schema.json";

const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf-8"));

let ok = true;
const errors = [];

function fail(msg) {
  ok = false;
  errors.push(msg);
}

function isTokenLeaf(node) {
  return node && typeof node === "object" && "type" in node && "value" in node;
}

function isRawColorValue(v) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return (
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s) ||
    /^rgba?\(/.test(s)
  );
}

function isAliasRef(v) {
  return typeof v === "string" && /^\{.+\}$/.test(v.trim());
}

function stripBraces(v) {
  return v.trim().slice(1, -1);
}

function getByPath(root, path) {
  const parts = path.split(".");
  let cur = root;
  for (const p of parts) {
    if (!cur || typeof cur !== "object" || !(p in cur)) return { ok: false };
    cur = cur[p];
  }
  return { ok: true, value: cur };
}

function getTokenValueByPath(path) {
  const hit = getByPath(tokens, path);
  if (!hit.ok) return { ok: false };
  const node = hit.value;
  if (isTokenLeaf(node)) return { ok: true, value: node.value, node };
  if (typeof node === "string") return { ok: true, value: node, node };
  return { ok: false };
}

function resolveRef(path, maxDepth = 20) {
  let curPath = path;
  for (let i = 0; i < maxDepth; i++) {
    const hit = getTokenValueByPath(curPath);
    if (!hit.ok) return { ok: false, reason: `missing token at ${curPath}` };
    const v = hit.value;
    if (!isAliasRef(v)) return { ok: true, value: v, leafPath: curPath, leafNode: hit.node };
    curPath = stripBraces(v);
  }
  return { ok: false, reason: `reference loop/depth exceeded at ${path}` };
}

function layerFromPath(path) {
  if (path.startsWith("color.semantic.")) return "semantic";
  if (path.startsWith("color.component.")) return "component";
  if (path.includes(".primitive.")) return "primitive";
  if (path.startsWith("🔒primitive")) return "primitive";
  return "unknown";
}

function isPrimitivePath(refPath) {
  return (
    refPath.includes(".primitive.") ||
    refPath.startsWith("🔒primitive ") ||
    refPath.startsWith("🔒primitive")
  );
}

const allowedPrimitiveExceptions = new Set(["disabled", "overlay_alpha", "fixed_color"]);

function validateMetaPolicy(path, leaf) {
  const layer = layerFromPath(path);

  if ((layer === "semantic" || layer === "component") && !leaf.meta) {
    fail(`[META] missing meta: ${path}`);
    return;
  }

  if (leaf.meta?.layer && leaf.meta.layer !== layer && layer !== "unknown") {
    fail(`[META] meta.layer mismatch: ${path} (meta.layer=${leaf.meta.layer}, pathLayer=${layer})`);
  }

  // typo detection in value
  if (typeof leaf.value === "string" && leaf.value.includes(".aplha.")) {
    fail(`[TYPO] '.aplha.' found: ${path} => ${leaf.value}`);
  }

  // raw value forbidden (semantic/component)
  if ((layer === "semantic" || layer === "component") && isRawColorValue(leaf.value)) {
    fail(`[RAW] raw color forbidden: ${path} => ${leaf.value}`);
  }

  // alias must resolve
  if (isAliasRef(leaf.value)) {
    const refPath = stripBraces(leaf.value);
    const r = resolveRef(refPath);
    if (!r.ok) fail(`[REF] unresolved ref: ${path} => ${leaf.value} (${r.reason})`);
  }

  // component → primitive direct reference rule
  if (layer === "component" && isAliasRef(leaf.value)) {
    const refPath = stripBraces(leaf.value);
    if (isPrimitivePath(refPath)) {
      const ex = leaf.meta?.exceptionCategory;
      if (!ex || !allowedPrimitiveExceptions.has(ex)) {
        fail(
          `[POLICY] component direct primitive not allowed without exceptionCategory: ${path} => ${leaf.value}`
        );
      }
      if (ex && !allowedPrimitiveExceptions.has(ex)) {
        fail(`[POLICY] unknown exceptionCategory: ${path} (exceptionCategory=${ex})`);
      }
    }
  }

  // semantic layer는 primitive를 참조하는 것이 설계 목적 (primitive → semantic 브릿지).
  // directPrimitiveAllowed: false 는 "다운스트림 소비자가 primitive를 직접 쓰지 마라"는
  // downstream 규칙이므로, semantic 토큰 자신의 값에 대한 self-reference check 는 하지 않음.
}

function collectLeaves(node, path = []) {
  if (!node || typeof node !== "object") return;
  if (isTokenLeaf(node)) {
    const p = path.join(".");
    validateMetaPolicy(p, node);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    collectLeaves(v, path.concat(k));
  }
}

// ---- Schema checks (component only) ----
function checkComponentSchema() {
  const componentRoot = getByPath(tokens, "color.component");
  if (!componentRoot.ok) return;

  const components = schema.components ?? {};

  for (const [compName, compSpec] of Object.entries(components)) {
    const compNodeHit = getByPath(tokens, `color.component.${compName}`);
    if (!compNodeHit.ok) continue; // 아직 토큰이 없을 수 있음

    const pathPattern = compSpec.tokenMap?.pathPattern;
    if (!pathPattern) continue;

    const variantVals = compSpec.axes?.variant?.values ?? [null];
    const subpartVals = compSpec.axes?.subpart?.values ?? [null];

    for (const variant of variantVals) {
      for (const subpart of subpartVals) {
        const subKey = subpart ?? "default";
        const allowedStates =
          compSpec.stateMatrix?.[subKey] ??
          compSpec.stateMatrix?.default ??
          [];
        const allowedProps =
          compSpec.propertyAllowlist?.[subKey] ??
          compSpec.propertyAllowlist?.default ??
          [];

        const basePathParts = ["color", "component", compName];
        if (variant) basePathParts.push(variant);
        if (subpart) basePathParts.push(subpart);

        const baseHit = getByPath(tokens, basePathParts.join("."));
        if (!baseHit.ok) continue;

        function walkPropState(n, curPathParts) {
          if (!n || typeof n !== "object") return;
          for (const [k, v] of Object.entries(n)) {
            const nextPath = curPathParts.concat(k);
            const depth = nextPath.length - basePathParts.length;

            if (depth === 1) {
              const property = k;
              if (!allowedProps.includes(property) && containsLeaf(v)) {
                fail(
                  `[SCHEMA] property not allowed: ${nextPath.join(".")} (allowed: ${allowedProps.join(",")})`
                );
              }
              walkPropState(v, nextPath);
            } else if (depth === 2) {
              const state = k;
              if (!allowedStates.includes(state) && containsLeaf(v)) {
                fail(
                  `[SCHEMA] state not allowed: ${nextPath.join(".")} (allowed: ${allowedStates.join(",")})`
                );
              }
              walkPropState(v, nextPath);
            } else {
              walkPropState(v, nextPath);
            }
          }
        }

        walkPropState(baseHit.value, basePathParts);
      }
    }
  }
}

function containsLeaf(node) {
  if (!node || typeof node !== "object") return false;
  if (isTokenLeaf(node)) return true;
  for (const v of Object.values(node)) {
    if (containsLeaf(v)) return true;
  }
  return false;
}

// Run
collectLeaves(tokens);
checkComponentSchema();

if (!ok) {
  console.error(`\n❌ Token lint failed (${errors.length})`);
  for (const e of errors) console.error(" - " + e);
  process.exit(1);
} else {
  console.log("✅ Token lint passed");
}
