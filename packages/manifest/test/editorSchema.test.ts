import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadEditorManifest } from '../src/editorSchemaLoader.ts'
import { buildEditorManifest } from '../src/editorSchema.ts'

test('loadEditorManifest はマニフェストの全コンポーネントを、プロパティ定義つきで読む', () => {
  const manifest = loadEditorManifest()
  assert.equal(manifest.schemaVersion, '1.0')
  assert.equal(manifest.components.length, 26)

  const button = manifest.componentsByName.get('Button')!
  assert.ok(button)
  const onTap = button.props.find((p) => p.name === 'onTap')!
  assert.equal(onTap.spec.type, 'actions')
  assert.equal(onTap.spec.editor?.widget, 'actions')

  const label = button.props.find((p) => p.name === 'label')!
  assert.equal(label.spec.required, true)
  assert.equal(label.spec.expression, true)
})

test('buildEditorManifest はプロパティの宣言順を保つ', () => {
  const manifest = loadEditorManifest()
  const text = manifest.componentsByName.get('Text')!
  assert.deepEqual(
    text.props.map((p) => p.name),
    [
      'text',
      'typography',
      'color',
      'align',
      'weight',
      'maxLines',
      'truncation',
      'decoration',
      'selectable',
    ],
  )
})

test('buildEditorManifest は children: false を acceptsChildren: false に写す', () => {
  const manifest = loadEditorManifest()
  assert.equal(manifest.componentsByName.get('Text')!.acceptsChildren, false)
  assert.equal(manifest.componentsByName.get('VStack')!.acceptsChildren, true)
  assert.equal(manifest.componentsByName.get('Card')!.minChildren, 1)
  assert.equal(manifest.componentsByName.get('Card')!.maxChildren, 1)
})

test('buildEditorManifest はアクションカタログを写す', () => {
  const manifest = loadEditorManifest()
  const request = manifest.actions.find((a) => a.name === 'request')!
  assert.equal(request.async, true)
  const setState = manifest.actions.find((a) => a.name === 'setState')!
  assert.equal(setState.async, false)
  assert.equal(manifest.actions.length, 18)
})

test('buildEditorManifest は node:fs なしに直接呼べる（ブラウザ経路の代用）', () => {
  const raw = JSON.parse(
    JSON.stringify({
      manifestVersion: '0.1.0',
      schemaVersion: '1.0',
      tokens: { color: [], spacing: {}, radius: {}, typography: [], elevation: [] },
      commonNodeProps: {},
      components: [{ name: 'Text', category: 'content', children: false, props: { text: { type: 'string' } } }],
      actions: [{ name: 'setState', async: false }],
      limits: {},
    }),
  )
  const manifest = buildEditorManifest(raw)
  assert.equal(manifest.components.length, 1)
  assert.equal(manifest.componentsByName.get('Text')!.acceptsChildren, false)
})
