document.getElementById("burger").addEventListener("click", function () {
  const nav = document.getElementById("nav");
  nav.classList.toggle("show");
});

var device_status = document.querySelector(".main_device_status");

document
  .querySelector("#color")
  .classList.remove("red-dot", "yellow-dot", "green-dot");

function updateDeviceStatus() {
  if (device_status.textContent === "Connected") {
    document.querySelector("#color").classList.add("green-dot");
  } else if (device_status.textContent === "Connecting") {
    document.querySelector("#color").classList.add("yellow-dot");
    document.querySelector(".dot_loading").classList.add("show2");
  } else {
    document.querySelector("#color").classList.add("red-dot");
  }
}

var watering_status = document.querySelector(".watering-status");

function updateWateringStatus() {
  if (watering_status.textContent === "Watering") {
    document.querySelector(".water-container").classList.remove("hide");
  } else {
    document.querySelector(".water-container").classList.add("hide");
  }
}

function siram() {
  document.getElementsByClassName("watering-status").innerHTML = "Watering";
}

updateWateringStatus();
updateDeviceStatus();
console.log(device_status.textContent);
console.log(watering_status.textContent);
