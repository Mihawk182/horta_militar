const MQTT_CONFIG = {
  // HiveMQ Cloud usa normalmente: wss://SEU_CLUSTER.s1.eu.hivemq.cloud:8884/mqtt
  url: "wss://SEU_BROKER_WEBSOCKET/mqtt",
  username: "SEU_USUARIO",
  password: "SUA_SENHA",
  baseTopic: "horta-militar/001",
};

const state = {
  client: null,
  connected: false,
  demoMode: MQTT_CONFIG.url.includes("SEU_"),
  readings: {
    soil1: 62,
    soil2: 41,
    soil3: 78,
    temperature: 27.6,
    airHumidity: 65,
    lightLevel: 72,
    rainStatus: "Sem chuva",
    pumpStatus: "Desligada",
    modeStatus: "Automatico",
  },
  history: [],
};

const elements = {
  connectionStatus: document.querySelector("#connectionStatus"),
  currentDate: document.querySelector("#currentDate"),
  currentTime: document.querySelector("#currentTime"),
  soil1: document.querySelector("#soil1"),
  soil2: document.querySelector("#soil2"),
  soil3: document.querySelector("#soil3"),
  soil1Status: document.querySelector("#soil1Status"),
  soil2Status: document.querySelector("#soil2Status"),
  soil3Status: document.querySelector("#soil3Status"),
  soilAverage: document.querySelector("#soilAverage"),
  soilAverageStatus: document.querySelector("#soilAverageStatus"),
  temperature: document.querySelector("#temperature"),
  airHumidity: document.querySelector("#airHumidity"),
  lightLevel: document.querySelector("#lightLevel"),
  rainStatus: document.querySelector("#rainStatus"),
  pumpStatus: document.querySelector("#pumpStatus"),
  modeStatus: document.querySelector("#modeStatus"),
  events: document.querySelector("#events"),
  turnPumpOn: document.querySelector("#turnPumpOn"),
  turnPumpOff: document.querySelector("#turnPumpOff"),
  setAutoMode: document.querySelector("#setAutoMode"),
  setManualMode: document.querySelector("#setManualMode"),
  moistureLimit: document.querySelector("#moistureLimit"),
  saveLimit: document.querySelector("#saveLimit"),
  historyChart: document.querySelector("#historyChart"),
};

function topic(path) {
  return `${MQTT_CONFIG.baseTopic}/${path}`;
}

function addEvent(message) {
  const item = document.createElement("li");
  item.textContent = `${new Date().toLocaleTimeString("pt-BR")} - ${message}`;
  elements.events.prepend(item);

  while (elements.events.children.length > 25) {
    elements.events.lastElementChild.remove();
  }
}

function setConnectionStatus(connected, label) {
  state.connected = connected;
  elements.connectionStatus.textContent = label || (connected ? "online" : "offline");
  elements.connectionStatus.classList.toggle("connected", connected);
}

function classifySoil(value) {
  if (value < 35) return "Seco";
  if (value < 55) return "Moderado";
  return "Umido";
}

function updateGauge(element, value) {
  const gauge = element.closest(".gauge");
  gauge.style.setProperty("--value", value);
  element.textContent = `${Math.round(value)}%`;
}

function updateReadings() {
  const { readings } = state;
  const average = Math.round((readings.soil1 + readings.soil2 + readings.soil3) / 3);

  updateGauge(elements.soil1, readings.soil1);
  updateGauge(elements.soil2, readings.soil2);
  updateGauge(elements.soil3, readings.soil3);

  elements.soil1Status.textContent = classifySoil(readings.soil1);
  elements.soil2Status.textContent = classifySoil(readings.soil2);
  elements.soil3Status.textContent = classifySoil(readings.soil3);
  elements.soilAverage.textContent = `${average}%`;
  elements.soilAverageStatus.textContent = classifySoil(average);
  elements.temperature.textContent = `${Number(readings.temperature).toFixed(1)} C`;
  elements.airHumidity.textContent = `${Math.round(readings.airHumidity)}%`;
  elements.lightLevel.textContent = `${Math.round(readings.lightLevel)}%`;
  elements.rainStatus.textContent = readings.rainStatus;
  elements.pumpStatus.textContent = readings.pumpStatus;
  elements.modeStatus.textContent = readings.modeStatus;
}

