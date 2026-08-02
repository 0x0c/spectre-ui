import { beforeEach, describe, expect, test } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  DEVICE_PRESETS,
  FONT_SCALE_PRESETS,
  LOCALE_PRESETS,
  usePreviewDevice,
  usePreviewEnv,
  usePreviewStore,
} from './previewStore'

/**
 * Unit tests for the preview environment store.
 *
 * `env` is handed straight to expression evaluation as a scope (SU-0003 detailed design,
 * point 8), so what gives the preview its meaning is that switching device actually moves
 * `widthClass` and `platform`. On top of that, the derived objects being stable under
 * `useMemo` is a requirement rather than an implementation detail — returning a fresh
 * reference each time sends `useSyncExternalStore` into an infinite re-render. Both are
 * pinned here.
 */

const initialState = usePreviewStore.getState()

beforeEach(() => {
  usePreviewStore.setState(initialState, true)
})

describe('presets', () => {
  test('device ids do not repeat', () => {
    const ids = DEVICE_PRESETS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('the preset lists are non-empty', () => {
    expect(DEVICE_PRESETS.length).toBeGreaterThan(0)
    expect(LOCALE_PRESETS.length).toBeGreaterThan(0)
    expect(FONT_SCALE_PRESETS).toContain(1.0)
  })
})

describe('usePreviewStore', () => {
  test('it starts on the first device, light theme, first locale', () => {
    const state = usePreviewStore.getState()
    expect(state.deviceId).toBe(DEVICE_PRESETS[0].id)
    expect(state.theme).toBe('light')
    expect(state.locale).toBe(LOCALE_PRESETS[0])
    expect(state.fontScale).toBe(1.0)
  })

  test('each setter moves only its own field', () => {
    act(() => usePreviewStore.getState().setTheme('dark'))
    expect(usePreviewStore.getState().theme).toBe('dark')
    expect(usePreviewStore.getState().deviceId).toBe(DEVICE_PRESETS[0].id)

    act(() => usePreviewStore.getState().setDevice('pixel8'))
    act(() => usePreviewStore.getState().setLocale('en-US'))
    act(() => usePreviewStore.getState().setFontScale(1.3))
    const state = usePreviewStore.getState()
    expect(state).toMatchObject({ deviceId: 'pixel8', locale: 'en-US', fontScale: 1.3, theme: 'dark' })
  })
})

describe('usePreviewDevice', () => {
  test('it looks the device up by id', () => {
    act(() => usePreviewStore.getState().setDevice('pixel8'))
    const { result } = renderHook(() => usePreviewDevice())
    expect(result.current.label).toBe('Pixel 8')
    expect(result.current.platform).toBe('android')
  })

  test('an unknown id falls back to the first device', () => {
    act(() => usePreviewStore.getState().setDevice('no-such-device'))
    const { result } = renderHook(() => usePreviewDevice())
    expect(result.current).toBe(DEVICE_PRESETS[0])
  })

  test('the same id returns the same reference', () => {
    const { result, rerender } = renderHook(() => usePreviewDevice())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})

describe('usePreviewEnv', () => {
  test("the device's platform surfaces in env", () => {
    const { result } = renderHook(() => usePreviewEnv())
    expect(result.current.platform).toBe('ios')

    act(() => usePreviewStore.getState().setDevice('pixel8'))
    expect(result.current.platform).toBe('android')
  })

  test('widthClass follows from the width', () => {
    const { result } = renderHook(() => usePreviewEnv())
    act(() => usePreviewStore.getState().setDevice('iphone15')) // 390px
    expect(result.current.widthClass).toBe('compact')

    act(() => usePreviewStore.getState().setDevice('ipadMini')) // 744px
    expect(result.current.widthClass).toBe('expanded')
  })

  test('theme, locale and font scale reach env', () => {
    const { result } = renderHook(() => usePreviewEnv())
    act(() => usePreviewStore.getState().setTheme('dark'))
    act(() => usePreviewStore.getState().setLocale('en-US'))
    act(() => usePreviewStore.getState().setFontScale(2.0))
    expect(result.current).toMatchObject({ theme: 'dark', locale: 'en-US', fontScale: 2.0 })
  })

  test('env carries every field expression evaluation expects', () => {
    const { result } = renderHook(() => usePreviewEnv())
    for (const key of [
      'platform',
      'appVersion',
      'osVersion',
      'locale',
      'timeZone',
      'theme',
      'widthClass',
      'fontScale',
      'isOnline',
    ]) {
      expect(result.current, key).toHaveProperty(key)
    }
  })

  test('an unchanged state returns the same reference', () => {
    // A fresh object each time would send useSyncExternalStore into an infinite re-render.
    const { result, rerender } = renderHook(() => usePreviewEnv())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  test('a changed state returns a new reference', () => {
    const { result } = renderHook(() => usePreviewEnv())
    const first = result.current
    act(() => usePreviewStore.getState().setTheme('dark'))
    expect(result.current).not.toBe(first)
  })
})
