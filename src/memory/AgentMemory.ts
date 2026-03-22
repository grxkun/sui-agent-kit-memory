import { v4 as uuidv4 } from 'uuid'
import { WalrusClient } from '../walrus/WalrusClient.js'
import { BlobStore } from '../walrus/BlobStore.js'
import { MemoryIndex } from './MemoryIndex.js'
import { VectorSearch } from './VectorSearch.js'
import { MemoryEntrySchema } from './types.js'
import type { MemoryEntry, MemorySearchResult, MemorySnapshot, AgentMemoryConfig } from './types.js'

export class AgentMemory {
  private store: BlobStore
  private index: MemoryIndex

  constructor(private config: AgentMemoryConfig) {
    const walrusClient = new WalrusClient({
      publisherUrl: config.walrus.publisherUrl,
      aggregatorUrl: config.walrus.aggregatorUrl,
      epochs: config.walrus.epochs,
    })
    this.store = new BlobStore(walrusClient)
    this.index = new MemoryIndex(config.maxIndexSize)
  }

  async remember(opts: {
    content: unknown
    tags: string[]
    embedding?: number[]
    ttlMs?: number | null
  }): Promise<MemoryEntry> {
    const blobId = await this.store.store(opts.content)
    const now = Date.now()
    const ttl = opts.ttlMs !== undefined ? opts.ttlMs : this.config.defaultTtlMs
    const entry: MemoryEntry = {
      id: uuidv4(),
      agentAddress: this.config.agentAddress,
      tags: opts.tags,
      content: opts.content,
      embedding: opts.embedding,
      createdAt: now,
      expiresAt: ttl != null ? now + ttl : null,
      blobId,
    }
    this.index.add(entry)
    return entry
  }

  async recall(tags: string[], limit = 20): Promise<MemoryEntry[]> {
    const now = Date.now()
    const candidates = tags.length > 0
      ? this.index.byTags(tags, false)
      : this.index.all()
    return candidates
      .filter(e => !(e.expiresAt !== null && e.expiresAt < now))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
  }

  async search(queryEmbedding: number[], topK = 10): Promise<MemorySearchResult[]> {
    const all = this.index.all()
    return VectorSearch.topK(queryEmbedding, all, topK)
  }

  async hydrate<T>(entry: MemoryEntry): Promise<T> {
    return this.store.fetch<T>(entry.blobId)
  }

  forget(entryId: string): void {
    this.index.remove(entryId)
  }

  pruneExpired(): number {
    const now = Date.now()
    const all = this.index.all()
    let count = 0
    for (const entry of all) {
      if (entry.expiresAt !== null && entry.expiresAt < now) {
        this.index.remove(entry.id)
        count++
      }
    }
    return count
  }

  async snapshot(): Promise<MemorySnapshot> {
    const entries = this.index.all()
    const snap: Omit<MemorySnapshot, 'blobId'> = {
      agentAddress: this.config.agentAddress,
      exportedAt: Date.now(),
      entryCount: entries.length,
      entries,
    }
    const blobId = await this.store.store(snap)
    return { ...snap, blobId }
  }

  async restore(snapshotBlobId: string): Promise<void> {
    const snap = await this.store.fetch<MemorySnapshot>(snapshotBlobId)
    // Clear existing index entries
    for (const entry of this.index.all()) {
      this.index.remove(entry.id)
    }
    for (const raw of snap.entries) {
      const entry = MemoryEntrySchema.parse(raw)
      this.index.add(entry)
    }
  }
}
