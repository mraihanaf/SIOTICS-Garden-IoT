import { Router, Request, Response } from "express"
import { httpLogger as logger } from "../../utils/logger"
import { Status } from "../../utils/response"
import { WateringService } from "../../utils/brokerService"
import database from "../../utils/database"
import broker from "../../service/broker"
import { cronValidator } from "../../utils/validator"
import { WateringConfig } from "../../types/database"

// Define request body interface
interface SetWateringRequest {
    deviceId: string
    wateringDurationInMs: number
    cronExpression: string
    username: string
    password: string
}

const setWateringRouter: Router = Router()

setWateringRouter.post(
    "/",
    async (req: Request<{}, {}, SetWateringRequest>, res: Response) => {
        // Validate required fields
        if (
            !req.body.cronExpression ||
            !req.body.deviceId ||
            !req.body.wateringDurationInMs ||
            !req.body.username ||
            !req.body.password
        ) {
            logger.info(`${req.ip} sends an invalid request on setWatering api`)
            return res.sendFormatted({
                statusCode: Status.BadRequest,
                message: "Bad Request! Missing required fields",
                data: null,
            })
        }

        try {
            // Validate cron expression
            if (!cronValidator.isCronExpression(req.body.cronExpression)) {
                return res.sendFormatted({
                    statusCode: Status.BadRequest,
                    message: "Invalid cron expression",
                    data: null,
                })
            }

            // Create config object
            const wateringConfig: WateringConfig = {
                deviceId: req.body.deviceId,
                wateringDurationInMs: req.body.wateringDurationInMs,
                cronExpression: req.body.cronExpression,
            }

            // Update database
            try {
                await database.upsertDeviceConfig(wateringConfig)
            } catch (dbError) {
                logger.error("Database error:", dbError)
                return res.sendFormatted({
                    statusCode: Status.InternalError,
                    message: "Database operation failed",
                    data: null,
                })
            }

            // Update broker service
            try {
                const publisher = new WateringService(broker, req.body.deviceId)
                await publisher
                    .setCron(req.body.cronExpression)
                    .setDurationInMs(req.body.wateringDurationInMs)
                    .publish()
            } catch (brokerError) {
                logger.error("Broker service error:", brokerError)
                return res.sendFormatted({
                    statusCode: Status.InternalError,
                    message: "Failed to update watering schedule",
                    data: null,
                })
            }
            logger.info(
                `${req.body.deviceId} updated config with setDurationInMs=${req.body.wateringDurationInMs} cronExpression=${req.body.cronExpression}`,
            )
            // Send success response
            return res.sendFormatted({
                statusCode: Status.OK,
                message: "Successfully setup device config",
                data: {
                    deviceId: req.body.deviceId,
                },
            })
        } catch (err) {
            logger.error("Unexpected error:", err)
            return res.sendFormatted({
                statusCode: Status.InternalError,
                message: "Oops, internal error occurred",
                data: null,
            })
        }
    },
)

export default setWateringRouter
