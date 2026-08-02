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

test('GET /screens/:screenId はケイパビリティ申告があれば未対応ノードを整形する (SU-0008)', async () => {
  const created = await app.inject({
    method: 'POST',
    url: '/api/documents',
    payload: {
      screenId: 'delivery-capability',
      name: 'delivery-capability',
      body: {
        schemaVersion: '1.0',
        id: 'delivery-capability',
        root: {
          type: 'VStack',
          children: [
            { type: 'Text', id: 'a', props: { text: 'before' } },
            {
              type: 'FutureCarousel',
              id: 'car',
              fallback: { type: 'Text', id: 'car_fb', props: { text: 'fallback text' } },
            },
          ],
        },
      },
      actor: 'alice',
    },
  })
  const { document } = created.json()
  await app.inject({
    method: 'POST',
    url: `/api/documents/${document.id}/publish`,
    payload: { seq: 1, channel: 'production', actor: 'alice', approvedBy: 'bob' },
  })

  const shaped = await app.inject({
    method: 'GET',
    url: `/screens/delivery-capability?channel=production`,
    headers: { 'spectre-schema': '1.0', 'spectre-components': 'unrecognized-hash' },
  })
  assert.equal(shaped.statusCode, 200)
  const shapedChildren = shaped.json().root.children as Array<{ type: string; id: string }>
  assert.deepEqual(
    shapedChildren.map((c) => c.type),
    ['Text', 'Text'],
  )
  assert.equal(shapedChildren[1].id, 'car_fb')

  const unshaped = await app.inject({ method: 'GET', url: `/screens/delivery-capability?channel=production` })
  assert.equal(unshaped.statusCode, 200)
  const unshapedChildren = unshaped.json().root.children as Array<{ type: string }>
  assert.deepEqual(
    unshapedChildren.map((c) => c.type),
    ['Text', 'FutureCarousel'],
  )

  // ケイパビリティが変われば ETag も変わる (docs/compatibility.md §2 — CDN が誤ったキャッシュを返さないため)。
  assert.notEqual(shaped.headers.etag, unshaped.headers.etag)
  assert.equal(shaped.headers.vary, 'Spectre-Schema, Spectre-Components')
})
