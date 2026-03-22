import { z } from 'zod';
export declare const MemoryEntrySchema: z.ZodObject<{
    id: z.ZodString;
    agentAddress: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    content: z.ZodUnknown;
    embedding: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    createdAt: z.ZodNumber;
    expiresAt: z.ZodNullable<z.ZodNumber>;
    blobId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    agentAddress: string;
    blobId: string;
    id: string;
    tags: string[];
    createdAt: number;
    expiresAt: number | null;
    content?: unknown;
    embedding?: number[] | undefined;
}, {
    agentAddress: string;
    blobId: string;
    id: string;
    tags: string[];
    createdAt: number;
    expiresAt: number | null;
    content?: unknown;
    embedding?: number[] | undefined;
}>;
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;
export interface MemorySearchResult {
    entry: MemoryEntry;
    score?: number;
}
export interface MemorySnapshot {
    agentAddress: string;
    exportedAt: number;
    entryCount: number;
    entries: MemoryEntry[];
    blobId: string;
}
export declare const AgentMemoryConfigSchema: z.ZodObject<{
    agentAddress: z.ZodString;
    walrus: z.ZodObject<{
        publisherUrl: z.ZodString;
        aggregatorUrl: z.ZodString;
        epochs: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        publisherUrl: string;
        aggregatorUrl: string;
        epochs: number;
    }, {
        publisherUrl: string;
        aggregatorUrl: string;
        epochs?: number | undefined;
    }>;
    defaultTtlMs: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    maxIndexSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    agentAddress: string;
    walrus: {
        publisherUrl: string;
        aggregatorUrl: string;
        epochs: number;
    };
    defaultTtlMs: number | null;
    maxIndexSize: number;
}, {
    agentAddress: string;
    walrus: {
        publisherUrl: string;
        aggregatorUrl: string;
        epochs?: number | undefined;
    };
    defaultTtlMs?: number | null | undefined;
    maxIndexSize?: number | undefined;
}>;
export type AgentMemoryConfig = z.infer<typeof AgentMemoryConfigSchema>;
//# sourceMappingURL=types.d.ts.map