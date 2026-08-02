import { describe, expect, test } from 'vitest'
import type { RawPropSpec } from '@spectre-ui/manifest/editor-schema'
import { inferWidget } from './widgets'
import { editorManifest } from './editorManifest'

/**
 * Unit tests for the rule that picks an inspector field kind.
 *
 * Most properties carry no `editor.widget`, so what actually shapes the inspector is the
 * fallback rule keyed on `type` (docs/editor.md §2). Inspector.test.tsx sees the assembled
 * screen and cannot tell which branch of this table was taken, so the rule is exercised
 * directly here.
 */

const spec = (partial: Partial<RawPropSpec> & { type: string }): RawPropSpec => partial as RawPropSpec
const str: RawPropSpec = { type: 'string' }

describe('inferWidget', () => {
  test('an explicit editor.widget wins', () => {
    expect(inferWidget(spec({ type: 'string', editor: { widget: 'textarea' } }))).toBe('textarea')
    expect(inferWidget(spec({ type: 'string', editor: { widget: 'json' } }))).toBe('json')
  })

  test('an unknown explicit widget falls back to the type default', () => {
    // An unrecognized widget name must not crash (the spirit of ADR-0006).
    expect(inferWidget(spec({ type: 'number', editor: { widget: 'no-such-widget' } }))).toBe('number')
  })

  test('an editor block without a widget falls back to the type default', () => {
    expect(inferWidget(spec({ type: 'boolean', editor: {} }))).toBe('boolean')
  })

  test('the plain types each map to their own widget', () => {
    expect(inferWidget(spec({ type: 'string' }))).toBe('text')
    expect(inferWidget(spec({ type: 'number' }))).toBe('number')
    expect(inferWidget(spec({ type: 'boolean' }))).toBe('boolean')
    expect(inferWidget(spec({ type: 'enum' }))).toBe('enum')
  })

  test('token types get their dedicated pickers', () => {
    expect(inferWidget(spec({ type: 'colorToken' }))).toBe('colorToken')
    expect(inferWidget(spec({ type: 'spacingToken' }))).toBe('spacingToken')
    expect(inferWidget(spec({ type: 'radiusToken' }))).toBe('radiusToken')
    expect(inferWidget(spec({ type: 'typographyToken' }))).toBe('typographyToken')
  })

  test('iconToken becomes icon and statePath becomes binding', () => {
    // The two cases where the type name and the widget name differ. Confusing them loses
    // the picker entirely.
    expect(inferWidget(spec({ type: 'iconToken' }))).toBe('icon')
    expect(inferWidget(spec({ type: 'statePath' }))).toBe('binding')
  })

  test('actions, expression, object and node map straight through', () => {
    expect(inferWidget(spec({ type: 'actions' }))).toBe('actions')
    expect(inferWidget(spec({ type: 'expression' }))).toBe('expression')
    expect(inferWidget(spec({ type: 'object' }))).toBe('object')
    expect(inferWidget(spec({ type: 'node' }))).toBe('node')
  })

  test('an array of {value, label} becomes the options table', () => {
    const items: RawPropSpec = { type: 'object', shape: { value: str, label: str } }
    expect(inferWidget(spec({ type: 'array', items }))).toBe('options')
  })

  test('any other array degrades to raw JSON editing', () => {
    expect(inferWidget(spec({ type: 'array' }))).toBe('json')
    expect(inferWidget(spec({ type: 'array', items: { type: 'object' } }))).toBe('json')
    expect(inferWidget(spec({ type: 'array', items: { type: 'object', shape: { id: str } } }))).toBe('json')
    // Without a label there is no options table to build.
    expect(inferWidget(spec({ type: 'array', items: { type: 'object', shape: { value: str } } }))).toBe('json')
  })

  test('a type with no dedicated widget degrades to json', () => {
    // Degrade rather than crash (ADR-0006).
    expect(inferWidget(spec({ type: 'union' }))).toBe('json')
    expect(inferWidget(spec({ type: 'some-future-type' }))).toBe('json')
  })
})

describe('consistency with the manifest', () => {
  test('every manifest property resolves to some widget', () => {
    // An undefined result for an unknown type would drop that property from the inspector.
    for (const component of editorManifest.components) {
      for (const prop of component.props) {
        expect(inferWidget(prop.spec), `${component.name}.${prop.name}`).toBeTruthy()
      }
    }
  })

  test('the common node properties all resolve too', () => {
    for (const prop of editorManifest.commonNodeProps) {
      expect(inferWidget(prop.spec), prop.name).toBeTruthy()
    }
  })
})
