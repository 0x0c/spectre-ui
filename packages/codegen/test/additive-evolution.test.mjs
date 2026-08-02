import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { compareVersion, findViolations, parseVersion } from '../check-additive-evolution.mjs'

/**
 * Unit tests for the additive-evolution diagnostic itself
 * (docs/compatibility.md §5, ADR-0006).
 *
 * CI only ever runs this diagnostic against the real manifest's real diff, so all it can
 * establish is that it passes when nothing is violated. That the diagnostic does not *miss*
 * a violation goes unverified until such a diff appears — and by then the incompatible
 * manifest has already shipped. Both directions are pinned here with synthetic diffs.
 */

const base = {
  schemaVersion: '1.0',
  components: [
    {
      name: 'Text',
      props: { text: { type: 'string' }, maxLines: { type: 'number', default: 1 } },
    },
    {
      name: 'Button',
      props: { style: { type: 'enum', values: ['filled', 'outlined'] } },
    },
  ],
  actions: [{ name: 'navigate' }, { name: 'setState' }],
}

/** Build a new manifest with one thing changed, leaving `base` intact. */
function variant(mutate) {
  const copy = structuredClone(base)
  mutate(copy)
  return copy
}

const componentNamed = (manifest, name) => manifest.components.find((c) => c.name === name)

describe('parseVersion', () => {
  test('splits major.minor into numbers', () => {
    assert.deepEqual(parseVersion('1.2'), { major: 1, minor: 2 })
    assert.deepEqual(parseVersion('10.0'), { major: 10, minor: 0 })
  })

  test('a missing minor counts as 0', () => {
    assert.deepEqual(parseVersion('2'), { major: 2, minor: 0 })
  })

  test('an unreadable value falls back to 0.0', () => {
    assert.deepEqual(parseVersion('壊れた'), { major: 0, minor: 0 })
    assert.deepEqual(parseVersion(undefined), { major: 0, minor: 0 })
  })
})

describe('compareVersion', () => {
  test('major takes precedence', () => {
    assert.ok(compareVersion(parseVersion('2.0'), parseVersion('1.9')) > 0)
    assert.ok(compareVersion(parseVersion('1.9'), parseVersion('2.0')) < 0)
  })

  test('equal majors compare on minor', () => {
    assert.ok(compareVersion(parseVersion('1.2'), parseVersion('1.1')) > 0)
    assert.equal(compareVersion(parseVersion('1.1'), parseVersion('1.1')), 0)
  })
})

describe('findViolations — additions are allowed', () => {
  test('no change means no violation', () => {
    assert.deepEqual(findViolations(base, structuredClone(base)), [])
  })

  test('adding a new component', () => {
    const next = variant((m) => m.components.push({ name: 'Badge', props: { text: { type: 'string' } } }))
    assert.deepEqual(findViolations(base, next), [])
  })

  test('adding an optional property to an existing component', () => {
    const next = variant((m) => {
      componentNamed(m, 'Text').props.letterSpacing = { type: 'number' }
    })
    assert.deepEqual(findViolations(base, next), [])
  })

  test('adding a new property that is explicitly required: false', () => {
    const next = variant((m) => {
      componentNamed(m, 'Text').props.italic = { type: 'boolean', required: false }
    })
    assert.deepEqual(findViolations(base, next), [])
  })

  test('adding a value to an existing enum', () => {
    const next = variant((m) => componentNamed(m, 'Button').props.style.values.push('text'))
    assert.deepEqual(findViolations(base, next), [])
  })

  test('adding a new action', () => {
    const next = variant((m) => m.actions.push({ name: 'track' }))
    assert.deepEqual(findViolations(base, next), [])
  })

  test('a component with no props is handled', () => {
    const bare = { schemaVersion: '1.0', components: [{ name: 'Spacer' }], actions: [] }
    assert.deepEqual(findViolations(bare, structuredClone(bare)), [])
  })

  test('a manifest with no actions is handled', () => {
    const noActions = { schemaVersion: '1.0', components: [] }
    assert.deepEqual(findViolations(noActions, { schemaVersion: '1.0', components: [] }), [])
  })
})

describe('findViolations — removals and changes are violations', () => {
  test('removing a component', () => {
    const next = variant((m) => {
      m.components = m.components.filter((c) => c.name !== 'Button')
    })
    const violations = findViolations(base, next)
    assert.equal(violations.length, 1)
    assert.match(violations[0], /コンポーネント "Button" が削除/)
  })

  test('removing a property', () => {
    const next = variant((m) => delete componentNamed(m, 'Text').props.maxLines)
    const violations = findViolations(base, next)
    assert.equal(violations.length, 1)
    assert.match(violations[0], /Text\.maxLines が削除/)
  })

  test('renaming a property shows up as a removal plus an addition', () => {
    const next = variant((m) => {
      const props = componentNamed(m, 'Text').props
      delete props.text
      props.label = { type: 'string' }
    })
    assert.ok(findViolations(base, next).some((v) => /Text\.text が削除/.test(v)))
  })

  test('changing a default', () => {
    const next = variant((m) => {
      componentNamed(m, 'Text').props.maxLines.default = 2
    })
    const violations = findViolations(base, next)
    assert.equal(violations.length, 1)
    assert.match(violations[0], /Text\.maxLines の default が変わって/)
  })

  test('removing a default counts as changing it', () => {
    const next = variant((m) => delete componentNamed(m, 'Text').props.maxLines.default)
    assert.ok(findViolations(base, next).some((v) => /default が変わって/.test(v)))
  })

  test('removing an enum value', () => {
    const next = variant((m) => {
      componentNamed(m, 'Button').props.style.values = ['filled']
    })
    const violations = findViolations(base, next)
    assert.equal(violations.length, 1)
    assert.match(violations[0], /Button\.style の列挙値 \["outlined"\] が削除/)
  })

  test('adding a required property to an existing component', () => {
    // It is an addition, but it invalidates old documents, so it is not additive.
    const next = variant((m) => {
      componentNamed(m, 'Text').props.role = { type: 'string', required: true }
    })
    const violations = findViolations(base, next)
    assert.equal(violations.length, 1)
    assert.match(violations[0], /Text\.role は既存コンポーネントへの新しい必須プロパティ/)
  })

  test('a required property on a brand-new component is not a violation', () => {
    // No existing document uses that component.
    const next = variant((m) => m.components.push({ name: 'Badge', props: { text: { type: 'string', required: true } } }))
    assert.deepEqual(findViolations(base, next), [])
  })

  test('removing an action', () => {
    const next = variant((m) => {
      m.actions = m.actions.filter((a) => a.name !== 'navigate')
    })
    const violations = findViolations(base, next)
    assert.equal(violations.length, 1)
    assert.match(violations[0], /アクション "navigate" が削除/)
  })

  test('multiple violations are reported together', () => {
    const next = variant((m) => {
      m.components = m.components.filter((c) => c.name !== 'Button')
      delete componentNamed(m, 'Text').props.maxLines
      m.actions = []
    })
    // Button removed, Text.maxLines removed, and both actions removed.
    assert.equal(findViolations(base, next).length, 4)
  })

  test('a component removed whole does not double-count its properties', () => {
    const next = variant((m) => {
      m.components = m.components.filter((c) => c.name !== 'Text')
    })
    assert.equal(findViolations(base, next).length, 1)
  })
})
