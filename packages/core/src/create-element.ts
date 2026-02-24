import type { RFChild, RFElement, RFNode } from "./types.js";

export const RF_FRAGMENT = "Fragment";

export type RFComponent<TProps extends object = object> = (props: TProps) => RFNode;

const isRFElement = (value: unknown): value is RFElement =>
  typeof value === "object" && value !== null && "type" in value && "props" in value;

export const normalizeChildren = (input: RFChild | RFChild[] | undefined): RFNode[] => {
  const out: RFNode[] = [];

  const pushChild = (value: RFChild): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        pushChild(item);
      }
      return;
    }

    if (value === null || value === undefined || typeof value === "boolean") {
      return;
    }

    if (typeof value === "string" || typeof value === "number") {
      out.push(String(value));
      return;
    }

    if (isRFElement(value)) {
      out.push(value);
      return;
    }
  };

  if (Array.isArray(input)) {
    for (const child of input) {
      pushChild(child);
    }
  } else if (input !== undefined) {
    pushChild(input);
  }

  return out;
};

export const createNode = <TProps extends object, TType extends string = string>(
  type: TType,
  props: TProps,
  children: RFNode[]
): RFElement<TProps, TType> => ({
  type,
  props,
  children
});

export const createElement = (
  type: string | RFComponent,
  rawProps: Record<string, unknown> | null,
  ...runtimeChildren: RFChild[]
): RFNode => {
  const props = { ...(rawProps ?? {}) };
  const fromProps = props.children as RFChild | RFChild[] | undefined;
  const children = normalizeChildren(fromProps ?? runtimeChildren);
  delete props.children;

  if (typeof type === "function") {
    return type({ ...props, children });
  }

  if (type === RF_FRAGMENT) {
    return createNode(RF_FRAGMENT, {}, children);
  }

  return createNode(type, props, children);
};
