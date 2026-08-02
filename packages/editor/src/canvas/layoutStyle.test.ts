import { describe, expect, test } from 'vitest'
import { layoutStyle, visualStyle } from './layoutStyle'

/**
 * Unit tests for the `layout` / `style` to CSS conversion.
 *
 * The canvas tests (Canvas.test.tsx) look at how the tree is assembled, not at what CSS an
 * individual node ends up with. That an omitted field contributes nothing — that the result is
 * `{}` rather than a key with an undefined value — is what keeps an inherited look from being
 * clobbered, so it is checked directly here.
 */

describe('layoutStyle', () => {
  test('no layout means no style', () => {
    expect(layoutStyle(undefined)).toEqual({})
    expect(layoutStyle({})).toEqual({})
  })

  test('a string padding becomes the shorthand', () => {
    expect(layoutStyle({ padding: 'md' })).toEqual({ padding: 16 })
  })

  test('per-edge padding maps logical directions onto physical ones', () => {
    // leading/trailing map to left/right; the editor preview only deals with LTR.
    expect(layoutStyle({ padding: { top: 'xs', trailing: 'sm', bottom: 'md', leading: 'lg' } })).toEqual({
      paddingTop: 4,
      paddingRight: 8,
      paddingBottom: 16,
      paddingLeft: 24,
    })
  })

  test('margin follows the same rule', () => {
    expect(layoutStyle({ margin: 'sm' })).toEqual({ margin: 8 })
    expect(layoutStyle({ margin: { top: 'xs', trailing: 'xs', bottom: 'xs', leading: 'xs' } })).toEqual({
      marginTop: 4,
      marginRight: 4,
      marginBottom: 4,
      marginLeft: 4,
    })
  })

  test('padding and margin can coexist', () => {
    expect(layoutStyle({ padding: 'md', margin: 'sm' })).toEqual({ padding: 16, margin: 8 })
  })

  test('fill / wrap / numeric width and height', () => {
    expect(layoutStyle({ width: 'fill' })).toEqual({ width: '100%' })
    expect(layoutStyle({ width: 'wrap' })).toEqual({ width: 'fit-content' })
    expect(layoutStyle({ width: 120 })).toEqual({ width: 120 })
    expect(layoutStyle({ height: 'fill' })).toEqual({ height: '100%' })
    expect(layoutStyle({ height: 'wrap' })).toEqual({ height: 'fit-content' })
    expect(layoutStyle({ height: 44 })).toEqual({ height: 44 })
  })

  test('weight becomes flexGrow, and 0 counts as a value', () => {
    expect(layoutStyle({ weight: 1 })).toEqual({ flexGrow: 1 })
    expect(layoutStyle({ weight: 0 })).toEqual({ flexGrow: 0 })
  })

  test('alignSelf maps onto the flex vocabulary', () => {
    expect(layoutStyle({ alignSelf: 'start' })).toEqual({ alignSelf: 'flex-start' })
    expect(layoutStyle({ alignSelf: 'center' })).toEqual({ alignSelf: 'center' })
    expect(layoutStyle({ alignSelf: 'end' })).toEqual({ alignSelf: 'flex-end' })
    expect(layoutStyle({ alignSelf: 'stretch' })).toEqual({ alignSelf: 'stretch' })
  })

  test('aspectRatio is stringified', () => {
    expect(layoutStyle({ aspectRatio: 1.5 })).toEqual({ aspectRatio: '1.5' })
  })

  test('nothing resembling absolute positioning is ever produced', () => {
    // The schema cannot express position at all (docs/spec/schema.md §2.1).
    const style = layoutStyle({ padding: 'md', width: 'fill', weight: 1, alignSelf: 'center' })
    for (const forbidden of ['position', 'top', 'left', 'right', 'bottom']) {
      expect(style).not.toHaveProperty(forbidden)
    }
  })
})

describe('visualStyle', () => {
  test('no style means no CSS', () => {
    expect(visualStyle(undefined, 'light')).toEqual({})
    expect(visualStyle({}, 'light')).toEqual({})
  })

  test('foreground and background resolve per theme', () => {
    expect(visualStyle({ background: 'primary' }, 'light')).toEqual({ backgroundColor: '#3B5BDB' })
    expect(visualStyle({ background: 'primary' }, 'dark')).toEqual({ backgroundColor: '#AEC0FF' })
    expect(visualStyle({ foreground: 'onPrimary' }, 'light')).toEqual({ color: '#FFFFFF' })
  })

  test('radius becomes px', () => {
    expect(visualStyle({ radius: 'md' }, 'light')).toEqual({ borderRadius: 8 })
    expect(visualStyle({ radius: 'full' }, 'light')).toEqual({ borderRadius: 9999 })
  })

  test('a border with no width defaults to 1px', () => {
    expect(visualStyle({ border: { color: 'outline' } }, 'light')).toEqual({
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: '#C7C8CC',
    })
  })

  test('an explicit border width is honoured', () => {
    expect(visualStyle({ border: { color: 'outline', width: 2 } }, 'light')).toMatchObject({ borderWidth: 2 })
  })

  test('elevation maps onto a shadow', () => {
    expect(visualStyle({ elevation: 0 }, 'light')).toEqual({ boxShadow: 'none' })
    expect(visualStyle({ elevation: 2 }, 'light')).toEqual({ boxShadow: '0 2px 6px rgba(0,0,0,0.20)' })
  })

  test('opacity 0 counts as a value', () => {
    expect(visualStyle({ opacity: 0 }, 'light')).toEqual({ opacity: 0 })
    expect(visualStyle({ opacity: 0.5 }, 'light')).toEqual({ opacity: 0.5 })
  })

  test('an unknown color token becomes undefined and does not break the CSS', () => {
    // The type is closed over ColorToken, but a document can carry any string at runtime.
    const unknownToken = 'no-such-token' as never
    expect(visualStyle({ background: unknownToken }, 'light')).toEqual({ backgroundColor: undefined })
  })

  test('several declarations apply together', () => {
    expect(visualStyle({ background: 'surface', radius: 'sm', elevation: 1 }, 'light')).toEqual({
      backgroundColor: '#FFFFFF',
      borderRadius: 4,
      boxShadow: '0 1px 2px rgba(0,0,0,0.16)',
    })
  })
})
