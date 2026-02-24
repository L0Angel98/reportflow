# @angel-vlqz/reportflow-core

TypeScript PDF engine for business reports with deterministic layout and pagination.

## What Is This Package

`@angel-vlqz/reportflow-core` is the rendering engine behind ReportFlow.  
It provides declarative components (no HTML/CSS), a layout/pagination system, and PDF output using Node.js.

## Install

Requirements:

- Node.js `>=22`
- ESM runtime (`"type": "module"`)

Install:

```bash
pnpm add @angel-vlqz/reportflow-core
```

## Quick Start

```ts
import { writeFile } from "node:fs/promises";
import { Document, Stack, Text, renderToPdf } from "@angel-vlqz/reportflow-core";

const doc = Document({
  size: "A4",
  margin: 36,
  children: [
    Stack({
      gap: 8,
      children: [
        Text({ fontSize: 20, fontWeight: "bold", children: "Executive Report" }),
        Text({ children: "Generated with ReportFlow core." })
      ]
    })
  ]
});

const bytes = await renderToPdf(doc);
await writeFile("./report.pdf", bytes);
```

## Public API

```ts
renderToPdf(element: RFNode, options?): Promise<Uint8Array>
createDocument(template: (data) => RFNode, schema?: zodSchema)
```

## Available Components

- Document
- Text
- Stack, Row, Col
- Divider
- Table
- Header, Footer
- KeepTogether
- Image, Logo
- Card, Badge, KPI
- Chart
- Watermark
- ThemeProvider

## Engine Behavior

- Vertical flow layout with page-aware placement
- Long table pagination with repeated header
- Keep-together rules for non-splittable blocks
- Text overflow strategies: wrap, ellipsis, shrink
- Header/Footer applied globally per page

## Theme Tokens

All visual color decisions come from tokens:

- `primary`
- `primarySoft`
- `primaryStrong`
- `accent`
- `background`
- `surface`
- `text`
- `muted`
- `success`
- `danger`

## Related Package

For rendering templates from terminal/CI, use:

- `@angel-vlqz/reportflow-cli`

## License

MIT