function updateClock() {
  const now = new Date();
  elements.currentDate.textContent = now.toLocaleDateString("pt-BR");
  elements.currentTime.textContent = now.toLocaleTimeString("pt-BR");
}

function publish(path, value) {
  if (!state.client || !state.connected) {
    addEvent(`Comando em modo local: ${path} = ${value}`);
    return;
  }

  state.client.publish(topic(path), String(value), { qos: 1, retain: true });
  addEvent(`Enviado ${path}: ${value}`);
}

function handlePumpCommand(value) {
  state.readings.pumpStatus = value === "ligar" ? "Ligada" : "Desligada";
  state.readings.modeStatus = "Manual";
  updateReadings();
}

function handleModeCommand(value) {
  state.readings.modeStatus = value === "automatico" ? "Automatico" : "Manual";
  updateReadings();
}

function handleMessage(receivedTopic, payloadBuffer) {
  const payload = payloadBuffer.toString();
  const base = MQTT_CONFIG.baseTopic;
  const path = receivedTopic.replace(`${base}/`, "");
  const numericValue = Number(payload);

  if (path === "sensores/umidade_solo" || path === "sensores/umidade_solo_1") {
    state.readings.soil1 = numericValue;
  }

  if (path === "sensores/umidade_solo_2") {
    state.readings.soil2 = numericValue;
  }

  if (path === "sensores/umidade_solo_3") {
    state.readings.soil3 = numericValue;
  }

  if (path === "sensores/temperatura") {
    state.readings.temperature = numericValue;
  }

  if (path === "sensores/umidade_ar") {
    state.readings.airHumidity = numericValue;
  }

  if (path === "sensores/luminosidade") {
    state.readings.lightLevel = numericValue;
  }

  if (path === "sensores/chuva") {
    state.readings.rainStatus = payload === "1" || payload === "chuva" ? "Chuva detectada" : "Sem chuva";
  }

  if (path === "status/bomba") {
    state.readings.pumpStatus = payload;
  }

  if (path === "status/modo") {
    state.readings.modeStatus = payload === "automatico" ? "Automatico" : "Manual";
  }

  updateReadings();
  addHistoryPoint();
  drawHistoryChart();
  addEvent(`Recebido ${path}: ${payload}`);
}

function connectMqtt() {
  if (state.demoMode || !window.mqtt) {
    setConnectionStatus(false, "modo demo");
    addEvent("Painel iniciado em modo demonstracao.");
    return;
  }

  const randomId = window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now();
  const clientId = `horta-web-${randomId}`;

  state.client = mqtt.connect(MQTT_CONFIG.url, {
    clientId,
    username: MQTT_CONFIG.username,
    password: MQTT_CONFIG.password,
    clean: true,
    connectTimeout: 8000,
    reconnectPeriod: 3000,
  });

  state.client.on("connect", () => {
    setConnectionStatus(true);
    addEvent("Painel conectado ao MQTT.");
    state.client.subscribe(`${MQTT_CONFIG.baseTopic}/#`, { qos: 1 });
  });

  state.client.on("reconnect", () => addEvent("Tentando reconectar..."));
  state.client.on("close", () => setConnectionStatus(false));
  state.client.on("error", (error) => addEvent(`Erro MQTT: ${error.message}`));
  state.client.on("message", handleMessage);
}

