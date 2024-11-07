document.getElementById("burger").addEventListener("click", function () {
    const nav = document.getElementById("nav")
    nav.classList.toggle("show")
})

var device_status = document.querySelector(".main_device_status")

document
    .querySelector("#color")
    .classList.remove("red-dot", "yellow-dot", "green-dot")

function updateDeviceStatus(state) {
    // Remove all dot classes first
    document
        .querySelector("#color")
        .classList.remove("red-dot", "yellow-dot", "green-dot")

    // Update the device status text
    device_status.textContent = state.charAt(0).toUpperCase() + state.slice(1)

    // Then add the appropriate class based on the state
    switch (state.toLowerCase()) {
        case "connected":
            document.querySelector("#color").classList.add("green-dot")
            document.querySelector(".dot_loading").classList.remove("show2")
            break
        case "connecting":
            document.querySelector("#color").classList.add("yellow-dot")
            document.querySelector(".dot_loading").classList.add("show2")
            break
        case "disconnected":
            document.querySelector("#color").classList.add("red-dot")
            document.querySelector(".dot_loading").classList.remove("show2")
            break
        default:
            console.error("Invalid state provided to updateDeviceStatus")
    }
}

var watering_status = document.querySelector(".watering-status")

function updateWateringStatus() {
    if (watering_status.textContent === "Watering") {
        document.querySelector(".water-container").classList.remove("hide")
    } else {
        document.querySelector(".water-container").classList.add("hide")
    }
}

function siram() {
    document.getElementsByClassName("watering-status").innerHTML = "Watering"
}
