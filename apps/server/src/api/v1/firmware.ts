import { Router, Request, Response } from "express"
import { httpLogger as logger } from "../../utils/logger"
import { join } from "path"
import { existsSync } from "fs"
import { Status } from "../../utils/response"

const firmwareRouter: Router = Router()

firmwareRouter.get("/", async (req: Request, res: Response) => {
    logger.info("Sending firmware...")
    logger.info(__dirname)
    const firmwarePath = join(
        __dirname,
        "../../../../../esp32-firmware/.pio/build/esp32dev/firmware.bin",
    )
    if (!existsSync(firmwarePath))
        return res.sendFormatted({
            statusCode: Status.NotFound,
            message: "Firmware not found!",
            data: null,
        })
    res.sendFile(firmwarePath)
})

export default firmwareRouter
