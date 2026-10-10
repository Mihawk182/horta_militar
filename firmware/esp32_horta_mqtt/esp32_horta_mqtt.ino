#include <DHT.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#include "config.h"

const int soilSensorPins[] = {34, 35, 32};
const int rainSensorPin = 33;
const int dhtPin = 27;
const int relayPin = 26;
const int soilSensorCount = sizeof(soilSensorPins) / sizeof(soilSensorPins[0]);

const int drySoilValue = 3500;
const int wetSoilValue = 1200;
const int dryRainValue = 4095;
const int wetRainValue = 1200;
const int rainBlockThreshold = 10;
const int moistureHysteresis = 10;
const unsigned long telemetryInterval = 5000;

DHT dht(dhtPin, DHT11);
WiFiClientSecure wifiClient;
PubSubClient mqtt(wifiClient);

bool automaticMode = true;
bool pumpOn = false;
int moistureLimit = 30;
unsigned long lastTelemetryAt = 0;

String topic(const char *path) {
  return String(MQTT_BASE_TOPIC) + "/" + path;
}

void publishText(const char *path, const char *value) {
  if (mqtt.connected()) {
    mqtt.publish(topic(path).c_str(), value, true);
  }
}

void publishNumber(const char *path, float value, int decimals = 0) {
  char valueBuffer[16];
  dtostrf(value, 1, decimals, valueBuffer);
  publishText(path, valueBuffer);
}

void setPump(bool enabled) {
  // Este projeto usa rele active-low: LOW liga, HIGH desliga.
  digitalWrite(relayPin, enabled ? LOW : HIGH);
  pumpOn = enabled;
  publishText("status/bomba", pumpOn ? "ligada" : "desligada");
}

int percentageFromAnalog(int rawValue, int dryValue, int wetValue) {
  return constrain(map(rawValue, dryValue, wetValue, 0, 100), 0, 100);
}

int readSoilMoisture(int pin) {
  return percentageFromAnalog(analogRead(pin), drySoilValue, wetSoilValue);
}

int readRain() {
  return percentageFromAnalog(analogRead(rainSensorPin), dryRainValue, wetRainValue);
}

void publishTelemetry() {
  int soil[soilSensorCount];
  int soilTotal = 0;

  for (int index = 0; index < soilSensorCount; index++) {
    soil[index] = readSoilMoisture(soilSensorPins[index]);
    soilTotal += soil[index];
  }

  const int averageSoil = soilTotal / soilSensorCount;
  const int rain = readRain();
  const float temperature = dht.readTemperature();
  const float airHumidity = dht.readHumidity();

  if (automaticMode) {
    // A chuva bloqueia a irrigacao automatica por seguranca.
    if (rain >= rainBlockThreshold && pumpOn) {
      setPump(false);
    } else if (rain < rainBlockThreshold && averageSoil <= moistureLimit && !pumpOn) {
      setPump(true);
    } else if (averageSoil >= moistureLimit + moistureHysteresis && pumpOn) {
      setPump(false);
    }
  }

  publishNumber("sensores/umidade_solo_1", soil[0]);
  publishNumber("sensores/umidade_solo_2", soil[1]);
  publishNumber("sensores/umidade_solo_3", soil[2]);
  publishNumber("sensores/chuva", rain);

  if (!isnan(temperature)) {
    publishNumber("sensores/temperatura", temperature, 1);
  }

  if (!isnan(airHumidity)) {
    publishNumber("sensores/umidade_ar", airHumidity, 1);
  }

  publishText("status/bomba", pumpOn ? "ligada" : "desligada");
  publishText("status/modo", automaticMode ? "automatico" : "manual");
  publishText("status/conexao", "online");

  Serial.printf("Solo: %d%% | %d%% | %d%% | media: %d%% | chuva: %d%%\n",
                soil[0], soil[1], soil[2], averageSoil, rain);
}

void handleMessage(char *receivedTopic, byte *payload, unsigned int length) {
  String message;
  for (unsigned int index = 0; index < length; index++) {
    message += static_cast<char>(payload[index]);
  }
  message.trim();
  message.toLowerCase();

  const String received = String(receivedTopic);

  if (received == topic("comandos/bomba")) {
    automaticMode = false;
    setPump(message == "ligar");
    publishText("status/modo", "manual");
    return;
  }

  if (received == topic("comandos/modo")) {
    automaticMode = message == "automatico";
    publishText("status/modo", automaticMode ? "automatico" : "manual");
    return;
  }

  if (received == topic("config/limite_umidade")) {
    moistureLimit = constrain(message.toInt(), 0, 90);
    Serial.printf("Novo limite de umidade: %d%%\n", moistureLimit);
  }
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Conectando ao Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.println(" conectado.");
}

void connectMqtt() {
  while (!mqtt.connected()) {
    const String clientId = "horta-esp32-" + String(static_cast<uint32_t>(ESP.getEfuseMac()), HEX);
    const bool connected = mqtt.connect(
      clientId.c_str(),
      MQTT_USERNAME,
      MQTT_PASSWORD,
      topic("status/conexao").c_str(),
      1,
      true,
      "offline"
    );

    if (connected) {
      mqtt.subscribe(topic("comandos/#").c_str(), 1);
      mqtt.subscribe(topic("config/#").c_str(), 1);
      publishText("status/conexao", "online");
      Serial.println("MQTT conectado.");
    } else {
      Serial.printf("Falha MQTT (codigo %d). Tentando novamente...\n", mqtt.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(relayPin, OUTPUT);
  setPump(false);

  for (int index = 0; index < soilSensorCount; index++) {
    pinMode(soilSensorPins[index], INPUT);
    analogSetPinAttenuation(soilSensorPins[index], ADC_11db);
  }
  pinMode(rainSensorPin, INPUT);
  analogSetPinAttenuation(rainSensorPin, ADC_11db);
  analogReadResolution(12);

  dht.begin();
  wifiClient.setInsecure(); // Para producao, use o certificado CA do broker.
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(handleMessage);

  connectWifi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  if (!mqtt.connected()) {
    connectMqtt();
  }

  mqtt.loop();

  if (millis() - lastTelemetryAt >= telemetryInterval) {
    lastTelemetryAt = millis();
    publishTelemetry();
  }
}
