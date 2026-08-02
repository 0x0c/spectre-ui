import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { ExprCache, MAX_AST_NODES, MAX_DEPTH, parse, tryParse } from '../src/parser.js'
import { ExprParseException } from '../src/expr.js'

/**
 * Unit tests for the parser's limits and its cache.
 *
 * The conformance corpus fixes what a well-formed expression evaluates to; it says nothing
 * about expressions past the limits or about syntax errors. But the termination guarantee
 * rests on those limits (docs/spec/expression.md §3, §6), so they are checked directly here.
 */

function errorCodeOf(source: string): string {
  const result = tryParse(source)
  assert.equal(result.ok, false, `expected a parse failure: ${source}`)
  return (result as { ok: false; error: ExprParseException }).error.error.code
}

describe('parse', () => {
  test('a well-formed expression returns an AST', () => {
    assert.deepEqual(parse('1'), { kind: 'Literal', value: 1 })
    assert.deepEqual(parse('data'), { kind: 'Identifier', name: 'data' })
  })

  test('trailing tokens after the expression fail', () => {
    assert.throws(() => parse('1 2'), ExprParseException)
    assert.equal(errorCodeOf('1 2'), 'E_PARSE')
  })

  test('an empty expression fails', () => {
    assert.equal(errorCodeOf(''), 'E_PARSE')
    assert.equal(errorCodeOf('   '), 'E_PARSE')
  })

  test('unclosed parentheses, arrays and objects fail', () => {
    assert.equal(errorCodeOf('(1 + 2'), 'E_PARSE')
    assert.equal(errorCodeOf('[1, 2'), 'E_PARSE')
    assert.equal(errorCodeOf('{"a": 1'), 'E_PARSE')
  })

  test('a dangling operator fails', () => {
    assert.equal(errorCodeOf('1 +'), 'E_PARSE')
    assert.equal(errorCodeOf('* 2'), 'E_PARSE')
  })

  test('the error message carries the position and the source expression', () => {
    const result = tryParse('1 +')
    assert.equal(result.ok, false)
    const message = (result as { ok: false; error: ExprParseException }).error.error.message
    // The diagnostic itself is Japanese, matching the parser's own wording.
    assert.match(message, /位置/)
    assert.match(message, /1 \+/)
  })
})

describe('parser limits', () => {
  // Rejecting oversized input with E_DEPTH is what makes evaluation finish in finite time.
  // Pin the limits so they cannot drift.
  //
  // Note how depth is counted: `enter()` fires once per precedence level descended, not once
  // per nesting level. Adding one level of parentheses walks the whole ternary-to-unary chain
  // again, so depth grows by about eleven. Kotlin (`ExprParser.enter`) and Swift
  // (`ExprParser.enter`) count it the same way, so all three runtimes agree.
  test('shallow nesting parses', () => {
    assert.ok(tryParse('((1))').ok)
    assert.ok(tryParse('(1 + 2) * (3 - 4)').ok, 'a wide expression consumes no depth')
  })

  test('nesting past MAX_DEPTH yields E_DEPTH', () => {
    const overLimit = '('.repeat(MAX_DEPTH) + '1' + ')'.repeat(MAX_DEPTH)
    assert.equal(errorCodeOf(overLimit), 'E_DEPTH')
  })

  test('a member chain skips the precedence chain and so consumes no depth', () => {
    assert.ok(tryParse('a' + '.b'.repeat(MAX_DEPTH * 2)).ok)
  })

  test('an AST past MAX_AST_NODES yields E_DEPTH', () => {
    // Grow the node count without growing depth — a flat array literal does that.
    const withinLimit = `[${Array.from({ length: 100 }, (_, i) => i).join(',')}]`
    assert.ok(tryParse(withinLimit).ok, '100 elements should parse')

    const overLimit = `[${Array.from({ length: MAX_AST_NODES + 10 }, (_, i) => i).join(',')}]`
    assert.equal(errorCodeOf(overLimit), 'E_DEPTH')
  })

  test('the limits surface as a result, not an exception', () => {
    const overLimit = '('.repeat(MAX_DEPTH) + '1' + ')'.repeat(MAX_DEPTH)
    assert.doesNotThrow(() => tryParse(overLimit), 'tryParse does not throw')
    assert.throws(() => parse(overLimit), ExprParseException, 'parse does')
  })
})

describe('ExprCache', () => {
  test('the same expression returns the same AST instance', () => {
    const cache = new ExprCache()
    const first = cache.get('data.title')
    const second = cache.get('data.title')
    assert.ok(first.ok && second.ok)
    assert.equal(first.value, second.value, 'nothing was reparsed')
  })

  test('parse errors are cached too', () => {
    const cache = new ExprCache()
    const first = cache.get('1 +')
    const second = cache.get('1 +')
    assert.equal(first.ok, false)
    assert.equal(first, second, 'a failure returns the same result')
  })

  test('past capacity the oldest entry is evicted', () => {
    const cache = new ExprCache(2)
    const a1 = cache.get('a')
    cache.get('b')
    cache.get('c') // pushes 'a' out
    const a2 = cache.get('a')
    assert.ok(a1.ok && a2.ok)
    assert.notEqual(a1.value, a2.value, 'an evicted expression is reparsed')
  })

  test('a re-accessed entry is not evicted (LRU)', () => {
    const cache = new ExprCache(2)
    const a1 = cache.get('a')
    cache.get('b')
    cache.get('a') // moves 'a' to the back
    cache.get('c') // so 'b' is the one evicted
    const a2 = cache.get('a')
    assert.ok(a1.ok && a2.ok)
    assert.equal(a1.value, a2.value, 'the recently used expression survives')
  })

  test('clear drops everything', () => {
    const cache = new ExprCache()
    const first = cache.get('data')
    cache.clear()
    const second = cache.get('data')
    assert.ok(first.ok && second.ok)
    assert.notEqual(first.value, second.value)
  })
})
