import { z } from 'zod';
export declare const SharedDocumentSchema: z.ZodObject<{
    version: z.ZodNumber;
    updatedAt: z.ZodNumber;
    updatedBy: z.ZodString;
    stateBlobId: z.ZodOptional<z.ZodString>;
    hotState: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    auditBlobIds: z.ZodRecord<z.ZodString, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    version: number;
    updatedAt: number;
    updatedBy: string;
    hotState: Record<string, unknown>;
    auditBlobIds: Record<string, string>;
    stateBlobId?: string | undefined;
}, {
    version: number;
    updatedAt: number;
    updatedBy: string;
    hotState: Record<string, unknown>;
    auditBlobIds: Record<string, string>;
    stateBlobId?: string | undefined;
}>;
export type SharedDocument = z.infer<typeof SharedDocumentSchema>;
export type MergeStrategy = 'last-write-wins' | 'deep-merge' | 'custom';
//# sourceMappingURL=types.d.ts.map