/** @jsxImportSource @angel-vlqz/reportflow-core */
import {
  Col,
  createElement,
  Divider,
  Document,
  Footer,
  Header,
  Image,
  KeepTogether,
  Row,
  Stack,
  Table,
  Text
} from "@angel-vlqz/reportflow-core";

const React = { createElement, Fragment: "Fragment" };

interface ChecklistRow {
  id: number;
  item: string;
  status: string;
  note: string;
}

interface MaintenanceData {
  company: string;
  reportId: string;
  equipment: string;
  date: string;
  owner: string;
  checklist: ChecklistRow[];
  observations: string;
  images: string[];
}

const template = (data: MaintenanceData) => (
  <Document size="A4" margin={{ top: 36, right: 36, bottom: 40, left: 36 }}>
    <Header>
      <Stack gap={4}>
        <Text fontSize={12} fontWeight="bold">
          {data.company} · Reporte de Mantenimiento
        </Text>
        <Divider />
      </Stack>
    </Header>

    <Footer>
      <Row>
        <Col width={0.7}>
          <Text fontSize={10}>ReportFlow MVP · {data.reportId}</Text>
        </Col>
        <Col width={0.3}>
          <Text fontSize={10} wrap={false} maxLines={1} overflow="clip">
            Página {"{{pageNumber}}"} / {"{{totalPages}}"}
          </Text>
        </Col>
      </Row>
    </Footer>

    <Stack gap={10}>
      <Text fontSize={18} fontWeight="bold">
        Informe Técnico de Mantenimiento
      </Text>

      <Row gap={12}>
        <Col width={0.5}>
          <Stack gap={3}>
            <Text fontWeight="bold">Equipo</Text>
            <Text>{data.equipment}</Text>
          </Stack>
        </Col>
        <Col width={0.25}>
          <Stack gap={3}>
            <Text fontWeight="bold">Fecha</Text>
            <Text>{data.date}</Text>
          </Stack>
        </Col>
        <Col width={0.25}>
          <Stack gap={3}>
            <Text fontWeight="bold">Responsable</Text>
            <Text>{data.owner}</Text>
          </Stack>
        </Col>
      </Row>

      <Divider />

      <Text fontSize={14} fontWeight="bold">
        Checklist (200 filas)
      </Text>
      <Table
        columns={[
          { key: "id", title: "ID", width: 0.1, align: "right" },
          { key: "item", title: "Actividad", width: 0.5 },
          { key: "status", title: "Estado", width: 0.16 },
          { key: "note", title: "Nota", width: 0.24 }
        ]}
        rows={data.checklist}
        rowHeight={20}
        headerHeight={24}
        repeatHeader
        keepWithHeader
        keepRowsTogether
      />

      <KeepTogether>
        <Stack gap={6}>
          <Text fontSize={14} fontWeight="bold">
            Observaciones
          </Text>
          <Text fontSize={11} maxLines={18} overflow="shrink" minFontSize={8} ellipsis="...">
            {data.observations}
          </Text>
        </Stack>
      </KeepTogether>

      <KeepTogether>
        <Stack gap={6}>
          <Text fontSize={14} fontWeight="bold">
            Evidencia Fotográfica 1
          </Text>
          <Image src={data.images[0]} fit="contain" maxHeight={190} />
        </Stack>
      </KeepTogether>

      <KeepTogether>
        <Stack gap={6}>
          <Text fontSize={14} fontWeight="bold">
            Evidencia Fotográfica 2
          </Text>
          <Image src={data.images[1]} fit="contain" maxHeight={190} />
        </Stack>
      </KeepTogether>
    </Stack>
  </Document>
);

export default template;
