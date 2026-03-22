import { z } from 'zod';
export interface BlobWriteResult {
    blobId: string;
    isNew: boolean;
    storageCostMist: bigint;
    expiresAtEpoch: number;
}
export interface BlobReadResult<T = unknown> {
    blobId: string;
    data: T;
    retrievedAt: number;
}
export declare const AuditEntrySchema: z.ZodObject<{
    seq: z.ZodNumber;
    agentAddress: z.ZodString;
    timestamp: z.ZodString;
    prompt: z.ZodString;
    decision: z.ZodString;
    toolCalls: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        args: z.ZodUnknown;
        result: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        args?: unknown;
        result?: unknown;
    }, {
        name: string;
        args?: unknown;
        result?: unknown;
    }>, "many">;
    txDigest: z.ZodOptional<z.ZodString>;
    prevBlobId: z.ZodNullable<z.ZodString>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    seq: number;
    agentAddress: string;
    timestamp: string;
    prompt: string;
    decision: string;
    toolCalls: {
        name: string;
        args?: unknown;
        result?: unknown;
    }[];
    prevBlobId: string | null;
    txDigest?: string | undefined;
    meta?: Record<string, unknown> | undefined;
}, {
    seq: number;
    agentAddress: string;
    timestamp: string;
    prompt: string;
    decision: string;
    toolCalls: {
        name: string;
        args?: unknown;
        result?: unknown;
    }[];
    prevBlobId: string | null;
    txDigest?: string | undefined;
    meta?: Record<string, unknown> | undefined;
}>;
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
export interface AuditChainHead {
    latestBlobId: string;
    latestSeq: number;
    agentAddress: string;
    anchorObjectId: string;
}
//# sourceMappingURL=types.d.ts.map