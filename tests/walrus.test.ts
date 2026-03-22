import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WalrusClient, WalrusBlobNotFoundError } from '../src/walrus/WalrusClient.js'
import { BlobStore } from '../src/walrus/BlobStore.js'
import { AuditLogger } from '../src/walrus/AuditLogger.js'
import type { SuiClient } from '@mysten/sui/client'

const makeClient = (overrides: Partial<{ publisherUrl: string; aggregatorUrl: string; epochs: number }> = {}) =>
  new WalrusClient({
    publisherUrl: 'https://publisher.example.com',
    aggregatorUrl: 'https://aggregator.example.com',
    epochs: 5,
    ...overrides,
  })

describe('WalrusClient', () => {
  it('writes blob and parses newlyCreated response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        newlyCreated: {
          blobObject: {
            blobId: 'blob-001',
            storageCost: '1000',
            storage: { endEpoch: 42 },
          },
        },
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch
    const client = makeClient()
    const result = await client.writeBlob(new TextEncoder().encode('hello'))
    expect(result.blobId).toBe('blob-001')
    expect(result.isNew).toBe(true)
    expect(result.storageCostMist).toBe(BigInt(1000))
    expect(result.expiresAtEpoch).toBe(42)
  })

  it('writes blob and parses alreadyCertified response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        alreadyCertified: { blobId: 'blob-002', endEpoch: 10 },
      }),
    }) as unknown as typeof fetch
    const client = makeClient()
    const result = await client.writeBlob(new TextEncoder().encode('hello'))
    expect(result.blobId).toBe('blob-002')
    expect(result.isNew).toBe(false)
    expect(result.storageCostMist).toBe(BigInt(0))
  })

  it('reads blob bytes by ID', async () => {
    const bytes = new TextEncoder().encode('world')
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => bytes.buffer,
    }) as unknown as typeof fetch
    const client = makeClient()
    const result = await client.readBlob('blob-003')
    expect(result).toEqual(bytes)
  })

  it('throws WalrusBlobNotFoundError on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch
    const client = makeClient()
    await expect(client.readBlob('missing-blob')).rejects.toThrow(WalrusBlobNotFoundError)
  })

  it('includes correct epochs query param in write request', async () => {
    let capturedUrl = ''
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url
      return {
        ok: true,
        json: async () => ({ newlyCreated: { blobObject: { blobId: 'x', storageCost: '0', storage: { endEpoch: 1 } } } }),
      }
    }) as unknown as typeof fetch
    const client = makeClient({ epochs: 7 })
    await client.writeBlob(new Uint8Array([1]))
    expect(capturedUrl).toContain('epochs=7')
  })
})

describe('BlobStore', () => {
  it('round-trips complex nested objects through JSON', async () => {
    const stored: unknown[] = []
    global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (opts?.method === 'PUT') {
        const body = opts.body as Uint8Array
        stored.push(body)
        return {
          ok: true,
          json: async () => ({ newlyCreated: { blobObject: { blobId: 'test-blob', storageCost: '0', storage: { endEpoch: 1 } } } }),
        }
      } else {
        // read
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => (stored[0] as Uint8Array).buffer,
        }
      }
    }) as unknown as typeof fetch

    const client = makeClient()
    const blobStore = new BlobStore(client)
    const value = { a: 1, b: { c: [1, 2, 3] }, d: null }
    const writeResult = await blobStore.write(value)
    const readResult = await blobStore.read(writeResult.blobId)
    expect(readResult.data).toEqual(value)
  })

  it('throws on malformed JSON blob', async () => {
    const badBytes = new TextEncoder().encode('NOT_JSON{{{')
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => badBytes.buffer,
    }) as unknown as typeof fetch
    const client = makeClient()
    const blobStore = new BlobStore(client)
    await expect(blobStore.read('bad-blob')).rejects.toThrow()
  })
})

