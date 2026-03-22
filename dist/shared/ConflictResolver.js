export class ConflictResolver {
    static lastWriteWins(current, incoming) {
        return { ...current, ...incoming };
    }
    static deepMerge(current, incoming) {
        const result = { ...current };
        for (const [key, value] of Object.entries(incoming)) {
            if (value !== null &&
                typeof value === 'object' &&
                !Array.isArray(value) &&
                typeof current[key] === 'object' &&
                current[key] !== null &&
                !Array.isArray(current[key])) {
                result[key] = ConflictResolver.deepMerge(current[key], value);
            }
            else if (Array.isArray(value) && Array.isArray(current[key])) {
                // Concatenate and deduplicate arrays
                const combined = [...current[key], ...value];
                const deduped = combined.filter((item, idx) => combined.findIndex(i => JSON.stringify(i) === JSON.stringify(item)) === idx);
                result[key] = deduped;
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
}
//# sourceMappingURL=ConflictResolver.js.map