import type { SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import type { BlobStore } from './BlobStore.js'
import { AuditEntrySchema } from './types.js'
import type { AuditEntry } from './types.js'

export class AuditLogger {
  constructor(
    private store: BlobStore,
    private suiClient: SuiClient,
    private agentAddress: string,
    private anchorObjectId?: string,
  ) {}

  private async getChainHead(): Promise<{ latestBlobId: string | null; latestSeq: number }> {
    if (!this.anchorObjectId) return { latestBlobId: null, latestSeq: 0 }
    try {
      const obj = await this.suiClient.getObject({
        id: this.anchorObjectId,
        options: { showContent: true },
      })
      const content = obj.data?.content
      if (content?.dataType === 'moveObject') {
        const fields = content.fields as Record<string, unknown>
        return {
          latestBlobId: (fields['latest_blob_id'] as string) || null,
          latestSeq: Number(fields['latest_seq'] ?? 0),
        }
      }
    } catch {
      // ignore
    }
    return { latestBlobId: null, latestSeq: 0 }
  }

  async append(
    entry: Omit<AuditEntry, 'seq' | 'prevBlobId' | 'timestamp'>,
  ): Promise<{ entry: AuditEntry; blobId: string }> {
    const head = await this.getChainHead()
    const fullEntry: AuditEntry = {
      ...entry,
      seq: head.latestSeq + 1,
      prevBlobId: head.latestBlobId,
      timestamp: new Date().toISOString(),
    }
    const blobId = await this.store.store(fullEntry)
    // Update anchor on Sui if available
    if (this.anchorObjectId) {
      try {
        const tx = new Transaction()
        tx.moveCall({
          target: `agent_memory::audit_anchor::update`,
          arguments: [
            tx.object(this.anchorObjectId),
            tx.pure.string(blobId),
          ],
        })
        await this.suiClient.signAndExecuteTransaction({
          transaction: tx,
          signer: {} as never,
        })
      } catch {
        // Anchor update is best-effort
      }
    }
    return { entry: fullEntry, blobId }
  }

  async *walk(fromBlobId?: string): AsyncGenerator<AuditEntry> {
    let currentBlobId: string | null = fromBlobId ?? null
    if (!currentBlobId) {
      const head = await this.getChainHead()
      currentBlobId = head.latestBlobId
    }
    while (currentBlobId) {
      const data = await this.store.fetch<AuditEntry>(currentBlobId)
      const entry = AuditEntrySchema.parse(data)
      yield entry
      currentBlobId = entry.prevBlobId
    }
  }

  async recent(n: number): Promise<AuditEntry[]> {
    const results: AuditEntry[] = []
    for await (const entry of this.walk()) {
      results.push(entry)
      if (results.length >= n) break
    }
    return results
  }

  async verify(opts?: { full?: boolean }): Promise<{ valid: boolean; brokenAt?: number; totalEntries: number }> {
    const limit = opts?.full ? Infinity : 100
    let count = 0
    let expectSeq: number | null = null
    const entries: AuditEntry[] = []
    for await (const entry of this.walk()) {
      entries.push(entry)
      count++
      if (count > limit) break
    }
    // Walk is newest-first. Verify seq is contiguous descending
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (i === 0) {
        expectSeq = entry.seq
      } else {
        if (entry.seq !== (expectSeq as number) - 1) {
          return { valid: false, brokenAt: entry.seq, totalEntries: count }
        }
        expectSeq = entry.seq
      }
    }
    return { valid: true, totalEntries: count }
  }
}
