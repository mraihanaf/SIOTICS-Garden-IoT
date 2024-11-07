import { Router, Request, Response } from "express"
import { Status } from "../../utils/response"
import { apiAuth } from "../../utils/apiAuth"
import { DEVICE_DEFAULT, CONNECTED } from "../../service/broker"
import { httpLogger as logger } from "../../utils/logger"
import db from "../../utils/database"

const initDeviceRouter: Router = Router()
initDeviceRouter.post("/", (req: Request, res: Response) => {
    if (!req.body.deviceId || !req.body.username || !req.body.password)
        return res.sendFormatted({
            statusCode: Status.BadRequest,
            message: "Bad Request!",
            data: null,
        })
    if (!apiAuth.authenticate(req.body.username, req.body.password))
        return res.sendFormatted({
            statusCode: Status.Forbidden,
            message: "Invalid username or password.",
            data: null,
        })
    if (!CONNECTED.DEVICES.has(req.body.deviceId))
        return res.sendFormatted({
            statusCode: Status.NotFound,
            message: `Cant find the connected device. (Device not connected)`,
            data: null,
        })
    try {
        const config = {
            deviceId: req.body.deviceId,
            wateringDurationInMs: DEVICE_DEFAULT.durationInMs,
            cronExpression: DEVICE_DEFAULT.cronExpression,
        }
        db.upsertDeviceConfig(config)
        res.sendFormatted({
            statusCode: Status.OK,
            message: "Successfully initialize the device",
            data: config,
        })
    } catch (dbErr) {
        logger.error(dbErr)
        res.sendFormatted({
            statusCode: Status.InternalError,
            message: "Write operation failed.",
            data: null,
        })
    }
})

export default initDeviceRouter

/**
 * @swagger
 * /api/v1/initDevice:
 *   post:
 *     summary: Initialize a device
 *     description: Initializes a new device by setting default configuration (watering duration and cron expression). The device must be connected, and the user must provide valid authentication credentials.
 *     tags:
 *       - Device Management
 *     security:
 *       - basicAuth: []  # Specifies that basic authentication is required
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - username
 *               - password
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Unique identifier for the device to initialize.
 *                 example: "device_123"
 *               username:
 *                 type: string
 *                 description: Username for authentication.
 *                 example: "user123"
 *               password:
 *                 type: string
 *                 description: Password for authentication.
 *                 format: password
 *                 example: "********"
 *     responses:
 *       200:
 *         description: Device initialized successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: number
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Successfully initialize the device"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deviceId:
 *                       type: string
 *                       example: "device_123"
 *                     wateringDurationInMs:
 *                       type: number
 *                       example: 30000
 *                     cronExpression:
 *                       type: string
 *                       example: "0 0 * * *"
 *       400:
 *         description: Bad request - Missing required fields or invalid input.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: number
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "Bad Request!"
 *                 data:
 *                   type: null
 *       403:
 *         description: Forbidden - Invalid username or password.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: number
 *                   example: 403
 *                 message:
 *                   type: string
 *                   example: "Invalid username or password."
 *                 data:
 *                   type: null
 *       404:
 *         description: Device not connected - Unable to find the device.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: number
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: "Can't find the connected device. (Device not connected)"
 *                 data:
 *                   type: null
 *       500:
 *         description: Internal server error - Database or server failure.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: number
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "Write operation failed."
 *                 data:
 *                   type: null
 */
