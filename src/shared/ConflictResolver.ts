export class ConflictResolver {
  static lastWriteWins(
    current: Record<string, unknown>,
    incoming: Partial<Record<string, unknown>>,
  ): Record<string, unknown> {
    return { ...current, ...incoming }
  }

  static deepMerge(
    current: Record<string, unknown>,
    incoming: Partial<Record<string, unknown>>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...current }
    for (const [key, value] of Object.entries(incoming)) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof current[key] === 'object' &&
        current[key] !== null &&
        !Array.isArray(current[key])
      ) {
        result[key] = ConflictResolver.deepMerge(
          current[key] as Record<string, unknown>,
          value as Partial<Record<string, unknown>>,
        )
      } else if (Array.isArray(value) && Array.isArray(current[key])) {
        // Concatenate and deduplicate arrays
        const combined = [...(current[key] as unknown[]), ...value]
        const deduped = combined.filter(
          (item, idx) =>
            combined.findIndex(i => JSON.stringify(i) === JSON.stringify(item)) === idx,
        )
        result[key] = deduped
      } else {
        result[key] = value
      }
    }
    return result
  }
}
