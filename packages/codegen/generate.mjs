#!/usr/bin/env node
/**
 * spec/component-manifest.json からクライアントのカタログを生成する。
 *
 * docs/tech-selection.md ADR-0002 の「マニフェストを単一の情報源にする」の実装。
 * 生成物はコミットする — iOS/Android の開発者が Node のツールチェインなしで
 * ビルドできることを優先し、CI で「生成し直して差分がないこと」を検証する。
 *
 *   node packages/codegen/generate.mjs [--check]
 *
 * --check を付けると書き込まず、既存の生成物と差分があれば終了コード 1 を返す。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const checkOnly = process.argv.includes('--check')

const manifest = JSON.parse(
  readFileSync(resolve(repoRoot, 'spec/component-manifest.json'), 'utf8'),
)

// ---------------------------------------------------------------------------
// マニフェストからプロパティの振り分けを導出する
// ---------------------------------------------------------------------------

/**
 * 各コンポーネントについて、プロパティを3種類に分類したパス集合を作る。
 *
 * - actionPaths: アクション。解決せず生のまま保持する (ディスパッチ時に評価するため)
 * - nodePaths:   子ノード。再帰的に解決する。配列の場合は末尾に "[]"
 * - propNames:   上記以外の、式として解決される既知のプロパティ名 (トップレベル)
 *
 * `Screen.appBar` のようにオブジェクトの内側にノードを持つケースがあるため、
 * パスはドット区切りで表現する ("appBar.actions[]")。
 */
function classify(component) {
  const actionPaths = []
  const nodePaths = []
  const propNames = []

  function walk(shape, prefix) {
    for (const [name, spec] of Object.entries(shape)) {
      const path = prefix ? `${prefix}.${name}` : name
      const type = spec.type

      if (type === 'actions') {
        actionPaths.push(path)
      } else if (type === 'node') {
        nodePaths.push(path)
      } else if (type === 'array' && spec.items?.type === 'node') {
        nodePaths.push(`${path}[]`)
      } else if (type === 'object' && spec.shape) {
        // オブジェクトの内側にアクションやノードが入りうる (Screen.appBar, Section.action)
        walk(spec.shape, path)
      }

      if (!prefix) propNames.push(name)
    }
  }

  walk(component.props ?? {}, '')
  return { actionPaths, nodePaths, propNames }
}

const components = manifest.components.map((c) => ({
  name: c.name,
  category: c.category,
  since: c.since,
  acceptsChildren: c.children !== false,
  ...classify(c),
}))

const actionNames = manifest.actions.map((a) => a.name)
const limits = manifest.limits

const header = (lang) => {
  const comment = lang === 'swift' ? '//' : '//'
  return [
    `${comment} 自動生成 — 直接編集しないこと。`,
    `${comment} 生成元: spec/component-manifest.json (manifestVersion ${manifest.manifestVersion})`,
    `${comment} 再生成: node packages/codegen/generate.mjs`,
    '',
  ].join('\n')
}

const kq = (s) => JSON.stringify(s)

// ---------------------------------------------------------------------------
// Kotlin
// ---------------------------------------------------------------------------

function kotlinSource() {
  const entries = components
    .map((c) => {
      const lines = [
        `        ComponentSpec(`,
        `            name = ${kq(c.name)},`,
        `            acceptsChildren = ${c.acceptsChildren},`,
        `            propNames = setOf(${c.propNames.map(kq).join(', ')}),`,
        `            actionPaths = listOf(${c.actionPaths.map(kq).join(', ')}),`,
        `            nodePaths = listOf(${c.nodePaths.map(kq).join(', ')}),`,
        `        ),`,
      ]
      return lines.join('\n')
    })
    .join('\n')

  return `${header('kotlin')}package dev.spectre.core

/** マニフェスト由来のコンポーネント定義。 */
data class ComponentSpec(
    val name: String,
    val acceptsChildren: Boolean,
    /** 既知のトップレベルプロパティ名。ここにないキーは解決時に捨てられる。 */
    val propNames: Set<String>,
    /** 解決せず生のまま保持するパス (アクション)。 */
    val actionPaths: List<String>,
    /** 子ノードとして解決するパス。配列は末尾が "[]"。 */
    val nodePaths: List<String>,
)

/**
 * このクライアントが解釈できるコンポーネントの集合。
 *
 * サーバへのケイパビリティ申告 ([capabilityHash]) と、未知コンポーネントの
 * 劣化判定に使う (docs/compatibility.md §2)。
 */
object GeneratedCatalog {

    const val SCHEMA_VERSION: String = ${kq(manifest.schemaVersion)}
    const val MANIFEST_VERSION: String = ${kq(manifest.manifestVersion)}

    val components: List<ComponentSpec> = listOf(
${entries}
    )

    private val byName: Map<String, ComponentSpec> = components.associateBy { it.name }

    fun spec(type: String): ComponentSpec? = byName[type]

    fun supports(type: String): Boolean = byName.containsKey(type)

    val componentNames: Set<String> = byName.keys

    val actionNames: Set<String> = setOf(${actionNames.map(kq).join(', ')})

    /**
     * 対応コンポーネント集合のハッシュ。SDK バージョンとは独立に持つ
     * (ホストアプリがコンポーネントを部分的に無効化できるため)。
     */
    fun capabilityHash(supported: Set<String> = componentNames): String {
        var hash = 0x811c9dc5.toInt()
        for (name in supported.sorted()) {
            for (ch in name) {
                hash = hash xor ch.code
                hash *= 0x01000193
            }
        }
        return String.format("%08x", hash)
    }
}

/** マニフェストの limits。クライアント側でも強制する (docs/architecture.md §5)。 */
object SpectreLimits {
    const val MAX_NODES: Int = ${limits.maxNodes}
    const val MAX_DEPTH: Int = ${limits.maxDepth}
    const val MAX_DOCUMENT_BYTES: Int = ${limits.maxDocumentBytes}
    const val MAX_EXPR_AST_NODES: Int = ${limits.maxExprAstNodes}
    const val MAX_EXPR_DEPTH: Int = ${limits.maxExprDepth}
    const val MAX_REPEAT_ITEMS: Int = ${limits.maxRepeatItems}
    const val MAX_ACTIONS_PER_DISPATCH: Int = ${limits.maxActionsPerDispatch}
    const val MAX_ACTION_NESTING: Int = ${limits.maxActionNesting}
}
`
}

