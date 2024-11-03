import { Router, Request, Response, json } from "express"
import { responseBuilder, Status } from "../utils/response"
import { httpLogger as logger } from "../utils/logger"
import setWatering from "./v1/setWatering"
import rateLimit from "express-rate-limit"
const router: Router = Router()
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100,
})

router.use(responseBuilder)
router.use(limiter)
router.use(json())
router.use("/v1/setwatering", setWatering)
router.get("/v1", (req: Request, res: Response) => {
    logger.debug("someone just requested /api/v1")

    res.sendFormatted({
        statusCode: Status.OK,
        message: "nothing to see here :)",
        data: null,
    })
})

export default router
