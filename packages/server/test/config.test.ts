import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig } from '../src/config.ts'

/**
 * Unit tests for `config.ts`.
 *
 * `requireApprovalForProduction` defaults to on and drops only for the exact string
 * `'false'`. What happens for unset, misspelled or empty values decides directly whether a
 * production publish can go out unapproved (docs/architecture.md §7, "authoring privilege
 * abuse"), so the way the environment is read is pinned here.
 */

describe('loadConfig', () => {
  test('an empty environment gives the local-development defaults', () => {
    const config = loadConfig({})
    assert.equal(config.databaseUrl, 'postgres://spectre:spectre@localhost:5432/spectre_dev')
    assert.equal(config.port, 3000)
    assert.equal(config.requireApprovalForProduction, true)
  })

  test('DATABASE_URL and PORT are read from the environment', () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://x@db/y', PORT: '8080' })
    assert.equal(config.databaseUrl, 'postgres://x@db/y')
    assert.equal(config.port, 8080)
  })

  test('an empty PORT falls back to the default', () => {
    assert.equal(loadConfig({ PORT: '' }).port, 3000)
  })

  test('approval is required by default', () => {
    assert.equal(loadConfig({}).requireApprovalForProduction, true)
    assert.equal(loadConfig({ REQUIRE_APPROVAL_FOR_PRODUCTION: 'true' }).requireApprovalForProduction, true)
  })

  test('approval drops only for exactly "false"', () => {
    assert.equal(loadConfig({ REQUIRE_APPROVAL_FOR_PRODUCTION: 'false' }).requireApprovalForProduction, false)
  })

  test('near-miss values do not drop approval', () => {
    // Better that a misspelling leaves production approval on than silently off.
    for (const value of ['False', 'FALSE', '0', 'no', 'off', '', ' false ']) {
      assert.equal(
        loadConfig({ REQUIRE_APPROVAL_FOR_PRODUCTION: value }).requireApprovalForProduction,
        true,
        `${JSON.stringify(value)} must not drop approval`,
      )
    }
  })

  test('omitting the argument reads process.env', () => {
    const previous = process.env.REQUIRE_APPROVAL_FOR_PRODUCTION
    process.env.REQUIRE_APPROVAL_FOR_PRODUCTION = 'false'
    try {
      assert.equal(loadConfig().requireApprovalForProduction, false)
    } finally {
      if (previous === undefined) delete process.env.REQUIRE_APPROVAL_FOR_PRODUCTION
      else process.env.REQUIRE_APPROVAL_FOR_PRODUCTION = previous
    }
  })
})
