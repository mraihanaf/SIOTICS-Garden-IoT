export interface WateringConfig {
    deviceId: string
    wateringDurationInMs: number
    cronExpression: string
}

export interface WateringConfigWithLastseen extends WateringConfig {
    lastSeen: string | null
}
export interface WateringLog {
    deviceId: string
    wateringDurationInMs: number | null
    isEnabled: boolean
    isAutomated: boolean
    reason: string | null
    timestamp: string
}
