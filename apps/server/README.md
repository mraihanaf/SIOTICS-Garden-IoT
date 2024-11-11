# SIOTICS Garden IoT Server

An all-in-one web and MQTT server for SIOTICS Garden IoT project.

## Description

This server provides both Web Server and MQTT broker functionality for IoT garden monitoring and control. It's built with Node.js and TypeScript, utilizing Express.js for the web server and Aedes as the MQTT broker.

## Features
- MQTT Over Websockets
- Web API Rate Limiting
- CORS Support
- SQLite Database Integration
- MQTT Broker (Aedes)
- Logging with Pino
- Broker host only topic (only the broker itself that can publish message to that topics)
- Broker Client publish authorization (Only client with initialized id that can only publish to spesific topic)
- Broker Simple client auth (client cant connect with the same id)

## Web Api docs
Start the server, see `/api-docs` endpoint 

## Broker Topics
```
Client (ESP32)
    esp/init (publish)
    esp/clientId/watering (publish)
    esp/clientId/heartbeat (publish)
    esp/clientId/watering/trigger (publish & subscribe)
    esp/clientId/watering/setDurationInMs (subscribe)
    esp/clientId/watering/setCron (subscribe)
    esp/clientId/system/logs (publish) (NOT AVAILABLE YET)
    esp/clientId/system/restart (subscribe) (NOT AVAILABLE YET)
    esp/clientId/system/ota (subscribe) (NOT AVAILABLE YET)
Host
    esp/init (subscribe)
    esp/clientId/watering/trigger (publish & subscribe)
    esp/clientId/watering/setDuration (publish)
    esp/clientId/watering/setCron (publish)
    esp/clientId/system/restart (publish) (NOT AVAILABLE YET)
    esp/clientId/system/ota (publish) (NOT AVAILABLE YET)
```

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