import type { SpectreManifest } from './manifest'

/**
 * 対応コンポーネント集合のハッシュ。クライアント側 `GeneratedCatalog.capabilityHash`
 * (Kotlin/Swift) と同じ FNV-1a 32bit を使う — 同じ集合から同じハッシュが出ることが、
 * サーバがハッシュだけで「現行マニフェスト全体に対応している」と判定できる前提になる
 * (docs/compatibility.md §2)。
 */
export function componentsHashOf(names: Iterable<string>): string {
  let hash = 0x811c9dc5 | 0
  for (const name of [...names].sort()) {
    for (let i = 0; i < name.length; i++) {
      hash ^= name.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
    }
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** クライアントが `Spectre-Schema` / `Spectre-Components` ヘッダで送るケイパビリティ申告。 */
export interface CapabilityDeclaration {
  schemaVersion?: string
  componentsHash?: string
}

type Version = [number, number]

function parseVersion(raw: string | undefined): Version | null {
  if (!raw) return null
  const match = /^(\d+)\.(\d+)$/.exec(raw)
  if (!match) return null
  return [Number(match[1]), Number(match[2])]
}

function compareVersion(a: Version, b: Version): number {
  return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]
}

/**
 * サーバ側のケイパビリティネゴシエーション (docs/compatibility.md §2、SU-0008 項目2)。
 *
 * `componentsHash` が現行マニフェストの全コンポーネント集合と一致すれば、クライアントは
 * 今のカタログをすべて解釈できるので何もしない (最頻経路であり、ノードを歩く必要がない)。
 * それ以外は `schemaVersion` から保守的に見積もる: 各コンポーネントの `since` が
 * 申告されたバージョンより新しければ「未対応」とみなす。
 *
 * 未対応ノードは `fallback` があれば（再帰的に）それに差し替え、`optional` なら省略する。
 * どちらもない場合はそのまま返す — ここで無理に埋めようとせず、クライアント側の
 * `Resolver.degrade()` に委ねる。プレースホルダへの置き換えは層3の最終防衛線であり、
 * サーバがそれを先取りすると「サーバとクライアントで別のプレースホルダ実装を持つ」
 * 二重管理になる (docs/compatibility.md §1)。
 */
export function degradeDocumentTree(doc: unknown, manifest: SpectreManifest, declared: CapabilityDeclaration): unknown {
  if (declared.componentsHash && declared.componentsHash === componentsHashOf(manifest.componentsByName.keys())) {
    return doc
  }
  const declaredVersion = parseVersion(declared.schemaVersion)
  if (!declaredVersion) return doc // 申告がなければ整形しようがない。従来どおり返す。

  const isSupported = (type: string): boolean => {
    const spec = manifest.componentsByName.get(type)
    if (!spec) return false
    const since = parseVersion(spec.since)
    if (!since) return true // since を読めなければ安全側 (対応済み) に倒す。
    return compareVersion(since, declaredVersion) <= 0
  }

  function degradeNode(node: unknown): unknown {
    if (typeof node !== 'object' || node === null) return node
    const n = node as Record<string, unknown>
    const type = n.type
    if (typeof type === 'string' && !isSupported(type)) {
      if (n.fallback) return degradeNode(n.fallback)
      if (n.optional === true) return null
      return n
    }
    const out: Record<string, unknown> = { ...n }
    if (Array.isArray(n.children)) {
      out.children = n.children.map(degradeNode).filter((child) => child !== null)
    }
    if (n.fallback) out.fallback = degradeNode(n.fallback)
    const repeat = n.repeat as { emptyView?: unknown } | undefined
    if (repeat?.emptyView) out.repeat = { ...repeat, emptyView: degradeNode(repeat.emptyView) }
    return out
  }

  const record = doc as Record<string, unknown>
  if (typeof record !== 'object' || record === null || !record.root) return doc
  const out: Record<string, unknown> = { ...record, root: degradeNode(record.root) }
  if (Array.isArray(record.overlays)) {
    out.overlays = record.overlays.map((overlay) => {
      const o = overlay as Record<string, unknown>
      return o.root ? { ...o, root: degradeNode(o.root) } : o
    })
  }
  return out
}
