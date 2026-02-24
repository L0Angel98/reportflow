import { readFile } from "node:fs/promises";
import path from "node:path";
import { RF_FRAGMENT } from "./create-element.js";
import {
  DEFAULT_THEME,
  mixRgb,
  resolveTheme,
  rgbFromTheme,
  toRgbColor,
  type RGBColor
} from "./theme.js";
import type {
  Align,
  BadgeProps,
  CardProps,
  ChartOptions,
  ChartProps,
  ChartType,
  ColProps,
  DocumentProps,
  ImageFit,
  ImageProps,
  KPIProps,
  Margins,
  RFElement,
  RFNode,
  RenderOptions,
  RowProps,
  StackProps,
  ThemeProviderProps,
  ThemeTokens,
  TableColumn,
  TableProps,
  TextProps,
  WatermarkProps
} from "./types.js";

const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89 },
  LETTER: { width: 612, height: 792 }
} as const;

const DEFAULT_MARGIN = 40;
const DEFAULT_STACK_GAP = 8;
const DEFAULT_TEXT_SIZE = 12;
const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.25;
const AVG_CHAR_WIDTH = 0.55;
const WRAP_WIDTH_RELAX = 1.04;
const BADGE_TEXT_SLACK = 8;
const SECTION_GAP = 8;
const TABLE_GRID_STROKE = 0.5;
const TABLE_OUTER_STROKE = 1.2;

type Color = RGBColor;

const colorFromTheme = (theme: ThemeTokens, key: keyof ThemeTokens): Color =>
  rgbFromTheme(theme, key);
const lighten = (base: Color, ratio: number): Color => mixRgb(base, { r: 1, g: 1, b: 1 }, ratio);

export interface TextDrawOp {
  kind: "text";
  x: number;
  y: number;
  width: number;
  lines: string[];
  fontSize: number;
  fontWeight: "normal" | "bold";
  lineHeight: number;
  color: Color;
  opacity?: number;
  rotate?: number;
  align?: Align;
}

export interface RectDrawOp {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: Color;
  stroke?: Color;
  borderWidth?: number;
  opacity?: number;
}

export interface RoundedRectDrawOp {
  kind: "roundedRect";
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  fill?: Color;
  stroke?: Color;
  borderWidth?: number;
  opacity?: number;
}

export interface LineDrawOp {
  kind: "line";
  x: number;
  y: number;
  width: number;
  thickness: number;
  color: Color;
  opacity?: number;
}

export interface ImageDrawOp {
  kind: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  fit: ImageFit;
  opacity?: number;
  borderRadius?: number;
  borderColor?: Color;
  grayscale?: boolean;
}

export interface ChartDrawOp {
  kind: "chart";
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
  chartType: ChartType;
  labels: string[];
  values: number[];
  options: Required<ChartOptions>;
  palette: Color[];
  textColor: Color;
  mutedColor: Color;
  backgroundColor: Color;
  borderColor: Color;
}

export interface WatermarkDrawOp {
  kind: "watermark";
  text: string;
  opacity: number;
  rotate: number;
  fontSize: number;
  color: Color;
}

export type DrawOp =
  | TextDrawOp
  | RectDrawOp
  | RoundedRectDrawOp
  | LineDrawOp
  | ImageDrawOp
  | ChartDrawOp;

export interface PageLayout {
  backgroundColor: Color;
  watermarkOps: WatermarkDrawOp[];
  headerOps: DrawOp[];
  bodyOps: DrawOp[];
  footerOps: DrawOp[];
}

export interface ImageAsset {
  src: string;
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

export interface LayoutResult {
  pageWidth: number;
  pageHeight: number;
  pages: PageLayout[];
  imageAssets: Map<string, ImageAsset>;
}

interface TextLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
}

interface RowItem {
  width?: number | `${number}%`;
  nodes: RFNode[];
}

interface FlowState {
  pages: PageLayout[];
  page: PageLayout;
  cursorY: number;
  contentX: number;
  contentWidth: number;
  bodyTop: number;
  bodyBottom: number;
  usableHeight: number;
  backgroundTemplate: Color;
  watermarkTemplate: WatermarkDrawOp[];
  headerTemplate: DrawOp[];
  footerTemplate: DrawOp[];
}

interface LayoutEnv {
  imageStore: ImageStore;
}

const isElement = (node: RFNode): node is RFElement => typeof node === "object" && node !== null;

const isNodeType = <TType extends string>(
  node: RFNode,
  type: TType
): node is RFElement<object, TType> => isElement(node) && node.type === type;

const flattenNodes = (nodes: RFNode[]): RFNode[] => {
  const out: RFNode[] = [];
  const visit = (node: RFNode): void => {
    if (isNodeType(node, RF_FRAGMENT)) {
      for (const child of node.children) {
        visit(child);
      }
      return;
    }
    out.push(node);
  };

  for (const node of nodes) {
    visit(node);
  }

  return out;
};

const collectText = (node: RFNode): string => {
  if (typeof node === "string") {
    return node;
  }

  return flattenNodes(node.children)
    .map((child) => collectText(child))
    .join("");
};

const resolveMargins = (margin: DocumentProps["margin"]): Margins => {
  if (typeof margin === "number") {
    return { top: margin, right: margin, bottom: margin, left: margin };
  }

  if (!margin) {
    return {
      top: DEFAULT_MARGIN,
      right: DEFAULT_MARGIN,
      bottom: DEFAULT_MARGIN,
      left: DEFAULT_MARGIN
    };
  }

  return {
    top: margin.top ?? DEFAULT_MARGIN,
    right: margin.right ?? DEFAULT_MARGIN,
    bottom: margin.bottom ?? DEFAULT_MARGIN,
    left: margin.left ?? DEFAULT_MARGIN
  };
};

const estimateCharFactor = (char: string): number => {
  if (char === " ") {
    return 0.28;
  }
  if ("ilI1|".includes(char)) {
    return 0.3;
  }
  if ("mwMW@#%&".includes(char)) {
    return 0.82;
  }
  if (/[A-Z]/.test(char)) {
    return 0.62;
  }
  if (/[0-9]/.test(char)) {
    return 0.56;
  }
  if (".,;:'\"`".includes(char)) {
    return 0.25;
  }
  if ("(){}[]/\\".includes(char)) {
    return 0.35;
  }
  return 0.52;
};

const estimateTextWidth = (text: string, fontSize: number): number => {
  // Aproximacion MVP: ancho por categoria de caracter para evitar cortes prematuros.
  let factor = 0;
  for (let index = 0; index < text.length; index += 1) {
    factor += estimateCharFactor(text[index]);
  }
  return factor * fontSize;
};

const chunkWord = (word: string, maxChars: number): string[] => {
  if (word.length <= maxChars) {
    return [word];
  }

  const chunks: string[] = [];
  for (let index = 0; index < word.length; index += maxChars) {
    chunks.push(word.slice(index, index + maxChars));
  }
  return chunks;
};