// ---------------------------------------------------------------------------
// Swift
// ---------------------------------------------------------------------------

function swiftSource() {
  const entries = components
    .map((c) => {
      return [
        `        ComponentSpec(`,
        `            name: ${kq(c.name)},`,
        `            acceptsChildren: ${c.acceptsChildren},`,
        `            propNames: [${c.propNames.map(kq).join(', ')}],`,
        `            actionPaths: [${c.actionPaths.map(kq).join(', ')}],`,
        `            nodePaths: [${c.nodePaths.map(kq).join(', ')}]`,
        `        ),`,
      ].join('\n')
    })
    .join('\n')

  return `${header('swift')}import Foundation

/// マニフェスト由来のコンポーネント定義。
public struct ComponentSpec: Sendable {
    public let name: String
    public let acceptsChildren: Bool
    /// 既知のトップレベルプロパティ名。ここにないキーは解決時に捨てられる。
    public let propNames: Set<String>
    /// 解決せず生のまま保持するパス (アクション)。
    public let actionPaths: [String]
    /// 子ノードとして解決するパス。配列は末尾が "[]"。
    public let nodePaths: [String]
}

/// このクライアントが解釈できるコンポーネントの集合。
public enum GeneratedCatalog {

    public static let schemaVersion = ${kq(manifest.schemaVersion)}
    public static let manifestVersion = ${kq(manifest.manifestVersion)}

    public static let components: [ComponentSpec] = [
${entries}
    ]

    private static let byName: [String: ComponentSpec] =
        Dictionary(uniqueKeysWithValues: components.map { ($0.name, $0) })

    public static func spec(_ type: String) -> ComponentSpec? { byName[type] }

    public static func supports(_ type: String) -> Bool { byName[type] != nil }

    public static var componentNames: Set<String> { Set(byName.keys) }

    public static let actionNames: Set<String> = [${actionNames.map(kq).join(', ')}]

    /// 対応コンポーネント集合のハッシュ。Kotlin 実装と同じ FNV-1a で計算する。
    public static func capabilityHash(supported: Set<String>? = nil) -> String {
        var hash: Int32 = Int32(bitPattern: 0x811c9dc5)
        for name in (supported ?? componentNames).sorted() {
            for scalar in name.unicodeScalars {
                hash ^= Int32(bitPattern: UInt32(scalar.value))
                hash = hash &* 0x01000193
            }
        }
        return String(format: "%08x", UInt32(bitPattern: hash))
    }
}

/// マニフェストの limits。クライアント側でも強制する。
public enum SpectreLimits {
    public static let maxNodes = ${limits.maxNodes}
    public static let maxDepth = ${limits.maxDepth}
    public static let maxDocumentBytes = ${limits.maxDocumentBytes}
    public static let maxExprASTNodes = ${limits.maxExprAstNodes}
    public static let maxExprDepth = ${limits.maxExprDepth}
    public static let maxRepeatItems = ${limits.maxRepeatItems}
    public static let maxActionsPerDispatch = ${limits.maxActionsPerDispatch}
    public static let maxActionNesting = ${limits.maxActionNesting}
}
`
}

// ---------------------------------------------------------------------------
// 出力
// ---------------------------------------------------------------------------

const outputs = [
  {
    path: 'clients/android/spectre-core/src/main/kotlin/dev/spectre/core/GeneratedCatalog.kt',
    content: kotlinSource(),
  },
  {
    path: 'clients/ios/Sources/SpectreCore/GeneratedCatalog.swift',
    content: swiftSource(),
  },
]

let drift = false
for (const { path, content } of outputs) {
  const full = resolve(repoRoot, path)
  const existing = existsSync(full) ? readFileSync(full, 'utf8') : null
  if (existing === content) {
    console.log(`  unchanged  ${path}`)
    continue
  }
  if (checkOnly) {
    console.error(`  DRIFT      ${path}`)
    drift = true
    continue
  }
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
  console.log(`  ${existing === null ? 'created   ' : 'updated   '} ${path}`)
}

if (checkOnly && drift) {
  console.error(
    '\n生成物がマニフェストと同期していません。' +
      ' `node packages/codegen/generate.mjs` を実行して差分をコミットしてください。',
  )
  process.exit(1)
}
