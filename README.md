# ReportFlow

ReportFlow is an open-source TypeScript/Node engine to generate enterprise PDF reports from declarative components (no HTML/CSS).

## What is ReportFlow

ReportFlow is built for business and technical reporting where deterministic pagination matters:

- layout engine with predictable flow and page breaks
- long tables with repeated headers
- charts, KPI blocks, cards and watermark
- theme tokens for multi-brand executive outputs
- CLI to render reports from template + JSON data

## Installation

Prerequisites:

- Node.js `>=22`
- `pnpm`
- ESM runtime (`"type": "module"`)

Install and build:

```bash
pnpm install
pnpm build
```

## Quick Start

Generate a report from the included examples:

```bash
pnpm render:executive
```

Use CLI directly:

```bash
node ./packages/cli/dist/index.js render \
  --template ./examples/report.tsx \
  --data ./examples/data/maintenance.json \
  --out ./out/report.pdf
```

Watch mode:

```bash
node ./packages/cli/dist/index.js dev \
  --template ./examples/report.tsx \
  --data ./examples/data/maintenance.json \
  --out ./out/report.pdf
```

## Example Output

Demo PDF (generated locally):

- `out/operations-trends-blue.pdf`

Generate it:

```bash
pnpm render:operations:blue
```

Other ready-to-run demos:

```bash
pnpm render:maintenance
pnpm render:iot
pnpm render:executive-performance:all
pnpm render:operations:all
```

## Packages

- `@reportflow/core`: engine + components + render API
- `@reportflow/cli`: CLI (`reportflow render`, `reportflow dev`)

## Public API

```ts
import { renderToPdf, createDocument } from "@reportflow/core";
```

- `renderToPdf(element: RFNode, options?): Promise<Uint8Array>`
- `createDocument(template: (data) => RFNode, schema?: zodSchema)`

## NPM Publishing

Workspace helper scripts:

```bash
pnpm publish:core
pnpm publish:cli
pnpm publish:all
```

Both packages are configured with `publishConfig.access = "public"`.

## Compatibility

- Node engine: `>=22`
- ESM-first packages
- CI matrix: Node `22` and `24`

## License

MIT
