import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { editorManifest } from '../manifest/editorManifest'
import { EMPTY_DOCUMENT, useDocumentStore } from '../store/documentStore'
import { Inspector } from './Inspector'

const Text = editorManifest.componentsByName.get('Text')!
const Button = editorManifest.componentsByName.get('Button')!
const Grid = editorManifest.componentsByName.get('Grid')!

beforeEach(() => {
  useDocumentStore.getState().loadDocument(EMPTY_DOCUMENT)
})

describe('Inspector', () => {
  it('prompts for a selection when nothing is selected', () => {
    render(<Inspector />)
    expect(screen.getByText(/選択してください/)).toBeInTheDocument()
  })

  it('renders a field for every prop the manifest declares for the selected component', () => {
    useDocumentStore.getState().addComponent(Text, 'screen')
    render(<Inspector />)
    for (const { name } of Text.props) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })

  it('editing a text field commits the change to the document store', () => {
    const id = useDocumentStore.getState().addComponent(Text, 'screen')!
    render(<Inspector />)

    const textInput = screen.getAllByRole('textbox')[0]
    fireEvent.change(textInput, { target: { value: 'edited from inspector' } })
    fireEvent.blur(textInput)

    const node = useDocumentStore.getState().document.root.children!.find((c) => c.id === id)!
    expect((node.props as { text: string }).text).toBe('edited from inspector')
  })

  it('switches to the Actions field for an actions-typed prop (Button.onTap)', () => {
    useDocumentStore.getState().addComponent(Button, 'screen')
    render(<Inspector />)
    expect(screen.getByText('+ アクションを追加')).toBeInTheDocument()
  })

  it('switching tabs shows the layout panel fields', () => {
    useDocumentStore.getState().addComponent(Text, 'screen')
    render(<Inspector />)
    fireEvent.click(screen.getByRole('tab', { name: 'レイアウト' }))
    expect(screen.getByText('weight（flex の伸び率）')).toBeInTheDocument()
  })

  it('the JSON fallback field (for props with no dedicated widget, e.g. Grid.columns) re-syncs its text after an external change like undo', () => {
    useDocumentStore.getState().addComponent(Grid, 'screen')
    render(<Inspector />)

    const jsonField = screen.getByDisplayValue('2') // Grid.columns default
    fireEvent.change(jsonField, { target: { value: '3' } })
    fireEvent.blur(jsonField)
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()

    act(() => {
      useDocumentStore.getState().undo()
    })
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
  })
})