describe('AuditLogger', () => {
  const makeMockSuiClient = (fields: Record<string, unknown> = {}) => ({
    getObject: vi.fn().mockResolvedValue({
      data: {
        content: {
          dataType: 'moveObject',
          fields: { latest_blob_id: '', latest_seq: 0, ...fields },
        },
      },
    }),
    signAndExecuteTransaction: vi.fn().mockResolvedValue({ digest: 'tx-001' }),
  })

  const makeMockBlobStore = () => {
    const blobs = new Map<string, unknown>()
    let blobCounter = 0
    return {
      store: vi.fn().mockImplementation(async (value: unknown) => {
        const id = `blob-${++blobCounter}`
        blobs.set(id, value)
        return id
      }),
      fetch: vi.fn().mockImplementation(async (blobId: string) => {
        const v = blobs.get(blobId)
        if (v === undefined) throw new Error(`Blob not found: ${blobId}`)
        return v
      }),
      blobs,
    }
  }

  it('first entry has prevBlobId null', async () => {
    const suiClient = makeMockSuiClient({ latest_blob_id: '', latest_seq: 0 })
    const blobStore = makeMockBlobStore()
    const logger = new AuditLogger(
      blobStore as unknown as BlobStore,
      suiClient as unknown as SuiClient,
      '0xAGENT',
    )
    const { entry } = await logger.append({
      agentAddress: '0xAGENT',
      prompt: 'test',
      decision: 'ok',
      toolCalls: [],
    })
    expect(entry.prevBlobId).toBeNull()
    expect(entry.seq).toBe(1)
  })

  it('subsequent entry prevBlobId equals previous blobId', async () => {
    const suiClient = makeMockSuiClient({ latest_blob_id: '', latest_seq: 0 })
    const blobStore = makeMockBlobStore()
    const logger = new AuditLogger(
      blobStore as unknown as BlobStore,
      suiClient as unknown as SuiClient,
      '0xAGENT',
      'anchor-obj',
    )
    const first = await logger.append({ agentAddress: '0xAGENT', prompt: 'p1', decision: 'd1', toolCalls: [] })
    // Update mock to return the first blobId as the head
    suiClient.getObject.mockResolvedValue({
      data: {
        content: {
          dataType: 'moveObject',
          fields: { latest_blob_id: first.blobId, latest_seq: 1 },
        },
      },
    })
    const second = await logger.append({ agentAddress: '0xAGENT', prompt: 'p2', decision: 'd2', toolCalls: [] })
    expect(second.entry.prevBlobId).toBe(first.blobId)
    expect(second.entry.seq).toBe(2)
  })

  it('seq increments on each append', async () => {
    const suiClient = makeMockSuiClient({ latest_blob_id: '', latest_seq: 0 })
    const blobStore = makeMockBlobStore()
    const logger = new AuditLogger(
      blobStore as unknown as BlobStore,
      suiClient as unknown as SuiClient,
      '0xAGENT',
      'anchor-obj',
    )
    const e1 = await logger.append({ agentAddress: '0xAGENT', prompt: 'p1', decision: 'd1', toolCalls: [] })
    suiClient.getObject.mockResolvedValue({
      data: { content: { dataType: 'moveObject', fields: { latest_blob_id: e1.blobId, latest_seq: 1 } } },
    })
    const e2 = await logger.append({ agentAddress: '0xAGENT', prompt: 'p2', decision: 'd2', toolCalls: [] })
    expect(e1.entry.seq).toBe(1)
    expect(e2.entry.seq).toBe(2)
  })

  it('walk() yields entries in reverse order', async () => {
    // Setup a chain of 3 entries manually
    const blobStore = makeMockBlobStore()
    const suiClient = makeMockSuiClient()
    const e1: unknown = { seq: 1, agentAddress: '0xA', timestamp: 't1', prompt: 'p1', decision: 'd1', toolCalls: [], prevBlobId: null }
    const e2: unknown = { seq: 2, agentAddress: '0xA', timestamp: 't2', prompt: 'p2', decision: 'd2', toolCalls: [], prevBlobId: 'blob-1' }
    const e3: unknown = { seq: 3, agentAddress: '0xA', timestamp: 't3', prompt: 'p3', decision: 'd3', toolCalls: [], prevBlobId: 'blob-2' }
    blobStore.blobs.set('blob-1', e1)
    blobStore.blobs.set('blob-2', e2)
    blobStore.blobs.set('blob-3', e3)
    suiClient.getObject.mockResolvedValue({
      data: { content: { dataType: 'moveObject', fields: { latest_blob_id: 'blob-3', latest_seq: 3 } } },
    })
    const logger = new AuditLogger(
      blobStore as unknown as BlobStore,
      suiClient as unknown as SuiClient,
      '0xA',
      'anchor-obj',
    )
    const results = []
    for await (const entry of logger.walk()) {
      results.push(entry)
    }
    expect(results.map(e => e.seq)).toEqual([3, 2, 1])
  })

  it('recent(n) returns last N entries', async () => {
    const blobStore = makeMockBlobStore()
    const suiClient = makeMockSuiClient()
    const e1: unknown = { seq: 1, agentAddress: '0xA', timestamp: 't1', prompt: 'p1', decision: 'd1', toolCalls: [], prevBlobId: null }
    const e2: unknown = { seq: 2, agentAddress: '0xA', timestamp: 't2', prompt: 'p2', decision: 'd2', toolCalls: [], prevBlobId: 'blob-1' }
    const e3: unknown = { seq: 3, agentAddress: '0xA', timestamp: 't3', prompt: 'p3', decision: 'd3', toolCalls: [], prevBlobId: 'blob-2' }
    blobStore.blobs.set('blob-1', e1)
    blobStore.blobs.set('blob-2', e2)
    blobStore.blobs.set('blob-3', e3)
    suiClient.getObject.mockResolvedValue({
      data: { content: { dataType: 'moveObject', fields: { latest_blob_id: 'blob-3', latest_seq: 3 } } },
    })
    const logger = new AuditLogger(
      blobStore as unknown as BlobStore,
      suiClient as unknown as SuiClient,
      '0xA',
      'anchor-obj',
    )
    const recent = await logger.recent(2)
    expect(recent).toHaveLength(2)
    expect(recent[0].seq).toBe(3)
    expect(recent[1].seq).toBe(2)
  })

  it('verify() returns valid:true for intact chain', async () => {
    const blobStore = makeMockBlobStore()
    const suiClient = makeMockSuiClient()
    const e1: unknown = { seq: 1, agentAddress: '0xA', timestamp: 't1', prompt: 'p1', decision: 'd1', toolCalls: [], prevBlobId: null }
    const e2: unknown = { seq: 2, agentAddress: '0xA', timestamp: 't2', prompt: 'p2', decision: 'd2', toolCalls: [], prevBlobId: 'blob-1' }
    blobStore.blobs.set('blob-1', e1)
    blobStore.blobs.set('blob-2', e2)
    suiClient.getObject.mockResolvedValue({
      data: { content: { dataType: 'moveObject', fields: { latest_blob_id: 'blob-2', latest_seq: 2 } } },
    })
    const logger = new AuditLogger(
      blobStore as unknown as BlobStore,
      suiClient as unknown as SuiClient,
      '0xA',
      'anchor-obj',
    )
    const result = await logger.verify()
    expect(result.valid).toBe(true)
  })

  it('verify() returns valid:false with brokenAt when tampered', async () => {
    const blobStore = makeMockBlobStore()
    const suiClient = makeMockSuiClient()
    // Tampered: seq jumps from 3 to 1 (skipping 2)
    const e1: unknown = { seq: 1, agentAddress: '0xA', timestamp: 't1', prompt: 'p1', decision: 'd1', toolCalls: [], prevBlobId: null }
    const e3: unknown = { seq: 3, agentAddress: '0xA', timestamp: 't3', prompt: 'p3', decision: 'd3', toolCalls: [], prevBlobId: 'blob-1' }
    blobStore.blobs.set('blob-1', e1)
    blobStore.blobs.set('blob-3', e3)
    suiClient.getObject.mockResolvedValue({
      data: { content: { dataType: 'moveObject', fields: { latest_blob_id: 'blob-3', latest_seq: 3 } } },
    })
    const logger = new AuditLogger(
      blobStore as unknown as BlobStore,
      suiClient as unknown as SuiClient,
      '0xA',
      'anchor-obj',
    )
    const result = await logger.verify()
    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBeDefined()
  })
})
