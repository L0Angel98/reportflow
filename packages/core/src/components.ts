import { createNode, normalizeChildren } from "./create-element.js";
import type {
  BadgeProps,
  CardProps,
  ChartProps,
  ColProps,
  DividerProps,
  DocumentProps,
  FooterProps,
  HeaderProps,
  ImageProps,
  KPIProps,
  KeepTogetherProps,
  LogoProps,
  RFElement,
  RFNode,
  RowProps,
  StackProps,
  ThemeProviderProps,
  TableProps,
  TextProps,
  WatermarkProps
} from "./types.js";

const nodeFromProps = <TProps extends object>(type: string, props: TProps): RFElement<TProps> => {
  const { children, ...rest } = props as TProps & { children?: unknown };
  return createNode(type, rest as TProps, normalizeChildren(children as never));
};

export const Document = (props: DocumentProps): RFNode => nodeFromProps("Document", props);
export const Text = (props: TextProps): RFNode => nodeFromProps("Text", props);
export const Stack = (props: StackProps): RFNode => nodeFromProps("Stack", props);
export const Row = (props: RowProps): RFNode => nodeFromProps("Row", props);
export const Col = (props: ColProps): RFNode => nodeFromProps("Col", props);
export const Divider = (props: DividerProps = {}): RFNode => nodeFromProps("Divider", props);
export const Table = <T extends Record<string, unknown>>(props: TableProps<T>): RFNode =>
  nodeFromProps("Table", props);
export const Header = (props: HeaderProps): RFNode => nodeFromProps("Header", props);
export const Footer = (props: FooterProps): RFNode => nodeFromProps("Footer", props);
export const Image = (props: ImageProps): RFNode => nodeFromProps("Image", props);
export const KeepTogether = (props: KeepTogetherProps): RFNode =>
  nodeFromProps("KeepTogether", props);
export const ThemeProvider = (props: ThemeProviderProps): RFNode =>
  nodeFromProps("ThemeProvider", props);
export const Watermark = (props: WatermarkProps): RFNode => nodeFromProps("Watermark", props);
export const Card = (props: CardProps): RFNode => nodeFromProps("Card", props);
export const Badge = (props: BadgeProps): RFNode => nodeFromProps("Badge", props);
export const KPI = (props: KPIProps): RFNode => nodeFromProps("KPI", props);
export const Chart = (props: ChartProps): RFNode => nodeFromProps("Chart", props);
export const Logo = (props: LogoProps): RFNode =>
  nodeFromProps("Image", { fit: "contain", maxHeight: 56, align: "left", ...props });
