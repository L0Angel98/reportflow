import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  Chart,
  Divider,
  Document,
  Footer,
  Header,
  KPI,
  KeepTogether,
  Stack,
  Table,
  Text,
  ThemeProvider,
  Watermark,
  DEFAULT_THEME,
  renderToPdf
} from "../src/index.js";
import { buildLayout } from "../src/layout.js";

describe("renderToPdf", () => {
  it("genera un PDF válido para un documento simple", async () => {
    const node = Document({
      size: "A4",
      margin: 40,
      children: [
        Header({
          children: [Text({ fontSize: 11, children: "Cabecera de prueba" }), Divider({})]
        }),
        Footer({
          children: [Text({ fontSize: 10, children: "Página {{pageNumber}} / {{totalPages}}" })]
        }),
        Stack({
          gap: 12,
          children: [
            Text({ fontSize: 18, fontWeight: "bold", children: "Reporte simple" }),
            Text({
              children: "Texto largo para validar line wrapping automático en el motor de layout."
            })
          ]
        })
      ]
    });

    const bytes = await renderToPdf(node);
    expect(bytes.byteLength).toBeGreaterThan(1000);

    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBe(1);
  });

  it("pagina tablas largas sin cortar filas", async () => {
    const rows = Array.from({ length: 200 }, (_, index) => ({
      id: index + 1,
      tarea: `Item de checklist ${index + 1}`,
      estado: index % 3 === 0 ? "Pendiente" : "OK"
    }));

    const node = Document({
      size: "A4",
      margin: 36,
      children: [
        Header({ children: [Text({ fontWeight: "bold", children: "Checklist" }), Divider({})] }),
        Footer({ children: [Text({ children: "Página {{pageNumber}} / {{totalPages}}" })] }),
        Table({
          columns: [
            { key: "id", title: "ID", width: 0.12 },
            { key: "tarea", title: "Tarea", width: 0.63 },
            { key: "estado", title: "Estado", width: 0.25 }
          ],
          rows,
          rowHeight: 20,
          headerHeight: 24,
          repeatHeader: true,
          keepWithHeader: true,
          keepRowsTogether: true
        })
      ]
    });

    const bytes = await renderToPdf(node);
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThan(3);
  });

  it("respeta KeepTogether cuando el bloque cabe completo en página siguiente", async () => {
    const filler = Array.from({ length: 60 }, () =>
      Text({ children: "Texto de relleno para acercar el cursor al final de la página." })
    );

    const node = Document({
      size: "A4",
      margin: 40,
      children: [
        ...filler,
        KeepTogether({
          children: Stack({
            gap: 8,
            children: [
              Text({ fontWeight: "bold", children: "Bloque indivisible" }),
              Text({
                children:
                  "Si no cabe en el remanente de página, el bloque se mueve completo a la siguiente."
              })
            ]
          })
        })
      ]
    });

    const bytes = await renderToPdf(node);
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThan(1);
  });

  it("mueve charts completos a la siguiente pagina cuando no caben", async () => {
    const filler = Array.from({ length: 58 }, () =>
      Text({ children: "Contenido previo para forzar salto antes de chart." })
    );

    const node = Document({
      size: "A4",
      margin: 36,
      children: [
        ...filler,
        Chart({
          type: "bar",
          height: 220,
          data: { labels: ["A", "B", "C", "D"], values: [12, 19, 10, 25] }
        })
      ]
    });

    const layout = await buildLayout(node);
    const chartPages = layout.pages
      .map((page, index) => ({
        index,
        hasChart: page.bodyOps.some((op) => op.kind === "chart")
      }))
      .filter((page) => page.hasChart);

    expect(layout.pages.length).toBeGreaterThan(1);
    expect(chartPages.length).toBe(1);
    expect(chartPages[0]?.index).toBeGreaterThan(0);
  });

  it("propaga tema a descendientes con ThemeProvider", async () => {
    const node = Document({
      size: "A4",
      margin: 36,
      children: [
        ThemeProvider({
          theme: { text: "#ff0000" },
          children: Stack({
            children: [Text({ children: "Texto tematico" })]
          })
        })
      ]
    });

    const layout = await buildLayout(node);
    const textOp = layout.pages[0]?.bodyOps.find((op) => op.kind === "text");
    expect(textOp && textOp.kind === "text" ? textOp.color.r : 0).toBeGreaterThan(0.9);
    expect(textOp && textOp.kind === "text" ? textOp.color.g : 1).toBeLessThan(0.2);
  });

  it("permite ThemeProvider de nivel documento para header/footer/watermark", async () => {
    const node = Document({
      size: "A4",
      margin: 36,
      children: [
        ThemeProvider({
          theme: {
            primary: "#123456",
            primarySoft: "#DDE7FA",
            primaryStrong: "#102A43",
            surface: "#FFFFFF"
          },
          children: [
            Watermark({ text: "CONFIDENCIAL", opacity: 0.1 }),
            Header({ children: [Text({ children: "Header tematico" })] }),
            Footer({ children: [Text({ children: "Footer tematico" })] }),
            Text({ children: "Body tematico" })
          ]
        })
      ]
    });

    const layout = await buildLayout(node);
    const page = layout.pages[0];
    const watermarkColor = page?.watermarkOps[0]?.color;

    expect(page?.headerOps.some((op) => op.kind === "text")).toBe(true);
    expect(page?.footerOps.some((op) => op.kind === "text")).toBe(true);
    expect(watermarkColor?.r ?? 0).toBeCloseTo(0.07, 2);
    expect(watermarkColor?.g ?? 0).toBeCloseTo(0.2, 1);
    expect(watermarkColor?.b ?? 0).toBeCloseTo(0.33, 1);
  });

  it("aplica watermark global en todas las paginas", async () => {
    const rows = Array.from({ length: 220 }, (_, index) => ({
      id: index + 1,
      value: `Fila ${index + 1}`
    }));

    const node = Document({
      size: "A4",
      margin: 36,
      children: [
        Watermark({ text: "CONFIDENCIAL", opacity: 0.1, rotate: -30 }),
        Table({
          columns: [
            { key: "id", title: "ID", width: 0.2 },
            { key: "value", title: "Valor", width: 0.8 }
          ],
          rows,
          rowHeight: 20,
          headerHeight: 24,
          repeatHeader: true
        })
      ]
    });

    const layout = await buildLayout(node);
    const firstWatermark = layout.pages[0]?.watermarkOps[0];
    expect(layout.pages.length).toBeGreaterThan(2);
    expect(layout.pages.every((page) => page.watermarkOps.length === 1)).toBe(true);
    expect(firstWatermark?.color.r ?? 0).toBeCloseTo(11 / 255, 3);
    expect(firstWatermark?.color.g ?? 0).toBeCloseTo(95 / 255, 3);
    expect(firstWatermark?.color.b ?? 0).toBeCloseTo(255 / 255, 3);
    expect(DEFAULT_THEME.primary).toBe("#0B5FFF");
  });

  it("respeta align en texto y KPI", async () => {
    const node = Document({
      size: "A4",
      margin: 36,
      children: [
        Text({ fontSize: 14, fontWeight: "bold", align: "right", children: "Alineado derecha" }),
        KPI({ label: "Disponibilidad", value: "98.7%", align: "right" })
      ]
    });

    const layout = await buildLayout(node);
    const textOps = layout.pages[0]?.bodyOps.filter(
      (op): op is Extract<(typeof layout.pages)[number]["bodyOps"][number], { kind: "text" }> =>
        op.kind === "text"
    );
    expect(textOps?.every((op) => op.align === "right")).toBe(true);
  });

  it("aplica estilo avanzado de tabla (headerAlign y borderRadius)", async () => {
    const node = Document({
      size: "A4",
      margin: 36,
      children: [
        Table({
          columns: [
            { key: "id", title: "ID", width: 0.2 },
            { key: "value", title: "Valor", width: 0.8 }
          ],
          rows: [{ id: 1, value: "Fila 1" }],
          rowHeight: 20,
          headerHeight: 24,
          headerAlign: "center",
          borderRadius: 8,
          cellPadding: 5
        })
      ]
    });

    const layout = await buildLayout(node);
    const page = layout.pages[0];
    const headerId = page?.bodyOps.find(
      (op) => op.kind === "text" && op.lines.length > 0 && op.lines[0] === "ID"
    );
    const rowValue = page?.bodyOps.find(
      (op) => op.kind === "text" && op.lines.length > 0 && op.lines[0] === "Fila 1"
    );
    const hasRoundedBorder = page?.bodyOps.some((op) => op.kind === "roundedRect");

    expect(headerId && headerId.kind === "text" ? headerId.align : "left").toBe("center");
    expect(Boolean(rowValue)).toBe(true);
    expect(hasRoundedBorder).toBe(true);
  });
});
