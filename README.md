# Horta Militar IoT

Projeto de horta escolar com ESP32, sensores e painel web hospedado no GitHub Pages.

## Arquitetura

```text
Sensores -> ESP32 -> MQTT Broker <- Site GitHub Pages
Atuadores <- ESP32 <- MQTT Broker <- Site GitHub Pages
```

O GitHub Pages hospeda apenas a interface. A troca de dados e comandos acontece por MQTT.

## Estrutura

- `web/`: site estatico para publicar no GitHub Pages.
- `firmware/esp32_horta_mqtt/`: codigo Arduino para o ESP32.
- `docs/`: anotacoes de montagem, topicos MQTT e proximos passos.

## Ferramentas recomendadas

- Visual Studio Code
- Extensao PlatformIO ou Arduino IDE
- Conta em um MQTT broker com WebSocket, por exemplo HiveMQ Cloud ou EMQX Cloud

## Proximos passos

1. Criar um broker MQTT online.
2. Preencher as configuracoes em `web/app.js`.
3. Copiar `firmware/esp32_horta_mqtt/config.example.h` para `config.h`.
4. Preencher Wi-Fi e MQTT no `config.h`.
5. Gravar o firmware no ESP32.
6. Publicar a pasta `web/` no GitHub Pages.
