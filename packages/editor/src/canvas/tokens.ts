import { editorManifest } from '../manifest/editorManifest'

/**
 * トークン名 -> 実際の見た目、の対応。docs/architecture.md §6 の通り、本番ではこの対応表を
 * 決めるのはホストアプリの `SpectreTheme` で、SDK・マニフェストはトークン名しか知らない。
 * ここはエディタ専用の「そのふりをする」プレビューテーマ — 近似プレビューであることの
 * 一部で、実機の見た目を保証するものではない (ADR-0005)。
 */
export const COLOR_VALUES: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    primary: '#3B5BDB',
    onPrimary: '#FFFFFF',
    primaryContainer: '#DBE4FF',
    onPrimaryContainer: '#001A6E',
    secondary: '#5C6470',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#DDE2EC',
    onSecondaryContainer: '#171C22',
    surface: '#FFFFFF',
    onSurface: '#1A1C1E',
    surfaceVariant: '#F2F2F5',
    onSurfaceVariant: '#44464A',
    background: '#F7F7F9',
    onBackground: '#1A1C1E',
    outline: '#C7C8CC',
    outlineVariant: '#E2E2E6',
    error: '#BA1A1A',
    onError: '#FFFFFF',
    success: '#1C7A3E',
    onSuccess: '#FFFFFF',
    warning: '#8A5A00',
    onWarning: '#FFFFFF',
    info: '#0B61A4',
    onInfo: '#FFFFFF',
    transparent: 'transparent',
  },
  dark: {
    primary: '#AEC0FF',
    onPrimary: '#00287A',
    primaryContainer: '#1C3B93',
    onPrimaryContainer: '#DBE4FF',
    secondary: '#C4C8D3',
    onSecondary: '#2E3440',
    secondaryContainer: '#444B57',
    onSecondaryContainer: '#DDE2EC',
    surface: '#121316',
    onSurface: '#E3E3E6',
    surfaceVariant: '#1E2024',
    onSurfaceVariant: '#C4C6CB',
    background: '#0E0F11',
    onBackground: '#E3E3E6',
    outline: '#3A3D42',
    outlineVariant: '#2A2C30',
    error: '#FFB4AB',
    onError: '#690005',
    success: '#7FDD9A',
    onSuccess: '#00390F',
    warning: '#FFCA6B',
    onWarning: '#452B00',
    info: '#9ECAFF',
    onInfo: '#00325A',
    transparent: 'transparent',
  },
}

export const TYPOGRAPHY_VALUES: Record<string, { fontSize: number; fontWeight: number; lineHeight: number }> = {
  displayLg: { fontSize: 34, fontWeight: 700, lineHeight: 1.15 },
  displayMd: { fontSize: 28, fontWeight: 700, lineHeight: 1.15 },
  titleLg: { fontSize: 22, fontWeight: 700, lineHeight: 1.25 },
  titleMd: { fontSize: 18, fontWeight: 600, lineHeight: 1.3 },
  titleSm: { fontSize: 16, fontWeight: 600, lineHeight: 1.3 },
  bodyLg: { fontSize: 16, fontWeight: 400, lineHeight: 1.5 },
  bodyMd: { fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
  bodySm: { fontSize: 12, fontWeight: 400, lineHeight: 1.5 },
  label: { fontSize: 12, fontWeight: 500, lineHeight: 1.3 },
  caption: { fontSize: 11, fontWeight: 400, lineHeight: 1.3 },
  overline: { fontSize: 10, fontWeight: 600, lineHeight: 1.3 },
}

export const ELEVATION_SHADOWS: Record<number, string> = {
  0: 'none',
  1: '0 1px 2px rgba(0,0,0,0.16)',
  2: '0 2px 6px rgba(0,0,0,0.20)',
  3: '0 4px 12px rgba(0,0,0,0.24)',
}

export function spacingPx(token: string | undefined): number {
  if (!token) return 0
  return editorManifest.tokens.spacing[token] ?? 0
}

export function radiusPx(token: string | undefined): number {
  if (!token) return 0
  const value = editorManifest.tokens.radius[token] ?? 0
  return value < 0 ? 9999 : value
}

export function colorValue(token: string | undefined, theme: 'light' | 'dark'): string | undefined {
  if (!token) return undefined
  return COLOR_VALUES[theme][token]
}
