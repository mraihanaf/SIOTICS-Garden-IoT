import broker from "./service/broker"
import http from "http"
import httpServer from "./service/http"
import logger from "./utils/logger"
import ntpServer from "./service/ntp"
import { config } from "dotenv"
import { createServer } from "net"
import { createWebSocketStream, Server } from "ws"
import { serverDatabase } from "./utils/database"
config()

logger.info("Hello World!")
logger.info(`Server running in ${process.env.NODE_ENV} mode`)

const webserver_port = process.env.HTTP_PORT || 3000
const mqtt_port = process.env.MQTT_PORT || 1883
const ws_port = process.env.WS_PORT || 8888
const ntp_port = 123

const brokerServer = createServer(broker.handle)
const wsHttpServer = http.createServer()

const ws = new Server({ server: wsHttpServer })

ws.on("connection", (conn, req) => {
    const stream = createWebSocketStream(conn)
    broker.handle(stream, req)
})

serverDatabase.checkIsConfigured()

httpServer.listen(webserver_port, () => {
    logger.info(`HTTP server is listening on port ${webserver_port}`)
})

brokerServer.listen(mqtt_port, () => {
    logger.info(`Aedes MQTT Broker is listening on port ${mqtt_port}`)
})

wsHttpServer.listen(ws_port, () => {
    logger.info(`Aedes MQTT over websocket is listening on port ${ws_port}`)
})

ntpServer.listen(ntp_port, () => {
    logger.info(`NTP Server is listening on port ${ntp_port}`)
})
