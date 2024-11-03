import sqlite3 from "sqlite3"
import { WateringConfig, WateringLog } from "../types/database"

export class Database {
    private db: sqlite3.Database

    constructor() {
        this.db = new sqlite3.Database("device.db", (err) => {
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
                cronExpression TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS watering_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deviceId TEXT NOT NULL,
                wateringDurationInMs INTEGER NOT NULL,
                isEnabled BOOLEAN NOT NULL,
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

    // Device Config Methods
    async getDeviceConfig(deviceId: string): Promise<WateringConfig | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT * FROM device_config WHERE deviceId = ?",
                [deviceId],
                (err, row) => {
                    if (err) reject(err)
                    else resolve((row as WateringConfig) || null)
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
                cronExpression = excluded.cronExpression
        `

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

    // Logging Methods
    async addLog(log: WateringLog): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                "INSERT INTO watering_logs (deviceId, wateringDurationInMs, isEnabled, timestamp) VALUES (?, ?, ?, ?)",
                [
                    log.deviceId,
                    log.wateringDurationInMs,
                    log.isEnabled,
                    log.timestamp,
                ],
                (err) => {
                    if (err) reject(err)
                    else resolve()
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
