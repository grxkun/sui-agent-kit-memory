import type { MemoryEntry } from './types.js';
export declare class MemoryIndex {
    private maxSize;
    private entries;
    private tagIndex;
    private accessOrder;
    constructor(maxSize: number);
    add(entry: MemoryEntry): void;
    remove(id: string): boolean;
    private touch;
    byTag(tag: string): MemoryEntry[];
    byTags(tags: string[], matchAll?: boolean): MemoryEntry[];
    all(): MemoryEntry[];
    size(): number;
}
//# sourceMappingURL=MemoryIndex.d.ts.map