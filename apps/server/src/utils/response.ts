import { NextFunction, Request, Response } from "express"
import { IResponseData } from "../types/response"

declare module "express-serve-static-core" {
    interface Response {
        sendFormatted: (responseData: IResponseData) => void
    }
}

export function responseBuilder(
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    res.sendFormatted = (responseData: IResponseData) => {
        res.status(responseData.statusCode).json({
            statusCode: responseData.statusCode,
            message: responseData.message,
            data: responseData.data,
        })
    }
    next()
}

export enum Status {
    OK = 200,
    Created = 202,
    NotFound = 404,
    BadRequest = 400,
    TooManyRequest = 429,
    InternalError = 500,
}
