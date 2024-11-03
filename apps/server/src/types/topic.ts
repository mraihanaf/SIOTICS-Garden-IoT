export interface IParsedTopic {
    prefix: string
    deviceId: string | "init"
    type: string | null
    action: string | null
}
