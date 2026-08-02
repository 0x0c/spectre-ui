import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { editorManifest } from '../manifest/editorManifest'
import { EMPTY_DOCUMENT, useDocumentStore } from '../store/documentStore'
import { TreePanel } from './TreePanel'

const Text = editorManifest.componentsByName.get('Text')!

beforeEach(() => {
  useDocumentStore.getState().loadDocument(EMPTY_DOCUMENT)
})

describe('TreePanel', () => {
  it('reflects the document structure, including the root', () => {
    useDocumentStore.getState().addComponent(Text, 'screen')
    render(<TreePanel />)
    const tree = screen.getByRole('tree')
    expect(within(tree).getByText('Screen')).toBeInTheDocument()
    expect(within(tree).getByText('Text')).toBeInTheDocument()
  })

  it('clicking a row selects that node', () => {
    const id = useDocumentStore.getState().addComponent(Text, 'screen')!
    render(<TreePanel />)
    fireEvent.click(screen.getByText('Text'))
    expect(useDocumentStore.getState().selectedNodeId).toBe(id)
  })

  it('the up/down buttons reorder siblings without an off-by-one', () => {
    const store = useDocumentStore.getState()
    store.addComponent(Text, 'screen')
    useDocumentStore.getState().updateNodeProp(useDocumentStore.getState().document.root.children![0].id!, ['text'], 'first')
    useDocumentStore.getState().addComponent(Text, 'screen')
    useDocumentStore.getState().updateNodeProp(useDocumentStore.getState().document.root.children![1].id!, ['text'], 'second')

    render(<TreePanel />)
    const downButtons = screen.getAllByLabelText('下へ移動')
    fireEvent.click(downButtons[0]) // move "first" down past "second"

    const children = useDocumentStore.getState().document.root.children!
    expect((children[0].props as { text: string }).text).toBe('second')
    expect((children[1].props as { text: string }).text).toBe('first')
  })

  it('the delete button removes the node', () => {
    useDocumentStore.getState().addComponent(Text, 'screen')
    render(<TreePanel />)
    fireEvent.click(screen.getByLabelText('削除'))
    expect(useDocumentStore.getState().document.root.children).toHaveLength(0)
  })
})
