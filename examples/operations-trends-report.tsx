/** @jsxImportSource @reportflow/core */
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
} from "@reportflow/core";

const React = { createElement, Fragment: "Fragment" };

type ThemePreset = "teal" | "blue" | "green" | "purple";

interface ReportInput {
  company: string;
  businessUnit: string;
  generatedAt: string;
  period: string;
  reportCode?: string;
  watermarkText?: string;
  themePreset?: ThemePreset;
  tableRowCount?: number;
}

interface DataRow {
  timestamp: string;
  line: string;
  throughput: string;
  downtimeMin: number;
  quality: string;
  status: string;
}

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
  return "blue";
};

const pad2 = (value: number): string => value.toString().padStart(2, "0");

const buildRows = (count: number): DataRow[] =>
  Array.from({ length: count }, (_, index) => {
    const totalMinutes = (index * 9) % (24 * 60);
    const day = 1 + Math.floor((index * 9) / (24 * 60));
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const throughput = 72 + (index % 11) * 3 + (index % 4) * 1.2;
    const downtime = index % 17 === 0 ? 19 : index % 9 === 0 ? 11 : index % 5 === 0 ? 7 : 3;
    const quality = 97.2 + ((index % 7) - 3) * 0.35;
    const status =
      downtime > 15
        ? "ALTO RIESGO"
        : downtime > 8
          ? "VIGILAR"
          : index % 13 === 0
            ? "ATENCION"
            : "OK";

    return {
      timestamp: `2026-03-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`,
      line: `LINEA-${(index % 6) + 1}`,
      throughput: throughput.toFixed(1),
      downtimeMin: downtime,
      quality: `${quality.toFixed(1)}%`,
      status
    };
  });

