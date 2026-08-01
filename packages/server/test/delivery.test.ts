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

async function publishedDocument(screenId: string) {
  const created = await app.inject({
    method: 'POST',
    url: '/api/documents',
    payload: {
      screenId,
      name: screenId,
      body: { schemaVersion: '1.0', id: screenId, root: { type: 'Text', props: { text: 'hi' } } },
      actor: 'alice',
    },
  })
  const { document, version } = created.json()
  const published = await app.inject({
    method: 'POST',
    url: `/api/documents/${document.id}/publish`,
    payload: { seq: 1, channel: 'production', actor: 'alice', approvedBy: 'bob' },
  })
  return { document, version, release: published.json().release }
}

test('GET /screens/:screenId は公開されていなければ 404', async () => {
  const response = await app.inject({ method: 'GET', url: '/screens/nonexistent' })
  assert.equal(response.statusCode, 404)
})

test('GET /screens/:screenId は公開版を ETag つきで返す', async () => {
  await publishedDocument('delivery-basic')
  const response = await app.inject({ method: 'GET', url: `/screens/delivery-basic?channel=production` })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json().id, 'delivery-basic')
  assert.ok(response.headers.etag)
  assert.equal(response.headers['cache-control'], 'public, max-age=60')
})

test('GET /screens/:screenId は If-None-Match が一致すれば 304', async () => {
  await publishedDocument('delivery-304')
  const first = await app.inject({ method: 'GET', url: `/screens/delivery-304?channel=production` })
  const etag = first.headers.etag as string

  const second = await app.inject({
    method: 'GET',
    url: `/screens/delivery-304?channel=production`,
    headers: { 'if-none-match': etag },
  })
  assert.equal(second.statusCode, 304)
})

test('GET /d/:documentId/:versionId はイミュータブルなキャッシュヘッダで返す', async () => {
  const { document, version } = await publishedDocument('delivery-immutable')
  const response = await app.inject({ method: 'GET', url: `/d/${document.id}/${version.id}` })
  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['cache-control'], 'public, max-age=31536000, immutable')
})

test('GET /manifest/:schemaVersion は一致するバージョンでマニフェストを返す', async () => {
  const response = await app.inject({ method: 'GET', url: '/manifest/1.0' })
  assert.equal(response.statusCode, 200)
  assert.ok(response.json().components.length > 0)
})

test('GET /manifest/:schemaVersion は一致しないバージョンで 404', async () => {
  const response = await app.inject({ method: 'GET', url: '/manifest/99.0' })
  assert.equal(response.statusCode, 404)
})
