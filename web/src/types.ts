export type Readings = {
  soil1: number | null; soil2: number | null; soil3: number | null;
  temperature: number | null; airHumidity: number | null; rain: number | null;
  pump: string | null; mode: string | null; espOnline: boolean; lastUpdate: string | null;
};
export type BrokerState = "configurar" | "conectando" | "conectado" | "erro" | "desconectado";
