import { describe, expect, test } from 'vitest'
import { actionCatalog } from './actionCatalog'
import { editorManifest } from '../manifest/editorManifest'

/**
 * Unit tests for the action catalog.
 *
 * The list of action kinds comes from the manifest, but the parameter shape of each kind lives
 * in a hand-written table (`PARAM_SHAPES`) — the manifest does not carry action parameters, and
 * the source of truth is docs/spec/actions.md §2. So when a new action is added to the manifest
 * and the table is not updated, the editor quietly offers an action with no parameters.
 * Catching that drift is the main point of these tests.
 */

describe('actionCatalog', () => {
  test('it returns every action kind in the manifest', () => {
    const names = actionCatalog().map((a) => a.name)
    expect(names).toEqual(editorManifest.actions.map((a) => a.name))
  })

  test('the manifest-side attributes (async) are preserved', () => {
    const catalog = actionCatalog()
    for (const action of editorManifest.actions) {
      expect(catalog.find((a) => a.name === action.name)?.async).toBe(action.async)
    }
  })

  test('every kind has a parameter shape defined', () => {
    // Forgetting to extend the table leaves that action uneditable.
    const missing = actionCatalog()
      .filter((a) => a.params.length === 0)
      .map((a) => a.name)
    // Only back and dismiss legitimately take no parameters (docs/spec/actions.md §2).
    expect(missing.sort()).toEqual(['back', 'dismiss'])
  })

  test('setState takes path and value', () => {
    const setState = actionCatalog().find((a) => a.name === 'setState')
    expect(setState?.params.map((p) => p.name)).toEqual(['path', 'value'])
    expect(setState?.params.find((p) => p.name === 'value')?.type).toBe('expression')
  })

  test('enum parameters carry their choices', () => {
    const request = actionCatalog().find((a) => a.name === 'request')
    const method = request?.params.find((p) => p.name === 'method')
    expect(method?.type).toBe('enum')
    expect(method?.enumValues).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  })

  test('kinds that nest actions have parameters of type actions', () => {
    const catalog = actionCatalog()
    expect(catalog.find((a) => a.name === 'sequence')?.params[0].type).toBe('actions')
    const condition = catalog.find((a) => a.name === 'condition')
    expect(condition?.params.filter((p) => p.type === 'actions').map((p) => p.name)).toEqual(['then', 'else'])
  })

  test('only enum parameters carry choices, and they are never empty', () => {
    for (const action of actionCatalog()) {
      for (const param of action.params) {
        if (param.type !== 'enum') {
          expect(param.enumValues, `${action.name}.${param.name}`).toBeUndefined()
        } else {
          expect(param.enumValues?.length, `${action.name}.${param.name}`).toBeGreaterThan(0)
        }
      }
    }
  })

  test('parameter names do not repeat within a kind', () => {
    for (const action of actionCatalog()) {
      const names = action.params.map((p) => p.name)
      expect(new Set(names).size, action.name).toBe(names.length)
    }
  })
})
