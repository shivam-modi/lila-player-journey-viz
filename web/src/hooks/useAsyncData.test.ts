import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAsyncData } from './useAsyncData'

describe('useAsyncData', () => {
  it('exposes the resolved data and clears loading', async () => {
    const { result } = renderHook(() => useAsyncData(() => Promise.resolve('hello'), []))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe('hello')
    expect(result.current.error).toBeNull()
  })

  it('exposes an error when the fetch rejects', async () => {
    const { result } = renderHook(() => useAsyncData(() => Promise.reject(new Error('boom')), []))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error?.message).toBe('boom')
  })

  it('clears a previous error once a new fetch starts, not just once it resolves', async () => {
    let fail = true
    const fetchFn = () => (fail ? Promise.reject(new Error('boom')) : Promise.resolve('ok'))
    const { result, rerender } = renderHook(({ key }) => useAsyncData(fetchFn, [key]), {
      initialProps: { key: 'a' },
    })
    await waitFor(() => expect(result.current.error).not.toBeNull())

    fail = false
    rerender({ key: 'b' })
    // The error from the previous (different) key must not leak into the new fetch's state.
    expect(result.current.error).toBeNull()
    await waitFor(() => expect(result.current.data).toBe('ok'))
  })

  it('returns null data and does not fetch when fetchFn is null', () => {
    const { result } = renderHook(() => useAsyncData<string>(null, []))
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
