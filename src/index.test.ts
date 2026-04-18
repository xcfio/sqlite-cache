import { test, describe, beforeEach, afterEach } from "node:test"
import { SQLiteCache, SqliteCacheError } from "./index"

import assert from "node:assert/strict"

const DB_PATH = ":memory:"
let cache: SQLiteCache<string, { name: string }>

beforeEach(() => {
    cache = new SQLiteCache({ path: DB_PATH, ttl: 1000, max: 3 })
})

afterEach(() => {
    cache.clear()
})

// ─── Constructor ────────────────────────────────────────────────────────────

describe("constructor", () => {
    test("throws if options missing", () => {
        // @ts-ignore
        assert.throws(() => new SQLiteCache(null), SqliteCacheError)
    })

    test("throws if path is missing", () => {
        // @ts-ignore
        assert.throws(() => new SQLiteCache({}), SqliteCacheError)
    })

    test("applies defaults for ttl and max", () => {
        const c = new SQLiteCache({ path: DB_PATH })
        assert.equal(c.ttl, 60_000)
        assert.equal(c.max, 100)
        c.clear()
    })
})

// ─── set / get ──────────────────────────────────────────────────────────────

describe("set / get", () => {
    test("stores and retrieves a value", () => {
        cache.set("a", { name: "Kyle" })
        assert.deepEqual(cache.get("a"), { name: "Kyle" })
    })

    test("returns null for missing key", () => {
        assert.equal(cache.get("missing"), null)
    })

    test("returns null after TTL expires", async () => {
        const c = new SQLiteCache({ path: DB_PATH, ttl: 50 })
        c.set("x", { name: "temp" })
        await new Promise((r) => setTimeout(r, 100))
        assert.equal(c.get("x"), null)
        c.clear()
    })

    test("throws on invalid key", () => {
        // @ts-ignore
        assert.throws(() => cache.set("", { name: "x" }), SqliteCacheError)
    })

    test("throws on invalid value", () => {
        // @ts-ignore
        assert.throws(() => cache.set("k", null), SqliteCacheError)
    })

    test("set returns this (chainable)", () => {
        const result = cache.set("a", { name: "x" })
        assert.equal(result, cache)
    })
})

// ─── has ────────────────────────────────────────────────────────────────────

describe("has", () => {
    test("returns true for live entry", () => {
        cache.set("a", { name: "x" })
        assert.equal(cache.has("a"), true)
    })

    test("returns false for missing key", () => {
        assert.equal(cache.has("nope"), false)
    })

    test("returns false for expired entry", async () => {
        const c = new SQLiteCache({ path: DB_PATH, ttl: 50 })
        c.set("x", { name: "y" })
        await new Promise((r) => setTimeout(r, 100))
        assert.equal(c.has("x"), false)
        c.clear()
    })
})

// ─── delete ─────────────────────────────────────────────────────────────────

describe("delete", () => {
    test("removes an existing key", () => {
        cache.set("a", { name: "x" })
        assert.equal(cache.delete("a"), true)
        assert.equal(cache.get("a"), null)
    })

    test("returns false for non-existent key", () => {
        assert.equal(cache.delete("ghost"), false)
    })
})

// ─── clear ──────────────────────────────────────────────────────────────────

describe("clear", () => {
    test("removes all entries", () => {
        cache.set("a", { name: "1" })
        cache.set("b", { name: "2" })
        cache.clear()
        assert.equal(cache.size, 0)
    })
})

// ─── size ───────────────────────────────────────────────────────────────────

describe("size", () => {
    test("counts only live entries", async () => {
        const c = new SQLiteCache({ path: DB_PATH, ttl: 50 })
        c.set("a", { name: "1" })
        c.set("b", { name: "2" })
        assert.equal(c.size, 2)
        await new Promise((r) => setTimeout(r, 100))
        assert.equal(c.size, 0)
        c.clear()
    })
})

// ─── iterators ──────────────────────────────────────────────────────────────

describe("keys / values / entries / forEach", () => {
    test("keys() yields live keys", () => {
        cache.set("a", { name: "1" })
        cache.set("b", { name: "2" })
        const keys = [...cache.keys()]
        assert.deepEqual(keys.sort(), ["a", "b"])
    })

    test("values() yields live values", () => {
        cache.set("a", { name: "omar" })
        const vals = [...cache.values()]
        assert.deepEqual(vals, [{ name: "omar" }])
    })

    test("entries() yields [key, value] pairs", () => {
        cache.set("a", { name: "x" })
        const entries = [...cache.entries()]
        assert.deepEqual(entries, [["a", { name: "x" }]])
    })

    test("forEach iterates live entries", () => {
        cache.set("a", { name: "1" })
        const seen: string[] = []
        cache.forEach((_, k) => seen.push(k))
        assert.deepEqual(seen, ["a"])
    })

    test("[Symbol.iterator] works", () => {
        cache.set("z", { name: "last" })
        const result = [...cache]
        assert.deepEqual(result, [["z", { name: "last" }]])
    })
})

// ─── SqliteCacheError ───────────────────────────────────────────────────────

describe("SqliteCacheError", () => {
    test("has correct name", () => {
        const err = new SqliteCacheError("oops")
        assert.equal(err.name, "SqliteCacheError")
        assert.equal(err.message, "oops")
        assert.ok(err instanceof Error)
    })
})
