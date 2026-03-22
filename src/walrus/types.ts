import { z } from 'zod'

export interface BlobWriteResult {
  blobId: string
  isNew: boolean
  storageCostMist: bigint
  expiresAtEpoch: number
}

export interface BlobReadResult<T = unknown> {
  blobId: string
  data: T
  retrievedAt: number
}

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
})
export type AuditEntry = z.infer<typeof AuditEntrySchema>

export interface AuditChainHead {
  latestBlobId: string
  latestSeq: number
  agentAddress: string
  anchorObjectId: string
}
