import { Router, Request, Response, json, ErrorRequestHandler } from "express"
import { responseBuilder, Status } from "../utils/response"
import { httpLogger as logger } from "../utils/logger"
import { serve, setup } from "swagger-ui-express"
import swagger from "./swagger"
import rateLimit from "express-rate-limit"
import { config } from "dotenv"
import initializeRouter from "./v1/initialize"

config()
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
if (process.env.NODE_ENV === "development")
    router.use("/docs", serve, setup(swagger))
router.use(json())

router.use("/v1/initialize", initializeRouter)

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
