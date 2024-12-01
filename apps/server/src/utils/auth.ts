import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto"
import { config } from "dotenv"
import { serverDatabase } from "./database"
import logger from "./logger"

config()

interface AuthConfig {
    username: string
    passwordHash: string
}

class BaseAuth {
    protected static generatePassword(password: string): string {
        const salt = randomBytes(32).toString("hex")
        const generatedHash = pbkdf2Sync(
            password,
            salt,
            1000,
            64,
            "sha512",
        ).toString("hex")
        return `${generatedHash}:${salt}`
    }

    protected static checkPassword(
        inputPassword: string,
        storedHash: string,
        storedSalt: string,
    ): boolean {
        try {
            const computedHash = pbkdf2Sync(
                inputPassword,
                storedSalt,
                1000,
                64,
                "sha512",
            ).toString("hex")

            return timingSafeEqual(
                Buffer.from(computedHash),
                Buffer.from(storedHash),
            )
        } catch (error) {
            logger.error("Password check failed", error)
            return false
        }
    }

    protected static validateCredentials(
        inputUsername: string,
        inputPassword: string,
        expectedConfig: AuthConfig,
    ): boolean {
        if (!serverDatabase.getConfig()) {
            throw new Error("Server not initialized")
        }

        try {
            const [storedHash, storedSalt] =
                expectedConfig.passwordHash.split(":")

            const isValidUsername = timingSafeEqual(
                Buffer.from(inputUsername),
                Buffer.from(expectedConfig.username),
            )

            const isValidPassword = this.checkPassword(
                inputPassword,
                storedHash,
                storedSalt,
            )

            return isValidUsername && isValidPassword
        } catch (error) {
            logger.error("Authentication validation failed", error)
            return false
        }
    }
}

export class brokerAuth extends BaseAuth {
    static authenticate(username: string, password: string): boolean {
        const config = serverDatabase.getConfig()
        return this.validateCredentials(username, password, {
            username: config?.brokerUsername!,
            passwordHash: config?.brokerPassword!,
        })
    }
}

export class apiAuth extends BaseAuth {
    static authenticate(username: string, password: string): boolean {
        const config = serverDatabase.getConfig()
        return this.validateCredentials(username, password, {
            username: config?.apiUsername!,
            passwordHash: config?.apiPassword!,
        })
    }
}

export class auth extends BaseAuth {
    static generatePassword = BaseAuth.generatePassword
}
