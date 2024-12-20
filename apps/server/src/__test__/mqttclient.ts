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
let relayState = false
let autoState = true
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
            if (autoState)
                return logger.info(
                    `siram otomatis dibatalkan karena sedang menyiram manual`,
                )
            logger.info(`menyiram.. selama ${wateringDurationInMs}ms`)
            relayState = false
            client.publish(
                `sprinkler/${client.options.clientId}/trigger`,
                "AUTO.ON",
            )
            setTimeout(() => {
                logger.info(
                    `nyalakan relay, selesai menyiram selama ${wateringDurationInMs}`,
                )
                relayState = true
                client.publish(
                    `sprinkler/${client.options.clientId}/trigger`,
                    "AUTO.OFF",
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
    changeJob(
        sprinklerConfig.cronExpression!,
        sprinklerConfig.wateringDurationInMs!,
        client,
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

        client.subscribe("sprinkler/test/#", {
            qos: 1,
        })
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
                case "sprinkler/test/trigger":
                    switch (payload.toString()) {
                        case "MAN.ON":
                            autoState = true
                            logger.info("Siram manual diaktifkan.")
                            client.publish(
                                "sprinkler/test/status",
                                "WATERING.MAN",
                                {
                                    retain: true,
                                    qos: 1,
                                },
                            )
                            break
                        case "MAN.OFF":
                            autoState = false
                            logger.info("Siram manual dimatikan.")
                            client.publish("sprinkler/test/status", "ALIVE", {
                                retain: true,
                                qos: 1,
                            })
                            break
                        case "AUTO.ON":
                            logger.info("Siram otomatis diaktifkan")
                            client.publish(
                                "sprinkler/test/status",
                                "WATERING.AUTO",
                                {
                                    retain: true,
                                    qos: 1,
                                },
                            )
                            break
                        case "AUTO.OFF":
                            logger.info("Siram otomatis dimatikan")
                            client.publish("sprinkler/test/status", "ALIVE", {
                                retain: true,
                                qos: 1,
                            })
                            break
                    }
                    break
            }
        })

        setInterval(() => {
            client.publish(
                "sprinkler/test/sensors/temperature",
                Math.floor(Math.random() * 100).toString(),
            )
            client.publish(
                "sprinkler/test/sensors/humidity",
                Math.floor(Math.random() * 100).toString(),
            )
        }, 1000)
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
