import sqlite3 from "sqlite3"
import {
    WateringConfig,
    WateringConfigWithLastseen,
    WateringLog,
} from "../types/database"
export class Database {
    private db: sqlite3.Database

    constructor() {
        this.db = new sqlite3.Database("database.sqlite", (err) => {
            if (err) {
                console.error("Database connection error:", err)
                throw err
            }
        })

        // Initialize tables on startup
        this.initialize().catch(console.error)
    }

    private async initialize(): Promise<void> {
        const schema = `
            CREATE TABLE IF NOT EXISTS device_config (
                deviceId TEXT PRIMARY KEY,
                wateringDurationInMs INTEGER NOT NULL,
                cronExpression TEXT NOT NULL,
                lastSeen TEXT
            );

            CREATE TABLE IF NOT EXISTS watering_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deviceId TEXT NOT NULL,
                wateringDurationInMs INTEGER,
                isEnabled BOOLEAN NOT NULL,
                isAutomated BOOLEAN NOT NULL,
                reason TEXT,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (deviceId) REFERENCES device_config (deviceId)
            );

            CREATE INDEX IF NOT EXISTS idx_logs_deviceId_timestamp 
            ON watering_logs(deviceId, timestamp);
        `

        return new Promise((resolve, reject) => {
            this.db.exec(schema, (err) => {
                if (err) reject(err)
                else resolve()
            })
        })
    }

    async setLastSeen(deviceId: string): Promise<void> {
        const now = new Date().toISOString()
        return new Promise((resolve, reject) => {
            this.db.run(
                "UPDATE device_config SET lastSeen = ? WHERE deviceId = ?",
                [now, deviceId],
                (err) => {
                    if (err) reject(err)
                    else resolve()
                },
            )
        })
    }

    async getLastSeen(deviceId: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT lastSeen FROM device_config WHERE deviceId = ?",
                [deviceId],
                (err, row: { lastSeen: string | null } | undefined) => {
                    if (err) reject(err)
                    else resolve(row?.lastSeen ?? null)
                },
            )
        })
    }

    async getDeviceConfig(deviceId: string): Promise<WateringConfig | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT * FROM device_config WHERE deviceId = ?",
                [deviceId],
                async (err, row) => {
                    if (err) reject(err)
                    else {
                        if (row) {
                            await this.setLastSeen(deviceId).catch(
                                console.error,
                            )
                        }
                        resolve((row as WateringConfig) || null)
                    }
                },
            )
        })
    }

    async upsertDeviceConfig(config: WateringConfig): Promise<void> {
        const sql = `
            INSERT INTO device_config 
            (deviceId, wateringDurationInMs, cronExpression)
            VALUES (?, ?, ?)
            ON CONFLICT(deviceId) DO UPDATE SET
                wateringDurationInMs = excluded.wateringDurationInMs,
                cronExpression = excluded.cronExpression,
                lastSeen = excluded.lastSeen
        `
        const now = new Date().toISOString()

        return new Promise((resolve, reject) => {
            this.db.run(
                sql,
                [
                    config.deviceId,
                    config.wateringDurationInMs,
                    config.cronExpression,
                ],
                (err) => {
                    if (err) reject(err)
                    else resolve()
                },
            )
        })
    }

    async addLog(log: WateringLog): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO watering_logs (
                    deviceId, 
                    wateringDurationInMs, 
                    isEnabled, 
                    isAutomated,
                    reason,
                    timestamp
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    log.deviceId,
                    log.wateringDurationInMs,
                    log.isEnabled,
                    log.isAutomated,
                    log.reason,
                    log.timestamp,
                ],
                async (err) => {
                    if (err) reject(err)
                    else {
                        await this.setLastSeen(log.deviceId).catch(
                            console.error,
                        )
                        resolve()
                    }
                },
            )
        })
    }

    async getDeviceLogs(
        deviceId: string,
        limit: number = 100,
    ): Promise<WateringLog[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM watering_logs 
                WHERE deviceId = ? 
                ORDER BY timestamp DESC 
                LIMIT ?`,
                [deviceId, limit],
                (err, rows) => {
                    if (err) reject(err)
                    else resolve(rows as WateringLog[])
                },
            )
        })
    }

    async getLogsByDateRange(
        deviceId: string,
        startDate: string,
        endDate: string,
    ): Promise<WateringLog[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM watering_logs 
                WHERE deviceId = ? 
                AND timestamp BETWEEN ? AND ?
                ORDER BY timestamp DESC`,
                [deviceId, startDate, endDate],
                (err, rows) => {
                    if (err) reject(err)
                    else resolve(rows as WateringLog[])
                },
            )
        })
    }

    async getDevices(): Promise<WateringConfigWithLastseen[]> {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM device_config`, (err, rows) => {
                if (err) reject(err)
                else resolve(rows as WateringConfigWithLastseen[])
            })
        })
    }

    async cleanup(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err)
                else resolve()
            })
        })
    }
}

// Create a single instance of the Database
const db = new Database()

// Handle cleanup on exit
process.on("SIGINT", async () => {
    await db.cleanup()
    console.log("Database connection closed")
    process.exit(0)
})

export default db
