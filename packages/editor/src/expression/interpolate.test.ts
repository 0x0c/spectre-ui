import { describe, expect, it } from 'vitest'
import { evaluateCondition, interpolate, isSimplePath, isTruthy, previewText, stringifyValue } from './interpolate'

const scope = {
  data: {
    product: {
      name: 'ケトル',
      stock: 3,
      rating: 4.6,
      listPrice: 8500,
      images: ['a.jpg', 'b.jpg'],
      sizes: [{ value: '600', label: '600ml' }],
      shippingNote: null,
      meta: { b: 2, a: 1 },
    },
  },
  state: { qty: 2, adding: false },
  env: { locale: 'ja-JP' },
}

describe('isSimplePath', () => {
  it('accepts dotted identifier paths and numeric indices', () => {
    expect(isSimplePath('data.product.stock')).toBe(true)
    expect(isSimplePath('data.product.sizes[0].label')).toBe(true)
    expect(isSimplePath('index')).toBe(true)
  })

  it('rejects anything with an operator, call, or literal', () => {
    expect(isSimplePath('data.product.stock > 0')).toBe(false)
    expect(isSimplePath('formatCurrency(data.product.price)')).toBe(false)
    expect(isSimplePath('state.a && state.b')).toBe(false)
    expect(isSimplePath('1 + 1')).toBe(false)
  })
})

describe('interpolate — whole-expression type preservation (docs/spec/expression.md §1)', () => {
  it('preserves number', () => {
    expect(interpolate('${data.product.stock}', scope)).toBe(3)
  })

  it('preserves boolean', () => {
    expect(interpolate('${state.adding}', scope)).toBe(false)
  })

  it('preserves array', () => {
    expect(interpolate('${data.product.images}', scope)).toEqual(['a.jpg', 'b.jpg'])
  })

  it('preserves object', () => {
    expect(interpolate('${data.product.meta}', scope)).toEqual({ a: 1, b: 2 })
  })

  it('preserves null-ish (missing path) as undefined, not the string "null"', () => {
    expect(interpolate('${data.product.missing}', scope)).toBeUndefined()
  })

  it('resolves indexed array access', () => {
    expect(interpolate('${data.product.sizes[0].label}', scope)).toBe('600ml')
  })

  it('leaves unsupported whole expressions (operators, calls) as the raw string', () => {
    expect(interpolate('${data.product.stock > 0}', scope)).toBe('${data.product.stock > 0}')
  })

  it('passes non-string values through untouched', () => {
    expect(interpolate(42, scope)).toBe(42)
    expect(interpolate(undefined, scope)).toBeUndefined()
  })
})

describe('interpolate — partial string interpolation', () => {
  it('stringifies a number without a trailing .0', () => {
    expect(interpolate('残り${data.product.stock}点', scope)).toBe('残り3点')
  })

  it('stringifies null as empty string', () => {
    expect(interpolate('note: ${data.product.shippingNote}', scope)).toBe('note: ')
  })

  it('stringifies an object with sorted keys', () => {
    expect(interpolate('${data.product.meta}!', scope)).toBe('{"a":1,"b":2}!')
  })

  it('leaves unsupported expressions in place, visibly unevaluated', () => {
    expect(interpolate('${data.product.name} (${data.product.stock > 0})', scope)).toBe(
      'ケトル (${data.product.stock > 0})',
    )
  })

  it('unescapes $${ to a literal ${', () => {
    expect(interpolate('price is $${data.product.price}', scope)).toBe('price is ${data.product.price}')
  })

  it('handles multiple interpolations in one string', () => {
    expect(interpolate('${data.product.name}: ${data.product.stock}', scope)).toBe('ケトル: 3')
  })
})

describe('stringifyValue', () => {
  it('matches the documented table', () => {
    expect(stringifyValue(null)).toBe('')
    expect(stringifyValue(undefined)).toBe('')
    expect(stringifyValue(true)).toBe('true')
    expect(stringifyValue(false)).toBe('false')
    expect(stringifyValue(1280)).toBe('1280')
    expect(stringifyValue(0.25)).toBe('0.25')
    expect(stringifyValue('hi')).toBe('hi')
    expect(stringifyValue([1, 2])).toBe('[1,2]')
    expect(stringifyValue({ b: 2, a: 1 })).toBe('{"a":1,"b":2}')
  })
})

describe('previewText', () => {
  it('always returns a string, even for whole-expression non-string results', () => {
    expect(previewText('${data.product.stock}', scope)).toBe('3')
    expect(previewText('${state.adding}', scope)).toBe('false')
  })
})

describe('isTruthy', () => {
  it('follows the documented truthy table', () => {
    expect(isTruthy(true)).toBe(true)
    expect(isTruthy(false)).toBe(false)
    expect(isTruthy(null)).toBe(false)
    expect(isTruthy(undefined)).toBe(false)
    expect(isTruthy(0)).toBe(false)
    expect(isTruthy(Number.NaN)).toBe(false)
    expect(isTruthy(1)).toBe(true)
    expect(isTruthy('')).toBe(false)
    expect(isTruthy('x')).toBe(true)
    expect(isTruthy([])).toBe(false)
    expect(isTruthy([1])).toBe(true)
    expect(isTruthy({})).toBe(false)
    expect(isTruthy({ a: 1 })).toBe(true)
  })
})

describe('evaluateCondition', () => {
  it('evaluates a simple-path whole expression', () => {
    expect(evaluateCondition('${data.product.stock}', scope)).toEqual({ value: true, evaluated: true })
    expect(evaluateCondition('${state.adding}', scope)).toEqual({ value: false, evaluated: true })
  })

  it('marks unsupported (non-simple-path) expressions as unevaluated, defaulting to visible', () => {
    const result = evaluateCondition('${data.product.stock > 0 && !state.adding}', scope)
    expect(result.evaluated).toBe(false)
    expect(result.value).toBe(true)
  })

  it('treats a literal boolean-ish value as already evaluated', () => {
    expect(evaluateCondition(true, scope)).toEqual({ value: true, evaluated: true })
    expect(evaluateCondition('', scope)).toEqual({ value: false, evaluated: true })
  })
})
