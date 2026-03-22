import { Transaction } from '@mysten/sui/transactions';
import { AuditEntrySchema } from './types.js';
export class AuditLogger {
    store;
    suiClient;
    agentAddress;
    anchorObjectId;
    constructor(store, suiClient, agentAddress, anchorObjectId) {
        this.store = store;
        this.suiClient = suiClient;
        this.agentAddress = agentAddress;
        this.anchorObjectId = anchorObjectId;
    }
    async getChainHead() {
        if (!this.anchorObjectId)
            return { latestBlobId: null, latestSeq: 0 };
        try {
            const obj = await this.suiClient.getObject({
                id: this.anchorObjectId,
                options: { showContent: true },
            });
            const content = obj.data?.content;
            if (content?.dataType === 'moveObject') {
                const fields = content.fields;
                return {
                    latestBlobId: fields['latest_blob_id'] || null,
                    latestSeq: Number(fields['latest_seq'] ?? 0),
                };
            }
        }
        catch {
            // ignore
        }
        return { latestBlobId: null, latestSeq: 0 };
    }
    async append(entry) {
        const head = await this.getChainHead();
        const fullEntry = {
            ...entry,
            seq: head.latestSeq + 1,
            prevBlobId: head.latestBlobId,
            timestamp: new Date().toISOString(),
        };
        const blobId = await this.store.store(fullEntry);
        // Update anchor on Sui if available
        if (this.anchorObjectId) {
            try {
                const tx = new Transaction();
                tx.moveCall({
                    target: `agent_memory::audit_anchor::update`,
                    arguments: [
                        tx.object(this.anchorObjectId),
                        tx.pure.string(blobId),
                    ],
                });
                await this.suiClient.signAndExecuteTransaction({
                    transaction: tx,
                    signer: {},
                });
            }
            catch {
                // Anchor update is best-effort
            }
        }
        return { entry: fullEntry, blobId };
    }
    async *walk(fromBlobId) {
        let currentBlobId = fromBlobId ?? null;
        if (!currentBlobId) {
            const head = await this.getChainHead();
            currentBlobId = head.latestBlobId;
        }
        while (currentBlobId) {
            const data = await this.store.fetch(currentBlobId);
            const entry = AuditEntrySchema.parse(data);
            yield entry;
            currentBlobId = entry.prevBlobId;
        }
    }
    async recent(n) {
        const results = [];
        for await (const entry of this.walk()) {
            results.push(entry);
            if (results.length >= n)
                break;
        }
        return results;
    }
    async verify(opts) {
        const limit = opts?.full ? Infinity : 100;
        let count = 0;
        let expectSeq = null;
        const entries = [];
        for await (const entry of this.walk()) {
            entries.push(entry);
            count++;
            if (count > limit)
                break;
        }
        // Walk is newest-first. Verify seq is contiguous descending
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (i === 0) {
                expectSeq = entry.seq;
            }
            else {
                if (entry.seq !== expectSeq - 1) {
                    return { valid: false, brokenAt: entry.seq, totalEntries: count };
                }
                expectSeq = entry.seq;
            }
        }
        return { valid: true, totalEntries: count };
    }
}
//# sourceMappingURL=AuditLogger.js.map