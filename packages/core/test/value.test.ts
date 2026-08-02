import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  compareNumbers,
  deepEquals,
  formatNumberPlain,
  isBlank,
  isTruthy,
  isWholeNumber,
  path,
  stringify,
  toIntTruncating,
} from '../src/value.js'

/**
 * Unit tests for `value.ts`.
 *
 * The conformance corpus (spec/conformance/expr) only observes results that come back
 * through an expression, so the boundaries that exist purely to keep the three runtimes
 * aligned — the NaN and negative-zero ordering that matches Kotlin's `Double.compareTo`,
 * the saturating conversion from JLS 5.1.3, the key ordering in `stringify` — are
 * unreachable from the expression side. This is the layer that hits them directly
 * (docs/spec/expression.md §1, §3).
 */

describe('isTruthy', () => {
  test('null and false are falsy', () => {
    assert.equal(isTruthy(null), false)
    assert.equal(isTruthy(false), false)
    assert.equal(isTruthy(true), true)
  })

  test('among numbers only 0 and NaN are falsy', () => {
    assert.equal(isTruthy(0), false)
    assert.equal(isTruthy(-0), false)
    assert.equal(isTruthy(Number.NaN), false)
    assert.equal(isTruthy(-1), true)
    assert.equal(isTruthy(Number.POSITIVE_INFINITY), true)
  })

  test('strings, arrays and objects are falsy when empty', () => {
    assert.equal(isTruthy(''), false)
    assert.equal(isTruthy('0'), true, '"0" is non-empty, so it is truthy')
    assert.equal(isTruthy([]), false)
    assert.equal(isTruthy([null]), true)
    assert.equal(isTruthy({}), false)
    assert.equal(isTruthy({ a: null }), true)
  })
})

describe('isBlank', () => {
  test('null and empty strings, arrays and objects are blank', () => {
    assert.equal(isBlank(null), true)
    assert.equal(isBlank(''), true)
    assert.equal(isBlank([]), true)
    assert.equal(isBlank({}), true)
  })

  test('false and 0 are not blank — a different judgement from isTruthy', () => {
    assert.equal(isBlank(false), false)
    assert.equal(isBlank(0), false)
    assert.equal(isTruthy(false), false, 'contrast: isTruthy calls it falsy')
  })
})

describe('stringify', () => {
  test('null becomes the empty string', () => {
    assert.equal(stringify(null), '')
  })

  test('booleans and numbers use a plain, locale-independent form', () => {
    assert.equal(stringify(true), 'true')
    assert.equal(stringify(1280), '1280')
    assert.equal(stringify(1280.0), '1280', 'whole values drop the fractional part')
    assert.equal(stringify(1.5), '1.5')
  })

  test('object keys are pinned to lexicographic order', () => {
    // Depending on insertion order would disagree with Swift, whose Dictionary is unordered.
    assert.equal(stringify({ b: 1, a: 2 }), '{"a":2,"b":1}')
    assert.equal(stringify({ a: 2, b: 1 }), '{"a":2,"b":1}')
  })

  test('nested nulls and strings take a JSON-like form', () => {
    assert.equal(stringify([1, null, 'x']), '[1,null,"x"]')
    assert.equal(stringify({ a: null }), '{"a":null}')
  })

  test('quotes, backslashes and control characters are escaped', () => {
    assert.equal(stringify(['a"b']), '["a\\"b"]')
    assert.equal(stringify(['a\\b']), '["a\\\\b"]')
    assert.equal(stringify(['a\nb']), '["a\\nb"]')
    assert.equal(stringify(['a\tb']), '["a\\tb"]')
  })

  test('a top-level string is not wrapped in quotes', () => {
    assert.equal(stringify('a"b'), 'a"b')
  })
})

describe('formatNumberPlain', () => {
  test('NaN and the infinities are spelled by name', () => {
    assert.equal(formatNumberPlain(Number.NaN), 'NaN')
    assert.equal(formatNumberPlain(Number.POSITIVE_INFINITY), 'Infinity')
    assert.equal(formatNumberPlain(Number.NEGATIVE_INFINITY), '-Infinity')
  })

  test('negative zero also prints as "0"', () => {
    assert.equal(formatNumberPlain(-0), '0')
    assert.equal(formatNumberPlain(0), '0')
  })

  test('whole values drop the fraction, others keep it', () => {
    assert.equal(formatNumberPlain(-3.0), '-3')
    assert.equal(formatNumberPlain(-3.25), '-3.25')
  })

  test('the whole-number range stops below 1e15', () => {
    assert.equal(isWholeNumber(1e14), true)
    assert.equal(isWholeNumber(1e15), false, 'values this large fall back to exponent notation')
    assert.equal(isWholeNumber(1.5), false)
    assert.equal(isWholeNumber(Number.NaN), false)
    assert.equal(isWholeNumber(Number.POSITIVE_INFINITY), false)
  })
})

