# SIOTICS Garden IoT Server

An all-in-one web and MQTT server for SIOTICS Garden IoT project.

## Description

This server provides both Web Server and MQTT broker functionality for IoT garden monitoring and control. It's built with Node.js and TypeScript, utilizing Express.js for the web server and Aedes as the MQTT broker.

## Features
- MQTT Over Websockets
- Local NTP Server
- Web API Rate Limiting
- CORS Support
- Level Database Integration
- MQTT Broker (Aedes)
- Logging with Pino
- Broker Simple client auth (client cant connect with the same id)

## Web Api docs
Start the server, see `/api/docs` endpoint 

## Developments
To run the development server with hot-reload:
```bash
# Run both server and mocker
yarn dev

# Run only the server
yarn dev:server

# Run only the mocker
yarn dev:mocker
```

## Testing
```bash
yarn test # Test with jest
```

## Build and Run
```bash
yarn build
yarn start
```