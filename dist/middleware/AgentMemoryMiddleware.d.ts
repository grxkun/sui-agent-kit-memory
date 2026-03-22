import { AgentMemory } from '../memory/AgentMemory.js';
import type { MemoryEntry } from '../memory/types.js';
import { AuditLogger } from '../walrus/AuditLogger.js';
import { SharedMemoryObject } from '../shared/SharedMemoryObject.js';
import type { AgentTurn, MemoryMiddlewareOptions } from './types.js';
export declare function createMemoryMiddleware(options: MemoryMiddlewareOptions): {
    memory: AgentMemory;
    audit: AuditLogger;
    shared: SharedMemoryObject | null;
    beforeTurn(turn: AgentTurn): Promise<string>;
    afterTurn(turn: Required<AgentTurn>): Promise<void>;
    memorise(content: unknown, tags: string[], embedding?: number[]): Promise<MemoryEntry>;
    exportState(): Promise<{
        memorySnapshotBlobId: string;
        auditHeadBlobId: string;
    }>;
};
//# sourceMappingURL=AgentMemoryMiddleware.d.ts.map