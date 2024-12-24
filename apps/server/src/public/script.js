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
        client.publish(`sprinkler/${deviceId}/config/duration`, durationInMs, {
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
                    <div class="card-body container-fluid d-flex flex-md-row flex-column">
                        <div class ="container col-md-6 d-flex flex-column">
                            <p class="card-text mb-2 flex-grow-1">
                                <strong>Terakhir Dilihat:</strong><br> None
                            </p>
                            <p class="card-text mb-2 watering-duration flex-grow-1">
                                <strong>Durasi Penyiraman:</strong><br> None
                            </p>
                            <p class="card-text mb-2 cron-expression flex-grow-1">
                                <strong>Terakhir dilihat:</strong><br> None
                            </p>
                            <div class="container d-flex gap-5 justify-content-center align-items-center flex-grow-1 ">
                                <div class="card col-md-4 p-2 border-0">
                                    <img src="https://www.svgrepo.com/show/236207/thermometer-temperature.svg" alt="Temp-Image" class="image-fluid opacity-50">
                                    <div class="card-body col-md-12 border-primary">
                                        <p class="card-text mb-2 flex-grow-1 device-temp"><strong>Temperatur: </strong>None</p>
                                    </div>
                                </div>
                                <div class="card col-md-4 p-2 border-0">
                                    <img src="https://www.svgrepo.com/show/120133/water-drop.svg" alt="Humid-Image" class="image-fluid opacity-50">
                                    <div class="card-body col-md-12 border-secondary">
                                        <p class="card-text mb-2 flex-grow-1 device-humid"><strong>Humidity: </strong>None</p>
                                    </div>
                                </div>
                            </div>
                            <div class="d-flex flex-wrap justify-content-center flex-column gap-2 mt-3">
                                <button class="btn btn-primary btn-sm flex-grow-1 d-none start-btn">Siram</button>
                                <button class="btn btn-warning btn-sm flex-grow-1 d-none stop-btn">Berhentikan Siram</button>
                                <button class="btn btn-info btn-sm flex-grow-1 config-btn">Konfigurasi</button>                        
                            </div>
                        </div>
                        <div class ="container d-flex flex-column gap-2">
                            <div class="card col-md-12">
                                        <div class="card-header">
                                            Temp Data
                                        </div>
                                        <div class="card-body">
                                            <canvas id="tempChart-${deviceId}"></canvas>
                                        </div>
                                </div>
                            <div class="card col-md-12">
                                        <div class="card-header">
                                            Humid Data
                                        </div>
                                        <div class="card-body">
                                            <canvas id="humiChart-${deviceId}"></canvas>
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
        const tempCtx = document
            .getElementById(`tempChart-${deviceId}`)
            .getContext("2d")
        const humiCtx = document
            .getElementById(`humiChart-${deviceId}`)
            .getContext("2d")
        const tempChart = new Chart(tempCtx, {
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
        const humiChart = new Chart(humiCtx, {
            type: "line",
            data: {
                labels: [],
                datasets: [
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

        this.charts.set(deviceId, { tempChart, humiChart })
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
                DeviceControl.setDurationInMs(deviceId, newDuration)
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
        const charts = this.charts.get(deviceId);
        if (!charts) return;

        const { tempChart, humiChart } = charts;
        const chart = type === "temperature" ? tempChart : humiChart;

        const parsedValue = parseFloat(value)
        if (isNaN(parsedValue)) {
            console.error(
                `invalid data for deviceId: ${deviceId} with type: ${type}  and value: ${value}`,
            )
            return
        }

        const now = new Date().toLocaleTimeString()

        if (chart.data.labels.length >= 60) {
            chart.data.labels.shift()
            chart.data.datasets.map((dataset) => {
                if (dataset.data.length >= 60) dataset.data.shift()
            })
        }

        if (!chart.data.labels.includes(now)) {
            chart.data.labels.push(now)
        }

        chart.data.datasets[0].data.push(parsedValue)
        chart.update()
    }

    updateTextSensorData(deviceId, type, value) {
        if (!this.devices.has(deviceId)) {
            this.createDeviceCard(deviceId)
        }
        const deviceCard = document.getElementById(`device-${deviceId}`);
        const parsedValue = parseFloat(value);
    
        if (isNaN(parsedValue)) {
            console.error(
                `Invalid data for deviceId: ${deviceId} with type: ${type} and value: ${value}`
            );
            return;
        }
    
        if (type === "temperature") {
            const tempText = deviceCard.querySelector('.device-temp');
            if (tempText) {
                tempText.innerHTML = `<strong>Temperatur: </strong>${parsedValue.toFixed(1)}°C`;
            }
        } else if (type === "humidity") {
            const humidText = deviceCard.querySelector('.device-humid');
            if (humidText) {
                humidText.innerHTML = `<strong>Humidity: </strong>${parsedValue.toFixed(1)}%`;
            }
        }

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
        deviceManager.updateTextSensorData(deviceId, sensorType, msg)

    }
})

client.on("error", (err) => {
    console.error("Connection error: ", err)
    brokerStatus.classList.remove("bg-success")
    brokerStatus.classList.add("bg-danger")
    brokerStatus.textContent = "Terputus"
})
