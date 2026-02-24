/** @jsxImportSource @angel-vlqz/reportflow-core */
import {
  Badge,
  Card,
  Chart,
  Col,
  Divider,
  Document,
  Footer,
  Header,
  KPI,
  KeepTogether,
  Row,
  Stack,
  Table,
  Text,
  ThemeProvider,
  Watermark,
  createElement,
  type ThemeTokens
} from "@angel-vlqz/reportflow-core";
 
const React = { createElement, Fragment: "Fragment" };

type ThemePreset = "teal" | "blue" | "green" | "purple";

interface ExecutiveKPI {
  label: string;
  value: string;
  delta?: string;
  status?: "neutral" | "success" | "danger" | "warning";
}

interface ExecutiveTrend {
  labels: string[];
  values: number[];
}

interface ExecutivePerformanceInput {
  company: string;
  plant: string;
  generatedAt: string;
  period: string;
  themePreset?: ThemePreset;
  reportCode?: string;
  tableRowCount?: number;
  watermarkText?: string;
}

interface ExecutivePerformanceBase {
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

const buildExecutiveRows = (
  count: number
): Array<{ timestamp: string; sensor: string; value: string; status: string }> =>
  Array.from({ length: count }, (_, index) => ({
    timestamp: formatTimestamp(index * 7),
    sensor: `NODE-${(index % 12) + 1}`,
    value: (18 + (index % 15) * 0.87 + (index % 3) * 0.21).toFixed(2),
    status: index % 19 === 0 ? "ALERTA" : index % 8 === 0 ? "ATENCION" : "OK"
  }));

const EXECUTIVE_PERFORMANCE_BASE: ExecutivePerformanceBase = {
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

const THEMES: Record<ThemePreset, ThemeTokens> = {
  teal: {
    primary: "#0F766E",
    primarySoft: "#D5F5F1",
    primaryStrong: "#115E59",
    accent: "#0EA5A0",
    background: "#F2F8F7",
    surface: "#FFFFFF",
    text: "#0F172A",
    muted: "#5F6C7B",
    success: "#15803D",
    danger: "#B42318"
  },
  blue: {
    primary: "#1D4ED8",
    primarySoft: "#DCE8FF",
    primaryStrong: "#1E3A8A",
    accent: "#0EA5E9",
    background: "#F3F7FC",
    surface: "#FFFFFF",
    text: "#0F172A",
    muted: "#637389",
    success: "#15803D",
    danger: "#B42318"
  },
  green: {
    primary: "#2E7D32",
    primarySoft: "#DDF5E0",
    primaryStrong: "#1B5E20",
    accent: "#0F9D58",
    background: "#F2F8F2",
    surface: "#FFFFFF",
    text: "#101828",
    muted: "#5E6E62",
    success: "#15803D",
    danger: "#B42318"
  },
  purple: {
    primary: "#7C3AED",
    primarySoft: "#EBDDFF",
    primaryStrong: "#5B21B6",
    accent: "#A855F7",
    background: "#F7F3FC",
    surface: "#FFFFFF",
    text: "#111827",
    muted: "#677085",
    success: "#15803D",
    danger: "#B42318"
  }
};

const resolvePreset = (preset: ThemePreset | undefined): ThemePreset => {
  if (preset && preset in THEMES) {
    return preset;
  }
  return "teal";
};

const template = (input: ExecutivePerformanceInput) => {
  const preset = resolvePreset(input.themePreset);
  const theme = THEMES[preset];
  const rows = buildExecutiveRows(Math.max(120, Number(input.tableRowCount ?? 180)));

  return (
    <Document size="A4" margin={{ top: 34, right: 34, bottom: 36, left: 34 }}>
      <ThemeProvider theme={theme}>
        <Watermark text={input.watermarkText ?? "CONFIDENCIAL"} opacity={0.08} rotate={-30} />

        <Header>
          <Stack gap={6}>
            <Row gap={10}>
              <Col width={0.65}>
                <Stack gap={2}>
                  <Text fontSize={11} fontWeight="bold">
                    {input.company}
                  </Text>
                  <Text fontSize={9}>{EXECUTIVE_PERFORMANCE_BASE.subtitle}</Text>
                </Stack>
              </Col>
              <Col width={0.35}>
                <Text fontSize={9} align="right">
                  Tema: {preset.toUpperCase()}
                </Text>
              </Col>
            </Row>
            <Divider />
          </Stack>
        </Header>

        <Footer>
          <Row>
            <Col width={0.7}>
              <Text fontSize={9}>
                {input.reportCode ?? "RF-EXEC-001"} | {input.plant}
              </Text>
            </Col>
            <Col width={0.3}>
              <Text fontSize={9} align="right" wrap={false} maxLines={1} overflow="clip">
                Pagina {"{{pageNumber}}"} / {"{{totalPages}}"}
              </Text>
            </Col>
          </Row>
        </Footer>

        <Stack gap={12}>
          <KeepTogether>
            <Card padding={16} radius={14} borderWidth={1}>
              <Stack gap={10}>
                <Badge text={EXECUTIVE_PERFORMANCE_BASE.sectionLabel} />
                <Text
                  fontSize={28}
                  fontWeight="bold"
                  maxLines={2}
                  overflow="shrink"
                  minFontSize={22}
                >
                  {EXECUTIVE_PERFORMANCE_BASE.reportTitle}
                </Text>
                <Row gap={14}>
                  <Col width={0.33}>
                    <Stack gap={2}>
                      <Text fontSize={10} fontWeight="bold">
                        Planta
                      </Text>
                      <Text>{input.plant}</Text>
                    </Stack>
                  </Col>
                  <Col width={0.34}>
                    <Stack gap={2}>
                      <Text fontSize={10} fontWeight="bold">
                        Generado
                      </Text>
                      <Text>{input.generatedAt}</Text>
                    </Stack>
                  </Col>
                  <Col width={0.33}>
                    <Stack gap={2}>
                      <Text fontSize={10} fontWeight="bold" align="right">
                        Periodo
                      </Text>
                      <Text align="right">{input.period}</Text>
                    </Stack>
                  </Col>
                </Row>
              </Stack>
            </Card>
          </KeepTogether>

          <Text fontSize={14} fontWeight="bold">
            KPIs Operativos
          </Text>
          <Row gap={8}>
            {EXECUTIVE_PERFORMANCE_BASE.kpis.map((kpi) => (
              <Col width={0.25}>
                <KPI
                  label={kpi.label}
                  value={kpi.value}
                  delta={kpi.delta}
                  status={kpi.status}
                  align="left"
                />
              </Col>
            ))}
          </Row>

          <Text fontSize={14} fontWeight="bold">
            Tendencia Semanal
          </Text>
          <KeepTogether>
            <Chart
              type="bar"
              height={210}
              borderRadius={10}
              data={EXECUTIVE_PERFORMANCE_BASE.trend}
              options={{
                title: "Volumen por semana (m3)",
                titleAlign: "center",
                legend: true,
                legendPosition: "bottom",
                grid: true,
                showValues: true,
                showPoints: false,
                yAxisMin: 0,
                colors: [theme.primaryStrong, theme.primary, theme.accent]
              }}
            />
          </KeepTogether>

          <Text fontSize={14} fontWeight="bold">
            Lecturas IoT (tabla larga)
          </Text>
          <Table
            columns={[
              { key: "timestamp", title: "Timestamp", width: 0.28 },
              { key: "sensor", title: "Sensor", width: 0.22 },
              { key: "value", title: "Valor", width: 0.2, align: "right" },
              { key: "status", title: "Estado", width: 0.3 }
            ]}
            rows={rows}
            rowHeight={20}
            headerHeight={24}
            borderRadius={10}
            headerAlign="center"
            cellPadding={5}
            showOuterBorder
            repeatHeader
            keepRowsTogether
            keepWithHeader
          />

          <KeepTogether>
            <Card padding={12} radius={10}>
              <Stack gap={6}>
                <Text fontSize={13} fontWeight="bold">
                  Observaciones ejecutivas
                </Text>
                <Text fontSize={11} maxLines={20} overflow="shrink" minFontSize={8}>
                  {EXECUTIVE_PERFORMANCE_BASE.observations}
                </Text>
              </Stack>
            </Card>
          </KeepTogether>
        </Stack>
      </ThemeProvider>
    </Document>
  );
};

export default template;
