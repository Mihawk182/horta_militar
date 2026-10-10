# Mapeamento da placa ESP32 DevKit

A placa usada no projeto e uma ESP32 DevKit com modulo ESP32-WROOM-32.

## Pinos visiveis na placa

Lado esquerdo, de baixo para cima:

```text
VIN
GND
D13
D12
D14
D27
D26
D25
D33
D32
D35
D34
VN
VP
EN
```

Lado direito, de baixo para cima:

```text
3V3
GND
D15
D2
D4
RX2
TX2
D5
D18
D19
D21
RX0
TX0
D22
D23
```

## Ligacao usada no projeto da horta

Sensor de umidade do solo:

```text
AOUT -> D34
VCC  -> 3V3
GND  -> GND
```

Modulo rele da bomba:

```text
IN   -> D26
VCC  -> VIN/5V ou 3V3, conforme o modulo rele
GND  -> GND
```

No firmware atual:

```cpp
const int soilMoisturePin = 34;
const int pumpRelayPin = 26;
```

## Pinos recomendados para expansao

```text
D34 -> umidade do solo, leitura analogica
D26 -> rele da bomba
D27 -> DHT11/DHT22, temperatura e umidade do ar
D25 -> LED/status ou outro atuador
D32 -> segundo sensor analogico
D33 -> terceiro sensor analogico
```

## Cuidados importantes

- Os GPIOs do ESP32 trabalham com sinal de 3.3V. Nao envie 5V direto para nenhum pino de sinal.
- D34, D35, VN e VP sao somente entrada. Sao bons para sensores, mas nao servem para acionar rele, LED ou atuador.
- TX0 e RX0 sao usados pela comunicacao USB/Serial. Evite usar esses pinos se estiver gravando ou depurando pelo cabo USB.
- D2, D4, D5, D12 e D15 podem influenciar a inicializacao da placa dependendo do circuito ligado. Use com cuidado.
- Alguns modulos de rele sao ativo-baixo. Se a bomba ligar quando deveria desligar, pode ser necessario inverter a logica no firmware.
