# sui-agent-kit-memory

> Persistent Memory middleware for Sui AI agents — Walrus blob storage, verifiable audit trails, shared multi-agent knowledge objects.

[![npm](https://img.shields.io/npm/v/@sui-agent-kit/memory)](https://www.npmjs.com/package/@sui-agent-kit/memory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

`@sui-agent-kit/memory` gives your on-chain AI agents a durable, verifiable memory layer built on the [Sui](https://sui.io) blockchain and [Walrus](https://walrus.space) distributed storage.

| Capability | Description |
|---|---|
| 🧠 **Agent memory** | Store, retrieve, and vector-search memory entries backed by Walrus blobs |
| 📋 **Audit trail** | Tamper-evident, linked-list audit log of every agent decision |
| 🤝 **Shared knowledge** | Sui Move objects that multiple agents read/write with configurable merge strategies |
| 🔌 **Drop-in middleware** | `createMemoryMiddleware()` wraps any agent loop in two lines |

---

## Installation

```bash
npm install @sui-agent-kit/memory
# or
pnpm add @sui-agent-kit/memory
```

**Peer requirements:** `@mysten/sui ^1.0.0`

---

## Quick Start

```ts
import { createMemoryMiddleware } from '@sui-agent-kit/memory'

const mw = createMemoryMiddleware({
  agentAddress:       '0xYOUR_AGENT_ADDRESS',
  walrusPublisherUrl: 'https://publisher.walrus-testnet.walrus.space',
  walrusAggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
  suiRpcUrl:          'https://fullnode.testnet.sui.io:443',
  autoAudit:          true,
  autoInjectMemory:   true,
  maxInjectedMemories: 5,
  injectionTags:      ['pool', 'strategy'],
})

// ---- before the LLM call ----
const turn = { id: 'turn-001', agentAddress: '0xYOUR_AGENT_ADDRESS', prompt: 'Should I deposit into Cetus SUI/USDC?' }
const enrichedPrompt = await mw.beforeTurn(turn)   // relevant memories appended automatically

// ---- after the LLM call ----
await mw.afterTurn({
  ...turn,
  decision: 'Deposit 500 SUI — APY 14.3%',
  toolCalls: [{ name: 'cetus_deposit', args: { amount: '500000000000' }, result: { txDigest: '0xABC' } }],
  txDigest:  '0xABC',
})

// ---- save a fact for future turns ----
await mw.memorise({ pool: '0xPOOL', apy: 14.3, depositedSui: 500 }, ['pool', 'cetus'])
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  createMemoryMiddleware()                     │
│                                                              │
│   beforeTurn()  ──►  AgentMemory.recall()                    │
│   afterTurn()   ──►  AuditLogger.append()  ──►  Walrus blob  │
│                  └►  SharedMemoryObject.publishAuditHead()   │
│   memorise()    ──►  AgentMemory.remember() ──► Walrus blob  │
└──────────────────────────────────────────────────────────────┘

┌─────────────────┐   stores/fetches   ┌──────────────────────┐
│   AgentMemory   │ ─────────────────► │   Walrus (BlobStore) │
│   (MemoryIndex) │                    └──────────────────────┘
└─────────────────┘

┌──────────────────────────────────────────────────────────────┐
│               Sui Move — agent_memory package                │
│   MemoryObject  (shared, hot_state ≤ 16 KB JSON)            │
│   AuditAnchor   (latest_blob_id, latest_seq)                 │
└──────────────────────────────────────────────────────────────┘
```

---

## API Reference

### `createMemoryMiddleware(options)`

Creates a ready-to-use middleware bundle.

#### Options

| Option | Type | Required | Description |
|---|---|---|---|
| `agentAddress` | `string` | ✅ | Sui address of the agent |
| `walrusPublisherUrl` | `string` | ✅ | Walrus publisher endpoint |
| `walrusAggregatorUrl` | `string` | ✅ | Walrus aggregator endpoint |
| `suiRpcUrl` | `string` | ✅ | Sui fullnode RPC URL |
| `autoAudit` | `boolean` | ✅ | Write an audit entry after every `afterTurn()` call |
| `autoInjectMemory` | `boolean` | ✅ | Prepend recalled memories to the prompt in `beforeTurn()` |
| `maxInjectedMemories` | `number` | ✅ | Maximum number of memory entries injected per turn |
| `injectionTags` | `string[]` | | Filter injected memories by these tags |
| `sharedMemoryObjectId` | `string` | | Sui object ID of a shared `MemoryObject` (multi-agent) |

#### Returns

```ts
{
  memory: AgentMemory
  audit:  AuditLogger
  shared: SharedMemoryObject | null

  beforeTurn(turn: AgentTurn): Promise<string>
  afterTurn(turn: Required<AgentTurn>): Promise<void>
  memorise(content: unknown, tags: string[], embedding?: number[]): Promise<MemoryEntry>
  exportState(): Promise<{ memorySnapshotBlobId: string; auditHeadBlobId: string }>
}
```

---

### `AgentMemory`

Low-level memory store backed by a Walrus `BlobStore` and an in-process `MemoryIndex`.

```ts
import { AgentMemory } from '@sui-agent-kit/memory'

const memory = new AgentMemory({
  agentAddress: '0xAGENT',
  walrus: {
    publisherUrl:  'https://publisher.walrus-testnet.walrus.space',
    aggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
    epochs: 5,
  },
  defaultTtlMs: null,   // no expiry by default
  maxIndexSize:  10_000,
})
```

| Method | Description |
|---|---|
| `remember(opts)` | Persist a memory entry to Walrus and add it to the index |
| `recall(tags, limit?)` | Return unexpired entries matching any of the given tags, newest first |
| `search(queryEmbedding, topK?)` | Cosine-similarity vector search over all indexed entries |
| `hydrate<T>(entry)` | Fetch the full content of an entry from Walrus |
| `forget(entryId)` | Remove an entry from the in-memory index |
| `pruneExpired()` | Remove all expired entries; returns the count removed |
| `snapshot()` | Serialise the entire index to Walrus; returns a `MemorySnapshot` |
| `restore(snapshotBlobId)` | Restore the index from a previously saved snapshot blob |

---

### `AuditLogger`

Append-only, linked-list audit chain stored as Walrus blobs.

```ts
// append a new entry
const { entry, blobId } = await audit.append({
  agentAddress: '0xAGENT',
  prompt:       'Should I swap?',
  decision:     'Yes, swap 100 SUI → USDC',
  toolCalls:    [],
  txDigest:     '0xDEF',
})

// walk the chain (newest → oldest)
for await (const entry of audit.walk()) {
  console.log(entry.seq, entry.decision)
}

// verify chain integrity
const { valid, totalEntries } = await audit.verify({ full: true })
```

---

### `SharedMemoryObject`

Read/write a Sui `MemoryObject` shared among multiple agents.

```ts
import { SharedMemoryObject } from '@sui-agent-kit/memory'

const shared = new SharedMemoryObject(suiClient, {
  objectId:      '0xSHARED_OBJECT_ID',
  rpcUrl:        'https://fullnode.testnet.sui.io:443',
  mergeStrategy: 'last-write-wins',  // or 'deep-merge'
}, mySignerFn)

// write
await shared.patch({ best_pool: { id: '0xPOOL', apy: 14.3 } })

// read
const doc = await shared.read()
console.log(doc.hotState)

// subscribe to changes
const unsubscribe = shared.subscribe(doc => console.log('updated', doc.version))
// later…
unsubscribe()
```

Merge strategies:

| Strategy | Behaviour |
|---|---|
| `last-write-wins` | Incoming keys overwrite existing keys at the top level |
| `deep-merge` | Keys are recursively merged; nested objects are combined |

> **Note:** `hot_state` is stored as inline JSON inside the Sui object and is capped at **16 KB**. For larger payloads use `setStateBlobId()` to point at a Walrus blob.

---

## Multi-Agent Coordination Example

```ts
// Agent A discovers a high-yield pool and shares it
const mwA = createMemoryMiddleware({ agentAddress: '0xAGENT_A', sharedMemoryObjectId: '0xSHARED', /* … */ })
await mwA.shared!.patch({ best_pool: { id: '0xPOOL', apy: 14.3, discoveredBy: '0xAGENT_A' } })

// Agent B reads the shared knowledge without any coordination
const mwB = createMemoryMiddleware({ agentAddress: '0xAGENT_B', sharedMemoryObjectId: '0xSHARED', /* … */ })
const doc = await mwB.shared!.read()
console.log(doc.hotState.best_pool)  // { id: '0xPOOL', apy: 14.3, discoveredBy: '0xAGENT_A' }
```

See [`examples/multi-agent-coordination.ts`](examples/multi-agent-coordination.ts) for a runnable version.

---

## Move Contracts

The package ships two Move modules under `src/move/sources/`:

| Module | Object | Purpose |
|---|---|---|
| `agent_memory::memory_object` | `MemoryObject` (shared) | Stores `hot_state` (≤ 16 KB) and a pointer to a Walrus state blob |
| `agent_memory::audit_anchor` | `AuditAnchor` (shared) | Tracks the head of an agent's audit chain (`latest_blob_id`, `latest_seq`) |

### Deploying the contracts

```bash
# from the repository root
sui move build   --path src/move
sui client publish src/move --gas-budget 100000000
```

---

## Running the Examples

```bash
# single-agent memory + audit
pnpm example:single

# multi-agent shared knowledge
pnpm example:multi
```

---

## Development

```bash
pnpm install       # install dependencies
pnpm build         # compile TypeScript → dist/
pnpm test          # run Vitest unit tests
```

---

## License

MIT © [grxkun](https://github.com/grxkun)