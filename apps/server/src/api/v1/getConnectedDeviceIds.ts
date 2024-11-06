import { Router, Request, Response } from "express"
import { httpLogger as logger } from "../../utils/logger"
import { Status } from "../../utils/response"
import { CONNECTED } from "../../service/broker"

const getConnectedDevicesIds = Router()

getConnectedDevicesIds.get("/", (req: Request, res: Response) => {
    logger.info(`${req.socket.remoteAddress} get Connected Device Ids`)
    res.sendFormatted({
        statusCode: Status.OK,
        message: "Succesfully get the connected device ids",
        data: Array.from(CONNECTED.DEVICES),
    })
})

export default getConnectedDevicesIds

/**
 * @swagger
 * /api/v1/getConnectedDevicesIds:
 *   get:
 *     summary: Retrieve the list of connected device IDs
 *     description: Fetches the IDs of all currently connected devices in the system.
 *                  The list contains device identifiers for devices that are actively connected to the system.
 *     tags:
 *       - Device Management
 *     responses:
 *       200:
 *         description: Successfully retrieved the connected device IDs.
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
 *                   example: "Successfully get the connected device ids"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                     example: "device_123"
 *       500:
 *         description: Internal server error - failed to retrieve connected devices.
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
 *                   example: "Failed to retrieve connected device IDs"
 *                 data:
 *                   type: null
 */
