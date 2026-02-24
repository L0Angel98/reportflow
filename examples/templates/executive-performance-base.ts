export interface ExecutiveKPI {
  label: string;
  value: string;
  delta?: string;
  status?: "neutral" | "success" | "danger" | "warning";
}

export interface ExecutiveTrend {
  labels: string[];
  values: number[];
}

export interface ExecutiveReading {
  timestamp: string;
  sensor: string;
  value: string;
  status: string;
}

export interface ExecutivePerformanceBase {
  reportTitle: string;
  subtitle: string;
  sectionLabel: string;
  kpis: ExecutiveKPI[];
  trend: ExecutiveTrend;
  observations: string;
}

const pad2 = (value: number): string => value.toString().padStart(2, "0");

const formatTimestamp = (minutesFromStart: number): string => {
  const totalMinutes = minutesFromStart % (24 * 60);
  const dayOffset = Math.floor(minutesFromStart / (24 * 60));
  const day = 20 + dayOffset;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `2026-02-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`;
};

const sensorAt = (index: number): string => `NODE-${(index % 12) + 1}`;

const statusAt = (index: number): string => {
  if (index % 19 === 0) {
    return "ALERTA";
  }
  if (index % 8 === 0) {
    return "ATENCION";
  }
  return "OK";
};

export const buildExecutiveRows = (count: number): ExecutiveReading[] =>
  Array.from({ length: count }, (_, index) => ({
    timestamp: formatTimestamp(index * 7),
    sensor: sensorAt(index),
    value: (18 + (index % 15) * 0.87 + (index % 3) * 0.21).toFixed(2),
    status: statusAt(index)
  }));

export const EXECUTIVE_PERFORMANCE_BASE: ExecutivePerformanceBase = {
  reportTitle: "Resumen Ejecutivo de Desempeno",
  subtitle: "Reporte tecnico y ejecutivo para direccion",
  sectionLabel: "Executive Briefing",
  kpis: [
    { label: "Disponibilidad", value: "99.32%", delta: "+0.8%", status: "success" },
    { label: "MTTR", value: "36 min", delta: "-4 min", status: "success" },
    { label: "Alertas criticas", value: "5", delta: "-2", status: "success" },
    { label: "Energia especifica", value: "1.28 kWh/u", delta: "+0.06", status: "warning" }
  ],
  trend: {
    labels: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"],
    values: [82, 88, 91, 87, 95, 99, 101, 106]
  },
  observations:
    "La planta mantiene un nivel alto de continuidad operativa y una tendencia positiva de produccion. " +
    "Las alertas se concentran en ventanas de alta demanda electrica y en un subconjunto reducido de nodos. " +
    "Se recomienda conservar la estrategia de mantenimiento predictivo, reforzar limpieza de sensores en " +
    "linea secundaria y sostener monitoreo de energia especifica por turno. " +
    "El equipo de operaciones valida que no hay desbordes de capacidad y que el riesgo inmediato es bajo, " +
    "aunque existe oportunidad de mejora en tiempos de respuesta ante micro-paros. " +
    "Como accion de siguiente ciclo, priorizar recalibracion de nodos con eventos recurrentes y revisar " +
    "distribucion de cargas para mantener estabilidad del sistema durante picos de produccion."
};
