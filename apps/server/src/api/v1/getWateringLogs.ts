import { Router, Request, Response } from "express"
import { httpLogger as logger } from "../../utils/logger"
import { Status } from "../../utils/response"
import db from "../../utils/database"

const getWateringLogs = Router()

getWateringLogs.get("/:deviceId", async (req: Request, res: Response) => {
    logger.debug(`${req.socket.remoteAddress} get ${req.params.deviceId} logs`)
    try {
        const wateringLogs = await db.getDeviceLogs(req.body.deviceId)
        if (wateringLogs.length === 0)
            return res.sendFormatted({
                statusCode: Status.NotFound,
                message: "Device not found or no logs yet.",
                data: wateringLogs,
            })
        res.sendFormatted({
            statusCode: Status.OK,
            message: "Successfully get device logs",
            data: wateringLogs,
        })
    } catch (dbErr) {
        return res.sendFormatted({
            statusCode: Status.InternalError,
            message: "Read operation failed.",
            data: null,
        })
    }
})

export default getWateringLogs

/**
 * @swagger
 * /api/v1/getWateringLogs/{deviceId}:
 *   get:
 *     summary: Retrieve watering logs for a specific device
 *     description: Fetch the watering logs for the specified device ID. If no logs are found, returns a message indicating so.
 *     tags:
 *       - Watering Management
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         description: Unique identifier of the watering device to retrieve logs for.
 *         schema:
 *           type: string
 *           example: device_123
 *     responses:
 *       200:
 *         description: Successfully retrieved device logs.
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
 *                   example: Successfully get device logs
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                         example: 1
 *                       deviceId:
 *                         type: string
 *                         example: device_123
 *                       wateringDurationInMs:
 *                         type: number
 *                         example: 5000
 *                       isEnabled:
 *                         type: boolean
 *                         example: true
 *                       isAutomated:
 *                         type: boolean
 *                         example: false
 *                       reason:
 *                         type: string
 *                         example: Manual trigger
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-01T12:00:00Z"
 *       400:
 *         description: Bad request - Missing deviceId parameter.
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
 *                   example: Bad Request! - Missing deviceId parameter.
 *                 data:
 *                   type: null
 *       404:
 *         description: Device not found or no logs available for the specified device.
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
 *                   example: Device not found or no logs yet.
 *                 data:
 *                   type: null
 *       500:
 *         description: Internal server error - Failed to retrieve the logs.
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
 *                   example: Read operation failed.
 *                 data:
 *                   type: null
 */
