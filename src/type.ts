import { TSchema } from "@sinclair/typebox"

export type CacheOptions = {
    schema: TSchema
    path: string
    max?: number
    ttl?: number
    log?: boolean | { prefix?: string; timestamp?: boolean }
}

export type LoggerOptions = ShouldLog | ShouldNotLog

type ShouldNotLog = {
    ShouldLog: false
}

type ShouldLog = {
    ShouldLog?: true
    prefix?: string
    timestamp?: boolean
}
