# Topicos MQTT

Use um prefixo unico para evitar conflito com outros projetos:

```text
horta-militar/001
```

## Telemetria publicada pelo ESP32

```text
horta-militar/001/sensores/umidade_solo
horta-militar/001/sensores/temperatura
horta-militar/001/sensores/umidade_ar
horta-militar/001/status/bomba
horta-militar/001/status/modo
horta-militar/001/status/conexao
```

## Comandos publicados pelo site

```text
horta-militar/001/comandos/bomba
horta-militar/001/comandos/modo
horta-militar/001/config/limite_umidade
```

## Valores esperados

`comandos/bomba`:

```text
ligar
desligar
```

`comandos/modo`:

```text
automatico
manual
```

`config/limite_umidade`:

```text
35
```

O limite representa porcentagem de umidade do solo. Abaixo desse valor, no modo automatico, o ESP32 pode ligar a irrigacao.
