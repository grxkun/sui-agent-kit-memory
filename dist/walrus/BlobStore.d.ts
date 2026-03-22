import type { WalrusClient } from './WalrusClient.js';
import type { BlobWriteResult, BlobReadResult } from './types.js';
export declare class BlobStore {
    private client;
    constructor(client: WalrusClient);
    write<T>(value: T): Promise<BlobWriteResult>;
    read<T>(blobId: string): Promise<BlobReadResult<T>>;
    store<T>(value: T): Promise<string>;
    fetch<T>(blobId: string): Promise<T>;
}
//# sourceMappingURL=BlobStore.d.ts.map