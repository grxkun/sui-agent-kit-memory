import type { SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { SharedDocumentSchema } from './types.js'
import { ConflictResolver } from './ConflictResolver.js'
import type { SharedDocument, MergeStrategy } from './types.js'

export class SharedMemoryObject {
  constructor(
    private client: SuiClient,
    private config: { objectId: string; rpcUrl: string; mergeStrategy: MergeStrategy },
    private signer: (ptb: Transaction) => Promise<string>,
  ) {}

  async read(): Promise<SharedDocument> {
    const obj = await this.client.getObject({
      id: this.config.objectId,
      options: { showContent: true },
    })
    const content = obj.data?.content
    if (!content || content.dataType !== 'moveObject') {
      throw new Error('Failed to read shared memory object')
    }
    const fields = content.fields as Record<string, unknown>
    let hotState: Record<string, unknown> = {}
    const rawHotState = fields['hot_state']
    if (typeof rawHotState === 'string') {
      try {
        hotState = JSON.parse(rawHotState) as Record<string, unknown>
      } catch {
        hotState = {}
      }
    } else if (Array.isArray(rawHotState)) {
      // raw bytes
      try {
        hotState = JSON.parse(new TextDecoder().decode(new Uint8Array(rawHotState as number[]))) as Record<string, unknown>
      } catch {
        hotState = {}
      }
    }
    const doc: SharedDocument = {
      version: Number(fields['version'] ?? 0),
      updatedAt: Number(fields['updated_at_ms'] ?? 0),
      updatedBy: String(fields['updated_by'] ?? ''),
      stateBlobId: String(fields['state_blob_id'] ?? '') || undefined,
      hotState,
      auditBlobIds: {},
    }
    return SharedDocumentSchema.parse(doc)
  }

  async patch(updates: Partial<SharedDocument['hotState']>): Promise<number> {
    const doc = await this.read()
    let newState: Record<string, unknown>
    if (this.config.mergeStrategy === 'deep-merge') {
      newState = ConflictResolver.deepMerge(doc.hotState, updates)
    } else {
      newState = ConflictResolver.lastWriteWins(doc.hotState, updates)
    }
    const stateBytes = new TextEncoder().encode(JSON.stringify(newState))
    if (stateBytes.length > 16_384) {
      throw new Error('hot_state exceeds 16 KB limit')
    }
    const tx = new Transaction()
    tx.moveCall({
      target: `agent_memory::memory_object::update_hot_state`,
      arguments: [
        tx.object(this.config.objectId),
        tx.pure.vector('u8', Array.from(stateBytes)),
        tx.pure.u64(BigInt(Date.now())),
      ],
    })
    await this.signer(tx)
    return doc.version + 1
  }

  async setStateBlobId(blobId: string): Promise<void> {
    const tx = new Transaction()
    tx.moveCall({
      target: `agent_memory::memory_object::update_state_blob_id`,
      arguments: [
        tx.object(this.config.objectId),
        tx.pure.string(blobId),
      ],
    })
    await this.signer(tx)
  }

  async publishAuditHead(_agentAddress: string, blobId: string): Promise<void> {
    const doc = await this.read()
    const tx = new Transaction()
    const stateBytes = new TextEncoder().encode(JSON.stringify(doc.hotState))
    tx.moveCall({
      target: `agent_memory::memory_object::update_hot_state`,
      arguments: [
        tx.object(this.config.objectId),
        tx.pure.vector('u8', Array.from(stateBytes)),
        tx.pure.u64(BigInt(Date.now())),
      ],
    })
    await this.signer(tx)
    void blobId
  }

  subscribe(onChange: (doc: SharedDocument) => void, intervalMs = 5000): () => void {
    let lastVersion = -1
    let stopped = false
    const poll = async () => {
      if (stopped) return
      try {
        const doc = await this.read()
        if (doc.version !== lastVersion && lastVersion !== -1) {
          onChange(doc)
        }
        lastVersion = doc.version
      } catch {
        // ignore poll errors
      }
      if (!stopped) {
        setTimeout(poll, intervalMs)
      }
    }
    void poll()
    return () => { stopped = true }
  }
}
