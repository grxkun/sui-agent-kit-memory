import type { MemoryEntry, MemorySearchResult } from './types.js'

export class VectorSearch {
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    let dot = 0
    let magA = 0
    let magB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      magA += a[i] * a[i]
      magB += b[i] * b[i]
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB)
    if (denom === 0) return 0
    return dot / denom
  }

  static topK(
    query: number[],
    candidates: MemoryEntry[],
    k: number,
  ): MemorySearchResult[] {
    const results: MemorySearchResult[] = []
    for (const entry of candidates) {
      if (!entry.embedding || entry.embedding.length === 0) continue
      const score = VectorSearch.cosineSimilarity(query, entry.embedding)
      results.push({ entry, score })
    }
    results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    return results.slice(0, k)
  }
}
