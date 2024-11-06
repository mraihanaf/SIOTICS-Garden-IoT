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
                statusCode: Status.OK,
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
