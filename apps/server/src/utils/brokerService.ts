import Aedes from "aedes"
import { brokerLogger as logger } from "./logger"
import { cronValidator } from "./validator"

abstract class Publisher {
    abstract execute(broker: Aedes): void
}

interface IWateringPublishConfig {
    action: string
    deviceId: string
    payload: Buffer | string
}

abstract class WateringPublisher implements Publisher {
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

    public publish(broker: Aedes, config: IWateringPublishConfig): void {
        const prefix = `esp/${this.deviceId}/watering`
        const topic = `${prefix}/${config.action}`
        broker.publish(
            {
                topic: topic,
                qos: 1,
                payload: config.payload,
                cmd: "publish",
                dup: false,
                retain: false,
            },
            (error) => {
                this.handleError(error, topic)
            },
        )
    }
}

class SetWateringDuration extends WateringPublisher {
    constructor(
        protected deviceId: string,
        private durationInMs: number,
    ) {
        super(deviceId)
    }
    public execute(broker: Aedes) {
        this.publish(broker, {
            action: "setDurationInMs",
            deviceId: this.deviceId,
            payload: this.durationInMs.toString(),
        })
    }
}

class SetWateringCronPublisher extends WateringPublisher {
    constructor(
        protected deviceId: string,
        private cronExpression: string,
    ) {
        super(deviceId)
        if (!cronValidator.isCronExpression(this.cronExpression))
            throw new Error("Invalid Cron Expression")
    }

    public execute(broker: Aedes): void {
        this.publish(broker, {
            deviceId: this.deviceId,
            action: "setCron",
            payload: this.cronExpression,
        })
    }
}

abstract class Service {
    abstract publish(): void
}

export class WateringService extends Service {
    private publishers: Publisher[] = []

    constructor(
        private broker: Aedes,
        private deviceId: string,
    ) {
        super()
    }

    public setDurationInMs(durationInMs: number) {
        this.publishers.push(
            new SetWateringDuration(this.deviceId, durationInMs),
        )
        return this
    }

    public setCron(cronExpression: string) {
        this.publishers.push(
            new SetWateringCronPublisher(this.deviceId, cronExpression),
        )
        return this
    }

    public publish(): void {
        this.publishers.forEach((publisher) => publisher.execute(this.broker))
    }
}
