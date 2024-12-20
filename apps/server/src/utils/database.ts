import { Level } from "level"
import logger from "./logger"
import { IServerInitConfig } from "../types/database"
import AedesPersistence from "aedes-persistence-level"

const db = new Level("./database")

export class sprinklerDatabase {
    static async addWateringLogs(deviceId: string) {
        throw new Error("method not implemented yet.")
    }
}

export const aedesPersistenceLevel = AedesPersistence(db)
export class serverDatabase {
    static isConfigured: boolean | null = null
    static config: IServerInitConfig | null = null

    static async checkIsConfiguredWithDatabase(): Promise<boolean> {
        const serverInitKeys: Array<keyof IServerInitConfig> = [
            "brokerUsername",
            "brokerPassword",
            "apiUsername",
            "apiPassword",
        ]
        logger.debug("checking initial config with database")
        try {
            const currentConfigs = await db.getMany(serverInitKeys)
            let isConfigured = true
            for (const config of currentConfigs) {
                if (config === undefined) {
                    isConfigured = false
                }
            }
            this.isConfigured = isConfigured

            if (isConfigured) {
                logger.info("server initialized")
                this.config = {
                    brokerUsername: await db.get("brokerUsername"),
                    brokerPassword: await db.get("brokerPassword"),
                    apiUsername: await db.get("apiUsername"),
                    apiPassword: await db.get("apiPassword"),
                }
            }

            return isConfigured
        } catch {
            return false
        }
    }

    static async configure(config: IServerInitConfig): Promise<void> {
        const isConfigured = await this.checkIsConfiguredWithDatabase()
        if (isConfigured) throw new Error("database already configured")
        let batch = db.batch()
        Object.entries(config).forEach(([key, value]) => {
            batch.put(key, String(value))
        })
        await batch.write()
        await this.checkIsConfiguredWithDatabase()
    }

    static async checkIsConfigured(): Promise<boolean> {
        if (this.isConfigured === null) {
            return await this.checkIsConfiguredWithDatabase()
        }
        return this.isConfigured
    }

    static getConfig(): null | IServerInitConfig {
        return this.config
    }
}

const closeEvents = ["close", "SIGINT", "SIGQUIT", "SIGTERM"]

closeEvents.forEach((event) => {
    process.on(event, async () => {
        logger.info("Process will be closed, closing the database...")
        await db.close()
        process.exit()
    })
})
