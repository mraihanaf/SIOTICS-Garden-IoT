// import { Router, Request, Response } from "express"
// import { httpLogger as logger } from "../../utils/logger"
// import { Status } from "../../utils/response"
// import { WateringService } from "../../utils/sprinklerBuilder"
// import database from "../../utils/database"
// import broker, { CONNECTED } from "../../service/broker"
// import { cronValidator } from "../../utils/validator"
// import { WateringConfig } from "../../types/database"
// import { apiAuth } from "../../utils/apiAuth"

// // Define request body interface
// interface SetWateringRequest {
//     deviceId: string
//     wateringDurationInMs: number
//     cronExpression: string
//     username: string
//     password: string
// }

// const setWateringRouter: Router = Router()

// setWateringRouter.post(
//     "/",
//     async (req: Request<{}, {}, SetWateringRequest>, res: Response) => {
//         // Validate required fields
//         if (
//             !req.body.cronExpression ||
//             !req.body.deviceId ||
//             !req.body.wateringDurationInMs ||
//             !req.body.username ||
//             !req.body.password
//         ) {
//             logger.info(`${req.ip} sends an invalid request on setWatering api`)
//             return res.sendFormatted({
//                 statusCode: Status.BadRequest,
//                 message: "Bad Request!",
//                 data: null,
//             })
//         }

//         if (!apiAuth.authenticate(req.body.username, req.body.password))
//             return res.sendFormatted({
//                 statusCode: Status.Forbidden,
//                 message: "Invalid username or password.",
//                 data: null,
//             })

//         try {
//             // Validate cron expression
//             if (!cronValidator.isCronExpression(req.body.cronExpression)) {
//                 return res.sendFormatted({
//                     statusCode: Status.BadRequest,
//                     message: "Invalid cron expression",
//                     data: null,
//                 })
//             }

//             // Create config object
//             const wateringConfig: WateringConfig = {
//                 deviceId: req.body.deviceId,
//                 wateringDurationInMs: req.body.wateringDurationInMs,
//                 cronExpression: req.body.cronExpression,
//             }

//             // Update database
//             try {
//                 const isDeviceExist = await database.getDeviceConfig(
//                     req.body.deviceId,
//                 )
//                 if (!isDeviceExist)
//                     return res.sendFormatted({
//                         statusCode: Status.NotFound,
//                         message:
//                             "Device not found. hint: please init the device first",
//                         data: null,
//                     })
//                 await database.upsertDeviceConfig(wateringConfig)
//             } catch (dbError) {
//                 logger.error("Database error:", dbError)
//                 return res.sendFormatted({
//                     statusCode: Status.InternalError,
//                     message: "Database operation failed",
//                     data: null,
//                 })
//             }

//             // Update broker service
//             try {
//                 const publisher = new WateringService(broker, req.body.deviceId)
//                 await publisher
//                     .setCron(req.body.cronExpression)
//                     .setDurationInMs(req.body.wateringDurationInMs)
//                     .publish()
//             } catch (brokerError) {
//                 logger.error("Broker service error:", brokerError)
//                 return res.sendFormatted({
//                     statusCode: Status.InternalError,
//                     message: "Failed to update watering config",
//                     data: null,
//                 })
//             }
//             logger.info(
//                 `${req.body.deviceId} updated config with setDurationInMs=${req.body.wateringDurationInMs} cronExpression=${req.body.cronExpression}`,
//             )
//             // Send success response
//             return res.sendFormatted({
//                 statusCode: Status.OK,
//                 message: "Successfully setup device config",
//                 data: {
//                     deviceId: req.body.deviceId,
//                 },
//             })
//         } catch (err) {
//             logger.error("Unexpected error:", err)
//             return res.sendFormatted({
//                 statusCode: Status.InternalError,
//                 message: "Oops, internal error occurred",
//                 data: null,
//             })
//         }
//     },
// )

// export default setWateringRouter

// /**
//  * @swagger
//  * /api/v1/setWatering:
//  *   post:
//  *     summary: Configure watering schedule for a device
//  *     description: Sets up or updates the watering configuration for a specific device, including watering duration and schedule.
//  *                  The endpoint validates the cron expression and updates both the database and the broker service.
//  *     tags:
//  *       - Watering Management
//  *     security:
//  *       - basicAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - deviceId
//  *               - wateringDurationInMs
//  *               - cronExpression
//  *               - username
//  *               - password
//  *             properties:
//  *               deviceId:
//  *                 type: string
//  *                 description: Unique identifier for the device.
//  *                 example: "device_123"
//  *               wateringDurationInMs:
//  *                 type: number
//  *                 description: Duration for watering in milliseconds.
//  *                 example: 30000
//  *               cronExpression:
//  *                 type: string
//  *                 description: Cron expression for scheduling the watering task (in standard cron format).
//  *                 example: "0 0 * * *"
//  *               username:
//  *                 type: string
//  *                 description: Authentication username.
//  *                 example: "user123"
//  *               password:
//  *                 type: string
//  *                 description: Authentication password (formatted as a password).
//  *                 example: "********"
//  *     responses:
//  *       200:
//  *         description: Watering configuration successfully updated.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 statusCode:
//  *                   type: number
//  *                   example: 200
//  *                 message:
//  *                   type: string
//  *                   example: "Successfully setup device config"
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     deviceId:
//  *                       type: string
//  *                       example: "device_123"
//  *       400:
//  *         description: Bad request - Missing required fields or invalid cron expression.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 statusCode:
//  *                   type: number
//  *                   example: 400
//  *                 message:
//  *                   type: string
//  *                   example: "Bad Request!"
//  *                 data:
//  *                   type: null
//  *       403:
//  *         description: Forbidden - Invalid username or password.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 statusCode:
//  *                   type: number
//  *                   example: 403
//  *                 message:
//  *                   type: string
//  *                   example: "Invalid username or password."
//  *                 data:
//  *                   type: null
//  *       404:
//  *         description: Device not found or initialization required.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 statusCode:
//  *                   type: number
//  *                   example: 404
//  *                 message:
//  *                   type: string
//  *                   example: "Device not found. Hint: Please initialize the device first."
//  *                 data:
//  *                   type: null
//  *       500:
//  *         description: Internal server error - database or broker service failure.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 statusCode:
//  *                   type: number
//  *                   example: 500
//  *                 message:
//  *                   type: string
//  *                   example: "Oops, internal error occurred"
//  *                 data:
//  *                   type: null
//  */
