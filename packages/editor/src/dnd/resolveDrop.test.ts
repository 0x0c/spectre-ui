import { describe, expect, it, vi } from 'vitest'
import type { ComponentDef } from '@spectre-ui/manifest/editor-schema'
import { resolveDrop } from './resolveDrop'

const VStackDef = { name: 'VStack', category: 'layout', rootOnly: false, acceptsChildren: true, props: [] } as ComponentDef

function makeDeps() {
  return {
    getComponent: vi.fn((name: string) => (name === 'VStack' ? VStackDef : undefined)),
    addComponent: vi.fn(),
    moveNode: vi.fn(),
  }
}

describe('resolveDrop', () => {
  it('does nothing when there is no drop target', () => {
    const deps = makeDeps()
    resolveDrop({ kind: 'palette', name: 'VStack' }, undefined, deps)
    expect(deps.addComponent).not.toHaveBeenCalled()
  })

  it('does nothing when there is no drag source', () => {
    const deps = makeDeps()
    resolveDrop(undefined, { kind: 'append', containerId: 'screen' }, deps)
    expect(deps.addComponent).not.toHaveBeenCalled()
    expect(deps.moveNode).not.toHaveBeenCalled()
  })

  it('adds the looked-up component when a palette item is dropped on a container', () => {
    const deps = makeDeps()
    resolveDrop({ kind: 'palette', name: 'VStack' }, { kind: 'append', containerId: 'screen' }, deps)
    expect(deps.getComponent).toHaveBeenCalledWith('VStack')
    expect(deps.addComponent).toHaveBeenCalledWith(VStackDef, 'screen')
  })

  it('silently ignores a palette item that is not in the manifest', () => {
    const deps = makeDeps()
    resolveDrop({ kind: 'palette', name: 'NotReal' }, { kind: 'append', containerId: 'screen' }, deps)
    expect(deps.addComponent).not.toHaveBeenCalled()
  })

  it('moves an existing node when dropped on a different container', () => {
    const deps = makeDeps()
    resolveDrop({ kind: 'node', id: 'button_1' }, { kind: 'append', containerId: 'stack_2' }, deps)
    expect(deps.moveNode).toHaveBeenCalledWith('button_1', 'stack_2', null)
  })

  it('refuses to drop a node onto itself', () => {
    const deps = makeDeps()
    resolveDrop({ kind: 'node', id: 'stack_1' }, { kind: 'append', containerId: 'stack_1' }, deps)
    expect(deps.moveNode).not.toHaveBeenCalled()
  })
})