function seedHistory() {
  const now = Date.now();
  state.history = Array.from({ length: 18 }, (_, index) => {
    const angle = index / 2.4;
    return {
      label: new Date(now - (17 - index) * 60 * 60 * 1000).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      soil: Math.round(56 + Math.sin(angle) * 9 + index * 0.35),
      temp: Number((26 + Math.cos(angle) * 1.6).toFixed(1)),
      air: Math.round(66 + Math.sin(angle + 1.2) * 8),
    };
  });
}

function addHistoryPoint() {
  const average = Math.round((state.readings.soil1 + state.readings.soil2 + state.readings.soil3) / 3);

  state.history.push({
    label: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    soil: average,
    temp: Number(state.readings.temperature),
    air: Number(state.readings.airHumidity),
  });

  if (state.history.length > 18) {
    state.history.shift();
  }
}

function drawLine(ctx, points, color, min, max, area) {
  ctx.beginPath();
  points.forEach((value, index) => {
    const x = area.left + (index / Math.max(points.length - 1, 1)) * area.width;
    const y = area.top + area.height - ((value - min) / (max - min)) * area.height;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawHistoryChart() {
  const canvas = elements.historyChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const area = { left: 46, top: 24, width: width - 70, height: height - 66 };

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e7dddd";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#6f6868";
  ctx.font = "12px Arial";

  for (let i = 0; i <= 5; i += 1) {
    const y = area.top + (i / 5) * area.height;
    const label = 100 - i * 20;
    ctx.beginPath();
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.left + area.width, y);
    ctx.stroke();
    ctx.fillText(String(label), 8, y + 4);
  }

  const labels = state.history.map((item) => item.label);
  labels.forEach((label, index) => {
    if (index % 4 !== 0 && index !== labels.length - 1) return;
    const x = area.left + (index / Math.max(labels.length - 1, 1)) * area.width;
    ctx.fillText(label, x - 16, height - 18);
  });

  drawLine(ctx, state.history.map((item) => item.soil), "#cf1115", 0, 100, area);
  drawLine(ctx, state.history.map((item) => item.temp), "#dca820", 0, 60, area);
  drawLine(ctx, state.history.map((item) => item.air), "#2264d1", 0, 100, area);
}

function runDemoTick() {
  if (!state.demoMode) return;

  const delta = () => Math.round((Math.random() * 4 - 2) * 10) / 10;
  state.readings.soil1 = Math.max(20, Math.min(92, state.readings.soil1 + delta()));
  state.readings.soil2 = Math.max(20, Math.min(92, state.readings.soil2 + delta()));
  state.readings.soil3 = Math.max(20, Math.min(92, state.readings.soil3 + delta()));
  state.readings.temperature = Math.max(20, Math.min(34, state.readings.temperature + delta() / 4));
  state.readings.airHumidity = Math.max(42, Math.min(92, state.readings.airHumidity + delta()));
  state.readings.lightLevel = Math.max(0, Math.min(100, state.readings.lightLevel + delta() * 2));

  updateReadings();
  addHistoryPoint();
  drawHistoryChart();
}

elements.turnPumpOn.addEventListener("click", () => {
  handlePumpCommand("ligar");
  publish("comandos/bomba", "ligar");
});

elements.turnPumpOff.addEventListener("click", () => {
  handlePumpCommand("desligar");
  publish("comandos/bomba", "desligar");
});

elements.setAutoMode.addEventListener("click", () => {
  handleModeCommand("automatico");
  publish("comandos/modo", "automatico");
});

elements.setManualMode.addEventListener("click", () => {
  handleModeCommand("manual");
  publish("comandos/modo", "manual");
});

elements.saveLimit.addEventListener("click", () => {
  const value = Number(elements.moistureLimit.value);

  if (Number.isNaN(value) || value < 0 || value > 100) {
    addEvent("Limite invalido. Use um valor entre 0 e 100.");
    return;
  }

  publish("config/limite_umidade", value);
});

updateClock();
seedHistory();
updateReadings();
drawHistoryChart();
connectMqtt();

setInterval(updateClock, 1000);
setInterval(runDemoTick, 6000);
