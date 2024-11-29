import { Level } from "level"
import logger from "./logger"
import { ISprinklerConfig, IServerInitConfig } from "../types/database"

const db = new Level("./database")

export class sprinklerDatabase {
    static async addWateringLogs(deviceId: string) {
        throw new Error("method not implemented yet.")
    }

    static async setConfig(
        deviceId: string,
        configKey: ISprinklerConfig,
        configValue: string,
    ): Promise<void> {
        return await db.put(
            `sprinkler_config:${deviceId}:${configKey}`,
            configValue,
        )
    }

    static async updateLastseen(deviceId: string): Promise<void> {
        return await db.put(`sprinkler_config:${deviceId}:lastseen`, Date())
    }

    static async initialize(): Promise<void> {
        // logger.info(`loading all device configs..`)
        // const src = new EntryStream(db ,{
        // }) as any
        // src.on("data", logger.info)
        // src.resume()
        // console.log(src._readableState.length)
        // if(src.length < 1) return
        // const dst = new Writable({
        //     write(chunk, encoding, callback) {
        //         callback()
        //     },
        //     objectMode: true
        // })
        // pipeline(src, dst)
    }
}

db.on("open", () => {
    logger.info("database open")
    sprinklerDatabase.initialize()
})

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
