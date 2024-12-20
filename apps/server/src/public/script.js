const MQTT_BROKER_URL = `ws://${window.location.hostname}:8888`
const client = mqtt.connect(MQTT_BROKER_URL)
const deviceStatusMap = {
    INIT: { text: "Inisialisasi", class: "bg-warning" },
    ALIVE: { text: "Online", class: "bg-success" },
    DEAD: { text: "Offline", class: "bg-danger" },
    "WATERING.AUTO": { text: "Menyiram Otomatis", class: "bg-info" },
    "WATERING.MAN": { text: "Menyiram Manual", class: "bg-primary" },
}

class DeviceControl {
    static trigger(deviceId, command) {
        console.log(deviceId, command)
        // MAN.ON || MAN.OFF
        client.publish(`sprinkler/${deviceId}/trigger`, command, { qos: 1 })
    }

    static setCron(deviceId, cronExpression) {
        client.publish(`sprinkler/${deviceId}/config/cron`, cronExpression, {
            retain: true,
            qos: 1,
        })
    }

    static setDurationInMs(deviceId, durationInMs) {
        client.publish(`sprinkler/${deviceId}/config/cron`, durationInMs, {
            retain: true,
            qos: 1,
        })
    }
}

class DeviceManager {
    constructor() {
        this.charts = new Map()
        this.devices = new Set()
    }

    createDeviceCard(deviceId) {
        const template = `
         <div class="col-md-12" id="device-${deviceId}">
                <div class="card border-success">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">Device ID: ${deviceId}</h5>
                        <span class="badge bg-secondary">Offline</span>
                    </div>
                    <div class="card-body">
                        <p class="card-text mb-2">
                            <strong>Terakhir Dilihat:</strong> None
                        </p>
                        <p class="card-text mb-2 watering-duration">
                            <strong>Durasi Penyiraman:</strong> None
                        </p>
                        <p class="card-text mb-2 cron-expression">
                            <strong>Terakhir dilihat:</strong> None
                        </p>
                        <div class="d-flex flex-wrap justify-content-between gap-2 mt-3">
                            <button class="btn btn-primary btn-sm flex-grow-1 d-none start-btn">Siram</button>
                            <button class="btn btn-warning btn-sm flex-grow-1 d-none stop-btn">Berhentikan Siram</button>
                            <button class="btn btn-info btn-sm flex-grow-1 config-btn">Konfigurasi</button>                        
                        </div>
                        <div class="row">
                            <div class="col-md-12">
                                <div class="card">
                                    <div class="card-header">
                                        Sensor Data
                                    </div>
                                    <div class="card-body">
                                        <canvas id="sensorChart-${deviceId}"></canvas>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                 <div>
            </div>
        `
        document
            .getElementById("devices-container")
            .insertAdjacentHTML("beforeend", template)
        this.initializeChart(deviceId)
        this.initializeControlButtons(deviceId)
        this.devices.add(deviceId)
    }

