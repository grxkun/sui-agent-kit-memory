import type { AuditEntry } from '../walrus/types.js';
export interface AgentTurn {
    id: string;
    agentAddress: string;
    prompt: string;
    decision?: string;
    toolCalls?: AuditEntry['toolCalls'];
    txDigest?: string;
    meta?: Record<string, unknown>;
}
export interface MemoryMiddlewareOptions {
    agentAddress: string;
    walrusPublisherUrl: string;
    walrusAggregatorUrl: string;
    suiRpcUrl: string;
    sharedMemoryObjectId?: string;
    autoAudit: boolean;
    autoInjectMemory: boolean;
    maxInjectedMemories: number;
    injectionTags?: string[];
}
//# sourceMappingURL=types.d.ts.map