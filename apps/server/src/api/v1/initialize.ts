import { Router, Request, Response } from "express"
import { httpLogger as logger } from "../../utils/logger"
import { Status } from "../../utils/response"
import { serverDatabase } from "../../utils/database"
import { auth } from "../../utils/auth"

interface InitializeRequest {
    brokerUsername: string
    brokerPassword: string
    apiUsername: string
    apiPassword: string
}

const initializeRouter: Router = Router()

initializeRouter.post(
    "/",
    async (req: Request<{}, {}, InitializeRequest>, res: Response) => {
        logger.debug("initializing")
        const isServerConfigured = await serverDatabase.checkIsConfigured()
        if (isServerConfigured)
            return res.sendFormatted({
                statusCode: Status.Forbidden,
                message: "Server already configured",
                data: null,
            })
        if (
            !req.body.brokerUsername ||
            !req.body.brokerPassword ||
            !req.body.apiPassword ||
            !req.body.brokerUsername
        )
            return res.sendFormatted({
                statusCode: Status.BadRequest,
                message: "Bad Request!",
                data: null,
            })

        await serverDatabase.configure({
            brokerUsername: req.body.brokerUsername,
            brokerPassword: auth.generatePassword(req.body.brokerPassword),
            apiUsername: req.body.apiUsername,
            apiPassword: auth.generatePassword(req.body.apiPassword),
        })

        logger.info("Server initialized")
        return res.sendFormatted({
            statusCode: Status.OK,
            message: "Server initialized",
            data: null,
        })
    },
)

export default initializeRouter
