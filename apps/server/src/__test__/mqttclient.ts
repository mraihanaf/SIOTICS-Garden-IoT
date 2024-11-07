import { connectAsync, MqttClient } from "mqtt"
import { config } from "dotenv"
import Pino, { Logger } from "pino"
import { CronJob } from "cron"

config()
const logger: Logger = Pino({
    name: "SiramPaksa-ESP32-Mocker",
    level: process.env.LOG_LEVEL || "debug",
})
let heartbeatIntervarId: null | NodeJS.Timeout = null
let cronExpression = ""
let wateringDurationInMs = 0
let relayState = true // nyala == tutup keran
let cronJob: CronJob | null = null

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
            isWatering: !relayState, // jika relay nyala maka keran mati, jika relay mati maka keran nyala
        }),
        { qos: 0 },
        (err) => {},
    )
}

function changeJob(
    cronExpression: string,
    wateringDurationInMs: number,
    client: MqttClient,
) {
    if (cronJob) cronJob.stop()
    cronJob = new CronJob(
        cronExpression,
        () => {
            // matikan relay (menyiram)
            logger.info(
                `matikan relay (menyiram).. selama ${wateringDurationInMs}ms`,
            )
            relayState = false
            client.publish(
                `esp/${client.options.clientId}/watering/trigger`,
                "off",
            )
            setTimeout(() => {
                logger.info(
                    `nyalakan relay, selesai menyiram selama ${wateringDurationInMs}`,
                )
                relayState = true
                client.publish(
                    `esp/${client.options.clientId}/watering/trigger`,
                    "on",
                )
            }, wateringDurationInMs)
        },
        null,
        true,
        "Asia/Jakarta",
    )
}

async function clientStart() {
    try {
        const client: MqttClient = await connectAsync(
            `mqtt://localhost:${process.env.MQTT_PORT}`,
            {
                clientId: `test`,
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
                changeJob(cronExpression, wateringDurationInMs, client)
            } else if (
                topic === `esp/${client.options.clientId}/watering/setCron`
            ) {
                logger.info(`got setCron message ${payload.toString()}`)
                cronExpression = payload.toString()
                changeJob(cronExpression, wateringDurationInMs, client)
            } else if (
                topic === `esp/${client.options.clientId}/watering/trigger`
            ) {
                if (payload.toString() === "on") {
                    logger.info("turning on the relay (berhentikan penyiraman)")
                    relayState = true
                } else {
                    logger.info(
                        "turning off the relay (matikan relay/mulai penyiram)",
                    )
                    relayState = false
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
