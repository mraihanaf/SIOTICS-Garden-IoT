import express, { Express, Request, Response } from "express"
import { httpLogger as logger } from "../utils/logger"
import router from "../api"
import { Status } from "../utils/response"
import { responseBuilder } from "../utils/response"
import { join } from "path"
const app: Express = express()
app.use(responseBuilder)

app.get("/", (req: Request, res: Response) => {
    logger.debug("Client requested /")
    res.status(Status.OK).sendFile(join(__dirname, "../public/index.html"))
})

app.use("/api", router)

export default app
