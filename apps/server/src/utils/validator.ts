import { Client } from "aedes"
import { parseExpression } from "cron-parser"
export class clientValidator {
    public static isFromHost(client: Client | null): boolean {
        return client === null
    }

    public static isFromClient(client: Client | null): boolean {
        return !this.isFromHost(client)
    }
    public static isWebsocketClient(client: Client | null): boolean {
        if (client?.req) return true
        return false
    }

    public static isNotWebsocketClient(client: Client | null): boolean {
        return !this.isWebsocketClient(client)
    }
}

export class cronValidator {
    public static isCronExpression(cronExpression: string): boolean {
        let isCronExpression = false
        try {
            parseExpression(cronExpression)
            isCronExpression = true
        } catch {}

        return isCronExpression
    }
}
