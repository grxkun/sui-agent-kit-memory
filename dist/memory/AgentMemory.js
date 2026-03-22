import { v4 as uuidv4 } from 'uuid';
import { WalrusClient } from '../walrus/WalrusClient.js';
import { BlobStore } from '../walrus/BlobStore.js';
import { MemoryIndex } from './MemoryIndex.js';
import { VectorSearch } from './VectorSearch.js';
import { MemoryEntrySchema } from './types.js';
export class AgentMemory {
    config;
    store;
    index;
    constructor(config) {
        this.config = config;
        const walrusClient = new WalrusClient({
            publisherUrl: config.walrus.publisherUrl,
            aggregatorUrl: config.walrus.aggregatorUrl,
            epochs: config.walrus.epochs,
        });
        this.store = new BlobStore(walrusClient);
        this.index = new MemoryIndex(config.maxIndexSize);
    }
    async remember(opts) {
        const blobId = await this.store.store(opts.content);
        const now = Date.now();
        const ttl = opts.ttlMs !== undefined ? opts.ttlMs : this.config.defaultTtlMs;
        const entry = {
            id: uuidv4(),
            agentAddress: this.config.agentAddress,
            tags: opts.tags,
            content: opts.content,
            embedding: opts.embedding,
            createdAt: now,
            expiresAt: ttl != null ? now + ttl : null,
            blobId,
        };
        this.index.add(entry);
        return entry;
    }
    async recall(tags, limit = 20) {
        const now = Date.now();
        const candidates = tags.length > 0
            ? this.index.byTags(tags, false)
            : this.index.all();
        return candidates
            .filter(e => !(e.expiresAt !== null && e.expiresAt < now))
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);
    }
    async search(queryEmbedding, topK = 10) {
        const all = this.index.all();
        return VectorSearch.topK(queryEmbedding, all, topK);
    }
    async hydrate(entry) {
        return this.store.fetch(entry.blobId);
    }
    forget(entryId) {
        this.index.remove(entryId);
    }
    pruneExpired() {
        const now = Date.now();
        const all = this.index.all();
        let count = 0;
        for (const entry of all) {
            if (entry.expiresAt !== null && entry.expiresAt < now) {
                this.index.remove(entry.id);
                count++;
            }
        }
        return count;
    }
    async snapshot() {
        const entries = this.index.all();
        const snap = {
            agentAddress: this.config.agentAddress,
            exportedAt: Date.now(),
            entryCount: entries.length,
            entries,
        };
        const blobId = await this.store.store(snap);
        return { ...snap, blobId };
    }
    async restore(snapshotBlobId) {
        const snap = await this.store.fetch(snapshotBlobId);
        // Clear existing index entries
        for (const entry of this.index.all()) {
            this.index.remove(entry.id);
        }
        for (const raw of snap.entries) {
            const entry = MemoryEntrySchema.parse(raw);
            this.index.add(entry);
        }
    }
}
//# sourceMappingURL=AgentMemory.js.map