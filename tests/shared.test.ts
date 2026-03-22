import { describe, it, expect, vi } from 'vitest'
import { ConflictResolver } from '../src/shared/ConflictResolver.js'
import { SharedMemoryObject } from '../src/shared/SharedMemoryObject.js'
import type { SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'

describe('ConflictResolver', () => {
  it('lastWriteWins: incoming overwrites, current non-overlapping preserved', () => {
    const current = { a: 1, b: 2, c: 3 }
    const incoming = { b: 99, d: 4 }
    const result = ConflictResolver.lastWriteWins(current, incoming)
    expect(result).toEqual({ a: 1, b: 99, c: 3, d: 4 })
  })

  it('deepMerge: nested objects merged recursively', () => {
    const current = { a: { x: 1, y: 2 }, b: 'hello' }
    const incoming = { a: { y: 99, z: 3 } }
    const result = ConflictResolver.deepMerge(current, incoming)
    expect(result).toEqual({ a: { x: 1, y: 99, z: 3 }, b: 'hello' })
  })

  it('deepMerge: arrays concatenated and deduped', () => {
    const current = { arr: [1, 2, 3] }
    const incoming = { arr: [3, 4, 5] }
    const result = ConflictResolver.deepMerge(current, incoming)
    expect(result.arr).toEqual([1, 2, 3, 4, 5])
  })
})

describe('SharedMemoryObject', () => {
  const makeHotStateBytes = (state: Record<string, unknown>) =>
    Array.from(new TextEncoder().encode(JSON.stringify(state)))

  const makeMockClient = (version = 1, hotState: Record<string, unknown> = {}) => ({
    getObject: vi.fn().mockResolvedValue({
      data: {
        content: {
          dataType: 'moveObject',
          fields: {
            version,
            updated_at_ms: 1000,
            updated_by: '0xAGENT',
            state_blob_id: '',
            hot_state: makeHotStateBytes(hotState),
          },
        },
      },
    }),
    signAndExecuteTransaction: vi.fn().mockResolvedValue({ digest: 'tx-001' }),
  })

  it('read() parses hot_state from Sui object content', async () => {
    const client = makeMockClient(1, { key: 'value' })
    const smo = new SharedMemoryObject(
      client as unknown as SuiClient,
      { objectId: '0xOBJ', rpcUrl: 'https://rpc.example.com', mergeStrategy: 'last-write-wins' },
      async () => 'tx-digest',
    )
    const doc = await smo.read()
    expect(doc.version).toBe(1)
    expect(doc.hotState).toEqual({ key: 'value' })
  })

  it('patch() increments version in merged document', async () => {
    const client = makeMockClient(1, { existing: 'data' })
    const signer = vi.fn().mockResolvedValue('tx-digest')
    const smo = new SharedMemoryObject(
      client as unknown as SuiClient,
      { objectId: '0xOBJ', rpcUrl: 'https://rpc.example.com', mergeStrategy: 'last-write-wins' },
      signer,
    )
    const newVersion = await smo.patch({ newKey: 'newValue' })
    expect(newVersion).toBe(2)
    expect(signer).toHaveBeenCalled()
  })

  it('subscribe() calls onChange when version changes', async () => {
    vi.useFakeTimers()
    const client = makeMockClient(1, {})
    const smo = new SharedMemoryObject(
      client as unknown as SuiClient,
      { objectId: '0xOBJ', rpcUrl: 'https://rpc.example.com', mergeStrategy: 'last-write-wins' },
      async () => 'tx-digest',
    )
    const onChange = vi.fn()
    smo.subscribe(onChange, 100)
    // First poll sets lastVersion to 1, no onChange yet
    await vi.advanceTimersByTimeAsync(200)
    // Now change version
    client.getObject.mockResolvedValue({
      data: {
        content: {
          dataType: 'moveObject',
          fields: { version: 2, updated_at_ms: 2000, updated_by: '0xA', state_blob_id: '', hot_state: makeHotStateBytes({}) },
        },
      },
    })
    await vi.advanceTimersByTimeAsync(200)
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('subscribe() returns working unsubscribe function', async () => {
    vi.useFakeTimers()
    const client = makeMockClient(1, {})
    const smo = new SharedMemoryObject(
      client as unknown as SuiClient,
      { objectId: '0xOBJ', rpcUrl: 'https://rpc.example.com', mergeStrategy: 'last-write-wins' },
      async () => 'tx-digest',
    )
    const onChange = vi.fn()
    const unsubscribe = smo.subscribe(onChange, 100)
    // Let first poll run to set lastVersion
    await vi.advanceTimersByTimeAsync(200)
    unsubscribe()
    // version changes
    client.getObject.mockResolvedValue({
      data: {
        content: {
          dataType: 'moveObject',
          fields: { version: 5, updated_at_ms: 5000, updated_by: '0xA', state_blob_id: '', hot_state: makeHotStateBytes({}) },
        },
      },
    })
    await vi.advanceTimersByTimeAsync(500)
    expect(onChange).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
