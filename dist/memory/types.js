import { z } from 'zod';
export const MemoryEntrySchema = z.object({
    id: z.string(),
    agentAddress: z.string(),
    tags: z.array(z.string()),
    content: z.unknown(),
    embedding: z.array(z.number()).optional(),
    createdAt: z.number(),
    expiresAt: z.number().nullable(),
    blobId: z.string(),
});
export const AgentMemoryConfigSchema = z.object({
    agentAddress: z.string(),
    walrus: z.object({
        publisherUrl: z.string().url(),
        aggregatorUrl: z.string().url(),
        epochs: z.number().default(5),
    }),
    defaultTtlMs: z.number().nullable().default(null),
    maxIndexSize: z.number().default(10_000),
});
//# sourceMappingURL=types.js.map