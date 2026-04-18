# sqlite-cache

A simple, TTL-aware, size-bounded persistent cache for Node.js backed by SQLite via [`node-sqlite-map`](https://github.com/xcfio/node-sqlite-map). No external database dependencies — just a file (or `:memory:`).

## Requirements

- Node.js >= 22.5.0 (for `node:sqlite`)

## Installation

```bash
npm install sqlite-cache
# or
pnpm add sqlite-cache
```

## Quick Start

```typescript
import { SQLiteCache } from "sqlite-cache"

const cache = new SQLiteCache({ path: "./cache.db" })

cache.set("user:1", { name: "Kyle", role: "admin" })
cache.get("user:1") // { name: "Kyle", role: "admin" }
cache.has("user:1") // true
cache.size // 1
```

Use `:memory:` for a non-persistent in-memory cache:

```typescript
const cache = new SQLiteCache({ path: ":memory:" })
```

## API

### Constructor

```typescript
new SQLiteCache<Key extends string, Value extends object>(options: CacheOptions)
```

**`CacheOptions`**

| Option | Type     | Default | Description                                   |
| ------ | -------- | ------- | --------------------------------------------- |
| `path` | `string` | —       | Path to SQLite database file, or `":memory:"` |
| `ttl`  | `number` | `60000` | Time-to-live in milliseconds                  |
| `max`  | `number` | `100`   | Maximum number of live entries                |

### Core Methods

#### `set(key, value): this`

Inserts or replaces an entry with a fresh TTL. Automatically evicts expired and overflow entries before inserting. Returns `this` for chaining.

```typescript
cache.set("a", { x: 1 }).set("b", { x: 2 })
```

#### `get(key): Value | null`

Returns the value if the key exists and has not expired, otherwise `null`.

```typescript
cache.get("a") // { x: 1 }
cache.get("z") // null
```

#### `has(key): boolean`

Returns `true` if the key exists and is not expired.

```typescript
cache.has("a") // true
```

#### `delete(key): boolean`

Removes the entry. Returns `true` if it existed, `false` otherwise.

```typescript
cache.delete("a") // true
cache.delete("a") // false
```

#### `clear(): void`

Removes all entries (including expired ones).

```typescript
cache.clear()
cache.size // 0
```

### Iteration

All iteration methods only yield **live (non-expired)** entries.

#### `keys(): IterableIterator<Key>`

```typescript
for (const key of cache.keys()) console.log(key)
console.log([...cache.keys()]) // ["a", "b"]
```

#### `values(): IterableIterator<Value>`

```typescript
console.log([...cache.values()]) // [{ x: 1 }, { x: 2 }]
```

#### `entries(): IterableIterator<[Key, Value]>`

```typescript
console.log([...cache.entries()]) // [["a", { x: 1 }], ["b", { x: 2 }]]
```

#### `forEach(callback): void`

```typescript
cache.forEach((value, key, cache) => {
    console.log(key, value)
})
```

#### `[Symbol.iterator]()`

Makes the cache directly iterable — equivalent to `entries()`.

```typescript
for (const [key, value] of cache) {
    console.log(key, value)
}
```

### Properties

#### `size: number`

Returns the count of **live (non-expired)** entries.

```typescript
cache.size // 2
```

### Eviction

Eviction happens automatically on every `set()` call:

1. **Expired entries** are removed first.
2. **Overflow entries** are removed oldest-first if the live count exceeds `max`.

## Type Parameters

```typescript
SQLiteCache<Key extends string, Value extends object>
```

| Parameter | Constraint | Description                                             |
| --------- | ---------- | ------------------------------------------------------- |
| `Key`     | `string`   | Key type — must be a string                             |
| `Value`   | `object`   | Value type — must be a plain object (JSON-serializable) |

## Exported Types

```typescript
export type CacheOptions = {
    path: string
    max?: number
    ttl?: number
}

export type CacheEntry<V> = {
    value: V
    expires: number
    createdAt: number
}
```

## Errors

All validation errors throw `SqliteCacheError`:

```typescript
import { SqliteCacheError } from "sqlite-cache"

try {
    cache.set("" as any, { x: 1 })
} catch (err) {
    if (err instanceof SqliteCacheError) {
        console.error(err.message) // "Cache key must be a valid string"
    }
}
```

## Examples

### API response cache

```typescript
const cache = new SQLiteCache<string, { data: unknown }>({
    path: "./api-cache.db",
    ttl: 30_000,
    max: 500
})

async function fetchUser(id: string) {
    const cached = cache.get(`user:${id}`)
    if (cached) return cached.data

    const data = await api.getUser(id)
    cache.set(`user:${id}`, { data })
    return data
}
```

### Session store

```typescript
const sessions = new SQLiteCache<string, { userId: string; role: string }>({
    path: "./sessions.db",
    ttl: 3_600_000, // 1 hour
    max: 1000
})

sessions.set(sessionToken, { userId: "42", role: "admin" })
sessions.get(sessionToken) // { userId: "42", role: "admin" }
```

## License

MIT — see [LICENSE](LICENSE) for details.

## Links

| Resource | URL                                          |
| -------- | -------------------------------------------- |
| GitHub   | https://github.com/xcfio/sqlite-cache        |
| npm      | https://www.npmjs.com/package/sqlite-cache   |
| Issues   | https://github.com/xcfio/sqlite-cache/issues |

---

Made with ❤️ by [xcfio](https://github.com/xcfio)
