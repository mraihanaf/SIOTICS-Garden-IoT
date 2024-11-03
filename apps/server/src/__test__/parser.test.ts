import { topicParser } from "../utils/parser"
import { IParsedTopic } from "../types/topic"

describe("topicParser", () => {
    describe("parseToArray", () => {
        it("should split topic string into array", () => {
            const topic = "esp/device123/watering/start"
            const result = topicParser.parseToArray(topic)
            expect(result).toEqual(["esp", "device123", "watering", "start"])
        })

        it("should handle empty string", () => {
            const topic = ""
            const result = topicParser.parseToArray(topic)
            expect(result).toEqual([""])
        })
    })

    describe("parse", () => {
        it("should parse complete topic string", () => {
            const topic = "esp/device123/watering/start"
            const expected: IParsedTopic = {
                prefix: "esp",
                deviceId: "device123",
                type: "watering",
                action: "start",
            }
            const result = topicParser.parse(topic)
            expect(result).toEqual(expected)
        })

        it("should parse topic without action", () => {
            const topic = "esp/device123/watering"
            const expected: IParsedTopic = {
                prefix: "esp",
                deviceId: "device123",
                type: "watering",
                action: null,
            }
            const result = topicParser.parse(topic)
            expect(result).toEqual(expected)
        })

        it("should parse topic without type and action", () => {
            const topic = "esp/device123"
            const expected: IParsedTopic = {
                prefix: "esp",
                deviceId: "device123",
                type: null,
                action: null,
            }
            const result = topicParser.parse(topic)
            expect(result).toEqual(expected)
        })
    })
})