const wrapText = (text: string, width: number, fontSize: number, wrap: boolean): string[] => {
  const safeWidth = Math.max(1, width);
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");

  if (!wrap) {
    return paragraphs.length > 0 ? paragraphs : [""];
  }

  const maxChars = Math.max(1, Math.floor(safeWidth / (fontSize * AVG_CHAR_WIDTH)));
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) {
      lines.push("");
      continue;
    }

    const words = paragraph.trim().split(/\s+/);
    let currentLine = "";

    for (const rawWord of words) {
      const parts = chunkWord(rawWord, maxChars);
      for (const part of parts) {
        const candidate = currentLine ? `${currentLine} ${part}` : part;
        if (
          estimateTextWidth(candidate, fontSize) <= safeWidth * WRAP_WIDTH_RELAX ||
          !currentLine
        ) {
          currentLine = candidate;
        } else {
          lines.push(currentLine);
          currentLine = part;
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [""];
};

const appendEllipsis = (line: string, marker: string, width: number, fontSize: number): string => {
  let value = line.trimEnd();
  while (value.length > 0 && estimateTextWidth(`${value}${marker}`, fontSize) > width) {
    value = value.slice(0, -1);
  }
  return `${value}${marker}`;
};

const createTextLayout = (text: string, props: TextProps, width: number): TextLayout => {
  const wrap = props.wrap ?? true;
  const maxLines = props.maxLines;
  const minFontSize = props.minFontSize ?? 8;
  const overflow = props.overflow ?? "ellipsis";
  const ellipsisMarker = props.ellipsis ?? "...";
  let fontSize = props.fontSize ?? DEFAULT_TEXT_SIZE;
  let lines = wrapText(text, width, fontSize, wrap);

  if (maxLines && overflow === "shrink") {
    // Aproximación MVP: reducimos de a 1 punto hasta minFontSize.
    while (lines.length > maxLines && fontSize > minFontSize) {
      fontSize -= 1;
      lines = wrapText(text, width, fontSize, wrap);
    }
  }

  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    if (overflow !== "clip") {
      const lastIndex = lines.length - 1;
      lines[lastIndex] = appendEllipsis(lines[lastIndex] ?? "", ellipsisMarker, width, fontSize);
    }
  }

  const lineHeight = props.lineHeight ?? fontSize * DEFAULT_LINE_HEIGHT_MULTIPLIER;

  return { lines, fontSize, lineHeight };
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeOpacity = (value: number | undefined, fallback = 1): number =>
  clamp(value ?? fallback, 0, 1);

const resolveBlockWidth = (
  requested: number | `${number}%` | undefined,
  availableWidth: number
): number => {
  if (typeof requested === "string" && requested.endsWith("%")) {
    const percentage = Number(requested.slice(0, -1));
    return clamp(
      (availableWidth * (Number.isFinite(percentage) ? percentage : 100)) / 100,
      1,
      availableWidth
    );
  }

  if (typeof requested === "number") {
    if (requested > 0 && requested <= 1) {
      return clamp(availableWidth * requested, 1, availableWidth);
    }
    if (requested > 1) {
      return clamp(requested, 1, availableWidth);
    }
  }

  return availableWidth;
};

const alignX = (
  align: Align | undefined,
  containerX: number,
  containerWidth: number,
  itemWidth: number
): number => {
  if (align === "center") {
    return containerX + (containerWidth - itemWidth) / 2;
  }
  if (align === "right") {
    return containerX + containerWidth - itemWidth;
  }
  return containerX;
};

const tableTextTop = (cellTop: number, cellHeight: number, fontSize: number): number => {
  const centeredTop = cellTop + (cellHeight - fontSize) / 2;
  const minTop = cellTop + 1.5;
  const maxTop = cellTop + Math.max(1.5, cellHeight - fontSize - 2);
  return clamp(centeredTop, minTop, maxTop);
};

const tableCornerInsetX = (radius: number): number => clamp(radius * 0.22, 1, 3);
const tableCornerInsetY = (radius: number): number => clamp(radius * 0.42, 1, 6);

const pushTopRoundedHeaderFill = (
  ops: DrawOp[],
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: Color
): void => {
  if (width <= 0 || height <= 0) {
    return;
  }

  const r = Math.max(0, Math.min(radius - TABLE_OUTER_STROKE / 2, width / 2, height));
  if (r <= 0.001) {
    ops.push({ kind: "rect", x, y, width, height, fill });
    return;
  }

  // Relleno por franjas finas para seguir la curva sin "bloques" visibles.
  const stripeHeight = 0.25;
  let offsetY = 0;
  while (offsetY < r) {
    const h = Math.min(stripeHeight, r - offsetY);
    const midY = offsetY + h / 2;
    const dy = r - midY;
    const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
    const inset = Math.max(0, r - dx);
    ops.push({
      kind: "rect",
      x: x + inset,
      y: y + offsetY,
      width: Math.max(1, width - inset * 2),
      height: h,
      fill
    });
    offsetY += h;
  }

  const remainingHeight = height - r;
  if (remainingHeight > 0) {
    ops.push({
      kind: "rect",
      x,
      y: y + r,
      width,
      height: remainingHeight,
      fill
    });
  }
};

const mergeChartOptions = (options: ChartOptions | undefined): Required<ChartOptions> => ({
  colors: options?.colors ?? [],
  legend: options?.legend ?? true,
  grid: options?.grid ?? true,
  title: options?.title ?? "",
  titleAlign: options?.titleAlign ?? "left",
  legendPosition: options?.legendPosition ?? "bottom",
  showValues: options?.showValues ?? false,
  showPoints: options?.showPoints ?? true,
  yAxisMin: options?.yAxisMin ?? 0,
  yAxisMax: options?.yAxisMax ?? Number.NaN
});

const statusColor = (status: string | undefined, theme: ThemeTokens): Color => {
  if (status === "success") {
    return colorFromTheme(theme, "success");
  }
  if (status === "danger") {
    return colorFromTheme(theme, "danger");
  }
  if (status === "warning") {
    return mixRgb(colorFromTheme(theme, "danger"), colorFromTheme(theme, "accent"), 0.45);
  }
  return colorFromTheme(theme, "muted");
};

const badgeToneColors = (
  tone: "default" | "success" | "danger" | "warning" | "info",
  theme: ThemeTokens
): { fill: Color; stroke: Color; text: Color } => {
  if (tone === "success") {
    const text = colorFromTheme(theme, "success");
    return {
      fill: lighten(text, 0.84),
      stroke: lighten(text, 0.58),
      text
    };
  }
  if (tone === "danger") {
    const text = colorFromTheme(theme, "danger");
    return {
      fill: lighten(text, 0.86),
      stroke: lighten(text, 0.6),
      text
    };
  }
  if (tone === "warning") {
    const text = mixRgb(colorFromTheme(theme, "danger"), colorFromTheme(theme, "accent"), 0.45);
    return {
      fill: lighten(colorFromTheme(theme, "accent"), 0.84),
      stroke: lighten(colorFromTheme(theme, "accent"), 0.62),
      text
    };
  }
  if (tone === "info") {
    const text = colorFromTheme(theme, "accent");
    return {
      fill: lighten(text, 0.86),
      stroke: lighten(text, 0.62),
      text
    };
  }

  const text = colorFromTheme(theme, "primaryStrong");
  return {
    fill: colorFromTheme(theme, "primarySoft"),
    stroke: lighten(text, 0.48),
    text
  };
};

const textColorFromProps = (props: Pick<TextProps, "color">, theme: ThemeTokens): Color =>
  toRgbColor(props.color ?? theme.text, theme.text);

const normalizeFit = (fit?: ImageFit): ImageFit => fit ?? "contain";

const parsePngDimensions = (bytes: Uint8Array): { width: number; height: number } | null => {
  if (bytes.length < 24) {
    return null;
  }

  const signature = "89504e470d0a1a0a";
  const actualSignature = Buffer.from(bytes.slice(0, 8)).toString("hex");
  if (actualSignature !== signature) {
    return null;
  }

  const width = Buffer.from(bytes.slice(16, 20)).readUInt32BE(0);
  const height = Buffer.from(bytes.slice(20, 24)).readUInt32BE(0);
  return { width, height };
};

const parseJpegDimensions = (bytes: Uint8Array): { width: number; height: number } | null => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const blockLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (blockLength <= 0) {
      return null;
    }

    const isSOF =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf;

    if (isSOF && offset + 8 < bytes.length) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return { width, height };
    }

    offset += 2 + blockLength;
  }

  return null;
};

class ImageStore {
  private readonly cache = new Map<string, ImageAsset>();
  private readonly baseDir: string;

  constructor(assetBaseDir?: string) {
    this.baseDir = assetBaseDir ?? process.cwd();
  }

  public entries(): Map<string, ImageAsset> {
    return this.cache;
  }

  public async get(src: string): Promise<ImageAsset> {
    const cached = this.cache.get(src);
    if (cached) {
      return cached;
    }

    const dataUrlMatch = /^data:(image\/(?:png|jpe?g));base64,(.+)$/i.exec(src);
    let bytes: Uint8Array;
    let mimeType: "image/png" | "image/jpeg";

    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1].toLowerCase().startsWith("image/png") ? "image/png" : "image/jpeg";
      bytes = new Uint8Array(Buffer.from(dataUrlMatch[2], "base64"));
    } else {
      const filePath = path.isAbsolute(src) ? src : path.resolve(this.baseDir, src);
      const fileBytes = await readFile(filePath);
      bytes = new Uint8Array(fileBytes);

      if (filePath.toLowerCase().endsWith(".png")) {
        mimeType = "image/png";
      } else {
        mimeType = "image/jpeg";
      }
    }

    const dimensions =
      mimeType === "image/png" ? parsePngDimensions(bytes) : parseJpegDimensions(bytes);

    const resolved: ImageAsset = {
      src,
      bytes,
      mimeType,
      width: dimensions?.width ?? 1,
      height: dimensions?.height ?? 1
    };

    this.cache.set(src, resolved);
    return resolved;
  }
}

const resolveImageBox = async (
  props: ImageProps,
  availableWidth: number,
  availableHeight: number,
  env: LayoutEnv
): Promise<{ width: number; height: number }> => {
  const image = await env.imageStore.get(props.src);
  const maxHeight = props.maxHeight ?? Number.POSITIVE_INFINITY;
  const fit = normalizeFit(props.fit);
  const widthByRatio = availableWidth;
  const heightByRatio = (image.height / Math.max(image.width, 1)) * widthByRatio;

  let height = Math.min(heightByRatio, maxHeight, availableHeight);
  let width = widthByRatio;

  if (fit === "contain" && heightByRatio > height) {
    const scale = height / Math.max(heightByRatio, 1);
    width *= scale;
  }

  // En MVP no aplicamos recorte real para "cover"; usamos escala simple para no desbordar.
  if (fit === "cover") {
    height = Math.min(
      maxHeight,
      availableHeight,
      Math.max(height, Math.min(maxHeight, availableHeight))
    );
  }

  return {
    width: Math.max(1, width),
    height: Math.max(1, height)
  };
};

