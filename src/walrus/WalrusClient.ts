import type { BlobWriteResult } from './types.js'

export class WalrusBlobNotFoundError extends Error {
  constructor(blobId: string) {
    super(`Walrus blob not found: ${blobId}`)
    this.name = 'WalrusBlobNotFoundError'
  }
}

export class WalrusClient {
  constructor(
    private config: { publisherUrl: string; aggregatorUrl: string; epochs: number },
  ) {}

  async writeBlob(data: Uint8Array): Promise<BlobWriteResult> {
    const url = `${this.config.publisherUrl}/v1/blobs?epochs=${this.config.epochs}`
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: data,
    })
    if (!response.ok) {
      throw new Error(`Walrus write failed: ${response.status} ${response.statusText}`)
    }
    const json = await response.json() as Record<string, unknown>
    if ('newlyCreated' in json) {
      const nc = json['newlyCreated'] as {
        blobObject: { blobId: string; storageCost: string | number; storage: { endEpoch: number } }
      }
      return {
        blobId: nc.blobObject.blobId,
        isNew: true,
        storageCostMist: BigInt(nc.blobObject.storageCost),
        expiresAtEpoch: nc.blobObject.storage.endEpoch,
      }
    } else if ('alreadyCertified' in json) {
      const ac = json['alreadyCertified'] as { blobId: string; endEpoch?: number }
      return {
        blobId: ac.blobId,
        isNew: false,
        storageCostMist: BigInt(0),
        expiresAtEpoch: ac.endEpoch ?? 0,
      }
    }
    throw new Error('Unexpected Walrus response shape')
  }

  async readBlob(blobId: string): Promise<Uint8Array> {
    const url = `${this.config.aggregatorUrl}/v1/blobs/${blobId}`
    const response = await fetch(url)
    if (response.status === 404) {
      throw new WalrusBlobNotFoundError(blobId)
    }
    if (!response.ok) {
      throw new Error(`Walrus read failed: ${response.status} ${response.statusText}`)
    }
    const buffer = await response.arrayBuffer()
    return new Uint8Array(buffer)
  }

  async getBlobInfo(blobId: string): Promise<{ exists: boolean; expiresAtEpoch: number } | null> {
    const url = `${this.config.aggregatorUrl}/v1/blobs/${blobId}`
    const response = await fetch(url, { method: 'HEAD' })
    if (response.status === 404) return null
    if (!response.ok) return null
    return { exists: true, expiresAtEpoch: 0 }
  }
}
