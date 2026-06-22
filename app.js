import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { firebaseConfig, deviceId } from "./firebase-config.js";

const elements = {
  status: document.querySelector("#status"),
  temperature: document.querySelector("#temperature"),
  humidity: document.querySelector("#humidity"),
  pressure: document.querySelector("#pressure"),
  timestamp: document.querySelector("#timestamp"),
  device: document.querySelector("#device"),
  humidityCard: document.querySelector("#humidityCard"),
  pressureCard: document.querySelector("#pressureCard"),
  chart: document.querySelector("#chart"),
  buttons: document.querySelectorAll("[data-series]")
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const latestRef = ref(db, `devices/${deviceId}/latest`);
const storageKey = `weather-history:${deviceId}`;
const maxSamples = 120;
let activeSeries = "temperatureC";
let history = loadHistory();

elements.device.textContent = deviceId;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

elements.buttons.forEach((button) => {
  button.addEventListener("click", () => {
    elements.buttons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeSeries = button.dataset.series;
    drawChart();
  });
});

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(storageKey, JSON.stringify(history.slice(-maxSamples)));
}

function isDanger(reading) {
  return reading.temperatureC > 30 ||
    reading.temperatureC < 5 ||
    reading.humidityPct > 70 ||
    reading.humidityPct < 30 ||
    reading.pressureHpa > 1035 ||
    reading.pressureHpa < 980;
}

function formatNumber(value, digits) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return value.toFixed(digits);
}

function setStatus(text, className) {
  elements.status.textContent = text;
  elements.status.className = `status ${className || ""}`.trim();
}

function renderReading(reading) {
  const danger = isDanger(reading);

  elements.temperature.textContent = formatNumber(reading.temperatureC, 2);
  elements.humidity.textContent = formatNumber(reading.humidityPct, 0).padStart(2, "0");
  elements.pressure.textContent = formatNumber(reading.pressureHpa, 2);
  elements.timestamp.textContent = `${reading.timeText || "xx:xx"} - adatok`;

  elements.temperature.classList.toggle("danger", danger && (reading.temperatureC > 30 || reading.temperatureC < 5));
  elements.humidityCard.classList.toggle("danger", reading.humidityPct > 70 || reading.humidityPct < 30);
  elements.pressureCard.classList.toggle("danger", reading.pressureHpa > 1035 || reading.pressureHpa < 980);

  setStatus(danger ? "alert" : "online", danger ? "danger" : "online");
}

function pushHistory(reading) {
  const sample = {
    temperatureC: reading.temperatureC,
    humidityPct: reading.humidityPct,
    pressureHpa: reading.pressureHpa,
    timeText: reading.timeText || new Date().toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" }),
    receivedAt: Date.now()
  };

  const previous = history[history.length - 1];
  if (previous && previous.timeText === sample.timeText) {
    history[history.length - 1] = sample;
  } else {
    history.push(sample);
  }

  history = history.slice(-maxSamples);
  saveHistory();
}

async function refresh() {
  try {
    const snapshot = await get(latestRef);
    if (!snapshot.exists()) {
      setStatus("no data", "");
      drawChart();
      return;
    }

    const reading = snapshot.val();
    renderReading(reading);
    pushHistory(reading);
    drawChart();
  } catch (error) {
    setStatus("offline", "");
    drawChart();
  }
}

function drawChart() {
  const canvas = elements.chart;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, Math.floor(rect.width * dpr));
  canvas.height = Math.max(220, Math.floor(rect.height * dpr));

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const pad = 34;
  const points = history.filter((item) => typeof item[activeSeries] === "number");

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#303030";
  ctx.lineWidth = 1;
  ctx.font = "12px Consolas, monospace";
  ctx.fillStyle = "#8d8d8d";

  for (let i = 0; i < 4; i += 1) {
    const y = pad + ((height - pad * 2) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  if (points.length < 2) {
    ctx.fillText("varunk meg tobb mintara", pad, height / 2);
    return;
  }

  const values = points.map((item) => item[activeSeries]);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const xFor = (index) => pad + ((width - pad * 2) * index) / (points.length - 1);
  const yFor = (value) => height - pad - ((value - min) / (max - min)) * (height - pad * 2);

  ctx.strokeStyle = "#f2f2f2";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point[activeSeries]);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  const last = points[points.length - 1];
  const lastX = xFor(points.length - 1);
  const lastY = yFor(last[activeSeries]);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#f2f2f2";
  ctx.beginPath();
  ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#8d8d8d";
  ctx.fillText(max.toFixed(1), pad, 18);
  ctx.fillText(min.toFixed(1), pad, height - 10);
  ctx.fillText(points[0].timeText || "", pad, height - pad + 22);
  ctx.fillText(last.timeText || "", width - pad - 42, height - pad + 22);
}

window.addEventListener("resize", drawChart);
refresh();
setInterval(refresh, 60000);
