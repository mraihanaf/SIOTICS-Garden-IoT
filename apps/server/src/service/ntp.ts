import { Server } from "ntp-time"
import { ntpLogger } from "../utils/logger"
const ntpServer = new Server()

ntpServer.handle((message: any, response: Function) => {
    message.txTimestamp = Math.floor(Date.now() / 1000)
    response(message)
    ntpLogger.info("ntp client connected, sending timestamp")
})

export default ntpServer
