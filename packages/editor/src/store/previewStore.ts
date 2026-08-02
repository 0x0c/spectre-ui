import { useMemo } from 'react'
import { create } from 'zustand'

/**
 * 近似プレビューが式評価に渡す `env` スコープと、キャンバスの見た目を切り替える
 * デバイス枠を持つ (SU-0003 Detailed design 項目8)。ドキュメント本体とは無関係の
 * エディタ側の状態なので、documentStore の undo/redo 対象には含めない。
 */

export interface DevicePreset {
  id: string
  label: string
  width: number
  height: number
  platform: 'ios' | 'android'
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: 'iphone15', label: 'iPhone 15', width: 390, height: 844, platform: 'ios' },
  { id: 'iphoneSE', label: 'iPhone SE', width: 375, height: 667, platform: 'ios' },
  { id: 'pixel8', label: 'Pixel 8', width: 412, height: 915, platform: 'android' },
  { id: 'ipadMini', label: 'iPad mini', width: 744, height: 1133, platform: 'ios' },
]

export const LOCALE_PRESETS = ['ja-JP', 'en-US'] as const
export const FONT_SCALE_PRESETS = [0.85, 1.0, 1.3, 2.0] as const

export interface PreviewEnv {
  platform: 'ios' | 'android'
  appVersion: string
  osVersion: string
  locale: string
  timeZone: string
  theme: 'light' | 'dark'
  widthClass: 'compact' | 'regular' | 'expanded'
  fontScale: number
  isOnline: boolean
}

interface PreviewStoreState {
  deviceId: string
  theme: 'light' | 'dark'
  locale: string
  fontScale: number
  setDevice: (deviceId: string) => void
  setTheme: (theme: 'light' | 'dark') => void
  setLocale: (locale: string) => void
  setFontScale: (fontScale: number) => void
}

export const usePreviewStore = create<PreviewStoreState>((set) => ({
  deviceId: DEVICE_PRESETS[0].id,
  theme: 'light',
  locale: LOCALE_PRESETS[0],
  fontScale: 1.0,

  setDevice: (deviceId) => set({ deviceId }),
  setTheme: (theme) => set({ theme }),
  setLocale: (locale) => set({ locale }),
  setFontScale: (fontScale) => set({ fontScale }),
}))

// `device`/`env` は意図的に store のセレクタではなく React フックにしてある — Zustand の
// セレクタが呼ばれるたびに新しいオブジェクトを返すと、`useSyncExternalStore` が「値が
// 変わった」と判定して無限に再レンダーする (`getSnapshot should be cached`)。
// プリミティブなフィールドだけをセレクタで取り出し、派生オブジェクトは `useMemo` で
// メモ化することでこれを避ける。

export function usePreviewDevice(): DevicePreset {
  const deviceId = usePreviewStore((s) => s.deviceId)
  return useMemo(() => DEVICE_PRESETS.find((d) => d.id === deviceId) ?? DEVICE_PRESETS[0], [deviceId])
}

export function usePreviewEnv(): PreviewEnv {
  const device = usePreviewDevice()
  const locale = usePreviewStore((s) => s.locale)
  const theme = usePreviewStore((s) => s.theme)
  const fontScale = usePreviewStore((s) => s.fontScale)

  return useMemo(
    () => ({
      platform: device.platform,
      appVersion: '0.0.0-preview',
      osVersion: 'preview',
      locale,
      timeZone: 'Asia/Tokyo',
      theme,
      widthClass: device.width >= 700 ? 'expanded' : device.width >= 480 ? 'regular' : 'compact',
      fontScale,
      isOnline: true,
    }),
    [device, locale, theme, fontScale],
  )
}
