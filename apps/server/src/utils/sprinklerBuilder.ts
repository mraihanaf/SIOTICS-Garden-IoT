import Aedes from "aedes"
import broker from "../service/broker"
import { brokerLogger as logger } from "./logger"
import { cronValidator } from "./validator"

abstract class Publisher {
    abstract execute(broker: Aedes): void
    static readonly topic: string
}

interface ISprinklerPublishConfig {
    action: string
    deviceId: string
    payload: Buffer | string
    retain: boolean
}

abstract class SprinklerPublisher implements Publisher {
    static readonly topic: string
    constructor(protected deviceId: string) {
        this.deviceId = deviceId
    }

    public abstract execute(broker: Aedes): void

    private handleError(error: unknown, topic: string) {
        if (error) {
            logger.error(`hosts cant publish ${topic}`)
            logger.error(error)
        }
    }

    public publish(config: ISprinklerPublishConfig): void {
        const prefix = `sprinkler/${this.deviceId}`
        const topic = `${prefix}/${config.action}`
        broker.publish(
            {
                topic: topic,
                qos: 1,
                payload: config.payload,
                cmd: "publish",
                dup: false,
                retain: config.retain,
            },
            (error) => {
                this.handleError(error, topic)
            },
        )
    }
}

export class SetDuration extends SprinklerPublisher {
    static readonly topic = "config/duration"
    constructor(
        protected deviceId: string,
        private durationInMs: number,
        private retain: boolean = true,
    ) {
        super(deviceId)
    }
    public execute(broker: Aedes) {
        this.publish({
            action: SetDuration.topic,
            deviceId: this.deviceId,
            payload: this.durationInMs.toString(),
            retain: this.retain,
        })
    }
}

export class SetWateringCronPublisher extends SprinklerPublisher {
    static readonly topic = "config/cron"
    constructor(
        protected deviceId: string,
        private cronExpression: string,
        private retain: boolean = true,
    ) {
        super(deviceId)
        if (!cronValidator.isCronExpression(this.cronExpression))
            throw new Error("Invalid Cron Expression")
    }

    public execute(broker: Aedes): void {
        this.publish({
            deviceId: this.deviceId,
            action: SetWateringCronPublisher.topic,
            payload: this.cronExpression,
            retain: this.retain,
        })
    }
}

export class triggerSprinklerPublisher extends SprinklerPublisher {
    static readonly topic = "trigger"
    constructor(
        protected deviceId: string,
        private state: "ON" | "OFF",
        private retain: boolean = true,
    ) {
        super(deviceId)
    }

    public execute(): void {
        this.publish({
            deviceId: this.deviceId,
            action: triggerSprinklerPublisher.topic,
            payload: this.state,
            retain: this.retain,
        })
    }
}

export class lastSeenPublisher extends SprinklerPublisher {
    static readonly topic = "status/lastseen"
    constructor(protected deviceId: string) {
        super(deviceId)
    }

    public execute(): void {
        this.publish({
            deviceId: this.deviceId,
            action: lastSeenPublisher.topic,
            retain: true,
            payload: new Date().getTime().toString(),
        })
    }
}

export enum SprinklerStatus {
    ALIVE = "ALIVE",
    DEAD = "DEAD",
    INIT = "INIT",
}

export class statusPublisher extends SprinklerPublisher {
    static readonly topic = "status"
    constructor(
        deviceId: string,
        private status: SprinklerStatus,
    ) {
        super(deviceId)
    }

    public execute(): void {
        this.publish({
            deviceId: this.deviceId,
            action: statusPublisher.topic,
            payload: this.status,
            retain: true,
        })
    }
}

abstract class Service {
    abstract publish(): void
}

export class SprinklerService extends Service {
    private publishers: Publisher[] = []

    constructor(private deviceId: string) {
        super()
    }

    public setDuration(durationInMs: number) {
        this.publishers.push(new SetDuration(this.deviceId, durationInMs, true))
        return this
    }

    public setCron(cronExpression: string) {
        this.publishers.push(
            new SetWateringCronPublisher(this.deviceId, cronExpression),
        )
        return this
    }

    public setTrigger(state: "ON" | "OFF") {
        this.publishers.push(
            new triggerSprinklerPublisher(this.deviceId, state),
        )
        return this
    }

    public updateLastseen() {
        this.publishers.push(new lastSeenPublisher(this.deviceId))
        return this
    }

    public clearRetainedMessage(topics: string[]) {
        topics.forEach((topic) => {
            broker.publish(
                {
                    qos: 1,
                    retain: true,
                    topic: `sprinkler/${this.deviceId}/${topic}`,
                    cmd: "publish",
                    dup: false,
                    payload: "",
                },
                () => {},
            )
        })
        return this
    }

    public publish(): void {
        this.publishers.forEach((publisher) => publisher.execute(broker))
    }
}
