import { SuiClient } from '@mysten/sui/client';
import { AgentMemory } from '../memory/AgentMemory.js';
import { AgentMemoryConfigSchema } from '../memory/types.js';
import { WalrusClient } from '../walrus/WalrusClient.js';
import { BlobStore } from '../walrus/BlobStore.js';
import { AuditLogger } from '../walrus/AuditLogger.js';
import { SharedMemoryObject } from '../shared/SharedMemoryObject.js';
export function createMemoryMiddleware(options) {
    const suiClient = new SuiClient({ url: options.suiRpcUrl });
    const memoryConfig = AgentMemoryConfigSchema.parse({
        agentAddress: options.agentAddress,
        walrus: {
            publisherUrl: options.walrusPublisherUrl,
            aggregatorUrl: options.walrusAggregatorUrl,
            epochs: 5,
        },
        defaultTtlMs: null,
        maxIndexSize: 10_000,
    });
    const memory = new AgentMemory(memoryConfig);
    const walrusClient = new WalrusClient({
        publisherUrl: options.walrusPublisherUrl,
        aggregatorUrl: options.walrusAggregatorUrl,
        epochs: 5,
    });
    const store = new BlobStore(walrusClient);
    const audit = new AuditLogger(store, suiClient, options.agentAddress);
    let shared = null;
    if (options.sharedMemoryObjectId) {
        shared = new SharedMemoryObject(suiClient, {
            objectId: options.sharedMemoryObjectId,
            rpcUrl: options.suiRpcUrl,
            mergeStrategy: 'last-write-wins',
        }, async (_ptb) => {
            // Signer must be provided externally in real usage
            throw new Error('No signer configured');
        });
    }
    return {
        memory,
        audit,
        shared,
        async beforeTurn(turn) {
            if (!options.autoInjectMemory)
                return turn.prompt;
            const tags = options.injectionTags ?? [];
            const memories = await memory.recall(tags, options.maxInjectedMemories);
            if (memories.length === 0)
                return turn.prompt;
            const block = memories
                .map(m => `[${(m.tags).join(',')}] ${JSON.stringify(m.content)}`)
                .join('\n');
            return `${turn.prompt}\n---\nAGENT MEMORY (${memories.length} entries):\n${block}\n---`;
        },
        async afterTurn(turn) {
            if (options.autoAudit) {
                const { blobId } = await audit.append({
                    agentAddress: turn.agentAddress,
                    prompt: turn.prompt,
                    decision: turn.decision,
                    toolCalls: turn.toolCalls ?? [],
                    txDigest: turn.txDigest,
                    meta: turn.meta,
                });
                if (shared) {
                    try {
                        await shared.publishAuditHead(turn.agentAddress, blobId);
                    }
                    catch {
                        // best effort
                    }
                }
            }
        },
        async memorise(content, tags, embedding) {
            return memory.remember({ content, tags, embedding });
        },
        async exportState() {
            const snap = await memory.snapshot();
            const recent = await audit.recent(1);
            const auditHeadBlobId = recent.length > 0
                ? await store.store(recent[0])
                : await store.store(null);
            return {
                memorySnapshotBlobId: snap.blobId,
                auditHeadBlobId,
            };
        },
    };
}
//# sourceMappingURL=AgentMemoryMiddleware.js.map