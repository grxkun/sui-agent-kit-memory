import type { SuiClient } from '@mysten/sui/client';
import type { BlobStore } from './BlobStore.js';
import type { AuditEntry } from './types.js';
export declare class AuditLogger {
    private store;
    private suiClient;
    private agentAddress;
    private anchorObjectId?;
    constructor(store: BlobStore, suiClient: SuiClient, agentAddress: string, anchorObjectId?: string | undefined);
    private getChainHead;
    append(entry: Omit<AuditEntry, 'seq' | 'prevBlobId' | 'timestamp'>): Promise<{
        entry: AuditEntry;
        blobId: string;
    }>;
    walk(fromBlobId?: string): AsyncGenerator<AuditEntry>;
    recent(n: number): Promise<AuditEntry[]>;
    verify(opts?: {
        full?: boolean;
    }): Promise<{
        valid: boolean;
        brokenAt?: number;
        totalEntries: number;
    }>;
}
//# sourceMappingURL=AuditLogger.d.ts.map