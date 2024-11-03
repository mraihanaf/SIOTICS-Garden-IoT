import { clientValidator, TopicValidator } from "../utils/validator"
describe("topic validator", () => {
    const HOST_TOPICS = [
        /^esp\/.+\/watering\/setDuration$/,
        /^esp\/.+\/watering\/setCron$/,
        /^esp\/.+\/system\/ota$/,
        /^esp\/.+\/system\/restart$/,
    ]

    const CLIENT_TOPICS = [
        /^esp\/init$/,
        /^esp\/.+\/heartbeat$/,
        /^esp\/.+\/system\/logs$/,
        /^esp\/.+\/watering\/logs$/,
    ]
    const separator = "/"
    const topicValidator = new TopicValidator({
        host_topics: HOST_TOPICS,
        client_topics: CLIENT_TOPICS,
    })
    it("validate topics", () => {
        expect(topicValidator.isValidTopic("esp/init")).toBe(true)
        expect(
            topicValidator.isValidTopic("esp/test/watering/setDuration"),
        ).toBe(true)
        expect(topicValidator.isValidTopic("esp/invalidtopic")).toBe(false)
    })

    it("validate client topics", () => {
        expect(topicValidator.isClientTopic("esp/test/heartbeat")).toBe(true)
        expect(topicValidator.isClientTopic("esp/test/invalid")).toBe(false)
    })

    it("validate host topics", () => {
        expect(topicValidator.isHostTopic("esp/test/watering/setCron")).toBe(
            true,
        )
        expect(topicValidator.isHostTopic("esp/test/watering/invalid")).toBe(
            false,
        )
    })
})

describe("client validator", () => {
    it("validate isFromHost", () => {
        expect(clientValidator.isFromHost(null)).toBe(true)
    })
})
