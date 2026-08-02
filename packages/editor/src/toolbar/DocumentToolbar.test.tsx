import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_DOCUMENT, useDocumentStore } from '../store/documentStore'
import { DocumentToolbar } from './DocumentToolbar'

beforeEach(() => {
  useDocumentStore.getState().loadDocument(EMPTY_DOCUMENT)
  vi.stubGlobal('alert', vi.fn())
})

function importFile(contents: string) {
  const file = new File([contents], 'doc.json', { type: 'application/json' })
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

describe('DocumentToolbar', () => {
  it('"New" resets the document to the empty starting doc', () => {
    useDocumentStore.getState().updateDocumentField('data', { x: 1 })
    render(<DocumentToolbar />)
    fireEvent.click(screen.getByText('新規'))
    expect(useDocumentStore.getState().document.data).toEqual({})
  })

  it('imports a well-formed document', async () => {
    render(<DocumentToolbar />)
    importFile(JSON.stringify({ schemaVersion: '1.0', id: 'imported', root: { type: 'Screen', props: {} } }))

    await waitFor(() => expect(useDocumentStore.getState().document.id).toBe('imported'))
  })

  it('rejects a JSON file that is missing root, without crashing (regression: this used to throw inside loadDocument)', async () => {
    render(<DocumentToolbar />)
    importFile(JSON.stringify({ schemaVersion: '1.0', id: 'no-root' }))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('root')))
    // the store was not mutated into a broken state
    expect(useDocumentStore.getState().document.id).toBe('untitled')
  })

  it('rejects a document that exceeds the node-count resource limit', async () => {
    render(<DocumentToolbar />)
    const children = Array.from({ length: 3000 }, (_, i) => ({ id: `t${i}`, type: 'Text', props: { text: 'x' } }))
    importFile(JSON.stringify({ schemaVersion: '1.0', id: 'huge', root: { id: 'root', type: 'Screen', props: {}, children } }))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('インポートできません')))
    expect(useDocumentStore.getState().document.id).toBe('untitled')
  })

  it('rejects unparsable JSON without crashing', async () => {
    render(<DocumentToolbar />)
    importFile('{ not valid json')

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('JSON として読み込めませんでした'))
  })
})
