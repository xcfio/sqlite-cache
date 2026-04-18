import { SqliteMap } from "node-sqlite-map"
export { version } from "../package.json"

export class SQLiteCache<Key extends string, Value extends object> {
    private map: SqliteMap<Key, CacheEntry<Value>>
    ttl: number
    max: number

    constructor(options: CacheOptions) {
        if (!options) throw new SqliteCacheError("Cache options are required")
        if (!options.path || typeof options.path !== "string") this.error("Cache path must be a valid string")

        this.ttl = options.ttl ?? 60_000
        this.max = options.max ?? 100

        this.map = new SqliteMap<Key, CacheEntry<Value>>(options.path)
    }

    set(key: Key, data: Value): this {
        if (!key || typeof key !== "string") this.error("Cache key must be a valid string")
        if (!data || typeof data !== "object") this.error("Cache value must be a valid object")

        this._evictExpired()
        this._evictOverflow()

        this.map.set(key, { value: data, expires: Date.now() + this.ttl, createdAt: Date.now() })

        return this
    }

    get(key: Key): Value | null {
        const entry = this.map.get(key)
        if (!entry) return null

        if (Date.now() > entry.expires) {
            this.map.delete(key)

            return null
        }

        return entry.value
    }

    has(key: Key): boolean {
        const entry = this.map.get(key)
        return !!entry && Date.now() <= entry.expires
    }

    delete(key: Key): boolean {
        return this.map.delete(key)
    }

    clear(): void {
        this.map.clear()
    }

    get size(): number {
        return [...this.map.values()].filter((e) => Date.now() <= e.expires).length
    }

    keys(): IterableIterator<Key> {
        return this._liveEntries()
            .map(([k]) => k)
            [Symbol.iterator]()
    }

    values(): IterableIterator<Value> {
        return this._liveEntries()
            .map(([, e]) => e.value)
            [Symbol.iterator]()
    }

    entries(): IterableIterator<[Key, Value]> {
        return this._liveEntries()
            .map(([k, e]) => [k, e.value] as [Key, Value])
            [Symbol.iterator]()
    }

    forEach(callback: (value: Value, key: Key, map: this) => void): void {
        for (const [k, e] of this._liveEntries()) callback(e.value, k, this)
    }

    [Symbol.iterator](): IterableIterator<[Key, Value]> {
        return this.entries()
    }

    private _liveEntries(): [Key, CacheEntry<Value>][] {
        const now = Date.now()
        return [...this.map.entries()].filter(([, e]) => now <= e.expires)
    }

    private _evictExpired(): void {
        const now = Date.now()
        for (const [k, e] of this.map.entries()) {
            if (now > e.expires) this.map.delete(k)
        }
    }

    private _evictOverflow(): void {
        const entries = [...this.map.entries()]
            .filter(([, e]) => Date.now() <= e.expires)
            .sort(([, a], [, b]) => a.createdAt - b.createdAt)
        for (const [k] of entries.slice(this.max)) this.map.delete(k)
    }

    private error(message: string): never {
        throw new SqliteCacheError(message)
    }
}

export class SqliteCacheError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "SqliteCacheError"
    }
}

export type CacheEntry<V> = {
    value: V
    expires: number
    createdAt: number
}

export type CacheOptions = {
    path: string
    max?: number
    ttl?: number
}
