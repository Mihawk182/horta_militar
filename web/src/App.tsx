import { FormEvent, useEffect, useMemo, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import type { BrokerState, Readings } from "./types";

const BROKER_URL = "wss://e724464d.ala.us-east-1.emqxsl.com:8084/mqtt";
const BASE_TOPIC = "horta-militar/001";
const STORAGE_KEY = "horta-militar-mqtt-credentials";

const emptyReadings: Readings = { soil1: null, soil2: null, soil3: null, temperature: null, airHumidity: null, rain: null, pump: null, mode: null, espOnline: false, lastUpdate: null };
type Credentials = { username: string; password: string };

function getCredentials(): Credentials {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { username: "", password: "" }; }
  catch { return { username: "", password: "" }; }
}
function toNumber(payload: string) { const value = Number(payload); return Number.isFinite(value) ? value : null; }
function percentage(value: number | null) { return value === null ? "--" : `${Math.round(value)}%`; }
function metricStatus(value: number | null, rain = false) {
  if (value === null) return "Aguardando leitura";
  if (rain) return value >= 10 ? "Chuva detectada" : "Sem chuva";
  if (value < 30) return "Atenção: seco";
  if (value < 55) return "Nível moderado";
  return "Umidade adequada";
}

export default function App() {
  const [credentials, setCredentials] = useState<Credentials>(getCredentials);
  const [draft, setDraft] = useState<Credentials>(getCredentials);
  const [showSettings, setShowSettings] = useState(false);
  const [brokerState, setBrokerState] = useState<BrokerState>(credentials.username && credentials.password ? "conectando" : "configurar");
  const [readings, setReadings] = useState<Readings>(emptyReadings);
  const [lastMessage, setLastMessage] = useState("Nenhuma telemetria recebida ainda.");

  useEffect(() => {
    if (!credentials.username || !credentials.password) return;
    setBrokerState("conectando");
    const client: MqttClient = mqtt.connect(BROKER_URL, { clientId: `horta-painel-${crypto.randomUUID()}`, username: credentials.username, password: credentials.password, clean: true, connectTimeout: 8000, reconnectPeriod: 3000 });
    client.on("connect", () => { setBrokerState("conectado"); client.subscribe(`${BASE_TOPIC}/#`, { qos: 1 }); });
    client.on("reconnect", () => setBrokerState("conectando"));
    client.on("close", () => setBrokerState("desconectado"));
    client.on("error", () => setBrokerState("erro"));
    client.on("message", (receivedTopic, payloadBuffer) => {
      const payload = payloadBuffer.toString().trim(); const path = receivedTopic.replace(`${BASE_TOPIC}/`, ""); const numeric = toNumber(payload); const updatedAt = new Date().toLocaleTimeString("pt-BR");
      setReadings((previous) => {
        const next = { ...previous, lastUpdate: updatedAt };
        if (path === "sensores/umidade_solo_1") next.soil1 = numeric;
        if (path === "sensores/umidade_solo_2") next.soil2 = numeric;
        if (path === "sensores/umidade_solo_3") next.soil3 = numeric;
        if (path === "sensores/temperatura") next.temperature = numeric;
        if (path === "sensores/umidade_ar") next.airHumidity = numeric;
        if (path === "sensores/chuva") next.rain = numeric;
        if (path === "status/bomba") next.pump = payload;
        if (path === "status/modo") next.mode = payload;
        if (path === "status/conexao") next.espOnline = payload.toLowerCase() === "online";
        return next;
      });
      setLastMessage(`${path}: ${payload}`);
    });
    return () => { client.end(true); };
  }, [credentials]);

  const averageSoil = useMemo(() => {
    const values = [readings.soil1, readings.soil2, readings.soil3].filter((value): value is number => value !== null);
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  }, [readings.soil1, readings.soil2, readings.soil3]);

  function saveCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); setCredentials(draft); setShowSettings(false);
  }
  const connectionLabel = readings.espOnline ? "ESP32 online" : brokerState === "conectado" ? "Aguardando ESP32" : brokerState === "configurar" ? "Configurar acesso" : brokerState;
  const sensorCards = [
    ["Canteiro 01", percentage(readings.soil1), metricStatus(readings.soil1), "solo"],
    ["Canteiro 02", percentage(readings.soil2), metricStatus(readings.soil2), "solo"],
    ["Canteiro 03", percentage(readings.soil3), metricStatus(readings.soil3), "solo"],
    ["Sensor de chuva", percentage(readings.rain), metricStatus(readings.rain, true), "chuva"],
  ];

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark">CBM</div><div><p>Colégio Militar do Corpo de Bombeiros</p><h1>Horta Inteligente</h1></div></div><div className={`connection connection--${readings.espOnline ? "online" : brokerState}`}><span className="status-dot" />{connectionLabel}</div></header>
    <section className="hero"><div><p className="eyebrow">Monitoramento em tempo real</p><h2>Leituras da horta</h2><p className="hero-copy">Painel de acompanhamento dos sensores conectados ao ESP32.</p></div><button className="settings-button" onClick={() => setShowSettings((visible) => !visible)}>{showSettings ? "Fechar configuração" : "Conectar painel"}</button></section>
    {showSettings && <form className="settings" onSubmit={saveCredentials}><div><strong>Conexão MQTT</strong><span>As credenciais são salvas somente neste navegador.</span></div><label>Usuário<input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} required /></label><label>Senha<input type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} required /></label><button type="submit">Salvar e conectar</button></form>}
    <section className="primary-grid"><article className="primary-card soil-summary"><div className="card-heading"><span>Umidade média do solo</span><span className="chip">3 canteiros</span></div><strong>{percentage(averageSoil)}</strong><p>{metricStatus(averageSoil)}</p><div className="progress"><span style={{ width: `${averageSoil ?? 0}%` }} /></div></article><article className="primary-card climate-summary"><div className="card-heading"><span>Condições ambientais</span><span className="chip">DHT11</span></div><div className="climate-values"><div><small>Temperatura</small><strong>{readings.temperature === null ? "--" : `${readings.temperature.toFixed(1)}°C`}</strong></div><div><small>Umidade do ar</small><strong>{percentage(readings.airHumidity)}</strong></div></div></article></section>
    <section className="sensor-grid">{sensorCards.map(([title, value, description, icon]) => <article className="sensor-card" key={title}><span className={`sensor-icon sensor-icon--${icon}`}>{icon === "chuva" ? "◒" : "◉"}</span><p>{title}</p><strong>{value}</strong><small>{description}</small></article>)}</section>
    <section className="telemetry-bar"><div><span>Estado da bomba</span><strong>{readings.pump ?? "--"}</strong></div><div><span>Modo do ESP32</span><strong>{readings.mode ?? "--"}</strong></div><div><span>Última atualização</span><strong>{readings.lastUpdate ?? "--:--:--"}</strong></div><div className="message"><span>Última mensagem</span><strong>{lastMessage}</strong></div></section>
  </main>;
}
