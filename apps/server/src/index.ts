import logger from "./utils/logger"
import { config } from "dotenv"
import broker from "./service/broker"
import httpServer from "./service/http"
import { createServer } from "net"
import http from "http"
import WebSocketStream from "websocket-stream"

config()
logger.info("Hello World!")
const webserver_port = process.env.HTTP_PORT || 3000
const mqtt_port = process.env.MQTT_PORT || 1883
const ws_port = process.env.WS_PORT || 8888

const brokerServer = createServer(broker.handle)
const wsHttpServer = http.createServer()

const wsServer = WebSocketStream.createServer(
    { server: wsHttpServer },
    // @ts-ignore
    broker.handle,
)

httpServer.listen(webserver_port, () => {
    logger.info(`HTTP server is listening on port ${webserver_port}`)
})

brokerServer.listen(mqtt_port, () => {
    logger.info(`Aedes MQTT Broker is listening on port ${mqtt_port}`)
})

wsHttpServer.listen(ws_port, () => {
    logger.info(`Aedes MQTT over websocket is listening on port ${ws_port}`)
})
