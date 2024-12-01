import { connectAsync, MqttClient } from "mqtt"
import { config } from "dotenv"
import Pino, { Logger } from "pino"
import { CronJob } from "cron"
import { Client as NTPClient } from "ntp-time"

config()
const logger: Logger = Pino({
    name: "SiramPaksa-ESP32-Mocker",
    level: process.env.LOG_LEVEL || "debug",
})

interface ISprinklerConfig {
    wateringDurationInMs: null | number
    cronExpression: null | string
}

let sprinklerConfig: ISprinklerConfig = {
    wateringDurationInMs: null,
    cronExpression: null,
}
let relayState = true // nyala == tutup keran
let cronJob: CronJob | null = null

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

function checkIfConfigured(): boolean {
    if (
        !sprinklerConfig.cronExpression ||
        !sprinklerConfig.wateringDurationInMs
    )
        return false
    return true
}

function configure(client: MqttClient): void {
    if (!checkIfConfigured()) return logger.info("device not configured yet")
    client.publish(`sprinkler/test/status`, "ALIVE", {
        qos: 1,
        retain: true,
    })

    logger.info("device configured!")

    // configure device
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

        const ntpClient = new NTPClient("localhost")

        // sync time every 1 minutes

        function timeSync() {
            ntpClient
                .syncTime()
                .then(() => logger.info("ntp client sync, connected."))
                .catch(() => logger.fatal("failed to sync"))
        }

        timeSync()

        setInterval(() => {
            timeSync()
        }, 60 * 1_000)

        client.publish("sprinkler/test/status", "INIT", {
            qos: 1,
            retain: true,
        })

        client.publish("sprinkler/test/trigger", "OFF", {
            qos: 1,
            retain: true,
        })

        client.subscribe("sprinkler/test/#")
        client.on("message", (topic, payload, _packet) => {
            logger.debug(`${topic} with payload=${payload}`)
            switch (topic) {
                case "sprinkler/test/config/duration":
                    sprinklerConfig.wateringDurationInMs = parseInt(
                        payload.toString(),
                    )
                    configure(client)
                    break
                case "sprinkler/test/config/cron":
                    sprinklerConfig.cronExpression = payload.toString()
                    configure(client)
                    break
            }
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
