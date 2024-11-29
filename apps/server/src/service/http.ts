import express, { Express, Request, Response, NextFunction } from "express"
import { httpLogger as logger } from "../utils/logger"
import router from "../api"
import { responseBuilder } from "../utils/response"
import { join } from "path"
import cors from "cors"
import { serverDatabase } from "../utils/database"
const app: Express = express()
app.use(
    cors({
        origin: "*",
    }),
)
app.use(responseBuilder)
app.use("/api", router)
app.use("/", async (req: Request, res: Response, next: NextFunction) => {
    const isConfigured = await serverDatabase.checkIsConfigured()
    const handler = isConfigured
        ? express.static(join(__dirname, "../public"))
        : express.static(join(__dirname, "../public/initialize"))
    handler(req, res, next)
})

export default app
