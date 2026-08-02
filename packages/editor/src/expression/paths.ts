/**
 * サンプルデータ (data/state) の JSON を再帰的に歩いて、バインディングピッカーの
 * 候補パス一覧を作る。配列は最初の要素だけを覗く（要素の形は揃っている前提 — 揃っていない
 * サンプルはピッカーの候補が欠けるだけで、壊れはしない）。
 */
export function collectPaths(value: unknown, prefix: string, depth = 0): string[] {
  if (depth > 8 || value === null || value === undefined || typeof value !== 'object') {
    return prefix ? [prefix] : []
  }
  const paths: string[] = prefix ? [prefix] : []
  if (Array.isArray(value)) {
    if (value.length > 0) paths.push(...collectPaths(value[0], `${prefix}[0]`, depth + 1))
    return paths
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = prefix ? `${prefix}.${key}` : key
    paths.push(...collectPaths(child, childPath, depth + 1))
  }
  return paths
}
