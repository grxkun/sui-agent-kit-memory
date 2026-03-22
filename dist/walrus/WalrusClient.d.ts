import type { BlobWriteResult } from './types.js';
export declare class WalrusBlobNotFoundError extends Error {
    constructor(blobId: string);
}
export declare class WalrusClient {
    private config;
    constructor(config: {
        publisherUrl: string;
        aggregatorUrl: string;
        epochs: number;
    });
    writeBlob(data: Uint8Array): Promise<BlobWriteResult>;
    readBlob(blobId: string): Promise<Uint8Array>;
    getBlobInfo(blobId: string): Promise<{
        exists: boolean;
        expiresAtEpoch: number;
    } | null>;
}
//# sourceMappingURL=WalrusClient.d.ts.map