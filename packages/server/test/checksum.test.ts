import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { checksumOf, etagOf } from '../src/checksum.ts'

/**
 * Unit tests for `checksum.ts`.
 *
 * The checksum feeds both `document_versions.checksum` and the delivery ETag. The route
 * tests (delivery.test.ts) need PostgreSQL and still never check whether the same body
 * yields the same value — which is exactly what being able to answer 304 rests on. This
 * checks it directly, without a database.
 */

describe('checksumOf', () => {
  test('the same body yields the same checksum', () => {
    const body = { schemaVersion: '1.0', id: 'screen', root: { type: 'Screen' } }
    assert.equal(checksumOf(body), checksumOf({ ...body }))
  })

  test('different bodies yield different checksums', () => {
    assert.notEqual(checksumOf({ a: 1 }), checksumOf({ a: 2 }))
    assert.notEqual(checksumOf({ a: 1 }), checksumOf({ b: 1 }))
  })

  test('the result is hex-encoded sha256', () => {
    assert.match(checksumOf({ a: 1 }), /^[0-9a-f]{64}$/)
  })

  test('a different key order gives a different value', () => {
    // JSON.stringify preserves insertion order, so this is not normalized. Delivery returns
    // the stored body verbatim so it does no harm, but record here that "same meaning" does
    // not imply "same value".
    assert.notEqual(checksumOf({ a: 1, b: 2 }), checksumOf({ b: 2, a: 1 }))
  })

  test('primitives and empty values are handled', () => {
    assert.match(checksumOf(null), /^[0-9a-f]{64}$/)
    assert.match(checksumOf({}), /^[0-9a-f]{64}$/)
    assert.match(checksumOf([]), /^[0-9a-f]{64}$/)
    assert.notEqual(checksumOf({}), checksumOf([]))
  })
})

describe('etagOf', () => {
  test('it is the checksum in quotes — a strong ETag', () => {
    assert.equal(etagOf('abc123'), '"abc123"')
  })

  test('there is no W/ prefix', () => {
    const etag = etagOf(checksumOf({ a: 1 }))
    assert.ok(!etag.startsWith('W/'), 'a weak ETag could not claim byte-for-byte identity')
    assert.match(etag, /^"[0-9a-f]{64}"$/)
  })

  test('the same body yields the same ETag — the basis for answering 304', () => {
    const body = { id: 'screen', root: { type: 'Screen' } }
    assert.equal(etagOf(checksumOf(body)), etagOf(checksumOf({ ...body })))
  })
})
