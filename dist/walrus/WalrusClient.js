export class WalrusBlobNotFoundError extends Error {
    constructor(blobId) {
        super(`Walrus blob not found: ${blobId}`);
        this.name = 'WalrusBlobNotFoundError';
    }
}
export class WalrusClient {
    config;
    constructor(config) {
        this.config = config;
    }
    async writeBlob(data) {
        const url = `${this.config.publisherUrl}/v1/blobs?epochs=${this.config.epochs}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: data,
        });
        if (!response.ok) {
            throw new Error(`Walrus write failed: ${response.status} ${response.statusText}`);
        }
        const json = await response.json();
        if ('newlyCreated' in json) {
            const nc = json['newlyCreated'];
            return {
                blobId: nc.blobObject.blobId,
                isNew: true,
                storageCostMist: BigInt(nc.blobObject.storageCost),
                expiresAtEpoch: nc.blobObject.storage.endEpoch,
            };
        }
        else if ('alreadyCertified' in json) {
            const ac = json['alreadyCertified'];
            return {
                blobId: ac.blobId,
                isNew: false,
                storageCostMist: BigInt(0),
                expiresAtEpoch: ac.endEpoch ?? 0,
            };
        }
        throw new Error('Unexpected Walrus response shape');
    }
    async readBlob(blobId) {
        const url = `${this.config.aggregatorUrl}/v1/blobs/${blobId}`;
        const response = await fetch(url);
        if (response.status === 404) {
            throw new WalrusBlobNotFoundError(blobId);
        }
        if (!response.ok) {
            throw new Error(`Walrus read failed: ${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
    }
    async getBlobInfo(blobId) {
        const url = `${this.config.aggregatorUrl}/v1/blobs/${blobId}`;
        const response = await fetch(url, { method: 'HEAD' });
        if (response.status === 404)
            return null;
        if (!response.ok)
            return null;
        return { exists: true, expiresAtEpoch: 0 };
    }
}
//# sourceMappingURL=WalrusClient.js.map