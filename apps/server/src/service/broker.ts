import Aedes, { Client, AuthenticateError, AuthErrorCode } from "aedes"
import { config } from "dotenv"
import { brokerLogger as logger } from "../utils/logger"
import { IPublishPacket } from "mqtt"
import { WateringService } from "../utils/brokerService"
import { TopicValidator, clientValidator } from "../utils/validator"
import { topicParser } from "../utils/parser"
import db from "../utils/database"

config()

export const DEVICE_DEFAULT = {
    durationInMs: 1000 * 5 * 60, // 5 mins
    cronExpression: "0 */6 * * *", // At minute 0 past every 6th hour
}

const SEPARATOR = "/"

const HOST_TOPICS = [
    /^esp\/.+\/watering\/setDuration$/,
    /^esp\/.+\/watering\/setCron$/,
    /^esp\/.+\/system\/ota$/,
    /^esp\/.+\/system\/restart$/,
    /^esp\/.+\/watering\/trigger$/,
]

const CLIENT_TOPICS = [
    /^esp\/init$/,
    /^esp\/.+\/heartbeat$/,
    /^esp\/.+\/system\/logs$/,
    /^esp\/.+\/watering\/logs$/,
    /^esp\/.+\/watering\/trigger$/,
]

/*
     esp/init -> payload: deviceId
     esp/deviceId/heartbeat -> payload: idle|watering/rain_status(true-false)/cron_exp/watering_duration_in_ms
     esp/deviceId/watering/setCron -> payload: cronExp
  (host)   esp/deviceId/watering/setDuration -> payload: watering_duration_in_ms
  (host)  esp/deviceId/watering/logs -> payload: watering_status(true/false)/rain_status(true/false)
     esp/deviceId/system/logs -> any
 */

export const CONNECTED = {
    CLIENTS: new Set(),
    DEVICES: new Set(),
}

const broker: Aedes = new Aedes()
const topicValidator = new TopicValidator({
    host_topics: HOST_TOPICS,
    client_topics: CLIENT_TOPICS,
})

broker.on("client", (client: Client) => {
    logger.info(`A new client with id ${client.id} connected.`)
})

class AuthError extends Error implements AuthenticateError {
    returnCode: number

    constructor(message: string, returnCode: number) {
        super(message)
        this.returnCode = returnCode
    }
}

broker.authenticate = function (client, _username, _password, callback) {
    if (CONNECTED.CLIENTS.has(client?.id))
        return callback(
            new AuthError(
                "clientId already connected",
                AuthErrorCode.IDENTIFIER_REJECTED,
            ),
            false,
        )
    if (!clientValidator.isWebsocketClient(client)) {
        CONNECTED.DEVICES.add(client?.id)
    }
    CONNECTED.CLIENTS.add(client?.id)
    return callback(null, true)
}

broker.authorizePublish = function (client: Client | null, packet, callback) {
    if (clientValidator.isWebsocketClient(client)) {
        logger.warn(
            `websocket client ${client?.req?.socket.remoteAddress} trying to publish message but rejected`,
        )
        return callback(new Error("websocket not allowed"))
    }
    if (!topicValidator.isValidTopic(packet.topic)) {
        logger.warn("invalid topic " + packet.topic + " from " + client?.id)
        return callback(new Error("invalid topic"))
    }

    if (
        topicValidator.isHostTopic(packet.topic) &&
        clientValidator.isFromClient(client)
    ) {
        logger.warn(`client ${client?.id} trying to send a host publish packet`)
        return callback(new Error("invalid client"))
    }
    const parsedTopic = topicParser.parse(packet.topic)
    if (parsedTopic.deviceId === "init") {
        if (client?.id !== packet.payload.toString()) {
            logger.warn(`clientId missmatch! from client ${client?.id}`)
            return new Error("cliendId missmatch!")
        }
        return callback(null)
    }
    if (parsedTopic.deviceId !== client?.id)
        return callback(new Error("invalid client"))
    return callback(null)
}

broker.on("clientDisconnect", (client: Client) => {
    CONNECTED.CLIENTS.delete(client?.id)
    CONNECTED.DEVICES.delete(client?.id)
})

broker.on("publish", async (packet, client) => {
    if (clientValidator.isFromHost(client))
        return await publishPacketHandler.handleHostPublishPacket(packet)
    await publishPacketHandler.handleClientPublishPacket(packet, client!)
})

export default broker

export class publishPacketHandler {
    public static async handleHostPublishPacket(
        packet: IPublishPacket,
    ): Promise<void> {
        logger.debug(
            `${packet.topic} from host with payload=${packet.payload.toString()}`,
        )
    }

    public static async handleClientPublishPacket(
        packet: IPublishPacket,
        client: Client,
    ) {
        logger.debug(
            `${packet.topic} from ${client.id} with payload=${packet.payload.toString()}`,
        )
        if (packet.topic === "esp/init")
            return this.handleClientInitPublishPacket(packet)
        const parsedTopic = topicParser.parse(packet.topic)
        if (parsedTopic.action === "trigger") {
            logger.info(
                `got publish trigger packet from ${client.id} to ${parsedTopic.deviceId}`,
            )
        }
    }

    private static async handleClientInitPublishPacket(packet: IPublishPacket) {
        const wateringService = new WateringService(
            broker,
            packet.payload.toString(),
        )
        let deviceData = await db.getDeviceConfig(packet.payload.toString())
        if (!deviceData) {
            deviceData = {
                deviceId: packet.payload.toString(),
                wateringDurationInMs: DEVICE_DEFAULT.durationInMs,
                cronExpression: DEVICE_DEFAULT.cronExpression,
            }
        }
        wateringService
            .setCron(deviceData.cronExpression)
            .setDurationInMs(deviceData.wateringDurationInMs)
            .publish()
        logger.info(`initialized client ${packet.payload.toString()}`)
    }
}