const resolveWidths = (
  requested: Array<number | `${number}%` | undefined>,
  totalWidth: number,
  gap: number
): number[] => {
  const count = requested.length;
  if (count === 0) {
    return [];
  }

  const usableWidth = Math.max(0, totalWidth - gap * Math.max(0, count - 1));
  const widths = new Array<number>(count).fill(0);
  const fractionalIndexes: Array<{ index: number; value: number }> = [];
  const autoIndexes: number[] = [];
  let fixedTotal = 0;

  for (let index = 0; index < count; index += 1) {
    const value = requested[index];
    if (typeof value === "string" && value.endsWith("%")) {
      const percentage = Number(value.slice(0, -1));
      const size = Number.isFinite(percentage) ? (usableWidth * percentage) / 100 : 0;
      widths[index] = Math.max(0, size);
      fixedTotal += widths[index];
      continue;
    }

    if (typeof value === "number") {
      if (value > 0 && value <= 1) {
        fractionalIndexes.push({ index, value });
      } else if (value > 1) {
        widths[index] = value;
        fixedTotal += value;
      } else {
        autoIndexes.push(index);
      }
      continue;
    }

    autoIndexes.push(index);
  }

  const remainingAfterFixed = Math.max(0, usableWidth - fixedTotal);
  const fractionalTotal = fractionalIndexes.reduce((acc, item) => acc + item.value, 0);

  if (fractionalTotal > 0) {
    for (const item of fractionalIndexes) {
      const size = (remainingAfterFixed * item.value) / fractionalTotal;
      widths[item.index] = size;
    }
  }

  const used = widths.reduce((acc, value) => acc + value, 0);
  const remainingForAuto = Math.max(0, usableWidth - used);
  const autoWidth = autoIndexes.length > 0 ? remainingForAuto / autoIndexes.length : 0;

  for (const index of autoIndexes) {
    widths[index] = autoWidth;
  }

  return widths;
};

const rowItemsFromNode = (rowNode: RFElement<RowProps>): RowItem[] => {
  const items: RowItem[] = [];
  for (const child of flattenNodes(rowNode.children)) {
    if (isNodeType(child, "Col")) {
      const colProps = child.props as ColProps;
      items.push({ width: colProps.width, nodes: flattenNodes(child.children) });
      continue;
    }
    items.push({ nodes: [child] });
  }
  return items;
};

const rowsForTable = <T extends Record<string, unknown>>(
  tableNode: RFElement<TableProps<T>>
): T[] => (tableNode.props.rows ?? []) as T[];

const textFromCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
};

const cloneOps = (ops: DrawOp[]): DrawOp[] => structuredClone(ops);

const newPage = (state: FlowState): void => {
  const page: PageLayout = {
    backgroundColor: structuredClone(state.backgroundTemplate),
    watermarkOps: structuredClone(state.watermarkTemplate),
    headerOps: cloneOps(state.headerTemplate),
    bodyOps: [],
    footerOps: cloneOps(state.footerTemplate)
  };
  state.pages.push(page);
  state.page = page;
  state.cursorY = state.bodyTop;
};

const remainingHeight = (state: FlowState): number => state.bodyBottom - state.cursorY;

const measureNode = async (
  node: RFNode,
  width: number,
  env: LayoutEnv,
  theme: ThemeTokens
): Promise<number> => {
  if (typeof node === "string") {
    const text = createTextLayout(node, {}, width);
    return text.lines.length * text.lineHeight;
  }

  if (isNodeType(node, RF_FRAGMENT)) {
    return measureNodes(flattenNodes(node.children), width, 0, env, theme);
  }

  if (isNodeType(node, "ThemeProvider")) {
    const provider = node.props as ThemeProviderProps;
    const mergedTheme = resolveTheme(provider.theme, theme);
    return measureNodes(flattenNodes(node.children), width, 0, env, mergedTheme);
  }

  if (isNodeType(node, "Watermark")) {
    return 0;
  }

  if (isNodeType(node, "Text")) {
    const text = collectText(node);
    const textProps = node.props as TextProps;
    const layout = createTextLayout(text, textProps, width);
    return layout.lines.length * layout.lineHeight;
  }

  if (isNodeType(node, "Divider")) {
    return Math.max(1, Number((node.props as { thickness?: number }).thickness ?? 1));
  }

  if (isNodeType(node, "Image")) {
    const imageProps = node.props as ImageProps;
    const box = await resolveImageBox(imageProps, width, Number.POSITIVE_INFINITY, env);
    return box.height;
  }

  if (isNodeType(node, "Badge")) {
    const props = node.props as BadgeProps;
    const text = props.text ?? collectText(node) ?? "";
    const fontSize = Number(props.fontSize ?? 10);
    const padX = Number(props.paddingX ?? 8);
    const padY = Number(props.paddingY ?? 3);
    const badgeHeight = fontSize * 1.3 + padY * 2;
    const maxWidth = Math.max(1, width);
    const estWidth = Math.min(maxWidth, estimateTextWidth(text, fontSize) + padX * 2);
    void estWidth;
    return badgeHeight;
  }

  if (isNodeType(node, "KPI")) {
    const props = node.props as KPIProps;
    const hasDelta = Boolean(props.delta);
    return hasDelta ? 88 : 72;
  }

  if (isNodeType(node, "Chart")) {
    const props = node.props as ChartProps;
    return Number(props.height ?? 180);
  }

  if (isNodeType(node, "Card")) {
    const props = node.props as CardProps;
    const padding = Number(props.padding ?? 12);
    const gap = Number(props.gap ?? DEFAULT_STACK_GAP);
    const innerHeight = await measureNodes(
      flattenNodes(node.children),
      Math.max(1, width - padding * 2),
      gap,
      env,
      theme
    );
    return innerHeight + padding * 2;
  }

  if (isNodeType(node, "Stack") || isNodeType(node, "Header") || isNodeType(node, "Footer")) {
    const gap = Number((node.props as StackProps).gap ?? DEFAULT_STACK_GAP);
    return measureNodes(flattenNodes(node.children), width, gap, env, theme);
  }

  if (isNodeType(node, "KeepTogether") || isNodeType(node, "Col")) {
    return measureNodes(flattenNodes(node.children), width, 0, env, theme);
  }

  if (isNodeType(node, "Row")) {
    const rowNode = node as RFElement<RowProps>;
    const items = rowItemsFromNode(rowNode);
    const gap = Number(rowNode.props.gap ?? DEFAULT_STACK_GAP);
    const widths = resolveWidths(
      items.map((item) => item.width),
      width,
      gap
    );
    const heights = await Promise.all(
      items.map((item, index) => measureNodes(item.nodes, widths[index] ?? 0, 0, env, theme))
    );
    return heights.length === 0 ? 0 : Math.max(...heights);
  }

  if (isNodeType(node, "Table")) {
    const tableNode = node as RFElement<TableProps<Record<string, unknown>>>;
    const rowHeight = Number(tableNode.props.rowHeight ?? 24);
    const headerHeight = Number(tableNode.props.headerHeight ?? 26);
    return headerHeight + rowsForTable(tableNode).length * rowHeight;
  }

  return 0;
};

const measureNodes = async (
  nodes: RFNode[],
  width: number,
  gap: number,
  env: LayoutEnv,
  theme: ThemeTokens
): Promise<number> => {
  const flat = flattenNodes(nodes);
  if (flat.length === 0) {
    return 0;
  }

  let total = 0;
  for (let index = 0; index < flat.length; index += 1) {
    total += await measureNode(flat[index], width, env, theme);
    if (index < flat.length - 1) {
      total += gap;
    }
  }
  return total;
};