const template = (data: ReportInput) => {
  const preset = resolvePreset(data.themePreset);
  const theme = THEMES[preset];
  const rows = buildRows(Math.max(180, Number(data.tableRowCount ?? 220)));

  const coverPulse = {
    labels: ["W1", "W2", "W3", "W4", "W5", "W6"],
    values: [72, 77, 80, 78, 85, 89]
  };
  const trendLine = {
    labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago"],
    values: [81, 84, 83, 87, 90, 92, 94, 96]
  };
  const trendBar = {
    labels: ["Norte", "Centro", "Sur", "Este", "Oeste", "Export"],
    values: [74, 88, 71, 83, 79, 91]
  };
  const distribution = {
    labels: ["Produccion estable", "Ajustes operativos", "Paros correctivos"],
    values: [64, 24, 12]
  };

  return (
    <Document size="A4" margin={{ top: 30, right: 34, bottom: 34, left: 34 }}>
      <ThemeProvider theme={theme}>
        <Watermark text={data.watermarkText ?? "CONFIDENCIAL"} opacity={0.07} rotate={-28} />

        <Header>
          <Stack gap={6}>
            <Row gap={12}>
              <Col width={0.7}>
                <Stack gap={2}>
                  <Text fontSize={12} fontWeight="bold">
                    {data.company}
                  </Text>
                  <Text fontSize={9}>Reporte de Analisis de Operacion y Tendencias</Text>
                </Stack>
              </Col>
              <Col width={0.3}>
                <Stack gap={2}>
                  <Text fontSize={9} align="right">
                    Unidad: {data.businessUnit}
                  </Text>
                  <Text fontSize={9} align="right">
                    Periodo: {data.period}
                  </Text>
                </Stack>
              </Col>
            </Row>
            <Divider />
          </Stack>
        </Header>

        <Footer>
          <Row gap={8}>
            <Col width={0.7}>
              <Text fontSize={9}>
                {data.reportCode ?? "RF-OPS-001"} | {data.generatedAt}
              </Text>
            </Col>
            <Col width={0.3}>
              <Text fontSize={9} align="right" wrap={false} maxLines={1} overflow="clip">
                Pagina {"{{pageNumber}}"} / {"{{totalPages}}"}
              </Text>
            </Col>
          </Row>
        </Footer>

        <Stack gap={10}>
          <KeepTogether>
            <Card padding={14} radius={16} borderWidth={1}>
              <Stack gap={10}>
                <Badge text="Strategic Canvas" />
                <Row gap={14}>
                  <Col width={0.66}>
                    <Stack gap={5}>
                      <Text fontSize={29} fontWeight="bold" lineHeight={33}>
                        Reporte de Analisis
                      </Text>
                      <Text fontSize={29} fontWeight="bold" lineHeight={33}>
                        de Operacion y Tendencias
                      </Text>
                      <Text fontSize={13} maxLines={2} overflow="shrink" minFontSize={11}>
                        Visualizacion ejecutiva para direccion, gerencia, stakeholders y comite
                        estrategico.
                      </Text>
                      <Text fontSize={10.5}>
                        El comportamiento agregado por unidad confirma que los ajustes de capacidad
                        y el esquema de mantenimiento predictivo estan reduciendo variabilidad sin
                        comprometer calidad.
                      </Text>
                      <Text fontSize={10.5}>
                        Este documento integra narrativa y evidencia visual para facilitar
                        decisiones de corto plazo en asignacion de recursos, continuidad y
                        priorizacion de inversiones operativas.
                      </Text>
                    </Stack>
                  </Col>
                  <Col width={0.34}>
                    <Stack gap={6}>
                      <Card padding={10} radius={12}>
                        <Stack gap={6}>
                          <Text fontSize={10} fontWeight="bold">
                            Pulso semanal
                          </Text>
                          <Chart
                            type="area"
                            height={122}
                            borderRadius={8}
                            data={coverPulse}
                            options={{
                              legend: false,
                              grid: true,
                              showPoints: false,
                              showValues: false,
                              colors: [theme.primaryStrong, theme.primary, theme.accent]
                            }}
                          />
                        </Stack>
                      </Card>
                      <Card padding={8} radius={10}>
                        <Text fontSize={10}>
                          Lectura rapida: tendencia estable con recuperacion mas veloz tras micro
                          paros.
                        </Text>
                      </Card>
                    </Stack>
                  </Col>
                </Row>
              </Stack>
            </Card>
          </KeepTogether>

          <Text fontSize={15} fontWeight="bold">
            KPIs clave
          </Text>
          <Row gap={8}>
            <Col width={0.2}>
              <KPI label="OEE" value="86.4%" delta="+1.2%" status="success" />
            </Col>
            <Col width={0.2}>
              <KPI label="MTTR" value="31 min" delta="-5 min" status="success" />
            </Col>
            <Col width={0.2}>
              <KPI label="Cumplimiento" value="94.8%" delta="+0.9%" status="success" />
            </Col>
            <Col width={0.2}>
              <KPI label="Scrap" value="1.9%" delta="-0.3%" status="success" />
            </Col>
            <Col width={0.2}>
              <KPI label="Incidentes" value="4" delta="+1" status="danger" />
            </Col>
          </Row>

          <KeepTogether>
            <Stack gap={8}>
              <Text fontSize={15} fontWeight="bold">
                Tendencias operativas
              </Text>
              <Row gap={10}>
                <Col width={0.62}>
                  <Chart
                    type="line"
                    height={176}
                    borderRadius={10}
                    data={trendLine}
                    options={{
                      title: "Evolucion de desempeno mensual",
                      titleAlign: "left",
                      legend: true,
                      legendPosition: "bottom",
                      grid: true,
                      showValues: true,
                      showPoints: true,
                      yAxisMin: 70,
                      colors: [theme.primaryStrong, theme.primary, theme.accent]
                    }}
                  />
                </Col>
                <Col width={0.38}>
                  <Card padding={12} radius={12}>
                    <Stack gap={6}>
                      <Badge tone="info" text="Lectura ejecutiva" />
                      <Text fontSize={11}>
                        La curva mensual confirma una trayectoria ascendente con menor dispersion
                        entre semanas y un comportamiento mas estable en tramos de mayor carga.
                      </Text>
                    </Stack>
                  </Card>
                </Col>
              </Row>
            </Stack>
          </KeepTogether>

          <Row gap={10}>
            <Col width={0.42}>
              <Card padding={12} radius={12}>
                <Stack gap={6}>
                  <Badge tone="warning" text="Comparativo por unidad" />
                  <Text fontSize={11}>
                    El comparativo entre unidades expone una brecha moderada entre sitios de mejor y
                    menor rendimiento. La oportunidad inmediata esta en estandarizar rutinas de
                    set-up y respuesta a incidencias.
                  </Text>
                  <Text fontSize={11}>
                    Consolidar practicas operativas comunes podria elevar la base de desempeno sin
                    ampliar infraestructura.
                  </Text>
                </Stack>
              </Card>
            </Col>
            <Col width={0.58}>
              <Chart
                type="bar"
                height={172}
                borderRadius={10}
                data={trendBar}
                options={{
                  title: "Comparativa de rendimiento por unidad",
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
            </Col>
          </Row>

          <Text fontSize={15} fontWeight="bold">
            Distribucion y composicion
          </Text>
          <Row gap={10}>
            <Col width={0.45}>
              <Chart
                type="bar"
                height={220}
                borderRadius={10}
                data={distribution}
                options={{
                  title: "Composicion de eventos operativos",
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
            </Col>
            <Col width={0.55}>
              <Stack gap={8}>
                <Card padding={12} radius={12}>
                  <Stack gap={6}>
                    <Badge tone="success" text="Interpretacion rapida" />
                    <Text fontSize={11}>
                      La mayor parte del tiempo operativo ya se concentra en bloques de produccion
                      estable. Los ajustes operativos mantienen una proporcion controlada y los
                      paros correctivos se reducen respecto al corte anterior.
                    </Text>
                  </Stack>
                </Card>
                <Card padding={12} radius={12}>
                  <Stack gap={6}>
                    <Badge tone="info" text="Implicacion estrategica" />
                    <Text fontSize={11}>
                      Con esta composicion, el siguiente salto de valor no depende de aumentar
                      capacidad sino de optimizar consistencia entre unidades y acelerar cierre de
                      alertas recurrentes.
                    </Text>
                  </Stack>
                </Card>
              </Stack>
            </Col>
          </Row>

          <Text fontSize={15} fontWeight="bold">
            Insights clave
          </Text>
          <Row gap={8}>
            <Col width={0.58}>
              <Card padding={12} radius={12}>
                <Stack gap={6}>
                  <Badge tone="success" text="Insight 1 | Continuidad" />
                  <Text fontSize={11}>
                    La continuidad operativa mejora de forma consistente, especialmente en lineas
                    con mayor variabilidad historica. Esto indica que las acciones correctivas
                    recientes estan impactando en la causa raiz y no solo en sintomas.
                  </Text>
                </Stack>
              </Card>
            </Col>
            <Col width={0.42}>
              <Card padding={12} radius={12}>
                <Stack gap={6}>
                  <Badge tone="warning" text="Insight 2 | Riesgo" />
                  <Text fontSize={11}>
                    Persisten nodos con alertas ciclicas en ventanas de alta demanda. Conviene
                    reforzar mantenimiento preventivo y cobertura en turnos criticos.
                  </Text>
                </Stack>
              </Card>
            </Col>
          </Row>
          <Row gap={8}>
            <Col width={0.42}>
              <Card padding={12} radius={12}>
                <Stack gap={6}>
                  <Badge tone="info" text="Insight 3 | Eficiencia" />
                  <Text fontSize={11}>
                    El sistema esta listo para capturar eficiencia adicional mediante
                    estandarizacion de set-up y secuencias de arranque, sin cambios estructurales en
                    tecnologia.
                  </Text>
                </Stack>
              </Card>
            </Col>
            <Col width={0.58}>
              <Card padding={12} radius={12}>
                <Stack gap={6}>
                  <Badge tone="danger" text="Insight 4 | Prioridad" />
                  <Text fontSize={11}>
                    La prioridad de corto plazo debe centrarse en dos frentes: disminuir eventos de
                    alto impacto en lineas con mayor contribucion al volumen total y elevar
                    velocidad de respuesta en incidentes de calidad para evitar perdida acumulada.
                  </Text>
                </Stack>
              </Card>
            </Col>
          </Row>

          <Text fontSize={15} fontWeight="bold">
            Datos detallados
          </Text>
          <Text fontSize={11}>
            La siguiente tabla presenta el detalle cronologico por linea para validar volumen,
            tiempos de paro y estado operativo. Se mantiene header repetido para facilitar lectura
            en paginacion extensa.
          </Text>
          <Table
            columns={[
              { key: "timestamp", title: "Timestamp", width: 0.24 },
              { key: "line", title: "Linea", width: 0.14 },
              { key: "throughput", title: "Throughput", width: 0.15, align: "right" },
              { key: "downtimeMin", title: "Downtime min", width: 0.18, align: "right" },
              { key: "quality", title: "Quality", width: 0.13, align: "right" },
              { key: "status", title: "Estado", width: 0.16 }
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
            <Card padding={14} radius={14}>
              <Stack gap={8}>
                <Badge text="Cierre ejecutivo" />
                <Text fontSize={14} fontWeight="bold">
                  Sintesis final para comite estrategico
                </Text>
                <Text fontSize={11}>
                  El escenario general es favorable: mejora de continuidad, mayor estabilidad en
                  desempeno y mejor capacidad de respuesta ante eventos operativos. La siguiente
                  etapa debe consolidar disciplina transversal entre unidades para cerrar brechas de
                  rendimiento y sostener calidad bajo demanda variable.
                </Text>
                <Text fontSize={11}>
                  La recomendacion es mantener el enfoque en estandarizacion operativa, instrumentar
                  seguimiento semanal de nodos recurrentes y priorizar acciones de alto impacto
                  sobre disponibilidad y calidad.
                </Text>
                <Row gap={8}>
                  <Col width={0.34}>
                    <KPI
                      label="Meta trimestral"
                      value="En ruta"
                      delta="+3.4 pts"
                      status="success"
                    />
                  </Col>
                  <Col width={0.33}>
                    <KPI
                      label="Riesgo operativo"
                      value="Moderado"
                      delta="-1 nivel"
                      status="success"
                    />
                  </Col>
                  <Col width={0.33}>
                    <KPI
                      label="Prioridad inmediata"
                      value="Alertas criticas"
                      delta="+foco"
                      status="danger"
                    />
                  </Col>
                </Row>
              </Stack>
            </Card>
          </KeepTogether>
        </Stack>
      </ThemeProvider>
    </Document>
  );
};

export default template;
