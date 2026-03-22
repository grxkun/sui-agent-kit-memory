import type { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import type { SharedDocument, MergeStrategy } from './types.js';
export declare class SharedMemoryObject {
    private client;
    private config;
    private signer;
    constructor(client: SuiClient, config: {
        objectId: string;
        rpcUrl: string;
        mergeStrategy: MergeStrategy;
    }, signer: (ptb: Transaction) => Promise<string>);
    read(): Promise<SharedDocument>;
    patch(updates: Partial<SharedDocument['hotState']>): Promise<number>;
    setStateBlobId(blobId: string): Promise<void>;
    publishAuditHead(_agentAddress: string, blobId: string): Promise<void>;
    subscribe(onChange: (doc: SharedDocument) => void, intervalMs?: number): () => void;
}
//# sourceMappingURL=SharedMemoryObject.d.ts.map