const layoutStaticNode = async (
  node: RFNode,
  x: number,
  y: number,
  width: number,
  maxHeight: number,
  ops: DrawOp[],
  env: LayoutEnv,
  theme: ThemeTokens
): Promise<number> => {
  if (maxHeight <= 0) {
    return 0;
  }

  if (typeof node === "string" || isNodeType(node, "Text")) {
    const text = typeof node === "string" ? node : collectText(node);
    const props = (typeof node === "string" ? {} : (node.props as TextProps)) as TextProps;
    const layout = createTextLayout(text, props, width);
    // Aproximacion: para celdas o bloques muy ajustados mantenemos al menos 1 linea visible
    // en vez de descartar el texto completo.
    const maxLinesByHeight = Math.max(1, Math.floor(maxHeight / layout.lineHeight));

    let lines = layout.lines;
    if (lines.length > maxLinesByHeight) {
      lines = lines.slice(0, maxLinesByHeight);
      const marker = props.ellipsis ?? "...";
      const last = lines.length - 1;
      lines[last] = appendEllipsis(lines[last] ?? "", marker, width, layout.fontSize);
    }

    if (lines.length === 0) {
      return 0;
    }

    ops.push({
      kind: "text",
      x,
      y,
      width,
      lines,
      fontSize: layout.fontSize,
      fontWeight: props.fontWeight ?? "normal",
      lineHeight: layout.lineHeight,
      color: textColorFromProps(props, theme),
      align: props.align ?? "left"
    });

    return lines.length * layout.lineHeight;
  }

  if (isNodeType(node, "Divider")) {
    const dividerProps = node.props as { thickness?: number; color?: string };
    const thickness = Math.max(1, Number(dividerProps.thickness ?? 1));
    if (thickness > maxHeight) {
      return 0;
    }
    ops.push({
      kind: "line",
      x,
      y: y + thickness / 2,
      width,
      thickness,
      color: toRgbColor(dividerProps.color ?? theme.muted, theme.muted)
    });
    return thickness;
  }

  if (isNodeType(node, "Image")) {
    const imageProps = node.props as ImageProps;
    const box = await resolveImageBox(imageProps, width, maxHeight, env);
    const imageX = alignX(imageProps.align, x, width, box.width);
    ops.push({
      kind: "image",
      x: imageX,
      y,
      width: box.width,
      height: box.height,
      src: imageProps.src,
      fit: normalizeFit(imageProps.fit),
      opacity: normalizeOpacity(imageProps.opacity, 1),
      borderRadius: imageProps.borderRadius,
      borderColor: lighten(colorFromTheme(theme, "muted"), 0.22),
      grayscale: imageProps.grayscale
    });
    return box.height;
  }

  if (isNodeType(node, "Badge")) {
    const props = node.props as BadgeProps;
    const text = props.text ?? collectText(node) ?? "";
    const fontSize = Number(props.fontSize ?? 10);
    const padX = Number(props.paddingX ?? 8);
    const padY = Number(props.paddingY ?? 3);
    const height = fontSize * 1.3 + padY * 2;
    const badgeWidth = Math.min(
      width,
      estimateTextWidth(text, fontSize) + padX * 2 + BADGE_TEXT_SLACK
    );
    const tone = props.tone ?? "default";
    const colors = badgeToneColors(tone, theme);

    ops.push({
      kind: "roundedRect",
      x,
      y,
      width: badgeWidth,
      height,
      radius: Math.min(height / 2, 12),
      fill: colors.fill,
      stroke: colors.stroke,
      borderWidth: 0.8
    });
    ops.push({
      kind: "text",
      x: x + padX,
      y: y + padY + 0.5,
      width: Math.max(1, badgeWidth - padX * 2 + 2),
      lines: [text],
      fontSize,
      fontWeight: "bold",
      lineHeight: fontSize * 1.2,
      color: colors.text,
      align: "left"
    });
    return height;
  }

  if (isNodeType(node, "KPI")) {
    const props = node.props as KPIProps;
    const textAlign = props.align ?? "left";
    const inset = 5;
    const hasDelta = Boolean(props.delta);
    const boxHeight = hasDelta ? 88 : 72;
    const deltaColor = statusColor(props.status, theme);
    const background = colorFromTheme(theme, "surface");
    const border = lighten(colorFromTheme(theme, "muted"), 0.55);

    ops.push({
      kind: "roundedRect",
      x,
      y,
      width,
      height: boxHeight,
      radius: 12,
      fill: background,
      stroke: lighten(border, 0.45),
      borderWidth: 1
    });
    ops.push({
      kind: "text",
      x: x + inset,
      y: y + 9,
      width: Math.max(1, width - inset * 2),
      lines: [props.label],
      fontSize: 10,
      fontWeight: "normal",
      lineHeight: 12,
      color: colorFromTheme(theme, "muted"),
      align: textAlign
    });
    ops.push({
      kind: "text",
      x: x + inset,
      y: y + 25,
      width: Math.max(1, width - inset * 2),
      lines: [String(props.value)],
      fontSize: 20,
      fontWeight: "bold",
      lineHeight: 24,
      color: colorFromTheme(theme, "primaryStrong"),
      align: textAlign
    });
    if (props.delta) {
      ops.push({
        kind: "text",
        x: x + inset,
        y: y + 56,
        width: Math.max(1, width - inset * 2),
        lines: [props.delta],
        fontSize: 10,
        fontWeight: "bold",
        lineHeight: 12,
        color: deltaColor,
        align: textAlign
      });
    }
    return boxHeight;
  }

  if (isNodeType(node, "Chart")) {
    const props = node.props as ChartProps;
    const chartWidth = resolveBlockWidth(props.width, width);
    const chartHeight = Number(props.height ?? 180);
    const chartX = alignX(props.align, x, width, chartWidth);
    const options = mergeChartOptions(props.options);
    const palette = [
      colorFromTheme(theme, "primary"),
      colorFromTheme(theme, "primarySoft"),
      colorFromTheme(theme, "accent")
    ];
    const overrides = options.colors.map((item) => toRgbColor(item, theme.primary));
    ops.push({
      kind: "chart",
      x: chartX,
      y,
      width: chartWidth,
      height: chartHeight,
      borderRadius: Math.max(0, Number(props.borderRadius ?? 0)),
      chartType: props.type,
      labels: props.data.labels,
      values: props.data.values,
      options,
      palette: overrides.length > 0 ? overrides : palette,
      textColor: colorFromTheme(theme, "text"),
      mutedColor: colorFromTheme(theme, "muted"),
      backgroundColor: colorFromTheme(theme, "surface"),
      borderColor: mixRgb(colorFromTheme(theme, "muted"), colorFromTheme(theme, "text"), 0.4)
    });
    return chartHeight;
  }

  if (isNodeType(node, "Card")) {
    const props = node.props as CardProps;
    const padding = Number(props.padding ?? 12);
    const radius = Number(props.radius ?? 10);
    const borderWidth = Number(props.borderWidth ?? 1);
    const gap = Number(props.gap ?? DEFAULT_STACK_GAP);
    const cardHeight = await measureNode(node, width, env, theme);
    const usedHeight = Math.min(cardHeight, maxHeight);
    const fillColor = toRgbColor(props.backgroundColor ?? theme.surface, theme.surface);
    const borderColor = toRgbColor(props.borderColor ?? theme.muted, theme.muted);
    ops.push({
      kind: "roundedRect",
      x,
      y,
      width,
      height: usedHeight,
      radius,
      fill: fillColor,
      stroke: lighten(borderColor, 0.35),
      borderWidth
    });

    await layoutStaticNodes(
      flattenNodes(node.children),
      x + padding,
      y + padding,
      Math.max(1, width - padding * 2),
      Math.max(1, usedHeight - padding * 2),
      ops,
      env,
      gap,
      theme
    );
    return usedHeight;
  }

  if (isNodeType(node, RF_FRAGMENT)) {
    return layoutStaticNodes(
      flattenNodes(node.children),
      x,
      y,
      width,
      maxHeight,
      ops,
      env,
      0,
      theme
    );
  }

  if (isNodeType(node, "ThemeProvider")) {
    const provider = node.props as ThemeProviderProps;
    const mergedTheme = resolveTheme(provider.theme, theme);
    return layoutStaticNodes(
      flattenNodes(node.children),
      x,
      y,
      width,
      maxHeight,
      ops,
      env,
      0,
      mergedTheme
    );
  }

  if (isNodeType(node, "Watermark")) {
    return 0;
  }

  if (isNodeType(node, "Stack") || isNodeType(node, "Header") || isNodeType(node, "Footer")) {
    const gap = Number((node.props as StackProps).gap ?? DEFAULT_STACK_GAP);
    return layoutStaticNodes(
      flattenNodes(node.children),
      x,
      y,
      width,
      maxHeight,
      ops,
      env,
      gap,
      theme
    );
  }

  if (isNodeType(node, "KeepTogether") || isNodeType(node, "Col")) {
    return layoutStaticNodes(
      flattenNodes(node.children),
      x,
      y,
      width,
      maxHeight,
      ops,
      env,
      0,
      theme
    );
  }

  if (isNodeType(node, "Row")) {
    const rowNode = node as RFElement<RowProps>;
    const items = rowItemsFromNode(rowNode);
    const gap = Number(rowNode.props.gap ?? DEFAULT_STACK_GAP);
    const widths = resolveWidths(
      items.map((item) => item.width),
      width,
      gap
    );

    const heights = await Promise.all(
      items.map((item, index) => measureNodes(item.nodes, widths[index] ?? 0, 0, env, theme))
    );

    const rowHeight = Math.min(maxHeight, heights.length > 0 ? Math.max(...heights) : 0);
    let cursorX = x;
    for (let index = 0; index < items.length; index += 1) {
      await layoutStaticNodes(
        items[index].nodes,
        cursorX,
        y,
        widths[index] ?? 0,
        rowHeight,
        ops,
        env,
        0,
        theme
      );
      cursorX += (widths[index] ?? 0) + gap;
    }
    return rowHeight;
  }

  if (isNodeType(node, "Table")) {
    const tableNode = node as RFElement<TableProps<Record<string, unknown>>>;
    const rowHeight = Number(tableNode.props.rowHeight ?? 24);
    const headerHeight = Number(tableNode.props.headerHeight ?? 26);
    const borderRadius = Math.max(0, Number(tableNode.props.borderRadius ?? 0));
    const showOuterBorder = tableNode.props.showOuterBorder ?? true;
    const useRoundedBorder = borderRadius > 0;
    const cornerInsetX = useRoundedBorder ? tableCornerInsetX(borderRadius) : 0;
    const cornerInsetY = useRoundedBorder ? tableCornerInsetY(borderRadius) : 0;
    const cellPadding = Math.max(2, Number(tableNode.props.cellPadding ?? 4));
    const headerAlign = tableNode.props.headerAlign ?? "left";
    const border = tableNode.props.borderColor
      ? toRgbColor(tableNode.props.borderColor, theme.muted)
      : lighten(colorFromTheme(theme, "muted"), 0.22);
    const gridBorder = lighten(border, 0.35);
    const outerBorder = mixRgb(border, colorFromTheme(theme, "text"), 0.55);
    const headerFill = tableNode.props.headerBackground
      ? toRgbColor(tableNode.props.headerBackground, theme.primary)
      : colorFromTheme(theme, "primarySoft");
    const columns = tableNode.props.columns as TableColumn<Record<string, unknown>>[];
    const rows = rowsForTable(tableNode);
    const widths = resolveWidths(
      columns.map((col) => col.width),
      width,
      0
    );
    let cursorY = y;
    const innerColumnBoundaries: number[] = [];
    {
      let xLine = x;
      for (let index = 0; index < columns.length - 1; index += 1) {
        xLine += widths[index] ?? 0;
        innerColumnBoundaries.push(xLine);
      }
    }
    const horizontalBoundaries: number[] = [];

    const drawHeader = (): boolean => {
      if (cursorY + headerHeight > y + maxHeight) {
        return false;
      }
      if (useRoundedBorder) {
        pushTopRoundedHeaderFill(ops, x, cursorY, width, headerHeight, borderRadius, headerFill);
      }
      let cursorX = x;
      for (let index = 0; index < columns.length; index += 1) {
        const colWidth = widths[index] ?? 0;
        if (!useRoundedBorder) {
          ops.push({
            kind: "rect",
            x: cursorX,
            y: cursorY,
            width: colWidth,
            height: headerHeight,
            fill: headerFill,
            stroke: gridBorder,
            borderWidth: 0.5
          });
        }
        void layoutStaticNode(
          {
            type: "Text",
            props: {
              fontSize: 10,
              fontWeight: "bold",
              maxLines: 1,
              overflow: "ellipsis",
              color: theme.text,
              align: headerAlign
            },
            children: [columns[index].title]
          },
          cursorX + cellPadding,
          tableTextTop(cursorY, headerHeight, 10),
          Math.max(1, colWidth - cellPadding * 2),
          Math.max(1, headerHeight - 2),
          ops,
          env,
          theme
        );
        cursorX += colWidth;
      }
      cursorY += headerHeight;
      if (useRoundedBorder) {
        horizontalBoundaries.push(cursorY);
      }
      return true;
    };

    if (!drawHeader()) {
      return 0;
    }

    for (const row of rows) {
      if (cursorY + rowHeight > y + maxHeight) {
        break;
      }

      let cursorX = x;
      for (let index = 0; index < columns.length; index += 1) {
        const column = columns[index];
        const colWidth = widths[index] ?? 0;
        const cellValue = textFromCell(row[column.key]);
        const align: Align = column.align ?? "left";
        if (!useRoundedBorder) {
          ops.push({
            kind: "rect",
            x: cursorX,
            y: cursorY,
            width: colWidth,
            height: rowHeight,
            stroke: gridBorder,
            borderWidth: 0.5
          });
        }
        void layoutStaticNode(
          {
            type: "Text",
            props: {
              fontSize: 9,
              maxLines: 1,
              overflow: "ellipsis",
              color: theme.text,
              align
            },
            children: [cellValue]
          },
          cursorX + cellPadding,
          tableTextTop(cursorY, rowHeight, 9),
          Math.max(1, colWidth - cellPadding * 2),
          Math.max(1, rowHeight - 2),
          ops,
          env,
          theme
        );
        cursorX += colWidth;
      }
      cursorY += rowHeight;
      if (useRoundedBorder) {
        horizontalBoundaries.push(cursorY);
      }
    }

    if (useRoundedBorder) {
      const usedHeight = cursorY - y;
      if (usedHeight > 0) {
        const lineInsetX = Math.max(
          0,
          Math.min(cornerInsetX, width / 2 - TABLE_GRID_STROKE / 2, width / 2 - 0.5)
        );
        const lineInsetY = Math.max(
          0,
          Math.min(cornerInsetY, usedHeight / 2 - TABLE_GRID_STROKE / 2, usedHeight / 2 - 0.5)
        );
        const lineY = y + lineInsetY;
        const lineHeight = Math.max(0, usedHeight - lineInsetY * 2);
        const lineX = x + lineInsetX;
        const lineWidth = Math.max(0, width - lineInsetX * 2);

        for (const xLine of innerColumnBoundaries) {
          if (lineHeight > 0) {
            ops.push({
              kind: "rect",
              x: xLine - TABLE_GRID_STROKE / 2,
              y: lineY,
              width: TABLE_GRID_STROKE,
              height: lineHeight,
              fill: gridBorder
            });
          }
        }
        for (const yLine of horizontalBoundaries) {
          if (yLine > y && yLine < cursorY) {
            if (lineWidth > 0) {
              ops.push({
                kind: "rect",
                x: lineX,
                y: yLine - TABLE_GRID_STROKE / 2,
                width: lineWidth,
                height: TABLE_GRID_STROKE,
                fill: gridBorder
              });
            }
          }
        }
        if (showOuterBorder) {
          ops.push({
            kind: "roundedRect",
            x,
            y,
            width,
            height: usedHeight,
            radius: Math.min(borderRadius, width / 2, usedHeight / 2),
            stroke: outerBorder,
            borderWidth: TABLE_OUTER_STROKE
          });
        }
      }
    }

    return cursorY - y;
  }

  return 0;
};

