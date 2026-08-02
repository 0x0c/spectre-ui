import { test } from 'node:test'
import assert from 'node:assert/strict'
import { componentsHashOf, degradeDocumentTree } from '../src/degrade.ts'
import type { ComponentSpec, SpectreManifest } from '../src/manifest.ts'

function spec(name: string, since: string): ComponentSpec {
  return { name, category: 'test', acceptsChildren: true, propNames: new Set(), actionPaths: [], nodePaths: [], since }
}

function manifestOf(specs: ComponentSpec[]): SpectreManifest {
  return {
    manifestVersion: '0.1.0',
    schemaVersion: '1.4',
    componentsByName: new Map(specs.map((s) => [s.name, s])),
    actionNames: new Set(),
  }
}

const manifest = manifestOf([spec('VStack', '1.0'), spec('Text', '1.0'), spec('Image', '1.0'), spec('Carousel', '1.4')])

test('componentsHashOf は要素の順序に依存しない', () => {
  assert.equal(componentsHashOf(['b', 'a', 'c']), componentsHashOf(['c', 'b', 'a']))
})

test('ハッシュが一致すればツリーをそのまま返す', () => {
  const doc = { root: { type: 'Carousel', id: 'car' } }
  const declared = { componentsHash: componentsHashOf(manifest.componentsByName.keys()) }
  const shaped = degradeDocumentTree(doc, manifest, declared) as { root: { type: string } }
  assert.equal(shaped.root.type, 'Carousel')
  assert.equal(shaped, doc) // 同一参照 — 歩く必要がなかった経路
})

test('申告が何もなければ整形しようがないのでそのまま返す', () => {
  const doc = { root: { type: 'Carousel', id: 'car' } }
  const shaped = degradeDocumentTree(doc, manifest, {})
  assert.equal(shaped, doc)
})

test('schemaVersion が古いクライアントには fallback が代わりに解決される', () => {
  const doc = {
    root: {
      type: 'VStack',
      children: [
        { type: 'Text', id: 'a', props: { text: 'before' } },
        {
          type: 'Carousel',
          id: 'car',
          fallback: { type: 'Image', id: 'car_fb', props: { url: 'x' } },
        },
      ],
    },
  }
  const declared = { schemaVersion: '1.0', componentsHash: 'deadbeef' }
  const shaped = degradeDocumentTree(doc, manifest, declared) as {
    root: { children: Array<{ type: string; id: string }> }
  }
  assert.deepEqual(
    shaped.root.children.map((c) => c.type),
    ['Text', 'Image'],
  )
  assert.equal(shaped.root.children[1].id, 'car_fb')
})

test('fallback がなく optional なら省略される', () => {
  const doc = {
    root: {
      type: 'VStack',
      children: [
        { type: 'Text', id: 'a', props: { text: 'before' } },
        { type: 'Carousel', id: 'car', optional: true },
        { type: 'Text', id: 'b', props: { text: 'after' } },
      ],
    },
  }
  const declared = { schemaVersion: '1.0', componentsHash: 'deadbeef' }
  const shaped = degradeDocumentTree(doc, manifest, declared) as { root: { children: Array<{ id: string }> } }
  assert.deepEqual(
    shaped.root.children.map((c) => c.id),
    ['a', 'b'],
  )
})

test('fallback も optional もなければ変更せずクライアント側の劣化に委ねる', () => {
  const doc = { root: { type: 'Carousel', id: 'car' } }
  const declared = { schemaVersion: '1.0', componentsHash: 'deadbeef' }
  const shaped = degradeDocumentTree(doc, manifest, declared) as { root: { type: string; id: string } }
  assert.equal(shaped.root.type, 'Carousel')
  assert.equal(shaped.root.id, 'car')
})

test('since を読めないコンポーネントは対応済みとして安全側に倒す', () => {
  const unknownSince = manifestOf([spec('VStack', '1.0'), { ...spec('Weird', '1.0'), since: 'not-a-version' }])
  const doc = { root: { type: 'Weird', id: 'w' } }
  const declared = { schemaVersion: '1.0', componentsHash: 'deadbeef' }
  const shaped = degradeDocumentTree(doc, unknownSince, declared) as { root: { type: string } }
  assert.equal(shaped.root.type, 'Weird')
})

test('マニフェストに存在しない type は未対応として扱われる', () => {
  const doc = {
    root: {
      type: 'VStack',
      children: [{ type: 'TotallyUnknown', id: 'u', optional: true }],
    },
  }
  const declared = { schemaVersion: '1.4', componentsHash: 'deadbeef' }
  const shaped = degradeDocumentTree(doc, manifest, declared) as { root: { children: unknown[] } }
  assert.deepEqual(shaped.root.children, [])
})
