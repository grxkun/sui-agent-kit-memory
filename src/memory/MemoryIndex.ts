import type { MemoryEntry } from './types.js'

export class MemoryIndex {
  private entries: Map<string, MemoryEntry> = new Map()
  private tagIndex: Map<string, Set<string>> = new Map()
  // LRU: track access order (most recently used at end)
  private accessOrder: string[] = []

  constructor(private maxSize: number) {}

  add(entry: MemoryEntry): void {
    if (this.entries.has(entry.id)) {
      this.remove(entry.id)
    }
    this.entries.set(entry.id, entry)
    this.accessOrder.push(entry.id)
    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set())
      }
      this.tagIndex.get(tag)!.add(entry.id)
    }
    // Evict LRU if over maxSize
    while (this.entries.size > this.maxSize) {
      const lruId = this.accessOrder[0]
      if (lruId) this.remove(lruId)
    }
  }

  remove(id: string): boolean {
    const entry = this.entries.get(id)
    if (!entry) return false
    this.entries.delete(id)
    const idx = this.accessOrder.indexOf(id)
    if (idx !== -1) this.accessOrder.splice(idx, 1)
    for (const tag of entry.tags) {
      const tagSet = this.tagIndex.get(tag)
      if (tagSet) {
        tagSet.delete(id)
        if (tagSet.size === 0) this.tagIndex.delete(tag)
      }
    }
    return true
  }

  private touch(id: string): void {
    const idx = this.accessOrder.indexOf(id)
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1)
      this.accessOrder.push(id)
    }
  }

  byTag(tag: string): MemoryEntry[] {
    const ids = this.tagIndex.get(tag)
    if (!ids) return []
    const results: MemoryEntry[] = []
    for (const id of ids) {
      const entry = this.entries.get(id)
      if (entry) {
        this.touch(id)
        results.push(entry)
      }
    }
    return results
  }

  byTags(tags: string[], matchAll = false): MemoryEntry[] {
    if (tags.length === 0) return []
    if (matchAll) {
      // Must match ALL tags
      const sets = tags.map(t => this.tagIndex.get(t) ?? new Set<string>())
      const first = sets[0]
      const matching: MemoryEntry[] = []
      for (const id of first) {
        if (sets.every(s => s.has(id))) {
          const entry = this.entries.get(id)
          if (entry) {
            this.touch(id)
            matching.push(entry)
          }
        }
      }
      return matching
    } else {
      // Match ANY tag
      const seen = new Set<string>()
      const results: MemoryEntry[] = []
      for (const tag of tags) {
        const ids = this.tagIndex.get(tag)
        if (!ids) continue
        for (const id of ids) {
          if (!seen.has(id)) {
            seen.add(id)
            const entry = this.entries.get(id)
            if (entry) {
              this.touch(id)
              results.push(entry)
            }
          }
        }
      }
      return results
    }
  }

  all(): MemoryEntry[] {
    return Array.from(this.entries.values())
  }

  size(): number {
    return this.entries.size
  }
}
