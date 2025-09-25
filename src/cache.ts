import { Logger, SqliteCacheError } from "./logger"
import { Value } from "@sinclair/typebox/value"
import { TSchema } from "@sinclair/typebox"
import { DatabaseSync } from "node:sqlite"
import { CacheOptions } from "./type"
import { blue } from "colorette"
import FastJSON from "fast-json-stringify"

export class SQLiteCache<Key extends string, Value extends object> {
    ttl: number
    max: number
    log: Logger
    db: DatabaseSync | null
    schema: TSchema
    stringify: <TDoc = object | any[] | string | number | boolean | null>(doc: TDoc) => string

    constructor(options: CacheOptions) {
        if (!options) throw new SqliteCacheError("Cache options are required")

        // Initialize logger first
        this.log = new Logger({ ShouldLog: false })
        this.log.debug("Starting SQLiteCache initialization...")

        if (options.log) {
            if (typeof options.log === "boolean") {
                this.log = new Logger({ ShouldLog: options.log })
            } else {
                this.log = new Logger({ ShouldLog: true, prefix: options.log.prefix, timestamp: options.log.timestamp })
            }
            this.log.info("Logger initialized successfully")
        } else {
            this.log = new Logger({ ShouldLog: false })
        }

        this.log.debug("Validating cache options...")
        if (!options.path || typeof options.path !== "string") {
            this.log.error("Cache path must be a valid string")
        }
        if (!options.schema || typeof options.schema !== "object") {
            this.log.error("Cache schema must be a valid JSON schema object")
        }

        this.ttl = options.ttl || 60_000
        this.max = options.max || 100
        this.schema = options.schema

        this.log.debug("Initializing FastJSON serializer...")
        try {
            this.stringify = FastJSON(this.schema)
            this.log.debug("FastJSON serializer initialized successfully")
        } catch (error) {
            this.log.error(`Failed to initialize FastJSON serializer: ${error}`)
        }

        this.log.info(
            `Cache configuration - TTL: ${blue(this.ttl.toString())}ms, Max entries: ${blue(this.max.toString())}`
        )
        this.log.debug(`Schema validation enabled with properties:`, Object.keys(this.schema.properties || {}))

        this.log.debug("Checking Node.js version compatibility...")
        const [major, minor] = process.versions.node.split(".").map((x) => parseInt(x))
        if (major < 22 || (major === 22 && minor < 5)) {
            this.log.error("Node version must be 22.5.0 or higher to use the sqlite driver")
        }
        this.log.info(`Node.js version ${process.versions.node} is compatible`)

        this.log.debug(`Attempting to initialize SQLite database at: ${options.path}`)
        try {
            this.db = new DatabaseSync(options.path)
            this.log.info(`Database connection established: ${blue(options.path)}`)
        } catch (error) {
            this.log.error(`Failed to connect to database: ${error}`)
        }

        this.log.debug("Creating cache table and indexes...")
        try {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS cache (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    expires INTEGER,
                    created_at INTEGER
                );
            `)
            this.log.debug("Cache table created/verified successfully")
        } catch (error) {
            this.log.error(`Failed to create cache table: ${error}`)
        }

        this.log.info("SQLiteCache initialization completed successfully")
    }

    set(key: Key, data: Value): this {
        if (!this.db) return this
        if (!key || typeof key !== "string") this.log.error("Cache key must be a valid string")
        if (!data || typeof data !== "object") this.log.error("Cache value must be a valid object")

        if (!Value.Check(this.schema, data)) {
            this.log.error(`Data does not match schema for key: ${key}`)
        }

        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO cache (key, value, expires, created_at)
            VALUES (?, ?, ?, ?)
        `)

        stmt.run(key, this.stringify(data), Date.now() + this.ttl, Date.now())
        this.db.exec(`DELETE FROM cache WHERE expires < ${Date.now()}`)
        this.db.exec(`
            DELETE FROM cache 
            WHERE key NOT IN (
                SELECT key FROM cache ORDER BY created_at DESC LIMIT ${this.max}
            )
        `)

        this.log.debug(`Set cache key: ${key}`)
        return this
    }

