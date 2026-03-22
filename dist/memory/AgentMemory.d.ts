import type { MemoryEntry, MemorySearchResult, MemorySnapshot, AgentMemoryConfig } from './types.js';
export declare class AgentMemory {
    private config;
    private store;
    private index;
    constructor(config: AgentMemoryConfig);
    remember(opts: {
        content: unknown;
        tags: string[];
        embedding?: number[];
        ttlMs?: number | null;
    }): Promise<MemoryEntry>;
    recall(tags: string[], limit?: number): Promise<MemoryEntry[]>;
    search(queryEmbedding: number[], topK?: number): Promise<MemorySearchResult[]>;
    hydrate<T>(entry: MemoryEntry): Promise<T>;
    forget(entryId: string): void;
    pruneExpired(): number;
    snapshot(): Promise<MemorySnapshot>;
    restore(snapshotBlobId: string): Promise<void>;
}
//# sourceMappingURL=AgentMemory.d.ts.map