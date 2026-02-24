import type { ZodType } from "zod";

export type PageSize = "A4" | "LETTER";
export type OverflowMode = "clip" | "ellipsis" | "shrink";
export type ImageFit = "contain" | "cover";
export type Align = "left" | "center" | "right";
export type ImageAlign = Align;
export type ChartType = "bar" | "line" | "pie" | "area";
export type BadgeTone = "default" | "success" | "danger" | "warning" | "info";
export type KPIStatus = "neutral" | "success" | "danger" | "warning";

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type MarginInput = number | Partial<Margins>;

export type RFPrimitive = string | number | boolean | null | undefined;
export type RFChild = RFNode | RFPrimitive | RFChild[];

export interface RFElement<TProps extends object = object, TType extends string = string> {
  type: TType;
  props: TProps;
  children: RFNode[];
}

export type RFNode = RFElement | string;

export interface BaseProps {
  children?: RFChild;
}

export interface DocumentProps extends BaseProps {
  size?: PageSize;
  margin?: MarginInput;
}

export interface TextProps extends BaseProps {
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  lineHeight?: number;
  wrap?: boolean;
  maxLines?: number;
  overflow?: OverflowMode;
  minFontSize?: number;
  ellipsis?: string;
  color?: string;
  align?: Align;
}

export interface StackProps extends BaseProps {
  gap?: number;
}

export interface RowProps extends BaseProps {
  gap?: number;
}

export interface ColProps extends BaseProps {
  width?: number | `${number}%`;
}

export interface DividerProps {
  thickness?: number;
  color?: string;
}

export interface TableColumn<T extends Record<string, unknown> = Record<string, unknown>> {
  key: keyof T & string;
  title: string;
  width?: number | `${number}%`;
  align?: Align;
}

export interface TableProps<T extends Record<string, unknown> = Record<string, unknown>> {
  columns: TableColumn<T>[];
  rows: T[];
  rowHeight?: number;
  headerHeight?: number;
  repeatHeader?: boolean;
  keepRowsTogether?: boolean;
  keepWithHeader?: boolean;
  borderRadius?: number;
  borderColor?: string;
  headerBackground?: string;
  headerAlign?: Align;
  cellPadding?: number;
  showOuterBorder?: boolean;
}

export interface ImageProps {
  src: string;
  fit?: ImageFit;
  maxHeight?: number;
  borderRadius?: number;
  opacity?: number;
  grayscale?: boolean;
  align?: ImageAlign;
}

export interface LogoProps extends Omit<ImageProps, "fit"> {
  fit?: ImageFit;
}

export interface ThemeTokens {
  primary: string;
  primarySoft: string;
  primaryStrong: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  success: string;
  danger: string;
}

export interface ThemeInput extends Partial<ThemeTokens> {
  /**
   * Legacy alias kept for backward compatibility with the MVP templates.
   * Prefer `primarySoft` in new templates.
   */
  secondary?: string;
}

export interface ThemeProviderProps extends BaseProps {
  theme: ThemeInput;
}

export interface WatermarkProps {
  text: string;
  opacity?: number;
  rotate?: number;
  fontSize?: number;
  color?: string;
}

export interface CardProps extends BaseProps {
  padding?: number;
  radius?: number;
  borderWidth?: number;
  backgroundColor?: string;
  borderColor?: string;
  gap?: number;
}

export interface BadgeProps extends BaseProps {
  tone?: BadgeTone;
  text?: string;
  fontSize?: number;
  paddingX?: number;
  paddingY?: number;
}

export interface KPIProps {
  label: string;
  value: string | number;
  delta?: string;
  status?: KPIStatus;
  align?: Align;
}

export interface ChartData {
  labels: string[];
  values: number[];
}

export interface ChartOptions {
  colors?: string[];
  legend?: boolean;
  grid?: boolean;
  title?: string;
  titleAlign?: Align;
  legendPosition?: "top" | "bottom";
  showValues?: boolean;
  showPoints?: boolean;
  yAxisMin?: number;
  yAxisMax?: number;
}

export interface ChartProps {
  type: ChartType;
  data: ChartData;
  options?: ChartOptions;
  width?: number | `${number}%`;
  height?: number;
  align?: Align;
  borderRadius?: number;
}

export type KeepTogetherProps = BaseProps;
export type HeaderProps = BaseProps;
export type FooterProps = BaseProps;

export interface RenderOptions {
  title?: string;
  author?: string;
  subject?: string;
  assetBaseDir?: string;
}

export interface DocumentBuilder<TData> {
  template: (data: TData) => RFNode;
  schema?: ZodType<TData>;
  render: (data: unknown, options?: RenderOptions) => Promise<Uint8Array>;
}
