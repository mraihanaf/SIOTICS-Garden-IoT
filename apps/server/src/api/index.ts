import { Router, Request, Response, json, ErrorRequestHandler } from "express"
import { responseBuilder, Status } from "../utils/response"
import { httpLogger as logger } from "../utils/logger"
import { serve, setup } from "swagger-ui-express"
import swagger from "./swagger"
import setWatering from "./v1/setWatering"
import triggerWatering from "./v1/triggerWatering"
import getConnectedDevicesIds from "./v1/getConnectedDeviceIds"
import rateLimit from "express-rate-limit"
import getRegisteredDevices from "./v1/getRegisteredDevices"
import initDeviceRouter from "./v1/initDevice"
import getWateringLogs from "./v1/getWateringLogs"

const router: Router = Router()
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100,
})
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    logger.error(err) // Tambahkan logging untuk debugging

    res.sendFormatted({
        statusCode: Status.InternalError,
        message: "Oops, Internal Error occurred!",
        data: null,
    })
}

router.use(responseBuilder)
router.use(limiter)
router.use("/docs", serve, setup(swagger))
router.use(json())
router.use("/v1/setwatering", setWatering)
router.use("/v1/triggerWatering", triggerWatering)
router.use("/v1/getConnectedDeviceIds", getConnectedDevicesIds)
router.use("/v1/getRegisteredDevices", getRegisteredDevices)
router.use("/v1/initDevice", initDeviceRouter)
router.use("/v1/getWateringLogs", getWateringLogs)

router.get("/v1", (req: Request, res: Response) => {
    logger.debug("someone just requested /api/v1")

    res.sendFormatted({
        statusCode: Status.OK,
        message: "nothing to see here :)",
        data: null,
    })
})

router.use(errorHandler) // DONT Change this code positition
export default router
