# @reportflow/core

Declarative TypeScript engine for enterprise PDF reports.

## Install

```bash
pnpm add @reportflow/core
```

## Quick Example

```ts
import { Document, Stack, Text, renderToPdf } from "@reportflow/core";

const doc = Document({
  size: "A4",
  margin: 36,
  children: [
    Stack({
      gap: 8,
      children: [
        Text({ fontSize: 18, fontWeight: "bold", children: "Executive Report" }),
        Text({ children: "Generated with ReportFlow core." })
      ]
    })
  ]
});

const bytes = await renderToPdf(doc);
```

## Features

- predictable layout engine with pagination
- long tables with repeated header
- charts, KPI cards, watermark
- theme tokens for enterprise branding

License: MIT
