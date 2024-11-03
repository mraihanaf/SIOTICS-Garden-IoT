import Aedes from "aedes"
import { WateringService } from "../utils/brokerService"
import { brokerLogger as logger } from "../utils/logger"
import { parseExpression } from "cron-parser"

// Mock dependencies
jest.mock("aedes")
jest.mock("../utils/logger")
jest.mock("cron-parser")

describe("WateringService", () => {
    let broker: jest.Mocked<Aedes>
    let wateringService: WateringService
    const deviceId = "test-device-123"

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks()

        // Create a new mocked broker instance
        // @ts-ignore
        broker = new (Aedes as jest.MockedClass<typeof Aedes>)()
        broker.publish = jest.fn().mockImplementation((packet, callback) => {
            callback(null)
            return null
        })

        // Create a new WateringService instance
        wateringService = new WateringService(broker, deviceId)
    })

    describe("setDurationInMs", () => {
        it("should publish duration message correctly", () => {
            const durationInMs = 5000

            wateringService.setDurationInMs(durationInMs).publish()

            expect(broker.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    topic: `esp/${deviceId}/watering/setDurationInMs`,
                    payload: durationInMs.toString(),
                    qos: 1,
                    cmd: "publish",
                    dup: false,
                    retain: false,
                }),
                expect.any(Function),
            )
        })

        it("should log error when publish fails", () => {
            const error = new Error("Publish failed")
            broker.publish = jest
                .fn()
                .mockImplementation((packet, callback) => {
                    callback(error)
                    return null
                })

            wateringService.setDurationInMs(5000).publish()

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("hosts cant publish"),
            )
            expect(logger.error).toHaveBeenCalledWith(error)
        })
    })

    describe("setCron", () => {
        beforeEach(() => {
            // Mock successful cron expression parsing
            ;(parseExpression as jest.Mock).mockImplementation(() => ({}))
        })

        it("should publish cron expression correctly", () => {
            const cronExpression = "* * * * *"

            wateringService.setCron(cronExpression).publish()

            expect(broker.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    topic: `esp/${deviceId}/watering/setCron`,
                    payload: cronExpression,
                    qos: 1,
                    cmd: "publish",
                    dup: false,
                    retain: false,
                }),
                expect.any(Function),
            )
        })

        it("should throw error for invalid cron expression", () => {
            // Mock cron parsing failure
            ;(parseExpression as jest.Mock).mockImplementation(() => {
                throw new Error("Invalid cron expression")
            })

            expect(() => {
                wateringService.setCron("invalid-cron")
            }).toThrow("Invalid Cron Expression")
        })

        it("should log error when publish fails", () => {
            const error = new Error("Publish failed")
            broker.publish = jest
                .fn()
                .mockImplementation((packet, callback) => {
                    callback(error)
                    return null
                })

            wateringService.setCron("* * * * *").publish()

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("hosts cant publish"),
            )
            expect(logger.error).toHaveBeenCalledWith(error)
        })
    })

    describe("Method Chaining", () => {
        it("should support method chaining for multiple operations", () => {
            const durationInMs = 5000
            const cronExpression = "* * * * *"

            wateringService
                .setDurationInMs(durationInMs)
                .setCron(cronExpression)
                .publish()

            expect(broker.publish).toHaveBeenCalledTimes(2)

            // Verify first call (setDurationInMs)
            expect(broker.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    topic: `esp/${deviceId}/watering/setDurationInMs`,
                    payload: durationInMs.toString(),
                }),
                expect.any(Function),
            )

            // Verify second call (setCron)
            expect(broker.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    topic: `esp/${deviceId}/watering/setCron`,
                    payload: cronExpression,
                }),
                expect.any(Function),
            )
        })
    })
})
