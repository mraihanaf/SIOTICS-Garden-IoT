# SIOTICS-Garden-IoT

Monorepo for SIOTICS automatic garden sprinkler project 👽

## Setup
Before you start, please install `yarn`
```
npm i -g yarn
```
1. Clone the repo
```
git clone https://github.com/siotics/SIOTICS-Garden-IoT
```
2. Install dependencies
```
yarn install
```
3. Setup the .env file in each `./apps/APP_NAME` directory
## Scripts
1. Tests for all nodejs apps
```
yarn workspaces run test
```
2. format (prettier)
```
yarn run format
```
## Developments
### discord-bot
```
yarn workspace discord-bot run dev
```
### server
```
yarn workspace server run dev
```