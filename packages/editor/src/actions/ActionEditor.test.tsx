import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ActionEditor } from './ActionEditor'

describe('ActionEditor', () => {
  it('renders one card per action in the array', () => {
    render(<ActionEditor value={[{ type: 'setState', path: 'adding', value: true }, { type: 'track', event: 'cart_add' }]} onChange={() => {}} />)
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2)
  })

  it('adds a new action card with the first catalog entry as its type', () => {
    const onChange = vi.fn()
    render(<ActionEditor value={[]} onChange={onChange} />)
    fireEvent.click(screen.getByText('+ アクションを追加'))
    expect(onChange).toHaveBeenCalledWith([{ type: 'setState' }])
  })

  it('removes an action when its delete button is clicked', () => {
    const onChange = vi.fn()
    render(<ActionEditor value={[{ type: 'setState', path: 'x' }, { type: 'toggleState', path: 'y' }]} onChange={onChange} />)
    fireEvent.click(screen.getAllByLabelText('このアクションを削除')[0])
    expect(onChange).toHaveBeenCalledWith([{ type: 'toggleState', path: 'y' }])
  })

  it('swaps two actions when moved down', () => {
    const onChange = vi.fn()
    render(<ActionEditor value={[{ type: 'setState', path: 'x' }, { type: 'toggleState', path: 'y' }]} onChange={onChange} />)
    fireEvent.click(screen.getAllByLabelText('下へ移動')[0])
    expect(onChange).toHaveBeenCalledWith([{ type: 'toggleState', path: 'y' }, { type: 'setState', path: 'x' }])
  })

  it('edits a string param and reports the updated action', () => {
    const onChange = vi.fn()
    render(<ActionEditor value={[{ type: 'setState', path: 'qty' }]} onChange={onChange} />)
    const pathInput = screen.getByPlaceholderText('form.email')
    fireEvent.change(pathInput, { target: { value: 'newPath' } })
    expect(onChange).toHaveBeenCalledWith([{ type: 'setState', path: 'newPath' }])
  })

  it('renders nested actions for condition.then / condition.else', () => {
    render(<ActionEditor value={[{ type: 'condition', if: '${state.agreed}', then: [{ type: 'dismiss' }], else: [] }]} onChange={() => {}} />)
    // 1 outer + 1 nested "then" action = 2 combobox (action-type selects)
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2)
  })

  it('shows an unknown-action notice without crashing for unrecognized types', () => {
    render(<ActionEditor value={[{ type: 'notARealAction' }]} onChange={() => {}} />)
    expect(screen.getByText(/未知のアクション種別です/)).toBeInTheDocument()
  })
})
