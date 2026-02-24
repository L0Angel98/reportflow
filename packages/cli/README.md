# @angel-vlqz/reportflow-cli

CLI for generating ReportFlow PDFs from template + JSON data.

## Install

Requirements:

- Node.js `>=22`
- ESM project

Install locally:

```bash
pnpm add -D @angel-vlqz/reportflow-cli
```

Or run without installing:

```bash
pnpm dlx @angel-vlqz/reportflow-cli --help
```

## Commands

### `render`

One-shot PDF generation.

```bash
reportflow render \
  --template ./examples/report.tsx \
  --data ./examples/data/maintenance.json \
  --out ./out/report.pdf
```

### `dev`

Watch mode for template/data files.

```bash
reportflow dev \
  --template ./examples/report.tsx \
  --data ./examples/data/maintenance.json \
  --out ./out/report.pdf
```

## Template Contract

Template file must export a default document factory, normally built with:

- `createDocument((data) => RFNode, schema?)` from `@angel-vlqz/reportflow-core`

The `--data` JSON is parsed and validated by the optional schema.

## Typical Workflow

1. Build template in TypeScript (`.tsx`).
2. Store report data as JSON.
3. Run `reportflow render` in CI/CD or local scripts.
4. Publish generated PDF artifact.

## License

MIT
