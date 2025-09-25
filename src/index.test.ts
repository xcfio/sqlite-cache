import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { SQLiteCache } from "../src/cache"
import { Type } from "@sinclair/typebox"
import { existsSync, unlinkSync } from "node:fs"
import { join } from "node:path"

// Test schema for user data
const UserSchema = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    email: Type.String(),
    active: Type.Boolean(),
    metadata: Type.Optional(
        Type.Object({
            lastLogin: Type.String(),
            preferences: Type.Record(Type.String(), Type.Any())
        })
    )
})

type User = {
    id: number
    name: string
    email: string
    active: boolean
    metadata?: {
        lastLogin: string
        preferences: Record<string, any>
    }
}

describe("SQLiteCache", () => {
    let cache: SQLiteCache<string, User>
    const testDbPath = join(process.cwd(), "test-cache.db")

    beforeEach(() => {
        // Clean up any existing test database
        if (existsSync(testDbPath)) {
            unlinkSync(testDbPath)
        }

        cache = new SQLiteCache<string, User>({
            path: testDbPath,
            schema: UserSchema,
            ttl: 1000, // 1 second for testing
            max: 5,
            log: false
        })
    })

    afterEach(() => {
        cache.close()
        if (existsSync(testDbPath)) {
            unlinkSync(testDbPath)
        }
    })

    describe("Constructor", () => {
        it("should create cache with default options", () => {
            const defaultCache = new SQLiteCache({
                path: ":memory:",
                schema: UserSchema
            })
            expect(defaultCache.ttl).toBe(60_000)
            expect(defaultCache.max).toBe(100)
            defaultCache.close()
        })

        it("should throw error when options are missing", () => {
            expect(() => new SQLiteCache(null as any)).toThrow("Cache options are required")
        })

        it("should initialize with logging enabled", () => {
            const loggedCache = new SQLiteCache({
                path: ":memory:",
                schema: UserSchema,
                log: {
                    prefix: "[TEST]",
                    timestamp: true
                }
            })
            expect(loggedCache.log).toBeDefined()
            loggedCache.close()
        })
    })

    describe("Basic Operations", () => {
        const testUser: User = {
            id: 1,
            name: "John Doe",
            email: "john@example.com",
            active: true,
            metadata: {
                lastLogin: "2024-01-01T10:00:00Z",
                preferences: { theme: "dark", language: "en" }
            }
        }

        it("should set and get a value", () => {
            cache.set("user1", testUser)
            const retrieved = cache.get("user1")

            expect(retrieved).toEqual(testUser)
        })

        it("should return null for non-existent key", () => {
            const retrieved = cache.get("nonexistent")
            expect(retrieved).toBe(null)
        })

        it("should check if key exists", () => {
            cache.set("user1", testUser)

            expect(cache.has("user1")).toBe(true)
            expect(cache.has("nonexistent")).toBe(false)
        })

        it("should delete a key", () => {
            cache.set("user1", testUser)
            expect(cache.has("user1")).toBe(true)

            const deleted = cache.delete("user1")
            expect(deleted).toBe(true)
            expect(cache.has("user1")).toBe(false)
        })

        it("should return false when deleting non-existent key", () => {
            const deleted = cache.delete("nonexistent")
            expect(deleted).toBe(false)
        })

        it("should clear all entries", () => {
            cache.set("user1", testUser)
            cache.set("user2", { ...testUser, id: 2, name: "Jane Doe" })

            expect(cache.size).toBe(2)
            cache.clear()
            expect(cache.size).toBe(0)
        })

        it("should return correct size", () => {
            expect(cache.size).toBe(0)

            cache.set("user1", testUser)
            expect(cache.size).toBe(1)

            cache.set("user2", { ...testUser, id: 2, name: "Jane Doe" })
            expect(cache.size).toBe(2)
        })
    })

    describe("TTL (Time To Live)", () => {
        it("should expire entries after TTL", async () => {
            const shortTtlCache = new SQLiteCache<string, User>({
                path: ":memory:",
                schema: UserSchema,
                ttl: 50, // 50ms
                log: false
            })

            const testUser: User = {
                id: 1,
                name: "John Doe",
                email: "john@example.com",
                active: true
            }

            shortTtlCache.set("user1", testUser)
            expect(shortTtlCache.has("user1")).toBe(true)

            // Wait for expiration
            await new Promise((resolve) => setTimeout(resolve, 100))

            expect(shortTtlCache.has("user1")).toBe(false)
            expect(shortTtlCache.get("user1")).toBe(null)

            shortTtlCache.close()
        })

        it("should clean up expired entries on set", async () => {
            const shortTtlCache = new SQLiteCache<string, User>({
                path: ":memory:",
                schema: UserSchema,
                ttl: 50,
                log: false
            })

            const testUser: User = {
                id: 1,
                name: "John Doe",
                email: "john@example.com",
                active: true
            }

            shortTtlCache.set("user1", testUser)

            // Wait for expiration
            await new Promise((resolve) => setTimeout(resolve, 100))

            // Setting a new entry should clean up expired ones
            shortTtlCache.set("user2", { ...testUser, id: 2 })

            expect(shortTtlCache.has("user1")).toBe(false)
            expect(shortTtlCache.has("user2")).toBe(true)

            shortTtlCache.close()
        })
    })

    describe("Max Entries Limit", () => {
        it("should enforce max entries limit", () => {
            const limitedCache = new SQLiteCache<string, User>({
                path: ":memory:",
                schema: UserSchema,
                max: 2,
                log: false
            })

            const users = [
                { id: 1, name: "User 1", email: "user1@example.com", active: true },
                { id: 2, name: "User 2", email: "user2@example.com", active: true },
                { id: 3, name: "User 3", email: "user3@example.com", active: true }
            ]

            users.forEach((user, index) => {
                limitedCache.set(`user${index + 1}`, user)
            })

            expect(limitedCache.size).toBe(2)
            expect(limitedCache.has("user1")).toBe(true)
            expect(limitedCache.has("user2")).toBe(true)
            expect(limitedCache.has("user3")).toBe(false)

            limitedCache.close()
        })
    })

    describe("Iteration Methods", () => {
        beforeEach(() => {
            const users = [
                { id: 1, name: "Alice", email: "alice@example.com", active: true },
                { id: 2, name: "Bob", email: "bob@example.com", active: false },
                { id: 3, name: "Charlie", email: "charlie@example.com", active: true }
            ]

            users.forEach((user, index) => {
                cache.set(`user${index + 1}`, user)
            })
        })

        it("should iterate over keys", () => {
            const keys = Array.from(cache.keys())
            expect(keys).toHaveLength(3)
            expect(keys).toEqual(expect.arrayContaining(["user1", "user2", "user3"]))
        })

        it("should iterate over values", () => {
            const values = Array.from(cache.values())
            expect(values).toHaveLength(3)
            expect(values.every((v) => typeof v === "object" && "id" in v)).toBe(true)
        })

        it("should iterate over entries", () => {
            const entries = Array.from(cache.entries())
            expect(entries).toHaveLength(3)
            expect(entries.every(([key, value]) => typeof key === "string" && typeof value === "object")).toBe(true)
        })

        it("should support forEach", () => {
            const collected: Array<[string, User]> = []

            cache.forEach((value, key) => {
                collected.push([key, value])
            })

            expect(collected).toHaveLength(3)
            expect(collected.every(([key, value]) => typeof key === "string" && typeof value === "object")).toBe(true)
        })

        it("should support Symbol.iterator", () => {
            const entries = Array.from(cache)
            expect(entries).toHaveLength(3)
            expect(entries.every(([key, value]) => typeof key === "string" && typeof value === "object")).toBe(true)
        })
    })

    describe("Schema Validation", () => {
        it("should work with valid data matching schema", () => {
            const validUser: User = {
                id: 1,
                name: "Valid User",
                email: "valid@example.com",
                active: true
            }

            expect(() => cache.set("valid", validUser)).not.toThrow()
            expect(cache.get("valid")).toEqual(validUser)
        })

        it("should handle optional fields correctly", () => {
            const userWithMetadata: User = {
                id: 1,
                name: "User With Metadata",
                email: "user@example.com",
                active: true,
                metadata: {
                    lastLogin: "2024-01-01T10:00:00Z",
                    preferences: { theme: "light" }
                }
            }

            const userWithoutMetadata: User = {
                id: 2,
                name: "User Without Metadata",
                email: "user2@example.com",
                active: false
            }

            cache.set("with-metadata", userWithMetadata)
            cache.set("without-metadata", userWithoutMetadata)

            expect(cache.get("with-metadata")).toEqual(userWithMetadata)
            expect(cache.get("without-metadata")).toEqual(userWithoutMetadata)
        })
    })

    describe("Database Connection Handling", () => {
        it("should handle operations gracefully when db is null", () => {
            const nullDbCache = new SQLiteCache<string, User>({
                path: ":memory:",
                schema: UserSchema,
                log: false
            })

            // Force db to null to simulate connection failure
            nullDbCache.db = null

            const testUser: User = {
                id: 1,
                name: "Test User",
                email: "test@example.com",
                active: true
            }

            // Should not throw errors
            expect(() => {
                nullDbCache.set("test", testUser)
                nullDbCache.get("test")
                nullDbCache.has("test")
                nullDbCache.delete("test")
                nullDbCache.clear()
            }).not.toThrow()

            expect(nullDbCache.size).toBe(0)
            expect(Array.from(nullDbCache.keys())).toEqual([])
            expect(Array.from(nullDbCache.values())).toEqual([])
            expect(Array.from(nullDbCache.entries())).toEqual([])
        })
    })

    describe("Edge Cases", () => {
        it("should handle non-empty string keys only", () => {
            const testUser: User = {
                id: 1,
                name: "Test User",
                email: "test@example.com",
                active: true
            }

            // Empty string should throw an error based on your validation
            expect(() => cache.set("", testUser)).toThrow("Cache key must be a valid string")

            // Valid non-empty string should work
            cache.set("valid-key", testUser)
            expect(cache.has("valid-key")).toBe(true)
            expect(cache.get("valid-key")).toEqual(testUser)
        })

        it("should handle complex nested objects", () => {
            const complexUser: User = {
                id: 1,
                name: "Complex User",
                email: "complex@example.com",
                active: true,
                metadata: {
                    lastLogin: "2024-01-01T10:00:00Z",
                    preferences: {
                        theme: "dark",
                        notifications: {
                            email: true,
                            push: false,
                            sms: true
                        },
                        features: ["feature1", "feature2"],
                        settings: {
                            autoSave: true,
                            timeout: 300
                        }
                    }
                }
            }

            cache.set("complex", complexUser)
            const retrieved = cache.get("complex")

            expect(retrieved).toEqual(complexUser)
            expect(retrieved?.metadata?.preferences.notifications).toEqual({
                email: true,
                push: false,
                sms: true
            })
        })
    })
})
