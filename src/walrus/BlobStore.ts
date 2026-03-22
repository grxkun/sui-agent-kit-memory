import type { WalrusClient } from './WalrusClient.js'
import type { BlobWriteResult, BlobReadResult } from './types.js'

export class BlobStore {
  constructor(private client: WalrusClient) {}

  async write<T>(value: T): Promise<BlobWriteResult> {
    const json = JSON.stringify(value)
    const bytes = new TextEncoder().encode(json)
    return this.client.writeBlob(bytes)
  }

  async read<T>(blobId: string): Promise<BlobReadResult<T>> {
    const bytes = await this.client.readBlob(blobId)
    const text = new TextDecoder().decode(bytes)
    let data: T
    try {
      data = JSON.parse(text) as T
    } catch {
      throw new Error(`Malformed JSON in blob ${blobId}`)
    }
    return { blobId, data, retrievedAt: Date.now() }
  }

  async store<T>(value: T): Promise<string> {
    const result = await this.write(value)
    return result.blobId
  }

  async fetch<T>(blobId: string): Promise<T> {
    const result = await this.read<T>(blobId)
    return result.data
  }
}