    initializeChart(deviceId) {
        const ctx = document
            .getElementById(`sensorChart-${deviceId}`)
            .getContext("2d")
        const sensorChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "Temperature (\u00B0C)",
                        data: [],
                        borderColor: "rgb(153, 153, 255)",
                        backgroundColor: "rgb(153, 153, 255)",
                    },
                    {
                        label: "Humidity (%)",
                        data: [],
                        borderColor: "rgb(54, 162, 235)",
                        backgroundColor: "rgb(54, 162, 235)",
                    },
                ],
            },
            options: {
                responsive: true,
                animation: {
                    duration: 500,
                },
                plugins: {
                    legend: {
                        position: "top",
                    },
                },
            },
        })

        this.charts.set(deviceId, sensorChart)
    }

    initializeControlButtons(deviceId) {
        const deviceCard = document.getElementById(`device-${deviceId}`)
        const startBtn = deviceCard.querySelector(".start-btn")
        const stopBtn = deviceCard.querySelector(".stop-btn")
        const configBtn = deviceCard.querySelector(".config-btn")

        startBtn.addEventListener("click", () => {
            DeviceControl.trigger(deviceId, "MAN.ON")
        })

        stopBtn.addEventListener("click", () => {
            DeviceControl.trigger(deviceId, "MAN.OFF")
        })

        configBtn.addEventListener("click", () => {
            const newCron = prompt("Masukkan ekspresi cron baru:")
            if (newCron) {
                DeviceControl.setCron(deviceId, newCron)
            }

            const newDuration = prompt(
                "Masukkan durasi penyiraman baru (dalam milidetik):",
            )
            if (newDuration) {
                DeviceControl.setDurationInMs(deviceCard, newDuration)
            }
        })
    }

    updateDeviceStatus(deviceId, status) {
        if (!this.devices.has(deviceId)) {
            this.createDeviceCard(deviceId)
        }

        const statusBadge = document.querySelector(
            `#device-${deviceId} .card-header span`,
        )
        const startButton = document.querySelector(
            `#device-${deviceId} .start-btn`,
        )
        const stopButton = document.querySelector(
            `#device-${deviceId} .stop-btn`,
        )

        const statusInfo = deviceStatusMap[status] || {
            text: status,
            class: "bg-secondary",
        }
        statusBadge.textContent = statusInfo.text
        statusBadge.className = `badge ${statusInfo.class}`

        startButton.classList.toggle(
            "d-none",
            status === "WATERING.MAN" || status === "WATERING.AUTO",
        )
        stopButton.classList.toggle(
            "d-none",
            status === "ALIVE" || status === "DEAD",
        )
    }

    updateSensorData(deviceId, type, value) {
        const chart = this.charts.get(deviceId)
        if (!chart) return
        const parsedValue = parseFloat(value)
        if (isNaN(parsedValue)) {
            console.error(
                `invalid data for deviceId: ${deviceId} with type: ${type}  and value: ${value}`,
            )
            return
        }

        const now = new Date().toLocaleTimeString()

        if (chart.data.labels.length >= 20) {
            chart.data.labels.shift()
            chart.data.datasets.map((dataset) => {
                if (dataset.data.length >= 20) dataset.data.shift()
            })
        }

        if (!chart.data.labels.includes(now)) {
            chart.data.labels.push(now)
        }

        const datasetIndex = type === "temperature" ? 0 : 1
        chart.data.datasets[datasetIndex].data.push(parsedValue)
        chart.update()
    }

    updateDeviceConfig(deviceId, type, value) {
        if (!this.devices.has(deviceId)) {
            this.createDeviceCard(deviceId)
        }
        const deviceCard = document.getElementById(`device-${deviceId}`)

        if (type === "cron") {
            const cronText = deviceCard.querySelector(".cron-expression")
            try {
                cronText.innerHTML = `<strong>Cron Expression:</strong> ${value} <small class="text-muted">(${cronstrue.toString(value, { locale: "id" })})</small>`
            } catch (error) {
                cronText.innerHTML = `<strong>Cron Expression:</strong> ${value} <small class="text-danger">(Invalid)</small>`
            }
        } else if (type === "duration") {
            const durationText = deviceCard.querySelector(".watering-duration")
            durationText.innerHTML = `<strong>Durasi Penyiraman:</strong> ${value} milidetik`
        }
    }
}

const brokerStatus = document.getElementById("broker-status")

const deviceManager = new DeviceManager()

client.on("connect", () => {
    brokerStatus.classList.remove("bg-danger")
    brokerStatus.classList.add("bg-success")
    brokerStatus.textContent = "Terhubung"
    console.log("Connected to MQTT broker")

    client.subscribe("sprinkler/#")
})

client.on("message", (topic, message) => {
    const msg = message.toString()
    const topicParts = topic.split("/")
    const deviceId = topicParts[1]

    if (topic.endsWith("/status")) {
        deviceManager.updateDeviceStatus(deviceId, msg)
    } else if (topic.includes("/config/")) {
        const configType = topicParts[3]
        deviceManager.updateDeviceConfig(deviceId, configType, msg)
    } else if (topic.includes("/sensors/")) {
        const sensorType = topicParts[3]
        deviceManager.updateSensorData(deviceId, sensorType, msg)
    }
})

client.on("error", (err) => {
    console.error("Connection error: ", err)
    brokerStatus.classList.remove("bg-success")
    brokerStatus.classList.add("bg-danger")
    brokerStatus.textContent = "Terputus"
})
