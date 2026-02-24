import { RF_FRAGMENT, createElement } from "./create-element.js";
import type { RFNode } from "./types.js";

export const Fragment = RF_FRAGMENT;

export const jsx = (
  type: string | ((props: object) => RFNode),
  props: Record<string, unknown>
): RFNode => createElement(type, props);

export const jsxs = jsx;
export const jsxDEV = jsx;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
  export type Element = RFNode;
  export interface IntrinsicElements {
    [elemName: string]: never;
  }
}
