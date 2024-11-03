export interface WateringConfig {
    deviceId: string
    wateringDurationInMs: number
    cronExpression: string
}

export interface WateringLog {
    deviceId: string
    wateringDurationInMs: number
    isEnabled: boolean
    timestamp: string
}
