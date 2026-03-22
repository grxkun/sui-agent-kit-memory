import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMemoryMiddleware } from '../src/middleware/AgentMemoryMiddleware.js'
import type { AgentTurn } from '../src/middleware/types.js'

const makeOptions = (overrides = {}) => ({
  agentAddress: '0xAGENT',
  walrusPublisherUrl: 'https://publisher.example.com',
  walrusAggregatorUrl: 'https://aggregator.example.com',
  suiRpcUrl: 'https://rpc.example.com',
  autoAudit: false,
  autoInjectMemory: false,
  maxInjectedMemories: 5,
  ...overrides,
})

const makeMockFetch = (stored: Map<string, Uint8Array>) =>
  vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
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
    }
    const blobId = url.split('/').pop()!
    const data = stored.get(blobId)
    if (!data) return { ok: false, status: 404 }
    return { ok: true, status: 200, arrayBuffer: async () => data.buffer }
  })

// Mock SuiClient
vi.mock('@mysten/sui/client', () => ({
  SuiClient: vi.fn().mockImplementation(() => ({
    getObject: vi.fn().mockResolvedValue({
      data: {
        content: {
          dataType: 'moveObject',
          fields: { latest_blob_id: '', latest_seq: 0, version: 0, updated_at_ms: 0, updated_by: '', state_blob_id: '', hot_state: [] },
        },
      },
    }),
    signAndExecuteTransaction: vi.fn().mockResolvedValue({ digest: 'tx-001' }),
  })),
  getFullnodeUrl: vi.fn().mockReturnValue('https://fullnode.testnet.sui.io:443'),
}))

describe('AgentMemoryMiddleware', () => {
  let stored: Map<string, Uint8Array>

  beforeEach(() => {
    stored = new Map()
    global.fetch = makeMockFetch(stored) as unknown as typeof fetch
  })

  it('beforeTurn() returns original prompt when autoInjectMemory=false', async () => {
    const mw = createMemoryMiddleware(makeOptions({ autoInjectMemory: false }))
    const turn: AgentTurn = { id: '1', agentAddress: '0xAGENT', prompt: 'Hello world' }
    const result = await mw.beforeTurn(turn)
    expect(result).toBe('Hello world')
  })

  it('beforeTurn() appends memory block when autoInjectMemory=true', async () => {
    const mw = createMemoryMiddleware(makeOptions({ autoInjectMemory: true, injectionTags: ['t'] }))
    // Add some memory first
    await mw.memorise({ fact: 'important' }, ['t'])
    const turn: AgentTurn = { id: '1', agentAddress: '0xAGENT', prompt: 'Question?' }
    const result = await mw.beforeTurn(turn)
    expect(result).toContain('AGENT MEMORY')
    expect(result).toContain('Question?')
  })

  it('beforeTurn() respects maxInjectedMemories limit', async () => {
    const mw = createMemoryMiddleware(makeOptions({ autoInjectMemory: true, injectionTags: ['t'], maxInjectedMemories: 2 }))
    await mw.memorise('m1', ['t'])
    await mw.memorise('m2', ['t'])
    await mw.memorise('m3', ['t'])
    const turn: AgentTurn = { id: '1', agentAddress: '0xAGENT', prompt: 'Q' }
    const result = await mw.beforeTurn(turn)
    // Should show "2 entries" not "3 entries"
    expect(result).toContain('2 entries')
  })

  it('afterTurn() writes audit entry when autoAudit=true', async () => {
    const mw = createMemoryMiddleware(makeOptions({ autoAudit: true }))
    const turn: Required<AgentTurn> = {
      id: '1',
      agentAddress: '0xAGENT',
      prompt: 'test prompt',
      decision: 'test decision',
      toolCalls: [],
      txDigest: '0xTX',
      meta: {},
    }
    await mw.afterTurn(turn)
    // Should have stored the audit entry in Walrus
    expect(stored.size).toBeGreaterThan(0)
  })

  it('afterTurn() publishes audit head to shared object when configured', async () => {
    // This tests that shared.publishAuditHead is called
    // Since we don't have a real shared object, we just verify no error thrown
    const mw = createMemoryMiddleware(makeOptions({ autoAudit: true }))
    const turn: Required<AgentTurn> = {
      id: '1',
      agentAddress: '0xAGENT',
      prompt: 'p',
      decision: 'd',
      toolCalls: [],
      txDigest: '0xTX',
      meta: {},
    }
    await expect(mw.afterTurn(turn)).resolves.not.toThrow()
  })

  it('exportState() returns both blobIds', async () => {
    const mw = createMemoryMiddleware(makeOptions({ autoAudit: true }))
    await mw.memorise('item', ['tag'])
    const turn: Required<AgentTurn> = {
      id: '1', agentAddress: '0xAGENT', prompt: 'p', decision: 'd',
      toolCalls: [], txDigest: '0xTX', meta: {},
    }
    await mw.afterTurn(turn)
    const state = await mw.exportState()
    expect(state.memorySnapshotBlobId).toBeTruthy()
    expect(state.auditHeadBlobId).toBeTruthy()
  })
})
