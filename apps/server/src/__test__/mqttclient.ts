import { connectAsync, MqttClient } from "mqtt"
import { config } from "dotenv"
import Pino, { Logger } from "pino"

config()
const logger: Logger = Pino({
    name: "SiramPaksa-ESP32-Mocker",
    level: process.env.LOG_LEVEL || "debug",
})
let heartbeatIntervarId: null | NodeJS.Timeout = null
let cronExpression = ""
let wateringDurationInMs = 0

function handleDisconnected(client: MqttClient) {
    logger.info("Client disconnected, reconnecting...")
    client.end()
    if (heartbeatIntervarId) clearInterval(heartbeatIntervarId)
    clientStart()
}

function sendHeartbeat(client: MqttClient): void {
    logger.debug("sending heartbeat")
    if (!client.connected) return handleDisconnected(client)
    client.publish(
        `esp/${client.options.clientId}/heartbeat`,
        JSON.stringify({
            date: new Date().toISOString(),
            wateringDurationInMs: wateringDurationInMs,
            cronExp: cronExpression,
        }),
        { qos: 0 },
        (err) => {},
    )
}

async function clientStart() {
    try {
        const client: MqttClient = await connectAsync(
            `mqtt://localhost:${process.env.MQTT_PORT}`,
            {
                clientId: "test",
            },
        )
        logger.info("connected to the broker")
        client.publish("esp/init", client.options.clientId!, { qos: 2 })
        client.subscribe(`esp/${client.options.clientId}/watering/setCron`)
        client.subscribe(
            `esp/${client.options.clientId}/watering/setDurationInMs`,
        )
        client.subscribe(`esp/${client.options.clientId}/watering/trigger`)
        client.on("message", (topic, payload) => {
            if (
                topic ===
                `esp/${client.options.clientId}/watering/setDurationInMs`
            ) {
                logger.info(`got setDuration message ${payload.toString()}`)
                wateringDurationInMs = parseInt(payload.toString())
            } else if (
                topic === `esp/${client.options.clientId}/watering/setCron`
            ) {
                logger.info(`got setCron message ${payload.toString()}`)
                cronExpression = payload.toString()
            } else if (
                topic === `esp/${client.options.clientId}/watering/trigger`
            ) {
                if (payload.toString() === "on") {
                    logger.info("turning on the relay")
                } else {
                    logger.info("turning off the relay")
                }
            }
        })
        // client.publish("esp/test/system/logs", "berhasil yey")
        heartbeatIntervarId = setInterval(() => sendHeartbeat(client), 1000)
    } catch (err) {
        logger.error(err)
        logger.error(
            "failed connect to the broker. attemping reconnection in 3 seconds",
        )
        setTimeout(clientStart, 3000)
    }
}

setTimeout(clientStart, 3000)
