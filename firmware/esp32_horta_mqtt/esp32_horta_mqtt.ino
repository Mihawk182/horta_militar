#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

#include "config.h"

const int soilMoisturePin = 34;
const int pumpRelayPin = 26;

WiFiClientSecure wifiClient;
PubSubClient mqtt(wifiClient);

bool automaticMode = true;
bool pumpOn = false;
int moistureLimit = 35;
unsigned long lastTelemetryAt = 0;

String topic(const char *path) {
  return String(MQTT_BASE_TOPIC) + "/" + path;
}

void setPump(bool enabled) {
  pumpOn = enabled;
  digitalWrite(pumpRelayPin, enabled ? HIGH : LOW);
  mqtt.publish(topic("status/bomba").c_str(), enabled ? "ligada" : "desligada", true);
}

int readSoilMoisturePercent() {
  int raw = analogRead(soilMoisturePin);

  // Ajuste estes valores depois de testar o sensor seco e molhado.
  const int dryValue = 3200;
  const int wetValue = 1200;

  int percent = map(raw, dryValue, wetValue, 0, 100);
  return constrain(percent, 0, 100);
}

void publishTelemetry() {
  int soilMoisture = readSoilMoisturePercent();
  char value[12];

  snprintf(value, sizeof(value), "%d", soilMoisture);
  mqtt.publish(topic("sensores/umidade_solo").c_str(), value, true);

  mqtt.publish(topic("status/modo").c_str(), automaticMode ? "automatico" : "manual", true);
  mqtt.publish(topic("status/conexao").c_str(), "online", true);

  if (automaticMode && soilMoisture < moistureLimit && !pumpOn) {
    setPump(true);
  }

  if (automaticMode && soilMoisture >= moistureLimit + 5 && pumpOn) {
    setPump(false);
  }
}

void handleMessage(char *receivedTopic, byte *payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  String received = String(receivedTopic);

  if (received == topic("comandos/bomba")) {
    automaticMode = false;
    setPump(message == "ligar");
  }

  if (received == topic("comandos/modo")) {
    automaticMode = message == "automatico";
    mqtt.publish(topic("status/modo").c_str(), automaticMode ? "automatico" : "manual", true);
  }

  if (received == topic("config/limite_umidade")) {
    moistureLimit = constrain(message.toInt(), 0, 100);
  }
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void connectMqtt() {
  while (!mqtt.connected()) {
    String clientId = "horta-esp32-" + String((uint32_t)ESP.getEfuseMac(), HEX);

    if (mqtt.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD, topic("status/conexao").c_str(), 1, true, "offline")) {
      mqtt.subscribe(topic("comandos/#").c_str(), 1);
      mqtt.subscribe(topic("config/#").c_str(), 1);
      mqtt.publish(topic("status/conexao").c_str(), "online", true);
    } else {
      delay(3000);
    }
  }
}

void setup() {
  pinMode(pumpRelayPin, OUTPUT);
  setPump(false);

  Serial.begin(115200);
  connectWifi();

  wifiClient.setInsecure();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(handleMessage);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  if (!mqtt.connected()) {
    connectMqtt();
  }

  mqtt.loop();

  if (millis() - lastTelemetryAt > 5000) {
    lastTelemetryAt = millis();
    publishTelemetry();
  }
}
