import { Router, Request, Response } from "express"
import { httpLogger as logger } from "../../utils/logger"
import broker, { CONNECTED } from "../../service/broker"
import { Status } from "../../utils/response"
import { WateringService } from "../../utils/brokerService"
import db from "../../utils/database"
import { apiAuth } from "../../utils/apiAuth"

const triggerWateringRouter: Router = Router()
triggerWateringRouter.post("/", (req: Request, res: Response) => {
    if (
        !req.body.deviceId ||
        !req.body.action ||
        !req.body.username ||
        !req.body.password
    )
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

    const deviceId: string = req.body.deviceId
    const action: "on" | "off" = req.body.action

    if (action !== "on" && action !== "off")
        return res.sendFormatted({
            statusCode: Status.BadRequest,
            message: "Bad Request!",
            data: null,
        })

    if (!CONNECTED.CLIENTS.has(deviceId))
        return res.sendFormatted({
            statusCode: Status.NotFound,
            message: "Device inactive or not found.",
            data: null,
        })

    const wateringService = new WateringService(broker, deviceId)
    wateringService.trigger(action).publish()

    db.addLog({
        deviceId: deviceId,
        wateringDurationInMs: null,
        isEnabled: action === "on" ? true : false,
        isAutomated: false,
        reason: null,
        timestamp: new Date().toISOString(),
    })

    logger.info(`${req.socket.remoteAddress} turning ${action} ${deviceId}`)
    res.sendFormatted({
        statusCode: Status.OK,
        message: "Successfully trigger device",
        data: null,
    })
})

export default triggerWateringRouter

/**
 * @swagger
 * /api/v1/triggerWatering:
 *   post:
 *     summary: Trigger watering device on/off
 *     description: Immediately turns a watering device on or off based on the specified action. Requires valid authentication and checks if the device is active before triggering the action.
 *     tags:
 *       - Watering Management
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - action
 *               - username
 *               - password
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Unique identifier for the watering device.
 *                 example: "device_123"
 *               action:
 *                 type: string
 *                 description: The action to perform on the device (turn it "on" or "off").
 *                 enum:
 *                   - "on"
 *                   - "off"
 *                 example: "on"
 *               username:
 *                 type: string
 *                 description: Username for API authentication.
 *                 example: "user123"
 *               password:
 *                 type: string
 *                 description: Password for API authentication.
 *                 example: "pass123"
 *     responses:
 *       200:
 *         description: Device triggered successfully.
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
 *                   example: "Successfully triggered device"
 *                 data:
 *                   type: null
 *       400:
 *         description: Bad request - Missing required fields or invalid action (action must be "on" or "off").
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
 *                   example: "Bad Request! - Invalid or missing parameters."
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
 *         description: Device not found or inactive.
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
 *                   example: "Device inactive or not found."
 *                 data:
 *                   type: null
 */
