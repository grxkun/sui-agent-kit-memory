export class MemoryIndex {
    maxSize;
    entries = new Map();
    tagIndex = new Map();
    // LRU: track access order (most recently used at end)
    accessOrder = [];
    constructor(maxSize) {
        this.maxSize = maxSize;
    }
    add(entry) {
        if (this.entries.has(entry.id)) {
            this.remove(entry.id);
        }
        this.entries.set(entry.id, entry);
        this.accessOrder.push(entry.id);
        for (const tag of entry.tags) {
            if (!this.tagIndex.has(tag)) {
                this.tagIndex.set(tag, new Set());
            }
            this.tagIndex.get(tag).add(entry.id);
        }
        // Evict LRU if over maxSize
        while (this.entries.size > this.maxSize) {
            const lruId = this.accessOrder[0];
            if (lruId)
                this.remove(lruId);
        }
    }
    remove(id) {
        const entry = this.entries.get(id);
        if (!entry)
            return false;
        this.entries.delete(id);
        const idx = this.accessOrder.indexOf(id);
        if (idx !== -1)
            this.accessOrder.splice(idx, 1);
        for (const tag of entry.tags) {
            const tagSet = this.tagIndex.get(tag);
            if (tagSet) {
                tagSet.delete(id);
                if (tagSet.size === 0)
                    this.tagIndex.delete(tag);
            }
        }
        return true;
    }
    touch(id) {
        const idx = this.accessOrder.indexOf(id);
        if (idx !== -1) {
            this.accessOrder.splice(idx, 1);
            this.accessOrder.push(id);
        }
    }
    byTag(tag) {
        const ids = this.tagIndex.get(tag);
        if (!ids)
            return [];
        const results = [];
        for (const id of ids) {
            const entry = this.entries.get(id);
            if (entry) {
                this.touch(id);
                results.push(entry);
            }
        }
        return results;
    }
    byTags(tags, matchAll = false) {
        if (tags.length === 0)
            return [];
        if (matchAll) {
            // Must match ALL tags
            const sets = tags.map(t => this.tagIndex.get(t) ?? new Set());
            const first = sets[0];
            const matching = [];
            for (const id of first) {
                if (sets.every(s => s.has(id))) {
                    const entry = this.entries.get(id);
                    if (entry) {
                        this.touch(id);
                        matching.push(entry);
                    }
                }
            }
            return matching;
        }
        else {
            // Match ANY tag
            const seen = new Set();
            const results = [];
            for (const tag of tags) {
                const ids = this.tagIndex.get(tag);
                if (!ids)
                    continue;
                for (const id of ids) {
                    if (!seen.has(id)) {
                        seen.add(id);
                        const entry = this.entries.get(id);
                        if (entry) {
                            this.touch(id);
                            results.push(entry);
                        }
                    }
                }
            }
            return results;
        }
    }
    all() {
        return Array.from(this.entries.values());
    }
    size() {
        return this.entries.size;
    }
}
//# sourceMappingURL=MemoryIndex.js.map