import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadManifest } from '../src/manifest.ts'
import { validateDocument, checkResourceLimits, hasErrors } from '../src/validate.ts'

test('loadManifest はマニフェストの全コンポーネントを分類する', () => {
  const manifest = loadManifest()
  assert.equal(manifest.schemaVersion, '1.0')
  assert.ok(manifest.componentsByName.has('Text'))
  assert.ok(manifest.componentsByName.has('Screen'))
  const text = manifest.componentsByName.get('Text')!
  assert.ok(text.propNames.has('text'))
  assert.ok(text.propNames.has('typography'))
  const screen = manifest.componentsByName.get('Screen')!
  assert.deepEqual(screen.nodePaths, ['appBar.actions[]', 'bottomBar'])
})

test('validateDocument は妥当なドキュメントでエラーを出さない', () => {
  const manifest = loadManifest()
  const doc = {
    schemaVersion: '1.0',
    id: 'test_screen',
    root: {
      type: 'Screen',
      children: [{ type: 'Text', props: { text: 'hello' } }],
    },
  }
  const issues = validateDocument(doc, manifest)
  assert.equal(hasErrors(issues), false, JSON.stringify(issues))
})

test('validateDocument は未知のコンポーネントをエラーにする (fallback がなければ)', () => {
  const manifest = loadManifest()
  const doc = {
    schemaVersion: '1.0',
    id: 'test_screen',
    root: { type: 'Screen', children: [{ type: 'NotARealComponent' }] },
  }
  const issues = validateDocument(doc, manifest)
  assert.ok(hasErrors(issues))
  assert.ok(issues.some((i) => i.message.includes('NotARealComponent')))
})

test('validateDocument は fallback があれば未知コンポーネントを警告に留める', () => {
  const manifest = loadManifest()
  const doc = {
    schemaVersion: '1.0',
    id: 'test_screen',
    root: {
      type: 'Screen',
      children: [{ type: 'NotARealComponent', fallback: { type: 'Text', props: { text: 'fallback' } } }],
    },
  }
  const issues = validateDocument(doc, manifest)
  assert.equal(hasErrors(issues), false, JSON.stringify(issues))
  assert.ok(issues.some((i) => i.severity === 'warning'))
})

test('validateDocument はドキュメントサイズの上限を強制する', () => {
  const manifest = loadManifest()
  const doc = {
    schemaVersion: '1.0',
    id: 'test_screen',
    root: { type: 'Text', props: { text: 'x'.repeat(2 * 1024 * 1024) } },
  }
  const issues = validateDocument(doc, manifest)
  assert.ok(hasErrors(issues))
  assert.ok(issues.some((i) => i.message.includes('バイト')))
})

test('validateDocument は必須フィールドの欠落を検出する', () => {
  const manifest = loadManifest()
  const issues = validateDocument({}, manifest)
  assert.ok(hasErrors(issues))
  assert.ok(issues.some((i) => i.path === 'schemaVersion'))
  assert.ok(issues.some((i) => i.path === 'id'))
  assert.ok(issues.some((i) => i.path === 'root'))
})

test('validateDocument はノード数の上限を強制する', () => {
  const manifest = loadManifest()
  const children = Array.from({ length: 3000 }, () => ({ type: 'Text', props: { text: 'x' } }))
  const doc = {
    schemaVersion: '1.0',
    id: 'test_screen',
    root: { type: 'Screen', children },
  }
  const issues = validateDocument(doc, manifest)
  assert.ok(hasErrors(issues))
  assert.ok(issues.some((i) => i.message.includes('ノード数')))
})

test('validateDocument は深さの上限を強制する', () => {
  const manifest = loadManifest()
  let root: Record<string, unknown> = { type: 'Text', props: { text: 'leaf' } }
  for (let i = 0; i < 40; i++) {
    root = { type: 'Screen', children: [root] }
  }
  const doc = { schemaVersion: '1.0', id: 'test_screen', root }
  const issues = validateDocument(doc, manifest)
  assert.ok(hasErrors(issues))
  assert.ok(issues.some((i) => i.message.includes('深さ')))
})

test('checkResourceLimits はマニフェスト適合性を見ず、上限だけを見る', () => {
  const doc = {
    schemaVersion: '1.0',
    id: 'test_screen',
    root: { type: 'NotARealComponent', props: { text: 'hello' } },
  }
  assert.equal(hasErrors(checkResourceLimits(doc)), false, JSON.stringify(checkResourceLimits(doc)))
})

test('checkResourceLimits はノード数の上限を強制する', () => {
  const children = Array.from({ length: 3000 }, () => ({ type: 'Text', props: { text: 'x' } }))
  const doc = { schemaVersion: '1.0', id: 'test_screen', root: { type: 'Screen', children } }
  assert.ok(hasErrors(checkResourceLimits(doc)))
})

test('checkResourceLimits はドキュメントサイズの上限を強制する', () => {
  const doc = {
    schemaVersion: '1.0',
    id: 'test_screen',
    root: { type: 'Text', props: { text: 'x'.repeat(2 * 1024 * 1024) } },
  }
  assert.ok(hasErrors(checkResourceLimits(doc)))
})
