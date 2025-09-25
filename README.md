# SQLite Cache

[![Discord](https://img.shields.io/discord/1211530334458617866?style=flat&logo=discord&logoColor=ffffff&color=5865f2)](https://discord.gg/FaCCaFM74Q)
[![GitHub Action](https://github.com/softwarexplus/sqlite-cache/actions/workflows/test.yaml/badge.svg)](https://github.com/softwarexplus/sqlite-cache/actions)
[![NPM Version](https://img.shields.io/npm/v/sqlite-cache)](https://www.npmjs.com/package/sqlite-cache)
[![NPM Downloads](https://img.shields.io/npm/dy/sqlite-cache)](https://www.npmjs.com/package/sqlite-cache)
[![NPM Unpacked Size](https://img.shields.io/npm/unpacked-size/sqlite-cache)](https://www.npmjs.com/package/sqlite-cache)
[![NPM License](https://img.shields.io/npm/l/sqlite-cache)](https://github.com/softwarexplus/sqlite-cache/blob/main/LICENSE)

A high-performance, type-safe SQLite-based cache for Node.js applications with built-in TTL (Time To Live), size limits, and schema validation.

## Features

- 🚀 **High Performance**: Built on Node.js native SQLite driver
- 🔒 **Type Safe**: Full TypeScript support with generic types
- ⏰ **TTL Support**: Automatic expiration with configurable time-to-live
- 📏 **Size Limits**: LRU-style eviction when max entries exceeded
- 🔍 **Schema Validation**: JSON Schema validation using TypeBox
- 🪵 **Built-in Logging**: Configurable logging with colorful output
- 🔄 **Iterable**: Full Map-like interface with iteration support
- 💾 **Persistent**: Data survives application restarts
- 🧹 **Auto Cleanup**: Automatic cleanup of expired entries

## Requirements

- Node.js >= 22.5.0 (required for native SQLite driver)

## Installation

```bash
npm install sqlite-cache
```

## Quick Start

```typescript
import { SQLiteCache } from "sqlite-cache"
import { Type } from "@sinclair/typebox"

// Define your data schema
const UserSchema = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    email: Type.String(),
    active: Type.Boolean()
})

type User = {
    id: number
    name: string
    email: string
    active: boolean
}

// Create cache instance
const cache = new SQLiteCache<string, User>({
    path: "./cache.db",
    schema: UserSchema,
    ttl: 60_000, // 1 minute
    max: 1000, // Maximum 1000 entries
    log: true // Enable logging
})

// Use the cache
const user: User = {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    active: true
}

cache.set("user:1", user)
const retrieved = cache.get("user:1")
console.log(retrieved) // { id: 1, name: 'John Doe', ... }

// Clean up
cache.close()
```

## API Reference

### Constructor

```typescript
new SQLiteCache<Key extends string, Value extends object>(options: CacheOptions)
```

#### Options

| Option   | Type                    | Required | Default | Description                        |
| -------- | ----------------------- | -------- | ------- | ---------------------------------- |
| `path`   | `string`                | ✅       | -       | Path to SQLite database file       |
| `schema` | `TSchema`               | ✅       | -       | TypeBox JSON schema for validation |
| `ttl`    | `number`                | ❌       | `60000` | Time to live in milliseconds       |
| `max`    | `number`                | ❌       | `100`   | Maximum number of entries          |
| `log`    | `boolean \| LogOptions` | ❌       | `false` | Logging configuration              |

#### Log Options

```typescript
interface LogOptions {
    prefix?: string // Log prefix (default: '[SQLiteCache]')
    timestamp?: boolean // Include timestamps (default: true)
}
```

### Methods

#### `set(key: Key, value: Value): this`

Store a value in the cache with the given key.

```typescript
cache.set("user:123", { id: 123, name: "Alice", email: "alice@example.com", active: true })
```

#### `get(key: Key): Value | null`

Retrieve a value from the cache. Returns `null` if not found or expired.

```typescript
const user = cache.get("user:123")
if (user) {
    console.log(user.name)
}
```

#### `has(key: Key): boolean`

Check if a key exists and is not expired.

```typescript
if (cache.has("user:123")) {
    console.log("User exists in cache")
}
```

#### `delete(key: Key): boolean`

Remove a specific key from the cache. Returns `true` if the key existed.

```typescript
const wasDeleted = cache.delete("user:123")
```

#### `clear(): void`

Remove all entries from the cache.

```typescript
cache.clear()
```

#### `close(): void`

Close the database connection. Call this when your application shuts down.

```typescript
cache.close()
```

### Properties

#### `size: number`

Get the current number of valid (non-expired) entries in the cache.

```typescript
console.log(`Cache contains ${cache.size} entries`)
```

### Iteration

The cache implements the iterable protocol and provides Map-like iteration methods:

#### `keys(): IterableIterator<Key>`

Iterate over all valid keys.

```typescript
for (const key of cache.keys()) {
    console.log(key)
}
```

#### `values(): IterableIterator<Value>`

Iterate over all valid values.

```typescript
for (const user of cache.values()) {
    console.log(user.name)
}
```

#### `entries(): IterableIterator<[Key, Value]>`

Iterate over all valid key-value pairs.

```typescript
for (const [key, user] of cache.entries()) {
    console.log(`${key}: ${user.name}`)
}
```

#### `forEach(callback: (value: Value, key: Key, cache: this) => void): void`

Execute a callback for each valid entry.

```typescript
cache.forEach((user, key) => {
    console.log(`Processing ${user.name} with key ${key}`)
})
```

#### `[Symbol.iterator](): IterableIterator<[Key, Value]>`

Direct iteration support.

```typescript
for (const [key, user] of cache) {
    console.log(`${key}: ${user.name}`)
}
```

## Advanced Usage

### Custom Schema with Optional Fields

```typescript
import { Type } from "@sinclair/typebox"

const ProductSchema = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    price: Type.Number(),
    description: Type.Optional(Type.String()),
    metadata: Type.Optional(
        Type.Object({
            category: Type.String(),
            tags: Type.Array(Type.String()),
            inStock: Type.Boolean()
        })
    )
})

type Product = {
    id: number
    name: string
    price: number
    description?: string
    metadata?: {
        category: string
        tags: string[]
        inStock: boolean
    }
}

const productCache = new SQLiteCache<string, Product>({
    path: "./products.db",
    schema: ProductSchema,
    ttl: 300_000, // 5 minutes
    max: 5000,
    log: {
        prefix: "[ProductCache]",
        timestamp: true
    }
})
```

### Error Handling

```typescript
try {
    const cache = new SQLiteCache({
        path: "/invalid/path/cache.db",
        schema: UserSchema
    })
} catch (error) {
    console.error("Failed to initialize cache:", error.message)
}
```

### Memory Database

For testing or temporary caching, you can use an in-memory database:

```typescript
const tempCache = new SQLiteCache<string, User>({
    path: ":memory:",
    schema: UserSchema,
    ttl: 30_000
})
```

### Batch Operations

```typescript
// Batch insert
const users = [
    { id: 1, name: "Alice", email: "alice@example.com", active: true },
    { id: 2, name: "Bob", email: "bob@example.com", active: false },
    { id: 3, name: "Charlie", email: "charlie@example.com", active: true }
]

users.forEach((user, index) => {
    cache.set(`user:${user.id}`, user)
})

// Batch retrieve
const cachedUsers = users.map((user) => cache.get(`user:${user.id}`)).filter((user) => user !== null)

console.log(`Retrieved ${cachedUsers.length} users from cache`)
```

## Performance Considerations

- **Database Location**: Use SSD storage for better performance
- **TTL Strategy**: Shorter TTL reduces memory usage but increases cache misses
- **Max Entries**: Higher limits improve hit rates but use more storage
- **Schema Complexity**: Simpler schemas serialize/deserialize faster
- **Key Design**: Use consistent, predictable key patterns for better organization

## Best Practices

### 1. Proper Cleanup

Always close the cache when your application shuts down:

```typescript
process.on("SIGINT", () => {
    cache.close()
    process.exit(0)
})
```

### 2. Key Naming Conventions

Use consistent key patterns:

```typescript
// Good
cache.set("user:123", user)
cache.set("product:456", product)
cache.set("session:abc123", session)

// Avoid
cache.set("123", user)
cache.set("prod456", product)
cache.set("sessionabc123", session)
```

### 3. Schema Design

Design schemas that match your data structure:

```typescript
// Prefer this
const UserSchema = Type.Object({
    id: Type.Number(),
    profile: Type.Object({
        name: Type.String(),
        email: Type.String()
    })
})

// Over this (less structured)
const UserSchema = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    email: Type.String()
    // ... many flat properties
})
```

### 4. Error Handling

Handle potential errors gracefully:

```typescript
const user = cache.get("user:123")
if (!user) {
    // Cache miss - fetch from primary data source
    const user = await fetchUserFromDB(123)
    cache.set("user:123", user)
    return user
}
return user
```

## Troubleshooting

### Node.js Version Error

**Error**: "Node version must be 22.5.0 or higher"

**Solution**: Upgrade to Node.js 22.5.0 or later, which includes the native SQLite driver.

### Database Connection Errors

**Error**: Failed to connect to database

**Solutions**:

- Ensure the directory exists for file-based databases
- Check file permissions
- Verify disk space availability
- Use `:memory:` for testing

### Schema Validation Errors

**Error**: Data does not match schema

**Solutions**:

- Verify your TypeBox schema matches your data structure
- Check for required vs optional fields
- Ensure type compatibility (string vs number, etc.)

### Performance Issues

- Use appropriate TTL values
- Monitor cache hit/miss ratios
- Consider database file location (SSD vs HDD)
- Optimize key naming patterns

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 🐛 Issues: [GitHub Issues](https://github.com/xcfio/sqlite-cache/issues)
- 💖 Sponsor: [Patreon](https://www.patreon.com/xcfio)

## Changelog

### v0.0.2

- Initial release with basic caching functionality
- TTL support with automatic cleanup
- Size limits with LRU-style eviction
- TypeBox schema validation
- Full TypeScript support
- Configurable logging
- Map-like iteration interface

---

Made with ❤️ by [xcfio](https://github.com/xcfio)
