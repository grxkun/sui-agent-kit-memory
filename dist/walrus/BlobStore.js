export class BlobStore {
    client;
    constructor(client) {
        this.client = client;
    }
    async write(value) {
        const json = JSON.stringify(value);
        const bytes = new TextEncoder().encode(json);
        return this.client.writeBlob(bytes);
    }
    async read(blobId) {
        const bytes = await this.client.readBlob(blobId);
        const text = new TextDecoder().decode(bytes);
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            throw new Error(`Malformed JSON in blob ${blobId}`);
        }
        return { blobId, data, retrievedAt: Date.now() };
    }
    async store(value) {
        const result = await this.write(value);
        return result.blobId;
    }
    async fetch(blobId) {
        const result = await this.read(blobId);
        return result.data;
    }
}
//# sourceMappingURL=BlobStore.js.map