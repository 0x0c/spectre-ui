/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// packages/editor -> リポジトリルートは2つ上。spec/ と examples/ を直接 import する
// (src/manifest/rawManifest.ts, src/sample/productDetail.ts) ため、dev サーバの
// fs 許可リストに含める。`vite build` はバンドラが直接ファイルを読むため制約を受けないが、
// `vite dev` の HTTP 経路はここで明示しないとリポジトリルート外を拒否する。
const repoRoot = resolve(__dirname, '../..')

export default defineConfig(({ command }) => ({
  // GitHub Pages 上では docs サイトと同居し、/spectre-ui/editor/ 配下に置く
  // (.github/workflows/pages.yml が dist/ を site/editor/ にコピーする)。
  base: command === 'build' ? '/spectre-ui/editor/' : '/',
  plugins: [react()],
  server: {
    fs: { allow: [repoRoot] },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
}))
