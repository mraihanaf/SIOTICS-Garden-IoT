import pino, { Logger } from "pino"
import { config } from "dotenv"
config()
const logger: Logger = pino({
    name: "SIOTICS-Garden-Server",
    level: process.env.LOG_LEVEL || "debug",
})

export const brokerLogger = logger.child({ type: "broker" })
export const httpLogger = logger.child({ type: "http" })
export default logger
