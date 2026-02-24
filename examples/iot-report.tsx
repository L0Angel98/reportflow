/** @jsxImportSource @angel-vlqz/reportflow-core */
import {
  Col,
  createElement,
  Divider,
  Document,
  Footer,
  Header,
  Row,
  Stack,
  Table,
  Text
} from "@angel-vlqz/reportflow-core";

const React = { createElement, Fragment: "Fragment" };

interface Metric {
  label: string;
  value: string;
}

interface IoTRow extends Record<string, unknown> {
  timestamp: string;
  sensor: string;
  value: string;
  status: string;
}

interface IoTData {
  plant: string;
  date: string;
  summary: Metric[];
  readings: IoTRow[];
}

const template = (data: IoTData) => (
  <Document size="LETTER" margin={40}>
    <Header>
      <Stack gap={4}>
        <Text fontSize={12} fontWeight="bold">
          Dashboard IoT · {data.plant}
        </Text>
        <Divider />
      </Stack>
    </Header>

    <Footer>
      <Text fontSize={10} wrap={false} maxLines={1} overflow="clip">
        Página {"{{pageNumber}}"} / {"{{totalPages}}"}
      </Text>
    </Footer>

    <Stack gap={10}>
      <Text fontSize={18} fontWeight="bold">
        Reporte Operacional IoT
      </Text>
      <Text fontSize={11}>Fecha de corte: {data.date}</Text>

      <Row gap={8}>
        {data.summary.map((metric) => (
          <Col width={1 / data.summary.length}>
            <Stack gap={4}>
              <Text fontSize={11} fontWeight="bold">
                {metric.label}
              </Text>
              <Text fontSize={15}>{metric.value}</Text>
            </Stack>
          </Col>
        ))}
      </Row>

      <Divider />

      <Text fontSize={14} fontWeight="bold">
        Lecturas Históricas
      </Text>
      <Table
        columns={[
          { key: "timestamp", title: "Timestamp", width: 0.28 },
          { key: "sensor", title: "Sensor", width: 0.28 },
          { key: "value", title: "Valor", width: 0.18, align: "right" },
          { key: "status", title: "Estado", width: 0.26 }
        ]}
        rows={data.readings}
        rowHeight={20}
        headerHeight={24}
        repeatHeader
        keepWithHeader
        keepRowsTogether
      />
    </Stack>
  </Document>
);

export default template;
