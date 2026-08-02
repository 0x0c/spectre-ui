import { describe, expect, test } from 'vitest'
import { COLOR_VALUES, ELEVATION_SHADOWS, TYPOGRAPHY_VALUES, colorValue, radiusPx, spacingPx } from './tokens'
import { editorManifest } from '../manifest/editorManifest'

/**
 * Unit tests for the preview token tables.
 *
 * This is the editor-side implementation of the promise that the manifest carries names only
 * and the host decides what they look like (docs/architecture.md §6). When a token is added to
 * the manifest but not to these tables, the preview quietly falls back to a default and nobody
 * notices — catching that omission is the main point of these tests.
 */

describe('spacingPx', () => {
  test('maps the manifest spacing tokens to px', () => {
    expect(spacingPx('none')).toBe(0)
    expect(spacingPx('md')).toBe(16)
    expect(spacingPx('xxl')).toBe(48)
  })

  test('unset and unknown tokens are 0', () => {
    expect(spacingPx(undefined)).toBe(0)
    expect(spacingPx('')).toBe(0)
    expect(spacingPx('no-such-token')).toBe(0)
  })

  test('every manifest spacing token resolves', () => {
    for (const token of Object.keys(editorManifest.tokens.spacing)) {
      expect(spacingPx(token), `spacing token ${token}`).toBe(editorManifest.tokens.spacing[token])
    }
  })
})

describe('radiusPx', () => {
  test('maps the manifest radius tokens to px', () => {
    expect(radiusPx('none')).toBe(0)
    expect(radiusPx('md')).toBe(8)
  })

  test('a negative value means "fully rounded", so it becomes a large radius', () => {
    // The manifest spells `full` as -1. CSS has no equivalent, so use 9999px.
    expect(editorManifest.tokens.radius.full).toBeLessThan(0)
    expect(radiusPx('full')).toBe(9999)
  })

  test('unset and unknown tokens are 0', () => {
    expect(radiusPx(undefined)).toBe(0)
    expect(radiusPx('no-such-token')).toBe(0)
  })

  test('every manifest radius token resolves to a non-negative px value', () => {
    for (const token of Object.keys(editorManifest.tokens.radius)) {
      expect(radiusPx(token), `radius token ${token}`).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('colorValue', () => {
  test('each theme resolves to its own value', () => {
    expect(colorValue('primary', 'light')).toBe('#3B5BDB')
    expect(colorValue('primary', 'dark')).toBe('#AEC0FF')
  })

  test('unset and unknown tokens are undefined', () => {
    expect(colorValue(undefined, 'light')).toBeUndefined()
    expect(colorValue('no-such-token', 'light')).toBeUndefined()
  })

  test('transparent is transparent in both themes', () => {
    expect(colorValue('transparent', 'light')).toBe('transparent')
    expect(colorValue('transparent', 'dark')).toBe('transparent')
  })
})

describe('coverage against the manifest', () => {
  // A gap in these tables shows up as the preview quietly falling back to a default, which is
  // hard to spot by eye.
  test('every manifest color token has a value in both themes', () => {
    for (const token of editorManifest.tokens.color) {
      expect(COLOR_VALUES.light[token], `light ${token}`).toBeDefined()
      expect(COLOR_VALUES.dark[token], `dark ${token}`).toBeDefined()
    }
  })

  test('light and dark carry the same token set', () => {
    expect(Object.keys(COLOR_VALUES.light).sort()).toEqual(Object.keys(COLOR_VALUES.dark).sort())
  })

  test('every manifest typography token has a value', () => {
    for (const token of editorManifest.tokens.typography) {
      expect(TYPOGRAPHY_VALUES[token], `typography ${token}`).toBeDefined()
    }
  })

  test('every manifest elevation step has a shadow', () => {
    for (const level of editorManifest.tokens.elevation) {
      expect(ELEVATION_SHADOWS[level], `elevation ${level}`).toBeDefined()
    }
  })
})