describe('compareNumbers', () => {
  // The same total order as Kotlin's `java.lang.Double.compare`. Bare `<` / `>` return false
  // for every NaN comparison and do not distinguish signed zero, so the comparison operators
  // have to route through this.
  test('NaN sorts as the greatest value and equals only itself', () => {
    assert.equal(compareNumbers(Number.NaN, Number.NaN), 0)
    assert.equal(compareNumbers(Number.NaN, Number.POSITIVE_INFINITY), 1)
    assert.equal(compareNumbers(Number.POSITIVE_INFINITY, Number.NaN), -1)
    assert.equal(compareNumbers(Number.NaN, 0), 1)
  })

  test('negative zero is less than positive zero', () => {
    assert.equal(compareNumbers(-0, 0), -1)
    assert.equal(compareNumbers(0, -0), 1)
    assert.equal(compareNumbers(-0, -0), 0)
    assert.equal(compareNumbers(0, 0), 0)
  })

  test('ordinary values compare as the bare operators would', () => {
    assert.equal(compareNumbers(1, 2), -1)
    assert.equal(compareNumbers(2, 1), 1)
    assert.equal(compareNumbers(2, 2), 0)
  })
})

describe('toIntTruncating', () => {
  // The narrowing conversion from JLS 5.1.3. JavaScript's Math.trunc leaves NaN and Infinity
  // untouched, which would throw off an index computed from such an expression.
  test('NaN becomes 0', () => {
    assert.equal(toIntTruncating(Number.NaN), 0)
  })

  test('infinities and out-of-range values saturate at the Int bounds', () => {
    assert.equal(toIntTruncating(Number.POSITIVE_INFINITY), 2147483647)
    assert.equal(toIntTruncating(Number.NEGATIVE_INFINITY), -2147483648)
    assert.equal(toIntTruncating(1e30), 2147483647)
    assert.equal(toIntTruncating(-1e30), -2147483648)
  })

  test('in-range values truncate toward zero', () => {
    assert.equal(toIntTruncating(1.9), 1)
    assert.equal(toIntTruncating(-1.9), -1)
    assert.equal(toIntTruncating(2147483647), 2147483647)
    assert.equal(toIntTruncating(-2147483648), -2147483648)
  })
})

describe('deepEquals', () => {
  test('no type coercion', () => {
    assert.equal(deepEquals(1, '1' as never), false)
    assert.equal(deepEquals(0, false as never), false)
    assert.equal(deepEquals(null, false), false)
    assert.equal(deepEquals(null, null), true)
  })

  test('arrays and objects compare structurally', () => {
    assert.equal(deepEquals([1, [2, { a: 3 }]], [1, [2, { a: 3 }]]), true)
    assert.equal(deepEquals([1, 2], [2, 1]), false, 'arrays are order-sensitive')
    assert.equal(deepEquals({ a: 1, b: 2 }, { b: 2, a: 1 }), true, 'objects are not')
    assert.equal(deepEquals({ a: 1 }, { a: 1, b: 2 }), false)
    assert.equal(deepEquals([], {} as never), false, 'an empty array is not an empty object')
  })

  test('NaN does not equal itself — the same as bare ===', () => {
    assert.equal(deepEquals(Number.NaN, Number.NaN), false)
  })
})

describe('path', () => {
  test('an empty path is the value itself', () => {
    assert.deepEqual(path({ a: 1 }, ''), { a: 1 })
  })

  test('dot-separated segments walk objects', () => {
    assert.equal(path({ a: { b: { c: 7 } } }, 'a.b.c'), 7)
    assert.equal(path({ a: { b: 1 } }, 'a.z'), null)
  })

  test('numeric segments index into arrays', () => {
    assert.equal(path({ items: [{ id: 'x' }] }, 'items.0.id'), 'x')
    assert.equal(path([10, 20, 30], '2'), 30)
    assert.equal(path([10, 20, 30], '9'), null, 'out of range is null')
    assert.equal(path([10, 20, 30], '-1'), null, 'a negative index names no element')
  })

  test('only segments that read strictly as integers become indices', () => {
    // Matching Kotlin's `toIntOrNull()`. With parseInt, "3abc" would turn into 3.
    assert.equal(path([10, 20, 30, 40], '3abc'), null)
    assert.equal(path([10, 20, 30], '1.0'), null)
  })

  test('null once the value runs out mid-path', () => {
    assert.equal(path({ a: 1 }, 'a.b'), null, 'a number cannot be walked into')
    assert.equal(path(null, 'a'), null)
    assert.equal(path('text', 'length'), null, 'strings have no properties here')
  })

  test('inherited properties are not picked up', () => {
    assert.equal(path({}, 'toString'), null)
    assert.equal(path({}, 'constructor'), null)
  })
})
