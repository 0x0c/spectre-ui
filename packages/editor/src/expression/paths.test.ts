import { describe, expect, test } from 'vitest'
import { collectPaths } from './paths'

/**
 * Unit tests for the binding picker's candidate-path collection.
 *
 * BindingPicker.test.tsx sees the assembled picker and cannot tell how the candidates were
 * gathered. The depth cutoff and the array handling are the brakes that stop the candidate
 * list from exploding even on non-cyclic sample data, so they are checked directly here.
 */

describe('collectPaths', () => {
  test('a leaf value is its own path', () => {
    expect(collectPaths('text', 'data.title')).toEqual(['data.title'])
    expect(collectPaths(42, 'data.price')).toEqual(['data.price'])
    expect(collectPaths(true, 'data.flag')).toEqual(['data.flag'])
  })

  test('null and undefined survive as candidates', () => {
    // The value is merely absent; it is still a legitimate binding target.
    expect(collectPaths(null, 'data.missing')).toEqual(['data.missing'])
    expect(collectPaths(undefined, 'data.missing')).toEqual(['data.missing'])
  })

  test('a leaf with an empty prefix is not a candidate', () => {
    expect(collectPaths('text', '')).toEqual([])
    expect(collectPaths(null, '')).toEqual([])
  })

  test('an object yields itself plus each key', () => {
    expect(collectPaths({ title: 'x', price: 1 }, 'data')).toEqual(['data', 'data.title', 'data.price'])
  })

  test('with an empty prefix the top-level keys become the candidates', () => {
    expect(collectPaths({ title: 'x' }, '')).toEqual(['title'])
  })

  test('nested objects are walked recursively', () => {
    expect(collectPaths({ user: { name: 'x' } }, 'data')).toEqual(['data', 'data.user', 'data.user.name'])
  })

  test('an array is inspected through its first element only', () => {
    // Elements are assumed to share a shape. If they do not, candidates are merely missing,
    // never wrong.
    const value = { items: [{ id: 'a' }, { id: 'b', extra: 1 }] }
    expect(collectPaths(value, 'data')).toEqual(['data', 'data.items', 'data.items[0]', 'data.items[0].id'])
  })

  test('an empty array yields only itself', () => {
    expect(collectPaths({ items: [] }, 'data')).toEqual(['data', 'data.items'])
  })

  test('nested arrays use index notation at each level', () => {
    expect(collectPaths({ grid: [[1]] }, 'data')).toEqual(['data', 'data.grid', 'data.grid[0]', 'data.grid[0][0]'])
  })

  test('an empty object yields only itself', () => {
    expect(collectPaths({}, 'data')).toEqual(['data'])
  })

  test('the walk stops past depth 8', () => {
    // The brake that stops deep nesting from exploding the candidate list.
    let deep: unknown = 'leaf'
    for (let i = 0; i < 20; i++) deep = { next: deep }
    const paths = collectPaths(deep, 'data')
    expect(paths[0]).toBe('data')
    // The cutoff point stays as a candidate, treated as a leaf. Depth starts at 0 on the
    // first call, so at most nine segments follow `data`.
    expect(paths).toHaveLength(10)
    expect(paths[paths.length - 1]).toBe('data' + '.next'.repeat(9))
  })
})
