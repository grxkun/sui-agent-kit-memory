import { z } from 'zod'

export const SharedDocumentSchema = z.object({
  version: z.number(),
  updatedAt: z.number(),
  updatedBy: z.string(),
  stateBlobId: z.string().optional(),
  hotState: z.record(z.unknown()),
  auditBlobIds: z.record(z.string()),
})
export type SharedDocument = z.infer<typeof SharedDocumentSchema>
export type MergeStrategy = 'last-write-wins' | 'deep-merge' | 'custom'
