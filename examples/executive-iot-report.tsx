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
  Logo,
  Row,
  Stack,
  Table,
  Text,
  ThemeProvider,
  Watermark,
  createElement
} from "@reportflow/core";

const React = { createElement, Fragment: "Fragment" };

interface ExecutiveKPI {
  label: string;
  value: string;
  delta?: string;
  status?: "neutral" | "success" | "danger" | "warning";
}

interface ExecutiveData {
  company: string;
  reportTitle: string;
  generatedAt: string;
  period: string;
  plant: string;
  logo: string;
  kpis: ExecutiveKPI[];
  trend: {
    labels: string[];
    values: number[];
  };
  readings: Array<{
    timestamp: string;
    sensor: string;
    value: string;
    status: string;
  }>;
  observations: string;
}

const template = (data: ExecutiveData) => (
  <Document size="A4" margin={{ top: 34, right: 34, bottom: 36, left: 34 }}>
    <ThemeProvider
      theme={{
        primary: "#0B5FFF",
        primarySoft: "#DDE7FA",
        primaryStrong: "#1E3A8A",
        accent: "#14B8A6",
        background: "#F4F7FB",
        surface: "#FFFFFF",
        text: "#0B1220",
        muted: "#5B6B82",
        success: "#16A34A",
        danger: "#D92D20"
      }}
    >
      <Watermark text="CONFIDENCIAL" opacity={0.09} rotate={-32} fontSize={64} />

      <Header>
        <Row gap={12}>
          <Col width={0.18}>
            <Logo src={data.logo} maxHeight={30} align="left" />
          </Col>
          <Col width={0.62}>
            <Stack gap={2}>
              <Text fontSize={11} fontWeight="bold">
                {data.company}
              </Text>
              <Text fontSize={9}>Reporte Ejecutivo IoT</Text>
            </Stack>
          </Col>
          <Col width={0.2}>
            <Text fontSize={9} align="right">
              Periodo: {data.period}
            </Text>
          </Col>
        </Row>
        <Divider />
      </Header>

      <Footer>
        <Row>
          <Col width={0.7}>
            <Text fontSize={9}>
              {data.reportTitle} · {data.plant}
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
          <Card padding={14} radius={14} borderWidth={1}>
            <Stack gap={10}>
              <Badge tone="info" text="Executive Briefing" />
              <Text fontSize={24} fontWeight="bold">
                {data.reportTitle}
              </Text>
              <Row gap={16}>
                <Col width={0.35}>
                  <Stack gap={2}>
                    <Text fontSize={10} fontWeight="bold">
                      Planta
                    </Text>
                    <Text>{data.plant}</Text>
                  </Stack>
                </Col>
                <Col width={0.35}>
                  <Stack gap={2}>
                    <Text fontSize={10} fontWeight="bold">
                      Generado
                    </Text>
                    <Text>{data.generatedAt}</Text>
                  </Stack>
                </Col>
                <Col width={0.3}>
                  <Stack gap={2}>
                    <Text fontSize={10} fontWeight="bold" align="right">
                      Periodo
                    </Text>
                    <Text align="right">{data.period}</Text>
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
          {data.kpis.map((kpi) => (
            <Col width={1 / data.kpis.length}>
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
          Tendencia de Produccion
        </Text>
        <KeepTogether>
          <Chart
            type="area"
            height={210}
            borderRadius={10}
            data={data.trend}
            options={{
              title: "Volumen por semana (m3)",
              legend: true,
              grid: true,
              titleAlign: "center",
              legendPosition: "bottom",
              showValues: true,
              showPoints: false,
              yAxisMin: 0
            }}
            align="left"
          />
        </KeepTogether>

        <Text fontSize={14} fontWeight="bold">
          Lecturas IoT (tabla larga)
        </Text>
        <Table
          columns={[
            { key: "timestamp", title: "Timestamp", width: 0.28 },
            { key: "sensor", title: "Sensor", width: 0.26 },
            { key: "value", title: "Valor", width: 0.18, align: "right" },
            { key: "status", title: "Estado", width: 0.28 }
          ]}
          rows={data.readings}
          rowHeight={20}
          headerHeight={24}
          borderRadius={10}
          headerAlign="center"
          cellPadding={5}
          showOuterBorder
          repeatHeader
          keepWithHeader
          keepRowsTogether
        />

        <KeepTogether>
          <Card padding={12}>
            <Stack gap={6}>
              <Text fontSize={13} fontWeight="bold">
                Observaciones ejecutivas
              </Text>
              <Text fontSize={11} maxLines={22} overflow="shrink" minFontSize={8}>
                {data.observations}
              </Text>
            </Stack>
          </Card>
        </KeepTogether>
      </Stack>
    </ThemeProvider>
  </Document>
);

export default template;
