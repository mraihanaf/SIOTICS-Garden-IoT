import swaggerJSDoc, { Options } from "swagger-jsdoc"
const options: Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "SIOTICS-Garden-API",
            version: "1.0.0",
        },
    },
    apis: ["./src/api/v1/*.ts", "./src/api/*.ts"], // files containing annotations as above
}

export default swaggerJSDoc(options)
