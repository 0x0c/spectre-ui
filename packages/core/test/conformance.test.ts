import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SpValue } from '../src/value.js'
import { deepEquals, isTruthy, stringify } from '../src/value.js'
import { makeScope } from '../src/evaluator.js'
import { TemplateEvaluator } from '../src/template.js'

/**
 * spec/conformance/expr の全ケースを実行する。
 *
 * このテストが SpectreExpr の仕様そのもの。仕様を変えるならコーパスにケースを
 * 足さなければならず、逆にコーパスを満たさない実装は仕様違反になる
 * (docs/spec/expression.md §7, ADR-0008)。Kotlin の `ConformanceExprTest` /
 * Swift の `ConformanceTests` と同じコーパスを、同じ判定規則で読む。
 */

const here = fileURLToPath(new URL('.', import.meta.url))

function findCorpusDir(): string {
  const candidates = [join(here, '../../../spec/conformance'), join(process.cwd(), 'spec/conformance')]
  const found = candidates.find((c) => existsSync(c))
  if (!found) {
    throw new Error(`適合性コーパスが見つかりません。試したパス: ${candidates.join(', ')}`)
  }
  return found
}

function loadDir(name: string): Array<{ fileName: string; doc: Record<string, unknown> }> {
  const dir = join(findCorpusDir(), name)
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((fileName) => ({
      fileName,
      doc: JSON.parse(readFileSync(join(dir, fileName), 'utf8')) as Record<string, unknown>,
    }))
}

/**
 * 数値は微小な誤差を許容して比較する。`round(1.2345, 2)` のような計算は
 * 10 のべき乗を経由するため、プラットフォームによって最下位ビットがずれうる。
 */
function valuesEqual(a: SpValue, b: SpValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b || Math.abs(a - b) < 1e-9
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => valuesEqual(item, b[i]))
  }
  if (a !== null && typeof a === 'object' && !Array.isArray(a) && b !== null && typeof b === 'object' && !Array.isArray(b)) {
    const aKeys = Object.keys(a).sort()
    const bKeys = Object.keys(b).sort()
    return aKeys.length === bKeys.length && aKeys.every((k, i) => aKeys[i] === bKeys[i] && valuesEqual(a[k], b[k]))
  }
  return deepEquals(a, b)
}

function describe_(v: SpValue): string {
  if (typeof v === 'string') return `"${v}"`
  if (v === null) return 'null'
  return stringify(v)
}

describe('expr conformance corpus', () => {
  for (const { fileName, doc } of loadDir('expr')) {
    const advisory = (doc.advisory as boolean | undefined) ?? false
    const rawScope = (doc.scope as Record<string, SpValue> | undefined) ?? {}
    const scope = makeScope({
      data: rawScope.data ?? {},
      state: rawScope.state ?? {},
      env: rawScope.env ?? {},
    })
    const cases = (doc.cases as Array<Record<string, unknown>> | undefined) ?? []

    describe(fileName, () => {
      cases.forEach((testCase, index) => {
        const source = testCase.expr as string | undefined
        if (source === undefined) return

        test(`[${index}] ${source}`, () => {
          // 評価器はケースごとに作る。キャッシュ越しの状態が結果に影響しないことも同時に確認できる。
          const evaluator = new TemplateEvaluator()
          const result = evaluator.evaluate(source, scope)

          if ('expect' in testCase) {
            assert.ok(
              valuesEqual(result.value, testCase.expect as SpValue),
              `式 \`${source}\` の評価結果が期待と異なります\n` +
                `  期待: ${describe_(testCase.expect as SpValue)}\n` +
                `  実際: ${describe_(result.value)}`,
            )
          }

          const expectedError = testCase.error as string | undefined
          if (expectedError !== undefined) {
            assert.ok(
              result.errors.some((e) => e.code === expectedError),
              `式 \`${source}\` は ${expectedError} を記録するはずですが、記録されたのは ` +
                `${result.errors.map((e) => e.code).join(', ')} でした`,
            )
          } else if (!advisory) {
            assert.ok(
              result.errors.length === 0,
              `式 \`${source}\` はエラーなく評価されるはずですが ` +
                `${result.errors.map((e) => `${e.code}: ${e.message}`).join(', ')} が記録されました`,
            )
          }

          if ('asBoolean' in testCase) {
            assert.equal(isTruthy(result.value), testCase.asBoolean, `式 \`${source}\` の真偽判定が期待と異なります`)
          }

          // ロケール依存の書式は完全一致を要求せず、部分一致だけを検査する。
          const contains = testCase.contains as string[] | undefined
          if (contains !== undefined) {
            const text = stringify(result.value)
            for (const needle of contains) {
              assert.ok(text.includes(needle), `式 \`${source}\` の結果 "${text}" に "${needle}" が含まれていません`)
            }
          }

          const matches = testCase.matches as string | undefined
          if (matches !== undefined) {
            const text = stringify(result.value)
            assert.ok(new RegExp(`^(?:${matches})$`).test(text), `式 \`${source}\` の結果 "${text}" が /${matches}/ にマッチしません`)
          }
        })
      })
    })
  }
})
