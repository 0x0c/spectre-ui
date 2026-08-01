import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'
import { setupTestApp, testDb } from './helpers.ts'

let app: FastifyInstance

before(async () => {
  ;({ app } = await setupTestApp())
})

after(async () => {
  await app.close()
  await testDb().end()
})

test('POST /api/telemetry は妥当なイベントを受け付ける', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/telemetry',
    payload: [
      { screenId: 'telemetry-screen', event: 'spectre.document.loaded', properties: { source: 'network' } },
    ],
  })
  assert.equal(response.statusCode, 202)
  assert.equal(response.json().accepted, 1)
})

test('POST /api/telemetry は空配列を 400 で拒否する', async () => {
  const response = await app.inject({ method: 'POST', url: '/api/telemetry', payload: [] })
  assert.equal(response.statusCode, 400)
})

test('GET /api/screens/:screenId/adoption は対応率を計算する', async () => {
  const screenId = 'telemetry-adoption'
  await app.inject({
    method: 'POST',
    url: '/api/telemetry',
    payload: [
      { screenId, event: 'spectre.document.loaded' },
      { screenId, event: 'spectre.document.loaded' },
      { screenId, event: 'spectre.document.loaded' },
      { screenId, event: 'spectre.document.loaded' },
      { screenId, event: 'spectre.node.unknown', properties: { nodeType: 'FancyCarousel' } },
    ],
  })

  const response = await app.inject({ method: 'GET', url: `/api/screens/${screenId}/adoption` })
  assert.equal(response.statusCode, 200)
  const body = response.json()
  assert.equal(body.eventCounts['spectre.document.loaded'], 4)
  assert.equal(body.eventCounts['spectre.node.unknown'], 1)
  assert.equal(body.degradationRate, 0.25)
  assert.equal(body.degradationsByNodeType.FancyCarousel, 1)
})

test('GET /api/screens/:screenId/adoption は読み込みが0件なら degradationRate が null', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/screens/unknown-screen/adoption' })
  assert.equal(response.json().degradationRate, null)
})

test('POST /api/telemetry は不正な versionId を持つ1件だけを捨て、残りは受け付ける', async () => {
  const screenId = 'telemetry-partial-batch'
  const response = await app.inject({
    method: 'POST',
    url: '/api/telemetry',
    payload: [
      { screenId, event: 'spectre.document.loaded' },
      // 存在しない document_versions を指す versionId — 外部キー違反になるはずの1件。
      { screenId, versionId: '00000000-0000-0000-0000-000000000000', event: 'spectre.document.loaded' },
      { screenId, event: 'spectre.document.loaded' },
    ],
  })
  assert.equal(response.statusCode, 202, response.body)
  assert.equal(response.json().accepted, 2)

  const adoption = await app.inject({ method: 'GET', url: `/api/screens/${screenId}/adoption` })
  assert.equal(adoption.json().eventCounts['spectre.document.loaded'], 2)
})
