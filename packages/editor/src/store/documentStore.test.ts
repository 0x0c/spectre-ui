import { beforeEach, describe, expect, it } from 'vitest'
import type { SpectreNode } from '@spectre-ui/manifest/generated'
import { SpectreLimits } from '@spectre-ui/manifest/generated'
import { editorManifest } from '../manifest/editorManifest'
import { countNodes } from '../tree/nodeOps'
import { EMPTY_DOCUMENT, useDocumentStore } from './documentStore'

const VStack = editorManifest.componentsByName.get('VStack')!
const Text = editorManifest.componentsByName.get('Text')!
const Button = editorManifest.componentsByName.get('Button')!

beforeEach(() => {
  useDocumentStore.getState().loadDocument(EMPTY_DOCUMENT)
})

describe('addComponent / drag-and-drop tree updates', () => {
  it('appends a new node to the given container and selects it', () => {
    const id = useDocumentStore.getState().addComponent(VStack, 'screen')
    expect(id).toBeTruthy()
    const { document, selectedNodeId } = useDocumentStore.getState()
    expect(document.root.children?.[0].id).toBe(id)
    expect(document.root.children?.[0].type).toBe('VStack')
    expect(selectedNodeId).toBe(id)
  })

  it('fills in declared defaults on the new node', () => {
    useDocumentStore.getState().addComponent(VStack, 'screen')
    const node = useDocumentStore.getState().document.root.children?.[0]
    expect(node?.props).toMatchObject({ spacing: 'none', alignment: 'leading', distribution: 'packed' })
  })

  it('nests a component inside another freshly added container', () => {
    const store = useDocumentStore.getState()
    const stackId = store.addComponent(VStack, 'screen')!
    const textId = useDocumentStore.getState().addComponent(Text, stackId)!
    const stackNode = useDocumentStore.getState().document.root.children?.[0]
    expect(stackNode?.children?.[0].id).toBe(textId)
  })

  it('refuses to add past the node-count limit and reports why', () => {
    useDocumentStore.setState((state) => {
      const children: SpectreNode[] = Array.from(
        { length: SpectreLimits.maxNodes - 1 },
        (_, i) => ({ id: `t${i}`, type: 'Text', props: { text: 'x' } }) as SpectreNode,
      )
      return { document: { ...state.document, root: { ...state.document.root, children } } }
    })
    expect(countNodes(useDocumentStore.getState().document.root)).toBe(SpectreLimits.maxNodes)

    const id = useDocumentStore.getState().addComponent(Text, 'screen')
    expect(id).toBeUndefined()
    expect(useDocumentStore.getState().lastError).toMatch(/ノード数の上限/)
    expect(countNodes(useDocumentStore.getState().document.root)).toBe(SpectreLimits.maxNodes)
  })

  it('refuses to add past the depth limit', () => {
    // ルート自身が深さ1。maxDepth まで積み上げた VStack の下に、さらに1つ足そうとすると拒否される。
    let parentId = 'screen'
    for (let i = 1; i < SpectreLimits.maxDepth; i++) {
      parentId = useDocumentStore.getState().addComponent(VStack, parentId)!
    }
    const id = useDocumentStore.getState().addComponent(VStack, parentId)
    expect(id).toBeUndefined()
    expect(useDocumentStore.getState().lastError).toMatch(/深さの上限/)
  })
})

describe('moveNode / removeNode', () => {
  it('moves a node between containers', () => {
    const store = useDocumentStore.getState()
    const leftId = store.addComponent(VStack, 'screen')!
    const rightId = useDocumentStore.getState().addComponent(VStack, 'screen')!
    const buttonId = useDocumentStore.getState().addComponent(Button, leftId)!

    useDocumentStore.getState().moveNode(buttonId, rightId, null)

    const doc = useDocumentStore.getState().document
    const left = doc.root.children?.find((c) => c.id === leftId)
    const right = doc.root.children?.find((c) => c.id === rightId)
    expect(left?.children).toEqual([])
    expect(right?.children?.[0].id).toBe(buttonId)
  })

  it('removes a node and clears selection if it was selected', () => {
    const id = useDocumentStore.getState().addComponent(Text, 'screen')!
    expect(useDocumentStore.getState().selectedNodeId).toBe(id)
    useDocumentStore.getState().removeNode(id)
    expect(useDocumentStore.getState().document.root.children).toEqual([])
    expect(useDocumentStore.getState().selectedNodeId).toBeNull()
  })
})

describe('undo / redo (Immer patch stream)', () => {
  it('undoes an addComponent back to the prior document', () => {
    useDocumentStore.getState().addComponent(Text, 'screen')
    expect(useDocumentStore.getState().document.root.children).toHaveLength(1)

    useDocumentStore.getState().undo()
    expect(useDocumentStore.getState().document.root.children).toHaveLength(0)
  })

  it('redoes after an undo', () => {
    const id = useDocumentStore.getState().addComponent(Text, 'screen')!
    useDocumentStore.getState().undo()
    useDocumentStore.getState().redo()
    expect(useDocumentStore.getState().document.root.children?.[0].id).toBe(id)
  })

  it('clears the redo stack once a new change is applied', () => {
    useDocumentStore.getState().addComponent(Text, 'screen')
    useDocumentStore.getState().undo()
    useDocumentStore.getState().addComponent(Button, 'screen')
    expect(useDocumentStore.getState().redoStack).toHaveLength(0)
    useDocumentStore.getState().redo() // no-op, nothing to redo
    expect(useDocumentStore.getState().document.root.children).toHaveLength(1)
    expect(useDocumentStore.getState().document.root.children?.[0].type).toBe('Button')
  })

  it('undoes a prop edit made through updateNodeProp', () => {
    const id = useDocumentStore.getState().addComponent(Text, 'screen')!
    useDocumentStore.getState().updateNodeProp(id, ['text'], 'changed')
    expect(useDocumentStore.getState().document.root.children?.[0].props).toMatchObject({ text: 'changed' })
    useDocumentStore.getState().undo()
    expect(useDocumentStore.getState().document.root.children?.[0].props).not.toMatchObject({ text: 'changed' })
  })

  it('is a no-op when there is nothing to undo or redo', () => {
    const before = useDocumentStore.getState().document
    useDocumentStore.getState().undo()
    useDocumentStore.getState().redo()
    expect(useDocumentStore.getState().document).toBe(before)
  })
})

describe('updateDocumentField', () => {
  it('updates the sample data scope through the same undo-able apply path', () => {
    useDocumentStore.getState().updateDocumentField('data', { product: { stock: 5 } })
    expect(useDocumentStore.getState().document.data).toEqual({ product: { stock: 5 } })
    useDocumentStore.getState().undo()
    expect(useDocumentStore.getState().document.data).toEqual({})
  })
})