const layoutStaticNodes = async (
  nodes: RFNode[],
  x: number,
  y: number,
  width: number,
  maxHeight: number,
  ops: DrawOp[],
  env: LayoutEnv,
  gap: number,
  theme: ThemeTokens
): Promise<number> => {
  const flat = flattenNodes(nodes);
  let cursorY = y;
  for (let index = 0; index < flat.length; index += 1) {
    const child = flat[index];
    const remaining = y + maxHeight - cursorY;
    if (remaining <= 0) {
      break;
    }
    const used = await layoutStaticNode(child, x, cursorY, width, remaining, ops, env, theme);
    cursorY += used;
    if (index < flat.length - 1) {
      if (cursorY + gap > y + maxHeight) {
        break;
      }
      cursorY += gap;
    }
  }
  return cursorY - y;
};

const placeTextFlow = (
  layout: TextLayout,
  props: TextProps,
  state: FlowState,
  theme: ThemeTokens
): void => {
  let lineIndex = 0;
  while (lineIndex < layout.lines.length) {
    if (remainingHeight(state) <= 0) {
      newPage(state);
      continue;
    }

    const maxLinesInPage = Math.max(1, Math.floor(remainingHeight(state) / layout.lineHeight));
    const chunk = layout.lines.slice(lineIndex, lineIndex + maxLinesInPage);
    if (chunk.length === 0) {
      newPage(state);
      continue;
    }

    state.page.bodyOps.push({
      kind: "text",
      x: state.contentX,
      y: state.cursorY,
      width: state.contentWidth,
      lines: chunk,
      fontSize: layout.fontSize,
      fontWeight: props.fontWeight ?? "normal",
      lineHeight: layout.lineHeight,
      color: textColorFromProps(props, theme),
      align: props.align ?? "left"
    });

    const usedHeight = chunk.length * layout.lineHeight;
    state.cursorY += usedHeight;
    lineIndex += chunk.length;

    if (lineIndex < layout.lines.length) {
      newPage(state);
    }
  }
};

