#!/usr/bin/env node
/**
 * spec/component-manifest.json の変更が、加算のみの進化規則
 * (docs/compatibility.md §5, ADR-0006) を破っていないか診断する。
 *
 * `schemaVersion` は `major.minor`。マイナーの増加で許されるのは追加だけ:
 *   - 新しいコンポーネントの追加
 *   - 既存コンポーネントへの新しい (必須でない) プロパティの追加
 *   - 既存の列挙型への値の追加
 * 削除・改名・既定値の変更・プロパティの意味の変更・必須プロパティの追加は
 * メジャーの増加を要求する — ここではメジャーが上がっていれば診断をスキップする
 * (メジャー移行そのものの妥当性はレビューの領分であり、機械的な加算チェックの対象外)。
 *
 *   node packages/codegen/check-additive-evolution.mjs [--base <git-ref>]
 *
 * --base を省略すると origin/main と比較する。比較対象の版が取得できない場合
 * (浅いクローン、ベースブランチ未取得、リポジトリの最初のコミットなど) は
 * チェックをスキップして正常終了する — これは「合格」ではなく「比較できなかった」
 * ことを意味し、CI 側は `fetch-depth: 0` などで比較可能な状態を用意する責務を持つ。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const manifestPath = 'spec/component-manifest.json'

const baseArgIndex = process.argv.indexOf('--base')
const baseRef = baseArgIndex >= 0 ? process.argv[baseArgIndex + 1] : 'origin/main'

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim()
}

function loadBaseManifest() {
  let mergeBase
  try {
    mergeBase = git(['merge-base', 'HEAD', baseRef])
  } catch {
    console.log(`  比較元 (${baseRef}) が解決できないため、加算のみチェックをスキップします。`)
    return null
  }
  try {
    const raw = git(['show', `${mergeBase}:${manifestPath}`])
    return JSON.parse(raw)
  } catch {
    console.log(`  ${manifestPath} は分岐元 (${mergeBase}) に存在しないため、新規追加として扱います。`)
    return null
  }
}

export function parseVersion(v) {
  const [major, minor] = String(v).split('.').map((n) => Number.parseInt(n, 10))
  return { major: Number.isFinite(major) ? major : 0, minor: Number.isFinite(minor) ? minor : 0 }
}

export function compareVersion(a, b) {
  if (a.major !== b.major) return a.major - b.major
  return a.minor - b.minor
}

function componentsByName(manifest) {
  return new Map(manifest.components.map((c) => [c.name, c]))
}

function propsOf(component) {
  return component.props ?? {}
}

/**
 * 新旧のマニフェストを比べ、加算のみの規則への違反を集める。
 * `oldManifest` の版が新しい版と同じメジャーで、かつマイナー以上であることは
 * 呼び出し側 (`main`) が保証してから呼ぶ。
 */
export function findViolations(oldManifest, newManifest) {
  const violations = []
  const oldComponents = componentsByName(oldManifest)
  const newComponents = componentsByName(newManifest)

  for (const [name, oldComponent] of oldComponents) {
    const newComponent = newComponents.get(name)
    if (!newComponent) {
      violations.push(`コンポーネント "${name}" が削除されています (削除にはメジャーの増加が必要です)`)
      continue
    }

    const oldProps = propsOf(oldComponent)
    const newProps = propsOf(newComponent)
    for (const [propName, oldSpec] of Object.entries(oldProps)) {
      const newSpec = newProps[propName]
      if (!newSpec) {
        violations.push(`${name}.${propName} が削除されています (削除にはメジャーの増加が必要です)`)
        continue
      }
      if (JSON.stringify(oldSpec.default) !== JSON.stringify(newSpec.default)) {
        violations.push(`${name}.${propName} の default が変わっています (既定値の変更にはメジャーの増加が必要です)`)
      }
      if (oldSpec.type === 'enum' && newSpec.type === 'enum') {
        const removedValues = (oldSpec.values ?? []).filter((v) => !(newSpec.values ?? []).includes(v))
        if (removedValues.length > 0) {
          violations.push(
            `${name}.${propName} の列挙値 ${JSON.stringify(removedValues)} が削除されています` +
              ` (削除にはメジャーの増加が必要です)`,
          )
        }
      }
    }

    // 既存コンポーネントに新しく増えたプロパティは、既定挙動を変えない任意項目でなければならない。
    for (const [propName, newSpec] of Object.entries(newProps)) {
      if (oldProps[propName]) continue
      if (newSpec.required === true) {
        violations.push(
          `${name}.${propName} は既存コンポーネントへの新しい必須プロパティです` +
            ` (必須プロパティの追加にはメジャーの増加が必要です)`,
        )
      }
    }
  }

  for (const action of oldManifest.actions ?? []) {
    if (!(newManifest.actions ?? []).some((a) => a.name === action.name)) {
      violations.push(`アクション "${action.name}" が削除されています (削除にはメジャーの増加が必要です)`)
    }
  }

  return violations
}

function main() {
  const newManifest = JSON.parse(readFileSync(resolve(repoRoot, manifestPath), 'utf8'))
  const oldManifest = loadBaseManifest()
  if (!oldManifest) {
    console.log('  加算のみチェック: 比較対象なし (スキップ)')
    return
  }

  const oldVersion = parseVersion(oldManifest.schemaVersion)
  const newVersion = parseVersion(newManifest.schemaVersion)
  const cmp = compareVersion(newVersion, oldVersion)

  if (newVersion.major !== oldVersion.major) {
    console.log(
      `  加算のみチェック: schemaVersion のメジャーが ${oldManifest.schemaVersion} → ` +
        `${newManifest.schemaVersion} に変わっているため、加算のみの規則は適用されません (スキップ)`,
    )
    return
  }

  if (cmp < 0) {
    console.error(
      `schemaVersion が後退しています (${oldManifest.schemaVersion} → ${newManifest.schemaVersion})。`,
    )
    process.exit(1)
  }

  // cmp === 0 (schemaVersion 不変) も cmp > 0 (マイナー増加) も、加算のみの規則を同じ基準で
  // 満たさなければならない — 前者は「変えるならバージョンを上げよ」、後者は「上げた変更は
  // 加算のみであれ」という、同じ制約の裏表でしかない。
  const violations = findViolations(oldManifest, newManifest)
  if (violations.length > 0) {
    const header = cmp === 0
      ? `schemaVersion (${newManifest.schemaVersion}) を上げずに component-manifest.json の内容が` +
        ' 変わっています。マイナーバージョンを上げてください:'
      : `schemaVersion ${oldManifest.schemaVersion} → ${newManifest.schemaVersion}` +
        ' (マイナー) の変更が加算のみの規則 (docs/compatibility.md §5) に違反しています:'
    console.error(
      `${header}\n${violations.map((v) => `  - ${v}`).join('\n')}\n\n` +
        '削除・改名・既定値の変更・意味の変更・必須プロパティの追加が必要な場合は' +
        ' メジャーバージョンを上げてください。',
    )
    process.exit(1)
  }

  console.log(
    cmp === 0
      ? `  加算のみチェック: schemaVersion 変化なし (${newManifest.schemaVersion})、差分なし`
      : `  加算のみチェック: schemaVersion ${oldManifest.schemaVersion} → ` +
        `${newManifest.schemaVersion} は加算のみです`,
  )
}

// The diagnostic rules are exported so the unit tests (test/additive-evolution.test.mjs) can
// exercise them directly. Only call main() when started as a command, so importing the module
// from a test does not run the diagnostic.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
