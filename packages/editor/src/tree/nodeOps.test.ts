import { describe, expect, it } from 'vitest'
import type { SpectreNode } from '@spectre-ui/manifest/generated'
import {
  assignMissingIds,
  countNodes,
  depthOf,
  findNodeById,
  insertChild,
  moveNodeBefore,
  removeNodeById,
  treeDepth,
} from './nodeOps'

function text(id: string, value = 'x'): SpectreNode {
  return { id, type: 'Text', props: { text: value } } as SpectreNode
}

function stack(id: string, children: SpectreNode[] = []): SpectreNode {
  return { id, type: 'VStack', props: {}, children } as SpectreNode
}

describe('findNodeById', () => {
  it('finds the root itself', () => {
    const root = stack('root')
    expect(findNodeById(root, 'root')?.node.id).toBe('root')
  })

  it('finds a nested child and its parent', () => {
    const leaf = text('leaf')
    const mid = stack('mid', [leaf])
    const root = stack('root', [mid])
    const found = findNodeById(root, 'leaf')
    expect(found?.node).toBe(leaf)
    expect(found?.parent).toBe(mid)
  })

  it('returns undefined for an unknown id', () => {
    expect(findNodeById(stack('root'), 'nope')).toBeUndefined()
  })
})

describe('countNodes / treeDepth', () => {
  it('counts every node once', () => {
    const root = stack('root', [text('a'), stack('b', [text('c')])])
    expect(countNodes(root)).toBe(4)
  })

  it('measures the deepest path', () => {
    const root = stack('root', [stack('a', [stack('b', [text('c')])])])
    expect(treeDepth(root)).toBe(4)
  })
})

describe('insertChild / removeNodeById', () => {
  it('appends when no index is given', () => {
    const root = stack('root', [text('a')])
    insertChild(root, text('b'))
    expect(root.children?.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('inserts at a specific index', () => {
    const root = stack('root', [text('a'), text('c')])
    insertChild(root, text('b'), 1)
    expect(root.children?.map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('removes a nested node and returns it', () => {
    const target = text('target')
    const root = stack('root', [stack('mid', [target])])
    const removed = removeNodeById(root, 'target')
    expect(removed).toBe(target)
    expect(findNodeById(root, 'target')).toBeUndefined()
  })
})

describe('moveNodeBefore', () => {
  it('moves a node from one container to another (append when beforeId is omitted)', () => {
    const moved = text('moved')
    const root = stack('root', [stack('left', [moved]), stack('right', [])])
    const ok = moveNodeBefore(root, 'moved', 'right')
    expect(ok).toBe(true)
    expect(findNodeById(root, 'left')?.node.children).toEqual([])
    expect(findNodeById(root, 'right')?.node.children?.[0].id).toBe('moved')
  })

  it('refuses to move a node into its own descendant', () => {
    const inner = stack('inner', [])
    const outer = stack('outer', [inner])
    const root = stack('root', [outer])
    const ok = moveNodeBefore(root, 'outer', 'inner')
    expect(ok).toBe(false)
    // structure is unchanged
    expect(findNodeById(root, 'outer')?.parent?.id).toBe('root')
  })

  it('reorders within the same container using beforeId, without an off-by-one', () => {
    const root = stack('root', [text('a'), text('b'), text('c')])
    // move "a" to just before "c" -> b, a, c
    moveNodeBefore(root, 'a', 'root', 'c')
    expect(root.children?.map((c) => c.id)).toEqual(['b', 'a', 'c'])
  })

  it('moves an item forward past several siblings to just before a later one', () => {
    const root = stack('root', [text('a'), text('b'), text('c'), text('d')])
    moveNodeBefore(root, 'a', 'root', 'd')
    expect(root.children?.map((c) => c.id)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('is a no-op when asked to move a node before itself', () => {
    const root = stack('root', [text('a'), text('b')])
    const ok = moveNodeBefore(root, 'a', 'root', 'a')
    expect(ok).toBe(false)
    expect(root.children?.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('falls back to appending when beforeId no longer exists', () => {
    const root = stack('root', [text('a'), text('b')])
    moveNodeBefore(root, 'a', 'root', 'does-not-exist')
    expect(root.children?.map((c) => c.id)).toEqual(['b', 'a'])
  })
})

describe('depthOf', () => {
  it('is 1 for the root and increases with nesting', () => {
    const root = stack('root', [stack('a', [text('b')])])
    expect(depthOf(root, 'root')).toBe(1)
    expect(depthOf(root, 'a')).toBe(2)
    expect(depthOf(root, 'b')).toBe(3)
    expect(depthOf(root, 'missing')).toBe(-1)
  })
})

describe('assignMissingIds', () => {
  it('fills in ids for every node lacking one, recursively', () => {
    const root = { type: 'Screen', props: {}, children: [{ type: 'Text', props: { text: 'hi' } }] } as SpectreNode
    assignMissingIds(root)
    expect(root.id).toBeTruthy()
    expect(root.children?.[0].id).toBeTruthy()
  })

  it('leaves existing ids untouched', () => {
    const root = stack('kept', [text('also-kept')])
    assignMissingIds(root)
    expect(root.id).toBe('kept')
    expect(root.children?.[0].id).toBe('also-kept')
  })
})
