import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_DOCUMENT, useDocumentStore } from '../store/documentStore'
import { DataPanel } from './DataPanel'

beforeEach(() => {
  useDocumentStore.getState().loadDocument(EMPTY_DOCUMENT)
})

describe('DataPanel', () => {
  it('shows the current data and state JSON', () => {
    useDocumentStore.getState().updateDocumentField('data', { product: { stock: 3 } })
    render(<DataPanel />);
    expect(screen.getByText(/data/)).toBeInTheDocument()
    expect(screen.getByDisplayValue(/"stock": 3/)).toBeInTheDocument()
  })

  it('commits a valid edit to the store on blur, going through the undo-able apply path', () => {
    render(<DataPanel />)
    const textareas = screen.getAllByRole('textbox')
    const dataTextarea = textareas[0]
    fireEvent.change(dataTextarea, { target: { value: '{"greeting": "hi"}' } })
    fireEvent.blur(dataTextarea)

    expect(useDocumentStore.getState().document.data).toEqual({ greeting: 'hi' })
    // undo() here runs outside any DOM event, so the resulting re-render of the still-mounted
    // JsonScopeEditor needs an explicit act() boundary.
    act(() => {
      useDocumentStore.getState().undo()
    })
    expect(useDocumentStore.getState().document.data).toEqual({})
  })

  it('shows a parse error instead of committing invalid JSON', () => {
    render(<DataPanel />)
    const dataTextarea = screen.getAllByRole('textbox')[0]
    fireEvent.change(dataTextarea, { target: { value: '{not valid' } })
    fireEvent.blur(dataTextarea)

    expect(screen.getByText(/JSON として読めません/)).toBeInTheDocument()
    expect(useDocumentStore.getState().document.data).toEqual({})
  })

  it('refuses sample data that would push the document past the 1 MB resource limit (docs/architecture.md §7)', () => {
    render(<DataPanel />)
    const dataTextarea = screen.getAllByRole('textbox')[0]
    const huge = JSON.stringify({ blob: 'x'.repeat(2 * 1024 * 1024) })
    fireEvent.change(dataTextarea, { target: { value: huge } })
    fireEvent.blur(dataTextarea)

    expect(screen.getByText(/上限/)).toBeInTheDocument()
    expect(useDocumentStore.getState().document.data).toEqual({})
  })
})
