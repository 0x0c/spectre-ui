import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { editorManifest } from '../manifest/editorManifest'
import { EMPTY_DOCUMENT, useDocumentStore } from '../store/documentStore'
import { usePreviewStore } from '../store/previewStore'
import { Canvas } from './Canvas'

const Text = editorManifest.componentsByName.get('Text')!
const VStack = editorManifest.componentsByName.get('VStack')!

beforeEach(() => {
  useDocumentStore.getState().loadDocument(EMPTY_DOCUMENT)
  usePreviewStore.setState({ deviceId: 'iphone15', theme: 'light', locale: 'ja-JP', fontScale: 1 })
})

describe('Canvas', () => {
  it('renders interpolated text from the document data scope', () => {
    const store = useDocumentStore.getState()
    const stackId = store.addComponent(VStack, 'screen')!
    useDocumentStore.getState().addComponent(Text, stackId)
    const textId = useDocumentStore.getState().document.root.children![0].children![0].id!
    useDocumentStore.getState().updateNodeProp(textId, ['text'], '${data.greeting}')
    useDocumentStore.getState().updateDocumentField('data', { greeting: 'こんにちは' })

    render(<Canvas />)
    expect(screen.getByText('こんにちは')).toBeInTheDocument()
  })

  it('selecting a node in the canvas updates the store selection', () => {
    const id = useDocumentStore.getState().addComponent(Text, 'screen')!
    useDocumentStore.getState().updateNodeProp(id, ['text'], 'click me')
    useDocumentStore.getState().select(null)
    render(<Canvas />)

    fireEvent.click(screen.getByText('click me'))
    expect(useDocumentStore.getState().selectedNodeId).toBe(id)
  })

  it('clicking empty canvas space clears the selection', () => {
    const id = useDocumentStore.getState().addComponent(Text, 'screen')!
    useDocumentStore.getState().select(id)
    const { container } = render(<Canvas />)

    fireEvent.click(container.querySelector('.canvas-scroll')!)
    expect(useDocumentStore.getState().selectedNodeId).toBeNull()
  })

  it('hides a node whose visibleWhen resolves to a falsy simple path', () => {
    const id = useDocumentStore.getState().addComponent(Text, 'screen')!
    useDocumentStore.getState().updateNodeProp(id, ['text'], 'secret')
    useDocumentStore.getState().updateNodeField(id, ['visibleWhen'], '${state.show}')
    useDocumentStore.getState().updateDocumentField('state', { show: false })

    render(<Canvas />)
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('shows a node whose visibleWhen resolves to a truthy simple path', () => {
    const id = useDocumentStore.getState().addComponent(Text, 'screen')!
    useDocumentStore.getState().updateNodeProp(id, ['text'], 'visible-secret')
    useDocumentStore.getState().updateNodeField(id, ['visibleWhen'], '${state.show}')
    useDocumentStore.getState().updateDocumentField('state', { show: true })

    render(<Canvas />)
    expect(screen.getByText('visible-secret')).toBeInTheDocument()
  })

  it('expands a repeated node once per item, with item bound in scope', () => {
    const id = useDocumentStore.getState().addComponent(Text, 'screen')!
    useDocumentStore.getState().updateNodeProp(id, ['text'], '${item.label}')
    useDocumentStore.getState().updateNodeField(id, ['repeat'], { for: '${data.items}', as: 'item' })
    useDocumentStore.getState().updateDocumentField('data', { items: [{ label: 'one' }, { label: 'two' }] })

    render(<Canvas />)
    expect(screen.getByText('one')).toBeInTheDocument()
    expect(screen.getByText('two')).toBeInTheDocument()
  })

  it('clicking any expanded repeat instance selects the underlying template node, not a synthetic id', () => {
    const id = useDocumentStore.getState().addComponent(Text, 'screen')!
    useDocumentStore.getState().updateNodeProp(id, ['text'], '${item.label}')
    useDocumentStore.getState().updateNodeField(id, ['repeat'], { for: '${data.items}', as: 'item' })
    useDocumentStore.getState().updateDocumentField('data', { items: [{ label: 'alpha' }, { label: 'beta' }] })

    render(<Canvas />)
    fireEvent.click(screen.getByText('beta'))
    expect(useDocumentStore.getState().selectedNodeId).toBe(id)
  })

  it('evaluates a repeated node visibleWhen per item, using the bound item/index', () => {
    const id = useDocumentStore.getState().addComponent(Text, 'screen')!
    useDocumentStore.getState().updateNodeProp(id, ['text'], '${item.label}')
    useDocumentStore.getState().updateNodeField(id, ['repeat'], { for: '${data.items}', as: 'item' })
    useDocumentStore.getState().updateNodeField(id, ['visibleWhen'], '${item.show}')
    useDocumentStore.getState().updateDocumentField('data', {
      items: [
        { label: 'shown', show: true },
        { label: 'hidden', show: false },
      ],
    })

    render(<Canvas />)
    expect(screen.getByText('shown')).toBeInTheDocument()
    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
  })
})