    get(key: Key): Value | null {
        if (!this.db) return null
        if (!key || typeof key !== "string") this.log.error("Cache key must be a valid string")

        const stmt = this.db.prepare(`SELECT value, expires FROM cache WHERE key = ?`)
        const result = stmt.get(key) as { value: string; expires: number } | null

        if (!result) {
            this.log.debug(`Cache miss for key: ${key}`)
            return null
        }

        if (Date.now() > result.expires) {
            this.db.prepare(`DELETE FROM cache WHERE key = ?`).run(key)
            this.log.debug(`Cache key expired: ${key}`)
            return null
        }

        this.log.debug(`Cache hit for key: ${key}`)
        return JSON.parse(result.value) as Value
    }

    has(key: Key): boolean {
        if (!this.db) return false
        if (!key || typeof key !== "string") this.log.error("Cache key must be a valid string")

        const stmt = this.db.prepare(`SELECT 1 FROM cache WHERE key = ? AND expires > ?`)
        const result = stmt.get(key, Date.now())
        return result !== undefined
    }

    delete(key: Key): boolean {
        if (!this.db) return false
        if (!key || typeof key !== "string") this.log.error("Cache key must be a valid string")

        const stmt = this.db.prepare(`DELETE FROM cache WHERE key = ?`)
        const result = stmt.run(key)

        this.log.debug(`Deleted cache key: ${key}`)
        return result.changes > 0
    }

    clear(): void {
        if (!this.db) return
        this.db.exec(`DELETE FROM cache`)
        this.log.info("Cleared all cache entries")
    }

    get size(): number {
        if (!this.db) return 0
        const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM cache WHERE expires > ?`)
        const result = stmt.get(Date.now()) as { count: number }
        return result.count
    }

    keys(): IterableIterator<Key> {
        const keyArray = this.keysArray()
        let index = 0

        return {
            [Symbol.iterator](): IterableIterator<Key> {
                return this
            },
            next(): IteratorResult<Key> {
                if (index < keyArray.length) {
                    return { value: keyArray[index++], done: false }
                }
                return { value: undefined, done: true }
            }
        }
    }

    values(): IterableIterator<Value> {
        const valueArray = this.valuesArray()
        let index = 0

        return {
            [Symbol.iterator](): IterableIterator<Value> {
                return this
            },
            next(): IteratorResult<Value> {
                if (index < valueArray.length) {
                    return { value: valueArray[index++], done: false }
                }
                return { value: undefined, done: true }
            }
        }
    }

    entries(): IterableIterator<[Key, Value]> {
        const entryArray = this.entriesArray()
        let index = 0

        return {
            [Symbol.iterator](): IterableIterator<[Key, Value]> {
                return this
            },
            next(): IteratorResult<[Key, Value]> {
                if (index < entryArray.length) {
                    return { value: entryArray[index++], done: false }
                }
                return { value: undefined, done: true }
            }
        }
    }

    forEach(callback: (value: Value, key: Key, map: this) => void): void {
        for (const [key, value] of this.entriesArray()) {
            callback(value, key, this)
        }
    }

    [Symbol.iterator](): IterableIterator<[Key, Value]> {
        return this.entries()
    }

    private keysArray(): Key[] {
        if (!this.db) return []
        const stmt = this.db.prepare(`SELECT key FROM cache WHERE expires > ? ORDER BY created_at DESC`)
        const results = stmt.all(Date.now()) as { key: Key }[]
        return results.map((row) => row.key)
    }

    private valuesArray(): Value[] {
        if (!this.db) return []
        const stmt = this.db.prepare(`SELECT value FROM cache WHERE expires > ? ORDER BY created_at DESC`)
        const results = stmt.all(Date.now()) as { value: string }[]
        return results.map((row) => JSON.parse(row.value) as Value)
    }

    private entriesArray(): Array<[Key, Value]> {
        if (!this.db) return []
        const stmt = this.db.prepare(`SELECT key, value FROM cache WHERE expires > ? ORDER BY created_at DESC`)
        const results = stmt.all(Date.now()) as { key: Key; value: string }[]
        return results.map((row) => [row.key, JSON.parse(row.value) as Value])
    }

    close(): void {
        if (this.db) {
            this.db.close()
            this.db = null
            this.log.info("Database connection closed")
        }
    }
}