const placeTable = async (
  node: RFElement<TableProps<Record<string, unknown>>>,
  state: FlowState,
  env: LayoutEnv,
  theme: ThemeTokens
): Promise<void> => {
  const props = node.props;
  const columns = props.columns as TableColumn<Record<string, unknown>>[];
  const rows = rowsForTable(node);
  const rowHeight = Number(props.rowHeight ?? 24);
  const headerHeight = Number(props.headerHeight ?? 26);
  const repeatHeader = props.repeatHeader ?? true;
  const keepWithHeader = props.keepWithHeader ?? true;
  const keepRowsTogether = props.keepRowsTogether ?? false;
  const borderRadius = Math.max(0, Number(props.borderRadius ?? 0));
  const showOuterBorder = props.showOuterBorder ?? true;
  const useRoundedBorder = borderRadius > 0;
  const cornerInsetX = useRoundedBorder ? tableCornerInsetX(borderRadius) : 0;
  const cornerInsetY = useRoundedBorder ? tableCornerInsetY(borderRadius) : 0;
  const cellPadding = Math.max(2, Number(props.cellPadding ?? 4));
  const headerAlign = props.headerAlign ?? "left";
  const border = props.borderColor
    ? toRgbColor(props.borderColor, theme.muted)
    : lighten(colorFromTheme(theme, "muted"), 0.22);
  const gridBorder = lighten(border, 0.35);
  const outerBorder = mixRgb(border, colorFromTheme(theme, "text"), 0.55);
  const headerFill = props.headerBackground
    ? toRgbColor(props.headerBackground, theme.primary)
    : lighten(colorFromTheme(theme, "primary"), 0.86);

  const widths = resolveWidths(
    columns.map((column) => column.width),
    state.contentWidth,
    0
  );
  const innerColumnBoundaries: number[] = [];
  {
    let xLine = state.contentX;
    for (let index = 0; index < columns.length - 1; index += 1) {
      xLine += widths[index] ?? 0;
      innerColumnBoundaries.push(xLine);
    }
  }

  let segmentTop: number | null = null;
  let segmentHorizontalBoundaries: number[] = [];
  const startSegment = (): void => {
    if (segmentTop === null) {
      segmentTop = state.cursorY;
      segmentHorizontalBoundaries = [];
    }
  };
  const flushSegment = (): void => {
    if (segmentTop === null) {
      return;
    }
    const segmentHeight = state.cursorY - segmentTop;
    if (useRoundedBorder && segmentHeight > 0) {
      const lineInsetX = Math.max(
        0,
        Math.min(
          cornerInsetX,
          state.contentWidth / 2 - TABLE_GRID_STROKE / 2,
          state.contentWidth / 2 - 0.5
        )
      );
      const lineInsetY = Math.max(
        0,
        Math.min(cornerInsetY, segmentHeight / 2 - TABLE_GRID_STROKE / 2, segmentHeight / 2 - 0.5)
      );
      const lineY = segmentTop + lineInsetY;
      const lineHeight = Math.max(0, segmentHeight - lineInsetY * 2);
      const lineX = state.contentX + lineInsetX;
      const lineWidth = Math.max(0, state.contentWidth - lineInsetX * 2);

      for (const xLine of innerColumnBoundaries) {
        if (lineHeight > 0) {
          state.page.bodyOps.push({
            kind: "rect",
            x: xLine - TABLE_GRID_STROKE / 2,
            y: lineY,
            width: TABLE_GRID_STROKE,
            height: lineHeight,
            fill: gridBorder
          });
        }
      }
      for (const yLine of segmentHorizontalBoundaries) {
        if (yLine > segmentTop && yLine < state.cursorY) {
          if (lineWidth > 0) {
            state.page.bodyOps.push({
              kind: "rect",
              x: lineX,
              y: yLine - TABLE_GRID_STROKE / 2,
              width: lineWidth,
              height: TABLE_GRID_STROKE,
              fill: gridBorder
            });
          }
        }
      }
      if (showOuterBorder) {
        state.page.bodyOps.push({
          kind: "roundedRect",
          x: state.contentX,
          y: segmentTop,
          width: state.contentWidth,
          height: segmentHeight,
          radius: Math.min(borderRadius, state.contentWidth / 2, segmentHeight / 2),
          stroke: outerBorder,
          borderWidth: TABLE_OUTER_STROKE
        });
      }
    }
    segmentTop = null;
  };

  const drawHeader = (): void => {
    startSegment();
    if (useRoundedBorder) {
      pushTopRoundedHeaderFill(
        state.page.bodyOps,
        state.contentX,
        state.cursorY,
        state.contentWidth,
        headerHeight,
        borderRadius,
        headerFill
      );
    }
    let cursorX = state.contentX;
    for (let index = 0; index < columns.length; index += 1) {
      const colWidth = widths[index] ?? 0;
      if (!useRoundedBorder) {
        state.page.bodyOps.push({
          kind: "rect",
          x: cursorX,
          y: state.cursorY,
          width: colWidth,
          height: headerHeight,
          fill: headerFill,
          stroke: gridBorder,
          borderWidth: 0.5
        });
      }

      void layoutStaticNode(
        {
          type: "Text",
          props: {
            fontSize: 10,
            fontWeight: "bold",
            maxLines: 1,
            overflow: "ellipsis",
            color: theme.text,
            align: headerAlign
          },
          children: [columns[index].title]
        },
        cursorX + cellPadding,
        tableTextTop(state.cursorY, headerHeight, 10),
        Math.max(1, colWidth - cellPadding * 2),
        Math.max(1, headerHeight - 2),
        state.page.bodyOps,
        env,
        theme
      );

      cursorX += colWidth;
    }
    state.cursorY += headerHeight;
    if (useRoundedBorder) {
      segmentHorizontalBoundaries.push(state.cursorY);
    }
  };

  const drawRow = (row: Record<string, unknown>): void => {
    startSegment();
    let cursorX = state.contentX;
    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index];
      const colWidth = widths[index] ?? 0;
      const value = textFromCell(row[column.key]);
      const align: Align = column.align ?? "left";

      if (!useRoundedBorder) {
        state.page.bodyOps.push({
          kind: "rect",
          x: cursorX,
          y: state.cursorY,
          width: colWidth,
          height: rowHeight,
          stroke: gridBorder,
          borderWidth: 0.5
        });
      }

      void layoutStaticNode(
        {
          type: "Text",
          props: {
            fontSize: 9,
            maxLines: 1,
            overflow: "ellipsis",
            color: theme.text,
            align
          },
          children: [value]
        },
        cursorX + cellPadding,
        tableTextTop(state.cursorY, rowHeight, 9),
        Math.max(1, colWidth - cellPadding * 2),
        Math.max(1, rowHeight - 2),
        state.page.bodyOps,
        env,
        theme
      );

      cursorX += colWidth;
    }
    state.cursorY += rowHeight;
    if (useRoundedBorder) {
      segmentHorizontalBoundaries.push(state.cursorY);
    }
  };

  if (rows.length === 0) {
    if (remainingHeight(state) < headerHeight) {
      flushSegment();
      newPage(state);
    }
    drawHeader();
    flushSegment();
    return;
  }

  let index = 0;
  let headerDrawnInPage = false;
  while (index < rows.length) {
    if (!headerDrawnInPage) {
      const minRowsAfterHeader = keepWithHeader ? (keepRowsTogether ? 2 : 1) : 0;
      const required = headerHeight + minRowsAfterHeader * rowHeight;
      if (remainingHeight(state) < required) {
        flushSegment();
        newPage(state);
      }
      drawHeader();
      headerDrawnInPage = true;
    }

    const rowsNeeded = keepRowsTogether ? Math.min(2, rows.length - index) : 1;
    if (remainingHeight(state) < rowsNeeded * rowHeight) {
      flushSegment();
      newPage(state);
      headerDrawnInPage = !repeatHeader;
      continue;
    }

    if (remainingHeight(state) < rowHeight) {
      flushSegment();
      newPage(state);
      headerDrawnInPage = !repeatHeader;
      continue;
    }

    drawRow(rows[index]);
    index += 1;

    if (index < rows.length && remainingHeight(state) < rowHeight) {
      flushSegment();
      newPage(state);
      headerDrawnInPage = !repeatHeader;
    }
  }

  flushSegment();
};

