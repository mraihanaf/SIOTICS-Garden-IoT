export interface IServerInitConfig {
    brokerUsername: string
    brokerPassword: string // sha-512 hash (password:salt)
    apiUsername: string
    apiPassword: string // sha-512 hash (password:salt)
}

export type ISprinklerConfig = "duration" | "cron"
