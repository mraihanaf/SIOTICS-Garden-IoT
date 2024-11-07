// Utility functions

const fetchData = async (url) => {
    try {
        const response = await axios.get(url)
        return response.data.data || []
    } catch (error) {
        console.error(`Error fetching data from ${url}:`, error)
        return []
    }
}

const promptCredentials = async () => {
    const username = prompt("Enter your username:")
    const password = prompt("Enter your password:")
    return { username, password }
}

const updateDeviceStatus = (deviceId, data) => {
    const deviceDiv = document.getElementById(`device-${deviceId}`)
    if (deviceDiv) {
        deviceDiv.querySelector(`#last-seen-${deviceId}`).textContent =
            `Last Seen: ${new Date(data.date).toString()}`
        deviceDiv.querySelector(`#cron-${deviceId}`).textContent =
            `Cron Expression: ${data.cronExp} (${cronstrue.toString(data.cronExp, { locale: "id" })})`
        deviceDiv.querySelector(`#duration-${deviceId}`).textContent =
            `Watering Duration: ${data.wateringDurationInMs / 1000} detik`
        deviceDiv.querySelector(`#status-${deviceId}`).textContent =
            data.isWatering ? "Status: Menyiram" : "Status: Online"
    }
}

// Dialog Handling

const openDeviceDialog = async () => {
    const connectedDevices = await fetchData(
        `${window.location.origin}/api/v1/getConnectedDevicesIds`,
    )
    const registeredDevices = await fetchData(
        `${window.location.origin}/api/v1/getRegisteredDevices`,
    )

    const connectedUl = document.querySelector("#connected-device ul")
    connectedUl.innerHTML = "" // Clear previous list

    const registeredDeviceIds = registeredDevices.map(
        (device) => device.deviceId,
    )
    const fragment = document.createDocumentFragment()

    connectedDevices.forEach((deviceId) => {
        if (!registeredDeviceIds.includes(deviceId)) {
            const li = document.createElement("li")
            li.innerHTML = `<input type="radio" name="device" value="${deviceId}">${deviceId}`
            fragment.appendChild(li)
        }
    })

    connectedUl.appendChild(fragment)
    document.getElementById("connected-device").open = true
}

// Event Listeners

const handleDeviceSelection = async () => {
    const selectedDeviceId = document.querySelector(
        "#connected-device input[type='radio']:checked",
    )?.value
    if (!selectedDeviceId) return alert("Please select a device.")

    const { username, password } = await promptCredentials()
    const payload = { deviceId: selectedDeviceId, username, password }

    try {
        const response = await axios.post(
            `${window.location.origin}/api/v1/initDevice`,
            payload,
        )
        if (response.status === 200) {
            alert(`Device ${selectedDeviceId} initialized successfully.`)
            window.location.reload()
        } else {
            alert(`Failed to initialize device: ${response.data.message}`)
        }
    } catch (error) {
        console.error("Error initializing device:", error)
        alert("Error initializing device. Please try again.")
    }
}

const closeDeviceDialog = () => {
    document.getElementById("connected-device").open = false
}

const triggerWatering = async (deviceId, action) => {
    const { username, password } = await promptCredentials()
    const payload = { deviceId, action, username, password }

    try {
        const response = await axios.post(
            `${window.location.origin}/api/v1/triggerWatering`,
            payload,
        )
        if (response.status === 200) {
            alert(
                `Watering device ${deviceId} ${action === "off" ? "started" : "stopped"} successfully.`,
            )
        } else {
            alert("Failed to trigger watering action.")
        }
    } catch (error) {
        console.error("Error triggering watering:", error)
        alert("Error triggering watering action.")
    }
}

const changeDeviceConfig = async (deviceId) => {
    const newCronExpression = prompt("Enter new cron expression:")
    const newWateringDuration = prompt("Enter new watering duration in ms:")

    if (!newCronExpression || !newWateringDuration)
        return alert("Invalid input.")

    const { username, password } = await promptCredentials()
    const payload = {
        deviceId,
        cronExpression: newCronExpression,
        wateringDurationInMs: parseInt(newWateringDuration, 10),
        username,
        password,
    }

    try {
        const response = await axios.post(
            `${window.location.origin}/api/v1/setWatering`,
            payload,
        )
        if (response.status === 200) {
            alert(`Device ${deviceId} configuration updated.`)
            window.location.reload()
        } else {
            alert(`Failed to update device: ${response.data.message}`)
        }
    } catch (error) {
        console.error("Error updating device configuration:", error)
        alert("Error updating device configuration.")
    }
}

// UI Updates and MQTT Handling