const placeRow = async (
  node: RFElement<RowProps>,
  state: FlowState,
  env: LayoutEnv,
  theme: ThemeTokens
): Promise<void> => {
  const items = rowItemsFromNode(node);
  const gap = Number(node.props.gap ?? DEFAULT_STACK_GAP);
  const widths = resolveWidths(
    items.map((item) => item.width),
    state.contentWidth,
    gap
  );
  const heights = await Promise.all(
    items.map((item, index) => measureNodes(item.nodes, widths[index] ?? 0, 0, env, theme))
  );
  let rowHeight = heights.length > 0 ? Math.max(...heights) : 0;

  if (rowHeight > state.usableHeight) {
    // Aproximación MVP: si un Row es más alto que el área útil, lo recortamos al alto de página.
    rowHeight = state.usableHeight;
  }

  if (rowHeight > remainingHeight(state)) {
    newPage(state);
  }

  let cursorX = state.contentX;
  for (let index = 0; index < items.length; index += 1) {
    await layoutStaticNodes(
      items[index].nodes,
      cursorX,
      state.cursorY,
      widths[index] ?? 0,
      rowHeight,
      state.page.bodyOps,
      env,
      0,
      theme
    );
    cursorX += (widths[index] ?? 0) + gap;
  }

  state.cursorY += rowHeight;
};

const placeImage = async (
  node: RFElement<ImageProps>,
  state: FlowState,
  env: LayoutEnv,
  theme: ThemeTokens
): Promise<void> => {
  const props = node.props;
  const box = await resolveImageBox(props, state.contentWidth, state.usableHeight, env);

  let drawHeight = box.height;
  if (drawHeight > state.usableHeight) {
    drawHeight = state.usableHeight;
  }

  if (drawHeight > remainingHeight(state)) {
    newPage(state);
  }

  state.page.bodyOps.push({
    kind: "image",
    x: alignX(props.align, state.contentX, state.contentWidth, box.width),
    y: state.cursorY,
    width: box.width,
    height: drawHeight,
    src: props.src,
    fit: normalizeFit(props.fit),
    opacity: normalizeOpacity(props.opacity, 1),
    borderRadius: props.borderRadius,
    borderColor: lighten(colorFromTheme(theme, "muted"), 0.22),
    grayscale: props.grayscale
  });

  state.cursorY += drawHeight;
};

const placeDivider = (node: RFElement, state: FlowState, theme: ThemeTokens): void => {
  const dividerProps = node.props as { thickness?: number; color?: string };
  const thickness = Math.max(1, Number(dividerProps.thickness ?? 1));
  if (thickness > remainingHeight(state)) {
    newPage(state);
  }
  state.page.bodyOps.push({
    kind: "line",
    x: state.contentX,
    y: state.cursorY + thickness / 2,
    width: state.contentWidth,
    thickness,
    color: toRgbColor(dividerProps.color ?? theme.muted, theme.muted)
  });
  state.cursorY += thickness;
};

const placeText = (node: RFNode, state: FlowState, theme: ThemeTokens): void => {
  const text = typeof node === "string" ? node : collectText(node);
  const props = (typeof node === "string" ? {} : (node.props as TextProps)) as TextProps;
  const layout = createTextLayout(text, props, state.contentWidth);
  placeTextFlow(layout, props, state, theme);
};

const placeBadge = (node: RFElement<BadgeProps>, state: FlowState, theme: ThemeTokens): void => {
  const props = node.props;
  const text = props.text ?? collectText(node) ?? "";
  const fontSize = Number(props.fontSize ?? 10);
  const padX = Number(props.paddingX ?? 8);
  const padY = Number(props.paddingY ?? 3);
  const height = fontSize * 1.3 + padY * 2;
  const width = Math.min(
    state.contentWidth,
    estimateTextWidth(text, fontSize) + padX * 2 + BADGE_TEXT_SLACK
  );
  if (height > remainingHeight(state)) {
    newPage(state);
  }
  const tone = props.tone ?? "default";
  const colors = badgeToneColors(tone, theme);
  state.page.bodyOps.push({
    kind: "roundedRect",
    x: state.contentX,
    y: state.cursorY,
    width,
    height,
    radius: Math.min(height / 2, 12),
    fill: colors.fill,
    stroke: colors.stroke,
    borderWidth: 0.8
  });
  state.page.bodyOps.push({
    kind: "text",
    x: state.contentX + padX,
    y: state.cursorY + padY + 0.5,
    width: Math.max(1, width - padX * 2 + 2),
    lines: [text],
    fontSize,
    fontWeight: "bold",
    lineHeight: fontSize * 1.2,
    color: colors.text,
    align: "left"
  });
  state.cursorY += height;
};

const placeKPI = (node: RFElement<KPIProps>, state: FlowState, theme: ThemeTokens): void => {
  const props = node.props;
  const textAlign = props.align ?? "left";
  const inset = 5;
  const hasDelta = Boolean(props.delta);
  const boxHeight = hasDelta ? 88 : 72;
  if (boxHeight > remainingHeight(state)) {
    newPage(state);
  }
  const deltaColor = statusColor(props.status, theme);
  const border = lighten(colorFromTheme(theme, "muted"), 0.55);
  state.page.bodyOps.push({
    kind: "roundedRect",
    x: state.contentX,
    y: state.cursorY,
    width: state.contentWidth,
    height: boxHeight,
    radius: 12,
    fill: colorFromTheme(theme, "surface"),
    stroke: lighten(border, 0.45),
    borderWidth: 1
  });
  state.page.bodyOps.push({
    kind: "text",
    x: state.contentX + inset,
    y: state.cursorY + 9,
    width: Math.max(1, state.contentWidth - inset * 2),
    lines: [props.label],
    fontSize: 10,
    fontWeight: "normal",
    lineHeight: 12,
    color: colorFromTheme(theme, "muted"),
    align: textAlign
  });
  state.page.bodyOps.push({
    kind: "text",
    x: state.contentX + inset,
    y: state.cursorY + 25,
    width: Math.max(1, state.contentWidth - inset * 2),
    lines: [String(props.value)],
    fontSize: 20,
    fontWeight: "bold",
    lineHeight: 24,
    color: colorFromTheme(theme, "primaryStrong"),
    align: textAlign
  });
  if (props.delta) {
    state.page.bodyOps.push({
      kind: "text",
      x: state.contentX + inset,
      y: state.cursorY + 56,
      width: Math.max(1, state.contentWidth - inset * 2),
      lines: [props.delta],
      fontSize: 10,
      fontWeight: "bold",
      lineHeight: 12,
      color: deltaColor,
      align: textAlign
    });
  }
  state.cursorY += boxHeight;
};

const placeChart = (node: RFElement<ChartProps>, state: FlowState, theme: ThemeTokens): void => {
  const props = node.props;
  const height = Number(props.height ?? 180);
  const width = resolveBlockWidth(props.width, state.contentWidth);
  const x = alignX(props.align, state.contentX, state.contentWidth, width);
  if (height > remainingHeight(state)) {
    newPage(state);
  }

  const options = mergeChartOptions(props.options);
  const palette = [
    colorFromTheme(theme, "primary"),
    colorFromTheme(theme, "primarySoft"),
    colorFromTheme(theme, "accent")
  ];
  const overrides = options.colors.map((item) => toRgbColor(item, theme.primary));

  state.page.bodyOps.push({
    kind: "chart",
    x,
    y: state.cursorY,
    width,
    height,
    borderRadius: Math.max(0, Number(props.borderRadius ?? 0)),
    chartType: props.type,
    labels: props.data.labels,
    values: props.data.values,
    options,
    palette: overrides.length > 0 ? overrides : palette,
    textColor: colorFromTheme(theme, "text"),
    mutedColor: colorFromTheme(theme, "muted"),
    backgroundColor: colorFromTheme(theme, "surface"),
    borderColor: mixRgb(colorFromTheme(theme, "muted"), colorFromTheme(theme, "text"), 0.4)
  });

  state.cursorY += height;
};

const placeCard = async (
  node: RFElement<CardProps>,
  state: FlowState,
  env: LayoutEnv,
  theme: ThemeTokens
): Promise<void> => {
  const props = node.props;
  const padding = Number(props.padding ?? 12);
  const gap = Number(props.gap ?? DEFAULT_STACK_GAP);
  const radius = Number(props.radius ?? 10);
  const borderWidth = Number(props.borderWidth ?? 1);
  const estimatedHeight = await measureNode(node, state.contentWidth, env, theme);
  let boxHeight = estimatedHeight;

  if (boxHeight > remainingHeight(state)) {
    newPage(state);
  }
  if (boxHeight > state.usableHeight) {
    // Aproximacion: Card gigante se limita al alto util para mantener flujo estable.
    boxHeight = state.usableHeight;
  }

  state.page.bodyOps.push({
    kind: "roundedRect",
    x: state.contentX,
    y: state.cursorY,
    width: state.contentWidth,
    height: boxHeight,
    radius,
    fill: toRgbColor(props.backgroundColor ?? theme.surface, theme.surface),
    stroke: lighten(toRgbColor(props.borderColor ?? theme.muted, theme.muted), 0.35),
    borderWidth
  });

  await layoutStaticNodes(
    flattenNodes(node.children),
    state.contentX + padding,
    state.cursorY + padding,
    Math.max(1, state.contentWidth - padding * 2),
    Math.max(1, boxHeight - padding * 2),
    state.page.bodyOps,
    env,
    gap,
    theme
  );

  state.cursorY += boxHeight;
};

