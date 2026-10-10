#include <DHT.h>

const int dhtPin = 27;
const int dhtType = DHT11;

DHT dht(dhtPin, dhtType);

void setup() {
  Serial.begin(115200);
  dht.begin();

  Serial.println("Teste DHT11 iniciado");
  Serial.println("Ligacao:");
  Serial.println("VCC  -> 3V3");
  Serial.println("GND  -> GND");
  Serial.println("DATA -> D27 / GPIO27");
}

void loop() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Falha ao ler o DHT11. Confira fios, pino e resistor pull-up.");
    delay(2000);
    return;
  }

  Serial.print("Temperatura: ");
  Serial.print(temperature);
  Serial.print(" C | Umidade do ar: ");
  Serial.print(humidity);
  Serial.println(" %");

  delay(2000);
}
