import { z } from 'zod';
export const SharedDocumentSchema = z.object({
    version: z.number(),
    updatedAt: z.number(),
    updatedBy: z.string(),
    stateBlobId: z.string().optional(),
    hotState: z.record(z.unknown()),
    auditBlobIds: z.record(z.string()),
});
//# sourceMappingURL=types.js.map