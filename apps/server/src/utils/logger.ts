import pino, { Logger } from "pino"
import { config } from "dotenv"
config()
const logger: Logger = pino({
    name: "SIOTICS-Garden-Server",
    level: process.env.LOG_LEVEL || "debug",
})

export const brokerLogger = logger.child({ service: "broker" })
export const httpLogger = logger.child({ service: "http" })
export const ntpLogger = logger.child({ service: "ntp" })
export default logger
