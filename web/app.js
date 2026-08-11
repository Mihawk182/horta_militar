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
};

const elements = {
  connectionStatus: document.querySelector("#connectionStatus"),
  soilMoisture: document.querySelector("#soilMoisture"),
  temperature: document.querySelector("#temperature"),
  airHumidity: document.querySelector("#airHumidity"),
  pumpStatus: document.querySelector("#pumpStatus"),
  events: document.querySelector("#events"),
  turnPumpOn: document.querySelector("#turnPumpOn"),
  turnPumpOff: document.querySelector("#turnPumpOff"),
  setAutoMode: document.querySelector("#setAutoMode"),
  setManualMode: document.querySelector("#setManualMode"),
  moistureLimit: document.querySelector("#moistureLimit"),
  saveLimit: document.querySelector("#saveLimit"),
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

function setConnectionStatus(connected) {
  state.connected = connected;
  elements.connectionStatus.textContent = connected ? "conectado" : "desconectado";
  elements.connectionStatus.classList.toggle("connected", connected);
}

function publish(path, value) {
  if (!state.client || !state.connected) {
    addEvent("Comando nao enviado: painel desconectado do MQTT.");
    return;
  }

  state.client.publish(topic(path), String(value), { qos: 1, retain: true });
  addEvent(`Enviado ${path}: ${value}`);
}

function handleMessage(receivedTopic, payloadBuffer) {
  const payload = payloadBuffer.toString();
  const base = MQTT_CONFIG.baseTopic;
  const path = receivedTopic.replace(`${base}/`, "");

  if (path === "sensores/umidade_solo") {
    elements.soilMoisture.textContent = `${payload}%`;
  }

  if (path === "sensores/temperatura") {
    elements.temperature.textContent = `${payload} C`;
  }

  if (path === "sensores/umidade_ar") {
    elements.airHumidity.textContent = `${payload}%`;
  }

  if (path === "status/bomba") {
    elements.pumpStatus.textContent = payload;
  }

  addEvent(`Recebido ${path}: ${payload}`);
}

function connectMqtt() {
  const clientId = `horta-web-${crypto.randomUUID()}`;

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

elements.turnPumpOn.addEventListener("click", () => publish("comandos/bomba", "ligar"));
elements.turnPumpOff.addEventListener("click", () => publish("comandos/bomba", "desligar"));
elements.setAutoMode.addEventListener("click", () => publish("comandos/modo", "automatico"));
elements.setManualMode.addEventListener("click", () => publish("comandos/modo", "manual"));
elements.saveLimit.addEventListener("click", () => {
  publish("config/limite_umidade", elements.moistureLimit.value);
});

connectMqtt();
