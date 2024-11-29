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
                will: {
                    topic: `sprinkler/test/status`,
                    payload: Buffer.from("DEAD"),
                    retain: true,
                    qos: 1,
                },
                username: "thing",
                password: "thing",
            },
        )

        client.publish("sprinkler/test/status", "ALIVE", {
            qos: 1,
            retain: true,
        })

        client.publish("sprinkler/test/trigger", "OFF", {
            qos: 1,
            retain: true,
        })
        logger.info("connected to the broker")
    } catch (err) {
        logger.error(err)
        logger.error(
            "failed connect to the broker. attemping reconnection in 3 seconds",
        )
        setTimeout(clientStart, 3000)
    }
}

setTimeout(clientStart, 3000)