const placeFlowNodes = async (
  nodes: RFNode[],
  gap: number,
  state: FlowState,
  env: LayoutEnv,
  theme: ThemeTokens
): Promise<void> => {
  const flat = flattenNodes(nodes);
  for (let index = 0; index < flat.length; index += 1) {
    const node = flat[index];
    await placeFlowNode(node, state, env, theme);
    if (index < flat.length - 1) {
      if (remainingHeight(state) < gap) {
        newPage(state);
      }
      state.cursorY += gap;
    }
  }
};

const placeFlowNode = async (
  node: RFNode,
  state: FlowState,
  env: LayoutEnv,
  theme: ThemeTokens
): Promise<void> => {
  if (typeof node === "string" || isNodeType(node, "Text")) {
    placeText(node, state, theme);
    return;
  }

  if (isNodeType(node, RF_FRAGMENT)) {
    await placeFlowNodes(node.children, 0, state, env, theme);
    return;
  }

  if (isNodeType(node, "ThemeProvider")) {
    const provider = node.props as ThemeProviderProps;
    const mergedTheme = resolveTheme(provider.theme, theme);
    await placeFlowNodes(node.children, 0, state, env, mergedTheme);
    return;
  }

  if (isNodeType(node, "Watermark")) {
    return;
  }

  if (isNodeType(node, "Stack")) {
    const gap = Number((node.props as StackProps).gap ?? DEFAULT_STACK_GAP);
    await placeFlowNodes(node.children, gap, state, env, theme);
    return;
  }

  if (isNodeType(node, "KeepTogether")) {
    const estimatedHeight = await measureNodes(node.children, state.contentWidth, 0, env, theme);
    if (estimatedHeight <= remainingHeight(state)) {
      await placeFlowNodes(node.children, 0, state, env, theme);
      return;
    }

    if (estimatedHeight <= state.usableHeight) {
      newPage(state);
      await placeFlowNodes(node.children, 0, state, env, theme);
      return;
    }

    // V1 improvement: fragmentar KeepTogether en sub-bloques medibles para evitar fallback.
    await placeFlowNodes(node.children, 0, state, env, theme);
    return;
  }

  if (isNodeType(node, "Row")) {
    await placeRow(node as RFElement<RowProps>, state, env, theme);
    return;
  }

  if (isNodeType(node, "Col")) {
    await placeFlowNodes(node.children, 0, state, env, theme);
    return;
  }

  if (isNodeType(node, "Divider")) {
    placeDivider(node, state, theme);
    return;
  }

  if (isNodeType(node, "Image")) {
    await placeImage(node as RFElement<ImageProps>, state, env, theme);
    return;
  }

  if (isNodeType(node, "Card")) {
    await placeCard(node as RFElement<CardProps>, state, env, theme);
    return;
  }

  if (isNodeType(node, "Badge")) {
    placeBadge(node as RFElement<BadgeProps>, state, theme);
    return;
  }

  if (isNodeType(node, "KPI")) {
    placeKPI(node as RFElement<KPIProps>, state, theme);
    return;
  }

  if (isNodeType(node, "Chart")) {
    placeChart(node as RFElement<ChartProps>, state, theme);
    return;
  }

  if (isNodeType(node, "Table")) {
    await placeTable(node as RFElement<TableProps<Record<string, unknown>>>, state, env, theme);
  }
};

const splitDocumentChildren = (
  children: RFNode[]
): {
  header?: RFElement;
  footer?: RFElement;
  watermark?: RFElement<WatermarkProps>;
  body: RFNode[];
} => {
  const flat = flattenNodes(children);
  let header: RFElement | undefined;
  let footer: RFElement | undefined;
  let watermark: RFElement<WatermarkProps> | undefined;
  const body: RFNode[] = [];

  for (const node of flat) {
    if (isNodeType(node, "Header") && !header) {
      header = node;
      continue;
    }
    if (isNodeType(node, "Footer") && !footer) {
      footer = node;
      continue;
    }
    if (isNodeType(node, "Watermark") && !watermark) {
      watermark = node as RFElement<WatermarkProps>;
      continue;
    }
    body.push(node);
  }

  return { header, footer, watermark, body };
};

const unwrapDocumentTheme = (
  children: RFNode[],
  defaultTheme: ThemeTokens
): { theme: ThemeTokens; children: RFNode[] } => {
  let theme = defaultTheme;
  let current = flattenNodes(children);

  // Preserve MVP behavior but support a top-level ThemeProvider wrapper for full-document theming.
  while (current.length === 1 && isNodeType(current[0], "ThemeProvider")) {
    const provider = current[0].props as ThemeProviderProps;
    theme = resolveTheme(provider.theme, theme);
    current = flattenNodes(current[0].children);
  }

  return { theme, children: current };
};

export const buildLayout = async (
  root: RFNode,
  options: RenderOptions = {}
): Promise<LayoutResult> => {
  if (!isElement(root) || root.type !== "Document") {
    throw new Error("renderToPdf espera un nodo raiz <Document />.");
  }

  const docProps = root.props as DocumentProps;
  const size = PAGE_SIZES[docProps.size ?? "A4"];
  const margins = resolveMargins(docProps.margin);
  const defaultTheme = resolveTheme(undefined, DEFAULT_THEME);
  const { theme: baseTheme, children: documentChildren } = unwrapDocumentTheme(
    root.children,
    defaultTheme
  );
  const env: LayoutEnv = {
    imageStore: new ImageStore(options.assetBaseDir)
  };

  const { header, footer, watermark, body } = splitDocumentChildren(documentChildren);
  const contentWidth = size.width - margins.left - margins.right;
  const headerHeight = header
    ? await measureNodes(header.children, contentWidth, DEFAULT_STACK_GAP, env, baseTheme)
    : 0;
  const footerHeight = footer
    ? await measureNodes(footer.children, contentWidth, DEFAULT_STACK_GAP, env, baseTheme)
    : 0;

  const bodyTop = margins.top + (header ? headerHeight + SECTION_GAP : 0);
  const bodyBottom = size.height - margins.bottom - (footer ? footerHeight + SECTION_GAP : 0);
  if (bodyBottom <= bodyTop) {
    throw new Error("Los margenes + header/footer no dejan espacio util para el contenido.");
  }

  const watermarkOps: WatermarkDrawOp[] = [];
  if (watermark) {
    const wm = watermark.props;
    watermarkOps.push({
      kind: "watermark",
      text: wm.text,
      opacity: normalizeOpacity(wm.opacity, 0.1),
      rotate: Number(wm.rotate ?? -35),
      fontSize: Number(wm.fontSize ?? 42),
      color: toRgbColor(wm.color ?? baseTheme.primary, baseTheme.primary)
    });
  }

  const headerOps: DrawOp[] = [];
  if (header) {
    await layoutStaticNodes(
      header.children,
      margins.left,
      margins.top,
      contentWidth,
      headerHeight,
      headerOps,
      env,
      DEFAULT_STACK_GAP,
      baseTheme
    );
  }

  const footerOps: DrawOp[] = [];
  if (footer) {
    const footerTop = size.height - margins.bottom - footerHeight;
    await layoutStaticNodes(
      footer.children,
      margins.left,
      footerTop,
      contentWidth,
      footerHeight,
      footerOps,
      env,
      DEFAULT_STACK_GAP,
      baseTheme
    );
  }

  const firstPage: PageLayout = {
    backgroundColor: colorFromTheme(baseTheme, "background"),
    watermarkOps: structuredClone(watermarkOps),
    headerOps: cloneOps(headerOps),
    bodyOps: [],
    footerOps: cloneOps(footerOps)
  };

  const state: FlowState = {
    pages: [firstPage],
    page: firstPage,
    cursorY: bodyTop,
    contentX: margins.left,
    contentWidth,
    bodyTop,
    bodyBottom,
    usableHeight: bodyBottom - bodyTop,
    backgroundTemplate: colorFromTheme(baseTheme, "background"),
    watermarkTemplate: watermarkOps,
    headerTemplate: headerOps,
    footerTemplate: footerOps
  };

  await placeFlowNodes(body, 0, state, env, baseTheme);

  return {
    pageWidth: size.width,
    pageHeight: size.height,
    pages: state.pages,
    imageAssets: env.imageStore.entries()
  };
};
