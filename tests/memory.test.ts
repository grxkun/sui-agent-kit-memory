import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryIndex } from '../src/memory/MemoryIndex.js'
import { VectorSearch } from '../src/memory/VectorSearch.js'
import { AgentMemory } from '../src/memory/AgentMemory.js'
import type { MemoryEntry } from '../src/memory/types.js'

const makeEntry = (overrides: Partial<MemoryEntry> = {}): MemoryEntry => ({
  id: 'entry-1',
  agentAddress: '0xAGENT',
  tags: ['tag1'],
  content: 'hello',
  createdAt: Date.now(),
  expiresAt: null,
  blobId: 'blob-1',
  ...overrides,
})

describe('MemoryIndex', () => {
  it('retrieves entries by single tag', () => {
    const index = new MemoryIndex(100)
    const e1 = makeEntry({ id: 'e1', tags: ['alpha'] })
    const e2 = makeEntry({ id: 'e2', tags: ['beta'] })
    index.add(e1)
    index.add(e2)
    expect(index.byTag('alpha')).toEqual([e1])
    expect(index.byTag('beta')).toEqual([e2])
    expect(index.byTag('gamma')).toEqual([])
  })

  it('matchAll=true: returns entries matching ALL tags', () => {
    const index = new MemoryIndex(100)
    const e1 = makeEntry({ id: 'e1', tags: ['a', 'b'] })
    const e2 = makeEntry({ id: 'e2', tags: ['a'] })
    index.add(e1)
    index.add(e2)
    expect(index.byTags(['a', 'b'], true)).toEqual([e1])
    expect(index.byTags(['a', 'b'], true)).not.toContain(e2)
  })

  it('matchAll=false: returns entries matching ANY tag', () => {
    const index = new MemoryIndex(100)
    const e1 = makeEntry({ id: 'e1', tags: ['a'] })
    const e2 = makeEntry({ id: 'e2', tags: ['b'] })
    const e3 = makeEntry({ id: 'e3', tags: ['c'] })
    index.add(e1)
    index.add(e2)
    index.add(e3)
    const result = index.byTags(['a', 'b'], false)
    expect(result).toHaveLength(2)
    expect(result.map(e => e.id)).toContain('e1')
    expect(result.map(e => e.id)).toContain('e2')
  })

  it('LRU evicts oldest entry when maxIndexSize exceeded', () => {
    const index = new MemoryIndex(2)
    const e1 = makeEntry({ id: 'e1', tags: ['t'] })
    const e2 = makeEntry({ id: 'e2', tags: ['t'] })
    const e3 = makeEntry({ id: 'e3', tags: ['t'] })
    index.add(e1)
    index.add(e2)
    // access e1 to make e2 the LRU
    index.byTag('t')  // accesses both; e1 was accessed, then e2
    // Actually, after adding e1 and e2 in order, e1 is LRU (added first)
    index.add(e3)  // should evict e1 (LRU)
    expect(index.size()).toBe(2)
    const ids = index.all().map(e => e.id)
    expect(ids).not.toContain('e1')
    expect(ids).toContain('e2')
    expect(ids).toContain('e3')
  })
})

