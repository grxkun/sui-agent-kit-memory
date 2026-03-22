import { z } from 'zod';
export const AuditEntrySchema = z.object({
    seq: z.number(),
    agentAddress: z.string(),
    timestamp: z.string(),
    prompt: z.string(),
    decision: z.string(),
    toolCalls: z.array(z.object({
        name: z.string(),
        args: z.unknown(),
        result: z.unknown().optional(),
    })),
    txDigest: z.string().optional(),
    prevBlobId: z.string().nullable(),
    meta: z.record(z.unknown()).optional(),
});
//# sourceMappingURL=types.js.map