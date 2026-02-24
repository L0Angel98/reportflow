import type { ZodType } from "zod";
import { renderToPdf } from "./render.js";
import type { DocumentBuilder, RFNode, RenderOptions } from "./types.js";

export const createDocument = <TData>(
  template: (data: TData) => RFNode,
  schema?: ZodType<TData>
): DocumentBuilder<TData> => ({
  template,
  schema,
  async render(data: unknown, options?: RenderOptions): Promise<Uint8Array> {
    const parsed = schema ? schema.parse(data) : (data as TData);
    return renderToPdf(template(parsed), options);
  }
});
