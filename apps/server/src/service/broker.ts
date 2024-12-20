import Aedes, { AuthenticateError, AuthErrorCode, Client } from "aedes"
import { aedesPersistenceLevel, serverDatabase } from "../utils/database"
import { brokerAuth } from "../utils/auth"
import { brokerLogger as logger } from "../utils/logger"
import { clientValidator } from "../utils/validator"
import { config } from "dotenv"
import { IPublishPacket } from "mqtt"
import { ISprinklerConfig } from "../types"
import { topicParser } from "../utils/parser"
import {
    SprinklerService,
    SprinklerStatus,
    statusPublisher,
    triggerSprinklerPublisher,
} from "../utils/sprinklerBuilder"

config()
/* garden/#
     sprinkler/{deviceId}/status (retained)
     sprinkler/${deviceId}/
     sprinkler/{deviceId}/config/cron (retained)
     sprinkler/{deviceId}/config/duration (retained)
     sprinkler/{deviceId}/trigger (retained)
     sprinkler/{deviceId}/logs
     sprinkler/{deviceId}/system/ota
     sprinkler/{deviceId}/system/logs
 */

const onlineConfiguredClientIds: Set<string> = new Set()

const broker: Aedes = new Aedes({
    persistence: aedesPersistenceLevel,
})

broker.on("client", (client: Client) => {
    if (clientValidator.isWebsocketClient(client)) {
        logger.info(`websocket client with id ${client.id} connected`)
    } else {
        logger.info(`thing client with id ${client.id} connected`)
    }
})

class AuthError extends Error implements AuthenticateError {
    returnCode: number

    constructor(message: string, returnCode: number) {
        super(message)
        this.returnCode = returnCode
    }
}

broker.authenticate = async function (client, username, password, callback) {
    const isServerConfigured = await serverDatabase.checkIsConfigured()
    if (!isServerConfigured)
        return callback(
            new AuthError(
                "Server not initialized",
                AuthErrorCode.SERVER_UNAVAILABLE,
            ),
            false,
        )
    if (clientValidator.isWebsocketClient(client)) return callback(null, true)
    if (!brokerAuth.authenticate(username?.toString()!, password?.toString()!))
        return callback(
            new AuthError(
                "wrong username or password",
                AuthErrorCode.BAD_USERNAME_OR_PASSWORD,
            ),
            false,
        )
    return callback(null, true)
}

broker.authorizePublish = function (client: Client | null, packet, callback) {
    // if (clientValidator.isWebsocketClient(client))
    //     return callback(new Error("websocket client not allowed to publish"))
    return callback()
}

broker.on("clientDisconnect", async (client: Client) => {
    if (clientValidator.isWebsocketClient(client)) return
    const sprinkler = new SprinklerService(client.id)
    if (onlineConfiguredClientIds.has(client.id)) {
        sprinkler
            .clearRetainedMessage([triggerSprinklerPublisher.topic])
            .updateLastseen()
            .publish()
        onlineConfiguredClientIds.delete(client.id)
    } else {
        sprinkler.clearRetainedMessage([statusPublisher.topic])
    }
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

        const topic = topicParser.parse(packet.topic)
        switch (topic.type) {
            case "trigger":
                logger.info(`${client.id} sprinkler turned ${packet.payload}`)
                break
            case "config":
                logger.info(
                    `${client.id} ${topic.action} config set to ${packet.payload.toString()}`,
                )
                if (topic.action !== "duration" && topic.action !== "cron")
                    return
                topic.action as ISprinklerConfig
                break
            case "status":
                logger.info(
                    `${client.id} ${topic.type} set to ${packet.payload.toString()}`,
                )
                if (packet.payload.toString() === SprinklerStatus.ALIVE)
                    return onlineConfiguredClientIds.add(client.id)
        }
    }
}
