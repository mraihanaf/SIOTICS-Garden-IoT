import { IParsedTopic } from "../types/topic"

const SEPARATOR = "/"
export class topicParser {
    static parseToArray(topic: string): string[] {
        return topic.split(SEPARATOR)
    }
    static parse(topic: string): IParsedTopic {
        const [prefix, deviceId, type, action] = topic.split(SEPARATOR)
        return {
            prefix,
            deviceId,
            type: type ? type : null,
            action: action ? action : null,
        }
    }
}