describe('VectorSearch', () => {
  it('cosineSimilarity returns 1 for identical vectors', () => {
    const v = [1, 2, 3]
    expect(VectorSearch.cosineSimilarity(v, v)).toBeCloseTo(1)
  })

  it('cosineSimilarity returns 0 for orthogonal vectors', () => {
    expect(VectorSearch.cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('cosineSimilarity returns 0 for zero-magnitude vector', () => {
    expect(VectorSearch.cosineSimilarity([0, 0], [1, 2])).toBe(0)
    expect(VectorSearch.cosineSimilarity([1, 2], [0, 0])).toBe(0)
  })

  it('topK returns sorted results descending by score', () => {
    const query = [1, 0]
    const candidates: MemoryEntry[] = [
      makeEntry({ id: 'e1', embedding: [0, 1] }),  // orthogonal -> 0
      makeEntry({ id: 'e2', embedding: [1, 0] }),  // identical -> 1
      makeEntry({ id: 'e3', embedding: [1, 1] }),  // 45 deg -> ~0.707
    ]
    const result = VectorSearch.topK(query, candidates, 3)
    expect(result[0].entry.id).toBe('e2')
    expect(result[1].entry.id).toBe('e3')
    expect(result[2].entry.id).toBe('e1')
    expect(result[0].score!).toBeGreaterThan(result[1].score!)
  })

  it('topK skips entries with no embedding', () => {
    const query = [1, 0]
    const candidates: MemoryEntry[] = [
      makeEntry({ id: 'e1', embedding: [1, 0] }),
      makeEntry({ id: 'e2' }),  // no embedding
    ]
    const result = VectorSearch.topK(query, candidates, 5)
    expect(result).toHaveLength(1)
    expect(result[0].entry.id).toBe('e1')
  })
})

describe('AgentMemory', () => {
  const makeConfig = () => ({
    agentAddress: '0xAGENT',
    walrus: {
      publisherUrl: 'https://publisher.example.com',
      aggregatorUrl: 'https://aggregator.example.com',
      epochs: 5,
    },
    defaultTtlMs: null,
    maxIndexSize: 10_000,
  })

  const mockFetch = (stored: Map<string, Uint8Array>) => {
    return vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (opts?.method === 'PUT') {
        const body = opts.body as Uint8Array
        const blobId = `blob-${stored.size + 1}`
        stored.set(blobId, body)
        return {
          ok: true,
          json: async () => ({
            newlyCreated: {
              blobObject: { blobId, storageCost: '0', storage: { endEpoch: 1 } },
            },
          }),
        }
      } else {
        // extract blobId from URL
        const blobId = url.split('/').pop()!
        const data = stored.get(blobId)
        if (!data) return { ok: false, status: 404 }
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => data.buffer,
        }
      }
    })
  }

  it('remember() writes to Walrus and adds to index', async () => {
    const stored = new Map<string, Uint8Array>()
    global.fetch = mockFetch(stored) as unknown as typeof fetch
    const mem = new AgentMemory(makeConfig())
    const entry = await mem.remember({ content: 'test data', tags: ['a', 'b'] })
    expect(entry.id).toBeTruthy()
    expect(entry.tags).toEqual(['a', 'b'])
    expect(stored.size).toBe(1)
    const recalled = await mem.recall(['a'])
    expect(recalled).toHaveLength(1)
    expect(recalled[0].id).toBe(entry.id)
  })

  it('recall() excludes expired entries', async () => {
    const stored = new Map<string, Uint8Array>()
    global.fetch = mockFetch(stored) as unknown as typeof fetch
    const mem = new AgentMemory(makeConfig())
    await mem.remember({ content: 'expired', tags: ['t'], ttlMs: -1000 })  // already expired
    await mem.remember({ content: 'valid', tags: ['t'] })
    const results = await mem.recall(['t'])
    expect(results).toHaveLength(1)
    expect(results[0].content).toBe('valid')
  })

  it('recall() sorts by createdAt desc', async () => {
    const stored = new Map<string, Uint8Array>()
    global.fetch = mockFetch(stored) as unknown as typeof fetch
    const mem = new AgentMemory(makeConfig())
    const e1 = await mem.remember({ content: 'first', tags: ['t'] })
    await new Promise(r => setTimeout(r, 2))
    const e2 = await mem.remember({ content: 'second', tags: ['t'] })
    const results = await mem.recall(['t'])
    expect(results[0].id).toBe(e2.id)
    expect(results[1].id).toBe(e1.id)
  })

  it('search() returns top-k by cosine similarity', async () => {
    const stored = new Map<string, Uint8Array>()
    global.fetch = mockFetch(stored) as unknown as typeof fetch
    const mem = new AgentMemory(makeConfig())
    await mem.remember({ content: 'a', tags: ['t'], embedding: [1, 0] })
    await mem.remember({ content: 'b', tags: ['t'], embedding: [0, 1] })
    const results = await mem.search([1, 0], 2)
    expect(results[0].score!).toBeCloseTo(1)
    expect(results[1].score!).toBeCloseTo(0)
  })

  it('hydrate() fetches full content from Walrus', async () => {
    const stored = new Map<string, Uint8Array>()
    global.fetch = mockFetch(stored) as unknown as typeof fetch
    const mem = new AgentMemory(makeConfig())
    const entry = await mem.remember({ content: { key: 'value' }, tags: [] })
    const hydrated = await mem.hydrate<{ key: string }>(entry)
    expect(hydrated).toEqual({ key: 'value' })
  })

  it('pruneExpired() removes entries past expiresAt', async () => {
    const stored = new Map<string, Uint8Array>()
    global.fetch = mockFetch(stored) as unknown as typeof fetch
    const mem = new AgentMemory(makeConfig())
    await mem.remember({ content: 'expired', tags: ['t'], ttlMs: -1000 })
    await mem.remember({ content: 'valid', tags: ['t'] })
    const count = mem.pruneExpired()
    expect(count).toBe(1)
    const results = await mem.recall(['t'])
    expect(results).toHaveLength(1)
  })

  it('snapshot() exports index to single Walrus blob', async () => {
    const stored = new Map<string, Uint8Array>()
    global.fetch = mockFetch(stored) as unknown as typeof fetch
    const mem = new AgentMemory(makeConfig())
    await mem.remember({ content: 'item1', tags: ['t'] })
    await mem.remember({ content: 'item2', tags: ['t'] })
    const snap = await mem.snapshot()
    expect(snap.entryCount).toBe(2)
    expect(snap.blobId).toBeTruthy()
  })

  it('restore() rebuilds index from snapshot blob', async () => {
    const stored = new Map<string, Uint8Array>()
    global.fetch = mockFetch(stored) as unknown as typeof fetch
    const mem = new AgentMemory(makeConfig())
    await mem.remember({ content: 'item1', tags: ['t'] })
    const snap = await mem.snapshot()

    const mem2 = new AgentMemory(makeConfig())
    await mem2.restore(snap.blobId)
    const results = await mem2.recall(['t'])
    expect(results).toHaveLength(1)
    expect(results[0].content).toBe('item1')
  })
})
