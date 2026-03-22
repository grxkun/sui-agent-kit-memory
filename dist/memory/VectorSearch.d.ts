import type { MemoryEntry, MemorySearchResult } from './types.js';
export declare class VectorSearch {
    static cosineSimilarity(a: number[], b: number[]): number;
    static topK(query: number[], candidates: MemoryEntry[], k: number): MemorySearchResult[];
}
//# sourceMappingURL=VectorSearch.d.ts.map