const createDeviceDiv = (device) => {
    const div = document.createElement("div")
    div.classList.add("devices")
    div.id = `device-${device.deviceId}`

    div.innerHTML = `
      <h2>Device ID: ${device.deviceId}</h2>
      <p id="cron-${device.deviceId}">Cron Expression: ${device.cronExpression} (${cronstrue.toString(device.cronExpression, { locale: "id" })})</p>
      <p id="duration-${device.deviceId}">Watering Duration: ${device.wateringDurationInMs / 1000} detik</p>
      <p id="last-seen-${device.deviceId}">Last Seen: ${new Date(device.lastSeen).toString()}</p>
      <p id="status-${device.deviceId}">Status: Offline</p>
      <div class="device-buttons">
        <button class="siram-button" data-device-id="${device.deviceId}">Siram</button>
        <button class="berhentikan-button" data-device-id="${device.deviceId}">Berhentikan Siram</button>
        <button class="change-config-button" data-device-id="${device.deviceId}">Change Config</button>
        <button class="view-logs-button" data-device-id="${device.deviceId}">View Logs</button>
      </div>
    `

    document.body.appendChild(div)

    // Attach event listeners (including new logs button)
    div.querySelector(".siram-button").onclick = () =>
        triggerWatering(device.deviceId, "off")
    div.querySelector(".berhentikan-button").onclick = () =>
        triggerWatering(device.deviceId, "on")
    div.querySelector(".change-config-button").onclick = () =>
        changeDeviceConfig(device.deviceId)
    div.querySelector(".view-logs-button").onclick = () =>
        showDeviceLogs(device.deviceId)
}

// MQTT Client Setup

const client = mqtt.connect(`ws://${window.location.hostname}:8888`)

// Store device heartbeat times
const deviceHeartbeatTimes = {}

client.on("connect", () => {
    document.getElementById("broker-status").innerText = "Terkoneksi"
    document.getElementById("broker-status").classList.add("connected")
})

client.on("close", () => {
    document.getElementById("broker-status").innerText = "Terputus"
    document.getElementById("broker-status").classList.remove("connected")
})

client.on("message", (topic, message) => {
    const deviceId = topic.split("/")[1]
    const data = JSON.parse(message.toString())
    console.log(data)

    if (topic.includes("heartbeat")) {
        // Update heartbeat time for the device
        deviceHeartbeatTimes[deviceId] = new Date(data.date)
        updateDeviceStatus(deviceId, data)
    }

    if (topic.includes("watering/status")) {
        alert(`Watering status for ${deviceId}: ${message}`)
    }
})

// Offline Devices Detection

const checkDeviceHeartbeats = () => {
    const now = Date.now()
    Object.entries(deviceHeartbeatTimes).forEach(
        ([deviceId, lastHeartbeat]) => {
            const statusElem = document.querySelector(`#status-${deviceId}`)
            if (now - lastHeartbeat > 3000) {
                // If no heartbeat in the last 3 seconds
                if (statusElem) {
                    statusElem.textContent = "Status: Offline" // Mark device as offline
                }
            }
        },
    )
}

const fetchDeviceLogs = async (deviceId) => {
    try {
        const response = await axios.get(
            `${window.location.origin}/api/v1/getWateringLogs/${deviceId}`,
        )
        return response.data.data || []
    } catch (error) {
        console.error(`Error fetching logs for device ${deviceId}:`, error)
        return []
    }
}

// New function to format timestamp
const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString()
}

// New function to create logs dialog
const createLogsDialog = () => {
    const dialog = document.createElement("dialog")
    dialog.id = "logs-dialog"
    dialog.innerHTML = `
      <div class="logs-container">
        <h2>Watering Logs</h2>
        <div class="logs-content"></div>
        <button class="close-logs">Close</button>
      </div>
    `
    document.body.appendChild(dialog)

    dialog.querySelector(".close-logs").onclick = () => dialog.close()
    return dialog
}

// New function to show logs
const showDeviceLogs = async (deviceId) => {
    const logs = await fetchDeviceLogs(deviceId)
    const dialog = document.getElementById("logs-dialog") || createLogsDialog()
    const content = dialog.querySelector(".logs-content")

    if (logs.length === 0) {
        content.innerHTML =
            '<p class="no-logs">No logs available for this device.</p>'
    } else {
        content.innerHTML = `
        <table class="logs-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Duration</th>
              <th>Type</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            ${logs
                .map(
                    (log) => `
              <tr>
                <td>${formatTimestamp(log.timestamp)}</td>
                <td>${log.wateringDurationInMs}ms</td>
                <td>${log.isAutomated ? "Automated" : "Manual"}</td>
                <td>${log.isEnabled ? "Enabled" : "Disabled"}</td>
                <td>${log.reason}</td>
              </tr>
            `,
                )
                .join("")}
          </tbody>
        </table>
      `
    }

    dialog.showModal()
}

// Main Function

const main = async () => {
    const registeredDevices = await fetchData(
        `${window.location.origin}/api/v1/getRegisteredDevices`,
    )

    registeredDevices.forEach((device) => {
        createDeviceDiv(device)
        client.subscribe(`esp/${device.deviceId}/heartbeat`)
        client.subscribe(`esp/${device.deviceId}/watering/status`)
    })
}

// Initialize the app
document.getElementById("add-devices").onclick = openDeviceDialog
document.querySelector("#connected-device .cancel").onclick = closeDeviceDialog
document.querySelector("#connected-device .add").onclick = handleDeviceSelection

setInterval(checkDeviceHeartbeats, 1000)
main()
