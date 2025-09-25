// Ref - logger.ts
import { blue, green, yellow, red, gray, white } from "colorette"
import { LoggerOptions } from "./type"

export class Logger {
    private ShouldLog: boolean
    private prefix: string
    private includeTimestamp: boolean

    constructor(options: LoggerOptions = {}) {
        this.ShouldLog = options.ShouldLog ?? true
        if (options.ShouldLog === true) {
            this.prefix = options.prefix ? `[${options.prefix}] ` : ""
            this.includeTimestamp = options.timestamp ?? true
        } else {
            this.prefix = ""
            this.includeTimestamp = false
        }
    }

    private getTimestamp(): string {
        if (!this.includeTimestamp) return ""
        return `[${new Date().toLocaleString("en-US", { hour12: true })}] `
    }

    private formatMessage(level: string, message: string, levelColor: (str: string) => string): string {
        const timestamp = this.getTimestamp()
        const prefix = this.prefix

        const coloredTimestamp = timestamp ? blue(timestamp) : ""
        const coloredPrefix = prefix ? gray(prefix) : ""

        const coloredLevel = levelColor(level)
        const coloredMessage = white(message)

        return `${coloredTimestamp}${coloredPrefix}${coloredLevel}: ${coloredMessage}`
    }

    debug(message: string, ...args: any[]): void {
        if (!this.ShouldLog) return

        const formattedMessage = this.formatMessage("[DEBUG]", message, gray)
        console.log(formattedMessage, ...args)
    }

    info(message: string, ...args: any[]): void {
        if (!this.ShouldLog) return

        const formattedMessage = this.formatMessage("[INFO]", message, green)
        console.log(formattedMessage, ...args)
    }

    warn(message: string, ...args: any[]): void {
        if (this.ShouldLog) {
            const formattedMessage = this.formatMessage("[WARN]", message, yellow)
            console.warn(formattedMessage, ...args)
        }

        process.emitWarning(message, {
            type: "Warning",
            code: "LOGGER_WARNING",
            detail: args.length > 0 ? JSON.stringify(args) : undefined
        })
    }

    error(message: string, ...args: any[]): never {
        if (this.ShouldLog) {
            const formattedMessage = this.formatMessage("[ERROR]", message, red)
            console.error(formattedMessage, ...args)
        }

        const error = new SqliteCacheError(message)
        if (args.length > 0) error.cause = args

        throw error
    }
}

export class SqliteCacheError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "SqliteCacheError"
    }
}
