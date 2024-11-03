import { IPublishPacket } from "mqtt"
import { ITopicValidatorConfig } from "../types/validator"
import { Client } from "aedes"
import { parseExpression } from "cron-parser"

export class TopicValidator {
    constructor(private config: ITopicValidatorConfig) {}
    public isValidTopic(topic: IPublishPacket["topic"]): boolean {
        return this.isHostTopic(topic) || this.isClientTopic(topic)
    }

    public isHostTopic(topic: IPublishPacket["topic"]): boolean {
        return this.config.host_topics.some((regex) => regex.test(topic))
    }

    public isClientTopic(topic: IPublishPacket["topic"]): boolean {
        return this.config.client_topics.some((regex) => regex.test(topic))
    }
}

export class clientValidator {
    public static isFromHost(client: Client | null): boolean {
        return client === null
    }

    public static isFromClient(client: Client | null): boolean {
        return !this.isFromHost(client)
    }
}

export class cronValidator {
    public static isCronExpression(cronExpression: string): boolean {
        let isCronExpression = false
        try {
            parseExpression(cronExpression)
            isCronExpression = true
        } catch {}

        return isCronExpression
    }
}
