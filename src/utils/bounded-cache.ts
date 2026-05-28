interface BoundedCacheEntry<Value> {
  value: Value;
}

export type BoundedCacheLookup<Value> =
  | {
      hit: true;
      value: Value;
    }
  | {
      hit: false;
    };

export class BoundedStringCache<Value> {
  private readonly entries = new Map<string, BoundedCacheEntry<Value>>();

  constructor(private readonly maxEntries: number) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error(
        'BoundedStringCache maxEntries must be a positive integer'
      );
    }
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string): BoundedCacheLookup<Value> {
    const entry = this.entries.get(key);

    if (!entry) {
      return { hit: false };
    }

    this.entries.delete(key);
    this.entries.set(key, entry);

    return {
      hit: true,
      value: entry.value,
    };
  }

  getOrSet(key: string, createValue: () => Value): Value {
    const cachedValue = this.get(key);

    if (cachedValue.hit) {
      return cachedValue.value;
    }

    const value = createValue();
    this.set(key, value);

    return value;
  }

  set(key: string, value: Value): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else {
      this.evictOldestEntry();
    }

    this.entries.set(key, { value });
  }

  clear(): void {
    this.entries.clear();
  }

  private evictOldestEntry(): void {
    if (this.entries.size < this.maxEntries) {
      return;
    }

    const oldestKey = this.entries.keys().next().value;

    if (oldestKey !== undefined) {
      this.entries.delete(oldestKey);
    }
  }
}
