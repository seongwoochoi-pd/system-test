import tokens from "../../tokens/kiln.with_meta.json";

/**
 * path 예: "color.component.button.primary.background.rest"
 */
export function getTokenValue(path: string): string {
  const parts = path.split(".");
  let cur: any = tokens;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) {
      throw new Error(`Token path not found: ${path} (missing: ${p})`);
    }
    cur = cur[p];
  }
  // 토큰 leaf는 보통 { type, value, meta ... } 형태
  if (cur && typeof cur === "object" && "value" in cur) return cur.value as string;
  // 혹시 value가 직접일 경우
  if (typeof cur === "string") return cur;
  throw new Error(`Token leaf has no value: ${path}`);
}

/**
 * {some.path} 같은 alias 참조를 최소로 해석합니다.
 * - primitive/semantic/component 참조는 같은 JSON 안에서 풀립니다.
 * - raw hex/rgba는 그대로 반환합니다.
 */
export function resolveToken(path: string, maxDepth = 10): string {
  let v = getTokenValue(path);
  for (let i = 0; i < maxDepth; i++) {
    const m = typeof v === "string" ? v.match(/^\{(.+)\}$/) : null;
    if (!m) return v;
    // "{color.semantic.foreground.default}" 같은 참조
    const refPath = m[1];
    v = getTokenValue(refPath);
  }
  throw new Error(`Token reference depth exceeded: ${path}`);
}
