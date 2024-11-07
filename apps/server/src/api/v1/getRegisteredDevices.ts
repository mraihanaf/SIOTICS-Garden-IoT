import { Router, Request, Response } from "express"
import { httpLogger as logger } from "../../utils/logger"
import { Status } from "../../utils/response"
import db from "../../utils/database"

const getRegisteredDevices = Router()

getRegisteredDevices.get("/", async (req: Request, res: Response) => {
    logger.info(`${req.socket.remoteAddress} get Devices config`)
    try {
        const devices = await db.getDevices()
        return res.sendFormatted({
            statusCode: 200,
            message: "Successfully get the devices config",
            data: devices,
        })
    } catch (err) {
        logger.error(err)
        res.sendFormatted({
            statusCode: Status.InternalError,
            message: "Read operation failed.",
            data: null,
        })
    }
})

export default getRegisteredDevices

/**
 * @swagger
 * /api/v1/getRegisteredDevices:
 *   get:
 *     summary: Retrieve the list of registered devices
 *     description: Fetches the configuration of all devices that are registered in the system. This includes the devices' settings such as watering duration, cron expression, and other device-related information.
 *     tags:
 *       - Device Management
 *     responses:
 *       200:
 *         description: Successfully fetched the devices' configurations.
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
 *                   example: "Successfully fetched the devices' config"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       deviceId:
 *                         type: string
 *                         example: "device_123"
 *                       wateringDurationInMs:
 *                         type: number
 *                         example: 30000
 *                       cronExpression:
 *                         type: string
 *                         example: "0 0 * * *"
 *       500:
 *         description: Internal server error - Failed to retrieve devices' configurations.
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
 *                   example: "Read operation failed."
 *                 data:
 *                   type: null
 */
